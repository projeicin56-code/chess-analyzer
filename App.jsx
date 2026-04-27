import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { EvalBar } from './components/EvalBar';
import { EvalGraph } from './components/EvalGraph';
import { MoveList } from './components/MoveList';
import { MoveDetail } from './components/MoveDetail';
import { GameSummary } from './components/GameSummary';
import { PgnImport } from './components/PgnImport';
import { ReviewMode } from './components/ReviewMode';
import { useGameAnalysis } from './hooks/useGameAnalysis';
import { parsePGN } from './utils/pgnParser';
import { getClassificationMeta } from './utils/moveClassifier';

const TABS = ['Summary', 'Review', 'Details'];

export default function App() {
  const [showImport, setShowImport] = useState(false);
  const [gameData, setGameData] = useState(null);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [activeTab, setActiveTab] = useState('Summary');
  const [boardOrientation, setBoardOrientation] = useState('white');

  const {
    engineReady,
    engineError,
    isAnalyzing,
    analysisProgress,
    analyzedMoves,
    overallStats,
    analyzeGame,
    cancelAnalysis,
  } = useGameAnalysis();

  // Current chess position
  const currentPosition = useMemo(() => {
    if (!gameData) return 'start';
    if (currentMoveIndex < 0) return gameData.positions[0].fen;
    const pos = gameData.positions[currentMoveIndex + 1];
    return pos ? pos.fen : 'start';
  }, [gameData, currentMoveIndex]);

  // Current analyzed move
  const currentAnalyzedMove = useMemo(() => {
    if (currentMoveIndex < 0 || !analyzedMoves.length) return null;
    return analyzedMoves[currentMoveIndex] || null;
  }, [analyzedMoves, currentMoveIndex]);

  // Current eval for eval bar
  const currentEval = useMemo(() => {
    if (!currentAnalyzedMove) return { eval: 0, isMate: false };
    return {
      eval: currentAnalyzedMove.evalAfter,
      isMate: currentAnalyzedMove.postIsMate,
      mateIn: currentAnalyzedMove.postMateIn,
      mateSign: currentAnalyzedMove.evalAfter > 0 ? 1 : -1,
    };
  }, [currentAnalyzedMove]);

  // Highlight squares
  const customSquareStyles = useMemo(() => {
    const styles = {};
    if (!currentAnalyzedMove) return styles;

    const { uci, classification } = currentAnalyzedMove;
    const meta = getClassificationMeta(classification);

    if (uci) {
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      styles[from] = { backgroundColor: `${meta.color}50` };
      styles[to] = { backgroundColor: `${meta.color}80` };
    }
    return styles;
  }, [currentAnalyzedMove]);

  // Custom pieces for move classification indicator
  const customNotationStyle = useMemo(() => {
    if (!currentAnalyzedMove) return {};
    const { uci, classification } = currentAnalyzedMove;
    if (!uci) return {};
    const to = uci.slice(2, 4);
    const meta = getClassificationMeta(classification);
    return { [to]: { borderRadius: '50%', outline: `3px solid ${meta.color}` } };
  }, [currentAnalyzedMove]);

  const handleImport = useCallback((pgn) => {
    try {
      const parsed = parsePGN(pgn);
      setGameData(parsed);
      setCurrentMoveIndex(-1);
      setActiveTab('Summary');
    } catch (err) {
      throw err;
    }
  }, []);

  const handleAnalyze = useCallback(() => {
    if (gameData && engineReady) {
      analyzeGame(gameData);
      setActiveTab('Summary');
    }
  }, [gameData, engineReady, analyzeGame]);

  const handleMoveClick = useCallback((index) => {
    setCurrentMoveIndex(index);
    if (analyzedMoves[index]) {
      setActiveTab('Details');
    }
  }, [analyzedMoves]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e) => {
      if (!gameData) return;
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setCurrentMoveIndex(i => Math.min(i + 1, gameData.history.length - 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setCurrentMoveIndex(i => Math.max(i - 1, -1));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setCurrentMoveIndex(-1);
      } else if (e.key === 'End') {
        e.preventDefault();
        setCurrentMoveIndex(gameData.history.length - 1);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameData]);

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-logo">
          <span className="logo-icon">♛</span>
          <span className="logo-text">ChessLens</span>
          <span className="logo-sub">Analysis</span>
        </div>
        <div className="header-actions">
          <div className={`engine-status ${engineReady ? 'ready' : engineError ? 'error' : 'loading'}`}>
            <span className="engine-dot" />
            {engineReady ? 'Engine Ready' : engineError ? 'Engine Error' : 'Loading Engine...'}
          </div>
          <button className="btn-import" onClick={() => setShowImport(true)}>
            Import PGN
          </button>
        </div>
      </header>

      <main className="app-main">
        {/* Left panel: Board + Eval */}
        <div className="board-panel">
          <div className="board-area">
            <EvalBar
              evaluation={currentEval.eval}
              isMate={currentEval.isMate}
              mateIn={currentEval.mateIn}
              mateSign={currentEval.mateSign}
            />
            <div className="board-wrapper">
              <Chessboard
                position={currentPosition}
                boardOrientation={boardOrientation}
                areArrowsAllowed={false}
                customBoardStyle={{
                  borderRadius: '6px',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
                }}
                customDarkSquareStyle={{ backgroundColor: '#4a3728' }}
                customLightSquareStyle={{ backgroundColor: '#c8b89a' }}
                customSquareStyles={customSquareStyles}
                isDraggablePiece={() => false}
              />
            </div>
          </div>

          {/* Board controls */}
          <div className="board-controls">
            <button className="ctrl-btn" onClick={() => setCurrentMoveIndex(-1)} title="Start">⏮</button>
            <button className="ctrl-btn" onClick={() => setCurrentMoveIndex(i => Math.max(i - 1, -1))} title="Previous">◀</button>
            <button className="ctrl-btn" onClick={() => gameData && setCurrentMoveIndex(i => Math.min(i + 1, gameData.history.length - 1))} title="Next">▶</button>
            <button className="ctrl-btn" onClick={() => gameData && setCurrentMoveIndex(gameData.history.length - 1)} title="End">⏭</button>
            <button className="ctrl-btn flip-btn" onClick={() => setBoardOrientation(o => o === 'white' ? 'black' : 'white')} title="Flip board">⇅</button>
          </div>

          {/* Eval graph */}
          {(analyzedMoves.length > 0 || isAnalyzing) && (
            <EvalGraph
              analyzedMoves={analyzedMoves}
              currentMoveIndex={currentMoveIndex}
              onMoveClick={handleMoveClick}
            />
          )}
        </div>

        {/* Right panel: Analysis */}
        <div className="analysis-panel">
          {/* Game info */}
          {gameData && (
            <div className="game-info">
              <div className="game-players">
                <div className="player white-player">
                  <span className="player-color-icon">♔</span>
                  <span className="player-name">{gameData.white}</span>
                  {gameData.whiteElo && <span className="player-elo">({gameData.whiteElo})</span>}
                </div>
                <div className="vs-divider">vs</div>
                <div className="player black-player">
                  <span className="player-color-icon">♚</span>
                  <span className="player-name">{gameData.black}</span>
                  {gameData.blackElo && <span className="player-elo">({gameData.blackElo})</span>}
                </div>
              </div>
              {gameData.event && <div className="game-event">{gameData.event}</div>}
            </div>
          )}

          {/* Analyze button */}
          {gameData && !isAnalyzing && analyzedMoves.length === 0 && (
            <button
              className="btn-analyze"
              onClick={handleAnalyze}
              disabled={!engineReady}
            >
              {engineReady ? '⚡ Analyze Game' : '⏳ Loading Engine...'}
            </button>
          )}

          {isAnalyzing && (
            <button className="btn-cancel" onClick={cancelAnalysis}>
              ✕ Cancel Analysis
            </button>
          )}

          {/* Move list */}
          {gameData && (
            <MoveList
              history={gameData.history}
              analyzedMoves={analyzedMoves}
              currentMoveIndex={currentMoveIndex}
              onMoveClick={handleMoveClick}
            />
          )}

          {/* Tabs */}
          {(analyzedMoves.length > 0 || isAnalyzing) && (
            <div className="tabs">
              {TABS.map(tab => (
                <button
                  key={tab}
                  className={`tab ${activeTab === tab ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}

          {/* Tab content */}
          <div className="tab-content">
            {activeTab === 'Summary' && (
              <GameSummary
                overallStats={overallStats}
                gameData={gameData}
                isAnalyzing={isAnalyzing}
                progress={analysisProgress}
              />
            )}
            {activeTab === 'Details' && (
              <MoveDetail
                analyzedMove={currentAnalyzedMove}
                gameData={gameData}
              />
            )}
            {activeTab === 'Review' && analyzedMoves.length > 0 && (
              <ReviewMode
                analyzedMoves={analyzedMoves}
                currentMoveIndex={currentMoveIndex}
                onNavigate={handleMoveClick}
                gameData={gameData}
              />
            )}
          </div>

          {/* Empty state */}
          {!gameData && (
            <div className="empty-state">
              <div className="empty-icon">♞</div>
              <h2>Analyze Your Games</h2>
              <p>Import any PGN to get detailed move-by-move analysis powered by Stockfish.</p>
              <button className="btn-primary" onClick={() => setShowImport(true)}>
                Import PGN →
              </button>
              <div className="features-list">
                <div className="feature">
                  <span>💎</span> Brilliant move detection
                </div>
                <div className="feature">
                  <span>📊</span> Accuracy score
                </div>
                <div className="feature">
                  <span>🔍</span> Review your mistakes
                </div>
                <div className="feature">
                  <span>⚡</span> Stockfish WASM engine
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* PGN Import Modal */}
      {showImport && (
        <PgnImport
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
