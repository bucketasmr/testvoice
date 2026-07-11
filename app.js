const ROOM_ID = "global-audio-bridge-ukraine-usa-2026"; 
const MY_GUEST_ID = "guest-" + Math.random().toString(36).substring(2, 9);

let peer = null;
let localStream = null;
let isMuted = false;
let isCamFullyOff = false; // Отслеживание полного отключения камеры
let currentFacingMode = "user"; 
let reconnectInterval = null; 
let myNickname = "User";
let isHostMode = false; // Флаг определения роли
let isReconnecting = false; // Добавьте этот флаг

const connectedPeers = new Set();
const activeDataConnections = new Set(); 

// Переменные для рисования холста
let canvas, ctx;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentStroke = [];

// База данных истории для Undo/Redo
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
        modalBtn: "Unmute Audio",
        micNeeded: "Camera/Microphone access is required!",
        errPermission: "Error: Permission denied by user.",
        errDevice: "Error: Hardware media capture failed.",
        btnCopy: "Copy Logs",
        btnCopied: "Copied!",
        btnMute: "Mute Mic",
        btnUnmute: "Unmute Mic",
        btnCamOff: "Turn Cam Off", 
        btnCamOn: "Turn Cam On",  
        namePrompt: "Enter your nickname to start:",
        namePlaceholder: "Your name...",
        chatPlaceholder: "Type a message...",
        chatSend: "Send",
        btnShowLog: "Show Console Logs",
        btnHideLog: "Hide Console Logs",
        systemLabel: "System",
        joinedChat: "joined the chat.",
        leftChat: "left the chat.",
        lblMe: "You",
        lblPeer: "Friend",
        btnClear: "🗑️ Clear"
    },
    uk: {
        title: "Глобальний HD відео та арт-чат",
        badge: "Кімната: Світ",
        btnJoin: "Увійти в кімнату",
        statusWait: "Натисніть кнопку для підключення...",
        statusMicRequest: "Запит HD потоку 720p...",
        statusNetConnect: "Підключення до міжнародної мережі...",
        statusHostWait: "Ви Хост. Очікування друзів...",
        statusGuestConnect: "З'єднання з хостом...",
        statusConnected: "Зв'язок встановлено!",
        statusReconnecting: "Зв'язок розірвано. Перепідключення...",
        modalText: "Браузер заблокував звук у фоні. Натисніть для активації потоку.",
        modalBtn: "Увімкнути звук",
        micNeeded: "Потрібен доступ до камери та мікрофона!",
        errPermission: "Помилка: Доступ відхилено користувачем.",
        errDevice: "Помилка: Не вдалося знайти пристрої захоплення.",
        btnCopy: "Скопіювати логи",
        btnCopied: "Скопійовано!",
        btnMute: "Вимкнути мік.",
        btnUnmute: "Увімкнути мік.",
        btnCamOff: "Вимкнути кам.",
        btnCamOn: "Увімкнути кам.",
        namePrompt: "Введіть ваше ім'я для старту:",
        namePlaceholder: "Ваше ім'я...",
        chatPlaceholder: "Напишіть повідомлення...",
        chatSend: "Надісл.",
        btnShowLog: "Показити консоль логів",
        btnHideLog: "Приховати консоль логів",
        systemLabel: "Система",
        joinedChat: "приєднується до чату.",
        leftChat: "покинув чат.",
        lblMe: "Ви",
        lblPeer: "Друг",
        btnClear: "🗑️ Очистити"
    },
    ru: {
        title: "Глобальный HD видео и арт-чат",
        badge: "Комната: Весь мир",
        btnJoin: "Войти в комнату",
        statusWait: "Нажмите кнопку для подключения...",
        statusMicRequest: "Запрос HD потока 720p...",
        statusNetConnect: "Подключение к международной сети...",
        statusHostWait: "Вы Хост. Ожидание друзей...",
        statusGuestConnect: "Соединение с хостом...",
        statusConnected: "Связь установлена!",
        statusReconnecting: "Связь разорвана. Переподключение...",
        modalText: "Браузер заблоковал звук в фоне. Нажмите для активации потока.",
        modalBtn: "Включить звук",
        micNeeded: "Нужен доступ к камере и микрофону!",
        errPermission: "Ошибка: Доступ отклонен пользователем.",
        errDevice: "Ошибка: Не найдены устройства захвата.",
        btnCopy: "Скопировать логи",
        btnCopied: "Скопировано!",
        btnMute: "Выключить мик.",
        btnUnmute: "Включить мик.",
        btnCamOff: "Выключить кам.",
        btnCamOn: "Включить кам.",
        namePrompt: "Введите ваше имя для старта:",
        namePlaceholder: "Ваше имя...",
        chatPlaceholder: "Напишите сообщение...",
        chatSend: "Отпр.",
        btnShowLog: "Показать консоль логов",
        btnHideLog: "Скрыть консоль логов",
        systemLabel: "Система",
        joinedChat: "присоединяется к чату.",
        leftChat: "покинул чат.",
        lblMe: "Вы",
        lblPeer: "Друг",
        btnClear: "🗑️ Очистить"
    }
};

