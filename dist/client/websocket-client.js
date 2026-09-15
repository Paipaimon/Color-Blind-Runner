/**
 * WebSocket 客户端
 * 负责与服务器建立连接、发送/接收消息
 * Requirements: 2.5, 8.3, 8.4
 */
import { ClientMessageType } from '../shared/messages.js';
/**
 * WebSocket 客户端类
 * 封装 WebSocket 连接管理和消息收发
 */
export class WebSocketClient {
    ws = null;
    serverUrl;
    messageHandlers = new Set();
    connectHandlers = new Set();
    disconnectHandlers = new Set();
    errorHandlers = new Set();
    reconnectAttempts = 0;
    maxReconnectAttempts = 5;
    reconnectDelay = 1000; // 毫秒
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
    }
    /**
     * 连接到服务器
     */
    connect() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.serverUrl);
                this.ws.onopen = () => {
                    this.reconnectAttempts = 0;
                    this.connectHandlers.forEach(handler => handler());
                    resolve();
                };
                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data);
                };
                this.ws.onclose = () => {
                    this.disconnectHandlers.forEach(handler => handler());
                };
                this.ws.onerror = (error) => {
                    this.errorHandlers.forEach(handler => handler(error));
                    reject(error);
                };
            }
            catch (error) {
                reject(error);
            }
        });
    }
    /**
     * 断开连接
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
    /**
     * 检查是否已连接
     */
    isConnected() {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }
    /**
     * 发送消息到服务器
     */
    send(message) {
        if (!this.isConnected()) {
            console.warn('WebSocket 未连接，无法发送消息');
            return;
        }
        this.ws.send(JSON.stringify(message));
    }
    /**
     * 发送玩家输入
     * Requirements: 2.5 - 客户端只发送输入命令
     */
    sendInput(input) {
        const message = {
            type: ClientMessageType.PLAYER_INPUT,
            input
        };
        this.send(message);
    }
    /**
     * 加入房间
     */
    joinRoom(roomId, playerName) {
        const message = {
            type: ClientMessageType.JOIN_ROOM,
            roomId,
            playerName
        };
        this.send(message);
    }
    /**
     * 发送准备状态
     */
    sendReady() {
        const message = {
            type: ClientMessageType.READY
        };
        this.send(message);
    }
    /**
     * 发送心跳
     */
    sendPing() {
        const message = {
            type: ClientMessageType.PING,
            timestamp: Date.now()
        };
        this.send(message);
    }
    /**
     * 注册消息处理器
     * Requirements: 8.3, 8.4 - 接收服务器状态更新
     */
    onMessage(handler) {
        this.messageHandlers.add(handler);
        return () => this.messageHandlers.delete(handler);
    }
    /**
     * 注册连接成功处理器
     */
    onConnect(handler) {
        this.connectHandlers.add(handler);
        return () => this.connectHandlers.delete(handler);
    }
    /**
     * 注册断开连接处理器
     */
    onDisconnect(handler) {
        this.disconnectHandlers.add(handler);
        return () => this.disconnectHandlers.delete(handler);
    }
    /**
     * 注册错误处理器
     */
    onError(handler) {
        this.errorHandlers.add(handler);
        return () => this.errorHandlers.delete(handler);
    }
    /**
     * 处理接收到的消息
     */
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            // Requirements: 8.4 - 接收状态更新后直接传递给处理器，不做修改
            this.messageHandlers.forEach(handler => handler(message));
        }
        catch (error) {
            console.error('解析服务器消息失败:', error);
        }
    }
}
//# sourceMappingURL=websocket-client.js.map