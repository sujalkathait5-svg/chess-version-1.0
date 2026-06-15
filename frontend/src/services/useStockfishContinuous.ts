import { useState, useEffect, useRef } from 'react';

export interface StockfishContinuousState {
    evaluation: number | null;
    mate: number | null;
    bestmove: string | null;
    continuation: string | null;
    depth: number;
    lines: Array<{
        multipv: number;
        evaluation: number | null;
        mate: number | null;
        bestmove: string;
        continuation: string;
    }>;
}

export function useStockfishContinuous(
    fen: string,
    enabled: boolean,
    targetDepth: number = 20,
    multiPv: number = 1
) {
    const [engineState, setEngineState] = useState<StockfishContinuousState>({
        evaluation: null,
        mate: null,
        bestmove: null,
        continuation: null,
        depth: 0,
        lines: []
    });

    const workerRef = useRef<Worker | null>(null);

    useEffect(() => {
        if (!enabled) {
            if (workerRef.current) {
                workerRef.current.postMessage("stop");
                workerRef.current.terminate();
                workerRef.current = null;
            }
            setTimeout(() => setEngineState({
                evaluation: null,
                mate: null,
                bestmove: null,
                continuation: null,
                depth: 0,
                lines: []
            }), 0);
            return;
        }

        // Initialize worker
        const worker = new Worker(`${import.meta.env.BASE_URL}stockfish.js`);
        workerRef.current = worker;

        worker.postMessage("uci");


        worker.onmessage = (e: MessageEvent) => {
            const line: string = typeof e.data === "string" ? e.data : (e.data?.data ?? "");

            if (line === "uciok" || line.startsWith("readyok")) {
                worker.postMessage(`setoption name MultiPV value ${multiPv}`);
                worker.postMessage(`position fen ${fen}`);
                worker.postMessage(`go depth ${targetDepth}`);
            } else if (line.startsWith("info")) {
                // Parse depth
                const depthMatch = line.match(/depth (\d+)/);
                const currentDepth = depthMatch ? parseInt(depthMatch[1], 10) : 0;

                // Parse multipv index
                const multipvMatch = line.match(/multipv (\d+)/);
                const multipv = multipvMatch ? parseInt(multipvMatch[1], 10) : 1;

                // Parse score
                const cpMatch = line.match(/score cp (-?\d+)/);
                const mateMatch = line.match(/score mate (-?\d+)/);
                let evalCp: number | null = null;
                let mateVal: number | null = null;

                if (cpMatch) {
                    evalCp = parseInt(cpMatch[1], 10) / 100;
                } else if (mateMatch) {
                    mateVal = parseInt(mateMatch[1], 10);
                }

                // Parse PV (Principal Variation)
                const pvMatch = line.match(/ pv (.+)/);
                let bestmove = "";
                let continuation = "";
                if (pvMatch) {
                    const moves = pvMatch[1].trim().split(" ");
                    bestmove = moves[0] || "";
                    continuation = moves.slice(1).join(" ");
                }

                if (currentDepth > 0) {
                    setEngineState(prev => {
                        // Create a new lines array
                        const newLines = [...prev.lines];
                        const lineIndex = newLines.findIndex(l => l.multipv === multipv);
                        
                        const lineData = {
                            multipv,
                            evaluation: evalCp !== null ? evalCp : (lineIndex >= 0 ? newLines[lineIndex].evaluation : null),
                            mate: mateVal !== null ? mateVal : (lineIndex >= 0 ? newLines[lineIndex].mate : null),
                            bestmove: bestmove || (lineIndex >= 0 ? newLines[lineIndex].bestmove : ""),
                            continuation: continuation || (lineIndex >= 0 ? newLines[lineIndex].continuation : "")
                        };

                        if (lineIndex >= 0) {
                            newLines[lineIndex] = lineData;
                        } else {
                            newLines.push(lineData);
                        }

                        // Sort by multipv index
                        newLines.sort((a, b) => a.multipv - b.multipv);

                        // If this is the primary line (multipv 1), update top-level stats
                        const topLevel = multipv === 1 ? {
                            evaluation: lineData.evaluation,
                            mate: lineData.mate,
                            bestmove: lineData.bestmove,
                            continuation: lineData.continuation
                        } : {};

                        return {
                            ...prev,
                            ...topLevel,
                            depth: Math.max(prev.depth, currentDepth),
                            lines: newLines
                        };
                    });
                }
            } else if (line.startsWith("bestmove")) {
                // Done searching up to targetDepth
            }
        };

        return () => {
            if (workerRef.current) {
                workerRef.current.postMessage("stop");
                workerRef.current.terminate();
                workerRef.current = null;
            }
        };
    }, [fen, enabled, targetDepth, multiPv]);

    return engineState;
}
