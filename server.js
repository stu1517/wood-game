const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path'); // 引入 path 模組解決路徑問題

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 設定靜態檔案路徑 (關鍵修正)
app.use(express.static(path.join(__dirname, 'public')));

// 路由
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// --- 遊戲變數 ---
let gameState = 'WAITING'; // WAITING, GREEN, RED, ENDED
let players = {}; 
let winners = [];
const GOAL_CLICKS = 60; // 需要點擊幾下才能到終點 (可自行調整)
const GRACE_PERIOD = 400; // 毫秒 (紅燈後的寬限期，給網路延遲一點空間)
let lastLightChangeTime = 0;

io.on('connection', (socket) => {
    
    // 玩家加入
    socket.on('join-game', (name) => {
        players[socket.id] = {
            id: socket.id,
            name: name,
            progress: 0,
            status: 'ALIVE', // ALIVE, DEAD, FINISHED
            finishTime: null
        };
        socket.emit('init-game', { state: gameState });
        io.emit('update-admin', { players, winners });
    });

    // --- 主控端指令 ---

    // 重置遊戲
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

    // 切換紅綠燈
    socket.on('admin-change-light', (color) => {
        if (gameState === 'ENDED') return;
        
        gameState = color; // 'GREEN' or 'RED'
        lastLightChangeTime = Date.now();
        
        io.emit('light-change', color);
    });

    // --- 玩家端指令 ---

    // 玩家點擊移動
    socket.on('player-move', () => {
        const player = players[socket.id];
        // 如果玩家不存在、已死、或遊戲結束，忽略
        if (!player || player.status === 'DEAD' || gameState === 'ENDED' || player.status === 'FINISHED') return;

        const now = Date.now();

        // 判斷是否紅燈踩雷
        if (gameState === 'RED') {
            // 如果超過寬限期還按，就死
            if (now - lastLightChangeTime > GRACE_PERIOD) {
                player.status = 'DEAD';
                socket.emit('you-died'); 
                io.emit('update-admin', { players, winners });
            }
            return; // 紅燈時按，無論是否在寬限期，都不加分
        }

        // 綠燈時移動
        if (gameState === 'GREEN') {
            player.progress += 1; 
            
            // 檢查是否到終點
            if (player.progress >= GOAL_CLICKS) {
                player.progress = GOAL_CLICKS;
                player.status = 'FINISHED';
                
                // 紀錄名次 (前三名)
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
            // 回傳進度百分比
            socket.emit('progress-update', (player.progress / GOAL_CLICKS) * 100);
        }
        // 即時更新後台 (也可以做節流優化，但50人直接送沒問題)
        io.emit('update-admin', { players, winners });
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('update-admin', { players, winners });
    });
});

function getFormattedTime() {
    const now = new Date();
    const t = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // 轉台灣時間
    return t.toISOString().split('T')[1].slice(0, 12);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));