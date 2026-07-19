let peer = null;
let conn = null;
let isHost = false;
let myRoomCode = "";
let heartbeatInterval = null;

// Элементы интерфейса
const statusEl = document.getElementById('status');
const menuEl = document.getElementById('menu');
const btnCreate = document.getElementById('btnCreate');
const btnJoin = document.getElementById('btnJoin');
const consoleLog = document.getElementById('consoleLog');

// Создаем новые элементы динамически, чтобы не ломать твою верстку
const pinSection = document.createElement('div');
pinSection.id = 'pinSection';
pinSection.style.marginTop = '15px';
pinSection.innerHTML = `
    <div id="hostZone" style="display:none; text-align:center;">
        <h2 style="font-size: 24px; color: #fff; margin-bottom: 10px;">КОД МАТЧА: <span id="displayCode" style="color: #00ffcc; letter-spacing: 2px;">----</span></h2>
        <p style="font-size: 12px; color: #aaa;">Сообщите эти цифры второму игроку</p>
        <button id="btnStartMatch" disabled style="display:none; margin-top:15px; padding: 12px 30px; font-weight:bold; background:#00ffcc; color:#000; border:none; border-radius:5px; cursor:pointer;">НАЧАТЬ МАТЧ</button>
    </div>
    <div id="guestZone" style="display:none; text-align:center;">
        <input type="number" id="inputCode" placeholder="Введите код матча" style="padding: 12px; width: 80%; max-width: 250px; border-radius: 5px; border: 1px solid #444; background: #222; color: #fff; font-size: 18px; text-align: center; margin-bottom: 10px;">
        <br>
        <button id="btnConnectByCode" style="padding: 10px 25px; background: #28a745; color: #fff; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">ПОДКЛЮЧИТЬСЯ</button>
    </div>
`;
menuEl.appendChild(pinSection);

const hostZone = document.getElementById('hostZone');
const guestZone = document.getElementById('guestZone');
const displayCode = document.getElementById('displayCode');
const inputCode = document.getElementById('inputCode');
const btnConnectByCode = document.getElementById('btnConnectByCode');
const btnStartMatch = document.getElementById('btnStartMatch');

function logToScreen(message, type = "INFO") {
    const time = new Date().toISOString().slice(11, 23);
    consoleLog.innerText += `[${time}] [${type}] ${message}\n`;
    consoleLog.scrollTop = consoleLog.scrollHeight;
}

// Конфигурация серверов с гарантированным TURN-релеем от Twilio
const globalPeerConfig = {
    host: '0.peerjs.com',
    port: 443,
    path: '/',
    secure: true,
    config: {
        'iceServers': [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            {
                urls: 'turn:global.turn.twilio.com:3478?transport=udp',
                username: '6fbf82df31c778401311029c0b11545fc41b3e83921508dae763118cfeb5957d',
                credential: 'fOnb06q7fMv3gAnxS9Xg40Sg6Y34K3IofZ896z6VvY+9eH5wYI+l6/O8iZf0B1Hk'
            },
            {
                urls: 'turn:global.turn.twilio.com:3478?transport=tcp',
                username: '6fbf82df31c778401311029c0b11545fc41b3e83921508dae763118cfeb5957d',
                credential: 'fOnb06q7fMv3gAnxS9Xg40Sg6Y34K3IofZ896z6VvY+9eH5wYI+l6/O8iZf0B1Hk'
            }
        ],
        iceCandidatePoolSize: 12,
        sdpSemantics: 'unified-plan'
    }
};

// Генератор чисто цифровых кодов заданной длины
function generateNumericCode(length) {
    let result = '';
    for (let i = 0; i < length; i++) {
        result += Math.floor(Math.random() * 10).toString();
    }
    return result;
}

btnCreate.addEventListener('click', () => {
    isHost = true;
    btnCreate.style.display = 'none';
    btnJoin.style.display = 'none';
    hostZone.style.display = 'block';
    
    // Начинаем с 4 цифр, как ты просил
    initHostWithCode(4); 
});

btnJoin.addEventListener('click', () => {
    isHost = false;
    btnCreate.style.display = 'none';
    btnJoin.style.display = 'none';
    guestZone.style.display = 'block';
    statusEl.innerText = "Ожидание ввода кода...";
});

