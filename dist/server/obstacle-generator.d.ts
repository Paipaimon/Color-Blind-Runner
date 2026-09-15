import { PlayerColor } from '../shared/types.js';
/**
 * 路线索引类型 (0 到 GRID_COLS-1)
 */
export type RouteIndex = number;
/**
 * 障碍物接口
 */
export interface Obstacle {
    id: string;
    color: PlayerColor;
    route: RouteIndex;
    y: number;
}
/**
 * 障碍物生成器
 * 使用种子随机数生成可复现的障碍物序列
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */
export declare class ObstacleGenerator {
    private random;
    private playerColors;
    private lastObstacleY;
    private obstacleIdCounter;
    /**
     * 初始化生成器
     * @param seed 随机种子
     * @param playerColors 当前游戏中的玩家颜色列表
     *
     * Requirements: 4.4 - 使用种子随机数生成器确保可复现性
     */
    init(seed: number, playerColors: PlayerColor[]): void;
    /**
     * 生成下一批障碍物
     * @param worldPosition 当前世界位置（网格单位）
     */
    generateNext(worldPosition: number): Obstacle[];
    /**
     * 生成单个障碍物
     */
    private generateSingleObstacle;
    /**
     * 重置生成器到初始状态
     * 重置后将产生与初始化时相同的障碍物序列
     */
    reset(): void;
    /**
     * 获取当前配置的玩家颜色
     */
    getPlayerColors(): readonly PlayerColor[];
    /**
     * 检查生成器是否已初始化
     */
    isInitialized(): boolean;
}
//# sourceMappingURL=obstacle-generator.d.ts.map