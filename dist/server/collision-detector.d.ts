/**
 * 碰撞检测器
 * 检测玩家与同色障碍物的碰撞
 *
 * Requirements: 6.1 - 玩家与同色障碍物碰撞时死亡
 */
import { PlayerColor } from '../shared/types.js';
/**
 * 路线索引类型
 */
export type RouteIndex = number;
/**
 * 玩家状态
 */
export interface Player {
    id: string;
    color: PlayerColor;
    route: RouteIndex;
    alive: boolean;
    distance: number;
    ready: boolean;
}
/**
 * 障碍物
 */
export interface Obstacle {
    id: string;
    color: PlayerColor;
    route: RouteIndex;
    y: number;
}
/**
 * 碰撞结果
 */
export interface CollisionResult {
    playerId: string;
    obstacleId: string;
}
/**
 * 碰撞检测器类
 *
 * 碰撞规则：
 * - 只有玩家与同色障碍物才会发生碰撞
 * - 玩家必须在同一路线上
 * - 玩家位置与障碍物位置重叠时发生碰撞
 *
 * Requirements: 6.1
 */
export declare class CollisionDetector {
    /**
     * 检测单个玩家与障碍物列表的碰撞
     *
     * @param player 玩家对象
     * @param obstacles 障碍物列表
     * @returns 发生碰撞的障碍物，如果没有碰撞则返回null
     *
     * Requirements: 6.1 - 玩家与同色障碍物碰撞检测
     */
    checkCollision(player: Player, obstacles: Obstacle[]): Obstacle | null;
    /**
     * 检测所有玩家与障碍物的碰撞
     *
     * @param players 玩家列表
     * @param obstacles 障碍物列表
     * @returns 所有碰撞结果的数组
     *
     * Requirements: 6.1 - 批量碰撞检测
     */
    checkAllCollisions(players: Player[], obstacles: Obstacle[]): CollisionResult[];
    /**
     * 检测单个玩家与单个障碍物是否碰撞
     *
     * 碰撞条件：
     * 1. 玩家与障碍物颜色相同
     * 2. 玩家与障碍物在同一路线
     * 3. 玩家位置与障碍物位置重叠
     */
    private isColliding;
    static getCollisionConfig(): {
        readonly TOLERANCE: 0.5;
    };
}
//# sourceMappingURL=collision-detector.d.ts.map