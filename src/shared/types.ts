/**
 * 玩家颜色枚举
 * 每个玩家被分配一种颜色，决定其可见性规则
 */
export enum PlayerColor {
  RED = 'RED',
  GREEN = 'GREEN',
  BLUE = 'BLUE',
  YELLOW = 'YELLOW'
}

/**
 * 障碍物颜色枚举
 * 障碍物颜色决定哪些玩家可以看到它
 */
export enum ObstacleColor {
  RED = 'RED',
  GREEN = 'GREEN',
  BLUE = 'BLUE',
  YELLOW = 'YELLOW',   // RED + GREEN 可见
  CYAN = 'CYAN',       // GREEN + BLUE 可见
  MAGENTA = 'MAGENTA', // RED + BLUE 可见
  WHITE = 'WHITE'      // 所有玩家可见
}

/**
 * 2D 位置坐标
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * 玩家状态
 */
export interface Player {
  id: string;
  color: PlayerColor;
  position: Position;
  isAlive: boolean;
  distance?: number;  // 玩家行驶距离
}

/**
 * 障碍物定义
 */
export interface Obstacle {
  id: string;
  color: ObstacleColor;
  position: Position;
  width: number;
  height: number;
}

/**
 * 房间状态
 */
export interface Room {
  id: string;
  players: Map<string, Player>;
  obstacles: Obstacle[];
  scrollSpeed: number;
  gameState: GameState;
  startTime: number | null;
}

/**
 * 游戏状态枚举
 */
export enum GameState {
  WAITING = 'WAITING',
  COUNTDOWN = 'COUNTDOWN',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

/**
 * 近距离提示
 * 当玩家自己颜色的障碍物接近时提供警告
 */
export interface ProximityHint {
  route: number;      // 障碍物所在的路线（列）
  intensity: number;  // 提示强度 0-1，越近越强
}

/**
 * 玩家可见的游戏状态
 * 根据玩家颜色过滤后的视图
 */
export interface VisibleState {
  players: Player[];
  obstacles: Obstacle[];
  scrollSpeed: number;
  gameState: GameState;
  countdown?: number;
  proximityHints?: ProximityHint[];  // 近距离提示（自己颜色的障碍物接近时）
}

/**
 * 颜色可见性映射
 * 定义每种玩家颜色可以看到哪些障碍物颜色
 */
export const COLOR_VISIBILITY: Record<PlayerColor, ObstacleColor[]> = {
  [PlayerColor.RED]: [
    ObstacleColor.RED,
    ObstacleColor.YELLOW,
    ObstacleColor.MAGENTA,
    ObstacleColor.WHITE
  ],
  [PlayerColor.GREEN]: [
    ObstacleColor.GREEN,
    ObstacleColor.YELLOW,
    ObstacleColor.CYAN,
    ObstacleColor.WHITE
  ],
  [PlayerColor.BLUE]: [
    ObstacleColor.BLUE,
    ObstacleColor.CYAN,
    ObstacleColor.MAGENTA,
    ObstacleColor.WHITE
  ],
  [PlayerColor.YELLOW]: [
    ObstacleColor.YELLOW,
    ObstacleColor.WHITE
  ]
};
