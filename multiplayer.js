let peer = null;
let conn = null;
let isHost = false;
let myRoomCode = "";
let heartbeatInterval = null;

// Находим существующие элементы из твоего HTML
const statusEl = document.getElementById('status');
const menuEl = document.getElementById('menu');
const btnCreate = document.getElementById('btnCreate');
const btnJoin = document.getElementById('btnJoin');
const joinSection = document.getElementById('joinSection');
const btnShare = document.getElementById('btnShare'); // Нам больше не нужен, переделаем его
const consoleLog = document.getElementById('consoleLog');

// Сбрасываем старую логику ссылок и делаем кнопку Вступить всегда доступной на старте
joinSection.style.display = 'block';
joinSection.innerHTML = ''; // Очищаем внутренности блока для нашей новой формы

// Создаем элементы ввода кода для Гостя и кнопку Старта для Хоста внутри joinSection
joinSection.innerHTML = `
    <button id="btnOpenJoinForm" style="background: #34c759; margin-top: 8px;">Вступить по коду (Гость)</button>
    <div id="guestInputZone" style="display: none; margin-top: 10px;">
        <input type="number" id="inputCode" placeholder="Введите код матча" 
            style="padding: 12px; width: 100%; border-radius: 12px; border: 1px solid #444; background: #222; color: #fff; font-size: 16px; text-align: center; margin-bottom: 8px; outline: none;">
        <button id="btnConnectByCode" style="background: #28a745; margin: 0;">Подключиться к игре</button>
    </div>
    <button id="btnStartMatch" disabled style="display: none; background: #34c759; margin-top: 8px; box-shadow: 0 0 15px rgba(52, 199, 89, 0.4);">НАЧАТЬ МАТЧ</button>
`;

// Получаем ссылки на созданные элементы
const btnOpenJoinForm = document.getElementById('btnOpenJoinForm');
const guestInputZone = document.getElementById('guestInputZone');
const inputCode = document.getElementById('inputCode');
const btnConnectByCode = document.getElementById('btnConnectByCode');
const btnStartMatch = document.getElementById('btnStartMatch');

function logToScreen(message, type = "INFO") {
    const time = new Date().toISOString().slice(11, 23);
    consoleLog.innerText += `[${time}] [${type}] ${message}\n`;
    consoleLog.scrollTop = consoleLog.scrollHeight;
}

// Слушатели кнопок для очистки и копирования логов (из твоего HTML)
document.getElementById('btnClearLog').addEventListener('click', () => consoleLog.innerText = "");
document.getElementById('btnCopyLog').addEventListener('click', () => {
    navigator.clipboard.writeText(consoleLog.innerText)
        .then(() => alert("Логи скопированы!"))
        .catch(() => alert("Ошибка копирования"));
});

// Конфигурация серверов со стабильным TURN-релеем от Twilio
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

// Сетевая геолокация
async function detectLocation() {
    logToScreen("Определяем сетевую геолокацию устройства...", "GEO");
    try {
        const response = await fetch('https://ipapi.co/json/');
        if (!response.ok) throw new Error(`Код: ${response.status}`);
        const data = await response.json();
        logToScreen(`Локация: ${data.country_name || "???"}, г. ${data.city || "???"} (Провайдер: ${data.org || "???"})`, "GEO_SUCCESS");
        statusEl.innerText = `Регион подключения: ${data.country_code || "WEB"}`;
    } catch (err) {
        logToScreen(`Геопозиция не определена: ${err.message}`, "GEO_WARN");
        statusEl.innerText = "Регион: Global (STUN)";
    }
}
detectLocation();

// Генератор чисто цифровых кодов заданной длины
function generateNumericCode(length) {
    let result = '';
    for (let i = 0; i < length; i++) {
        result += Math.floor(Math.random() * 10).toString();
    }
    return result;
}

// Логика кнопки "Создать матч"
btnCreate.addEventListener('click', () => {
    isHost = true;
    btnCreate.style.display = 'none';
    btnOpenJoinForm.style.display = 'none';
    initHostWithCode(4); // Начинаем генерацию с 4 цифр
});

// Открытие формы ввода кода у Гостя
btnOpenJoinForm.addEventListener('click', () => {
    btnCreate.style.display = 'none';
    btnOpenJoinForm.style.display = 'none';
    guestInputZone.style.display = 'block';
    statusEl.innerText = "Ожидание ввода числового кода...";
});