let currentLang = 'en';

// Поиск DOM элементов
const joinBtn = document.getElementById('joinBtn');
const muteBtn = document.getElementById('muteBtn');
const camOffBtn = document.getElementById('camOffBtn');
const flipCamBtn = document.getElementById('flipCamBtn');
const statusText = document.getElementById('statusText');
const logDiv = document.getElementById('log');
const copyLogBtn = document.getElementById('copyLogBtn');
const overlay = document.getElementById('audioActivationOverlay');
const modalBtn = document.getElementById('audioActivateBtn');
const modalTxt = document.getElementById('txt-modal-alert');

const nameSetupOverlay = document.getElementById('nameSetupOverlay');
const usernameInput = document.getElementById('usernameInput');
const saveNameBtn = document.getElementById('saveNameBtn');
const txtNamePrompt = document.getElementById('txt-name-prompt');

const chatContainer = document.getElementById('chatContainer');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendMsgBtn = document.getElementById('sendMsgBtn');

const toggleLogBtn = document.getElementById('toggleLogBtn');
const logSection = document.getElementById('logSection');

const videoGrid = document.getElementById('videoGrid');
const localVideo = document.getElementById('localVideo');
const remoteVideosContainer = document.getElementById('remoteVideosContainer');

// Холст элементы
const paintContainer = document.getElementById('paintContainer');
const brushColorInput = document.getElementById('brushColor');
const brushSizeInput = document.getElementById('brushSize');
const brushOpacityInput = document.getElementById('brushOpacity');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const clearBtn = document.getElementById('clearBtn');

let logsVisible = false;

function log(msg, type = 'info') {
    let timestamp = new Date().toLocaleTimeString();
    let prefix = `[${timestamp}] `;
    if (type === 'error') prefix += `❌ ERROR: `;
    else if (type === 'success') prefix += `✅ OK: `;
    else prefix += `> `;
    
    logDiv.innerHTML += `<br><span style="color: ${type === 'error' ? '#f38ba8' : type === 'success' ? '#a6e3a1' : '#f5e0dc'}">${prefix}${msg}</span>`;
    logDiv.scrollTop = logDiv.scrollHeight;
}

function changeLanguage(lang) {
    if (!translations[lang]) return;
    currentLang = lang;

    document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
    const targetBtn = document.getElementById(`btn-${lang}`);
    if (targetBtn) targetBtn.classList.add('active');

    if (document.getElementById('txt-title')) document.getElementById('txt-title').innerText = translations[lang].title;
    if (document.getElementById('txt-badge')) document.getElementById('txt-badge').innerText = translations[lang].badge;
    if (modalBtn) modalBtn.innerText = translations[lang].modalBtn;
    if (modalTxt) modalTxt.innerText = translations[lang].modalText;
    if (txtNamePrompt) txtNamePrompt.innerText = translations[lang].namePrompt;
    if (usernameInput) usernameInput.placeholder = translations[lang].namePlaceholder;
    if (chatInput) chatInput.placeholder = translations[lang].chatPlaceholder;
    if (sendMsgBtn) sendMsgBtn.innerText = translations[lang].chatSend;
    if (document.getElementById('lbl-me')) document.getElementById('lbl-me').innerText = translations[lang].lblMe;
    if (document.getElementById('lbl-peer')) document.getElementById('lbl-peer').innerText = translations[lang].lblPeer;
    if (clearBtn) clearBtn.innerText = translations[lang].btnClear;
    
    // --- ИСПРАВЛЕННАЯ ЛОГИКА: Локализация и удержание видимости кнопки ---
    const camOffBtnElement = document.getElementById('camOffBtn');
    if (camOffBtnElement) {
        camOffBtnElement.innerText = isCamFullyOff ? translations[lang].btnCamOn : translations[lang].btnCamOff;
        
        // Если стрим уже успешно захвачен, принудительно держим кнопку видимой при смене языка
        if (localStream) {
            camOffBtnElement.style.display = 'block';
        }
    }
    // ---------------------------------------------------------------------
    
    if (toggleLogBtn) {
        toggleLogBtn.innerText = logsVisible ? translations[lang].btnHideLog : translations[lang].btnShowLog;
    }

    if (copyLogBtn && copyLogBtn.innerText !== translations.en.btnCopied && copyLogBtn.innerText !== translations.uk.btnCopied && copyLogBtn.innerText !== translations.ru.btnCopied) {
        copyLogBtn.innerText = translations[lang].btnCopy;
    }
    
    if (joinBtn && !joinBtn.disabled) joinBtn.innerText = translations[lang].btnJoin;
    if (muteBtn) {
        muteBtn.innerText = isMuted ? translations[lang].btnUnmute : translations[lang].btnMute;
    }
}
function detectDeviceLanguage() {
    const browserLang = navigator.language || navigator.userLanguage;
    const shortLang = browserLang.substring(0, 2).toLowerCase();
    if (shortLang === 'uk' || shortLang === 'ua') changeLanguage('uk');
    else if (shortLang === 'ru') changeLanguage('ru');
    else changeLanguage('en');
}

