/**
 * 触控输入处理器
 * 检测滑动手势并通过输入合并器处理输入命令
 * Requirements: 1.1, 1.2, 1.3, 4.2, 4.3, 5.1, 4.1
 */
import { PlayerInput } from '../shared/messages.js';
import { InputMerger } from './input-merger.js';
import { TouchFeedbackManager } from './touch-feedback.js';
/**
 * 触控输入处理器类
 * 检测滑动手势并通过输入合并器处理输入命令
 */
export declare class TouchHandler {
    private element;
    private inputMerger;
    private feedbackManager;
    private feedbackElement;
    private isEnabled;
    private isBound;
    private touchStartX;
    private touchStartY;
    private touchStartTime;
    private currentInput;
    private readonly config;
    private lastInputTime;
    private debounceTimer;
    private touchStartHandler;
    private touchMoveHandler;
    private touchEndHandler;
    constructor(element: HTMLElement, inputMerger: InputMerger, feedbackLayer?: HTMLElement | null);
    /**
     * 绑定触控事件
     * Requirements: 1.1, 1.2 - 检测左右滑动手势
     */
    bind(): void;
    /**
     * 解绑触控事件
     * Requirements: 1.3 - 停止发送移动命令
     */
    unbind(): void;
    /**
     * 获取当前输入状态（只读）
     */
    getCurrentInput(): Readonly<PlayerInput>;
    /**
     * 处理触控开始事件
     * Requirements: 4.4 - 只处理第一个触控点
     */
    private handleTouchStart;
    /**
     * 处理触控移动事件
     * Requirements: 1.4 - 阻止页面滚动和其他默认触摸行为
     */
    private handleTouchMove;
    /**
     * 处理触控结束事件
     * Requirements: 1.1, 1.2, 1.3, 4.2, 4.3, 4.1 - 检测滑动手势并转换为输入命令，显示视觉反馈
     */
    private handleTouchEnd;
    /**
     * 检测滑动方向
     * Requirements: 4.2, 4.3 - 实现手势过滤逻辑（最小距离、最大时间）
     */
    private detectSwipeDirection;
    /**
     * 根据滑动方向更新输入状态
     * Requirements: 1.1, 1.2 - 左右滑动转换为移动输入命令
     */
    private updateInputFromSwipe;
    /**
     * 重置输入状态
     * Requirements: 1.3 - 停止发送移动命令
     */
    private resetInput;
    /**
     * 通知输入合并器触控输入状态变化
     * Requirements: 5.1 - 防抖机制避免过度频繁输入
     */
    private notifyInputMerger;
    /**
     * 实际通知输入合并器
     */
    private doNotifyInputMerger;
    /**
     * 显示滑动反馈效果
     * Requirements: 4.1 - 提供视觉反馈指示移动方向
     */
    private showSwipeFeedback;
    /**
     * 获取触控反馈管理器（用于外部配置）
     */
    getFeedbackManager(): TouchFeedbackManager;
    /**
     * 销毁触控处理器，清理所有资源
     */
    destroy(): void;
}
//# sourceMappingURL=touch-handler.d.ts.map