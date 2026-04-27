/**
 * Move Classification Engine
 * 
 * Classifies chess moves based on centipawn evaluation changes
 * and tactical patterns. Uses strict thresholds similar to Chess.com.
 */

export const MOVE_CLASSIFICATIONS = {
  BRILLIANT: 'brilliant',
  GREAT: 'great',
  BEST: 'best',
  EXCELLENT: 'excellent',
  GOOD: 'good',
  BOOK: 'book',
  INACCURACY: 'inaccuracy',
  MISTAKE: 'mistake',
  BLUNDER: 'blunder',
  MISS: 'miss',
};

// Centipawn loss thresholds (from player's perspective)
const THRESHOLDS = {
  EXCELLENT: 10,    // ≤ 10cp loss
  GOOD: 25,         // ≤ 25cp loss
  INACCURACY: 50,   // ≤ 50cp loss
  MISTAKE: 100,     // ≤ 100cp loss
  // > 100cp = blunder
};

const CLASSIFICATION_META = {
  brilliant: { label: 'Brilliant!!', color: '#00b3ff', symbol: '!!', emoji: '💎', bg: '#00b3ff20' },
  great:     { label: 'Great!',      color: '#1bada6', symbol: '!',  emoji: '✨', bg: '#1bada620' },
  best:      { label: 'Best',        color: '#7ac943', symbol: '✓',  emoji: '⭐', bg: '#7ac94320' },
  excellent: { label: 'Excellent',   color: '#7ac943', symbol: '✓',  emoji: '✅', bg: '#7ac94320' },
  good:      { label: 'Good',        color: '#96bc4b', symbol: '⊙',  emoji: '👍', bg: '#96bc4b20' },
  book:      { label: 'Book',        color: '#a88865', symbol: '⊙',  emoji: '📖', bg: '#a8886520' },
  inaccuracy:{ label: 'Inaccuracy',  color: '#f0c23a', symbol: '?!', emoji: '⚠️', bg: '#f0c23a20' },
  mistake:   { label: 'Mistake',     color: '#e07b1e', symbol: '?',  emoji: '❌', bg: '#e07b1e20' },
  blunder:   { label: 'Blunder',     color: '#c92b2b', symbol: '??', emoji: '💥', bg: '#c92b2b20' },
  miss:      { label: 'Miss',        color: '#c92b2b', symbol: '??', emoji: '🎯', bg: '#c92b2b2020' },
};

/**
 * Normalize evaluation to be from White's perspective (in centipawns)
 * Caps at ±1000cp for display purposes
 */
export function normalizeEval(evaluation, isMate, mateSign) {
  if (isMate) {
    return mateSign > 0 ? 1000 : -1000;
  }
  return Math.max(-1000, Math.min(1000, evaluation));
}

/**
 * Get evaluation from current player's perspective (positive = good for them)
 */
export function evalFromPlayerPerspective(evalCp, turn) {
  return turn === 'w' ? evalCp : -evalCp;
}

/**
 * Convert centipawns to a human-friendly evaluation string
 */
export function formatEval(evalCp, isMate, mateIn, mateSign) {
  if (isMate) {
    return mateSign > 0 ? `M${mateIn}` : `-M${mateIn}`;
  }
  const pawns = evalCp / 100;
  const sign = pawns > 0 ? '+' : '';
  return `${sign}${pawns.toFixed(1)}`;
}

/**
 * Detect if a move involves material sacrifice
 * A sacrifice is when a piece of higher value moves to a square
 * attacked by a lower-value enemy piece without immediate recapture gain
 */
export function detectSacrifice(chess, moveObj, previousEval) {
  // Check if capturing piece can be recaptured at a loss
  const { from, to, captured, piece } = moveObj;
  
  if (!captured) return false;
  
  const pieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const movingValue = pieceValues[piece] || 0;
  const capturedValue = pieceValues[captured] || 0;
  
  // If we captured something less valuable, it's potentially a sacrifice trade
  // (we give material to get positional/tactical advantage)
  if (movingValue > capturedValue + 100) {
    return true;
  }
  
  return false;
}

/**
 * Detect if a move is tactically non-obvious (requires calculation)
 * Looks for: checks, forks, pins, discovered attacks
 */
