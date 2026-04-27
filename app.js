// app.js - Basit Stockfish (CDN + Güvenli)

let stockfish = null;
let board = null;
let game = new Chess();

function initStockfish() {
    const loading = document.getElementById('loading');
    
    try {
        // Klasik JS versiyonu (wasm.js yerine) - daha az sorun çıkarıyor
        stockfish = new Worker('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');

        stockfish.onmessage = function(event) {
            const msg = event.data;
            console.log("Stockfish:", msg);

            if (loading) loading.style.display = 'none';

            if (typeof msg === 'string' && msg.includes("bestmove")) {
                const move = msg.split(" ")[1] || "???";
                document.getElementById("bestMove").innerText = "En İyi Hamle: " + move;
            }
        };

        setTimeout(() => {
            stockfish.postMessage("uci");
            stockfish.postMessage("isready");
        }, 500);

    } catch (e) {
        console.error("Stockfish hatası:", e);
        if (loading) loading.innerHTML = "Motor başlatılamadı.<br>VPN kapat ve sayfayı yenile.";
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