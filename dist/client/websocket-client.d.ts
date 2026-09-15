/**
 * WebSocket 客户端
 * 负责与服务器建立连接、发送/接收消息
 * Requirements: 2.5, 8.3, 8.4
 */
import { ClientMessage, ServerMessage, PlayerInput } from '../shared/messages.js';
export type MessageHandler = (message: ServerMessage) => void;
export type ConnectionHandler = () => void;
export type ErrorHandler = (error: Event) => void;
/**
 * WebSocket 客户端类
 * 封装 WebSocket 连接管理和消息收发
 */
export declare class WebSocketClient {
    private ws;
    private serverUrl;
    private messageHandlers;
    private connectHandlers;
    private disconnectHandlers;
    private errorHandlers;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private reconnectDelay;
    constructor(serverUrl: string);
    /**
     * 连接到服务器
     */
    connect(): Promise<void>;
    /**
     * 断开连接
     */
    disconnect(): void;
    /**
     * 检查是否已连接
     */
    isConnected(): boolean;
    /**
     * 发送消息到服务器
     */
    send(message: ClientMessage): void;
    /**
     * 发送玩家输入
     * Requirements: 2.5 - 客户端只发送输入命令
     */
    sendInput(input: PlayerInput): void;
    /**
     * 加入房间
     */
    joinRoom(roomId?: string, playerName?: string): void;
    /**
     * 发送准备状态
     */
    sendReady(): void;
    /**
     * 发送心跳
     */
    sendPing(): void;
    /**
     * 注册消息处理器
     * Requirements: 8.3, 8.4 - 接收服务器状态更新
     */
    onMessage(handler: MessageHandler): () => void;
    /**
     * 注册连接成功处理器
     */
    onConnect(handler: ConnectionHandler): () => void;
    /**
     * 注册断开连接处理器
     */
    onDisconnect(handler: ConnectionHandler): () => void;
    /**
     * 注册错误处理器
     */
    onError(handler: ErrorHandler): () => void;
    /**
     * 处理接收到的消息
     */
    private handleMessage;
}
//# sourceMappingURL=websocket-client.d.ts.map