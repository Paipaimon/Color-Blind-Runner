/**
 * 视口管理器
 * 处理移动端适配和响应式布局
 * Requirements: 2.1, 2.2, 2.3, 2.4 - 移动端界面适配
 */
/**
 * 设备信息接口
 */
interface DeviceInfo {
    isMobile: boolean;
    isTablet: boolean;
    screenWidth: number;
    screenHeight: number;
    pixelRatio: number;
    orientation: 'portrait' | 'landscape';
}
/**
 * 视口管理器类
 * 处理移动端适配和响应式布局
 */
export declare class ViewportManager {
    private canvas;
    private statusBar;
    private gameWrapper;
    private deviceInfo;
    private resizeObserver;
    private orientationChangeHandler;
    constructor(canvas: HTMLCanvasElement, statusBar: HTMLElement, gameWrapper: HTMLElement);
    /**
     * 初始化视口管理器
     * Requirements: 2.1, 2.2, 2.3, 2.4
     */
    init(): void;
    /**
     * 处理方向变化
     * Requirements: 2.2 - 设备方向改变时重新调整界面布局
     */
    handleOrientationChange(): void;
    /**
     * 移动端适配
     * Requirements: 2.1, 2.3 - 自动调整游戏画布大小，确保UI元素可见
     */
    adjustForMobile(): void;
    /**
     * 检测移动设备
     * 返回设备信息
     */
    private detectDevice;
    /**
     * 计算最优画布尺寸
     * Requirements: 2.1 - 自动调整游戏画布大小以适配屏幕
     * 移动端竖屏时裁剪两边显示更大，占屏幕80%高度
     */
    private calculateOptimalCanvasSize;
    /**
     * 调整画布尺寸
     */
    private adjustCanvasSize;
    /**
     * 调整状态栏布局
     * Requirements: 2.3, 2.4 - 确保UI元素可见，响应式布局
     */
    private adjustStatusBarLayout;
    /**
     * 禁用缩放
     * Requirements: 2.4 - 禁止缩放以保持游戏体验一致性
     */
    private preventZoom;
    /**
     * 更新viewport meta标签
     * Requirements: 2.4 - 更新HTML viewport meta标签配置
     */
    private updateViewportMeta;
    /**
     * 添加移动端特定样式
     */
    private addMobileStyles;
    /**
     * 设置方向变化监听器
     */
    private setupOrientationChangeListener;
    /**
     * 设置窗口大小变化监听器
     */
    private setupResizeListener;
    /**
     * 处理窗口大小变化
     */
    private handleResize;
    /**
     * 获取当前设备信息
     */
    getDeviceInfo(): Readonly<DeviceInfo>;
    /**
     * 销毁视口管理器
     */
    destroy(): void;
}
export {};
//# sourceMappingURL=viewport-manager.d.ts.map