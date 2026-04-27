import { useRef, useEffect, useCallback, useState } from 'react';

const ANALYSIS_DEPTH = 18;
const MULTI_PV = 3; // Get top 3 moves for alternatives

export function useStockfish() {
  const workerRef = useRef(null);
  const [engineReady, setEngineReady] = useState(false);
  const [engineError, setEngineError] = useState(null);
  const resolversRef = useRef(new Map());
  const analysisIdRef = useRef(0);

  useEffect(() => {
    // Create worker
    const worker = new Worker(
      new URL('./stockfish.worker.js', import.meta.url),
      { type: 'classic' }
    );

    worker.onmessage = (event) => {
      const { type, data } = event.data;
      
      if (type === 'ready') {
        setEngineReady(true);
      } else if (type === 'error') {
        setEngineError(data);
      } else if (type === 'output') {
        handleEngineOutput(data);
      }
    };

    worker.onerror = (err) => {
      setEngineError(err.message);
    };

    workerRef.current = worker;
    worker.postMessage({ type: 'init' });

    return () => {
      worker.terminate();
    };
  }, []);

  const handleEngineOutput = useCallback((line) => {
    // Route output to the current analysis resolver
    const currentId = analysisIdRef.current;
    const resolver = resolversRef.current.get(currentId);
    if (resolver) {
      resolver.onOutput(line);
    }
  }, []);

  const sendCommand = useCallback((cmd) => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'command', data: cmd });
    }
  }, []);

  /**
   * Analyze a position and return evaluation
   * @param {string} fen - Position FEN
   * @param {number} depth - Analysis depth
   * @param {number} multiPv - Number of lines to analyze
   * @returns {Promise<AnalysisResult>}
   */
  const analyzePosition = useCallback((fen, depth = ANALYSIS_DEPTH, multiPv = MULTI_PV) => {
    return new Promise((resolve) => {
      const id = ++analysisIdRef.current;
      
      const lines = {};
      let bestDepthSeen = 0;

      const onOutput = (line) => {
        if (line.startsWith('info') && line.includes('score') && line.includes('pv')) {
          const parsed = parseInfoLine(line);
          if (parsed && parsed.depth >= bestDepthSeen) {
            bestDepthSeen = parsed.depth;
            lines[parsed.multipv || 1] = parsed;
          }
        }
        
        if (line.startsWith('bestmove')) {
          const parts = line.split(' ');
          const bestMove = parts[1] !== '(none)' ? parts[1] : null;
          
          resolversRef.current.delete(id);
          
          resolve({
            bestMove,
            lines: Object.values(lines),
            depth: bestDepthSeen
          });
        }
      };

      resolversRef.current.set(id, { onOutput });

      // Stop any current analysis
      sendCommand('stop');
      sendCommand(`position fen ${fen}`);
      sendCommand(`setoption name MultiPV value ${multiPv}`);
      sendCommand(`go depth ${depth}`);
    });
  }, [sendCommand]);

  /**
   * Stop current analysis
   */
  const stopAnalysis = useCallback(() => {
    sendCommand('stop');
    analysisIdRef.current++;
    resolversRef.current.clear();
  }, [sendCommand]);

  return { engineReady, engineError, analyzePosition, stopAnalysis };
}

/**
 * Parse UCI info line into structured data
 */
function parseInfoLine(line) {
  try {
    const depthMatch = line.match(/\bdepth (\d+)/);
    const scoreMatch = line.match(/\bscore (cp|mate) (-?\d+)/);
    const pvMatch = line.match(/\bpv (.+?)(?:\s+(?:bmc|time|nodes|nps|hashfull|tbhits)|\s*$)/);
    const multipvMatch = line.match(/\bmultipv (\d+)/);

    if (!depthMatch || !scoreMatch) return null;

    const depth = parseInt(depthMatch[1]);
    const scoreType = scoreMatch[1];
    const scoreValue = parseInt(scoreMatch[2]);
    const pv = pvMatch ? pvMatch[1].trim().split(' ') : [];
    const multipv = multipvMatch ? parseInt(multipvMatch[1]) : 1;

    let evaluation;
    if (scoreType === 'mate') {
      evaluation = scoreValue > 0 ? 10000 - scoreValue : -10000 - scoreValue;
      evaluation = scoreValue > 0 ? 9999 : -9999;
    } else {
      evaluation = scoreValue; // centipawns
    }

    return {
      depth,
      evaluation,
      isMate: scoreType === 'mate',
      mateIn: scoreType === 'mate' ? Math.abs(scoreValue) : null,
      mateSign: scoreType === 'mate' ? Math.sign(scoreValue) : null,
      pv,
      bestMove: pv[0] || null,
      multipv
    };
  } catch {
    return null;
  }
}
