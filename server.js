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

let waitingUser = null;

io.on('connection', (socket) => {
    socket.partner = null;

    socket.on('find-partner', () => {
        if (socket.partner) return; 

        if (waitingUser && waitingUser.id !== socket.id) {
            socket.partner = waitingUser;
            waitingUser.partner = socket;

            socket.emit('partner-found', { initiator: true });
            waitingUser.emit('partner-found', { initiator: false });

            waitingUser = null;
        } else {
            waitingUser = socket;
        }
    });

    socket.on('offer', (data) => {
        if (socket.partner) socket.partner.emit('offer', data);
    });

    socket.on('answer', (data) => {
        if (socket.partner) socket.partner.emit('answer', data);
    });

    socket.on('ice-candidate', (data) => {
        if (socket.partner) socket.partner.emit('ice-candidate', data);
    });

    socket.on('skip', () => {
        handleDisconnect(socket);
        socket.emit('skipped');
    });

    socket.on('disconnect', () => {
        handleDisconnect(socket);
    });
});

function handleDisconnect(socket) {
    if (socket.partner) {
        socket.partner.emit('partner-disconnected');
        socket.partner.partner = null;
        socket.partner = null;
    }
    if (waitingUser && waitingUser.id === socket.id) {
        waitingUser = null;
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
});
                
