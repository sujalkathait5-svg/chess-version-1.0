import { Color, FENChar } from "../chess-logic/models";
import type { GameReviewStats, MoveClassification, MoveAnalysis, MoveList } from "../chess-logic/models";
import { isBookMove } from "./openings";

export type ChessMove = {
    prevX: number;
    prevY: number;
    newX: number;
    newY: number;
    promotedPiece: FENChar | null;
};

export type StockfishResponse = {
    success: boolean;
    evaluation: number | null;
    mate: number | null;
    bestmove: string;
    continuation: string;
};

export const stockfishLevels: Readonly<Record<number, number>> = {
    1: 3,
    2: 5,
    3: 7,
    4: 9,
    5: 11,
    6: 20,
};

export const stockfishTimeLimits: Readonly<Record<number, number>> = {
    1: 500,
    2: 1000,
    3: 2000,
    4: 3000,
    5: 4000,
    6: 5000
};

const convertColumnLetterToYCoord = (str: string): number =>
    str.charCodeAt(0) - "a".charCodeAt(0);

const getPromotedPiece = (piece: string | undefined, computerColor: Color): FENChar | null => {
    if (!piece) return null;
    if (piece === "n") return computerColor === Color.White ? FENChar.WhiteKnight : FENChar.BlackKnight;
    if (piece === "b") return computerColor === Color.White ? FENChar.WhiteBishop : FENChar.BlackBishop;
    if (piece === "r") return computerColor === Color.White ? FENChar.WhiteRook : FENChar.BlackRook;
    return computerColor === Color.White ? FENChar.WhiteQueen : FENChar.BlackQueen;
};

const moveFromStockfishString = (move: string, computerColor: Color): ChessMove => {
    const prevY = convertColumnLetterToYCoord(move[0]);
    const prevX = Number(move[1]) - 1;
    const newY = convertColumnLetterToYCoord(move[2]);
    const newX = Number(move[3]) - 1;
    const promotedPiece = getPromotedPiece(move[4], computerColor);
    return { prevX, prevY, newX, newY, promotedPiece };
};

// ─────────────────────────────────────────────────────────────────────────────
// STOCKFISH WEBWORKER — Production-quality lifecycle management
// FIX: Worker termination guard + uciok ready-state + 10-second timeout
// FIX: Mutex serialisation (one request at a time, concurrent calls queue up)
// ─────────────────────────────────────────────────────────────────────────────

let sfWorker: Worker | null = null;
// FIX: Track whether "uciok" has been received so we never postMessage before
//      the engine is initialised. Resolves when the worker is ready to accept
//      "position" + "go" commands.
let sfWorkerReadyPromise: Promise<void> = Promise.resolve();
let sfWorkerReadyResolve: (() => void) | null = null;

// FIX: Mutex — each request chains onto this tail promise so only one
//      getBestMove / getEvaluation call is active at a time. Queued callers
//      wait automatically without polling.
let sfWorkerMutex: Promise<void> = Promise.resolve();

// FIX: Terminate the old worker before creating a new one (termination guard).
export function terminateWorker(): void {
    if (sfWorker) {
        sfWorker.onmessage = null;
        sfWorker.onerror = null;
        try { sfWorker.terminate(); } catch { /* ignore */ }
        sfWorker = null;
    }
    // Reset the mutex so stale queued jobs don't block the new worker.
    sfWorkerMutex = Promise.resolve();
}

