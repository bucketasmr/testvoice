const ROOM_ID = "global-audio-bridge-ukraine-usa-2026"; 
let MY_GUEST_ID = "guest-" + Math.random().toString(36).substring(2, 9);

let peer = null;
let localStream = null;
let isMuted = false;
let isCamFullyOff = false; 
let currentFacingMode = "user"; 
let reconnectInterval = null; 
let myNickname = "User";
let isHostMode = false; 
let isReconnecting = false; 

const connectedPeers = new Set();        // Хранит медиа-вызовы (MediaConnection)
const activeDataConnections = new Set(); // Хранит дата-каналы (DataConnection)
const knownGuests = new Set();           // Используется Хостом для трекинга списка гостей

// Переменные для рисования холста
let canvas, ctx;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentStroke = [];
let drawingHistory = []; 
let redoStack = [];

const translations = {
    en: {
        title: "Global Video & Paint Chat",
        badge: "Room: World Wide",
        btnJoin: "Join Room",
        statusWait: "Click button to connect...",
        statusMicRequest: "Requesting 720p HD stream...",
        statusNetConnect: "Connecting to international network...",
        statusHostWait: "You are Host. Waiting for friends...",
        statusGuestConnect: "Connecting to host...",
        statusConnected: "Connection established!",
        statusReconnecting: "Connection lost. Reconnecting...",
        modalText: "Your browser blocked background audio. Click to activate stream.",
        btnModal: "Unmute Audio",
        btnCopied: "Copied!",
        btnCopy: "Copy Logs"
    },
    uk: {
        title: "Глобальний Відео та Малювальний Чат",
        badge: "Кімната: Весь Світ",
        btnJoin: "Увійти в кімнату",
        statusWait: "Натисніть кнопку для підключення...",
        statusMicRequest: "Запит HD потоку 720p...",
        statusNetConnect: "Підключення до міжнародної мережі...",
        statusHostWait: "Ви Хост. Очікування друзів...",
        statusGuestConnect: "Підключення до хосту...",
        statusConnected: "З'єднання встановлено!",
        statusReconnecting: "Зв'язок втрачено. Перепідключення...",
        modalText: "Ваш браузер заблокував фоновий звук. Натисніть для активації трансляції.",
        btnModal: "Увімкнути звук",
        btnCopied: "Скопійовано!",
        btnCopy: "Копіювати логи"
    },
    ru: {
        title: "Глобальный Видео и Рисовальный Чат",
        badge: "Комната: Весь Мир",
        btnJoin: "Войти в комнату",
        statusWait: "Нажмите кнопку для подключения...",
        statusMicRequest: "Запрос HD потока 720p...",
        statusNetConnect: "Подключение к международной сети...",
        statusHostWait: "Вы Хост. Ожидание друзей...",
        statusGuestConnect: "Подключение к хосту...",
        statusConnected: "Соединение установлено!",
        statusReconnecting: "Связь утеряна. Переподключение...",
        modalText: "Ваш браузер заблокировал фоновый звук. Нажмите для активации трансляции.",
        btnModal: "Включить звук",
        btnCopied: "Скопировано!",
        btnCopy: "Копировать логи"
    }
};

let currentLang = 'ru';

// DOM элементы
const joinBtn = document.getElementById('joinBtn');
const statusText = document.getElementById('statusText');
const videoGrid = document.getElementById('videoGrid');
const localVideo = document.getElementById('localVideo');
const muteBtn = document.getElementById('muteBtn');
const camOffBtn = document.getElementById('camOffBtn');
const flipCamBtn = document.getElementById('flipCamBtn');
const hostResetBtn = document.getElementById('hostResetBtn');
const chatContainer = document.getElementById('chatContainer');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendMsgBtn = document.getElementById('sendMsgBtn');
const paintContainer = document.getElementById('paintContainer');
const brushColor = document.getElementById('brushColor');
const brushSize = document.getElementById('brushSize');
const brushOpacity = document.getElementById('brushOpacity');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const clearBtn = document.getElementById('clearBtn');
const logDiv = document.getElementById('log');
const toggleLogBtn = document.getElementById('toggleLogBtn');
const logSection = document.getElementById('logSection');
const copyLogBtn = document.getElementById('copyLogBtn');
const nameSetupOverlay = document.getElementById('nameSetupOverlay');
const usernameInput = document.getElementById('usernameInput');
const saveNameBtn = document.getElementById('saveNameBtn');
const overlay = document.getElementById('audioActivationOverlay');
const audioActivateBtn = document.getElementById('audioActivateBtn');

