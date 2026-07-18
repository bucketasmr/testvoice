let peer;
let conn;
let isHost = false;
let myId = "";

const statusEl = document.getElementById('status');
const menuEl = document.getElementById('menu');

document.getElementById('btnCreate').addEventListener('click', createRoom);
document.getElementById('btnJoin').addEventListener('click', joinRoom);

function createRoom() {
    isHost = true;
    // Используем фиксированную комнату или случайную. Для "одной комнаты" можно задать фиксированный ID, 
    // но во избежание конфликтов с другими юзерами в мире, сделаем случайную, которой можно поделиться.
    peer = new Peer(); 
    
    peer.on('open', (id) => {
        myId = id;
        statusEl.innerText = `Комната создана! Скопируй ID: ${id}`;
        console.log('My peer ID is: ' + id);
        // Автоматически копируем в буфер обмена для удобства на iOS
        navigator.clipboard.writeText(id).catch(() => {});
    });

    peer.on('connection', (connection) => {
        conn = connection;
        setupConnection();
    });
}

function joinRoom() {
    isHost = false;
    const targetId = document.getElementById('peerIdInput').value.trim();
    if (!targetId) return alert('Введите ID!');

    peer = new Peer();
    peer.on('open', () => {
        conn = peer.connect(targetId);
        setupConnection();
    });
}

function setupConnection() {
    conn.on('open', () => {
        statusEl.innerText = "Игроки подключены! Игра начинается.";
        menuEl.style.display = 'none';
        initGame();
    });

    conn.on('data', (data) => {
        handleNetworkData(data);
    });
}

function sendNetData(data) {
    if (conn && conn.open) {
        conn.send(data);
    }
}
