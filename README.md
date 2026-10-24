# Zero-Knowledge End-to-End Encryption (E2EE) SDK & Blind Cloud Router

A lightweight, zero-knowledge cryptographic SDK for browser environments paired with a stateless WebSocket relay. The SDK handles client-side key generation, hardware/browser-level key vaulting, and message encryption before any packet reaches the wire. The cloud router operates on a zero-knowledge security model—processing strictly opaque ciphertext with zero access to private keys or decryption capabilities.

---

## Architecture Overview

```text
[ Client A (SDK Instance) ]             [ Stateless Cloud Router ]            [ Client B (SDK Instance) ]
             |                                       |                                     |
             |--- 1. Generate ECDH Keypair (P-256) ->|                                     |
             |       (Private Key -> IndexedDB)      |                                     |
             |       (Public Key -> Wire)            |--- 2. Broadcast Public Key -------->|
             |                                       |                                     |
             |                                       |<-- 3. Register Recipient Keys ------|
             |<-- 4. Receive Public Key Directory ---|                                     |
             |                                       |                                     |
             |--- 5. Derive AES-256-GCM Key          |                                     |
             |       via ECDH(Priv_A, Pub_B)         |                                     |
             |                                       |                                     |
             |--- 6. Encrypt Payload + Generate IV ->|                                     |
             |       [Ciphertext + 96-bit IV]        |                                     |
             |                                       |--- 7. Forward Opaque Bytes -------->|
             |                                       |       (Blind Transit / Zero Keys)   |
             |                                       |                                     |--- 8. Derive Shared Key
             |                                       |                                     |       via ECDH(Priv_B, Pub_A)
             |                                       |                                     |
             |                                       |                                     |--- 9. Decrypt AES-256-GCM
             |                                       |                                     |       & Verify Tag
```

---

## Cryptographic Specification

* **Key Agreement:** Elliptic-Curve Diffie-Hellman (**ECDH**) using the **NIST P-256 (`secp256r1`)** curve.
  * Scalar multiplication on elliptic curves is commutative. Both peers compute an identical symmetric master secret without transmitting sensitive key material over the network.
* **Symmetric Encryption:** **AES-256-GCM** (Galois/Counter Mode).
  * Provides authenticated encryption with associated data (AEAD) to guarantee confidentiality and ciphertext integrity.
  * Enforces a fresh, cryptographically secure **96-bit (12-byte) Initialization Vector (IV)** per transmission.
* **Key Isolation & Storage:** The browser native **WebCrypto API** (`SubtleCrypto`) generates keys with `extractable: false` restrictions where applicable, storing persistent session identities locally inside **IndexedDB**.
* **Zero-Knowledge Cloud Router:** The Node.js/Socket.io backend acts purely as a blind packet switchboard. It maps transient socket connections to identities, holds an in-memory queue for offline delivery, and inspects only routing metadata (`to`, `from`). Plaintext is inaccessible to server memory.

---

## Repository Structure

```text
ZK-E2EE-SDK/
├── src/                  # Core TypeScript cryptographic engine
│   └── index.ts          # Keygen, vaulting, ECDH derivation, AES-GCM primitives
├── dist/                 # Compiled JavaScript output
├── zk-cloud-router/      # Stateless WebSocket relay server
│   ├── server.js         # Socket.io blind message relay & peer directory
│   └── package.json
├── package.json          # Root SDK build configuration & dependencies
├── tsconfig.json         # TypeScript compiler configuration
├── .gitignore            # Git exclusion rules
├── LICENSE               # MIT License
└── README.md
```

---

## Installation & Setup

### Prerequisites
* Node.js: v18.x or later
* npm: v9.x or later

---

### 1. Build the SDK

From the root project directory:

```bash
# Install SDK development dependencies
npm install

# Compile TypeScript source into dist/
npm run build
```

---

### 2. Run the Cloud Router

In a separate terminal window:

```bash
cd zk-cloud-router

# Install router dependencies
npm install

# Start the blind relay
node server.js
```

The router will launch and listen for client WebSocket connections on `http://localhost:4000`.

---

## SDK Integration Example

Consume the compiled SDK within any frontend web client:

```javascript
import { ZkEncryptionSDK } from './dist/index.js';

// 1. Initialize SDK instance
const client = new ZkEncryptionSDK('dr_alice', 'http://localhost:4000');
await client.connect();

// 2. Register listener for decrypted incoming transmissions
client.onMessageReceived((senderId, plaintext) => {
  console.log(`[DECRYPTED MESSAGE from ${senderId}]:`, plaintext);
});

// 3. Establish session with peer and dispatch encrypted payload
await client.establishSession('patient_bob', bobPublicKey);
await client.sendSecureMessage('patient_bob', 'Confidential Medical Record');
```

---

## Verifying Zero-Knowledge Compliance

1. Connect clients to the running router.
2. Monitor the `zk-cloud-router` terminal stdout during message exchange.
3. Observe the intercepted network frame:
   * **ciphertext**: Array of raw, pseudo-random byte integers.
   * **iv**: 12-byte initialization vector.
   * **plaintext**: Completely inaccessible to the relay process.

---

## License

MIT