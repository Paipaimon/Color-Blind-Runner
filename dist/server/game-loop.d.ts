/**
 * 游戏循环
 * 固定时间步长更新游戏世界状态
 *
 * Requirements: 3.1, 3.2, 6.2, 6.4, 9.1, 9.2
 */
import { PlayerColor } from '../shared/types.js';
import { Obstacle } from './obstacle-generator.js';
import { Player } from './collision-detector.js';
import { RouteIndex } from './player-logic.js';
/**
 * 游戏状态枚举
 */
export declare enum GameState {
    WAITING = "waiting",
    PLAYING = "playing",
    ENDED = "ended"
}
/**
 * 游戏房间状态（GameLoop 使用的内部表示）
 */
export interface GameRoom {
    id: string;
    players: Player[];
    obstacles: Obstacle[];
    worldPosition: number;
    gameState: GameState;
    seed: number;
}
/**
 * 游戏事件回调接口
 */
export interface GameLoopCallbacks {
    onPlayerDied?: (roomId: string, playerId: string, color: PlayerColor) => void;
    onGameEnded?: (roomId: string, scores: PlayerScore[]) => void;
    onStateUpdate?: (roomId: string, room: GameRoom) => void;
}
/**
 * 玩家分数
 */
export interface PlayerScore {
    color: PlayerColor;
    distance: number;
    alive: boolean;
}
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
export declare class GameLoop {
    private obstacleGenerator;
    private collisionDetector;
    private activeLoops;
    private broadcastTimers;
    private rooms;
    private callbacks;
    private lastTickTime;
    constructor(callbacks?: GameLoopCallbacks);
    /**
     * 启动游戏循环
     *
     * @param room 游戏房间
     */
    start(room: GameRoom): void;
    /**
     * 停止游戏循环
     *
     * @param roomId 房间ID
     */
    stop(roomId: string): void;
    /**
     * 单次游戏更新（tick）
     *
     * @param roomId 房间ID
     *
     * Requirements: 3.1, 3.2, 6.2, 6.4, 9.1, 9.2
     */
    tick(roomId: string): void;
    /**
     * 处理碰撞事件
     *
     * @param room 游戏房间
     * @param collision 碰撞结果
     *
     * Requirements: 6.2, 6.3
     */
    private handleCollision;
    /**
     * 检查是否所有玩家都已死亡
     *
     * @param room 游戏房间
     * @returns 是否所有玩家都死亡
     */
    private areAllPlayersDead;
    /**
     * 结束游戏
     *
     * @param room 游戏房间
     *
     * Requirements: 6.4
     */
    private endGame;
    /**
     * 清理已经过去的障碍物
     * 移除Y坐标小于当前世界位置的障碍物（已经滚出屏幕底部）
     */
    private cleanupObstacles;
    /**
     * 广播状态更新
     *
     * @param roomId 房间ID
     */
    private broadcast;
    /**
     * 获取房间状态
     *
     * @param roomId 房间ID
     * @returns 房间状态，不存在则返回 null
     */
    getRoom(roomId: string): GameRoom | null;
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
    handlePlayerInput(roomId: string, playerId: string, newRoute: RouteIndex): void;
    /**
     * 检查游戏循环是否正在运行
     *
     * @param roomId 房间ID
     * @returns 是否正在运行
     */
    isRunning(roomId: string): boolean;
    /**
     * 获取游戏循环配置（用于测试）
     */
    static getConfig(): {
        readonly TICK_RATE: 60;
        readonly WORLD_SPEED: 3;
        readonly BROADCAST_RATE: 20;
    };
}
//# sourceMappingURL=game-loop.d.ts.map