detectDeviceLanguage();

// Конфигурация холста
function initCanvas() {
    log("Initializing Canvas element...", "info");
    canvas = document.getElementById('paintCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    canvas.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', { clientX: touch.clientX, clientY: touch.clientY });
        canvas.dispatchEvent(mouseEvent);
    }, { passive: true });

    canvas.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', { clientX: touch.clientX, clientY: touch.clientY });
        canvas.dispatchEvent(mouseEvent);
    }, { passive: true });

    canvas.addEventListener('touchend', () => {
        const mouseEvent = new MouseEvent('mouseup', {});
        canvas.dispatchEvent(mouseEvent);
    }, { passive: true });
    log("Canvas drawing system successfully attached", "success");
}

function getCanvasCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    return { x, y };
}

function startDrawing(e) {
    isDrawing = true;
    const coords = getCanvasCoordinates(e);
    lastX = coords.x;
    lastY = coords.y;

    currentStroke = {
        id: "stroke-" + Math.random().toString(36).substring(2, 9),
        color: brushColorInput.value,
        size: parseInt(brushSizeInput.value),
        opacity: parseFloat(brushOpacityInput.value),
        points: [{ x: lastX, y: lastY }]
    };
}

function draw(e) {
    if (!isDrawing) return;
    const coords = getCanvasCoordinates(e);
    const x = coords.x;
    const y = coords.y;

    ctx.beginPath();
    ctx.strokeStyle = convertHexToRGBA(currentStroke.color, currentStroke.opacity);
    ctx.lineWidth = currentStroke.size;
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();

    lastX = x;
    lastY = y;
    currentStroke.points.push({ x, y });

    broadcastPaintData({
        type: 'paint-live-draw',
        color: currentStroke.color,
        size: currentStroke.size,
        opacity: currentStroke.opacity,
        from: currentStroke.points[currentStroke.points.length - 2],
        to: { x, y }
    });
}

function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
    
    if (currentStroke && currentStroke.points.length > 0) {
        drawingHistory.push(currentStroke);
        redoStack = [];

        broadcastPaintData({
            type: 'paint-commit-stroke',
            stroke: currentStroke
        });
    }
    currentStroke = null;
}

function convertHexToRGBA(hex, opacity) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function redrawCanvas() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawingHistory.forEach(stroke => {
        if (stroke.points.length < 1) return;
        ctx.beginPath();
        ctx.strokeStyle = convertHexToRGBA(stroke.color, stroke.opacity);
        ctx.lineWidth = stroke.size;
        
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
    });
}

if (undoBtn) {
    undoBtn.addEventListener('click', () => {
        if (drawingHistory.length === 0) return;
        const popped = drawingHistory.pop();
        redoStack.push(popped);
        redrawCanvas();
        log("Undo action executed", "info");
        broadcastPaintData({ type: 'paint-undo' });
    });
}

if (redoBtn) {
    redoBtn.addEventListener('click', () => {
        if (redoStack.length === 0) return;
        const popped = redoStack.pop();
        drawingHistory.push(popped);
        redrawCanvas();
        log("Redo action executed", "info");
        broadcastPaintData({ type: 'paint-redo', stroke: popped });
    });
}

if (clearBtn) {
    clearBtn.addEventListener('click', () => {
        drawingHistory = [];
        redoStack = [];
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        log("Canvas cleared locally by user", "success");
        broadcastPaintData({ type: 'paint-clear' });
    });
}

function broadcastPaintData(data) {
    activeDataConnections.forEach(conn => {
        if (conn.open) {
            conn.send(data);
        }
    });
}

