export declare class ZkEncryptionSDK {
    private userId;
    private socket;
    private sessionKeys;
    private dbName;
    private keyPair;
    constructor(userId: string, serverUrl: string);
    private initVault;
    connect(): Promise<void>;
    establishSession(peerId: string, peerPublicKeyJwk: JsonWebKey): Promise<void>;
    sendSecureMessage(peerId: string, plaintext: string): Promise<void>;
    onMessageReceived(callback: (sender: string, message: string) => void): void;
}
//# sourceMappingURL=index.d.ts.map