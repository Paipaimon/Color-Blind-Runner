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
 * 碰撞配置（网格单位）
 */
const COLLISION_CONFIG = {
  TOLERANCE: 0.5,          // 碰撞容差（网格单位）
} as const;

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
export class CollisionDetector {
  
  /**
   * 检测单个玩家与障碍物列表的碰撞
   * 
   * @param player 玩家对象
   * @param obstacles 障碍物列表
   * @returns 发生碰撞的障碍物，如果没有碰撞则返回null
   * 
   * Requirements: 6.1 - 玩家与同色障碍物碰撞检测
   */
  checkCollision(player: Player, obstacles: Obstacle[]): Obstacle | null {
    // 死亡玩家不参与碰撞检测
    if (!player.alive) {
      return null;
    }

    // 遍历所有障碍物，检查碰撞
    for (const obstacle of obstacles) {
      if (this.isColliding(player, obstacle)) {
        return obstacle;
      }
    }

    return null;
  }

  /**
   * 检测所有玩家与障碍物的碰撞
   * 
   * @param players 玩家列表
   * @param obstacles 障碍物列表
   * @returns 所有碰撞结果的数组
   * 
   * Requirements: 6.1 - 批量碰撞检测
   */
  checkAllCollisions(players: Player[], obstacles: Obstacle[]): CollisionResult[] {
    const collisions: CollisionResult[] = [];

    for (const player of players) {
      const collidedObstacle = this.checkCollision(player, obstacles);
      if (collidedObstacle) {
        collisions.push({
          playerId: player.id,
          obstacleId: collidedObstacle.id
        });
      }
    }

    return collisions;
  }

  /**
   * 检测单个玩家与单个障碍物是否碰撞
   * 
   * 碰撞条件：
   * 1. 玩家与障碍物颜色相同
   * 2. 玩家与障碍物在同一路线
   * 3. 玩家位置与障碍物位置重叠
   */
  private isColliding(player: Player, obstacle: Obstacle): boolean {
    // 条件1：只有同色才会碰撞
    if (player.color !== obstacle.color) {
      return false;
    }

    // 条件2：必须在同一路线
    if (player.route !== obstacle.route) {
      return false;
    }

    // 条件3：位置重叠检测（网格单位）
    const playerY = player.distance;
    const obstacleY = obstacle.y;
    
    // 检查Y轴重叠（考虑容差）
    const isYOverlap = Math.abs(playerY - obstacleY) <= COLLISION_CONFIG.TOLERANCE;

    return isYOverlap;
  }

  static getCollisionConfig() {
    return COLLISION_CONFIG;
  }
}