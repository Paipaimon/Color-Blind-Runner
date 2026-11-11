/** Explicit public roots, with canonical path validation before every read. */
export declare function readPublicFile(url: string): Promise<{
    data: Buffer;
    mime: string;
}>;
export declare class GameServer {
    private httpServer;
    private wss;
    private roomManager;
    private visibility;
    private gameLoop;
    private connections;
    private playerSockets;
    private countdownTimers;
    private heartbeat;
    readonly ready: Promise<void>;
    constructor(port?: number, host?: string);
    get port(): number;
    private handleHttp;
    private connect;
    private join;
    private leave;
    private broadcastLobby;
    private startCountdown;
    private project;
    private send;
    private error;
    private broadcast;
    close(): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map