function getOrCreateWorker(): Worker | null {
    if (sfWorker) return sfWorker;
    try {
        // FIX: Terminate any lingering worker before creating a fresh one.
        terminateWorker();

        const workerPath = `${import.meta.env.BASE_URL}stockfish.js`;
        sfWorker = new Worker(workerPath);

        // FIX: Set up the uciok ready-state promise before sending "uci".
        sfWorkerReadyPromise = new Promise<void>((resolve) => {
            sfWorkerReadyResolve = resolve;
        });

        sfWorker.onerror = () => {
            // On fatal error: detach handlers, null the ref, reset ready state.
            terminateWorker();
            sfWorkerReadyPromise = Promise.resolve(); // unblock any waiting caller
            sfWorkerReadyResolve = null;
        };

        // Intercept "uciok" / "readyok" during init; hand off to per-request
        // handlers once the engine is ready.
        sfWorker.onmessage = (e: MessageEvent) => {
            const line: string = typeof e.data === "string" ? e.data : (e.data?.data ?? "");
            // FIX: Resolve the ready promise on "uciok" so callers that have
            //      chained on sfWorkerReadyPromise can proceed.
            if (line === "uciok" || line.startsWith("readyok")) {
                sfWorkerReadyResolve?.();
                sfWorkerReadyResolve = null;
            }
        };

        sfWorker.postMessage("uci");
        sfWorker.postMessage("isready");
        return sfWorker;
    } catch {
        sfWorker = null;
        sfWorkerReadyPromise = Promise.resolve();
        return null;
    }
}

// ─── Shared request executor ─────────────────────────────────────────────────
// Generic serialised worker request. Waits for:
//   1. The mutex (previous request done)
//   2. The worker ready promise (uciok received)
// Times out after 10 seconds and auto-falls-back to REST API.
type WorkerResult = { evaluation: number | null; mate: number | null; bestmove: string; continuation: string } | null;

let evaluationSeq = 0;

function workerRequest(
    fen: string,
    depth: number,
    captureEval: boolean,
    movetime?: number,
    seq?: number
): Promise<WorkerResult> {
    const result = sfWorkerMutex.then(async () => {
        if (captureEval && seq !== undefined && seq !== evaluationSeq) {
            return null;
        }
        // FIX: Wait for "uciok" before sending position/go commands.
        await sfWorkerReadyPromise;

        return new Promise<WorkerResult>((resolve) => {
            const worker = getOrCreateWorker();
            if (!worker) { resolve(null); return; }

            let resolved = false;
            let latestEval: number | null = null;
            let latestMate: number | null = null;
            let latestBestmove = "";
            let latestContinuation = "";

            if (captureEval && seq !== undefined && seq !== evaluationSeq) {
                resolve(null);
                return;
            }

            // FIX: 10-second hard timeout per request; resolves null to trigger fallback.
            const timeout = setTimeout(() => {
                if (resolved) return;
                resolved = true;
                worker.onmessage = null;
                resolve(null);
            }, 10_000);

            // FIX: Each request owns the onmessage handler exclusively.
            //      No shared queue — eliminates concurrent-drain race.
            worker.onmessage = (e: MessageEvent) => {
                const line: string = typeof e.data === "string" ? e.data : (e.data?.data ?? "");
                if (resolved) return;

                if (captureEval && line.startsWith("info")) {
                    const cpMatch = line.match(/score cp (-?\d+)/);
                    const mateMatch = line.match(/score mate (-?\d+)/);
                    const pvMatch = line.match(/ pv (.+)/);
                    if (cpMatch) { latestEval = parseInt(cpMatch[1], 10) / 100; latestMate = null; }
                    else if (mateMatch) { latestMate = parseInt(mateMatch[1], 10); latestEval = null; }
                    if (pvMatch) {
                        const moves = pvMatch[1].trim().split(" ");
                        latestBestmove = moves[0] || "";
                        latestContinuation = moves.slice(1).join(" ");
                    }
                } else if (line.startsWith("bestmove")) {
                    clearTimeout(timeout);
                    resolved = true;
                    worker.onmessage = null;
                    const parts = line.split(" ");
                    if (!latestBestmove) latestBestmove = parts[1] || "";
                    resolve({
                        evaluation: captureEval ? latestEval : null,
                        mate: captureEval ? latestMate : null,
                        bestmove: latestBestmove,
                        continuation: latestContinuation
                    });
                }
            };

            // FIX: Send "stop" first to cancel any lingering in-progress search.
            worker.postMessage("stop");
            worker.postMessage(`position fen ${fen}`);
            if (movetime) {
                worker.postMessage(`go depth ${depth} movetime ${movetime}`);
            } else {
                worker.postMessage(`go depth ${depth}`);
            }
        });
    });

    // Advance the mutex tail so the next caller waits behind this one.
    sfWorkerMutex = result.then(() => undefined, () => undefined);
    return result;
}

