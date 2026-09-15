/**
 * 可见性过滤器
 * 根据玩家颜色过滤世界状态，生成玩家可见的投影数据
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
 * 近距离提示
 */
export interface ProximityHint {
    route: RouteIndex;
    intensity: number;
}
/**
 * 游戏状态枚举
 */
export declare enum GameState {
    WAITING = "waiting",
    PLAYING = "playing",
    ENDED = "ended"
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
 * 可见状态
 */
export interface VisibleState {
    myPlayer: Player;
    visibleObstacles: Obstacle[];
    proximityHints: ProximityHint[];
    worldPosition: number;
    gameState: GameState;
    scores: PlayerScore[];
}
/**
 * 世界状态
 */
export interface WorldState {
    players: Player[];
    obstacles: Obstacle[];
    worldPosition: number;
    gameState: GameState;
}
/**
 * 可见性过滤器类
 *
 * 核心职责：
 * 1. 过滤掉玩家自己颜色的障碍物 (Requirements 5.1, 5.2)
 * 2. 生成近距离提示 (Requirements 5.3)
 * 3. 排除其他玩家的位置信息 (Requirements 7.1)
 * 4. 根据玩家颜色过滤世界状态 (Requirements 8.2)
 */
export declare class VisibilityFilter {
    /**
     * 为特定玩家生成可见状态
     *
     * @param worldState 完整的世界状态
     * @param player 目标玩家
     * @returns 过滤后的可见状态
     *
     * Requirements: 5.1, 5.2, 5.3, 7.1, 8.2
     */
    filterForPlayer(worldState: WorldState, player: Player): VisibleState;
    /**
     * 过滤障碍物 - 排除玩家自己颜色的障碍物
     *
     * @param obstacles 所有障碍物
     * @param playerColor 玩家颜色
     * @returns 玩家可见的障碍物列表
     *
     * Requirements: 5.1 - 排除自己颜色的障碍物
     * Requirements: 5.2 - 包含其他颜色的障碍物
     */
    filterObstacles(obstacles: Obstacle[], playerColor: PlayerColor): Obstacle[];
    /**
     * 生成近距离提示
     * 当玩家自己颜色的障碍物非常接近时，提供微弱提示
     *
     * @param obstacles 所有障碍物
     * @param player 目标玩家
     * @returns 近距离提示列表
     *
     * Requirements: 5.3 - 近距离提示
     */
    generateProximityHints(obstacles: Obstacle[], player: Player): ProximityHint[];
    /**
     * 计算玩家与障碍物之间的距离
     *
     * @param player 玩家
     * @param obstacle 障碍物
     * @returns 距离值
     */
    private calculateDistance;
    /**
     * 生成玩家分数列表
     * 只包含颜色、距离和存活状态，不包含位置信息
     *
     * @param players 所有玩家
     * @returns 分数列表
     *
     * Requirements: 7.1 - 不暴露其他玩家的路线位置
     */
    private generateScores;
    /**
     * 获取可见性配置常量（用于测试）
     */
    static getVisibilityConfig(): {
        readonly PROXIMITY_HINT_DISTANCE: 3;
        readonly VISIBLE_RANGE: 15;
    };
}
//# sourceMappingURL=visibility-filter.d.ts.map