if (saveNameBtn) {
    saveNameBtn.addEventListener('click', () => {
        const value = usernameInput.value.trim();
        if (value.length > 0) myNickname = value;
        nameSetupOverlay.style.display = 'none';
        log(`User identity locked: "${myNickname}"`, "success");
        initCanvas();
    });
}

if (usernameInput) {
    usernameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveNameBtn.click();
    });
}

if (toggleLogBtn) {
    toggleLogBtn.addEventListener('click', () => {
        logsVisible = !logsVisible;
        if (logsVisible) {
            logSection.style.display = 'block';
            toggleLogBtn.innerText = translations[currentLang].btnHideLog;
            logSection.scrollIntoView({ behavior: 'smooth' });
        } else {
            logSection.style.display = 'none';
            toggleLogBtn.innerText = translations[currentLang].btnShowLog;
        }
    });
}

const peerConfig = {
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun.cloudflare.com:3478' },
            { urls: 'stun:iphone-ice.apple.com:3478' }, 
            {
                urls: 'turn:openwebrtc.blockcv.com:3478?transport=udp',
                username: 'openwebrtc',
                credential: 'openwebrtcpassword'
            }
        ],
        iceCandidatePoolSize: 10,
        sdpSemantics: 'unified-plan'
    }
};

if (joinBtn) {
    joinBtn.addEventListener('click', async () => {
        joinBtn.disabled = true;
        statusText.innerText = translations[currentLang].statusMicRequest;
        log(`Requesting localized WebRTC hardware interface (Camera facingMode: ${currentFacingMode}, Resolution: 720p)...`, "info");
        
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ 
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, 
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: currentFacingMode } 
            });
            
  log("Camera and Mic hardware streams grabbed successfully", "success");
            localVideo.srcObject = localStream;
            videoGrid.style.display = 'grid';
            statusText.innerText = translations[currentLang].statusNetConnect;
            
            if (muteBtn) muteBtn.style.display = 'block';
            if (camOffBtn) camOffBtn.style.display = 'block'; // --- ТОЧЕЧНОЕ ДОБАВЛЕНИЕ ---
            if (flipCamBtn) flipCamBtn.style.display = 'block';
            
            tryToConnectAsHost();
        } catch (err) {
            log(`Media permissions crash: ${err.name} - ${err.message}`, "error");
            statusText.innerText = translations[currentLang].micNeeded;
            joinBtn.disabled = false;
        }
    });
}

if (muteBtn) {
    muteBtn.addEventListener('click', () => {
        if (!localStream) return;
        isMuted = !isMuted;
        localStream.getAudioTracks().forEach(track => track.enabled = !isMuted);
        log(`Microphone track toggled. Muted state: ${isMuted}`, "info");
        
        if (isMuted) {
            muteBtn.classList.add('muted');
            muteBtn.innerText = translations[currentLang].btnUnmute;
        } else {
            muteBtn.classList.remove('muted');
            muteBtn.innerText = translations[currentLang].btnMute;
        }
    });
}

if (flipCamBtn) {
    flipCamBtn.addEventListener('click', async () => {
        if (!localStream) return;
        
        currentFacingMode = (currentFacingMode === "user") ? "environment" : "user";
        log(`Executing camera switch -> facingMode: "${currentFacingMode}"`, "info");
    
        try {
            const tempStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: currentFacingMode }
            });
            
            const newVideoTrack = tempStream.getVideoTracks()[0];
            const oldVideoTrack = localStream.getVideoTracks()[0];
            
            localStream.removeTrack(oldVideoTrack);
            oldVideoTrack.stop();
            localStream.addTrack(newVideoTrack);
            
/// Если камера фронтальная — зеркалим её, если задняя — показываем как есть
        if (currentFacingMode === "user") {
            localVideo.style.transform = 'scaleX(-1)';
        } else {
            localVideo.style.transform = 'none';
        }
        
        localVideo.srcObject = localStream;

        if (peer && peer.connections[ROOM_ID]) {
            peer.connections[ROOM_ID].forEach(pcConnection => {
                const senders = pcConnection.peerConnection.getSenders();
                const videoSender = senders.find(s => s.track && s.track.kind === 'video');
                if (videoSender) {
                    videoSender.replaceTrack(newVideoTrack);
                    log("Active WebRTC connection stream updated with new video track source", "info");
                }
            });
        }
        log("Camera orientation flipped and initialized cleanly", "success");
    } catch (err) {
        log(`Failed to hot-swap camera tracks: ${err.message}`, "error");
    }
});
}

