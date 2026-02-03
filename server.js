// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path'); // 引入 path 模組

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- 關鍵修正：設定靜態檔案路徑 ---
// 使用 path.join 確保在雲端 Linux 環境也能正確找到 public 資料夾
app.use(express.static(path.join(__dirname, 'public')));

// --- 關鍵修正：明確指定路由 ---
// 如果有人訪問首頁 '/'，明確回傳 public/index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 如果有人訪問 '/admin'，明確回傳 public/admin.html
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// --- 遊戲變數 ---
let gameState = 'WAITING';
let players = {}; 
let winners = [];
const GOAL_CLICKS = 60; 
const GRACE_PERIOD = 400; 
let lastLightChangeTime = 0;

io.on('connection', (socket) => {
    // 玩家加入
    socket.on('join-game', (name) => {
        players[socket.id] = {
            id: socket.id,
            name: name,
            progress: 0,
            status: 'ALIVE', 
            finishTime: null
        };
        socket.emit('init-game', { state: gameState });
        io.emit('update-admin', { players, winners });
    });

    // --- 主控端指令 ---
    socket.on('admin-reset', () => {
        gameState = 'WAITING';
        winners = [];
        for (let id in players) {
            players[id].progress = 0;
            players[id].status = 'ALIVE';
            players[id].finishTime = null;
        }
        io.emit('game-reset');
        io.emit('update-admin', { players, winners });
    });

    socket.on('admin-change-light', (color) => {
        if (gameState === 'ENDED') return;
        gameState = color;
        lastLightChangeTime = Date.now();
        io.emit('light-change', color);
    });

    // --- 玩家端指令 ---
    socket.on('player-move', () => {
        const player = players[socket.id];
        if (!player || player.status === 'DEAD' || gameState === 'ENDED' || player.status === 'FINISHED') return;

        const now = Date.now();
        if (gameState === 'RED') {
            if (now - lastLightChangeTime > GRACE_PERIOD) {
                player.status = 'DEAD';
                socket.emit('you-died'); 
                io.emit('update-admin', { players, winners });
            }
            return;
        }

        if (gameState === 'GREEN') {
            player.progress += 1; 
            if (player.progress >= GOAL_CLICKS) {
                player.progress = GOAL_CLICKS;
                player.status = 'FINISHED';
                if (!winners.find(w => w.id === player.id)) {
                    player.finishTime = getFormattedTime();
                    winners.push(player);
                    io.emit('player-finished', player);
                    if (winners.length >= 3) {
                        gameState = 'ENDED';
                        io.emit('game-over', winners);
                    }
                }
            }
            socket.emit('progress-update', (player.progress / GOAL_CLICKS) * 100);
        }
        io.emit('update-admin', { players, winners });
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('update-admin', { players, winners });
    });
});

function getFormattedTime() {
    const now = new Date();
    const t = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return t.toISOString().split('T')[1].slice(0, 12);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));