// app.js - TEMİZ VE ÇALIŞAN SON HALİ

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
            if (loading && (msg.includes("uciok") || msg.includes("readyok") || msg.includes("Stockfish"))) {
                loading.style.display = 'none';
                console.log("✅ Loading kaldırıldı!");
            }

            // En iyi hamle göster
            if (typeof msg === 'string' && msg.includes("bestmove")) {
                const parts = msg.trim().split(/\s+/);
                const bestMove = parts[1] || "???";
                document.getElementById("bestMove").innerText = "En İyi Hamle: " + bestMove;
            }
        };

        // Motoru başlat
        setTimeout(() => {
            stockfish.postMessage("uci");
            stockfish.postMessage("isready");
        }, 300);

    } catch (e) {
        console.error("Stockfish hatası:", e);
        if (loading) loading.innerHTML = "Motor başlatılamadı.";
    }
}

function onDrop(source, target) {
    let move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });
    if (move === null) return 'snapback';

    analyzePosition();
}

function analyzePosition() {
    if (!stockfish) return;
    
    const bestMoveEl = document.getElementById("bestMove");
    if (bestMoveEl) bestMoveEl.innerText = "Analiz ediliyor...";

    stockfish.postMessage("position fen " + game.fen());
    stockfish.postMessage("go depth 15");
}

// Tahta kurulumu
const config = {
    draggable: true,
    position: 'start',
    onDrop: onDrop
};

board = Chessboard('board', config);

// Reset butonu
document.getElementById('resetBtn').addEventListener('click', () => {
    game.reset();
    board.start();
    const bestMoveEl = document.getElementById("bestMove");
    if (bestMoveEl) bestMoveEl.innerText = "";
});

// Uygulamayı başlat
window.addEventListener('load', () => {
    initStockfish();
});