function log(message, type = "info") {
    const timestamp = new Date().toLocaleTimeString();
    let prefix = "> ";
    if (type === "ok") prefix = "✅ OK: ";
    if (type === "error") prefix = "❌ ERROR: ";
    
    const line = document.createElement('div');
    line.className = `log-line log-${type}`;
    line.innerText = `[${timestamp}] ${prefix}${message}`;
    if (logDiv) {
        logDiv.appendChild(line);
        logDiv.scrollTop = logDiv.scrollHeight;
    }
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// Переключение языков
document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        currentLang = btn.getAttribute('data-lang');
        applyTranslations();
    });
});

function applyTranslations() {
    document.querySelector('h1').innerText = translations[currentLang].title;
    document.querySelector('.badge').innerText = translations[currentLang].badge;
    if (joinBtn && !joinBtn.disabled) joinBtn.innerText = translations[currentLang].btnJoin;
    if (audioActivateBtn) audioActivateBtn.innerText = translations[currentLang].btnModal;
    if (copyLogBtn && copyLogBtn.innerText !== "Copied!" && copyLogBtn.innerText !== "Скопійовано!" && copyLogBtn.innerText !== "Скопировано!") {
        copyLogBtn.innerText = translations[currentLang].btnCopy;
    }
    document.getElementById('txt-modal-alert').innerText = translations[currentLang].modalText;
}

window.addEventListener('DOMContentLoaded', () => {
    log("System ready.");
    applyTranslations();
    
    // Запрос никнейма перед стартом
    if (nameSetupOverlay) {
        nameSetupOverlay.style.display = 'flex';
    }
});

saveNameBtn.addEventListener('click', () => {
    const val = usernameInput.value.trim();
    if (val) myNickname = val;
    if (nameSetupOverlay) nameSetupOverlay.style.display = 'none';
    log(`Никнейм установлен: "${myNickname}"`);
});

joinBtn.addEventListener('click', async () => {
    joinBtn.disabled = true;
    statusText.innerText = translations[currentLang].statusMicRequest;
    
    try {
        log("Запрос HD потока 720p...");
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: currentFacingMode }
        });
        localVideo.srcObject = localStream;
        log("Камера и микрофон успешно получены", "ok");
    } catch (err) {
        log(`Ошибка доступа к медиа: ${err.message}. Запуск в режиме только аудио/без камеры.`, "error");
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            log("Микрофон получен (без видео)", "ok");
        } catch (e) {
            log(`Полный отказ в медиа-ресурсах: ${e.message}`, "error");
            statusText.innerText = "Media Error";
            return;
        }
    }

    initCanvas();
    statusText.innerText = translations[currentLang].statusNetConnect;
    initPeer(true); 
});