// ─── API fallback (network, slower) ──────────────────────────────────────────
async function apiBestMove(fen: string, depth: number): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
        const url = `/api/bestmove?fen=${encodeURIComponent(fen)}&depth=${depth}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return null;
        const data: StockfishResponse = await res.json();
        if (data.success && data.bestmove) return data.bestmove.split(" ")[1] || data.bestmove;
    } catch { /* timeout or network error — silently fallthrough */ }
    finally { clearTimeout(timer); }
    return null;
}

async function apiEvaluation(fen: string, depth: number): Promise<WorkerResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
        const url = `/api/evaluate?fen=${encodeURIComponent(fen)}&depth=${depth}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return null;
        const data: StockfishResponse = await res.json();
        if (data.success) {
            return {
                evaluation: data.evaluation,
                mate: data.mate,
                bestmove: data.bestmove ? (data.bestmove.split(" ")[1] || data.bestmove) : "",
                continuation: data.continuation || ""
            };
        }
    } catch { /* silently swallow */ }
    finally { clearTimeout(timer); }
    return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getBestMove(fen: string, level: number, computerColor: Color): Promise<ChessMove> {
    const depth = stockfishLevels[level] ?? 5;
    const movetime = stockfishTimeLimits[level] ?? 800;

    // Try worker first (fast, offline); timeout triggers null → REST fallback.
    const workerResult = await workerRequest(fen, depth, false, movetime);
    const moveStr = workerResult?.bestmove || await apiBestMove(fen, depth);

    if (!moveStr) throw new Error("Stockfish returned no move — both worker and API failed.");
    return moveFromStockfishString(moveStr, computerColor);
}

export async function getEvaluation(
    fen: string,
    depth: number = 5,
    movetime?: number
): Promise<{ evaluation: number | null; mate: number | null; bestmove: string; continuation: string }> {
    evaluationSeq++;
    const currentSeq = evaluationSeq;

    // Try local WASM worker first (B-009 fix: no longer always hits the network).
    const workerResult = await workerRequest(fen, depth, true, movetime, currentSeq);
    if (currentSeq !== evaluationSeq) {
        return new Promise(() => {}); // Never resolve stale requests
    }
    if (workerResult !== null) return workerResult;

    const apiResult = await apiEvaluation(fen, depth);
    if (currentSeq !== evaluationSeq) {
        return new Promise(() => {}); // Never resolve stale requests
    }
    if (apiResult !== null) return apiResult;

    return { evaluation: 0.0, mate: null, bestmove: "", continuation: "" };
}

// ─── Normalise eval to centipawns (White-positive) ───────────────────────────
export function normalizeEval(evaluation: number | null, mate: number | null): number {
    if (mate !== null) {
        const mateScore = mate > 0 ? 100 - mate : -100 - mate;
        return mateScore * 100;
    }
    if (evaluation === null) return 0;
    return evaluation * 100;
}

