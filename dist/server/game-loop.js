/**
 * 游戏循环
 * 固定时间步长更新游戏世界状态
 *
 * Requirements: 3.1, 3.2, 6.2, 6.4, 9.1, 9.2
 */
import { ObstacleGenerator } from './obstacle-generator.js';
import { CollisionDetector } from './collision-detector.js';
/**
 * 游戏状态枚举
 */
export var GameState;
(function (GameState) {
    GameState["WAITING"] = "waiting";
    GameState["PLAYING"] = "playing";
    GameState["ENDED"] = "ended";
})(GameState || (GameState = {}));
/**
 * 游戏循环配置常量
 */
const GAME_LOOP_CONFIG = {
    TICK_RATE: 60, // 服务器tick频率 (Hz)
    WORLD_SPEED: 3, // 世界滚动速度（网格行/秒）
    BROADCAST_RATE: 20, // 状态广播频率 (Hz)
};
/**
 * 游戏循环类
 *
 * 职责：
 * 1. 固定时间步长更新世界位置 (Requirements 3.1, 3.2)
 * 2. 调用障碍物生成器生成新障碍物
 * 3. 调用碰撞检测器检测碰撞
 * 4. 更新存活玩家的距离 (Requirements 9.1)
 * 5. 处理玩家死亡 (Requirements 6.2, 6.4)
 * 6. 死亡玩家状态不变 (Requirements 9.2)
 */
