const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let playerPaddle = { x: 0, y: 0, targetX: 0, targetY: 0, w: 90, h: 50 };
let enemyPaddle = { x: 0, y: 0, w: 90, h: 50 };

// Целевые координаты мяча для интерполяции на стороне Клиента
let ball = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, radius: 14 };
let targetBall = { x: 0, y: 0, z: 200, r: 14 }; 

let ballTrail = [];
let particles = [];
let goalFlash = 0;
let score = { me: 0, enemy: 0 };

function initGame() {
    resizeCanvas();
    playerPaddle.targetX = canvas.width / 2 - playerPaddle.w / 2;
    playerPaddle.targetY = canvas.height * 0.75;
    resetBall();
    animate();
}

function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.z = 200;
    targetBall.x = ball.x;
    targetBall.y = ball.y;
    targetBall.z = ball.z;
    
    if (isHost) {
        ball.vx = (Math.random() - 0.5) * 6;
        ball.vy = (Math.random() - 0.5) * 3;
        ball.vz = -6; // Направление в сторону США (Клиента)
    }
}

canvas.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    playerPaddle.targetX = (touch.clientX - rect.left) - playerPaddle.w / 2;
    playerPaddle.targetY = (touch.clientY - rect.top) - playerPaddle.h / 2;
}, { passive: true });

function handleNetworkData(data) {
    if (data.type === 'move') {
        enemyPaddle.x = canvas.width - data.x - enemyPaddle.w;
        enemyPaddle.y = data.y;
    }
    if (!isHost && data.type === 'ball') {
        // Записываем новые координаты в таргет для интерполяции (сглаживание лага)
        targetBall.x = canvas.width - data.x;
        targetBall.y = data.y;
        targetBall.z = 1000 - data.z;
        targetBall.r = data.r;
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
    for (let i = 0; i < 15; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 12,
            vy: (Math.random() - 0.5) * 12,
            alpha: 1,
            color: color || '#ff6600'
        });
    }
}

function animate() {
    requestAnimationFrame(animate);

    // Сглаживание движения ракеток
    playerPaddle.x += (playerPaddle.targetX - playerPaddle.x) * 0.3;
    playerPaddle.y += (playerPaddle.targetY - playerPaddle.y) * 0.3;

    sendNetData({ type: 'move', x: playerPaddle.x, y: playerPaddle.y });

    if (isHost) {
        // Расчет физики на сервере (Хост в Украине)
        ball.x += ball.vx;
        ball.y += ball.vy;
        ball.z += ball.vz;

        if (ball.x - ball.radius < 0 || ball.x + ball.radius > canvas.width) ball.vx *= -1;
        if (ball.y - ball.radius < 50 || ball.y + ball.radius > canvas.height - 50) ball.vy *= -1;

        if (ball.z <= 0) {
            if (ball.x > playerPaddle.x && ball.x < playerPaddle.x + playerPaddle.w &&
                ball.y > playerPaddle.y && ball.y < playerPaddle.y + playerPaddle.h) {
                ball.vz *= -1.05;
                ball.vx += (ball.x - (playerPaddle.x + playerPaddle.w/2)) * 0.15;
                sendNetData({ type: 'hit', x: ball.x, y: ball.y });
                createExplosion(ball.x, ball.y, '#007aff');
            } else {
                score.enemy++;
                sendNetData({ type: 'goal', score: score });
                goalFlash = 30;
                resetBall();
            }
        }

        if (ball.z >= 1000) {
            let eX = canvas.width - enemyPaddle.x - enemyPaddle.w;
            if (ball.x > eX && ball.x < eX + enemyPaddle.w &&
                ball.y > enemyPaddle.y && ball.y < enemyPaddle.y + enemyPaddle.h) {
                ball.vz *= -1.05;
                ball.vx += (ball.x - (eX + enemyPaddle.w/2)) * 0.15;
                sendNetData({ type: 'hit', x: ball.x, y: ball.y });
                createExplosion(ball.x, ball.y, '#34c759');
            } else {
                score.me++;
                sendNetData({ type: 'goal', score: score });
                goalFlash = 30;
                resetBall();
            }
        }
        sendNetData({ type: 'ball', x: ball.x, y: ball.y, z: ball.z, r: ball.radius });
    } else {
        // Интерполяция на стороне клиента (США): плавно притягиваем мяч к последней позиции сети
        ball.x += (targetBall.x - ball.x) * 0.35;
        ball.y += (targetBall.y - ball.y) * 0.35;
        ball.z += (targetBall.z - ball.z) * 0.35;
        ball.radius = targetBall.r;
    }

    // Рендеринг псевдо-3D глубины
    let displayRadius = ball.radius * (1 + (1000 - ball.z) / 400);
    if (!isHost) {
        displayRadius = ball.radius * (1 + ball.z / 400);
    }

    ballTrail.push({ x: ball.x, y: ball.y, r: displayRadius });
    if (ballTrail.length > 8) ballTrail.shift();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Сетка
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 50); ctx.lineTo(canvas.width, 50);
    ctx.moveTo(0, canvas.height - 50); ctx.lineTo(canvas.width, canvas.height - 50);
    ctx.stroke();

    // Отрисовка шлейфа Rocket League
    ballTrail.forEach((t, index) => {
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 100, 0, ${index / ballTrail.length * 0.25})`;
        ctx.fill();
    });

    // Мяч
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, displayRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ff6400';
    ctx.fill();
    ctx.shadowBlur = 0;

    // Оппонент
    ctx.fillStyle = 'rgba(255, 59, 48, 0.4)';
    ctx.fillRect(enemyPaddle.x, enemyPaddle.y, enemyPaddle.w, enemyPaddle.h);

    // Игрок
    ctx.fillStyle = 'rgba(0, 122, 255, 0.7)';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.fillRect(playerPaddle.x, playerPaddle.y, playerPaddle.w, playerPaddle.h);
    ctx.strokeRect(playerPaddle.x, playerPaddle.y, playerPaddle.w, playerPaddle.h);

    // Эффекты взрывов
    particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.alpha -= 0.05;
        if (p.alpha <= 0) particles.splice(i, 1);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fillRect(p.x, p.y, 4, 4);
    });
    ctx.globalAlpha = 1.0;

    if (goalFlash > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${goalFlash / 30})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        goalFlash--;
    }

    // Табло
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px -apple-system, sans-serif';
    ctx.fillText(`${score.me} : ${score.enemy}`, canvas.width / 2 - 22, 35);
}
