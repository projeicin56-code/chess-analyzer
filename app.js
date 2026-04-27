// ====================== STOCKFISH MOTORU (YEREL + GÜVENLİ) ======================
let stockfish = null;

function initStockfish() {
    try {
        // En stabil yol: Eski ama COEP ile daha uyumlu versiyon
        stockfish = new Worker('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');
        
        console.log("Stockfish worker başlatılıyor...");

        stockfish.onmessage = function(event) {
            const msg = event.data;
            console.log("Stockfish:", msg);

            // Motor hazır olunca loading'i kaldır
            if (msg === 'ready' || msg.includes('uciok') || msg.includes('Stockfish') || typeof msg === 'string' && msg.length > 0) {
                const loadingEl = document.getElementById('loading');
                if (loadingEl) loadingEl.style.display = 'none';
                console.log("✅ Satranç Motoru Hazır!");
            }

            // En iyi hamle
            if (typeof msg === 'string' && msg.includes("bestmove")) {
                const parts = msg.trim().split(/\s+/);
                const bestMove = parts[1] || "???";
                const bestEl = document.getElementById("bestMove");
                if (bestEl) bestEl.innerText = "En İyi Hamle: " + bestMove;
            }
        };

        // Motoru başlat
        setTimeout(() => {
            stockfish.postMessage("uci");
            stockfish.postMessage("isready");
        }, 500);

    } catch (e) {
        console.error("Stockfish hatası:", e);
        const loadingEl = document.getElementById('loading');
        if (loadingEl) loadingEl.innerText = "Motor başlatılamadı 😢 Tarayıcıyı yenile.";
    }
}

// ====================== SATRANÇ MANTIĞI ======================
let board = null;
let game = new Chess();

function onDrop(source, target) {
    let move = game.move({ from: source, to: target, promotion: 'q' });
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

// ====================== BAŞLAT ======================
initStockfish();