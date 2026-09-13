const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

let gameState = {
    p1: { x: 50, y: 240, hp: 5, active: false, isAttacking: false, isBlocking: false, direction: 1, hitTimer: 0, blockHits: 0, blockBreakTimer: 0, lastSkill1: 0, lastSkill2: 0 },
    p2: { x: 370, y: 240, hp: 5, active: false, isAttacking: false, isBlocking: false, direction: -1, hitTimer: 0, blockHits: 0, blockBreakTimer: 0, lastSkill1: 0, lastSkill2: 0 }
};

let projectiles = [];
let sharinganEffects = []; // Quản lý hiệu ứng Sharingan trúng địch

io.on('connection', (socket) => {
    socket.emit('init_state', { gameState, projectiles });

    socket.on('toggle_role', (role) => {
        if (gameState[role]) {
            gameState[role].active = !gameState[role].active;
            io.emit('role_updated', { role, active: gameState[role].active, gameState });
        }
    });

    socket.on('update_player', (data) => {
        if (data.role && gameState[data.role]) {
            gameState[data.role] = { ...gameState[data.role], ...data.data };
            socket.broadcast.emit('player_updated', data);
        }
    });

    // Đánh thường
    socket.on('attack', (attackerRole) => {
        let defenderRole = (attackerRole === 'p1') ? 'p2' : 'p1';
        let attacker = gameState[attackerRole];
        let defender = gameState[defenderRole];

        attacker.isAttacking = true;
        let dist = Math.abs((attacker.x + 40) - (defender.x + 40));
        if (dist <= 90) handleDamage(attacker, defender);

        io.emit('game_state_sync', { gameState });
        setTimeout(() => {
            attacker.isAttacking = false;
            io.emit('game_state_sync', { gameState });
        }, 200);
    });

    // Chiêu 1: Kunai (Khóa chống spam ở server)
    socket.on('skill_kunai', (role) => {
        let now = Date.now();
        let p = gameState[role];
        if (now - p.lastSkill1 < 1800) return; // Chờ đủ 2s CD
        p.lastSkill1 = now;

        projectiles.push({
            id: now + Math.random(),
            type: 'kunai',
            owner: role,
            x: p.x + (p.direction === 1 ? 70 : -10),
            y: p.y + 35,
            vx: p.direction * 10,
            active: true
        });
        io.emit('projectiles_update', projectiles);
    });

    // Chiêu 2: Sharingan
    socket.on('skill_sharingan', (role) => {
        let now = Date.now();
        let p = gameState[role];
        if (now - p.lastSkill2 < 2800) return; // Chờ đủ 3s CD
        p.lastSkill2 = now;

        projectiles.push({
            id: now + Math.random(),
            type: 'sharingan',
            owner: role,
            x: p.x + (p.direction === 1 ? 70 : -10),
            y: p.y + 30,
            vx: p.direction * 8,
            active: true
        });
        io.emit('projectiles_update', projectiles);
    });

    // Va chạm đạn
    socket.on('hit_projectile', (data) => {
        let projIndex = projectiles.findIndex(p => p.id === data.projId);
        if (projIndex !== -1) {
            let proj = projectiles[projIndex];
            let defenderRole = proj.owner === 'p1' ? 'p2' : 'p1';
            let defender = gameState[defenderRole];
            let attacker = gameState[proj.owner];

            // Nếu là đạn Sharingan -> Hiện hiệu ứng ảo thuật
            if (proj.type === 'sharingan' && (!defender.isBlocking || defender.blockBreakTimer > 0)) {
                io.emit('trigger_sharingan_effect', { targetRole: defenderRole });
            }

            handleDamage(attacker, defender);
            projectiles.splice(projIndex, 1); // Xóa đạn ngay khi trúng

            io.emit('game_state_sync', { gameState });
            io.emit('projectiles_update', projectiles);
        }
    });

    function handleDamage(attacker, defender) {
        if (defender.isBlocking && defender.blockBreakTimer === 0) {
            defender.blockHits += 1;
            if (defender.blockHits >= 2) {
                defender.isBlocking = false;
                defender.blockBreakTimer = 180;
                defender.blockHits = 0;
                io.emit('block_broken', { role: (attacker === gameState.p1 ? 'p2' : 'p1') });
            }
        } else {
            defender.hp = Math.max(0, defender.hp - 1);
            defender.hitTimer = 25;
            defender.x += (attacker.direction || 1) * 15;
        }
    }

    socket.on('restart_game', () => {
        gameState.p1 = { x: 50, y: 240, hp: 5, active: gameState.p1.active, isAttacking: false, isBlocking: false, direction: 1, hitTimer: 0, blockHits: 0, blockBreakTimer: 0, lastSkill1: 0, lastSkill2: 0 };
        gameState.p2 = { x: 370, y: 240, hp: 5, active: gameState.p2.active, isAttacking: false, isBlocking: false, direction: -1, hitTimer: 0, blockHits: 0, blockBreakTimer: 0, lastSkill1: 0, lastSkill2: 0 };
        projectiles = [];
        io.emit('game_restarted', { gameState, projectiles });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));