function initPeer(tryAsHost = true) {
    const targetID = tryAsHost ? ROOM_ID : MY_GUEST_ID;
    
    if (tryAsHost) {
        log(`Попытка занять глобальный узел комнаты: "${ROOM_ID}"`);
    } else {
        log(`Автоматическое перенаправление в режим Клиента (Guest)...`);
        log("Запущена процедура глубокой очистки сетевых интерфейсов WebRTC...");
    }

    peer = new Peer(targetID, {
        debug: 1,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302', url: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302', url: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302', url: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302', url: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302', url: 'stun:stun4.l.google.com:19302' }
            ]
        }
    });

    peer.on('open', (id) => {
        isReconnecting = false;
        if (tryAsHost) {
            isHostMode = true;
            log(`Узел зарегистрирован как Хост в комнате: ${id}`, "ok");
            statusText.innerText = translations[currentLang].statusHostWait;
            if (hostResetBtn) hostResetBtn.style.display = 'inline-block';
        } else {
            isHostMode = false;
            log(`Генерация гостевой ссылки. Локальный Peer ID: ${id}`, "ok");
            statusText.innerText = translations[currentLang].statusGuestConnect;
            if (hostResetBtn) hostResetBtn.style.display = 'none';
            
            // Клиент звонит на Хост
            connectToPeer(ROOM_ID);
        }
        
        // Показываем чат и холст после подключения
        if (chatContainer) chatContainer.style.display = 'flex';
        if (paintContainer) paintContainer.style.display = 'block';
        document.querySelector('.controls').style.display = 'flex';
    });

    peer.on('error', (err) => {
        if (tryAsHost && err.type === 'unavailable-id') {
            log("Зафиксирован перехват регистрации: данный ID комнаты занят Хостом.");
            peer.destroy();
            initPeer(false); // Пробуем зайти как Гость
        } else {
            log(`Критическая ошибка PeerJS: ${err.type} - ${err.message}`, "error");
            handleConnectionLoss();
        }
    });

    // Обработка входящих звонков (Медиа)
    peer.on('call', (call) => {
        log(`Входящий медиа-вызов от удаленного пира: ${call.peer}`);
        call.answer(localStream);
        setupCallHandlers(call);
    });

    // Обработка входящих дата-соединений (Чат/Холст/Служебные сообщения)
    peer.on('connection', (conn) => {
        log(`Входящий запрос синхронизации данных от ноды: ${conn.peer}`);
        setupDataHandlers(conn);
    });

    peer.on('disconnected', () => {
        log("Сигнальный сервер разорвал сессию. Попытка восстановить туннель...");
        handleConnectionLoss();
    });
    
    peer.on('close', () => {
        log("Интерфейс Peer уничтожен.");
    });
}

function handleConnectionLoss() {
    if (isReconnecting) return;
    isReconnecting = true;
    statusText.innerText = translations[currentLang].statusReconnecting;
    
    if (reconnectInterval) clearInterval(reconnectInterval);
    reconnectInterval = setInterval(() => {
        if (peer && !peer.destroyed) {
            log("Попытка переподключения сигнального моста...");
            peer.reconnect();
        } else {
            clearInterval(reconnectInterval);
            initPeer(isHostMode);
        }
    }, 5000);
}

// Функция для вызова другого участника (используется Гостями)
function connectToPeer(targetID) {
    log(`Соединение с сигнальным сервером установлено. Вызов [${targetID}]...`);
    
    // 1. Дата канал
    const conn = peer.connect(targetID, { reliable: true });
    setupDataHandlers(conn);

    // 2. Медиа канал
    if (localStream) {
        const call = peer.call(targetID, localStream);
        setupCallHandlers(call);
    }
}

function setupCallHandlers(call) {
    if (connectedPeers.has(call.peer)) return;
    connectedPeers.add(call.peer);

    call.on('stream', (remoteStream) => {
        log(`Детектированы активные пакеты удаленного MediaStream. Инжектируем видео-ноду...`, "ok");
        
        let remoteVideo = document.getElementById(`video-${call.peer}`);
        if (!remoteVideo) {
            remoteVideo = document.createElement('video');
            remoteVideo.id = `video-${call.peer}`;
            remoteVideo.autoplay = true;
            remoteVideo.playsInline = true;
            remoteVideo.setAttribute('webkit-playsinline', 'true');
            if (videoGrid) videoGrid.appendChild(remoteVideo);
        }
        
        remoteVideo.srcObject = remoteStream;
        
        // Обход автоплея на мобильных устройствах
        remoteVideo.play().catch(err => {
            log(`Обнаружен блок медиабезопасности для ${call.peer}: требуется действие клиента`, "error");
            if (overlay) overlay.style.display = 'flex';
            audioActivateBtn.onclick = () => {
                overlay.style.display = 'none';
                remoteVideo.play().catch(e => log(`Принудительный запуск не удался: ${e.message}`, "error"));
            };
        });

        statusText.innerText = translations[currentLang].statusConnected;
        log(`Аудио/Видео пайплайны работают на полной мощности`, "ok");
    });

    call.on('close', () => {
        log(`Медиа пайплайн с пиром ${call.peer} закрыт.`);
        removePeerElements(call.peer);
    });

    call.on('error', (err) => {
        log(`Ошибка медиа-канала пира ${call.peer}: ${err.message}`, "error");
        removePeerElements(call.peer);
    });
}

