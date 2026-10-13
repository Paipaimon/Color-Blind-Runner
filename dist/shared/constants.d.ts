/**
 * 布局模式
 * - desktop: 桌面端 / 横屏，保持 16:9 横向宽幅布局
 * - mobile-portrait: 移动端竖屏，赛道占满左右，充分利用窄屏宽度
 */
export type LayoutMode = 'desktop' | 'mobile-portrait';
/**
 * 动态布局参数（由画布渲染器根据显示比例计算）
 *
 * 注意：内部逻辑坐标系恒为 1280×720、CELL_SIZE=60，
 * 服务端按此坐标系发送 position.x（route * 60 + 30）。
 * 移动端竖屏通过 scale + offsetX 做视觉缩放，不修改 cellSize，
 * 保证客户端列计算 Math.floor(position.x / cellSize) 与服务端一致。
 */
export interface LayoutParams {
    mode: LayoutMode;
    gameWidth: number;
    gameHeight: number;
    cellSize: number;
    offsetX: number;
    /** 视觉缩放因子：移动端竖屏时放大以占满宽度 */
    scale: number;
}
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
 * 响应式布局参数计算
 * 根据画布显示的宽高比，决定布局模式与动态参数。
 *
 * 原则：
 *  - 内部逻辑坐标系恒为 1280×720、CELL_SIZE=60（与服务端一致）
 *  - 桌面端 / 横屏：保持原设计，scale=1
 *  - 移动端竖屏：画布内部分辨率切换为 9:16 竖版（720×1280），
 *    通过 scale 放大 3 条车道，使其横向占画布 98%，
 *    offsetX 用于居中（左右各留约 1% 安全边距）
 *
 * @param displayWidth  画布 CSS 显示宽度
 * @param displayHeight 画布 CSS 显示高度
 */
export declare function computeLayoutParams(displayWidth: number, displayHeight: number): LayoutParams;
/**
 * 游戏配置类型
 */
export type GameConfig = typeof GAME_CONFIG;
//# sourceMappingURL=constants.d.ts.map