/**
 * 视口管理器
 * 处理移动端适配和响应式布局
 * Requirements: 2.1, 2.2, 2.3, 2.4 - 移动端界面适配
 */
import { GAME_CONFIG } from '../shared/constants.js';
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
        // 初始调整
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
     * 计算最优画布尺寸
     * Requirements: 2.1 - 自动调整游戏画布大小以适配屏幕
     */
    calculateOptimalCanvasSize() {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        // 为状态栏预留空间
        const statusBarHeight = this.statusBar.offsetHeight || 50;
        const availableHeight = viewportHeight - statusBarHeight - 20; // 20px 边距
        const availableWidth = viewportWidth - 20; // 10px 左右边距
        // 计算基于16:9比例的尺寸
        const aspectRatio = 16 / 9;
        let canvasWidth = availableWidth;
        let canvasHeight = canvasWidth / aspectRatio;
        // 如果高度超出可用空间，以高度为准
        if (canvasHeight > availableHeight) {
            canvasHeight = availableHeight;
            canvasWidth = canvasHeight * aspectRatio;
        }
        // 确保最小尺寸
        const minWidth = 320;
        const minHeight = 180;
        canvasWidth = Math.max(canvasWidth, minWidth);
        canvasHeight = Math.max(canvasHeight, minHeight);
        // 确保不超过原始尺寸（避免放大）
        canvasWidth = Math.min(canvasWidth, GAME_CONFIG.GAME_WIDTH);
        canvasHeight = Math.min(canvasHeight, GAME_CONFIG.GAME_HEIGHT);
        return {
            width: Math.floor(canvasWidth),
            height: Math.floor(canvasHeight)
        };
    }
    /**
     * 调整画布尺寸
     */
    adjustCanvasSize() {
        const { width, height } = this.calculateOptimalCanvasSize();
        // 设置画布显示尺寸（CSS）
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        // 保持内部分辨率不变，通过CSS缩放
        // 这样可以保持游戏逻辑的一致性
        this.canvas.width = GAME_CONFIG.GAME_WIDTH;
        this.canvas.height = GAME_CONFIG.GAME_HEIGHT;
    }
    /**
     * 调整状态栏布局
     * Requirements: 2.3, 2.4 - 确保UI元素可见，响应式布局
     */
    adjustStatusBarLayout() {
        if (this.deviceInfo.isMobile) {
            // 移动端：垂直布局，较小字体
            this.statusBar.style.flexDirection = 'column';
            this.statusBar.style.gap = '8px';
            this.statusBar.style.fontSize = '12px';
            this.statusBar.style.padding = '8px 12px';
            // 调整状态项布局
            const statusItems = this.statusBar.querySelectorAll('.status-item');
            statusItems.forEach(item => {
                item.style.justifyContent = 'space-between';
                item.style.minWidth = '120px';
            });
        }
        else if (this.deviceInfo.isTablet) {
            // 平板：保持水平布局，适中字体
            this.statusBar.style.flexDirection = 'row';
            this.statusBar.style.gap = '15px';
            this.statusBar.style.fontSize = '13px';
            this.statusBar.style.padding = '8px 16px';
        }
        else {
            // 桌面：恢复默认布局
            this.statusBar.style.flexDirection = 'row';
            this.statusBar.style.gap = '20px';
            this.statusBar.style.fontSize = '14px';
            this.statusBar.style.padding = '8px 16px';
        }
    }
    /**
     * 禁用缩放
     * Requirements: 2.4 - 禁止缩放以保持游戏体验一致性
     */
    preventZoom() {
        // 阻止双击缩放
        document.addEventListener('dblclick', (e) => {
            e.preventDefault();
        }, { passive: false });
        // 阻止手势缩放
        document.addEventListener('gesturestart', (e) => {
            e.preventDefault();
        }, { passive: false });
        // 阻止触摸缩放
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
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
      /* 移动端优化样式 */
      body {
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }
      
      .game-wrapper {
        width: 100%;
        height: 100vh;
        padding: 10px;
        box-sizing: border-box;
      }
      
      #gameCanvas {
        touch-action: none;
        -webkit-touch-callout: none;
        -webkit-user-select: none;
      }
      
      #statusBar {
        width: 100%;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      @media (max-width: 480px) {
        #statusBar {
          white-space: normal;
        }
        
        .status-item {
          font-size: 11px !important;
        }
      }
      
      @media (orientation: landscape) and (max-height: 500px) {
        .game-wrapper {
          padding: 5px;
        }
        
        #statusBar {
          padding: 4px 8px !important;
          font-size: 11px !important;
        }
      }
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
     */
    setupResizeListener() {
        // 使用ResizeObserver监听窗口大小变化
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(() => {
                this.handleResize();
            });
            this.resizeObserver.observe(document.body);
        }
        else {
            // 降级到window resize事件
            window.addEventListener('resize', () => {
                this.handleResize();
            });
        }
    }
    /**
     * 处理窗口大小变化
     */
    handleResize() {
        // 更新设备信息
        this.deviceInfo = this.detectDevice();
        // 重新调整画布大小
        if (this.deviceInfo.isMobile || this.deviceInfo.isTablet) {
            this.adjustCanvasSize();
        }
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
//# sourceMappingURL=-viewport-manager.js.map