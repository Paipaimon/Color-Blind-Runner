/**
 * 碰撞检测器单元测试
 * 验证碰撞检测逻辑的正确性
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CollisionDetector, Player, Obstacle, CollisionResult } from './collision-detector.js';
import { PlayerColor } from '../shared/types.js';

describe('CollisionDetector', () => {
  let detector: CollisionDetector;

  beforeEach(() => {
    detector = new CollisionDetector();
  });

  describe('checkCollision', () => {
    it('should detect collision when player and obstacle have same color and route', () => {
      const player: Player = {
        id: 'player1',
        color: PlayerColor.RED,
        route: 1,
        alive: true,
        distance: 100,
        ready: true
      };

      const obstacle: Obstacle = {
        id: 'obstacle1',
        color: PlayerColor.RED,
        route: 1,
        y: 100
      };

      const result = detector.checkCollision(player, [obstacle]);
      expect(result).toBe(obstacle);
    });

    it('should not detect collision when colors are different', () => {
      const player: Player = {
        id: 'player1',
        color: PlayerColor.RED,
        route: 1,
        alive: true,
        distance: 100,
        ready: true
      };

      const obstacle: Obstacle = {
        id: 'obstacle1',
        color: PlayerColor.BLUE,
        route: 1,
        y: 100
      };

      const result = detector.checkCollision(player, [obstacle]);
      expect(result).toBe(null);
    });

    it('should not detect collision when routes are different', () => {
      const player: Player = {
        id: 'player1',
        color: PlayerColor.RED,
        route: 0,
        alive: true,
        distance: 100,
        ready: true
      };

      const obstacle: Obstacle = {
        id: 'obstacle1',
        color: PlayerColor.RED,
        route: 1,
        y: 100
      };

      const result = detector.checkCollision(player, [obstacle]);
      expect(result).toBe(null);
    });

    it('should not detect collision when player is dead', () => {
      const player: Player = {
        id: 'player1',
        color: PlayerColor.RED,
        route: 1,
        alive: false, // 死亡玩家
        distance: 100,
        ready: true
      };

      const obstacle: Obstacle = {
        id: 'obstacle1',
        color: PlayerColor.RED,
        route: 1,
        y: 100
      };

      const result = detector.checkCollision(player, [obstacle]);
      expect(result).toBe(null);
    });

    it('should not detect collision when positions do not overlap', () => {
      const player: Player = {
        id: 'player1',
        color: PlayerColor.RED,
        route: 1,
        alive: true,
        distance: 50, // 远离障碍物
        ready: true
      };

      const obstacle: Obstacle = {
        id: 'obstacle1',
        color: PlayerColor.RED,
        route: 1,
        y: 200 // 远离玩家
      };

      const result = detector.checkCollision(player, [obstacle]);
      expect(result).toBe(null);
    });
  });

  describe('checkAllCollisions', () => {
    it('should detect multiple collisions', () => {
      const players: Player[] = [
        {
          id: 'player1',
          color: PlayerColor.RED,
          route: 1,
          alive: true,
          distance: 100,
          ready: true
        },
        {
          id: 'player2',
          color: PlayerColor.BLUE,
          route: 2,
          alive: true,
          distance: 150,
          ready: true
        }
      ];

      const obstacles: Obstacle[] = [
        {
          id: 'obstacle1',
          color: PlayerColor.RED,
          route: 1,
          y: 100
        },
        {
          id: 'obstacle2',
          color: PlayerColor.BLUE,
          route: 2,
          y: 150
        }
      ];

      const results = detector.checkAllCollisions(players, obstacles);
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        playerId: 'player1',
        obstacleId: 'obstacle1'
      });
      expect(results[1]).toEqual({
        playerId: 'player2',
        obstacleId: 'obstacle2'
      });
    });

    it('should return empty array when no collisions occur', () => {
      const players: Player[] = [
        {
          id: 'player1',
          color: PlayerColor.RED,
          route: 1,
          alive: true,
          distance: 100,
          ready: true
        }
      ];

      const obstacles: Obstacle[] = [
        {
          id: 'obstacle1',
          color: PlayerColor.BLUE, // 不同颜色
          route: 1,
          y: 100
        }
      ];

      const results = detector.checkAllCollisions(players, obstacles);
      expect(results).toHaveLength(0);
    });
  });
});