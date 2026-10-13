/**
 * 游戏配置常量
 */
export const GAME_CONFIG = {
    // 网格设置
    GRID_COLS: 3, // 网格列数（3条路线）
    GRID_ROWS: 12, // 可见网格行数
    CELL_SIZE: 60, // 单元格大小（像素）
    // 游戏区域尺寸（16:9 比例，左右扩展）
    GAME_WIDTH: 1280, // 16:9 比例宽度
    GAME_HEIGHT: 720, // 高度保持 720
    // 游戏区域偏移（3列居中显示）
    GAME_AREA_OFFSET: (1280 - 3 * 60) / 2, // 左侧偏移 = (1280 - 180) / 2 = 550
    // 玩家设置
    PLAYER_SIZE: 30,
    MIN_PLAYERS: 2,
    MAX_PLAYERS: 4,
    // 滚动设置
    INITIAL_SCROLL_SPEED: 2,
    MAX_SCROLL_SPEED: 10,
    SCROLL_ACCELERATION: 0.001,
    // 障碍物设置（网格单位）
    OBSTACLE_MIN_GAP: 2, // 障碍物最小间隔（网格行数）
    // 游戏流程
    COUNTDOWN_SECONDS: 3,
    TICK_RATE: 60,
    STATE_BROADCAST_RATE: 30,
    // 网络设置
    DEFAULT_PORT: 8000,
    HEARTBEAT_INTERVAL: 30000,
    CONNECTION_TIMEOUT: 60000
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
export function computeLayoutParams(displayWidth, displayHeight) {
    const ratio = displayWidth / displayHeight;
    const isMobilePortrait = ratio < 1;
    if (!isMobilePortrait) {
        return {
            mode: 'desktop',
            gameWidth: GAME_CONFIG.GAME_WIDTH,
            gameHeight: GAME_CONFIG.GAME_HEIGHT,
            cellSize: GAME_CONFIG.CELL_SIZE,
            offsetX: GAME_CONFIG.GAME_AREA_OFFSET,
            scale: 1
        };
    }
    const internalWidth = 720;
    const internalHeight = 1280;
    const laneWidthRatio = 0.98;
    const targetLaneWidth = internalWidth * laneWidthRatio;
    const logicalLaneWidth = GAME_CONFIG.GRID_COLS * GAME_CONFIG.CELL_SIZE; // 3 * 60 = 180
    const scale = targetLaneWidth / logicalLaneWidth;
    const actualLaneWidth = logicalLaneWidth * scale;
    const offsetX = Math.max(0, Math.floor((internalWidth - actualLaneWidth) / 2));
    return {
        mode: 'mobile-portrait',
        gameWidth: internalWidth,
        gameHeight: internalHeight,
        cellSize: GAME_CONFIG.CELL_SIZE,
        offsetX,
        scale
    };
}
//# sourceMappingURL=constants.js.map