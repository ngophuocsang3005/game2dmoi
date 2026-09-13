const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Trạng thái game chung
let gameState = {
    p1: { x: 50, y: 240, hp: 5, active: false, isAttacking: false, isBlocking: false, direction: 1 },
    p2: { x: 370, y: 240, hp: 5, active: false, isAttacking: false, isBlocking: false, direction: -1 }
};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Gửi trạng thái hiện tại cho người mới vào
    socket.emit('init_state', gameState);

    // Nhận chat từ client và gửi cho tất cả
    socket.on('send_message', (data) => {
        io.emit('receive_message', data);
    });

    // Chọn Role (Player 1 hoặc Player 2)
    socket.on('select_role', (role) => {
        if (gameState[role]) {
            gameState[role].active = true;
            io.emit('role_selected', { role, gameState });
        }
    });

    // Cập nhật vị trí & hành động liên tục
    socket.on('update_player', (data) => {
        if (data.role && gameState[data.role]) {
            gameState[data.role] = { ...gameState[data.role], ...data.data };
            // Phát vị trí mới tới TẤT CẢ người chơi khác
            socket.broadcast.emit('player_updated', data);
        }
    });

    // Reset Game
    socket.on('restart_game', () => {
        gameState.p1 = { x: 50, y: 240, hp: 5, active: gameState.p1.active, isAttacking: false, isBlocking: false, direction: 1 };
        gameState.p2 = { x: 370, y: 240, hp: 5, active: gameState.p2.active, isAttacking: false, isBlocking: false, direction: -1 };
        io.emit('game_restarted', gameState);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});