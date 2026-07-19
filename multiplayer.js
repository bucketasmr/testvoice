let peer = null;
let conn = null;
let isHost = false;
let roomId = "";
let heartbeatInterval = null;

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

// Ультимативный пул серверов, поддерживающий кросс-платформенность Win11 ⇄ iOS (IPv4/IPv6)
const globalPeerConfig = {
    host: '0.peerjs.com',
    port: 443,
    path: '/',
    secure: true,
    config: {
        'iceServers': [
            // STUN-серверы Google (для прямого P2P)
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            
            // TURN-серверы (Глобальные ретрансляторы трафика при жестком NAT)
            { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
            { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
            { urls: 'turn:global.turn.twilio.com:3478?transport=udp', username: 'anonymous', credential: 'anonymous' }
        ],
        iceCandidatePoolSize: 12,
        sdpSemantics: 'unified-plan'
    }
};

// Сетевая геолокация
async function detectLocation() {
    logToScreen("Определяем сетевую геолокацию устройства...", "GEO");
    try {
        const response = await fetch('https://ipapi.co/json/');
        if (!response.ok) throw new Error(`Код: ${response.status}`);
        const data = await response.json();
        logToScreen(`Локация: ${data.country_name || "???"}, г. ${data.city || "???"} (Провайдер: ${data.org || "???"})`, "GEO_SUCCESS");
    } catch (err) {
        logToScreen(`Геопозиция не определена: ${err.message}`, "GEO_WARN");
    }
}

detectLocation();

const urlParams = new URLSearchParams(window.location.search);
const inviteRoomId = urlParams.get('room');

if (inviteRoomId) {
    roomId = inviteRoomId;
    btnCreate.style.display = 'none';
    joinSection.style.display = 'block';
    statusEl.innerText = "Комната найдена!";
    logToScreen(`Вход по ссылке. Ожидаемый ID Хоста: ${roomId}`);
} else {
    statusEl.innerText = "Создайте комнату";
    logToScreen("Ожидание инициализации комнаты Хостом.");
}

btnCreate.addEventListener('click', createRoom);
btnJoin.addEventListener('click', joinRoom);
btnShare.addEventListener('click', shareLink);

function createRoom() {
    isHost = true;
    btnCreate.disabled = true;
    statusEl.innerText = "Регистрация...";
    logToScreen("Подключение к сигнальному серверу PeerJS...");

    peer = new Peer(globalPeerConfig); 
    setupPeerDiagnostics();
}

function joinRoom() {
    btnJoin.disabled = true;
    statusEl.innerText = "Подключение...";
    logToScreen(`Запуск сессии Гостя. Подготовка WebRTC...`);

    peer = new Peer(globalPeerConfig);
    
    peer.on('open', (id) => {
        logToScreen(`Сигнальный слой Гостя готов. Локальный ID: ${id}`);
        logToScreen(`Отправка P2P-запроса к Хосту [${roomId}]...`);
        
        conn = peer.connect(roomId, { reliable: false, serialization: 'json' });
        setupConnectionHandlers();
    });

    setupPeerDiagnostics();
}

function setupPeerDiagnostics() {
    if (!peer) return;

    peer.on('open', (id) => {
        if (isHost) {
            roomId = id;
            btnCreate.style.display = 'none';
            btnShare.style.display = 'block';
            statusEl.innerText = "Комната готова!";
            logToScreen(`[Успех] Вы зарегистрированы как Хост. ID: ${id}`, "SUCCESS");
            startHeartbeat();
        }
    });

    peer.on('connection', (connection) => {
        conn = connection;
        logToScreen("СИГНАЛ: Зафиксирован входящий запрос от Гостя. Начинаем хэндшейк...", "NET");
        setupConnectionHandlers();
    });

    peer.on('error', (err) => {
        let explain = "Неизвестная ошибка.";
        switch(err.type) {
            case 'browser-incompatible': explain = "Браузер или настройки ОС блокируют WebRTC API."; break;
            case 'disconnected': explain = "Связь с сигнальным сервером PeerJS разорвана."; break;
            case 'network': explain = "Сбой сети! Потеря пакетов между UA и USA."; break;
            case 'peer-unavailable': explain = "Хост не найден! Вкладка закрыта, свернута или заблокирована системой."; break;
            case 'socket-error': explain = "Низкоуровневая ошибка WebSocket."; break;
            case 'socket-closed': explain = "Сокет закрыт. Браузер ушел в спящий режим."; break;
        }
        logToScreen(`[СБОЙ СЕРВЕРА] Тип: ${err.type} | Анализ: ${explain}`, "CRITICAL");
        btnCreate.disabled = false;
        btnJoin.disabled = false;
        statusEl.innerText = `Ошибка: ${err.type}`;
    });
}

// ПОСТРОЧНЫЙ ТРАССИРОВЩИК СЕТЕВЫХ МАРШРУТОВ
function setupConnectionHandlers() {
    if (!conn) return;

    const rtcPC = conn.peerConnection;
    if (rtcPC) {
        logToScreen("Мониторинг портов WebRTC активирован.", "ICE");
        
        rtcPC.onicecandidate = (event) => {
            if (event.candidate) {
                const c = event.candidate;
                let serverType = "Неизвестный сервер";
                
                // Детальный разбор типа шлюза для выявления спотыкания
                if (c.candidate.includes("host")) serverType = "Локальный интерфейс устройства (Host IP)";
                else if (c.candidate.includes("srflx")) serverType = "Публичный IP через STUN Google (Reflexive)";
                else if (c.candidate.includes("relay")) serverType = "Ретранслятор TURN Мост (Relay)";

                const ipType = c.address.includes(":") ? "IPv6" : "IPv4";
                
                logToScreen(`[Генерация шлюза] -> ${serverType} | Протокол: ${c.protocol.toUpperCase()} | Семья: ${ipType} | Адрес: ${c.address}:${c.port}`, "ICE_CANDIDATE");
            } else {
                logToScreen("Сбор доступных сетевых шлюзов на этом устройстве завершен.", "ICE_INFO");
            }
        };

        rtcPC.oniceconnectionstatechange = () => {
            let desc = "";
            switch(rtcPC.iceConnectionState) {
                case 'checking': desc = "Тестируем совместимость портов Win11 ⇄ iOS..."; break;
                case 'connected': desc = "Маршрутизация успешна! Сигнал проходит."; break;
                case 'completed': desc = "Сборка стабильного моста завершена."; break;
                case 'failed': desc = "Крах пробития NAT! Защита сети или разница IPv4/IPv6 заблокировала порты."; break;
                case 'disconnected': desc = "Потеря пакетов. Попытка перестроиться..."; break;
                case 'closed': desc = "Канал связи уничтожен."; break;
            }
            logToScreen(`[Статус стыковки] State: ${rtcPC.iceConnectionState.toUpperCase()} -> ${desc}`, "ICE_STATE");
        };
    }

    conn.on('open', () => {
        statusEl.innerText = "Связь установлена!";
        logToScreen("Бинго! Тоннель данных открыт. Запуск игры...", "SUCCESS");
        menuEl.style.display = 'none';
        clearInterval(heartbeatInterval);
        initGame();
    });

    conn.on('data', (data) => {
        if (data.type === 'ping') return;
        if (data.type !== 'move' && data.type !== 'ball') {
            logToScreen(`[Сеть RX] Получен тип: ${data.type}`, "DATA");
        }
        handleNetworkData(data);
    });

    conn.on('close', () => {
        logToScreen("Канал связи закрыт удаленной стороной.", "WARN");
        alert("Соединение потеряно.");
        window.location.reload();
    });
    
    conn.on('error', (err) => {
        logToScreen(`[Ошибка Канала Данных] ${err.message}`, "ERROR");
    });
}

function sendNetData(data) {
    if (conn && conn.open) {
        conn.send(data);
    }
}

function shareLink() {
    const inviteLink = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    if (navigator.share) {
        navigator.share({ title: 'Rocket Tennis', url: inviteLink })
            .then(() => logToScreen("Ссылка отправлена."))
            .catch(e => logToScreen(`Шеринг отменен: ${e.message}`, "WARN"));
    } else {
        navigator.clipboard.writeText(inviteLink);
        logToScreen("Ссылка скопирована в буфер.");
        alert("Ссылка скопирована!");
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
    }, 4000);
}