// Клик по кнопке "Подключиться" после ввода кода
btnConnectByCode.addEventListener('click', () => {
    const code = inputCode.value.trim();
    if (code.length < 4) {
        alert("Код должен состоять минимум из 4 цифр!");
        return;
    }
    btnConnectByCode.disabled = true;
    inputCode.disabled = true;
    statusEl.innerText = "Стыковка с Хостом...";
    logToScreen(`Запуск сессии Гостя. Попытка пробить NAT к коду: ${code}`);

    peer = new Peer(globalPeerConfig);
    
    peer.on('open', (id) => {
        logToScreen(`Сигнальный шлюз Гостя открыт. Направляем пакеты подключения...`);
        conn = peer.connect(code, { reliable: false, serialization: 'json' });
        setupConnectionHandlers();
    });

    peer.on('error', (err) => {
        logToScreen(`[Ошибка Гостя] ${err.type}: ${err.message}`, "CRITICAL");
        btnConnectByCode.disabled = false;
        inputCode.disabled = false;
        statusEl.innerText = "Ошибка соединения. Попробуйте еще раз.";
    });
});

// Нажатие на кнопку Старт (только Хост)
btnStartMatch.addEventListener('click', () => {
    logToScreen("Хост подтвердил готовность. Запуск сетевого матча...", "SYS");
    sendNetData({ type: 'START_GAME_TRIGGER' });
    menuEl.style.display = 'none';
    initGame(); // Запускаем рендеринг canvas из game.js
});

function initHostWithCode(digitsCount) {
    myRoomCode = generateNumericCode(digitsCount);
    statusEl.innerText = `Бронирование кода: ${myRoomCode}`;
    logToScreen(`Попытка занять цифровой ID комнаты: ${myRoomCode}...`);

    peer = new Peer(myRoomCode, globalPeerConfig);

    peer.on('open', (id) => {
        // Переписываем заголовок меню, чтобы показать код комнаты прямо на месте названия игры
        menuEl.querySelector('h2').innerHTML = `КОД: <span style="color: #00ffcc; letter-spacing: 2px;">${id}</span>`;
        menuEl.querySelector('p').innerText = "Передайте этот цифровой код второму игроку";
        statusEl.innerText = "Ожидание подключения оппонента...";
        logToScreen(`[Успех] Код комнаты ${id} зарезервирован на сервере.`, "SUCCESS");
        startHeartbeat();
    });

    peer.on('connection', (connection) => {
        conn = connection;
        logToScreen("СИГНАЛ: Гость ввел верный пин-код. Разворачиваем WebRTC тоннель...", "NET");
        setupConnectionHandlers();
    });

    peer.on('error', (err) => {
        if (err.type === 'unavailable-id' || err.type === 'id-taken') {
            logToScreen(`Код ${myRoomCode} занят в глобальной сети. Повышаем уникальность на 1 разряд...`, "WARN");
            peer.destroy();
            initHostWithCode(Math.min(digitsCount + 1, 10)); // Рекурсивный запуск по правилу 2
        } else {
            logToScreen(`[Критическая ошибка Хоста] ${err.type}: ${err.message}`, "CRITICAL");
            btnCreate.style.display = 'block';
            btnOpenJoinForm.style.display = 'block';
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
                let serverType = c.candidate.includes("relay") ? "Twilio TURN релей" : "Google STUN / Прямой";
                logToScreen(`[Локальный шлюз сгенерирован] ${serverType} -> ${c.protocol.toUpperCase()}`, "ICE");
            }
        };

        rtcPC.oniceconnectionstatechange = () => {
            logToScreen(`[Статус стыковки узлов WebRTC]: ${rtcPC.iceConnectionState.toUpperCase()}`, "ICE_STATE");
        };
    }

    conn.on('open', () => {
        clearInterval(heartbeatInterval);
        
        if (isHost) {
            statusEl.innerText = "Гость подключен к сессии!";
            logToScreen("Успех! Тоннель данных синхронизирован. Разблокирована кнопка управления стартом.", "SUCCESS");
            btnStartMatch.style.display = 'block';
            btnStartMatch.disabled = false;
        } else {
            statusEl.innerText = "Подключено! Ожидание ручного запуска игры Хостом...";
            logToScreen("Успех! Тоннель данных синхронизирован. Ждем когда Хост нажмет кнопку старта.", "SUCCESS");
        }
    });

    conn.on('data', (data) => {
        if (data.type === 'ping') return;
        
        // Ловим триггер старта матча от Хоста
        if (data.type === 'START_GAME_TRIGGER') {
            logToScreen("СИГНАЛ СТАРТА: Команда запуска от Хоста принята. Убираем меню.", "SUCCESS");
            menuEl.style.display = 'none';
            initGame();
            return;
        }

        if (data.type !== 'move' && data.type !== 'ball') {
            logToScreen(`[Пакет данных] Тип: ${data.type}`, "DATA");
        }
        handleNetworkData(data);
    });

    conn.on('close', () => {
        logToScreen("Сетевой тоннель закрыт удаленным игроком.", "WARN");
        alert("Соединение с игроком разорвано.");
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