function tryToConnectAsHost() {
    log(`Attempting to bind global target node: "${ROOM_ID}"`, "info");
    peer = new Peer(ROOM_ID, peerConfig);
    
    peer.on('open', (id) => {
        isHostMode = true;
        log(`Successfully configured server. Node registered as Host with Room ID: ${id}`, "success");
        statusText.innerText = translations[currentLang].statusHostWait;
        
        if (chatContainer) chatContainer.style.display = 'block';
        if (paintContainer) paintContainer.style.display = 'block';
        
        const restartBtn = document.getElementById('globalRestartBtn');
        if (restartBtn) restartBtn.style.display = 'inline-block';
        
        // ХОСТ НАЧИНАЕТ СЛУШАТЬ ЗВОНКИ ПРЯМО ТУТ:
        peer.on('call', call => {
            log(`Incoming call notification from remote Peer ID: ${call.peer}`, "info");
            call.answer(localStream);
            log(`Call answered. Local stream attached to back-end pipeline`, "success");

            bindCallEvents(call);

            call.on('stream', remoteStream => {
                addMediaStream(call.peer, remoteStream);
            });
        });

        // ХОСТ НАЧИНАЕТ СЛУШАТЬ ДАТА-КАНАЛ ПРЯМО ТУТ:
        peer.on('connection', (dataConn) => {
            log(`Incoming Data connection request from node: ${dataConn.peer}`, "info");
            bindDataConnectionEvents(dataConn);
        });
    });
    
    peer.on('error', (err) => {
        log(`Host registration intercept: code "${err.type}"`, "info");
        if (err.type === 'unavailable-id') {
            log(`Room ID busy. Re-routing as Guest client to match active Host...`, "info");
            connectAsGuest();
        } else {
            log(`PeerJS network driver issue: ${err.message}`, "error");
        }
    });
}



function connectAsGuest() {
    isHostMode = false;
    
    // Если по какой-то причине объект peer еще жив — уничтожаем его
    if (peer && !peer.destroyed) {
        try { peer.destroy(); } catch(e){}
    }

    peer = new Peer(MY_GUEST_ID, peerConfig);

    peer.on('open', (id) => {
        isReconnecting = false; // Сбрасываем флаг — мы успешно в сети
        if (reconnectInterval) {
            clearInterval(reconnectInterval);
            reconnectInterval = null;
        }
        log(`Guest handshake link operational. Local Peer ID: ${id}`, "success");
        makeGuestCall(); 
    });

    peer.on('error', (err) => {
        log(`Guest network layer failure: ${err.type} - ${err.message}`, "error");
        
        // ВАЖНО: Проверьте, чтобы здесь у вас НЕ БЫЛО строки "Scheduling reconnection attempt in 3 seconds..."
        if (err.type === 'peer-unavailable' || err.type === 'network' || err.type === 'disconnect') {
            if (!isReconnecting) {
                isReconnecting = true;
                log(`Host unavailable. Arming 15s reconnection loop...`, "error");
                startReconnectionLoop(null);
            }
        }
    });
}


function makeGuestCall() {
    if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
    }
    if (peer && !peer.destroyed) {
        log(`Dialing global Room Host at endpoint: [${ROOM_ID}]`, "info");
        const call = peer.call(ROOM_ID, localStream);
        if (call) {
            log(`Call route requested. Awaiting WebRTC Media Stream negotiation...`, "info");
            bindCallEvents(call);
        }
        
        const dataConn = peer.connect(ROOM_ID);
        if (dataConn) {
            log(`Data channel requested. Spawning bidirectional synchronization bridge...`, "info");
            bindDataConnectionEvents(dataConn);
        }
    } else {
        log("Peer structural initialization missing. Re-fetching login stack...", "error");
        connectAsGuest();
    }
}