export class GameLoop {
    // 障碍物生成器
    obstacleGenerator;
    // 碰撞检测器
    collisionDetector;
    // 活跃的游戏循环（roomId -> intervalId）
    activeLoops = new Map();
    // 广播定时器（roomId -> intervalId）
    broadcastTimers = new Map();
    // 房间状态存储
    rooms = new Map();
    // 事件回调
    callbacks;
    // 上一次tick的时间戳（用于计算deltaTime）
    lastTickTime = new Map();
    constructor(callbacks = {}) {
        this.obstacleGenerator = new ObstacleGenerator();
        this.collisionDetector = new CollisionDetector();
        this.callbacks = callbacks;
    }
    /**
     * 启动游戏循环
     *
     * @param room 游戏房间
     */
    start(room) {
        // 如果已有循环在运行，先停止
        if (this.activeLoops.has(room.id)) {
            this.stop(room.id);
        }
        // 存储房间状态
        this.rooms.set(room.id, room);
        // 初始化障碍物生成器
        const playerColors = room.players.map(p => p.color);
        this.obstacleGenerator.init(room.seed, playerColors);
        // 设置游戏状态为进行中
        room.gameState = GameState.PLAYING;
        // 记录开始时间
        this.lastTickTime.set(room.id, Date.now());
        // 计算tick间隔（毫秒）
        const tickInterval = 1000 / GAME_LOOP_CONFIG.TICK_RATE;
        // 启动游戏循环
        const loopId = setInterval(() => {
            this.tick(room.id);
        }, tickInterval);
        this.activeLoops.set(room.id, loopId);
        // 启动状态广播定时器
        const broadcastInterval = 1000 / GAME_LOOP_CONFIG.BROADCAST_RATE;
        const broadcastId = setInterval(() => {
            this.broadcast(room.id);
        }, broadcastInterval);
        this.broadcastTimers.set(room.id, broadcastId);
    }
    /**
     * 停止游戏循环
     *
     * @param roomId 房间ID
     */
    stop(roomId) {
        // 停止游戏循环
        const loopId = this.activeLoops.get(roomId);
        if (loopId) {
            clearInterval(loopId);
            this.activeLoops.delete(roomId);
        }
        // 停止广播定时器
        const broadcastId = this.broadcastTimers.get(roomId);
        if (broadcastId) {
            clearInterval(broadcastId);
            this.broadcastTimers.delete(roomId);
        }
        // 清理时间记录
        this.lastTickTime.delete(roomId);
    }
    /**
     * 单次游戏更新（tick）
     *
     * @param roomId 房间ID
     *
     * Requirements: 3.1, 3.2, 6.2, 6.4, 9.1, 9.2
     */
    tick(roomId) {
        const room = this.rooms.get(roomId);
        if (!room || room.gameState !== GameState.PLAYING) {
            return;
        }
        // 计算时间增量
        const now = Date.now();
        const lastTime = this.lastTickTime.get(roomId) || now;
        const deltaTime = (now - lastTime) / 1000; // 转换为秒
        this.lastTickTime.set(roomId, now);
        // 1. 更新世界位置 (Requirements 3.1, 3.2)
        const worldIncrement = GAME_LOOP_CONFIG.WORLD_SPEED * deltaTime;
        room.worldPosition += worldIncrement;
        // 2. 更新存活玩家的距离 (Requirements 9.1)
        // 死亡玩家的距离不变 (Requirements 9.2)
        for (const player of room.players) {
            if (player.alive) {
                player.distance += worldIncrement;
            }
            // 死亡玩家：不更新 distance 和 route (Requirements 6.2, 9.2)
        }
        // 3. 生成新障碍物
        const newObstacles = this.obstacleGenerator.generateNext(room.worldPosition);
        room.obstacles.push(...newObstacles);
        // 4. 清理已经过去的障碍物（优化内存）
        this.cleanupObstacles(room);
        // 5. 碰撞检测 (Requirements 6.1)
        const collisions = this.collisionDetector.checkAllCollisions(room.players, room.obstacles);
        // 6. 处理碰撞结果 - 标记玩家死亡 (Requirements 6.2)
        for (const collision of collisions) {
            this.handleCollision(room, collision);
        }
        // 7. 检查游戏是否结束 (Requirements 6.4)
        if (this.areAllPlayersDead(room)) {
            this.endGame(room);
        }
    }
    /**
     * 处理碰撞事件
     *
     * @param room 游戏房间
     * @param collision 碰撞结果
     *
     * Requirements: 6.2, 6.3
     */
    handleCollision(room, collision) {
        const player = room.players.find(p => p.id === collision.playerId);
        if (!player || !player.alive) {
            return;
        }
        // 标记玩家死亡 (Requirements 6.2)
        player.alive = false;
        // 触发死亡回调 (Requirements 6.3)
        if (this.callbacks.onPlayerDied) {
            this.callbacks.onPlayerDied(room.id, player.id, player.color);
        }
    }
    /**
     * 检查是否所有玩家都已死亡
     *
     * @param room 游戏房间
     * @returns 是否所有玩家都死亡
     */
    areAllPlayersDead(room) {
        return room.players.every(p => !p.alive);
    }
    /**
     * 结束游戏
     *
     * @param room 游戏房间
     *
     * Requirements: 6.4
     */
    endGame(room) {
        // 设置游戏状态为结束
        room.gameState = GameState.ENDED;
        // 停止游戏循环
        this.stop(room.id);
        // 生成最终分数
        const scores = room.players.map(p => ({
            color: p.color,
            distance: p.distance,
            alive: p.alive
        }));
        // 触发游戏结束回调
        if (this.callbacks.onGameEnded) {
            this.callbacks.onGameEnded(room.id, scores);
        }
    }
    /**
     * 清理已经过去的障碍物
     * 移除Y坐标小于当前世界位置的障碍物（已经滚出屏幕底部）
     */
    cleanupObstacles(room) {
        // 障碍物Y值小于worldPosition表示已经滚出屏幕底部
        room.obstacles = room.obstacles.filter(o => o.y > room.worldPosition - 2);
    }
    /**
     * 广播状态更新
     *
     * @param roomId 房间ID
     */
    broadcast(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return;
        }
        if (this.callbacks.onStateUpdate) {
            this.callbacks.onStateUpdate(roomId, room);
        }
    }
    /**
     * 获取房间状态
     *
     * @param roomId 房间ID
     * @returns 房间状态，不存在则返回 null
     */
    getRoom(roomId) {
        return this.rooms.get(roomId) || null;
    }
    /**
     * 处理玩家输入
     * 更新玩家路线位置
     *
     * @param roomId 房间ID
     * @param playerId 玩家ID
     * @param newRoute 新路线
     *
     * Requirements: 6.2 - 死亡玩家不响应输入
     */
    handlePlayerInput(roomId, playerId, newRoute) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return;
        }
        const player = room.players.find(p => p.id === playerId);
        if (!player) {
            return;
        }
        // 死亡玩家不响应输入 (Requirements 6.2)
        if (!player.alive) {
            return;
        }
        player.route = newRoute;
    }
    /**
     * 检查游戏循环是否正在运行
     *
     * @param roomId 房间ID
     * @returns 是否正在运行
     */
    isRunning(roomId) {
        return this.activeLoops.has(roomId);
    }
    /**
     * 获取游戏循环配置（用于测试）
     */
    static getConfig() {
        return GAME_LOOP_CONFIG;
    }
}
//# sourceMappingURL=game-loop.js.map