// Helper to evaluate a FEN using a temporary parallel Web Worker
function evaluateSingleFenWasm(
    fen: string,
    depth: number,
    movetime: number,
    signal?: AbortSignal
): Promise<WorkerResult> {
    return new Promise((resolve) => {
        if (signal?.aborted) {
            resolve(null);
            return;
        }
        try {
            const workerPath = `${import.meta.env.BASE_URL}stockfish.js`;
            const worker = new Worker(workerPath);
            let resolved = false;
            let latestEval: number | null = null;
            let latestMate: number | null = null;
            let latestBestmove = "";
            let latestContinuation = "";

            const onAbort = () => {
                if (resolved) return;
                resolved = true;
                clearTimeout(timeout);
                try { worker.terminate(); } catch { /* ignore */ }
                resolve(null);
            };

            if (signal) {
                signal.addEventListener("abort", onAbort);
            }

            const timeout = setTimeout(() => {
                if (resolved) return;
                resolved = true;
                if (signal) {
                    signal.removeEventListener("abort", onAbort);
                }
                try { worker.terminate(); } catch { /* ignore */ }
                resolve(null);
            }, 12000);

            worker.onmessage = (e: MessageEvent) => {
                const line: string = typeof e.data === "string" ? e.data : (e.data?.data ?? "");
                if (resolved) return;

                if (line === "uciok" || line.startsWith("readyok")) {
                    worker.postMessage(`position fen ${fen}`);
                    worker.postMessage(`go depth ${depth} movetime ${movetime}`);
                } else if (line.startsWith("info")) {
                    const cpMatch = line.match(/score cp (-?\d+)/);
                    const mateMatch = line.match(/score mate (-?\d+)/);
                    const pvMatch = line.match(/ pv (.+)/);
                    if (cpMatch) { latestEval = parseInt(cpMatch[1], 10) / 100; latestMate = null; }
                    else if (mateMatch) { latestMate = parseInt(mateMatch[1], 10); latestEval = null; }
                    if (pvMatch) {
                        const moves = pvMatch[1].trim().split(" ");
                        latestBestmove = moves[0] || "";
                        latestContinuation = moves.slice(1).join(" ");
                    }
                } else if (line.startsWith("bestmove")) {
                    clearTimeout(timeout);
                    resolved = true;
                    if (signal) {
                        signal.removeEventListener("abort", onAbort);
                    }
                    try { worker.terminate(); } catch { /* ignore */ }
                    const parts = line.split(" ");
                    if (!latestBestmove) latestBestmove = parts[1] || "";
                    resolve({
                        evaluation: latestEval,
                        mate: latestMate,
                        bestmove: latestBestmove,
                        continuation: latestContinuation
                    });
                }
            };

            worker.postMessage("uci");
        } catch {
            resolve(null);
        }
    });
}

// Unified parallel single FEN evaluation loader with API fallback
async function getSingleEvaluation(
    fen: string,
    depth: number,
    movetime: number,
    signal?: AbortSignal
): Promise<{ evaluation: number | null; mate: number | null; bestmove: string; continuation: string }> {
    if (signal?.aborted) {
        return { evaluation: 0.0, mate: null, bestmove: "", continuation: "" };
    }
    const workerResult = await evaluateSingleFenWasm(fen, depth, movetime, signal);
    if (workerResult !== null) return workerResult;

    if (signal?.aborted) {
        return { evaluation: 0.0, mate: null, bestmove: "", continuation: "" };
    }

    console.warn(`WASM Worker evaluation failed or timed out for FEN: ${fen}. Falling back to REST API.`);
    const apiResult = await apiEvaluation(fen, depth);
    if (apiResult !== null) return apiResult;

    return { evaluation: 0.0, mate: null, bestmove: "", continuation: "" };
}

// Parallel Batch runner using chunk-by-chunk method (concurrency = 2)
async function batchFetchParallel<T, R>(
    items: T[],
    fn: (item: T, index: number, signal?: AbortSignal) => Promise<R>,
    concurrency: number,
    onProgress?: (completed: number, total: number) => void,
    signal?: AbortSignal
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let completedCount = 0;

    for (let i = 0; i < items.length; i += concurrency) {
        if (signal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
        }
        const chunk = items.slice(i, i + concurrency);
        const chunkPromises = chunk.map((item, index) => {
            const actualIndex = i + index;
            return fn(item, actualIndex, signal).then((res) => {
                if (signal?.aborted) {
                    throw new DOMException("Aborted", "AbortError");
                }
                results[actualIndex] = res;
                completedCount++;
                onProgress?.(completedCount, items.length);
            });
        });
        await Promise.all(chunkPromises);
    }
    return results;
}

function getMaterialScore(fen: string, isWhite: boolean): number {
    const piecePart = fen.split(" ")[0];
    let score = 0;
    for (const char of piecePart) {
        let val = 0;
        switch (char.toLowerCase()) {
            case 'p': val = 1; break;
            case 'n': val = 3; break;
            case 'b': val = 3; break;
            case 'r': val = 5; break;
            case 'q': val = 9; break;
        }
        if (val > 0) {
            const charIsWhite = char === char.toUpperCase();
            if (charIsWhite === isWhite) {
                score += val;
            } else {
                score -= val;
            }
        }
    }
    return score;
}