function setupDataHandlers(conn) {
    activeDataConnections.add(conn);

    conn.on('open', () => {
        log(`Слой Data Channel верифицирован и открыт для обмена пакетами`, "ok");
        
        // Отправляем свой никнейм новому пиру
        conn.send({ type: "nickname", name: myNickname });
        
        // ХОСТ-ЛОГИКА: координируем Mesh-сеть между гостями
        if (isHostMode) {
            // 1. Рассказываем всем старым гостям про нового гостя
            activeDataConnections.forEach(existingConn => {
                if (existingConn.peer !== conn.peer && existingConn.open) {
                    existingConn.send({ type: "new-guest-joined", peerId: conn.peer });
                }
            });
            // 2. Рассказываем новому гостю про всех уже существующих гостей в комнате
            knownGuests.forEach(existingGuestId => {
                if (existingGuestId !== conn.peer) {
                    conn.send({ type: "new-guest-joined", peerId: existingGuestId });
                }
            });
            // 3. Добавляем нового гостя в свой список трекинга
            knownGuests.add(conn.peer); 
        }
        
        // Передаем текущий холст новому пиру
        if (drawingHistory.length > 0) {
            conn.send({ type: "canvas-history", history: drawingHistory });
        }
    });

    conn.on('data', (data) => {
        if (!data || typeof data !== 'object') return;

        switch (data.type) {
            case "nickname":
                log(`Пир представился как: "${data.name}"`);
                break;
                
            case "new-guest-joined":
                // ГОСТЬ-ЛОГИКА: Получили от хоста ID другого гостя -> звоним ему напрямую
                if (!isHostMode && data.peerId && data.peerId !== peer.id) {
                    log(`Получено уведомление о госте ${data.peerId}. Установка прямой связи Mesh...`);
                    connectToPeer(data.peerId);
                }
                break;

            case "chat":
                appendChatMessage(data.sender, data.text);
                break;

            case "draw":
                remoteDraw(data);
                break;

            case "canvas-history":
                drawingHistory = data.history;
                redrawCanvas();
                break;

            case "clear-canvas":
                drawingHistory = [];
                redoStack = [];
                if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
                log("Холст очищен удаленным участником");
                break;

            case "undo-canvas":
                if (drawingHistory.length > 0) {
                    redoStack.push(drawingHistory.pop());
                    redrawCanvas();
                }
                break;

            case "redo-canvas":
                if (redoStack.length > 0) {
                    drawingHistory.push(redoStack.pop());
                    redrawCanvas();
                }
                break;

            case "remote-force-reload":
                log("Получена системная команда на жесткую перезагрузку комнаты...");
                setTimeout(() => { location.reload(); }, 300);
                break;
        }
    });

    conn.on('close', () => {
        log(`Канал данных с пиром ${conn.peer} закрыт.`);
        if (isHostMode) knownGuests.delete(conn.peer);
        removePeerElements(conn.peer);
    });

    conn.on('error', (err) => {
        log(`Ошибка дата-канала пира ${conn.peer}: ${err.message}`, "error");
        removePeerElements(conn.peer);
    });
}

function removePeerElements(peerId) {
    connectedPeers.delete(peerId);
    
    // Удаляем объект соединения из сета Data-соед.
    activeDataConnections.forEach(c => {
        if (c.peer === peerId) activeDataConnections.delete(c);
    });

    const videoEl = document.getElementById(`video-${peerId}`);
    if (videoEl) {
        videoEl.srcObject = null;
        videoEl.remove();
        log(`Видео-нода для пира ${peerId} успешно удалена из DOM дерева.`, "ok");
    }
}

// =================== ТЕКСТОВЫЙ ЧАТ ===================
sendMsgBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChatMessage(); });

function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    appendChatMessage(myNickname, text);
    chatInput.value = "";

    broadcast({ type: "chat", sender: myNickname, text: text });
}