export function detectNonObviousMove(chess, moveUci, fen) {
  // After making the move, check if it creates tactical threats
  const tempChess = new (chess.constructor)(fen);
  
  try {
    const from = moveUci.slice(0, 2);
    const to = moveUci.slice(2, 4);
    const promotion = moveUci[4] || undefined;
    
    const result = tempChess.move({ from, to, promotion });
    if (!result) return false;
    
    // Check if the move gives check (often tactical)
    if (tempChess.isCheck()) return true;
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Classify a move based on evaluation change
 * 
 * @param {Object} params
 * @param {number} params.prevEvalCp - Evaluation before move (White perspective, centipawns)
 * @param {number} params.afterEvalCp - Evaluation after move (White perspective, centipawns)
 * @param {string} params.turn - Whose turn it was ('w' or 'b')
 * @param {number[]} params.topMovesEval - Top engine moves evaluations (centipawns)
 * @param {string} params.playedMove - UCI notation of played move
 * @param {string[]} params.topMoves - UCI notation of top engine moves
 * @param {boolean} params.isOpening - Whether we're in the opening phase
 * @param {Object} params.moveObj - chess.js move object
 * @param {Object} params.chess - chess.js instance (before move)
 * @param {string} params.fen - FEN before move
 */
export function classifyMove({
  prevEvalCp,
  afterEvalCp,
  turn,
  topMovesEval,
  playedMove,
  topMoves,
  isOpening = false,
  moveObj = null,
  chess = null,
  fen = null,
}) {
  // If in book opening, mark as book
  if (isOpening) {
    return MOVE_CLASSIFICATIONS.BOOK;
  }

  // Centipawn loss from current player's perspective
  // prevEval from player perspective - afterEval from player perspective (opponent's turn now)
  const prevFromPlayer = evalFromPlayerPerspective(prevEvalCp, turn);
  // After the move, it's the opponent's turn, so afterEvalCp is from opponent's perspective
  // We need after eval from the MOVING player's perspective
  const afterFromPlayer = evalFromPlayerPerspective(afterEvalCp, turn === 'w' ? 'b' : 'w');
  
  // Loss = what we had - what we have now (positive means we lost eval)
  const cpLoss = prevFromPlayer - afterFromPlayer;

  // Check if played move is the engine's best
  const isBestMove = topMoves.length > 0 && topMoves[0] === playedMove;
  const isInTopMoves = topMoves.includes(playedMove);

  // Get best eval from player perspective
  const bestEvalFromPlayer = topMovesEval.length > 0
    ? evalFromPlayerPerspective(topMovesEval[0], turn)
    : prevFromPlayer;

  // Actual loss vs best move
  const lossVsBest = bestEvalFromPlayer - afterFromPlayer;

  // Check for BRILLIANT conditions:
  // 1. Move is either THE best or one of very few good moves
  // 2. AND involves a sacrifice or non-obvious tactic
  // 3. AND the second-best move is significantly worse (near-only move)
  const isNearOnlyMove = topMovesEval.length >= 2
    ? (evalFromPlayerPerspective(topMovesEval[0], turn) - evalFromPlayerPerspective(topMovesEval[1], turn)) > 150
    : topMovesEval.length === 1;

  const hasSacrifice = moveObj && chess && fen
    ? detectSacrifice(chess, moveObj, prevFromPlayer)
    : false;

  const isNonObvious = chess && playedMove && fen
    ? detectNonObviousMove(chess, playedMove, fen)
    : false;

  if (
    isBestMove &&
    isNearOnlyMove &&
    (hasSacrifice || isNonObvious) &&
    lossVsBest <= 20
  ) {
    return MOVE_CLASSIFICATIONS.BRILLIANT;
  }

  // GREAT: Best move in a complex position, not brilliant
  if (isBestMove && lossVsBest <= 5 && prevFromPlayer < -50) {
    return MOVE_CLASSIFICATIONS.GREAT;
  }

  // Classify by centipawn loss vs best move
  if (lossVsBest <= 0) {
    return MOVE_CLASSIFICATIONS.BEST;
  } else if (lossVsBest <= THRESHOLDS.EXCELLENT) {
    return MOVE_CLASSIFICATIONS.EXCELLENT;
  } else if (lossVsBest <= THRESHOLDS.GOOD) {
    return MOVE_CLASSIFICATIONS.GOOD;
  } else if (lossVsBest <= THRESHOLDS.INACCURACY) {
    return MOVE_CLASSIFICATIONS.INACCURACY;
  } else if (lossVsBest <= THRESHOLDS.MISTAKE) {
    return MOVE_CLASSIFICATIONS.MISTAKE;
  } else {
    // Check if this is a MISS (missing a winning move)
    if (bestEvalFromPlayer > 300 && afterFromPlayer < 0) {
      return MOVE_CLASSIFICATIONS.MISS;
    }
    return MOVE_CLASSIFICATIONS.BLUNDER;
  }
}

/**
 * Get classification metadata (color, symbol, etc.)
 */
export function getClassificationMeta(classification) {
  return CLASSIFICATION_META[classification] || CLASSIFICATION_META.good;
}

/**
 * Calculate accuracy score for a set of classified moves
 * Uses a weighted formula similar to Chess.com
 */
export function calculateAccuracy(classifiedMoves) {
  if (!classifiedMoves.length) return 100;

  const weights = {
    brilliant: 100,
    great: 100,
    best: 100,
    excellent: 95,
    good: 85,
    book: 100,
    inaccuracy: 60,
    mistake: 30,
    blunder: 0,
    miss: 0,
  };

  const scored = classifiedMoves.filter(m =>
    m.classification !== MOVE_CLASSIFICATIONS.BOOK
  );

  if (!scored.length) return 100;

  const total = scored.reduce((sum, m) => {
    return sum + (weights[m.classification] ?? 70);
  }, 0);

  return Math.round(total / scored.length);
}

/**
 * Generate human-friendly explanation for a move
 */
export function generateExplanation(classification, cpLoss, bestMove, bestMoveAlg, playedMoveAlg) {
  const meta = getClassificationMeta(classification);
  
  const explanations = {
    brilliant: [
      `An exceptional move! This is the only way to maintain the advantage, and it involves a non-obvious sacrifice or tactic.`,
      `A computer-level find! This move looks counter-intuitive but is actually the strongest continuation.`,
    ],
    great: [
      `An excellent defensive resource that keeps the position balanced.`,
      `A strong practical choice that creates the most problems for your opponent.`,
    ],
    best: [
      `The engine's top choice. Well played!`,
      `Objectively the strongest move in this position.`,
    ],
    excellent: [
      `A very strong move with minimal loss of advantage.`,
      `Nearly optimal — you found an excellent continuation.`,
    ],
    good: [
      `A solid move that maintains a reasonable position.`,
      `A sensible choice, though there were slightly better options.`,
    ],
    book: [
      `A known opening move. You're following established theory.`,
      `Standard opening theory.`,
    ],
    inaccuracy: [
      `A slight inaccuracy. The position is still roughly equal, but you gave up a small edge.`,
      `Not the best choice here — you could have kept more advantage with a different move.`,
    ],
    mistake: [
      `A significant mistake that gives your opponent a clear advantage.`,
      `This move lets your opponent improve their position considerably.`,
    ],
    blunder: [
      `A serious blunder! This move loses a lot of material or throws away a winning position.`,
      `A critical error — this dramatically shifts the evaluation in your opponent's favor.`,
    ],
    miss: [
      `You missed a winning combination! The best move here would have been decisive.`,
      `A missed opportunity — there was a stronger move that would have given you a large advantage.`,
    ],
  };

  const lines = explanations[classification] || explanations.good;
  let text = lines[Math.floor(Math.random() * lines.length)];

  if (bestMoveAlg && playedMoveAlg && bestMoveAlg !== playedMoveAlg && cpLoss > 20) {
    text += ` The engine recommends ${bestMoveAlg} instead.`;
  }

  return text;
}

/**
 * Detect opening phase (first 10 moves or if position is in opening book)
 */
export function isOpeningPhase(moveNumber, fen) {
  return moveNumber <= 10;
}

/**
 * Get opening name from ECO codes (simplified lookup)
 */
export function detectOpening(moves) {
  const openingDB = {
    'e2e4 e7e5': "King's Pawn Opening",
    'e2e4 e7e5 g1f3 b8c6': 'Spanish Game / Ruy López',
    'e2e4 e7e5 g1f3 b8c6 f1b5': 'Spanish Game',
    'e2e4 e7e5 g1f3 g8f6': "Petrov's Defense",
    'e2e4 c7c5': 'Sicilian Defense',
    'e2e4 c7c5 g1f3': 'Sicilian Defense: Open',
    'e2e4 e7e6': 'French Defense',
    'e2e4 c7c6': 'Caro-Kann Defense',
    'd2d4 d7d5': "Queen's Pawn Opening",
    'd2d4 d7d5 c2c4': "Queen's Gambit",
    'd2d4 g8f6': 'Indian Defense',
    'd2d4 g8f6 c2c4': 'Indian Defense',
    'd2d4 g8f6 c2c4 g7g6': "King's Indian Defense",
    'd2d4 g8f6 c2c4 e7e6': "Nimzo-Indian / Queen's Indian",
    'e2e4 g7g6': 'Modern Defense',
    'e2e4 d7d6': 'Pirc Defense',
    'c2c4': 'English Opening',
    'g1f3': "Réti Opening",
  };

  const moveStr = moves.slice(0, 8).join(' ');
  
  // Find the longest matching prefix
  let bestMatch = '';
  let bestName = '';
  
  for (const [key, name] of Object.entries(openingDB)) {
    if (moveStr.startsWith(key) && key.length > bestMatch.length) {
      bestMatch = key;
      bestName = name;
    }
  }
  
  return bestName || (moves.length > 0 ? 'Custom Opening' : '');
}
