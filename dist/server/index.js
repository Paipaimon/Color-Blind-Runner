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
import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { RoomManager } from './room-manager.js';
import { GameLoop, GameState as GameLoopState } from './game-loop.js';
import { VisibilityFilter, GameState as VisibilityGameState } from './visibility-filter.js';
import { applyInput } from './player-logic.js';
import { GAME_CONFIG } from '../shared/constants.js';
import { GameState } from '../shared/types.js';
import { ClientMessageType, ServerMessageType, parseClientMessage, serializeServerMessage } from '../shared/messages.js';
// 获取当前目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/**
 * 游戏服务器类
 */
class GameServer {
    httpServer;
    wss;
    roomManager;
    gameLoop;
    visibilityFilter;
    // 客户端连接映射 (WebSocket -> ClientConnection)
    connections = new Map();
    // 玩家ID到WebSocket的映射
    playerSockets = new Map();
    // 房间ID到GameRoom的映射（用于游戏循环）
    gameRooms = new Map();
    // 倒计时定时器
    countdownTimers = new Map();
    constructor(port = GAME_CONFIG.DEFAULT_PORT) {
        this.roomManager = new RoomManager();
        this.visibilityFilter = new VisibilityFilter();
        // 初始化游戏循环，设置回调
        this.gameLoop = new GameLoop({
            onPlayerDied: this.handlePlayerDied.bind(this),
            onGameEnded: this.handleGameEnded.bind(this),
            onStateUpdate: this.handleStateUpdate.bind(this)
        });
        // 创建 HTTP 服务器
        this.httpServer = http.createServer((req, res) => {
            this.handleHttpRequest(req, res);
        });
        // 创建 WebSocket 服务器，附加到 HTTP 服务器
        this.wss = new WebSocketServer({
            server: this.httpServer
        });
        this.wss.on('connection', (ws) => {
            this.handleConnection(ws);
        });
        this.wss.on('error', (error) => {
            console.error('[Server] WebSocket server error:', error);
        });
        // 启动 HTTP 服务器
        this.httpServer.listen(port, '0.0.0.0', () => {
            console.log(`[Server] 游戏服务器启动，端口: ${port}`);
        });
        this.httpServer.on('error', (error) => {
            console.error('[Server] HTTP server error:', error);
        });
    }
    /**
     * 处理 HTTP 请求 - 提供静态文件
     */
    handleHttpRequest(req, res) {
        const rawUrl = req.url || '/';
        // 去除查询字符串与哈希，避免带参数访问（如 ?debug=layout）时匹配失败
        const pathname = rawUrl.split('?')[0].split('#')[0];
        console.log(`[HTTP] ${req.method} ${rawUrl}`);
        try {
            // 处理根路径
            if (pathname === '/' || pathname === '/index.html') {
                const filePath = path.join(__dirname, '../../public/index.html');
                console.log(`[HTTP] 读取文件: ${filePath}`);
                this.serveFile(res, filePath, 'text/html; charset=utf-8');
                return;
            }
            // 处理 /dist 路径下的文件
            if (pathname.startsWith('/dist/')) {
                const filePath = path.join(__dirname, '../../', pathname);
                console.log(`[HTTP] 读取文件: ${filePath}`);
                this.serveFile(res, filePath, this.getMimeType(pathname));
                return;
            }
            // 处理其他静态文件
            if (pathname.startsWith('/')) {
                const filePath = path.join(__dirname, '../../public', pathname);
                console.log(`[HTTP] 读取文件: ${filePath}`);
                this.serveFile(res, filePath, this.getMimeType(pathname));
                return;
            }
            // 404 响应
            console.log(`[HTTP] 404: ${rawUrl}`);
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        }
        catch (error) {
            console.error(`[HTTP] 错误: ${error}`);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        }
    }
    /**
     * 提供文件
     */
    serveFile(res, filePath, mimeType) {
        fs.readFile(filePath, (err, data) => {
            if (err) {
                console.error(`[HTTP] 文件读取失败: ${filePath}, 错误: ${err.message}`);
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
                return;
            }
            console.log(`[HTTP] 成功读取: ${filePath} (${data.length} 字节)`);
            res.writeHead(200, {
                'Content-Type': mimeType,
                'Content-Length': data.length
            });
            res.end(data);
        });
    }
    /**
     * 获取 MIME 类型
     */
    getMimeType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.html': 'text/html; charset=utf-8',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf': 'font/ttf'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }
    /**
     * 处理新的 WebSocket 连接
     */
    handleConnection(ws) {
        console.log('[Server] 新客户端连接');
        // 初始化连接信息
        const connection = {
            ws,
            playerId: null,
            roomId: null
        };
        this.connections.set(ws, connection);
        // 设置消息处理
        ws.on('message', (data) => {
            this.handleMessage(ws, data.toString());
        });
        // 设置关闭处理
        ws.on('close', () => {
            this.handleDisconnect(ws);
        });
        // 设置错误处理
        ws.on('error', (error) => {
            console.error('[Server] WebSocket error:', error);
            this.handleDisconnect(ws);
        });
    }
    /**
     * 处理客户端消息
     */
    handleMessage(ws, data) {
        const message = parseClientMessage(data);
        if (!message) {
            this.sendError(ws, 'INVALID_MESSAGE', '无效的消息格式');
            return;
        }
        const connection = this.connections.get(ws);
        if (!connection) {
            return;
        }
        switch (message.type) {
            case ClientMessageType.JOIN_ROOM:
                this.handleJoinRoom(ws, connection, message.roomId);
                break;
            case ClientMessageType.LEAVE_ROOM:
                this.handleLeaveRoom(ws, connection);
                break;
            case ClientMessageType.READY:
                this.handleReady(ws, connection);
                break;
            case ClientMessageType.PLAYER_INPUT:
                this.handlePlayerInput(ws, connection, message.input);
                break;
            case ClientMessageType.PING:
                this.handlePing(ws, message.timestamp);
                break;
            default:
                this.sendError(ws, 'UNKNOWN_MESSAGE', '未知的消息类型');
        }
    }
    /**
     * 处理加入房间请求
     * Requirements: 1.1, 1.2, 1.3
     */
    handleJoinRoom(ws, connection, roomId) {
        // 如果已在房间中，先离开
        if (connection.roomId) {
            this.handleLeaveRoom(ws, connection);
        }
        let result = null;
        if (roomId) {
            // 尝试加入指定房间
            const player = this.roomManager.joinRoom(roomId);
            if (player) {
                result = { roomId, player };
            }
        }
        else {
            // 自动匹配或创建房间
            result = this.roomManager.joinOrCreateRoom();
        }
        if (!result || !result.player) {
            this.sendError(ws, 'ROOM_FULL', '房间已满或不存在');
            return;
        }
        // 更新连接信息
        connection.playerId = result.player.id;
        connection.roomId = result.roomId;
        this.playerSockets.set(result.player.id, ws);
        // 获取房间中所有玩家
        const players = this.roomManager.getPlayersInRoom(result.roomId);
        // 发送加入成功消息
        const joinedMessage = {
            type: ServerMessageType.ROOM_JOINED,
            roomId: result.roomId,
            playerId: result.player.id,
            playerColor: result.player.color,
            players: players
        };
        this.send(ws, joinedMessage);
        // 通知房间内其他玩家
        this.broadcastToRoom(result.roomId, {
            type: ServerMessageType.PLAYER_JOINED,
            player: result.player
        }, result.player.id);
        console.log(`[Server] 玩家 ${result.player.id} (${result.player.color}) 加入房间 ${result.roomId}`);
    }
    /**
     * 处理离开房间请求
     * Requirements: 1.5
     */
    handleLeaveRoom(ws, connection) {
        if (!connection.roomId || !connection.playerId) {
            return;
        }
        const roomId = connection.roomId;
        const playerId = connection.playerId;
        // 从房间管理器中离开
        this.roomManager.leaveRoom(roomId, playerId);
        // 清理映射
        this.playerSockets.delete(playerId);
        connection.playerId = null;
        connection.roomId = null;
        // 发送离开确认
        const leftMessage = {
            type: ServerMessageType.ROOM_LEFT
        };
        this.send(ws, leftMessage);
        // 通知房间内其他玩家
        this.broadcastToRoom(roomId, {
            type: ServerMessageType.PLAYER_LEFT,
            playerId: playerId
        });
        console.log(`[Server] 玩家 ${playerId} 离开房间 ${roomId}`);
    }
    /**
     * 处理玩家准备
     * Requirements: 1.4
     */
    handleReady(ws, connection) {
        if (!connection.roomId || !connection.playerId) {
            this.sendError(ws, 'NOT_IN_ROOM', '未加入房间');
            return;
        }
        const roomId = connection.roomId;
        const playerId = connection.playerId;
        // 设置玩家准备状态
        this.roomManager.setPlayerReady(roomId, playerId, true);
        // 检查是否所有玩家都准备好
        if (this.roomManager.areAllPlayersReady(roomId)) {
            this.startCountdown(roomId);
        }
    }
    /**
     * 开始倒计时
     */
    startCountdown(roomId) {
        // 启动游戏（更新状态为 COUNTDOWN）
        if (!this.roomManager.startGame(roomId)) {
            return;
        }
        let countdown = GAME_CONFIG.COUNTDOWN_SECONDS;
        // 发送初始倒计时
        this.broadcastToRoom(roomId, {
            type: ServerMessageType.COUNTDOWN,
            seconds: countdown
        });
        // 设置倒计时定时器
        const timer = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                this.broadcastToRoom(roomId, {
                    type: ServerMessageType.COUNTDOWN,
                    seconds: countdown
                });
            }
            else {
                // 倒计时结束，开始游戏
                clearInterval(timer);
                this.countdownTimers.delete(roomId);
                this.startGame(roomId);
            }
        }, 1000);
        this.countdownTimers.set(roomId, timer);
    }
    /**
     * 开始游戏
     */
    startGame(roomId) {
        const room = this.roomManager.getRoom(roomId);
        if (!room) {
            return;
        }
        // 转换为 GameLoop 使用的 GameRoom 格式
        const players = this.roomManager.getPlayersInRoom(roomId);
        const initialRoute = Math.floor(GAME_CONFIG.GRID_COLS / 2); // 初始在中间列
        const gameRoom = {
            id: roomId,
            players: players.map(p => ({
                id: p.id,
                color: p.color,
                route: initialRoute,
                alive: p.isAlive,
                distance: 0,
                ready: true
            })),
            obstacles: [],
            worldPosition: 0,
            gameState: GameLoopState.PLAYING,
            seed: Date.now()
        };
        // 存储游戏房间
        this.gameRooms.set(roomId, gameRoom);
        // 启动游戏循环
        this.gameLoop.start(gameRoom);
        // 通知所有玩家游戏开始
        this.broadcastToRoom(roomId, {
            type: ServerMessageType.GAME_START
        });
        console.log(`[Server] 房间 ${roomId} 游戏开始`);
    }
    /**
     * 处理玩家输入
     * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
     */
    handlePlayerInput(ws, connection, input) {
        if (!connection.roomId || !connection.playerId) {
            return;
        }
        const gameRoom = this.gameRooms.get(connection.roomId);
        if (!gameRoom || gameRoom.gameState !== GameLoopState.PLAYING) {
            return;
        }
        // 找到玩家
        const player = gameRoom.players.find(p => p.id === connection.playerId);
        if (!player || !player.alive) {
            return;
        }
        // 将 PlayerInput 转换为 MoveInput
        let moveType = null;
        if (input.left) {
            moveType = 'move_left';
        }
        else if (input.right) {
            moveType = 'move_right';
        }
        if (moveType) {
            // 应用输入，计算新路线
            const newRoute = applyInput(player.route, { type: moveType });
            // 更新玩家路线
            this.gameLoop.handlePlayerInput(connection.roomId, connection.playerId, newRoute);
        }
    }
    /**
     * 处理 Ping 消息
     */
    handlePing(ws, timestamp) {
        const pongMessage = {
            type: ServerMessageType.PONG,
            timestamp: timestamp,
            serverTime: Date.now()
        };
        this.send(ws, pongMessage);
    }
    /**
     * 处理客户端断开连接
     * Requirements: 1.5
     */
    handleDisconnect(ws) {
        const connection = this.connections.get(ws);
        if (!connection) {
            return;
        }
        if (connection.roomId && connection.playerId) {
            const roomId = connection.roomId;
            const playerId = connection.playerId;
            // 获取房间状态
            const room = this.roomManager.getRoom(roomId);
            if (room && room.gameState === GameState.PLAYING) {
                // 游戏进行中，标记玩家死亡
                this.roomManager.markPlayerDead(roomId, playerId);
                // 更新 GameRoom 中的玩家状态
                const gameRoom = this.gameRooms.get(roomId);
                if (gameRoom) {
                    const player = gameRoom.players.find(p => p.id === playerId);
                    if (player) {
                        player.alive = false;
                    }
                }
                // 通知其他玩家
                this.broadcastToRoom(roomId, {
                    type: ServerMessageType.PLAYER_DIED,
                    playerId: playerId,
                    killedBy: 'disconnect'
                }, playerId);
            }
            else {
                // 游戏未开始，直接离开房间
                this.roomManager.leaveRoom(roomId, playerId);
                // 通知其他玩家
                this.broadcastToRoom(roomId, {
                    type: ServerMessageType.PLAYER_LEFT,
                    playerId: playerId
                });
            }
            // 清理映射
            this.playerSockets.delete(playerId);
        }
        // 清理连接
        this.connections.delete(ws);
        console.log('[Server] 客户端断开连接');
    }
    /**
     * 玩家死亡回调
     * Requirements: 6.3 - 通知所有客户端死亡事件
     */
    handlePlayerDied(roomId, playerId, color) {
        console.log(`[Server] 玩家 ${playerId} (${color}) 死亡`);
        // 更新房间管理器中的玩家状态
        this.roomManager.markPlayerDead(roomId, playerId);
        // 通知所有玩家
        this.broadcastToRoom(roomId, {
            type: ServerMessageType.PLAYER_DIED,
            playerId: playerId,
            killedBy: 'obstacle'
        });
    }
    /**
     * 游戏结束回调
     * Requirements: 6.4, 9.3 - 发送最终分数
     */
    handleGameEnded(roomId, scores) {
        console.log(`[Server] 房间 ${roomId} 游戏结束`);
        // 更新房间状态
        this.roomManager.endGame(roomId);
        // 获取存活玩家（如果有的话）
        const winners = scores.filter(s => s.alive).map(s => s.color);
        // 构建最终状态
        const gameRoom = this.gameRooms.get(roomId);
        const finalState = gameRoom ? this.buildFinalState(gameRoom) : null;
        // 通知所有玩家游戏结束
        if (finalState) {
            this.broadcastToRoom(roomId, {
                type: ServerMessageType.GAME_OVER,
                winners: winners,
                finalState: finalState
            });
        }
        // 清理游戏房间
        this.gameRooms.delete(roomId);
    }
    /**
     * 状态更新回调
     * Requirements: 8.1 - 广播可见状态到每个客户端
     * 死亡玩家继续接收状态更新，可以观看其他玩家的游戏
     */
    handleStateUpdate(roomId, room) {
        // 为每个玩家生成个性化的可见状态（包括死亡玩家）
        for (const player of room.players) {
            const ws = this.playerSockets.get(player.id);
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                continue;
            }
            // 构建世界状态
            const worldState = {
                players: room.players,
                obstacles: room.obstacles,
                worldPosition: room.worldPosition,
                gameState: this.convertGameState(room.gameState)
            };
            // 为该玩家过滤可见状态
            const visibleState = this.visibilityFilter.filterForPlayer(worldState, player);
            const cellSize = GAME_CONFIG.CELL_SIZE;
            // 死亡玩家使用自己死亡时的距离作为视角位置
            // 存活玩家使用当前世界位置
            const viewWorldPosition = player.alive ? room.worldPosition : player.distance;
            // 发送状态更新
            const stateMessage = {
                type: ServerMessageType.GAME_STATE,
                state: {
                    players: room.players.map(p => ({
                        id: p.id,
                        color: p.color,
                        position: {
                            x: p.route * cellSize + cellSize / 2, // 列位置
                            // 对于死亡玩家，使用其死亡时的距离；存活玩家使用当前世界位置
                            y: p.alive ? room.worldPosition : p.distance
                        },
                        isAlive: p.alive,
                        distance: Math.floor(p.distance) // 添加距离信息
                    })),
                    obstacles: visibleState.visibleObstacles.map(o => {
                        // 障碍物屏幕Y = 底部 - (障碍物Y - 视角位置) * 格子大小
                        const screenY = GAME_CONFIG.GAME_HEIGHT - (o.y - viewWorldPosition + 1) * cellSize;
                        return {
                            id: o.id,
                            color: this.convertObstacleColor(o.color),
                            position: {
                                x: o.route * cellSize,
                                y: screenY
                            },
                            width: cellSize,
                            height: cellSize
                        };
                    }).filter(o => o.position.y >= -cellSize && o.position.y < GAME_CONFIG.GAME_HEIGHT),
                    scrollSpeed: 100,
                    gameState: this.convertToSharedGameState(visibleState.gameState),
                    // 添加近距离提示（自己颜色的障碍物接近时）
                    proximityHints: visibleState.proximityHints
                },
                timestamp: Date.now()
            };
            this.send(ws, stateMessage);
        }
    }
    /**
     * 构建最终游戏状态
     */
    buildFinalState(gameRoom) {
        return {
            players: gameRoom.players.map(p => ({
                id: p.id,
                color: p.color,
                position: { x: this.routeToX(p.route), y: 0 },
                isAlive: p.alive
            })),
            obstacles: [],
            scrollSpeed: 0,
            gameState: GameState.GAME_OVER
        };
    }
    /**
     * 转换游戏状态枚举
     */
    convertGameState(state) {
        switch (state) {
            case GameLoopState.WAITING:
                return VisibilityGameState.WAITING;
            case GameLoopState.PLAYING:
                return VisibilityGameState.PLAYING;
            case GameLoopState.ENDED:
                return VisibilityGameState.ENDED;
            default:
                return VisibilityGameState.WAITING;
        }
    }
    /**
     * 转换为共享类型的游戏状态
     */
    convertToSharedGameState(state) {
        switch (state) {
            case VisibilityGameState.WAITING:
                return GameState.WAITING;
            case VisibilityGameState.PLAYING:
                return GameState.PLAYING;
            case VisibilityGameState.ENDED:
                return GameState.GAME_OVER;
            default:
                return GameState.WAITING;
        }
    }
    /**
     * 转换障碍物颜色到共享类型
     */
    convertObstacleColor(color) {
        // PlayerColor 和 ObstacleColor 的基础颜色是相同的
        return color;
    }
    /**
     * 将路线索引转换为X坐标
     */
    routeToX(route) {
        const spacing = GAME_CONFIG.GAME_WIDTH / 4;
        return spacing * (route + 1);
    }
    /**
     * 发送消息到客户端
     */
    send(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(serializeServerMessage(message));
        }
    }
    /**
     * 发送错误消息
     */
    sendError(ws, code, message) {
        const errorMessage = {
            type: ServerMessageType.ERROR,
            code,
            message
        };
        this.send(ws, errorMessage);
    }
    /**
     * 广播消息到房间内所有玩家
     * @param roomId 房间ID
     * @param message 消息
     * @param excludePlayerId 排除的玩家ID（可选）
     */
    broadcastToRoom(roomId, message, excludePlayerId) {
        const players = this.roomManager.getPlayersInRoom(roomId);
        for (const player of players) {
            if (excludePlayerId && player.id === excludePlayerId) {
                continue;
            }
            const ws = this.playerSockets.get(player.id);
            if (ws) {
                this.send(ws, message);
            }
        }
    }
    /**
     * 关闭服务器
     */
    close() {
        // 停止所有倒计时
        for (const timer of this.countdownTimers.values()) {
            clearInterval(timer);
        }
        this.countdownTimers.clear();
        // 停止所有游戏循环
        for (const roomId of this.gameRooms.keys()) {
            this.gameLoop.stop(roomId);
        }
        this.gameRooms.clear();
        // 关闭所有连接
        for (const ws of this.connections.keys()) {
            ws.close();
        }
        this.connections.clear();
        // 关闭 WebSocket 服务器
        this.wss.close();
        // 关闭 HTTP 服务器
        this.httpServer.close();
        console.log('[Server] 服务器已关闭');
    }
}
// 启动服务器（如果直接运行此文件）
const port = parseInt(process.env.PORT || String(GAME_CONFIG.DEFAULT_PORT), 10);
const server = new GameServer(port);
// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n[Server] 收到 SIGINT 信号，正在关闭...');
    server.close();
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log('\n[Server] 收到 SIGTERM 信号，正在关闭...');
    server.close();
    process.exit(0);
});
export { GameServer };
//# sourceMappingURL=index.js.map