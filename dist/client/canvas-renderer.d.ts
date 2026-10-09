/**
 * 画布渲染器 - 网格布局版本
 * 玩家固定在底部，视角向上移动，障碍物相对向下滚动
 *
 * 本次 UI 重构说明：
 * - 渲染几何、坐标换算、状态缓存与数据来源（服务端投影后的可见状态）完全保持不变。
 * - 仅重做视觉层：统一主题色、渐变背景、车道框架、发光轨迹、圆角障碍物与排版。
 */
import { VisibleState, PlayerColor } from '../shared/types.js';
export declare class CanvasRenderer {
    private canvas;
    private ctx;
    private width;
    private height;
    private cellSize;
    private offsetX;
    private myPlayerId;
    private myPlayerColor;
    private pathPoints;
    private currentCol;
    private obstacleCache;
    private distance;
    private startWorldY;
    private gameStarted;
    private isDead;
    private deathDistance;
    private finalState;
    private isDanger;
    private dangerIntensity;
    private scrollWorldY;
    init(canvas: HTMLCanvasElement): void;
    setMyPlayer(playerId: string, color: PlayerColor): void;
    resetAll(): void;
    render(state: VisibleState): void;
    /**
     * 绘制舞台：背景、车道、网格与边框
     */
    clear(): void;
    /**
     * 横向滚动网格线
     * 使用与障碍物相同的世界滚动换算，因此不需要额外状态
     */
    private renderScrollGrid;
    /** 当前世界滚动位置（用于网格滚动，纯视觉） */
    /**
     * 渲染游戏区域边框
     * 靠近障碍物时边框转为警示色
     */
    private renderBoundary;
    private renderGame;
    /**
     * 渲染玩家本体：底部车道上的圆角光块
     */
    private renderPlayer;
    /**
     * 渲染死亡提示覆盖层
     */
    private renderDeathOverlay;
    /**
     * 保存最终状态
     */
    private saveFinalState;
    /**
     * 更新障碍物缓存
     * 玩家在底部，障碍物从顶部出现
     */
    private updateObstacleCache;
    /**
     * 检测是否靠近自己颜色的障碍物
     * 使用服务器发送的proximityHints来判断危险
     */
    private checkDanger;
    /**
     * 更新路径
     * 不清除历史路径点，始终保留完整痕迹
     */
    private updatePath;
    /**
     * 渲染路径线
     * 玩家在底部，痕迹向下延伸到屏幕外（表示走过的路径）
     */
    private renderPath;
    /**
     * 渲染障碍物（从缓存）
     * 玩家在底部，障碍物从顶部向下滚动
     */
    private renderObstacles;
    /**
     * 绘制单个障碍物（圆角 + 内高光 + 微弱投影）
     */
    private drawObstacle;
    /**
     * 渲染距离
     * 绘制在游戏区域右侧留白处，不遮挡车道
     */
    private renderDistance;
    /**
     * 等待画面
     * 画布只呈现空舞台；玩家数、房间号、准备状态由 DOM 状态栏与操作按钮承载，
     * 避免在游戏区域内叠加文字造成信息重复。
     */
    private renderWaitingScreen;
    /**
     * 倒计时画面
     */
    private renderCountdown;
    /**
     * 游戏结束画面
     */
    private renderGameOver;
    getSize(): {
        width: number;
        height: number;
    };
}
//# sourceMappingURL=canvas-renderer.d.ts.map