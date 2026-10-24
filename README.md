# Zero-Knowledge End-to-End Encryption (E2EE) SDK & Telehealth Suite

A zero-knowledge client-side encryption framework featuring WebCrypto API key derivation, hardware/browser-isolated non-exportable cryptographic vaults (IndexedDB), and a stateless Node.js WebSocket router.

---

## 📌 Executive Summary & Architecture

Modern cloud communication relays frequently expose user communications to insider threats, man-in-the-middle attacks, and cloud subpoena disclosures. This project implements a true **Zero-Knowledge Architecture**:
- Cryptographic keys are generated strictly in-browser via the **WebCrypto API**.
- Private keys are non-exportable and permanently isolated inside **IndexedDB**.
- The intermediate **Cloud Router (Node.js + Socket.io)** acts solely as a blind packet switch; it holds no decryption keys and routes exclusively opaque ciphertexts.

```
+-----------------------------------------------------------------------------------+
|                                CLIENT RUNTIME A                                   |
|  [Host UI] ---> [WebCrypto Engine: AES-256-GCM] ---> [IndexedDB (Private Keys)]   |
+----------------------------------------+------------------------------------------+
                                         | (Ciphertext + 96-bit IV)
                                         v
+-----------------------------------------------------------------------------------+
|                        STATELESS CLOUD ROUTER (Node.js)                           |
|       - Inspects only recipient identity (to: "Bob")                              |
|       - Zero access to plaintext or session derivation keys                       |
|       - Ephemeral in-memory fallback queue for offline buffering                  |
+----------------------------------------+------------------------------------------+
                                         | (Blind Packet Relay)
                                         v
+-----------------------------------------------------------------------------------+
|                                CLIENT RUNTIME B                                   |
|  [IndexedDB (Private Keys)] ---> [WebCrypto Engine: Decrypt] ---> [Host UI]      |
+-----------------------------------------------------------------------------------+
```

---

## 🔐 Cryptographic Foundation

### 1. Key Agreement: Elliptic-Curve Diffie-Hellman (ECDH)
Users establish shared session keys without exposing private material over the network.
- Base Curve: **NIST P-256** ($secp256r1$).
- Base generator point: $G$.
- Alice has secret scalar $a$; Public key: $A = a \cdot G$.
- Bob has secret scalar $b$; Public key: $B = b \cdot G$.
- Both derive the identical shared secret scalar $S$:
  $$S = a \cdot B = a \cdot (b \cdot G) = b \cdot (a \cdot G) = b \cdot A$$

### 2. Authenticated Symmetric Encryption: AES-256-GCM
- **256-Bit Key Space:** Derived from the ECDH shared secret via internal KDF.
- **Unique IV (Initialization Vector):** 96-bit cryptographically secure random value generated for every single message (`window.crypto.getRandomValues`), preventing replay attacks and pattern recognition.
- **Galois/Counter Mode (GCM) Authentication Tag:** Guarantees payload integrity and authenticity. Any bit modified during network transit immediately voids the integrity tag and causes decryption rejection.

---

## 📂 Repository Structure

```
├── zk-e2ee-sdk/         # Core TypeScript SDK Package (WebCrypto + IndexedDB + Socket client)
│   ├── src/             # Source TypeScript files
│   ├── tsconfig.json    # TypeScript compiler configuration
│   └── package.json     # Package manifests
│
├── zk-cloud-router/     # Blind message relay and public-key directory (Node.js)
│   ├── server.js        # Socket.io stateless relay & buffering logic
│   └── package.json
│
├── demo_app/            # "SecureMed" Telehealth clinical demonstration app (Vite)
│   ├── index.html       # Clinical portal interface + Live In-Flight Packet Inspector
│   ├── main.js          # Client driver consuming zk-e2ee-sdk
│   └── package.json
│
└── .gitignore           # Git ignore definitions
```

---

## 🚀 Setup & Execution Guide

### Prerequisites
- Node.js (v18.0.0 or higher)
- npm (v9.0.0 or higher)

---

### Step 1: Compile the Core SDK
Navigate to the SDK directory and compile the TypeScript source into the distribution bundle:
```bash
cd zk-e2ee-sdk
npm install
npx tsc
```
This generates the `dist/` directory containing the compiled JavaScript and type declarations (`.d.ts`).

---

### Step 2: Start the Stateless Cloud Router
Open a dedicated terminal to launch the blind message relay:
```bash
cd zk-cloud-router
npm install
node server.js
```
The router will start listening on `http://localhost:4000`.

---

### Step 3: Launch the "SecureMed" Telehealth Demonstration
Open another terminal to serve the clinical portal:
```bash
cd demo_app
npm install
npm run dev
```

1. Open **two independent browser windows** side-by-side at `http://localhost:5173`.
2. Window 1: Initialize identity as **"Dr. Alice"**.
3. Window 2: Initialize identity as **"Patient Bob"**.
4. In Dr. Alice's window, choose **Patient Bob** from the peer selection dropdown.
5. Transmit a confidential medical note.

---

## 🔍 Verification & Demonstration Notes

1. **Live Inspector Panel:** The right-hand column of the demo portal displays the in-flight packet payload, exposing the raw 96-bit IV and AES-GCM ciphertext bytes.
2. **Server Console:** Check the `zk-cloud-router` terminal window; the server will log incoming relay packets showing only recipient metadata and opaque byte arrays with zero access to plaintext.
3. **Browser DevTools (F12):** Navigate to `Network -> WS -> Messages` to confirm that packets emitted over the WebSocket interface are completely encrypted prior to hitting the network adapter.