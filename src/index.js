"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZkEncryptionSDK = void 0;
// src/index.ts
const socket_io_client_1 = require("socket.io-client");
class ZkEncryptionSDK {
    userId;
    socket;
    sessionKeys = new Map();
    dbName;
    keyPair;
    constructor(userId, serverUrl) {
        this.userId = userId;
        this.dbName = `zk_vault_${userId}`;
        this.socket = (0, socket_io_client_1.io)(serverUrl);
    }
    // Encapsulated IndexedDB Storage
    async initVault() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = (e) => {
                e.target.result.createObjectStore('keys', { keyPath: 'type' });
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    // WebCrypto API Identity Generation
    async connect() {
        this.keyPair = await window.crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, // Non-exportable private key[cite: 23]
        ["deriveKey"]);
        const db = await this.initVault();
        const tx = db.transaction('keys', 'readwrite');
        tx.objectStore('keys').put({ type: 'private', key: this.keyPair.privateKey });
        const exportedPubKey = await window.crypto.subtle.exportKey("jwk", this.keyPair.publicKey);
        this.socket.emit('register_identity', { userId: this.userId, publicKey: exportedPubKey });
    }
    // Establish Peer Connection
    async establishSession(peerId, peerPublicKeyJwk) {
        const importedPeerKey = await window.crypto.subtle.importKey("jwk", peerPublicKeyJwk, { name: "ECDH", namedCurve: "P-256" }, true, []);
        const sessionKey = await window.crypto.subtle.deriveKey({ name: "ECDH", public: importedPeerKey }, this.keyPair.privateKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
        this.sessionKeys.set(peerId, sessionKey);
    }
    // Encrypt and Transmit
    async sendSecureMessage(peerId, plaintext) {
        const key = this.sessionKeys.get(peerId);
        if (!key)
            throw new Error("No session established");
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encoded = new TextEncoder().encode(plaintext);
        const ciphertextBuffer = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, encoded);
        const payload = {
            from: this.userId,
            to: peerId,
            cryptoData: {
                iv: Array.from(iv),
                ciphertext: Array.from(new Uint8Array(ciphertextBuffer))
            }
        };
        this.socket.emit('transmit_secure_payload', payload);
    }
    // Listen for incoming decrypted messages
    onMessageReceived(callback) {
        this.socket.on('incoming_secure_payload', async (packet) => {
            const key = this.sessionKeys.get(packet.from);
            if (!key)
                return;
            const iv = new Uint8Array(packet.cryptoData.iv);
            const ciphertext = new Uint8Array(packet.cryptoData.ciphertext);
            const decryptedBuffer = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ciphertext);
            const plaintext = new TextDecoder().decode(decryptedBuffer);
            callback(packet.from, plaintext);
        });
    }
}
exports.ZkEncryptionSDK = ZkEncryptionSDK;
//# sourceMappingURL=index.js.map