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
    /** 上一次写入的舞台高度，用于避免重复写 CSS 变量引发无意义重排 */
    private lastStageHeight;
    /** 上一次写入的画布显示宽度 */
    private lastCanvasWidth;
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
     * 测量游戏舞台的实际可用高度并写入 CSS 变量
     * 该值决定画布按 16:9 能占用的最大高度，避免出现上下留白或溢出错位。
     */
    private updateStageHeight;
    /**
     * 计算并应用画布显示宽度
     * 以「舞台实测高度 × 16/9」为基准，再与可用宽度取较小值，
     * 保证画布在舞台内等比铺满：竖屏移动端额外限制为屏幕高度的 80%（沿用既有适配规则）。
     */
    private applyCanvasWidth;
    /**
     * 调整画布显示尺寸
     * 显示尺寸由 applyCanvasWidth 直接写入（宽 + 高 + 内部分辨率同步），
     * 保证在任何视口下都严格保持 16:9，不依赖 CSS 对 canvas 固有比例的推导。
     * Requirements: 2.1, 2.4
     */
    private adjustCanvasSize;
    /**
     * 调整状态栏布局
     * Requirements: 2.3, 2.4 - 确保UI元素可见，响应式布局
     *
     * 说明（UI 重构）：仅切换类名，具体尺寸/间距/换行规则由样式表定义，
     * 避免内联样式与 CSS 相互覆盖。
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
     * 注意：这里只重算画布与状态栏布局，且画布尺寸类名/CSS 变量是幂等的，
     * 避免 ResizeObserver 因自身改动再次触发导致抖动。
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