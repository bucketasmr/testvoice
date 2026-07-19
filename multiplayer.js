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

// Проверяем, зашел ли игрок по ссылке-приглашению
const urlParams = new URLSearchParams(window.location.search);
const inviteRoomId = urlParams.get('room');

if (inviteRoomId) {
    // Если ссылка содержит ID, значит это Игрок 2
    roomId = inviteRoomId;
    btnCreate.style.display = 'none';
    joinSection.style.display = 'block';
    statusEl.innerText = "Готов к подключению к Хосту";
} else {
    statusEl.innerText = "Создайте комнату и отправьте ссылку другу";
}

btnCreate.addEventListener('click', createRoom);
btnJoin.addEventListener('click', joinRoom);
btnShare.addEventListener('click', shareLink);

function createRoom() {
    isHost = true;
    btnCreate.disabled = true;
    statusEl.innerText = "Генерация комнаты...";

    peer = new Peer(); 
    
    peer.on('open', (id) => {
        roomId = id;
        btnCreate.style.display = 'none';
        btnShare.style.display = 'block';
        statusEl.innerText = "Комната создана! Поделитесь ссылкой.";
        
        // Автоматически генерируем инвайт-ссылку
        const inviteLink = `${window.location.origin}${window.location.pathname}?room=${id}`;
        console.log("Ссылка для друга:", inviteLink);
    });

    peer.on('connection', (connection) => {
        conn = connection;
        setupConnection();
    });
    
    peer.on('error', (err) => {
        alert("Ошибка сети: " + err.type);
        btnCreate.disabled = false;
    });
}

function shareLink() {
    const inviteLink = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    
    // Используем нативное меню "Поделиться" на iPhone (Share Sheet)
    if (navigator.share) {
        navigator.share({
            title: 'Сыграем в Rocket Tennis?',
            text: 'Заходи в мою комнату, сыграем матч!',
            url: inviteLink
        }).catch(console.error);
    } else {
        // Запасной вариант, если открыто не в Safari/Chrome
        navigator.clipboard.writeText(inviteLink);
        alert("Ссылка скопирована в буфер обмена! Отправь её другу в мессенджер.");
    }
}

function joinRoom() {
    btnJoin.disabled = true;
    statusEl.innerText = "Подключение к игре...";

    peer = new Peer();
    peer.on('open', () => {
        conn = peer.connect(roomId);
        setupConnection();
    });

    peer.on('error', (err) => {
        alert("Не удалось подключиться. Возможно, хост закрыл игру.");
        btnJoin.disabled = false;
    });
}

function setupConnection() {
    conn.on('open', () => {
        statusEl.innerText = "Матч начинается!";
        menuEl.style.display = 'none';
        initGame(); // Запуск рендера из game.js
    });

    conn.on('data', (data) => {
        handleNetworkData(data);
    });

    conn.on('close', () => {
        alert("Соединение разорвано.");
        window.location.reload();
    });
}

function sendNetData(data) {
    if (conn && conn.open) {
        conn.send(data);
    }
}
