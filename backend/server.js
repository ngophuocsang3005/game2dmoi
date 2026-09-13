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
    p1: { x: 50, y: 240, hp: 5, active: false, isAttacking: false, isBlocking: false, direction: 1, hitTimer: 0 },
    p2: { x: 370, y: 240, hp: 5, active: false, isAttacking: false, isBlocking: false, direction: -1, hitTimer: 0 }
};

let sharinganSkill = { active: false, x: 0, y: 0, angle: 0 };

io.on('connection', (socket) => {
    // Gửi trạng thái ban đầu khi kết nối
    socket.emit('init_state', { gameState, sharinganSkill });

    socket.on('send_message', (data) => {
        io.emit('receive_message', data);
    });

    socket.on('select_role', (role) => {
        if (gameState[role]) {
            gameState[role].active = true;
            io.emit('role_selected', { role, gameState });
        }
    });

    // Cập nhật di chuyển
    socket.on('update_player', (data) => {
        if (data.role && gameState[data.role]) {
            gameState[data.role] = { ...gameState[data.role], ...data.data };
            socket.broadcast.emit('player_updated', data);
        }
    });

    // XỬ LÝ ĐÁNH THƯỜNG
    socket.on('attack', (attackerRole) => {
        let defenderRole = (attackerRole === 'p1') ? 'p2' : 'p1';
        let attacker = gameState[attackerRole];
        let defender = gameState[defenderRole];

        attacker.isAttacking = true;
        
        let dist = Math.abs((attacker.x + 40) - (defender.x + 40));
        if (dist <= 90 && !defender.isBlocking) {
            defender.hp = Math.max(0, defender.hp - 1);
            defender.hitTimer = 30; // Tạo hiệu ứng giật chớp đỏ
            defender.x += attacker.direction * 15;
        }

        io.emit('game_state_sync', { gameState, attackerRole });

        setTimeout(() => {
            attacker.isAttacking = false;
            io.emit('game_state_sync', { gameState });
        }, 250);
    });

    // XỬ LÝ SKILL SHARINGAN
    socket.on('trigger_sharingan', () => {
        sharinganSkill.active = true;
        let defender = gameState.p2;

        if (!defender.isBlocking) {
            defender.hp = Math.max(0, defender.hp - 1);
            defender.hitTimer = 30;
        }

        io.emit('sharingan_activated', { gameState, sharinganSkill });

        setTimeout(() => {
            sharinganSkill.active = false;
            io.emit('sharingan_deactivated', { sharinganSkill });
        }, 2000);
    });

    // RESTART GAME
    socket.on('restart_game', () => {
        gameState.p1 = { x: 50, y: 240, hp: 5, active: gameState.p1.active, isAttacking: false, isBlocking: false, direction: 1, hitTimer: 0 };
        gameState.p2 = { x: 370, y: 240, hp: 5, active: gameState.p2.active, isAttacking: false, isBlocking: false, direction: -1, hitTimer: 0 };
        sharinganSkill.active = false;
        io.emit('game_restarted', { gameState, sharinganSkill });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});