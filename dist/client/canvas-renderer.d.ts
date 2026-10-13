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
    private scale;
    private layoutParams;
    private layoutMode;
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
    private cachedBackground;
    private cachedVeil;
    constructor();
    init(canvas: HTMLCanvasElement): void;
    /**
     * 从画布元素的 data-* 属性读取显示尺寸，重算内部布局与分辨率。
     * 若尺寸/模式变化则返回 true，调用方需清空渐变缓存并同步 canvas.width/height。
     */
    private applyLayoutFromCanvas;
    setMyPlayer(playerId: string, color: PlayerColor): void;
    resetAll(): void;
    /**
     * 渲染一帧
     *
     * @param state 服务端投影后的可见状态（唯一数据来源，不做任何修改）
     * @param worldYOverride 可选的世界位置覆盖值：仅用于在两帧广播之间做视觉插值，
     *        使画面以显示器刷新率（60Hz+）平滑推进，而不必等待 20Hz 的状态广播。
     *        不传时按状态自身的坐标渲染（离散更新路径）。
     */
    render(state: VisibleState, worldYOverride?: number): void;
    /**
     * 绘制舞台：背景、车道、网格与边框
     *
     * 背景用单位矩阵绘制（覆盖整个画布），
     * 赛道内容（车道、网格、边框）用缩放矩阵绘制，使移动端竖屏时赛道占满宽度。
     */
    clear(): void;
    /**
     * 横向滚动网格线
     * 玩家在车道内横向移动时，格子整体跟着平移半格，使格子中心与玩家/障碍物中心对齐；
     * 纵向按世界坐标换算，因此与障碍物同速同向向下流动，每个障碍物都落在格子里。
     *
     * 注意：调用此方法时，ctx 变换矩阵已包含 offsetX 平移和 scale 缩放，
     * 因此此处坐标全部使用逻辑坐标系（offsetX=0，高度需除以 scale）。
     */
    private renderScrollGrid;
    /**
     * 渲染游戏区域边框
     * 靠近障碍物时边框转为警示色
     *
     * 注意：调用此方法时，ctx 变换矩阵已包含 offsetX 平移和 scale 缩放，
     * 因此此处坐标全部使用逻辑坐标系。
     * 移动端竖屏：边框贴赛道左右边缘，不做圆角（视觉上赛道占满全宽）
     */
    private renderBoundary;
    /**
     * 渲染进行中的画面
     *
     * @param state 服务端状态
     * @param worldYOverride 可选的世界位置插值结果（仅影响取景与绘制位置，不修改任何游戏数据）
     */
    private renderGame;
    /**
     * 渲染死亡提示覆盖层
     *
     * 注意：此方法使用单位矩阵绘制全屏遮罩和文字。
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
     *
     * 注意：调用此方法时，ctx 变换矩阵已包含 offsetX 平移和 scale 缩放，
     * 因此此处坐标全部使用逻辑坐标系。
     */
    private renderObstacles;
    /**
     * 绘制单个障碍物（圆角 + 内高光 + 微弱投影）
     */
    private drawObstacle;
    /**
     * 渲染距离
     * - 桌面/横屏：绘制在游戏区域右侧留白处，不遮挡车道
     * - 移动端竖屏：绘制在左上角，叠加在赛道上方但留足边距，避免遮挡玩家与障碍物
     *
     * 注意：调用此方法时，ctx 变换矩阵已包含 offsetX 平移和 scale 缩放，
     * 因此此处坐标全部使用逻辑坐标系，字体大小需除以 scale。
     */
    private renderDistance;
    /**
     * 等待画面
     * 画布只呈现空舞台（车道与格子）；玩家数、准备状态由 DOM 状态栏与操作按钮承载，
     * 避免在游戏区域内叠加文字或光标造成信息重复。
     *
     * 注意：此方法使用单位矩阵绘制全屏渐变（clear 已用缩放矩阵绘制赛道）。
     */
    private renderWaitingScreen;
    /**
     * 倒计时画面
     *
     * 注意：此方法使用单位矩阵绘制全屏遮罩和文字。
     */
    private renderCountdown;
    private getVeilGradient;
    /**
     * 游戏结束画面
     *
     * 注意：路径和障碍物使用缩放矩阵（逻辑坐标系），遮罩和文字使用单位矩阵。
     */
    private renderGameOver;
    getSize(): {
        width: number;
        height: number;
    };
}
//# sourceMappingURL=canvas-renderer.d.ts.map