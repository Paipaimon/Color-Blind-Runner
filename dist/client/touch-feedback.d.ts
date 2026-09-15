/**
 * 触控反馈管理器
 * 提供触控操作的视觉反馈效果
 * Requirements: 4.1 - 触控反馈的视觉效果
 */
/**
 * 触控反馈类型枚举
 */
export declare enum TouchFeedbackType {
    SWIPE_LEFT = "swipe-left",
    SWIPE_RIGHT = "swipe-right",
    SWIPE_UP = "swipe-up",
    SWIPE_DOWN = "swipe-down",
    TAP = "tap"
}
/**
 * 触控反馈配置接口
 */
interface TouchFeedbackConfig {
    rippleDuration: number;
    indicatorDuration: number;
    maxFeedbackElements: number;
}
/**
 * 触控反馈管理器类
 * Requirements: 4.1 - 提供视觉反馈指示移动方向
 */
export declare class TouchFeedbackManager {
    private container;
    private config;
    private activeFeedbacks;
    constructor(container: HTMLElement);
    /**
     * 显示触控波纹效果
     * Requirements: 4.1 - 视觉反馈指示移动方向
     */
    showTouchRipple(x: number, y: number, type?: TouchFeedbackType): void;
    /**
     * 显示滑动方向指示器
     * Requirements: 4.1 - 视觉反馈指示移动方向
     */
    showSwipeIndicator(type: TouchFeedbackType): void;
    /**
     * 显示组合反馈效果（波纹 + 方向指示器）
     * Requirements: 4.1 - 完整的触控反馈体验
     */
    showCombinedFeedback(x: number, y: number, type: TouchFeedbackType): void;
    /**
     * 根据滑动类型获取对应图标
     */
    private getSwipeIcon;
    /**
     * 计算波纹大小（根据屏幕尺寸自适应）
     */
    private calculateRippleSize;
    /**
     * 检测是否为移动设备
     */
    private isMobileDevice;
    /**
     * 清理过多的反馈元素
     */
    private cleanupExcessFeedbacks;
    /**
     * 移除反馈元素
     */
    private removeFeedbackElement;
    /**
     * 清理所有活动的反馈元素
     */
    clearAllFeedbacks(): void;
    /**
     * 更新配置
     */
    updateConfig(newConfig: Partial<TouchFeedbackConfig>): void;
    /**
     * 销毁管理器，清理所有资源
     */
    destroy(): void;
}
export {};
//# sourceMappingURL=touch-feedback.d.ts.map