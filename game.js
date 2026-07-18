const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Настройка размеров под экран смартфона
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Состояние игры
let playerPaddle = { x: 0, y: 0, targetX: 0, targetY: 0, w: 100, h: 60 };
let enemyPaddle = { x: 0, y: 0, w: 100, h: 60 };
let ball = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, radius: 15 };

// Эффекты
let ballTrail = [];
let particles = [];
let goalFlash = 0;
let score = { me: 0, enemy: 0 };

// Инициализация игры после подключения
function initGame() {
    resetBall();
    animate();
}

function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.z = 200; // Расстояние от экрана (глубина)
    if (isHost) {
        ball.vx = (Math.random() - 0.5) * 10;
        ball.vy = (Math.random() - 0.5) * 5;
        ball.vz = -6; // Летит к экрану оппонента
    }
}

// Тач-управление для iPhone
canvas.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    // Переводим координаты пальца в цель для ракетки
    playerPaddle.targetX = touch.clientX - playerPaddle.w / 2;
    playerPaddle.targetY = touch.clientY - playerPaddle.h / 2;
}, { passive: true });

function handleNetworkData(data) {
    if (data.type === 'move') {
        // Отражаем координаты соперника по горизонтали, так как смотрим друг на друга
        enemyPaddle.x = canvas.width - data.x - enemyPaddle.w;
        enemyPaddle.y = data.y;
    }
    if (!isHost && data.type === 'ball') {
        // Клиент получает позицию мяча от Хоста (инвертируем Z и X)
        ball.x = canvas.width - data.x;
        ball.y = data.y;
        ball.z = 1000 - data.z; // Зеркалим глубину
        ball.radius = data.r;
    }
    if (data.type === 'hit') {
        createExplosion(data.x, data.y, '#00ffcc');
    }
    if (data.type === 'goal') {
        goalFlash = 30;
        score = data.score;
    }
}

function createExplosion(x, y, color) {
    for (let i = 0; i < 20; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 15,
            alpha: 1,
            color: color || '#ff6600'
        });
    }
}

// Главный цикл игры
function animate() {
    requestAnimationFrame(animate);

    // Сглаживание движения ракетки (идеально для тача)
    playerPaddle.x += (playerPaddle.targetX - playerPaddle.x) * 0.3;
    playerPaddle.y += (playerPaddle.targetY - playerPaddle.y) * 0.3;

    // Отправляем свои координаты сопернику
    sendNetData({ type: 'move', x: playerPaddle.x, y: playerPaddle.y });

    // Расчет физики (делает только Хост)
    if (isHost) {
        ball.x += ball.vx;
        ball.y += ball.vy;
        ball.z += ball.vz;

        // Стенки корта (боковые)
        if (ball.x - ball.radius < 0 || ball.x + ball.radius > canvas.width) ball.vx *= -1;
        if (ball.y - ball.radius < 100 || ball.y + ball.radius > canvas.height - 100) ball.vy *= -1;

        // Шкала глубины Z от 0 (наш экран) до 1000 (экран врага)
        // Проверка удара Игрока 1 (ближний экран Z <= 0)
        if (ball.z <= 0) {
            if (ball.x > playerPaddle.x && ball.x < playerPaddle.x + playerPaddle.w &&
                ball.y > playerPaddle.y && ball.y < playerPaddle.y + playerPaddle.h) {
                ball.vz *= -1.1; // Отскок с ускорением
                ball.vx += (ball.x - (playerPaddle.x + playerPaddle.w/2)) * 0.2; // Крученый удар
                sendNetData({ type: 'hit', x: ball.x, y: ball.y });
                createExplosion(ball.x, ball.y, '#007aff');
            } else {
                // Гол нам
                score.enemy++;
                sendNetData({ type: 'goal', score: score });
                goalFlash = 30;
                resetBall();
            }
        }

        // Проверка удара Игрока 2 (дальний экран Z >= 1000)
        if (ball.z >= 1000) {
            // Переводим координаты для проверки на стороне хоста
            let eX = canvas.width - enemyPaddle.x - enemyPaddle.w;
            if (ball.x > eX && ball.x < eX + enemyPaddle.w &&
                ball.y > enemyPaddle.y && ball.y < enemyPaddle.y + enemyPaddle.h) {
                ball.vz *= -1.1;
                ball.vx += (ball.x - (eX + enemyPaddle.w/2)) * 0.2;
                sendNetData({ type: 'hit', x: ball.x, y: ball.y });
                createExplosion(ball.x, ball.y, '#34c759');
            } else {
                // Гол сопернику
                score.me++;
                sendNetData({ type: 'goal', score: score });
                goalFlash = 30;
                resetBall();
            }
        }

        // Хост транслирует мяч клиенту
        sendNetData({ type: 'ball', x: ball.x, y: ball.y, z: ball.z, r: ball.radius });
    }

    // Расчет размера мяча на экране на основе Z (псевдо-3D)
    // Чем ближе мяч (Z меньше для нас), тем он больше
    let displayRadius = ball.radius * (1 + (1000 - ball.z) / 300);
    if (!isHost) {
        displayRadius = ball.radius * (1 + ball.z / 300);
    }

    // Запись шлейфа мяча (в стиле Rocket League)
    ballTrail.push({ x: ball.x, y: ball.y, r: displayRadius });
    if (ballTrail.length > 12) ballTrail.shift();

    // --- ОТРИСОВКА ---
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Рисуем 3D-корт (сетка перспективы)
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 100); ctx.lineTo(canvas.width, 100);
    ctx.moveTo(0, canvas.height - 100); ctx.lineTo(canvas.width, canvas.height - 100);
    ctx.stroke();

    // Рисуем шлейф мяча
    ballTrail.forEach((t, index) => {
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 136, 0, ${index / ballTrail.length * 0.4})`;
        ctx.fill();
    });

    // Рисуем мяч
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, displayRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ffaa00';
    ctx.fill();
    ctx.shadowBlur = 0; // Сброс тени

    // Рисуем ракетку врага (полупрозрачная, так как она вдалеке)
    ctx.fillStyle = 'rgba(255, 5b, 5b, 0.6)';
    ctx.fillRect(enemyPaddle.x, enemyPaddle.y, enemyPaddle.w, enemyPaddle.h);

    // Рисуем нашу ракетку (на переднем плане)
    ctx.fillStyle = 'rgba(0, 122, 255, 0.8)';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.fillRect(playerPaddle.x, playerPaddle.y, playerPaddle.w, playerPaddle.h);
    ctx.strokeRect(playerPaddle.x, playerPaddle.y, playerPaddle.w, playerPaddle.h);

    // Рисуем частицы (взрывы)
    particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.alpha -= 0.03;
        if (p.alpha <= 0) particles.splice(i, 1);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fillRect(p.x, p.y, 6, 6);
    });
    ctx.globalAlpha = 1.0; // Сброс альфы

    // Эффект гола (вспышка экрана)
    if (goalFlash > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${goalFlash / 30})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        goalFlash--;
    }

    // Счет
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`${score.me} : ${score.enemy}`, canvas.width / 2 - 25, 50);
}
