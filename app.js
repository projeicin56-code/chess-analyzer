// app.js - Motor Çalışıyor, Loading Ekranını Düzeltelim

let stockfish = null;
let board = null;
let game = new Chess();

function initStockfish() {
    const loading = document.getElementById('loading');
    
    try {
        stockfish = new Worker('stockfish.js');

        stockfish.onmessage = function(event) {
            const msg = event.data;
            console.log("Stockfish:", msg);

            // Motor hazır olunca loading'i KALDIR
            if (msg.includes("uciok") || msg.includes("readyok") || msg.includes("Stockfish")) {
                if (loading) {
                    loading.style.display = 'none';
                }
            }

            // En iyi hamle
            if (typeof msg === 'string' && msg.includes("bestmove")) {
                const move = msg.split(" ")[1] || "???";
                document.getElementById("bestMove").innerText = "En İyi Hamle: " + move;
            }
        };

        setTimeout(() => {
            stockfish.postMessage("uci");
            stockfish.postMessage("isready");
        }, 300);

    } catch (e) {
        console.error(e);
        if (loading) loading.innerHTML = "Motor hatası";
    }
}

function onDrop(source, target) {
    let move = game.move({from: source, to: target, promotion: 'q'});
    if (move === null) return 'snapback';
    analyzePosition();
}

function analyzePosition() {
    if (!stockfish) return;
    document.getElementById("bestMove").innerText = "Analiz ediliyor...";
    stockfish.postMessage("position fen " + game.fen());
    stockfish.postMessage("go depth 15");
}

const config = {
    draggable: true,
    position: 'start',
    onDrop: onDrop
};

board = Chessboard('board', config);

document.getElementById('resetBtn').addEventListener('click', () => {
    game.reset();
    board.start();
    document.getElementById("bestMove").innerText = "";
});

window.addEventListener('load', initStockfish);