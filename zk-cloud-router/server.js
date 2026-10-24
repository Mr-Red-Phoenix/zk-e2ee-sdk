// server.js (Zero external service dependencies)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// In-memory mappings (No Redis needed)
const activeClients = new Map(); // userId -> { socketId, publicKey }
const offlineQueue = new Map();  // userId -> Array of queued packets

io.on('connection', (socket) => {
    socket.on('register_identity', ({ userId, publicKey }) => {
        activeClients.set(userId, { socketId: socket.id, publicKey });
        console.log(`[Directory] Registered user: ${userId}`);

        // Broadcast current directory to all connected clients
        const publicDirectory = Array.from(activeClients.entries()).map(([id, data]) => ({
            userId: id,
            publicKey: data.publicKey
        }));
        io.emit('directory_sync', publicDirectory);

        // Flush any buffered offline messages for this user
        if (offlineQueue.has(userId)) {
            const messages = offlineQueue.get(userId);
            messages.forEach((packet) => {
                socket.emit('incoming_secure_payload', packet);
            });
            offlineQueue.delete(userId);
            console.log(`[Queue] Flushed ${messages.length} offline message(s) to ${userId}`);
        }
    });

    // Inside server.js: Replace the transmit_secure_payload block with this:
    socket.on('transmit_secure_payload', (packet) => {
        // ----------------------------------------------------
        // LIVE ENCRYPTION INSPECTION IN SERVER TERMINAL
        // This proves the server only sees raw bytes (zero-knowledge)
        // ----------------------------------------------------
        console.log('\n================== RELAY PACKET INTERCEPTED ==================');
        console.log(`[Time]      : ${new Date().toLocaleTimeString()}`);
        console.log(`[Routing]   : ${packet.from} -> ${packet.to}`);
        console.log(`[Ciphertext]: [${packet.cryptoData.ciphertext.slice(0, 16).join(', ')} ... (${packet.cryptoData.ciphertext.length} bytes total)]`);
        console.log(`[IV Vector] : [${packet.cryptoData.iv.join(', ')}]`);
        console.log(`[Plaintext] : ZERO (Not accessible by server memory)`);
        console.log('==============================================================\n');
        const recipient = activeClients.get(packet.to);
        if (recipient) {
            // Blindly route to recipient socket
            io.to(recipient.socketId).emit('incoming_secure_payload', packet);
        } else {
            // Buffer offline if recipient is not connected
            if (!offlineQueue.has(packet.to)) {
                offlineQueue.set(packet.to, []);
            }
            offlineQueue.get(packet.to).push(packet);
            console.log(`[Queue] Buffered offline packet for ${packet.to}`);
        }
    });

    socket.on('disconnect', () => {
        for (let [userId, data] of activeClients.entries()) {
            if (data.socketId === socket.id) {
                activeClients.delete(userId);
                console.log(`[Directory] Disconnected user: ${userId}`);
            }
        }
    });
});

server.listen(4000, () => {
    console.log('Zero-Knowledge Router running on http://localhost:4000 (No Redis required)');
});