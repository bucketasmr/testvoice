let peer;
let conn;
let isHost = false;
let roomId = "";

const statusEl = document.getElementById('status');
const menuEl = document.getElementById('menu');
const btnCreate = document.getElementById('btnCreate');
const btnShare = document.getElementById('btnShare');
const btnJoin = document.getElementById('btnJoin');
const joinSection = document.getElementById('joinSection');
const consoleLog = document.getElementById('consoleLog');

// Кастомная консоль в HTML
function logToScreen(message, type = "INFO") {
    const time = new Date().toISOString().slice(11, 23);
    consoleLog.innerText += `[${time}] [${type}] ${message}\n`;
    // Авто-скролл вниз к последнему логу
    consoleLog.scrollTop = consoleLog.scrollHeight;
}

// Управление кнопками консоли
document.getElementById('btnClearLog').addEventListener('click', () => consoleLog.innerText = "");
document.getElementById('btnCopyLog').addEventListener('click', () => {
    navigator.clipboard.writeText(consoleLog.innerText)
        .then(() => alert("Логи скопированы в буфер!"))
        .catch(() => alert("Не удалось скопировать"));
});

// Конфигурация для пробития NAT между Украиной и США (STUN Google)
const peerConfig = {
    config: {
        'iceServers': [
            { url: 'stun:stun.l.google.com:19302' },
            { url: 'stun:stun1.l.google.com:19302' },
            { url: 'stun:stun2.l.google.com:19302' }
        ]
    }
};

const urlParams = new URLSearchParams(window.location.search);
const inviteRoomId = urlParams.get('room');

if (inviteRoomId) {
    roomId = inviteRoomId;
    btnCreate.style.display = 'none';
    joinSection.style.display = 'block';
    statusEl.innerText = "Линк распознан. Подключитесь.";
    logToScreen(`Обнаружен ID комнаты в URL: ${roomId}. Ожидание тапа по кнопке Вступить.`);
} else {
    statusEl.innerText = "Создайте комнату для игры";
    logToScreen("Система инициализирована. Ожидание выбора роли.");
}

btnCreate.addEventListener('click', createRoom);
btnJoin.addEventListener('click', joinRoom);
btnShare.addEventListener('click', shareLink);

function createRoom() {
    isHost = true;
    btnCreate.disabled = true;
    statusEl.innerText = "Коннект к сигнальному серверу...";
    logToScreen("Запуск инициализации Хоста через ICE/STUN Google...");

    peer = new Peer(peerConfig); 
    
    peer.on('open', (id) => {
        roomId = id;
        btnCreate.style.display = 'none';
        btnShare.style.display = 'block';
        statusEl.innerText = "Матч готов. Отправьте ссылку!";
        logToScreen(`Хост успешно создан. Локальный PeerID: ${id}`, "SUCCESS");
    });

    peer.on('connection', (connection) => {
        conn = connection;
        logToScreen("Обнаружено входящее P2P подключение от удаленного пира...", "NET");
        setupConnection();
    });
    
    peer.on('error', (err) => {
        logToScreen(`Критическая ошибка PeerJS: ${err.type}`, "ERROR");
        btnCreate.disabled = false;
    });
}

function shareLink() {
    const inviteLink = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    logToScreen(`Генерация инвайт-линка: ${inviteLink}`);
    if (navigator.share) {
        navigator.share({ title: 'Rocket Tennis UA-USA', url: inviteLink })
            .then(() => logToScreen("Инвайт успешно отправлен через Share Sheet iOS"))
            .catch(e => logToScreen(`Шеринг отменен: ${e.message}`, "WARN"));
    } else {
        navigator.clipboard.writeText(inviteLink);
        logToScreen("Системный ShareSheet недоступен. Ссылка скопирована в буфер.");
        alert("Ссылка скопирована!");
    }
}

function joinRoom() {
    btnJoin.disabled = true;
    statusEl.innerText = "Пробиваем NAT...";
    logToScreen(`Попытка P2P соединения с удаленным сервером ${roomId}...`, "NET");

    peer = new Peer(peerConfig);
    peer.on('open', () => {
        conn = peer.connect(roomId, { reliable: false }); // false отключает задержки TCP
        setupConnection();
    });

    peer.on('error', (err) => {
        logToScreen(`Ошибка подключения к Хосту: ${err.type}`, "ERROR");
        btnJoin.disabled = false;
    });
}

function setupConnection() {
    conn.on('open', () => {
        statusEl.innerText = "P2P канал открыт!";
        logToScreen("Канал связи установлен! Обмен пакетами начат.", "SUCCESS");
        menuEl.style.display = 'none';
        initGame();
    });

    conn.on('data', (data) => {
        // Каждую миллисекунду пишем входящий трафик в консоль, как ты просил
        logToScreen(`INBOUND: [type: ${data.type}] ${JSON.stringify(data)}`, "RX");
        handleNetworkData(data);
    });

    conn.on('close', () => {
        logToScreen("Внимание: Удаленный пир закрыл соединение.", "WARN");
        alert("Игрок отключился.");
        window.location.reload();
    });
}

function sendNetData(data) {
    if (conn && conn.open) {
        conn.send(data);
        logToScreen(`OUTBOUND: [type: ${data.type}]`, "TX");
    }
}
