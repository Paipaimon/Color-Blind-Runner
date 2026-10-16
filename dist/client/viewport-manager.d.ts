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
     * 计算并应用画布显示尺寸
     *
     * - 桌面端 / 横屏：保持 16:9 横向宽幅，沿用原逻辑等比缩放。
     * - 移动端竖屏：宽度直接占满可用舞台宽度（仅留 2px 安全边距），
     *   高度按 9:16 竖版比例推导，使画布整体接近屏幕比例，
     *   避免上下过度留白；同时写入 data-layout="mobile-portrait"
     *   供渲染器切换内部布局（赛道横向占满、单元格放大）。
     */
    private applyCanvasWidth;
    /**
     * 当前是否为「移动端触控设备 + 对局中 + 竖屏」
     * 三者同时满足时界面框架会被隐藏（客户端在 .game-wrapper 上标记 data-playing），
     * 画布需要改为铺满视口并贴底。
     */
    private isMobilePlayStage;
    /**
     * 重新量取布局（供外部在 DOM/HUD 结构变化后调用）
     * 例如移动端进入对局隐藏 HUD、进出全屏后视口尺寸变化时。
     */
    refreshLayout(): void;
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
     *
     * 注：CSS 已设置 viewport meta、touch-action: none/manipulation 与 overscroll-behavior: none，
     *     已能阻止双击缩放、回弹滚动与页面缩放。此处仅保留 iOS Safari 特有的 pinch 手势监听，
     *     避免全局 touchend/dblclick 拦截与游戏触控输入冲突。
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
     *
     * 监听 .game-stage 而非 document.body：
     * .game-stage 的高度由 flex 分配，会随状态栏内容变化（特别是移动端竖屏下状态栏换行），
     * 只有它的尺寸变化才需要重新计算画布大小，避免 body 高度不变时错过重排。
     */
    private setupResizeListener;
    /**
     * 处理窗口大小变化
     * 注意：这里只重算画布与状态栏布局，且画布尺寸类名/CSS 变量是幂等的，
     * 避免 ResizeObserver 因自身改动再次触发导致抖动。
     */
    handleResize(): void;
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