function bindCallEvents(call) {
    if (call.peerConnection) {
        log(`Attaching track event listeners to low-level RTCPeerConnection...`, "info");
        
        call.peerConnection.addEventListener('iceconnectionstatechange', () => {
            const state = call.peerConnection.iceConnectionState;
            log(`WebRTC Engine ICE Transport State shift: -> "${state}"`, "info");
            
            if (state === 'connected') {
                if (reconnectInterval) {
                    clearInterval(reconnectInterval);
                    reconnectInterval = null;
                }
                if (chatContainer) chatContainer.style.display = 'block';
                if (paintContainer) paintContainer.style.display = 'block';
                
                // Навешиваем Mesh-слушатели только ОДИН раз, проверяя, что их еще нет
                if (!isHostMode && peer) {
                    // Очищаем старые дубли, если они были, чтобы избежать лавины звонков
                    peer.off('call');
                    peer.off('connection');

                    peer.on('call', guestCall => {
                        log(`Incoming mesh-call from neighbor peer: ${guestCall.peer}`, "info");
                        guestCall.answer(localStream);
                        bindCallEvents(guestCall);
                        guestCall.on('stream', remoteStream => {
                            addMediaStream(guestCall.peer, remoteStream);
                        });
                    });
                    
                    peer.on('connection', guestConn => {
                        log(`Incoming mesh-data from neighbor peer: ${guestConn.peer}`, "info");
                        bindDataConnectionEvents(guestConn);
                    });
                }
    
                if (statusText) {
                    statusText.innerText = isHostMode ? translations[currentLang].statusHostWait : translations[currentLang].statusConnected;
                }
                log(`STUN/TURN network link resolved. Media tracks streaming actively with peer: ${call.peer}`, "success");
                
                if (drawingHistory.length > 0) {
                    log(`Syncing full drawing vector history database (${drawingHistory.length} lines) to new peer`, "info");
                    broadcastPaintData({ type: 'paint-sync-canvas', history: drawingHistory });
                }
            }
            
            if (state === 'disconnected' || state === 'failed') {
                log(`WebRTC pipeline dropped state. Handling disconnection event safely...`, "error");
                handlePeerDisconnect(call);
            }
        });
    }
    
    call.on('stream', (remoteStream) => {
        log(`Remote MediaStream track packets detected. Injecting video node...`, "success");
        addMediaStream(call.peer, remoteStream);
    });
    
    call.on('close', () => {
        log(`Stream call connection closed via signaling track event`, "info");
        handlePeerDisconnect(call);
    });

    call.on('error', (err) => {
        log(`Call-level WebRTC transport layer error: ${err.message}`, "error");
        handlePeerDisconnect(call);
    });
}
function handlePeerDisconnect(call) {
    connectedPeers.delete(call.peer);
    
    // Удаляем видео
    const videoBox = document.getElementById(`video-box-${call.peer}`);
    if (videoBox) {
        videoBox.remove();
        log(`Removed video node for disconnected peer: ${call.peer}`, "info");
    }
    
    // Очистка дата-канала (критично для стабильности сети)
    activeDataConnections.forEach(conn => {
        if (conn.peer === call.peer) activeDataConnections.delete(conn);
    });
    
    if (isHostMode) {
        if (connectedPeers.size === 0) {
            statusText.innerText = translations[currentLang].statusHostWait;
        }
        appendChatMessage(translations[currentLang].systemLabel, `A user ${translations[currentLang].leftChat}`, '#f38ba8', true);
    } else {
        // Запуск реконнекта с проверкой флага
        if (!isReconnecting) {
            isReconnecting = true; 
            log(`Host lost. Guest mode auto-reconnection sequence armed.`, "error");
            startReconnectionLoop(call);
        }
    }
}

