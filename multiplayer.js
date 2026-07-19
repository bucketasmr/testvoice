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

// Сверхнадежная глобальная конфигурация (Выделенный порт + STUN-пул)
const globalPeerConfig = {
    host: '0.peerjs.com',
    port: 443,
    path: '/',
    secure: true,
    debug: 3, // Включает детальный лог в консоль браузера
    config: {
        'iceServers': [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
        ],
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
    logToScreen("Подключение к защищенному серверу 0.peerjs.com...");

    // Передаем полную конфигурацию
    peer = new Peer(globalPeerConfig); 
    
    peer.on('open', (id) => {
        roomId = id;
        btnCreate.style.display = 'none';
        btnShare.style.display = 'block';
        statusEl.innerText = "Матч готов. Отправьте ссылку!";
        logToScreen(`Сервер выделил ID: ${id}. Комната активна.`, "SUCCESS");
        startHeartbeat(); // Держим соединение с сервером активным
    });

    peer.on('connection', (connection) => {
        conn = connection;
        logToScreen("Входящий запрос на соединение (WebRTC handshake)...", "NET");
        setupConnection();
    });
    
    peer.on('error', (err) => {
        logToScreen(`Ошибка Хоста [${err.type}]: ${err.message}`, "ERROR");
        btnCreate.disabled = false;
        clearInterval(heartbeatInterval);
    });
}

function shareLink() {
    const inviteLink = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    logToScreen(`Ссылка для друга сгенерирована.`);
    if (navigator.share) {
        navigator.share({ title: 'Rocket Tennis UA-USA', url: inviteLink })
            .then(() => logToScreen("Ссылка успешно отправлена."))
            .catch(e => logToScreen(`Шеринг прерван: ${e.message}`, "WARN"));
    } else {
        navigator.clipboard.writeText(inviteLink);
        logToScreen("Прямой шеринг недоступен. Скопировано в буфер.");
        alert("Ссылка скопирована!");
    }
}

function joinRoom() {
    btnJoin.disabled = true;
    statusEl.innerText = "Пробиваем NAT/Файрволы...";
    logToScreen(`Инициализация Гостя. Попытка пробить маршрут к ${roomId}...`, "NET");

    peer = new Peer(globalPeerConfig);
    
    peer.on('open', () => {
        logToScreen("Глобальный сетевой слой Гостя готов. Подключаемся напрямую к Хосту...");
        conn = peer.connect(roomId, { 
            reliable: false,
            serialization: 'json'
        });
        setupConnection();
    });

    peer.on('error', (err) => {
        logToScreen(`Ошибка Гостя [${err.type}]: ${err.message}`, "ERROR");
        if(err.type === 'peer-unavailable') {
            logToScreen("Хост не найден. Убедитесь, что Игрок 1 не закрыл вкладку на iPhone!", "WARN");
        }
        btnJoin.disabled = false;
    });
}

function setupConnection() {
    conn.on('open', () => {
        statusEl.innerText = "Соединение установлено!";
        logToScreen("P2P канал UA ⇄ USA открыт! Переходим к запуску графики.", "SUCCESS");
        menuEl.style.display = 'none';
        
        // Останавливаем серверный пинг, теперь пингуем напрямую игрока
        clearInterval(heartbeatInterval);
        initGame();
    });

    conn.on('data', (data) => {
        if (data.type === 'ping') {
            // Игнорируем технический пинг в игровом движке, просто логируем
            logToScreen("KEEP-ALIVE: Пакет удержания сети получен.", "SYS");
            return;
        }
        logToScreen(`INBOUND: [${data.type}]`, "RX");
        handleNetworkData(data);
    });

    conn.on('close', () => {
        logToScreen("Сеть закрыта удаленной стороной.", "WARN");
        alert("Соединение потеряно.");
        window.location.reload();
    });
}

function sendNetData(data) {
    if (conn && conn.open) {
        conn.send(data);
        // Не спамим TX логами каждую миллисекунду, чтобы iPhone не тормозил, 
        // логируем в консоль только голы, удары и системные тики
        if (data.type !== 'move' && data.type !== 'ball') {
            logToScreen(`OUTBOUND: [${data.type}]`, "TX");
        }
    }
}

// Функция удержания соединения (предотвращает засыпание Safari на iOS)
function startHeartbeat() {
    clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
        if (peer && !peer.destroyed) {
            peer.socket.send({ type: 'HEARTBEAT' });
            logToScreen("Серверный пинг отправлен (стабилизация сессии)", "SYS");
        }
        if (conn && conn.open) {
            conn.send({ type: 'ping' });
        }
    }, 5000);
}
