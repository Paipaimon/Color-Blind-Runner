/**
 * WebSocket 客户端
 * 负责与服务器建立连接、发送/接收消息
 * Requirements: 2.5, 8.3, 8.4
 */

import {
  ClientMessage,
  ServerMessage,
  ClientMessageType,
  PlayerInput,
  PlayerInputMessage,
  JoinRoomMessage,
  ReadyMessage,
  PingMessage
} from '../shared/messages.js';

// 消息处理回调类型
export type MessageHandler = (message: ServerMessage) => void;
export type ConnectionHandler = () => void;
export type ErrorHandler = (error: Event) => void;

/**
 * WebSocket 客户端类
 * 封装 WebSocket 连接管理和消息收发
 */
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private messageHandlers: Set<MessageHandler> = new Set();
  private connectHandlers: Set<ConnectionHandler> = new Set();
  private disconnectHandlers: Set<ConnectionHandler> = new Set();
  private errorHandlers: Set<ErrorHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // 毫秒

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  /**
   * 连接到服务器
   */
  connect(): Promise<void> {
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
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * 发送消息到服务器
   */
  send(message: ClientMessage): void {
    if (!this.isConnected()) {
      console.warn('WebSocket 未连接，无法发送消息');
      return;
    }
    this.ws!.send(JSON.stringify(message));
  }

  /**
   * 发送玩家输入
   * Requirements: 2.5 - 客户端只发送输入命令
   */
  sendInput(input: PlayerInput): void {
    const message: PlayerInputMessage = {
      type: ClientMessageType.PLAYER_INPUT,
      input
    };
    this.send(message);
  }

  /**
   * 加入房间
   */
  joinRoom(roomId?: string, playerName?: string): void {
    const message: JoinRoomMessage = {
      type: ClientMessageType.JOIN_ROOM,
      roomId,
      playerName
    };
    this.send(message);
  }

  /**
   * 发送准备状态
   */
  sendReady(): void {
    const message: ReadyMessage = {
      type: ClientMessageType.READY
    };
    this.send(message);
  }

  /**
   * 发送心跳
   */
  sendPing(): void {
    const message: PingMessage = {
      type: ClientMessageType.PING,
      timestamp: Date.now()
    };
    this.send(message);
  }

  /**
   * 注册消息处理器
   * Requirements: 8.3, 8.4 - 接收服务器状态更新
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /**
   * 注册连接成功处理器
   */
  onConnect(handler: ConnectionHandler): () => void {
    this.connectHandlers.add(handler);
    return () => this.connectHandlers.delete(handler);
  }

  /**
   * 注册断开连接处理器
   */
  onDisconnect(handler: ConnectionHandler): () => void {
    this.disconnectHandlers.add(handler);
    return () => this.disconnectHandlers.delete(handler);
  }

  /**
   * 注册错误处理器
   */
  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as ServerMessage;
      // Requirements: 8.4 - 接收状态更新后直接传递给处理器，不做修改
      this.messageHandlers.forEach(handler => handler(message));
    } catch (error) {
      console.error('解析服务器消息失败:', error);
    }
  }
}