function bindDataConnectionEvents(dataConn) {
    // Сразу добавляем открывающееся соединение в наш рабочий Set
    activeDataConnections.add(dataConn);

    dataConn.on('open', () => {
        log(`Data channel layer verified open with peer: ${dataConn.peer}`, "success");
        dataConn.send({ type: 'system-intro', name: myNickname });
    });

    dataConn.on('data', (data) => {
        if (!data || typeof data !== 'object') return;

        if (data.type === 'system-intro') {
            log(`Peer introduced identity: "${data.name}"`, "info");
            appendChatMessage(translations[currentLang].systemLabel, `${data.name} ${translations[currentLang].joinedChat}`, '#f5c2e7', true);

            const labelEl = document.getElementById(`label-${dataConn.peer}`);
            if (labelEl) labelEl.innerText = data.name;

            if (isHostMode) {
                activeDataConnections.forEach(conn => {
                    if (conn.peer !== dataConn.peer && conn.open) {
                        conn.send({
                            type: 'new-peer-alert',
                            peerId: dataConn.peer
                        });
                    }
                });
            }
        } 
        else if (data.type === 'new-peer-alert') {
            log(`New room participant discovered via Host signaling: ${data.peerId}`, "info");
            
            const call = peer.call(data.peerId, localStream);
            if (call) {
                bindCallEvents(call);
                call.on('stream', remoteStream => {
                    addMediaStream(data.peerId, remoteStream);
                });
            }
            
            const conn = peer.connect(data.peerId);
            if (conn) {
                bindDataConnectionEvents(conn);
            }
        }
        else if (data.type === 'text-message') {
            appendChatMessage(data.sender, data.text, '#b4befe', false);
        }
        else if (data.type === 'paint-live-draw') {
            if (!ctx) return;
            ctx.beginPath();
            ctx.strokeStyle = convertHexToRGBA(data.color, data.opacity);
            ctx.lineWidth = data.size;
            ctx.moveTo(data.from.x, data.from.y);
            ctx.lineTo(data.to.x, data.to.y);
            ctx.stroke();
        } else if (data.type === 'paint-commit-stroke') {
            drawingHistory.push(data.stroke);
            redoStack = []; 
        } else if (data.type === 'paint-undo') {
            if (drawingHistory.length > 0) {
                redoStack.push(drawingHistory.pop());
                redrawCanvas();
            }
        } else if (data.type === 'paint-redo') {
            drawingHistory.push(data.stroke);
            redrawCanvas();
        } else if (data.type === 'paint-sync-canvas') {
            log(`Canvas state database synchronization loaded from Host (${data.history.length} vectors)`, "success");
            drawingHistory = data.history;
            redrawCanvas();
        } else if (data.type === 'paint-clear') {
            drawingHistory = [];
            redoStack = [];
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
            log("Canvas fully flushed via synchronization signal from peer", "info");
        } 
        else if (data.type === 'remote-force-reload') {
            log("Получена команда принудительного перезапуска от хоста. Перезагрузка...", "error");
            setTimeout(() => {
                if (peer) peer.destroy();
                location.reload();
            }, 500);
        }
    });

    // ================= ТОЧЕЧНОЕ ДОБАВЛЕНИЕ: ОБРАБОТКА ЗАКРЫТИЯ КАНАЛА =================
    dataConn.on('close', () => {
        log(`Data channel closed for peer: ${dataConn.peer}`, "info");
        activeDataConnections.delete(dataConn); // Чистим память от закрытого пира
        
        // Если упала связь именно с ХОСТОМ, и мы гость — запускаем безопасный 15с реконнект
        if (!isHostMode && dataConn.peer === ROOM_ID) {
            if (!isReconnecting) {
                isReconnecting = true;
                log(`Host data link severed. Arming 15s reconnection loop...`, "error");
                startReconnectionLoop(null);
            }
        }
    });

    // ================= ТОЧЕЧНОЕ ДОБАВЛЕНИЕ: ОБРАБОТКА ОШИБОК КАНАЛА =================
    dataConn.on('error', (err) => {
        log(`Data channel layer error for peer ${dataConn.peer}: ${err.message}`, "error");
        activeDataConnections.delete(dataConn);
        
        if (!isHostMode && dataConn.peer === ROOM_ID) {
            if (!isReconnecting) {
                isReconnecting = true;
                log(`Host data link errored. Arming 15s reconnection loop...`, "error");
                startReconnectionLoop(null);
            }
        }
    });
}

function sendTextMessage() {
    const text = chatInput.value.trim();
    if (text.length === 0) return;

    appendChatMessage(myNickname, text, '#a6e3a1', false);
    chatInput.value = '';

    activeDataConnections.forEach(conn => {
        if (conn.open) {
            conn.send({ type: 'text-message', sender: myNickname, text: text });
        }
    });
}

if (sendMsgBtn) sendMsgBtn.addEventListener('click', sendTextMessage);
if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendTextMessage();
    });
}

