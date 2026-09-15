/**
 * 增强状态栏渲染器
 * 显示详细的游戏信息和统计数据，支持移动端响应式布局
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5 - 增强状态栏信息显示
 */
import { VisibleState, PlayerColor } from '../shared/types.js';
/**
 * 游戏统计数据接口
 */
export interface GameStats {
    distance: number;
    survivalTime: number;
    averageSpeed: number;
    maxSpeed: number;
    totalMoves: number;
    deathReason?: string;
    personalBest?: number;
}
/**
 * 玩家排名信息接口
 */
export interface PlayerRanking {
    playerId: string;
    playerColor: PlayerColor;
    distance: number;
    survivalTime: number;
    rank: number;
}
/**
 * 设备信息接口
 */
export interface DeviceInfo {
    isMobile: boolean;
    isTablet: boolean;
    screenWidth: number;
    screenHeight: number;
    pixelRatio: number;
    orientation: 'portrait' | 'landscape';
}
/**
 * 增强状态栏渲染器类
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5 - 显示详细游戏信息，支持移动端适配
 */
export declare class StatusBarRenderer {
    private container;
    private gameStats;
    private isMobile;
    private deviceInfo;
    private animationFrameId;
    private lastUpdateTime;
    private gameStartTime;
    private totalMoves;
    private maxSpeed;
    private personalBest;
    constructor(container: HTMLElement);
    /**
     * 检测设备信息
     * Requirements: 3.4 - 移动端响应式状态栏布局
     */
    private detectDeviceInfo;
    /**
     * 从本地存储加载个人最佳成绩
     */
    private loadPersonalBest;
    /**
     * 保存个人最佳成绩到本地存储
     */
    private savePersonalBest;
    /**
     * 设置移动端模式
     * Requirements: 3.4 - 移动端响应式状态栏布局
     */
    setMobileMode(isMobile: boolean): void;
    /**
     * 根据设备调整布局
     * Requirements: 3.4 - 移动端响应式状态栏布局
     */
    private adjustLayoutForDevice;
    /**
     * 主渲染方法
     * Requirements: 3.1, 3.2, 3.3 - 显示游戏状态、死亡信息、排名信息
     */
    render(state: VisibleState, playerId: string, roomId?: string, playerColor?: PlayerColor): void;
    /**
     * 渲染等待状态
     */
    private renderWaitingState;
    /**
     * 渲染游戏进行状态
     * Requirements: 3.1 - 显示距离、存活时间、速度
     */
    private renderPlayingState;
    /**
     * 渲染游戏结束状态
     * Requirements: 3.2, 3.3 - 显示死亡信息（移除排行榜显示）
     */
    private renderGameOverState;
    /**
     * 创建基本信息区域
     */
    private createBasicInfoSection;
    /**
     * 创建游戏统计区域
     * Requirements: 3.1 - 显示距离、存活时间（移除速度显示）
     */
    private createGameStatsSection;
    /**
     * 创建最终统计区域
     * Requirements: 3.2 - 显示最终统计数据（移除最高速度显示）
     */
    private createFinalStatsSection;
    /**
     * 创建排名区域
     * Requirements: 3.3 - 显示排名信息
     */
    private createRankingSection;
    /**
     * 创建个人最佳成绩区域
     * Requirements: 3.3 - 个人最佳成绩对比
     */
    private createPersonalBestSection;
    /**
     * 创建颜色指示器
     */
    private createColorIndicator;
    /**
     * 创建统计项目元素
     */
    private createStatItem;
    /**
     * 从游戏状态更新统计数据
     * Requirements: 3.1 - 实时更新游戏统计
     */
    private updateGameStatsFromState;
    /**
     * 计算玩家排名
     * Requirements: 3.3 - 排名计算
     */
    private calculatePlayerRanking;
    /**
     * 格式化时间显示
     */
    private formatTime;
    /**
     * 更新游戏统计数据（外部调用）
     */
    updateGameStats(stats: Partial<GameStats>): void;
    /**
     * 增加移动次数计数
     */
    incrementMoveCount(): void;
    /**
     * 启动平滑动画更新
     * Requirements: 3.5 - 平滑动画过渡效果
     */
    startAnimation(): void;
    /**
     * 停止动画更新
     */
    stopAnimation(): void;
    /**
     * 销毁渲染器，清理资源
     */
    destroy(): void;
}
//# sourceMappingURL=status-bar-renderer.d.ts.map