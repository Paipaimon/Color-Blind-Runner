/**
 * 视口管理器
 * 处理移动端适配和响应式布局
 * Requirements: 2.1, 2.2, 2.3, 2.4 - 移动端界面适配
 */
/**
 * 视口管理器类
 * 处理移动端适配和响应式布局
 */
export class ViewportManager {
    canvas;
    statusBar;
    gameWrapper;
    deviceInfo;
    resizeObserver = null;
    orientationChangeHandler = null;
    /** 上一次写入的舞台高度，用于避免重复写 CSS 变量引发无意义重排 */
    lastStageHeight = 0;
    /** 上一次写入的画布显示宽度 */
    lastCanvasWidth = 0;
    constructor(canvas, statusBar, gameWrapper) {
        this.canvas = canvas;
        this.statusBar = statusBar;
        this.gameWrapper = gameWrapper;
        this.deviceInfo = this.detectDevice();
    }
    /**
     * 初始化视口管理器
     * Requirements: 2.1, 2.2, 2.3, 2.4
     */
    init() {
        // 更新viewport meta标签
        this.updateViewportMeta();
        // 如果是移动设备，进行移动端适配
        if (this.deviceInfo.isMobile || this.deviceInfo.isTablet) {
            this.adjustForMobile();
        }
        // 监听方向变化
        this.setupOrientationChangeListener();
        // 监听窗口大小变化
        this.setupResizeListener();
        // 初始调整（先测量舞台高度，画布宽度公式依赖它）
        this.updateStageHeight();
        this.handleResize();
    }
    /**
     * 处理方向变化
     * Requirements: 2.2 - 设备方向改变时重新调整界面布局
     */
    handleOrientationChange() {
        // 更新设备信息
        this.deviceInfo = this.detectDevice();
        // 延迟执行以确保方向变化完成
        setTimeout(() => {
            this.handleResize();
            this.adjustStatusBarLayout();
        }, 100);
    }
    /**
     * 移动端适配
     * Requirements: 2.1, 2.3 - 自动调整游戏画布大小，确保UI元素可见
     */
    adjustForMobile() {
        // 禁用缩放
        this.preventZoom();
        // 调整画布大小
        this.adjustCanvasSize();
        // 调整状态栏布局
        this.adjustStatusBarLayout();
        // 添加移动端特定样式
        this.addMobileStyles();
    }
    /**
     * 检测移动设备
     * 返回设备信息
     */
    detectDevice() {
        const userAgent = navigator.userAgent.toLowerCase();
        const screenWidth = window.screen.width;
        const screenHeight = window.screen.height;
        const pixelRatio = window.devicePixelRatio || 1;
        // 检测移动设备
        const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent) ||
            (screenWidth <= 768 && 'ontouchstart' in window);
        // 检测平板设备
        const isTablet = /ipad|android(?!.*mobile)/i.test(userAgent) ||
            (screenWidth > 768 && screenWidth <= 1024 && 'ontouchstart' in window);
        // 检测方向
        const orientation = screenWidth > screenHeight ? 'landscape' : 'portrait';
        return {
            isMobile: isMobile && !isTablet,
            isTablet,
            screenWidth,
            screenHeight,
            pixelRatio,
            orientation
        };
    }
    /**
     * 测量游戏舞台的实际可用高度并写入 CSS 变量
     * 该值决定画布按 16:9 能占用的最大高度，避免出现上下留白或溢出错位。
     */
    updateStageHeight() {
        const stage = this.gameWrapper.querySelector('.game-stage');
        if (!stage) {
            return;
        }
        const height = stage.clientHeight;
        if (height <= 0) {
            return;
        }
        // 每次都写入当前实测高度：隐藏 HUD 后舞台会显著变高，
        // 若沿用「变化 >= 1px 才更新」的阈值判断，配合 lastStageHeight 的旧值，
        // 会让画布尺寸决策用到过期的舞台高度（表现为顶部留黑边、画布没铺满）。
        this.lastStageHeight = height;
        if (stage.style.getPropertyValue('--stage-h') !== `${height}px`) {
            stage.style.setProperty('--stage-h', `${height}px`);
        }
    }
    /**
     * 计算并应用画布显示尺寸
     *
     * - 桌面端 / 横屏：保持 16:9 横向宽幅，沿用原逻辑等比缩放。
     * - 移动端竖屏：宽度直接占满可用舞台宽度（仅留 2px 安全边距），
     *   高度按 9:16 竖版比例推导，使画布整体接近屏幕比例，
     *   避免上下过度留白；同时写入 data-layout="mobile-portrait"
     *   供渲染器切换内部布局（赛道横向占满、单元格放大）。
     */
    applyCanvasWidth() {
        const stage = this.gameWrapper.querySelector('.game-stage');
        const stageWidth = stage?.clientWidth ?? this.gameWrapper.clientWidth;
        const stageHeight = stage?.clientHeight ?? this.lastStageHeight;
        if (stageWidth <= 0 || stageHeight <= 0) {
            return;
        }
        const isMobilePortrait = (this.deviceInfo.isMobile || this.deviceInfo.isTablet) &&
            this.deviceInfo.orientation === 'portrait';
        let targetWidth;
        let targetHeight;
        let layoutMode;
        if (isMobilePortrait) {
            layoutMode = 'mobile-portrait';
            if (this.isMobilePlayStage()) {
                // 对局中：赛道铺满整个视口（宽度占满、高度贴合真实显示比例）。
                //
                // 这里不再固定 9:16：内部高度由显示比例推导（见 computeLayoutParams），
                // 使客户端可视高度与服务端障碍物投影窗口(720)保持一致，
                // 避免障碍物在离玩家很远的位置就被过滤，表现为「方块延迟/提前消失」。
                targetWidth = Math.max(320, Math.floor(stageWidth));
                targetHeight = Math.max(320, Math.floor(stageHeight));
            }
            else {
                // 非对局（大厅 / 结算）：原有逻辑，画布整体可见不裁切
                targetWidth = Math.max(320, Math.floor(stageWidth));
                const portraitHeight = Math.floor(targetWidth * (16 / 9));
                targetHeight = Math.min(portraitHeight, Math.floor(stageHeight));
                const fitBackWidth = Math.floor(targetHeight * (9 / 16));
                if (fitBackWidth < targetWidth && fitBackWidth >= 320) {
                    targetWidth = fitBackWidth;
                }
            }
        }
        else {
            const horizontalPadding = 8;
            const heightLimit = stageHeight;
            targetWidth = Math.floor(Math.min(stageWidth - horizontalPadding, heightLimit * (16 / 9)));
            targetHeight = Math.floor(targetWidth * 9 / 16);
            layoutMode = 'desktop';
        }
        if (targetWidth >= 320 && (targetWidth !== this.lastCanvasWidth ||
            this.canvas.dataset.layout !== layoutMode)) {
            // 对局中的移动端竖屏：允许画布超出舞台高度并被 .game-wrapper 裁掉，
            // 这样赛道铺满整屏宽度、玩家贴屏幕底部，不会在顶部留下黑边
            //（此前的 min(targetHeight, stageHeight) 会留出 150px 左右的背景色空档，
            //  看起来就是「顶部一个黑块」）。
            const allowOverflow = layoutMode === 'mobile-portrait' && this.isMobilePlayStage();
            // 其余情况仍收敛到舞台内，避免被 CSS 的 max-width/max-height 二次收窄
            // 导致内部比例与显示比例不一致（表现为赛道被拉伸）。
            const safeWidth = allowOverflow
                ? targetWidth
                : Math.min(targetWidth, Math.max(1, Math.floor(stageWidth)));
            const safeHeight = allowOverflow
                ? targetHeight
                : Math.min(targetHeight, Math.max(1, Math.floor(stageHeight)));
            this.lastCanvasWidth = targetWidth;
            this.canvas.style.width = `${safeWidth}px`;
            this.canvas.style.height = `${safeHeight}px`;
            this.canvas.dataset.sizing = 'fixed';
            this.canvas.dataset.layout = layoutMode;
            // 调试标记：本次尺寸决策的来源（便于真机排查黑边/裁切问题）
            this.canvas.dataset.overflow = allowOverflow ? 'yes' : 'no';
            this.canvas.dataset.target = `${targetWidth}x${targetHeight}`;
            this.canvas.dataset.stage = `${Math.floor(stageWidth)}x${Math.floor(stageHeight)}`;
            this.canvas.dataset.displayWidth = String(safeWidth);
            this.canvas.dataset.displayHeight = String(safeHeight);
            // 显示比例与内部逻辑比例是否一致（用于调试观察是否发生拉伸）
            const internalRatio = layoutMode === 'mobile-portrait'
                ? 720 / 1280
                : 16 / 9;
            const shownRatio = safeWidth / safeHeight;
            this.canvas.dataset.stretch = (Math.abs(shownRatio / internalRatio - 1) * 100).toFixed(2);
        }
    }
    /**
     * 当前是否为「触控设备 + 对局中 + 竖屏」
     *
     * 竖屏判定用**画布实际显示比例**而不是 window.screen：
     * 部分移动浏览器 / 全屏 / 分屏场景下 screen 尺寸与视口不一致，
     * 会导致这里误判，从而选错画布尺寸策略。
     */
    isMobilePlayStage() {
        const touchDevice = (typeof window.matchMedia === 'function' &&
            window.matchMedia('(hover: none) and (pointer: coarse)').matches) ||
            this.deviceInfo.isMobile ||
            this.deviceInfo.isTablet;
        if (!touchDevice) {
            return false;
        }
        if (this.gameWrapper.dataset.playing !== 'true') {
            return false;
        }
        // 竖屏：宽度小于高度即视为竖屏（与 computeLayoutParams 的判定保持一致）
        return window.innerWidth <= window.innerHeight;
    }
    /**
     * 重新量取布局（供外部在 DOM/HUD 结构变化后调用）
     * 例如移动端进入对局隐藏 HUD、进出全屏后视口尺寸变化时。
     */
    refreshLayout() {
        this.deviceInfo = this.detectDevice();
        // 强制重算：隐藏 HUD 后舞台尺寸会变，缓存宽度需要失效
        this.lastCanvasWidth = 0;
        this.updateStageHeight();
        this.handleResize();
    }
    /**
     * 调整画布显示尺寸
     * 显示尺寸由 applyCanvasWidth 直接写入（宽 + 高 + 内部分辨率同步），
     * 保证在任何视口下都严格保持 16:9，不依赖 CSS 对 canvas 固有比例的推导。
     * Requirements: 2.1, 2.4
     */
    adjustCanvasSize() {
        this.applyCanvasWidth();
    }
    /**
     * 调整状态栏布局
     * Requirements: 2.3, 2.4 - 确保UI元素可见，响应式布局
     *
     * 说明（UI 重构）：仅切换类名，具体尺寸/间距/换行规则由样式表定义，
     * 避免内联样式与 CSS 相互覆盖。
     */
    adjustStatusBarLayout() {
        if (this.deviceInfo.isMobile && this.deviceInfo.orientation === 'portrait') {
            this.statusBar.classList.add('mobile-layout');
            this.statusBar.classList.remove('landscape-compact');
        }
        else if (this.deviceInfo.isMobile || this.deviceInfo.isTablet) {
            this.statusBar.classList.remove('mobile-layout');
            if (this.deviceInfo.orientation === 'landscape' && this.deviceInfo.screenHeight < 500) {
                this.statusBar.classList.add('landscape-compact');
            }
            else {
                this.statusBar.classList.remove('landscape-compact');
            }
        }
        else {
            this.statusBar.classList.remove('mobile-layout', 'landscape-compact');
        }
    }
    /**
     * 禁用缩放
     * Requirements: 2.4 - 禁止缩放以保持游戏体验一致性
     *
     * 注：CSS 已设置 viewport meta、touch-action: none/manipulation 与 overscroll-behavior: none，
     *     已能阻止双击缩放、回弹滚动与页面缩放。此处仅保留 iOS Safari 特有的 pinch 手势监听，
     *     避免全局 touchend/dblclick 拦截与游戏触控输入冲突。
     */
    preventZoom() {
        // 阻止 iOS Safari 双指捏合缩放（部分旧版本仍会触发 gesturestart）
        document.addEventListener('gesturestart', (e) => {
            e.preventDefault();
        }, { passive: false });
    }
    /**
     * 更新viewport meta标签
     * Requirements: 2.4 - 更新HTML viewport meta标签配置
     */
    updateViewportMeta() {
        let viewportMeta = document.querySelector('meta[name="viewport"]');
        if (!viewportMeta) {
            viewportMeta = document.createElement('meta');
            viewportMeta.name = 'viewport';
            document.head.appendChild(viewportMeta);
        }
        // 设置viewport配置
        const content = [
            'width=device-width',
            'initial-scale=1.0',
            'maximum-scale=1.0',
            'minimum-scale=1.0',
            'user-scalable=no',
            'viewport-fit=cover'
        ].join(', ');
        viewportMeta.content = content;
    }
    /**
     * 添加移动端特定样式
     */
    addMobileStyles() {
        const styleId = 'viewport-manager-mobile-styles';
        // 避免重复添加
        if (document.getElementById(styleId)) {
            return;
        }
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
  
    `;
        document.head.appendChild(style);
    }
    /**
     * 设置方向变化监听器
     */
    setupOrientationChangeListener() {
        this.orientationChangeHandler = () => {
            this.handleOrientationChange();
        };
        // 监听方向变化事件
        window.addEventListener('orientationchange', this.orientationChangeHandler);
        // 监听屏幕方向API（如果支持）
        if (screen.orientation) {
            screen.orientation.addEventListener('change', this.orientationChangeHandler);
        }
    }
    /**
     * 设置窗口大小变化监听器
     *
     * 监听 .game-stage 而非 document.body：
     * .game-stage 的高度由 flex 分配，会随状态栏内容变化（特别是移动端竖屏下状态栏换行），
     * 只有它的尺寸变化才需要重新计算画布大小，避免 body 高度不变时错过重排。
     */
    setupResizeListener() {
        const stage = this.gameWrapper.querySelector('.game-stage');
        if (!stage) {
            // 极端退化：如果连舞台都找不到，则监听 window resize
            window.addEventListener('resize', () => this.handleResize());
            return;
        }
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(() => {
                this.handleResize();
            });
            this.resizeObserver.observe(stage);
        }
        else {
            window.addEventListener('resize', () => this.handleResize());
        }
    }
    /**
     * 处理窗口大小变化
     * 注意：这里只重算画布与状态栏布局，且画布尺寸类名/CSS 变量是幂等的，
     * 避免 ResizeObserver 因自身改动再次触发导致抖动。
     */
    handleResize() {
        // 更新设备信息
        this.deviceInfo = this.detectDevice();
        // 实测舞台高度并写入 CSS 变量（画布 16:9 自适应依赖该值）
        this.updateStageHeight();
        // 重新调整画布大小（桌面端会清除干预，交回样式表自适应）
        this.adjustCanvasSize();
        // 重新调整状态栏布局
        this.adjustStatusBarLayout();
    }
    /**
     * 获取当前设备信息
     */
    getDeviceInfo() {
        return { ...this.deviceInfo };
    }
    /**
     * 销毁视口管理器
     */
    destroy() {
        // 移除事件监听器
        if (this.orientationChangeHandler) {
            window.removeEventListener('orientationchange', this.orientationChangeHandler);
            if (screen.orientation) {
                screen.orientation.removeEventListener('change', this.orientationChangeHandler);
            }
        }
        // 销毁ResizeObserver
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        // 移除移动端样式
        const mobileStyles = document.getElementById('viewport-manager-mobile-styles');
        if (mobileStyles) {
            mobileStyles.remove();
        }
    }
}
//# sourceMappingURL=viewport-manager.js.map