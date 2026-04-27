// Stockfish Web Worker
// Loads Stockfish WASM and handles UCI protocol communication

let stockfish = null;
let isReady = false;
let pendingCommands = [];

// Load Stockfish from CDN
async function loadStockfish() {
  try {
    // Use stockfish.js from CDN - single-threaded WASM version compatible with web workers
    importScripts('https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/stockfish-nnue-16-single.js');
    
    stockfish = Stockfish();
    
    stockfish.onmessage = (event) => {
      const line = typeof event === 'string' ? event : event.data;
      self.postMessage({ type: 'output', data: line });
    };

    // Initialize UCI
    stockfish.postMessage('uci');
    stockfish.postMessage('setoption name Hash value 32');
    stockfish.postMessage('setoption name Threads value 1');
    stockfish.postMessage('isready');
    
    isReady = true;
    
    // Flush pending commands
    pendingCommands.forEach(cmd => stockfish.postMessage(cmd));
    pendingCommands = [];
    
    self.postMessage({ type: 'ready' });
  } catch (err) {
    self.postMessage({ type: 'error', data: err.message });
  }
}

self.onmessage = (event) => {
  const { type, data } = event;
  
  if (type === 'init') {
    loadStockfish();
    return;
  }
  
  if (type === 'command') {
    if (isReady && stockfish) {
      stockfish.postMessage(data);
    } else {
      pendingCommands.push(data);
    }
  }
};