function appendChatMessage(sender, text) {
    const msg = document.createElement('div');
    msg.className = "chat-msg";
    msg.innerHTML = `<strong style="color:#89b4fa;">${sender}:</strong> <span></span>`;
    msg.querySelector('span').innerText = text; // Защита от XSS
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// =================== РИСОВАЛЬНЫЙ ХОЛСТ ===================
function initCanvas() {
    canvas = document.getElementById('paintCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    
    log("Инициализация графической системы Canvas...");
    log("Система рисования успешно подключена к разметке", "ok");

    // Мышиные события
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    // Тач события для мобильных устройств
    canvas.addEventListener('touchstart', (e) => { const t = e.touches[0]; startDrawing(getTouchPos(t)); e.preventDefault(); });
    canvas.addEventListener('touchmove', (e) => { const t = e.touches[0]; draw(getTouchPos(t)); e.preventDefault(); });
    canvas.addEventListener('touchend', () => { stopDrawing(); });

    undoBtn.addEventListener('click', localUndo);
    redoBtn.addEventListener('click', localRedo);
    clearBtn.addEventListener('click', localClearCanvas);
}

function getTouchPos(touch) {
    const rect = canvas.getBoundingClientRect();
    // Пересчет координат с учетом масштабирования CSS
    return {
        clientX: (touch.clientX - rect.left) * (canvas.width / rect.width),
        clientY: (touch.clientY - rect.top) * (canvas.height / rect.height)
    };
}

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
}

function startDrawing(e) {
    isDrawing = true;
    const pos = e.clientX !== undefined ? getMousePos(e) : { x: e.x, y: e.y };
    lastX = pos.x;
    lastY = pos.y;
    currentStroke = [];
    redoStack = []; 
}

function draw(e) {
    if (!isDrawing) return;
    const pos = e.clientX !== undefined ? getMousePos(e) : { x: e.x, y: e.y };
    
    const drawData = {
        x0: lastX, y0: lastY,
        x1: pos.x,  y1: pos.y,
        color: brushColor.value,
        size: brushSize.value,
        opacity: brushOpacity.value
    };

    drawSegment(drawData);
    currentStroke.push(drawData);

    broadcast({ type: "draw", ...drawData });

    lastX = pos.x;
    lastY = pos.y;
}

function drawSegment(data) {
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(data.x0, data.y0);
    ctx.lineTo(data.x1, data.y1);
    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = data.opacity;
    ctx.stroke();
    ctx.globalAlpha = 1.0; // Сброс
}

function stopDrawing() {
    if (isDrawing && currentStroke.length > 0) {
        drawingHistory.push(currentStroke);
    }
    isDrawing = false;
}

function remoteDraw(data) {
    drawSegment(data);
    // Добавляем точки к истории
    if (drawingHistory.length === 0 || Array.isArray(drawingHistory[drawingHistory.length - 1])) {
        // Чтобы не ломать логику undo, создаем симуляцию мазков для входящих битовых точек
        drawingHistory.push([data]);
    } else {
        drawingHistory[drawingHistory.length - 1].push(data);
    }
}

function redrawCanvas() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawingHistory.forEach(stroke => {
        if (Array.isArray(stroke)) {
            stroke.forEach(seg => drawSegment(seg));
        }
    });
}

function localUndo() {
    if (drawingHistory.length > 0) {
        redoStack.push(drawingHistory.pop());
        redrawCanvas();
        broadcast({ type: "undo-canvas" });
    }
}

function localRedo() {
    if (redoStack.length > 0) {
        drawingHistory.push(redoStack.pop());
        redrawCanvas();
        broadcast({ type: "redo-canvas" });
    }
}

function localClearCanvas() {
    drawingHistory = [];
    redoStack = [];
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    broadcast({ type: "clear-canvas" });
    log("Холст полностью очищен локальным пользователем.");
}

// =================== ИНТЕРФЕЙС УПРАВЛЕНИЯ СТРИМОМ ===================
muteBtn.addEventListener('click', () => {
    if (!localStream) return;
    isMuted = !isMuted;
    localStream.getAudioTracks().forEach(track => track.enabled = !isMuted);
    muteBtn.innerText = isMuted ? "Unmute Mic" : "Mute Mic";
    muteBtn.style.background = isMuted ? "#f38ba8" : "#313244";
    muteBtn.style.color = isMuted ? "#11111b" : "#cdd6f4";
    log(`Состояние микрофона изменено. Muted: ${isMuted}`, "ok");
});

