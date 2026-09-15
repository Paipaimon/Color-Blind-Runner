/**
 * 游戏配置常量
 */
export const GAME_CONFIG = {
  // 网格设置
  GRID_COLS: 3,           // 网格列数（3条路线）
  GRID_ROWS: 12,          // 可见网格行数
  CELL_SIZE: 60,          // 单元格大小（像素）

  // 游戏区域尺寸（16:9 比例，左右扩展）
  GAME_WIDTH: 1280,       // 16:9 比例宽度
  GAME_HEIGHT: 720,       // 高度保持 720
  
  // 游戏区域偏移（3列居中显示）
  GAME_AREA_OFFSET: (1280 - 3 * 60) / 2,  // 左侧偏移 = (1280 - 180) / 2 = 550

  // 玩家设置
  PLAYER_SIZE: 30,
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 4,

  // 滚动设置
  INITIAL_SCROLL_SPEED: 2,
  MAX_SCROLL_SPEED: 10,
  SCROLL_ACCELERATION: 0.001,

  // 障碍物设置（网格单位）
  OBSTACLE_MIN_GAP: 2,    // 障碍物最小间隔（网格行数）

  // 游戏流程
  COUNTDOWN_SECONDS: 3,
  TICK_RATE: 60,
  STATE_BROADCAST_RATE: 30,

  // 网络设置
  DEFAULT_PORT: 8000,
  HEARTBEAT_INTERVAL: 30000,
  CONNECTION_TIMEOUT: 60000
} as const;

/**
 * 游戏配置类型
 */
export type GameConfig = typeof GAME_CONFIG;
