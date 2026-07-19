let peer;
let conn;
let isHost = false;
let roomId = "";
let heartbeatInterval;

const statusEl = document.getElementById('status');
const menuEl = document.getElementById('menu');
const btnCreate = document.getElementById('btnCreate');
const btnShare = document.getElementById('btnShare');
const btnJoin = document.getElementById('btnJoin');
const joinSection = document.getElementById('joinSection');
const consoleLog = document.getElementById('consoleLog');

function logToScreen(message, type = "INFO") {
    const time = new Date().toISOString().slice(11, 23);
    consoleLog.innerText += `[${time}] [${type}] ${message}\n`;
    consoleLog.scrollTop = consoleLog.scrollHeight;
}

document.getElementById('btnClearLog').addEventListener('click', () => consoleLog.innerText = "");
document.getElementById('btnCopyLog').addEventListener('click', () => {
    navigator.clipboard.writeText(consoleLog.innerText)
        .then(() => alert("Логи скопированы!"))
        .catch(() => alert("Ошибка копирования"));
});

// Глобальная конфигурация с STUN и TURN серверами для обхода любых NAT (UA <-> USA)
const globalPeerConfig = {
    host: '0.peerjs.com',
    port: 443,
    path: '/',
    secure: true,
    config: {
        'iceServers': [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            // Включаем бесплатный TURN-релей на случай жесткого файрвола у оператора
            {
                urls: 'turn:openrelay.metered.ca:443',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            }
        ],
        iceCandidatePoolSize: 10,
        sdpSemantics: 'unified-plan'
    }
};

const urlParams = new URLSearchParams(window.location.search);
const inviteRoomId = urlParams.get('room');

if (inviteRoomId) {
    roomId = inviteRoomId;
    btnCreate.style.display = 'none';
    joinSection.style.display = 'block';
    statusEl.innerText = "Комната найдена в ссылке!";
    logToScreen(`В URL найден ID: ${roomId}. Готов к транс-атлантическому коннекту.`);
} else {
    statusEl.innerText = "Создайте комнату для игры";
    logToScreen("Система запущена. Ожидание генерации Хоста.");
}

btnCreate.addEventListener('click', createRoom);
btnJoin.addEventListener('click', joinRoom);
btnShare.addEventListener('click', shareLink);

function createRoom() {
    isHost = true;
    btnCreate.disabled = true;
    statusEl.innerText = "Запрос глобальной комнаты...";
    logToScreen("Регистрация Хоста на сервере PeerJS...");

    peer = new Peer(globalPeerConfig); 
    
    peer.on('open', (id) => {
        roomId = id;
        btnCreate.style.display = 'none';
        btnShare.style.display = 'block';
        statusEl.innerText = "Матч готов. Отправьте ссылку!";
        logToScreen(`Сервер выделил ID: ${id}. Комната активна.`, "SUCCESS");
        startHeartbeat();
    });

    peer.on('connection', (connection) => {
        conn = connection;
        logToScreen("Входящий P2P запрос! Привязка обработчиков данных...", "NET");
        
        // На стороне Хоста ВАЖНО сразу вешать события, как только прилетел коннект
        setupConnectionHandlers();
    });
    
    peer.on('error', (err) => {
        logToScreen(`Ошибка Хоста [${err.type}]: ${err.message}`, "ERROR");
        btnCreate.disabled = false;
        clearInterval(heartbeatInterval);
    });
}

function shareLink() {
    const inviteLink = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    logToScreen(`Шеринг инвайта...`);
    if (navigator.share) {
        navigator.share({ title: 'Rocket Tennis UA-USA', url: inviteLink })
            .then(() => logToScreen("Ссылка отправлена."))
            .catch(e => logToScreen(`Отмена шеринга: ${e.message}`, "WARN"));
    } else {
        navigator.clipboard.writeText(inviteLink);
        logToScreen("Скопировано в буфер обмена.");
        alert("Ссылка скопирована!");
    }
}

function joinRoom() {
    btnJoin.disabled = true;
    statusEl.innerText = "Пробиваем NAT/TURN...";
    logToScreen(`Инициализация Гостя. Поиск маршрута к ${roomId}...`, "NET");

    peer = new Peer(globalPeerConfig);
    
    peer.on('open', () => {
        logToScreen("Сетевой слой Гостя готов. Инициация рукопожатия...");
        
        // Создаем подключение
        conn = peer.connect(roomId, { 
            reliable: false,
            serialization: 'json'
        });
        
        // На стороне Гостя вешаем события СРАЗУ ЖЕ после вызова connect
        setupConnectionHandlers();
    });

    peer.on('error', (err) => {
        logToScreen(`Ошибка Гостя [${err.type}]: ${err.message}`, "ERROR");
        btnJoin.disabled = false;
    });
}

// Вынесли обработчики в отдельную функцию, чтобы исключить рассинхронизацию вызовов в Safari
function setupConnectionHandlers() {
    if (!conn) return;

    conn.on('open', () => {
        statusEl.innerText = "Соединение установлено!";
        logToScreen("Бинго! P2P канал успешно пробит через TURN/STUN.", "SUCCESS");
        menuEl.style.display = 'none';
        
        clearInterval(heartbeatInterval);
        initGame(); // Запуск графики в game.js
    });

    conn.on('data', (data) => {
        if (data.type === 'ping') {
            logToScreen("KEEP-ALIVE: Пакет удержания сети.", "SYS");
            return;
        }
        // Чтобы не спамить в консоль движения ракеток, логируем только важные события
        if (data.type !== 'move' && data.type !== 'ball') {
            logToScreen(`INBOUND: [${data.type}] ${JSON.stringify(data)}`, "RX");
        }
        handleNetworkData(data);
    });

    conn.on('close', () => {
        logToScreen("Соединение разорвано удаленной стороной.", "WARN");
        alert("Соединение потеряно.");
        window.location.reload();
    });
    
    conn.on('error', (err) => {
        logToScreen(`Ошибка P2P канала: ${err.message}`, "ERROR");
    });
}

function sendNetData(data) {
    if (conn && conn.open) {
        conn.send(data);
        if (data.type !== 'move' && data.type !== 'ball') {
            logToScreen(`OUTBOUND: [${data.type}]`, "TX");
        }
    }
}

function startHeartbeat() {
    clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
        if (peer && !peer.destroyed && peer.socket) {
            peer.socket.send({ type: 'HEARTBEAT' });
        }
        if (conn && conn.open) {
            conn.send({ type: 'ping' });
        }
    }, 4000); // Чуть ускорили пинг для агрессивного Safari
}
