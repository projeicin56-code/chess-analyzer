import { useState, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import { useStockfish } from './useStockfish';
import {
  classifyMove,
  calculateAccuracy,
  normalizeEval,
  detectOpening,
  isOpeningPhase,
  MOVE_CLASSIFICATIONS
} from '../utils/moveClassifier';
import { uciToAlgebraic } from '../utils/pgnParser';

const ANALYSIS_DEPTH = 16;

export function useGameAnalysis() {
  const { engineReady, engineError, analyzePosition, stopAnalysis } = useStockfish();
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedMoves, setAnalyzedMoves] = useState([]);
  const [overallStats, setOverallStats] = useState(null);
  const abortRef = useRef(false);

  /**
   * Analyze a full game from parsed PGN data
   */
  const analyzeGame = useCallback(async (gameData) => {
    if (!engineReady || isAnalyzing) return;
    
    abortRef.current = false;
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setAnalyzedMoves([]);
    setOverallStats(null);

    const { history, positions } = gameData;
    const results = [];
    
    // Collect UCI moves for opening detection
    const uciMoves = history.map(m => m.from + m.to + (m.promotion || ''));

    try {
      // Analyze each position
      for (let i = 0; i < history.length; i++) {
        if (abortRef.current) break;

        const move = history[i];
        const posBefore = positions[i];
        const posAfter = positions[i + 1];
        const moveNumber = Math.ceil((i + 1) / 2);
        const isWhiteMove = i % 2 === 0;
        
        setAnalysisProgress(Math.round((i / history.length) * 100));

        // Get evaluation BEFORE this move was played
        const preAnalysis = await analyzePosition(posBefore.fen, ANALYSIS_DEPTH, 3);
        
        if (abortRef.current) break;

        // Get evaluation AFTER this move
        const postAnalysis = await analyzePosition(posAfter.fen, ANALYSIS_DEPTH, 3);
        
        if (abortRef.current) break;

        // Extract evaluations
        const preTopLine = preAnalysis.lines[0];
        const postTopLine = postAnalysis.lines[0];

        const preEvalCp = preTopLine
          ? normalizeEval(preTopLine.evaluation, preTopLine.isMate, preTopLine.mateSign)
          : 0;
        const postEvalCp = postTopLine
          ? normalizeEval(postTopLine.evaluation, postTopLine.isMate, postTopLine.mateSign)
          : 0;

        // Get top engine moves before the actual move
        const topMoves = preAnalysis.lines
          .sort((a, b) => (a.multipv || 1) - (b.multipv || 1))
          .map(l => l.bestMove)
          .filter(Boolean);
          
        const topMovesEval = preAnalysis.lines
          .sort((a, b) => (a.multipv || 1) - (b.multipv || 1))
          .map(l => normalizeEval(l.evaluation, l.isMate, l.mateSign));

        // Create chess instance for sacrifice/tactic detection
        const chess = new Chess(posBefore.fen);
        const playedMoveUci = move.from + move.to + (move.promotion || '');

        // Classify the move
        const inOpening = isOpeningPhase(moveNumber, posBefore.fen);
        const classification = classifyMove({
          prevEvalCp: preEvalCp,
          afterEvalCp: postEvalCp,
          turn: posBefore.turn,
          topMovesEval,
          playedMove: playedMoveUci,
          topMoves,
          isOpening: inOpening,
          moveObj: move,
          chess,
          fen: posBefore.fen,
        });

        // Convert top engine moves to algebraic
        const bestAlternatives = preAnalysis.lines
          .sort((a, b) => (a.multipv || 1) - (b.multipv || 1))
          .slice(0, 3)
          .map(line => ({
            uci: line.bestMove,
            san: line.bestMove ? uciToAlgebraic(line.bestMove, posBefore.fen) : null,
            eval: normalizeEval(line.evaluation, line.isMate, line.mateSign),
            evalFormatted: line.isMate
              ? `M${line.mateIn}`
              : `${(normalizeEval(line.evaluation, line.isMate, line.mateSign) / 100).toFixed(1)}`,
            pv: line.pv || []
          }))
          .filter(a => a.san);

        // Calculate centipawn loss  
        const cpLoss = (() => {
          const prevFromPlayer = posBefore.turn === 'w' ? preEvalCp : -preEvalCp;
          const afterFromPlayer = posBefore.turn === 'b' ? postEvalCp : -postEvalCp;
          return Math.max(0, prevFromPlayer - afterFromPlayer);
        })();

        results.push({
          index: i,
          moveNumber,
          isWhiteMove,
          san: move.san,
          uci: playedMoveUci,
          piece: move.piece,
          captured: move.captured,
          fen: posBefore.fen,
          fenAfter: posAfter.fen,
          evalBefore: preEvalCp,
          evalAfter: postEvalCp,
          classification,
          cpLoss,
          bestAlternatives,
          bestMove: topMoves[0] || null,
          bestMoveSan: topMoves[0] ? uciToAlgebraic(topMoves[0], posBefore.fen) : null,
          preIsMate: preTopLine?.isMate || false,
          preMatIn: preTopLine?.mateIn || null,
          postIsMate: postTopLine?.isMate || false,
          postMateIn: postTopLine?.mateIn || null,
        });

        setAnalyzedMoves([...results]);
      }

      // Calculate overall stats
      const whiteMoves = results.filter(m => m.isWhiteMove && m.classification !== MOVE_CLASSIFICATIONS.BOOK);
      const blackMoves = results.filter(m => !m.isWhiteMove && m.classification !== MOVE_CLASSIFICATIONS.BOOK);

      const countBy = (moves, cls) => moves.filter(m => m.classification === cls).length;

      const makeStats = (moves) => ({
        accuracy: calculateAccuracy(moves),
        brilliant: countBy(moves, MOVE_CLASSIFICATIONS.BRILLIANT),
        great: countBy(moves, MOVE_CLASSIFICATIONS.GREAT),
        best: countBy(moves, MOVE_CLASSIFICATIONS.BEST),
        excellent: countBy(moves, MOVE_CLASSIFICATIONS.EXCELLENT),
        good: countBy(moves, MOVE_CLASSIFICATIONS.GOOD),
        book: countBy(moves, MOVE_CLASSIFICATIONS.BOOK),
        inaccuracy: countBy(moves, MOVE_CLASSIFICATIONS.INACCURACY),
        mistake: countBy(moves, MOVE_CLASSIFICATIONS.MISTAKE),
        blunder: countBy(moves, MOVE_CLASSIFICATIONS.BLUNDER),
        miss: countBy(moves, MOVE_CLASSIFICATIONS.MISS),
      });

      const openingName = detectOpening(uciMoves);

      setOverallStats({
        white: makeStats(whiteMoves),
        black: makeStats(blackMoves),
        openingName,
        totalMoves: history.length,
      });

    } catch (err) {
      console.error('Analysis error:', err);
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(100);
      abortRef.current = false;
    }
  }, [engineReady, isAnalyzing, analyzePosition]);

  const cancelAnalysis = useCallback(() => {
    abortRef.current = true;
    stopAnalysis();
    setIsAnalyzing(false);
  }, [stopAnalysis]);

  return {
    engineReady,
    engineError,
    isAnalyzing,
    analysisProgress,
    analyzedMoves,
    overallStats,
    analyzeGame,
    cancelAnalysis,
  };
}
