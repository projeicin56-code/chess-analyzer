// app.js - Basit ve Çalışır Versiyon

let stockfish = null;
let board = null;
let game = new Chess();

// Motoru başlat
function initStockfish() {
    const loading = document.getElementById('loading');
    
    try {
        stockfish = new Worker('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');

        stockfish.onmessage = function(event) {
            const msg = event.data;
            console.log("Stockfish:", msg);

            // Loading yazısını kaldır
            if (loading) loading.style.display = 'none';

            // En iyi hamle geldiğinde göster
            if (typeof msg === 'string' && msg.includes("bestmove")) {
                const move = msg.split(" ")[1] || "???";
                document.getElementById("bestMove").innerText = "En İyi Hamle: " + move;
            }
        };

        // Motoru UCI ile başlat
        setTimeout(() => {
            stockfish.postMessage("uci");
            stockfish.postMessage("isready");
        }, 500);

        console.log("Stockfish worker başlatıldı.");

    } catch (e) {
        console.error(e);
        if (loading) loading.innerHTML = "Motor başlatılamadı.<br>VPN'i kapat ve sayfayı yenile.";
    }
}

// Hamle yapıldığında analiz başlat
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

// Tahta ayarları
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
    document.getElementById("bestMove").innerText = "";
});

// Sayfa yüklendikten sonra başlat
window.addEventListener('load', () => {
    initStockfish();
});