// ─── Post-game analysis ───────────────────────────────────────────────────────
export async function analyzeGame(
    fens: string[],
    moveList: MoveList,
    onProgress?: (completed: number, total: number) => void,
    signal?: AbortSignal,
    onIncrementalUpdate?: (stats: GameReviewStats) => void
): Promise<GameReviewStats> {
    const evaluations: (WorkerResult | null)[] = new Array(fens.length).fill(null);
    let completedCount = 0;

    const whiteClassifications: Record<MoveClassification, number> = {
        brilliant: 0, great: 0, best: 0, excellent: 0, good: 0,
        book: 0, inaccuracy: 0, mistake: 0, miss: 0, blunder: 0
    };
    const blackClassifications: Record<MoveClassification, number> = {
        brilliant: 0, great: 0, best: 0, excellent: 0, good: 0,
        book: 0, inaccuracy: 0, mistake: 0, miss: 0, blunder: 0
    };
    const moveAnalyses: MoveAnalysis[] = [];

    const flatMoves: string[] = [];
    moveList.forEach(m => { flatMoves.push(m[0]); if (m[1]) flatMoves.push(m[1]); });

    const evaluateAndClassify = async (fen: string, idx: number, sig?: AbortSignal) => {
        const res = await getSingleEvaluation(fen, 10, 500, sig);
        if (sig?.aborted) throw new DOMException("Aborted", "AbortError");
        evaluations[idx] = res;
        completedCount++;
        onProgress?.(completedCount, fens.length);

        let updated = false;
        for (let i = 0; i < flatMoves.length; i++) {
            if (moveAnalyses[i]) continue;

            const evalBeforeRaw = evaluations[i];
            const evalAfterRaw = evaluations[i + 1];
            if (!evalBeforeRaw || !evalAfterRaw) {
                break;
            }

            const isWhite = i % 2 === 0;
            const valBefore = i === 0 ? 30 : normalizeEval(evalBeforeRaw.evaluation, evalBeforeRaw.mate);
            const valAfter = normalizeEval(evalAfterRaw.evaluation, evalAfterRaw.mate);

            const cpl = Math.max(0, isWhite ? valBefore - valAfter : valAfter - valBefore);
            const opponentBlundered = i > 0 && moveAnalyses[i - 1] && moveAnalyses[i - 1].cpl > 150;
            const playedMoveText = flatMoves[i];
            const isBestMove = cpl <= 10;

            const movesUpToNow = flatMoves.slice(0, i + 1);
            const isBook = isBookMove(movesUpToNow);

            let classification: MoveClassification;
            if (isBook) {
                classification = "book";
            } else if (isBestMove) {
                const activeAdvantage = isWhite ? valAfter : -valAfter;

                const fenBefore = fens[i];
                const fenAfter = fens[i + 1];
                const matBefore = getMaterialScore(fenBefore, isWhite);
                const matAfter = getMaterialScore(fenAfter, isWhite);
                const isSacrifice = matAfter < matBefore;
                const isBrilliant = isSacrifice && activeAdvantage >= -50 && cpl <= 10;

                const opponentHadAdvantage = isWhite ? valBefore < -100 : valBefore > 100;
                const isGreat = !isBrilliant && opponentHadAdvantage && cpl <= 10;
                classification = isBrilliant ? "brilliant" : isGreat ? "great" : "best";
            } else {
                let baseClass: MoveClassification;
                if (cpl <= 25) { baseClass = "excellent"; }
                else if (cpl <= 55) { baseClass = "good"; }
                else if (cpl <= 100) { baseClass = "inaccuracy"; }
                else if (opponentBlundered) { baseClass = "miss"; }
                else if (cpl <= 200) { baseClass = "mistake"; }
                else { baseClass = "blunder"; }

                const activeAdvantageAfter = isWhite ? valAfter : -valAfter;
                const remainsWinningOrLosing = activeAdvantageAfter >= 300 || activeAdvantageAfter <= -300;
                if (remainsWinningOrLosing) {
                    if (baseClass === "blunder") {
                        baseClass = "mistake";
                    } else if (baseClass === "mistake") {
                        baseClass = "inaccuracy";
                    }
                }
                classification = baseClass;
            }

            if (isWhite) {
                whiteClassifications[classification]++;
            } else {
                blackClassifications[classification]++;
            }

            const bestMoveText = evalBeforeRaw.bestmove || "the best option";
            const commentMap: Record<MoveClassification, string> = {
                brilliant: "Brilliant!! A precise capture that secured a decisive winning advantage.",
                great: "Great move! You found the best defensive resource in a difficult position.",
                best: "Best move. You played the top engine suggestion, keeping your play accurate.",
                excellent: "Excellent move. This continues your solid strategy and maintains your position.",
                good: "Good move. A solid choice that keeps the game playable and balanced.",
                book: "Book move. You are following standard opening theory.",
                inaccuracy: `Inaccuracy. Playing ${bestMoveText} would have given you a cleaner game.`,
                miss: `Miss. You missed exploiting your opponent's error. You should have played ${bestMoveText}.`,
                mistake: `Mistake. This gives your opponent room to push for an advantage. ${bestMoveText} was stronger.`,
                blunder: `Blunder! You hung a piece or overlooked a critical threat. ${bestMoveText} was required.`
            };

            moveAnalyses[i] = {
                moveIndex: i,
                playedMoveStr: playedMoveText,
                classification,
                cpl,
                evalBefore: valBefore / 100,
                evalAfter: valAfter / 100,
                bestMoveStr: evalBeforeRaw.bestmove,
                continuationLine: evalBeforeRaw.continuation,
                comment: commentMap[classification]
            };
            updated = true;
        }

        if (updated && onIncrementalUpdate) {
            let wAccSum = 0, wCount = 0;
            let bAccSum = 0, bCount = 0;
            for (let idx = 0; idx < moveAnalyses.length; idx++) {
                const m = moveAnalyses[idx];
                if (!m) continue;
                if (m.classification !== "book") {
                    const acc = Math.max(0, Math.min(100, Math.round(100 * Math.exp(-0.004 * m.cpl))));
                    if (idx % 2 === 0) {
                        wAccSum += acc;
                        wCount++;
                    } else {
                        bAccSum += acc;
                        bCount++;
                    }
                }
            }
            const wAcc = wCount > 0 ? Math.round(wAccSum / wCount) : 100;
            const bAcc = bCount > 0 ? Math.round(bAccSum / bCount) : 100;

            onIncrementalUpdate({
                whiteAccuracy: wAcc,
                blackAccuracy: bAcc,
                whiteClassifications: { ...whiteClassifications },
                blackClassifications: { ...blackClassifications },
                moveAnalyses: moveAnalyses.filter(Boolean),
                estimatedRatingWhite: Math.max(100, Math.min(3000, Math.round(wAcc * 22 - 300))),
                estimatedRatingBlack: Math.max(100, Math.min(3000, Math.round(bAcc * 22 - 300)))
            });
        }
    };

    // Run evaluations in chunks of 2 parallel workers
    await batchFetchParallel(fens, evaluateAndClassify, 2, undefined, signal);

    let wAccSum = 0, wCount = 0;
    let bAccSum = 0, bCount = 0;
    for (let idx = 0; idx < moveAnalyses.length; idx++) {
        const m = moveAnalyses[idx];
        if (!m) continue;
        if (m.classification !== "book") {
            const acc = Math.max(0, Math.min(100, Math.round(100 * Math.exp(-0.004 * m.cpl))));
            if (idx % 2 === 0) {
                wAccSum += acc;
                wCount++;
            } else {
                bAccSum += acc;
                bCount++;
            }
        }
    }
    const wAcc = wCount > 0 ? Math.round(wAccSum / wCount) : 100;
    const bAcc = bCount > 0 ? Math.round(bAccSum / bCount) : 100;

    const finalStats = {
        whiteAccuracy: wAcc,
        blackAccuracy: bAcc,
        whiteClassifications,
        blackClassifications,
        moveAnalyses: moveAnalyses.filter(Boolean),
        estimatedRatingWhite: Math.max(100, Math.min(3000, Math.round(wAcc * 22 - 300))),
        estimatedRatingBlack: Math.max(100, Math.min(3000, Math.round(bAcc * 22 - 300)))
    };

    onIncrementalUpdate?.(finalStats);
    return finalStats;
}
