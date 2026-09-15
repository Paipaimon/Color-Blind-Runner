import { SeededRandom } from './seeded-random.js';
import { PlayerColor } from '../shared/types.js';
import { GAME_CONFIG } from '../shared/constants.js';

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
  route: RouteIndex;       // 所在列 (0 到 GRID_COLS-1)
  y: number;               // Y坐标（世界坐标，网格单位）
}

/**
 * 障碍物生成器配置
 */
const OBSTACLE_CONFIG = {
  SPAWN_DISTANCE: 10,      // 生成距离（网格行数）
  MIN_GAP: 2,              // 最小间隔（网格行数）- 减少间隔增加难度
  INITIAL_SPAWN_Y: 3,      // 初始生成位置
} as const;

/**
 * 障碍物生成器
 * 使用种子随机数生成可复现的障碍物序列
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */
export class ObstacleGenerator {
  private random: SeededRandom | null = null;
  private playerColors: PlayerColor[] = [];
  private lastObstacleY: number = 0;
  private obstacleIdCounter: number = 0;

  /**
   * 初始化生成器
   * @param seed 随机种子
   * @param playerColors 当前游戏中的玩家颜色列表
   * 
   * Requirements: 4.4 - 使用种子随机数生成器确保可复现性
   */
  init(seed: number, playerColors: PlayerColor[]): void {
    this.random = new SeededRandom(seed);
    this.playerColors = [...playerColors]; // 复制数组避免外部修改
    this.lastObstacleY = 0;
    this.obstacleIdCounter = 0;
  }

  /**
   * 生成下一批障碍物
   * @param worldPosition 当前世界位置（网格单位）
   */
  generateNext(worldPosition: number): Obstacle[] {
    if (!this.random || this.playerColors.length === 0) {
      throw new Error('ObstacleGenerator not initialized. Call init() first.');
    }

    const obstacles: Obstacle[] = [];
    
    // 计算生成区域：在当前可见区域前方
    // 障碍物Y值越大，在屏幕上越靠上（前方）
    const visibleRows = GAME_CONFIG.GRID_ROWS;
    const spawnStartY = Math.max(
      this.lastObstacleY + OBSTACLE_CONFIG.MIN_GAP,
      worldPosition + visibleRows + 2  // 在可见区域外生成
    );
    const spawnEndY = spawnStartY + OBSTACLE_CONFIG.SPAWN_DISTANCE;

    let nextObstacleY = spawnStartY;

    while (nextObstacleY < spawnEndY) {
      const obstacle = this.generateSingleObstacle(nextObstacleY);
      obstacles.push(obstacle);
      
      // 随机间隔（减少间隔增加难度）
      nextObstacleY += OBSTACLE_CONFIG.MIN_GAP + this.random.nextInt(1, 2);
      this.lastObstacleY = obstacle.y;
    }

    return obstacles;
  }

  /**
   * 生成单个障碍物
   */
  private generateSingleObstacle(y: number): Obstacle {
    if (!this.random) {
      throw new Error('Random generator not initialized');
    }

    // 随机选择列 (0 到 GRID_COLS-1)
    const route = this.random.nextInt(0, GAME_CONFIG.GRID_COLS - 1);
    
    // 随机选择颜色
    const color = this.random.pick(this.playerColors);
    
    const id = `obstacle_${this.obstacleIdCounter++}`;

    return { id, color, route, y };
  }

  /**
   * 重置生成器到初始状态
   * 重置后将产生与初始化时相同的障碍物序列
   */
  reset(): void {
    if (this.random) {
      this.random.reset();
    }
    this.lastObstacleY = 0;
    this.obstacleIdCounter = 0;
  }

  /**
   * 获取当前配置的玩家颜色
   */
  getPlayerColors(): readonly PlayerColor[] {
    return this.playerColors;
  }

  /**
   * 检查生成器是否已初始化
   */
  isInitialized(): boolean {
    return this.random !== null && this.playerColors.length > 0;
  }
}