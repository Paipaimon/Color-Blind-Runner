/**
 * 游戏配置常量
 */
export declare const GAME_CONFIG: {
    readonly GRID_COLS: 3;
    readonly GRID_ROWS: 12;
    readonly CELL_SIZE: 60;
    readonly GAME_WIDTH: 1280;
    readonly GAME_HEIGHT: 720;
    readonly GAME_AREA_OFFSET: number;
    readonly PLAYER_SIZE: 30;
    readonly MIN_PLAYERS: 2;
    readonly MAX_PLAYERS: 4;
    readonly INITIAL_SCROLL_SPEED: 2;
    readonly MAX_SCROLL_SPEED: 10;
    readonly SCROLL_ACCELERATION: 0.001;
    readonly OBSTACLE_MIN_GAP: 2;
    readonly COUNTDOWN_SECONDS: 3;
    readonly TICK_RATE: 60;
    readonly STATE_BROADCAST_RATE: 30;
    readonly DEFAULT_PORT: 8000;
    readonly HEARTBEAT_INTERVAL: 30000;
    readonly CONNECTION_TIMEOUT: 60000;
};
/**
 * 游戏配置类型
 */
export type GameConfig = typeof GAME_CONFIG;
//# sourceMappingURL=constants.d.ts.map