btnConnectByCode.addEventListener('click', () => {
    const code = inputCode.value.trim();
    if (code.length < 4) {
        alert("Код слишком короткий!");
        return;
    }
    btnConnectByCode.disabled = true;
    statusEl.innerText = "Подключение к Хосту...";
    logToScreen(`Запуск сессии Гостя. Попытка подключиться к коду: ${code}`);

    peer = new Peer(globalPeerConfig);
    
    peer.on('open', (id) => {
        logToScreen(`Сигнальный интерфейс Гостя запущен. Посылаем запрос...`);
        conn = peer.connect(code, { reliable: false, serialization: 'json' });
        setupConnectionHandlers();
    });

    peer.on('error', (err) => {
        logToScreen(`[Ошибка Гостя] ${err.type}: ${err.message}`, "CRITICAL");
        btnConnectByCode.disabled = false;
    });
});

// Слушатель для кнопки старта (только для Хоста)
btnStartMatch.addEventListener('click', () => {
    logToScreen("Хост нажал кнопку старта. Отправляем команду запуска Гостю...", "SYS");
    sendNetData({ type: 'START_GAME_TRIGGER' });
    
    // Запускаем игру у себя
    menuEl.style.display = 'none';
    initGame(); 
});

function initHostWithCode(digitsCount) {
    myRoomCode = generateNumericCode(digitsCount);
    displayCode.innerText = myRoomCode;
    statusEl.innerText = `Регистрация кода ${myRoomCode}...`;
    logToScreen(`Пробуем занять цифровой ID: ${myRoomCode} на сервере PeerJS...`);

    // Передаем сгенерированный цифровой код в качестве фиксированного ID для PeerJS
    peer = new Peer(myRoomCode, globalPeerConfig);

    peer.on('open', (id) => {
        statusEl.innerText = "Ждем подключения второго игрока...";
        logToScreen(`[Успех] Код ${id} успешно забронирован. Хост готов!`, "SUCCESS");
        startHeartbeat();
    });

    peer.on('connection', (connection) => {
        conn = connection;
        logToScreen("СИГНАЛ: Гость ввел правильный код и постучался. Начинаем стыковку каналов...", "NET");
        setupConnectionHandlers();
    });

    peer.on('error', (err) => {
        // Если код уже занят кем-то в мире (ошибка unavailable-id / id-taken)
        if (err.type === 'unavailable-id' || err.type === 'id-taken') {
            logToScreen(`Код ${myRoomCode} уже занят на сервере. Повышаем разрядность до ${digitsCount + 1}...`, "WARN");
            peer.destroy();
            // Рекурсивно генерируем более длинный код (до 10 цифр по правилу 2)
            initHostWithCode(Math.min(digitsCount + 1, 10));
        } else {
            logToScreen(`[Ошибка Хоста] ${err.type}: ${err.message}`, "CRITICAL");
        }
    });
}

function setupConnectionHandlers() {
    if (!conn) return;

    const rtcPC = conn.peerConnection;
    if (rtcPC) {
        rtcPC.onicecandidate = (event) => {
            if (event.candidate) {
                const c = event.candidate;
                let serverType = c.candidate.includes("relay") ? "Twilio TURN" : "STUN/Direct";
                logToScreen(`[Шлюз] ${serverType} | ${c.protocol.toUpperCase()} | ${c.address}:${c.port}`, "ICE");
            }
        };

        rtcPC.oniceconnectionstatechange = () => {
            logToScreen(`[WebRTC State]: ${rtcPC.iceConnectionState.toUpperCase()}`, "ICE_STATE");
        };
    }

    conn.on('open', () => {
        clearInterval(heartbeatInterval);
        
        if (isHost) {
            statusEl.innerText = "Игрок подключен! Нажмите 'Начать матч'";
            logToScreen("Канал связи открыт! Кнопка старта разблокирована.", "SUCCESS");
            btnStartMatch.style.display = 'inline-block';
            btnStartMatch.disabled = false; // Разрешаем Хосту запустить игру
        } else {
            statusEl.innerText = "Успешное подключение! Ждем команду старта от Хоста...";
            logToScreen("Канал связи открыт! Ожидание ручного запуска игры Хостом...", "SUCCESS");
        }
    });

    conn.on('data', (data) => {
        if (data.type === 'ping') return;
        
        // Перехватываем команду на запуск игры (для Гостя)
        if (data.type === 'START_GAME_TRIGGER') {
            logToScreen("Получена команда старта от Хоста! Запускаем графический движок.", "SUCCESS");
            menuEl.style.display = 'none';
            initGame(); // Запуск игры в game.js
            return;
        }

        if (data.type !== 'move' && data.type !== 'ball') {
            logToScreen(`[Пакет RX] Тип: ${data.type}`, "DATA");
        }
        handleNetworkData(data);
    });

    conn.on('close', () => {
        logToScreen("Соединение прервано.", "WARN");
        alert("Оппонент отключился.");
        window.location.reload();
    });
}

function sendNetData(data) {
    if (conn && conn.open) {
        conn.send(data);
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
