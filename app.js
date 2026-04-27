// 1. Satranç Motorunu (Stockfish) İnternet Üzerinden Başlatıyoruz
const stockfish = new Worker('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');

// 2. Satranç Mantığını ve Tahtayı Tanımlıyoruz
let board = null;
let game = new Chess();

// 3. Motor Hazır Olduğunda "Yükleniyor" Yazısını Kaldır
stockfish.onmessage = function(event) {
    if (event.data === 'ready') {
        document.getElementById('loading').style.display = 'none';
        console.log("Satranç Motoru Hazır!");
    }
    
    // Analiz Sonuçlarını Buradan Alıyoruz
    if (event.data.includes("bestmove")) {
        const move = event.data.split(" ")[1];
        document.getElementById("bestMove").innerText = "En İyi Hamle: " + move;
    }
};

// 4. Tahtanın Ayarları
function onDrop(source, target) {
    let move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });

    if (move === null) return 'snapback';
    
    // Hamle Yapılınca Analizi Başlat
    analyzePosition();
}

function analyzePosition() {
    document.getElementById("bestMove").innerText = "Analiz ediliyor...";
    stockfish.postMessage("position fen " + game.fen());
    stockfish.postMessage("go depth 15");
}

// 5. Tahtayı Ekrana Çiz
const config = {
    draggable: true,
    position: 'start',
    onDrop: onDrop
};
board = Chessboard('board', config);

// 6. Sıfırla Butonu Ayarı
document.getElementById('resetBtn').addEventListener('click', () => {
    game.reset();
    board.start();
    document.getElementById("bestMove").innerText = "";
});