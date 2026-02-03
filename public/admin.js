const socket = io();
const greenBtn = document.getElementById('green-btn');
const redBtn = document.getElementById('red-btn');
const playerGrid = document.getElementById('player-grid');
const winnerList = document.getElementById('winner-list');
const countSpan = document.getElementById('count');

greenBtn.addEventListener('click', () => {
    socket.emit('admin-change-light', 'GREEN');
    greenBtn.style.opacity = '1';
    redBtn.style.opacity = '0.3';
});

redBtn.addEventListener('click', () => {
    socket.emit('admin-change-light', 'RED');
    greenBtn.style.opacity = '0.3';
    redBtn.style.opacity = '1';
});

socket.on('update-admin', (data) => {
    // 渲染玩家列表
    playerGrid.innerHTML = '';
    let alive = 0;
    
    // 排序：活著的 > 死的，進度高的 > 進度低的
    const list = Object.values(data.players).sort((a, b) => {
        if(a.status === 'DEAD' && b.status !== 'DEAD') return 1;
        if(a.status !== 'DEAD' && b.status === 'DEAD') return -1;
        return b.progress - a.progress;
    });

    list.forEach(p => {
        const div = document.createElement('div');
        div.className = 'p-card';
        if(p.status === 'DEAD') div.classList.add('p-dead');
        if(p.status === 'FINISHED') div.classList.add('p-win');
        
        div.innerHTML = `
            <div>${p.name}</div>
            <div style="background:#555; height:5px; margin-top:5px;">
                <div style="width:${(p.progress/60)*100}%; background:lime; height:100%"></div>
            </div>
            <div style="font-size:0.7rem">${p.status}</div>
        `;
        playerGrid.appendChild(div);
        if(p.status !== 'DEAD') alive++;
    });
    countSpan.innerText = alive;

    // 渲染贏家
    winnerList.innerHTML = data.winners.map((w, i) => 
        `<div>#${i+1} ${w.name} (${w.finishTime})</div>`
    ).join('');
});