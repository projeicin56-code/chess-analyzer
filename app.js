// ====================== STOCKFISH MOTORU ======================
// Eski CDN Worker yerine daha uyumlu bir yol (COEP ile çalışır)
let stockfish = null;

function initStockfish() {
    try {
        // 1. Önce WASM destekli worker dene (daha güçlü ve modern)
        stockfish = new Worker('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.wasm.js');
        
        console.log("Stockfish WASM worker başlatılıyor...");
        
        stockfish.onmessage = function(event) {
            const message = event.data;
            console.log("Stockfish:", message);   // Debug için

            // Motor hazır olduğunda loading ekranını kaldır
            if (message === 'ready' || message.includes('uciok') || message.includes('Stockfish')) {
                document.getElementById('loading').style.display = 'none';
                console.log("✅ Satranç Motoru Hazır!");
            }

            // En iyi hamle geldiğinde göster
            if (typeof message === 'string' && message.includes("bestmove")) {
                const parts = message.split(" ");
                const bestMove = parts[1] || "???";
                document.getElementById("bestMove").innerText = "En İyi Hamle: " + bestMove;
            }
        };

        // Motoru başlat
        stockfish.postMessage("uci");

    } catch (e) {
        console.error("Stockfish başlatılamadı:", e);
        document.getElementById('loading').innerText = "Motor başlatılamadı. Tarayıcıyı yenile.";
    }
}

// ====================== SATRANÇ MANTIĞI ======================
let board = null;
let game = new Chess();

// Hamle yapıldığında analiz başlat
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
    
    document.getElementById("bestMove").innerText = "Analiz ediliyor...";
    stockfish.postMessage("position fen " + game.fen());
    stockfish.postMessage("go depth 15");   // Derinliği buradan değiştirebilirsin
}

// Tahta ayarları
const config = {
    draggable: true,
    position: 'start',
    onDrop: onDrop
};

board = Chessboard('board', config);

// Sıfırla butonu
document.getElementById('resetBtn').addEventListener('click', () => {
    game.reset();
    board.start();
    document.getElementById("bestMove").innerText = "";
});

// ====================== BAŞLAT ======================
initStockfish();