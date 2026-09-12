const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Phục vụ các file tĩnh trong thư mục "public" (file index.html)
app.use(express.static('public'));

// Khi có một người dùng kết nối tới server
io.on('connection', (socket) => {
    console.log('Một người dùng đã kết nối:', socket.id);

    // Lắng nghe sự kiện gửi tin nhắn từ client
    socket.on('send_message', (data) => {
        // Gửi tin nhắn này tới TẤT CẢ mọi người đang kết nối
        io.emit('receive_message', data);
    });

    // Khi người dùng ngắt kết nối (đóng tab)
    socket.on('disconnect', () => {
        console.log('Người dùng đã thoát:', socket.id);
    });
});

// Chạy server trên cổng 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});