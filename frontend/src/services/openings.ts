export const chessOpenings: Record<string, string> = {
  // 1.e4 openings
  "e4": "King's Pawn Game",
  "e4 e5": "Open Game",
  "e4 e5 Nf3": "King's Knight Opening",
  "e4 e5 Nf3 Nc6": "Open Game: Double King's Pawn",
  "e4 e5 Nf3 Nc6 Bb5": "Ruy Lopez (Spanish Opening)",
  "e4 e5 Nf3 Nc6 Bc4": "Italian Game",
  "e4 e5 Nf3 Nc6 Bc4 Bc5": "Italian Game: Giuoco Piano",
  "e4 e5 Nf3 Nc6 Bc4 Nf6": "Italian Game: Two Knights Defense",
  "e4 e5 Nf3 Nc6 d4": "Scotch Game",
  "e4 e5 Nf3 Nc6 d4 exd4": "Scotch Game: Main Line",
  "e4 e5 Nf3 Nc6 Nc3": "Three Knights Game",
  "e4 e5 Nf3 Nc6 Nc3 Nf6": "Four Knights Game",
  "e4 e5 Nf3 Nf6": "Petrov's Defense",
  "e4 e5 Nf3 d6": "Philidor Defense",
  "e4 e5 f4": "King's Gambit",
  "e4 e5 f4 exf4": "King's Gambit Accepted",
  "e4 e5 f4 d5": "King's Gambit: Falkbeer Countergambit",
  "e4 e5 Nf3 f5": "Latvian Gambit",
  "e4 e5 Nf3 d5": "Elephant Gambit",
  "e4 e5 Qh5": "Danvers Opening",
  "e4 e5 Bc4": "Bishop's Opening",
  "e4 e5 d4": "Center Game",
  "e4 e5 Nc3": "Vienna Game",
  
  // Sicilian Defense
  "e4 c5": "Sicilian Defense",
  "e4 c5 Nf3": "Sicilian Defense: Open",
  "e4 c5 Nf3 d6": "Sicilian Defense: Modern Line",
  "e4 c5 Nf3 d6 d4": "Sicilian Defense: Open, Classical",
  "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3": "Sicilian Defense: Open, Main Line",
  "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6": "Sicilian Defense: Najdorf Variation",
  "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6": "Sicilian Defense: Dragon Variation",
  "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6": "Sicilian Defense: Classical Variation",
  "e4 c5 Nf3 e6": "Sicilian Defense: French Variation",
  "e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6": "Sicilian Defense: Kan Variation",
  "e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6": "Sicilian Defense: Taimanov Variation",
  "e4 c5 Nf3 Nc6": "Sicilian Defense: Old Sicilian",
  "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6": "Sicilian Defense: Accelerated Dragon",
  "e4 c5 Nc3": "Sicilian Defense: Closed",
  "e4 c5 c3": "Sicilian Defense: Alapin Variation",
  "e4 c5 f4": "Sicilian Defense: Grand Prix Attack",
  "e4 c5 d4": "Sicilian Defense: Smith-Morra Gambit",
  
  // Other e4 responses
  "e4 e6": "French Defense",
  "e4 e6 d4 d5": "French Defense: Normal Variation",
  "e4 e6 d4 d5 e5": "French Defense: Advance Variation",
  "e4 e6 d4 d5 Nc3": "French Defense: Paulsen",
  "e4 e6 d4 d5 Nd2": "French Defense: Tarrasch",
  "e4 e6 d4 d5 exd5": "French Defense: Exchange Variation",
  
  "e4 c6": "Caro-Kann Defense",
  "e4 c6 d4 d5": "Caro-Kann Defense: Classical",
  "e4 c6 d4 d5 e5": "Caro-Kann Defense: Advance Variation",
  "e4 c6 d4 d5 exd5": "Caro-Kann Defense: Exchange Variation",
  "e4 c6 d4 d5 Nc3": "Caro-Kann Defense: Modern Variation",
  
  "e4 d6": "Pirc Defense",
  "e4 d6 d4 Nf6 Nc3 g6": "Pirc Defense: Classical",
  "e4 Nf6": "Alekhine's Defense",
  "e4 Nf6 e5 Nd5": "Alekhine's Defense: Modern",
  "e4 g6": "Modern Defense",
  "e4 g6 d4 Bg7": "Modern Defense: Standard",
  "e4 d5": "Scandinavian Defense (Center Counter)",
  "e4 d5 exd5": "Scandinavian Defense: Main Line",
  "e4 d5 exd5 Qxd5": "Scandinavian Defense: Queen Recapture",
  "e4 d5 exd5 Nf6": "Scandinavian Defense: Modern Variation",
  "e4 Nc6": "Nimzowitsch Defense",

  // 1.d4 openings
  "d4": "Queen's Pawn Game",
  "d4 d5": "Queen's Pawn Game: Closed",
  "d4 d5 c4": "Queen's Gambit",
  "d4 d5 c4 e6": "Queen's Gambit Declined",
  "d4 d5 c4 e6 Nc3 Nf6": "Queen's Gambit Declined: Orthodox Defense",
  "d4 d5 c4 c6": "Slav Defense",
  "d4 d5 c4 e5": "Albin Countergambit",
  "d4 d5 c4 Nc6": "Chigorin Defense",
  "d4 d5 c4 dxc4": "Queen's Gambit Accepted",
  "d4 d5 Nf3": "Queen's Pawn Game: Symmetrical",
  "d4 d5 Bf4": "London System",
  "d4 d5 Nf3 Nf6 Bf4": "London System: Classical",
  "d4 d5 e4": "Blackmar-Diemer Gambit",
  "d4 Nf6": "Indian Defense",
  "d4 Nf6 c4": "Indian Defense: Classical",
  "d4 Nf6 c4 e6": "Indian Defense: East Indian",
  "d4 Nf6 c4 e6 Nf3": "Indian Defense: Symmetrical",
  "d4 Nf6 c4 e6 Nf3 d5": "Queen's Gambit Declined: Neo-Orthodox",
  "d4 Nf6 c4 e6 Nc3 Bb4": "Nimzo-Indian Defense",
  "d4 Nf6 c4 g6": "King's Indian Defense",
  "d4 Nf6 c4 g6 Nc3 Bg7": "King's Indian Defense: Standard",
  "d4 Nf6 c4 g6 Nc3 d5": "Grünfeld Defense",
  "d4 Nf6 c4 c5": "Benoni Defense",
  "d4 Nf6 c4 c5 d5": "Modern Benoni",
  "d4 Nf6 c4 c5 d5 b5": "Benko Gambit (Volga Gambit)",
  "d4 Nf6 c4 e5": "Budapest Gambit",
  "d4 Nf6 Bf4": "London System (Indian Setup)",
  "d4 f5": "Dutch Defense",
  "d4 e6": "Queen's Pawn Game: Franco-Sicilian",
  "d4 d6": "Queen's Pawn Game: Wade Defense",

  // Flank openings
  "c4": "English Opening",
  "c4 e5": "English Opening: King's English",
  "c4 c5": "English Opening: Symmetrical",
  "c4 Nf6": "English Opening: Anglo-Indian",
  
  "Nf3": "Réti Opening",
  "Nf3 d5": "Réti Opening: Symmetrical",
  "Nf3 Nf6": "Réti Opening: Symmetrical Knight",
  
  "f4": "Bird's Opening",
  "f4 d5": "Bird's Opening: Dutch Setup",
  
  "g3": "Benko Opening (King's Fianchetto)",
  "b3": "Nimzowitsch-Larsen Attack",
  "b4": "Polish Opening (Sokolsky)",
  "g4": "Grob Opening",
  
  // Unusual openings
  "f3": "Barnes Opening (Gedult)",
  "a3": "Anderssen's Opening",
  "h3": "Clemenz Opening",
  "a4": "Ware Opening",
  "h4": "Kadas Opening",
  "d3": "Mieses Opening",
  "e3": "Van 't Kruijs Opening",
  "c3": "Saratoga Opening (Saragossa)",
  "Nc3": "Dunst Opening",
  "Nh3": "Amar Opening",
  "Na3": "Durkin Opening"
};

