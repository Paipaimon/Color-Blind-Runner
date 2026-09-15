/**
 * 游戏提示悬浮组件
 * 显示游戏操作提示和帮助信息
 */
/**
 * 游戏提示管理器类
 */
export declare class GameTipsManager {
    private container;
    private tipsButton;
    private tipsPanel;
    private isVisible;
    private isMobile;
    constructor();
    /**
     * 检测移动设备
     */
    private detectMobileDevice;
    /**
     * 创建提示UI
     */
    private createTipsUI;
    /**
     * 生成提示内容
     */
    private generateTipsContent;
    /**
     * 添加样式
     */
    private addStyles;
    /**
     * 设置事件监听器
     */
    private setupEventListeners;
    /**
     * 切换提示显示
     */
    private toggleTips;
    /**
     * 显示提示
     */
    private showTips;
    /**
     * 隐藏提示
     */
    private hideTips;
    /**
     * 更新提示内容
     */
    private updateTipsContent;
    /**
     * 显示脉冲动画（用于吸引注意）
     */
    showPulse(): void;
    /**
     * 隐藏脉冲动画
     */
    hidePulse(): void;
    /**
     * 销毁组件
     */
    destroy(): void;
}
//# sourceMappingURL=game-tips.d.ts.map