function appendChatMessage(sender, text, nameColor = '#a6e3a1', isSystem = false) {
    const msgElement = document.createElement('div');
    if (isSystem) {
        msgElement.innerHTML = `<i style="color: #9399b2;">[${translations[currentLang].systemLabel}] ${text}</i>`;
    } else {
        msgElement.innerHTML = `<strong style="color: ${nameColor}">${sender}:</strong> <span style="color: #cdd6f4;">${escapeHTML(text)}</span>`;
    }
    if (chatMessages) {
        chatMessages.appendChild(msgElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

function escapeHTML(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function startReconnectionLoop(call) {
    // Полная зачистка ЛЮБЫХ старых таймеров
    if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
    }
    

    log("Re-indexing master loop. Reconnection daemon spawned (interval 15s)...", "info");

    reconnectInterval = setInterval(() => {
        log("Reconnection timer pulse. Pinging host room node...", "info");

        // Убиваем старый инстанс полностью перед созданием нового
        if (peer) {
            try { 
                peer.off('open');
                peer.off('error');
                peer.off('call');
                peer.off('connection');
                peer.destroy(); 
            } catch (e) { console.error(e); }
            peer = null;
        }

        connectAsGuest(); 
    }, 15000); // 15 секунд
}

function addMediaStream(peerId, stream) {
    if (connectedPeers.has(peerId)) return;
    connectedPeers.add(peerId);

    // Ищем, нет ли уже созданного окна для этого гостя
    let videoBox = document.getElementById(`video-box-${peerId}`);
    
    if (!videoBox) {
        // Создаем контейнер для нового гостя
        videoBox = document.createElement('div');
        videoBox.id = `video-box-${peerId}`;
        videoBox.className = 'video-box remote';
        
        // Создаем элемент видео
        const videoEl = document.createElement('video');
        videoEl.autoplay = true;
        videoEl.playsinline = true;
        videoEl.srcObject = stream;
        
        // Зеркалим видео гостя (как настраивали ранее)
        videoEl.style.transform = 'scaleX(-1)';
        
        // Создаем подпись под видео
        const labelEl = document.createElement('div');
        labelEl.className = 'video-label';
        labelEl.id = `label-${peerId}`;
        labelEl.innerText = translations[currentLang].lblPeer;
        
        // Собираем плитку воедино
        videoBox.appendChild(videoEl);
        videoBox.appendChild(labelEl);
        remoteVideosContainer.appendChild(videoBox);
        
        // Запускаем воспроизведение видео
        videoEl.play()
            .then(() => {
                log(`Audio/Video hardware playback pipe running at full capacity for: ${peerId}`, "success");
                statusText.innerText = translations[currentLang].statusConnected;
            })
            .catch(e => {
                log(`Media playback security block encountered for ${peerId}: Client action mandatory`, "error");
                overlay.style.display = 'flex';
            });
    } else {
        // Если контейнер уже был, просто обновляем поток внутри него
        const videoEl = videoBox.querySelector('video');
        if (videoEl) {
            videoEl.srcObject = stream;
            videoEl.play().catch(err => console.error(err));
        }
    }
}

if (modalBtn) {
    modalBtn.addEventListener('click', () => {
        overlay.style.display = 'none';
        
        // При клике на оверлей принудительно стартуем видео ВСЕХ гостей в контейнере
        const remoteVideos = remoteVideosContainer.querySelectorAll('video');
        remoteVideos.forEach(videoEl => {
            videoEl.play()
                .then(() => statusText.innerText = translations[currentLang].statusConnected)
                .catch(err => log(`Forced stream activation rejected: ${err.message}`, "error"));
        });
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

// ========================================================
// ТОЧЕЧНОЕ ДОБАВЛЕНИЕ: УПРАВЛЕНИЕ КАМЕРОЙ И ГЛОБАЛЬНЫЙ РЕСТАРТ
// ========================================================

// 1. Обработчик полного отключения видеотрека камеры
if (camOffBtn) {
    camOffBtn.addEventListener('click', () => {
        if (!localStream) return;
        
        isCamFullyOff = !isCamFullyOff;
        
        // Отключаем/включаем только видеотреки внутри нашего локального стрима
        localStream.getVideoTracks().forEach(track => {
            track.enabled = !isCamFullyOff;
        });

        // Меняем внешний вид кнопки и подтягиваем текст из словаря translations
        if (isCamFullyOff) {
            camOffBtn.style.background = '#f38ba8';
            camOffBtn.style.color = '#11111b';
            camOffBtn.innerText = translations[currentLang].btnCamOn; // Берет перевод "Включить кам." / "Turn Cam On"
            log("Видеопоток вашей камеры остановлен.", "warn");
        } else {
            camOffBtn.style.background = '';
            camOffBtn.style.color = '';
            camOffBtn.innerText = translations[currentLang].btnCamOff; // Берет перевод "Выключить кам." / "Turn Cam Off"
            log("Видеопоток вашей камеры восстановлен.", "success");
        }
    });
}

// 2. Обработчик отправки команды рестарта (доступен только для Хоста)
const globalRestartBtn = document.getElementById('globalRestartBtn');
if (globalRestartBtn) {
    globalRestartBtn.addEventListener('click', () => {
        const confirmRestart = confirm("Вы уверены, что хотите принудительно перезагрузить страницу у ВСЕХ участников?");
        if (!confirmRestart) return;

        log("Отправка сигнала глобального перезапуска всем участникам...", "warn");

        // Перебираем твой Set активных подключений: activeDataConnections
        activeDataConnections.forEach(conn => {
            if (conn.open) {
                try {
                    conn.send({ type: "remote-force-reload" });
                } catch(e) {
                    console.error("Не удалось отправить сигнал рестарта пиру:", e);
                }
            }
        });

        // Перезагружаем самого хоста с небольшой задержкой, чтобы пакеты успели уйти в сеть
        setTimeout(() => {
            if (peer) peer.destroy();
            location.reload();
        }, 800);
    });
}

// ========================================================

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
        copyLogBtn.style.borderColor = '#45475a';
        copyLogBtn.style.color = '#f5e0dc';
    }, 2000);
}