/**
 * FIX: Cache keyed by the full move-sequence string.
 * Invalidated automatically whenever the move list changes (different key).
 * After undo/takeback the caller passes the truncated move list, so a different
 * key is computed and the cache miss triggers a fresh full scan — ensuring the
 * detected opening always reflects the CURRENT move sequence, not the pre-undo one.
 */
const openingCache = new Map<string, string>();

/**
 * Returns true if the given move sequence is a known opening move (book move).
 * A sequence is "book" if it exactly matches or is a prefix of any known opening.
 */
export function isBookMove(moves: string[]): boolean {
  if (moves.length === 0) return false;
  const normalized = moves.map(m => m.replace(/[+#]|=[QRNBqrnb]/g, ""));
  const moveStr = normalized.join(" ");
  for (const openingMoves of Object.keys(chessOpenings)) {
    if (openingMoves === moveStr || openingMoves.startsWith(moveStr + " ")) {
      return true;
    }
  }
  return false;
}

/**
 * Retrieves the name of the chess opening based on the current move sequence.
 *
 * FIX: After every undo/takeback, call this with the FULL current move list
 * (not a delta). The cache key is the complete move sequence hash, so any
 * board-state change (including undos) automatically invalidates the previous
 * result and triggers a fresh lookup.
 *
 * FIX: Cache the result keyed by the move-sequence string. Re-running the same
 * sequence (e.g. history navigation) is O(1) after the first lookup.
 */
export function getOpeningName(moves: string[]): string {
  if (moves.length === 0) return "";

  const normalized = moves.map(m => m.replace(/[+#]|=[QRNBqrnb]/g, ""));
  // FIX: Cache key = full move sequence. Any change (new move or undo) → cache miss.
  const cacheKey = normalized.join(" ");

  if (openingCache.has(cacheKey)) {
    return openingCache.get(cacheKey)!;
  }

  // Resolve longest matching prefix (most specific opening name wins).
  let result = "";
  for (let i = normalized.length; i > 0; i--) {
    const subMoves = normalized.slice(0, i).join(" ");
    if (chessOpenings[subMoves]) {
      result = chessOpenings[subMoves];
      break;
    }
  }

  // Store in cache. Cache grows at most O(game length) entries per game.
  // On new game, the move list resets so all future keys are new → old entries
  // are naturally evicted from use (GC collects them if the Map is local).
  // Keep the cache bounded at 500 entries to prevent unbounded growth across games.
  if (openingCache.size > 500) openingCache.clear();
  openingCache.set(cacheKey, result);

  return result;
}
