const socket = io();
const container = document.getElementById('main-container');
const loginScreen = document.getElementById('login-screen');
const gameScreen = document.getElementById('game-screen');
const tapZone = document.getElementById('tap-zone');
const statusText = document.getElementById('status-text');
const myBar = document.getElementById('my-bar');
const deadScreen = document.getElementById('dead-screen');
const winScreen = document.getElementById('win-screen');

let isDead = false;

// 加入遊戲
document.getElementById('join-btn').addEventListener('click', () => {
    const name = document.getElementById('username').value;
    if(name) {
        socket.emit('join-game', name);
        loginScreen.style.display = 'none';
        gameScreen.style.display = 'flex';
    }
});

// 燈號改變 (視覺核心)
socket.on('light-change', (color) => {
    if(isDead) return;
    container.classList.remove('bg-green', 'bg-red');

    if(color === 'GREEN') {
        container.classList.add('bg-green');
        statusText.innerText = "跑！";
        tapZone.innerText = "快點！！！";
    } else {
        container.classList.add('bg-red');
        statusText.innerText = "停！";
        tapZone.innerText = "不准動";
        // 震動一下提醒
        if(navigator.vibrate) navigator.vibrate(200);
    }
});

// 點擊事件 (支援觸控與滑鼠)
function handleTap(e) {
    e.preventDefault(); 
    if(isDead) return;
    
    // 按壓動畫
    tapZone.style.transform = "scale(0.95)";
    setTimeout(() => tapZone.style.transform = "scale(1)", 50);

    socket.emit('player-move');
}
tapZone.addEventListener('touchstart', handleTap);
tapZone.addEventListener('mousedown', handleTap);

// 更新進度
socket.on('progress-update', (percent) => {
    myBar.style.width = percent + '%';
});

// 淘汰
socket.on('you-died', () => {
    isDead = true;
    container.classList.remove('bg-green', 'bg-red');
    container.classList.add('bg-dead');
    deadScreen.style.display = 'flex';
    if(navigator.vibrate) navigator.vibrate([500, 200, 500]);
});

// 勝利
socket.on('player-finished', (p) => {
    if(p.id === socket.id) {
        winScreen.style.display = 'flex';
    }
});

// 重置
socket.on('game-reset', () => {
    isDead = false;
    container.classList.remove('bg-green', 'bg-red', 'bg-dead');
    deadScreen.style.display = 'none';
    winScreen.style.display = 'none';
    myBar.style.width = '0%';
    statusText.innerText = "準備";
    loginScreen.style.display = 'none'; 
    gameScreen.style.display = 'flex';
});