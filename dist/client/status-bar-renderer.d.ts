/**
 * 增强状态栏渲染器
 * 显示详细的游戏信息和统计数据，支持移动端响应式布局
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5 - 增强状态栏信息显示
 *
 * 实现要点（本次 UI 重构）：
 * - DOM 结构在构造时一次性建立并按数据槽（data-slot）缓存，渲染时只增量更新文本与类名，
 *   避免旧实现每帧 innerHTML 重建导致的样式抖动与性能浪费。
 * - 对外的公开方法签名保持不变，index.ts / viewport-manager.ts 无需感知内部变化。
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
    private gameStartTime;
    private totalMoves;
    private maxSpeed;
    private personalBest;
    private bestSaved;
    /** 当前渲染的布局模式，用于判断是否需要重建区块结构 */
    private layout;
    /** 自身颜色（由 render 传入并记忆，供结束态复用） */
    private myPlayerColor;
    /** 上一次已知的房间人数（等待阶段服务端不下发玩家列表时沿用） */
    private lastKnownPlayerCount;
    /** DOM 数据槽缓存 */
    private roomChip;
    private pipsWrap;
    private countBadge;
    private colorDot;
    private colorValue;
    private statePill;
    private statsSection;
    private distanceValue;
    private timeValue;
    private resultSection;
    private bestSection;
    /** 上一次写入的文本，避免重复赋值触发重排 */
    private lastText;
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
     * Requirements: 3.1, 3.2, 3.3 - 显示游戏状态、死亡信息
     */
    render(state: VisibleState, playerId: string, roomId?: string, playerColor?: PlayerColor): void;
    /**
     * 构建 / 切换状态栏骨架
     * 仅在布局模式变化时重建节点，其余情况复用已有 DOM
     */
    private applyLayout;
    /**
     * 创建「标签 + 数值」的统计单元
     */
    private createValueItem;
    /**
     * 创建最终成绩区块
     */
    private createResultSection;
    /**
     * 解析当前房间人数
     * 大厅等待阶段服务端不下发玩家列表，此时沿用上一次已知人数，避免回落到 0。
     */
    private resolvePlayerCount;
    /**
     * 更新基础信息区（房间号 / 玩家数 / 自身颜色）
     */
    private updateBasicInfo;
    /**
     * 更新状态胶囊：等待 / 倒计时 / 进行中 / 已死亡 / 结束
     */
    private updateStatePill;
    /**
     * 刷新数值槽（距离 / 时间 / 最终成绩）
     * Requirements: 3.1 - 显示距离、存活时间
     */
    private refreshValueSlots;
    /**
     * 渲染个人最佳对比
     * Requirements: 3.3 - 个人最佳成绩对比
     */
    private renderPersonalBestSection;
    /**
     * 创建统计项目元素
     */
    private createStatItem;
    /**
     * 创建颜色指示器（保留旧接口，供外部复用）
     */
    private createColorIndicator;
    /**
     * 从游戏状态更新统计数据
     * Requirements: 3.1 - 实时更新游戏统计
     */
    private updateGameStatsFromState;
    /**
     * 计算玩家排名（保留接口能力，当前界面不展示排行榜）
     * Requirements: 3.3 - 排名计算
     */
    private calculatePlayerRanking;
    /**
     * 格式化时间显示
     */
    private formatTime;
    /**
     * 文本写入（带脏检查）
     */
    private setText;
    /**
     * 清空文本缓存（结构重建后调用）
     */
    private clearSlotCache;
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
     * 仅刷新时间槽，不重建任何 DOM
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