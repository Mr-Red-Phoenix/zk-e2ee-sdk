// src/index.ts
import { io, Socket } from 'socket.io-client';

export class ZkEncryptionSDK {
    private userId: string;
    private socket: Socket;
    private sessionKeys: Map<string, CryptoKey> = new Map();
    private dbName: string;
    private keyPair!: CryptoKeyPair;

    constructor(userId: string, serverUrl: string) {
        this.userId = userId;
        this.dbName = `zk_vault_${userId}`;
        this.socket = io(serverUrl);
    }

    // Encapsulated IndexedDB Storage
    private async initVault(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = (e: any) => {
                e.target.result.createObjectStore('keys', { keyPath: 'type' });
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // WebCrypto API Identity Generation
    public async connect(): Promise<void> {
        this.keyPair = await window.crypto.subtle.generateKey(
            { name: "ECDH", namedCurve: "P-256" },
            false, // Non-exportable private key[cite: 23]
            ["deriveKey"]
        );

        const db = await this.initVault();
        const tx = db.transaction('keys', 'readwrite');
        tx.objectStore('keys').put({ type: 'private', key: this.keyPair.privateKey });

        const exportedPubKey = await window.crypto.subtle.exportKey("jwk", this.keyPair.publicKey);
        this.socket.emit('register_identity', { userId: this.userId, publicKey: exportedPubKey });
    }

    // Establish Peer Connection
    public async establishSession(peerId: string, peerPublicKeyJwk: JsonWebKey): Promise<void> {
        const importedPeerKey = await window.crypto.subtle.importKey(
            "jwk", peerPublicKeyJwk,
            { name: "ECDH", namedCurve: "P-256" },
            true, []
        );

        const sessionKey = await window.crypto.subtle.deriveKey(
            { name: "ECDH", public: importedPeerKey },
            this.keyPair.privateKey,
            { name: "AES-GCM", length: 256 },
            false, ["encrypt", "decrypt"]
        );

        this.sessionKeys.set(peerId, sessionKey);
    }

    // Encrypt and Transmit
    public async sendSecureMessage(peerId: string, plaintext: string): Promise<void> {
        const key = this.sessionKeys.get(peerId);
        if (!key) throw new Error("No session established");

        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encoded = new TextEncoder().encode(plaintext);

        const ciphertextBuffer = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv }, key, encoded
        );

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
    public onMessageReceived(callback: (sender: string, message: string) => void): void {
        this.socket.on('incoming_secure_payload', async (packet) => {
            const key = this.sessionKeys.get(packet.from);
            if (!key) return;

            const iv = new Uint8Array(packet.cryptoData.iv);
            const ciphertext = new Uint8Array(packet.cryptoData.ciphertext);

            const decryptedBuffer = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv }, key, ciphertext
            );

            const plaintext = new TextDecoder().decode(decryptedBuffer);
            callback(packet.from, plaintext);
        });
    }
}