/**
 * 画布渲染器 - 网格布局版本
 * 玩家固定在底部，视角向上移动，障碍物相对向下滚动
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
    init(canvas: HTMLCanvasElement): void;
    setMyPlayer(playerId: string, color: PlayerColor): void;
    resetAll(): void;
    render(state: VisibleState): void;
    clear(): void;
    /**
     * 渲染游戏区域边界
     * 靠近障碍物时边界变红
     */
    private renderBoundary;
    private renderGame;
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
     * 渲染距离
     */
    private renderDistance;
    private renderWaitingScreen;
    private renderCountdown;
    private renderGameOver;
    getSize(): {
        width: number;
        height: number;
    };
}
//# sourceMappingURL=canvas-renderer.d.ts.map