camOffBtn.addEventListener('click', () => {
    if (!localStream) return;
    isCamFullyOff = !isCamFullyOff;
    localStream.getVideoTracks().forEach(track => track.enabled = !isCamFullyOff);
    camOffBtn.innerText = isCamFullyOff ? "Turn Cam On" : "Turn Cam Off";
    camOffBtn.style.background = isCamFullyOff ? "#f38ba8" : "#313244";
    camOffBtn.style.color = isCamFullyOff ? "#11111b" : "#cdd6f4";
    log(`Состояние камеры изменено. Камера выключена: ${isCamFullyOff}`, "ok");
});

flipCamBtn.addEventListener('click', async () => {
    if (!localStream || isCamFullyOff) return;
    currentFacingMode = (currentFacingMode === "user") ? "environment" : "user";
    log(`Переключение камеры... Режим: ${currentFacingMode}`);

    try {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.stop();
            localStream.removeTrack(videoTrack);
        }

        const newStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: currentFacingMode }
        });
        
        const newTrack = newStream.getVideoTracks()[0];
        localStream.addTrack(newTrack);
        localVideo.srcObject = localStream;

        // Обновляем видеопоток у всех подключенных участников
        activeDataConnections.forEach(conn => {
            const peerId = conn.peer;
            if (peer && peer.connections[peerId]) {
                const calls = peer.connections[peerId].filter(c => c.type === 'media');
                calls.forEach(c => {
                    const sender = c.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                    if (sender) sender.replaceTrack(newTrack);
                });
            }
        });
        
        // Зеркальное отображение только для фронтальной камеры
        localVideo.style.transform = (currentFacingMode === "user") ? "scaleX(-1)" : "none";
        log("Камера успешно изменена прямо в текущей WebRTC сессии.", "ok");
    } catch (err) {
        log(`Не удалось переключить камеру: ${err.message}`, "error");
    }
});

if (hostResetBtn) {
    hostResetBtn.addEventListener('click', () => {
        if (!isHostMode) return;
        log("Инициирован полный сброс комнаты хостом...");
        
        broadcast({ type: "remote-force-reload" });

        setTimeout(() => {
            if (peer) peer.destroy();
            location.reload();
        }, 800);
    });
}

// Рассылка пакета данных всем активным дата-каналам
function broadcast(data) {
    activeDataConnections.forEach(conn => {
        if (conn.open) {
            try {
                conn.send(data);
            } catch(e) {
                console.error("Не удалось отправить пакет пиру:", conn.peer, e);
            }
        }
    });
}

// Вспомогательные функции логов
function fallbackCopyText(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed"; 
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        showCopiedFeedback();
    } catch (err) {
        console.error(err);
    }
    document.body.removeChild(textArea);
}

function showCopiedFeedback() {
    if (!copyLogBtn) return;
    copyLogBtn.innerText = translations[currentLang].btnCopied;
    copyLogBtn.style.borderColor = '#a6e3a1';
    copyLogBtn.style.color = '#a6e3a1';
    setTimeout(() => {
        copyLogBtn.innerText = translations[currentLang].btnCopy;
        copyLogBtn.style.borderColor = '#313244';
        copyLogBtn.style.color = '#cdd6f4';
    }, 2000);
}

if (toggleLogBtn && logSection) {
    toggleLogBtn.addEventListener('click', () => {
        if (logSection.style.display === 'none' || !logSection.style.display) {
            logSection.style.display = 'block';
            toggleLogBtn.innerText = "Hide Console Logs";
        } else {
            logSection.style.display = 'none';
            toggleLogBtn.innerText = "Show Console Logs";
        }
    });
}

if (copyLogBtn) {
    copyLogBtn.addEventListener('click', () => {
        const textToCopy = logDiv.innerText || logDiv.textContent;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textToCopy)
                .then(() => showCopiedFeedback())
                .catch(err => fallbackCopyText(textToCopy));
        } else {
            fallbackCopyText(textToCopy);
        }
    });
}
