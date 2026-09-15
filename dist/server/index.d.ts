/**
 * WebSocket 游戏服务器入口
 *
 * 职责：
 * 1. 处理 HTTP 请求，提供静态文件
 * 2. 处理 WebSocket 连接
 * 3. 处理 ClientMessage，发送 ServerMessage
 * 4. 集成 RoomManager 和 GameLoop
 *
 * Requirements: 8.1, 6.3, 9.3
 */
/**
 * 游戏服务器类
 */
declare class GameServer {
    private httpServer;
    private wss;
    private roomManager;
    private gameLoop;
    private visibilityFilter;
    private connections;
    private playerSockets;
    private gameRooms;
    private countdownTimers;
    constructor(port?: number);
    /**
     * 处理 HTTP 请求 - 提供静态文件
     */
    private handleHttpRequest;
    /**
     * 提供文件
     */
    private serveFile;
    /**
     * 获取 MIME 类型
     */
    private getMimeType;
    /**
     * 处理新的 WebSocket 连接
     */
    private handleConnection;
    /**
     * 处理客户端消息
     */
    private handleMessage;
    /**
     * 处理加入房间请求
     * Requirements: 1.1, 1.2, 1.3
     */
    private handleJoinRoom;
    /**
     * 处理离开房间请求
     * Requirements: 1.5
     */
    private handleLeaveRoom;
    /**
     * 处理玩家准备
     * Requirements: 1.4
     */
    private handleReady;
    /**
     * 开始倒计时
     */
    private startCountdown;
    /**
     * 开始游戏
     */
    private startGame;
    /**
     * 处理玩家输入
     * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
     */
    private handlePlayerInput;
    /**
     * 处理 Ping 消息
     */
    private handlePing;
    /**
     * 处理客户端断开连接
     * Requirements: 1.5
     */
    private handleDisconnect;
    /**
     * 玩家死亡回调
     * Requirements: 6.3 - 通知所有客户端死亡事件
     */
    private handlePlayerDied;
    /**
     * 游戏结束回调
     * Requirements: 6.4, 9.3 - 发送最终分数
     */
    private handleGameEnded;
    /**
     * 状态更新回调
     * Requirements: 8.1 - 广播可见状态到每个客户端
     * 死亡玩家继续接收状态更新，可以观看其他玩家的游戏
     */
    private handleStateUpdate;
    /**
     * 构建最终游戏状态
     */
    private buildFinalState;
    /**
     * 转换游戏状态枚举
     */
    private convertGameState;
    /**
     * 转换为共享类型的游戏状态
     */
    private convertToSharedGameState;
    /**
     * 转换障碍物颜色到共享类型
     */
    private convertObstacleColor;
    /**
     * 将路线索引转换为X坐标
     */
    private routeToX;
    /**
     * 发送消息到客户端
     */
    private send;
    /**
     * 发送错误消息
     */
    private sendError;
    /**
     * 广播消息到房间内所有玩家
     * @param roomId 房间ID
     * @param message 消息
     * @param excludePlayerId 排除的玩家ID（可选）
     */
    private broadcastToRoom;
    /**
     * 关闭服务器
     */
    close(): void;
}
export { GameServer };
//# sourceMappingURL=index.d.ts.map