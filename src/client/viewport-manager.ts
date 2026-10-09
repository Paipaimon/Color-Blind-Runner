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
export class ViewportManager {
  private canvas: HTMLCanvasElement;
  private statusBar: HTMLElement;
  private gameWrapper: HTMLElement;
  private deviceInfo: DeviceInfo;
  private resizeObserver: ResizeObserver | null = null;
  private orientationChangeHandler: (() => void) | null = null;

  /** 上一次写入的舞台高度，用于避免重复写 CSS 变量引发无意义重排 */
  private lastStageHeight: number = 0;

  /** 上一次写入的画布显示宽度 */
  private lastCanvasWidth: number = 0;

  constructor(canvas: HTMLCanvasElement, statusBar: HTMLElement, gameWrapper: HTMLElement) {
    this.canvas = canvas;
    this.statusBar = statusBar;
    this.gameWrapper = gameWrapper;
    this.deviceInfo = this.detectDevice();
  }

  /**
   * 初始化视口管理器
   * Requirements: 2.1, 2.2, 2.3, 2.4
   */
  init(): void {
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
  handleOrientationChange(): void {
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
  adjustForMobile(): void {
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
  private detectDevice(): DeviceInfo {
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
  private updateStageHeight(): void {
    const stage = this.gameWrapper.querySelector('.game-stage') as HTMLElement | null;
    if (!stage) {
      return;
    }

    const height = stage.clientHeight;
    if (height > 0 && Math.abs(height - this.lastStageHeight) >= 1) {
      this.lastStageHeight = height;
      stage.style.setProperty('--stage-h', `${height}px`);
    }
  }

  /**
   * 计算并应用画布显示宽度
   * 以「舞台实测高度 × 16/9」为基准，再与可用宽度取较小值，
   * 保证画布在舞台内等比铺满：竖屏移动端额外限制为屏幕高度的 80%（沿用既有适配规则）。
   */
  private applyCanvasWidth(): void {
    const stage = this.gameWrapper.querySelector('.game-stage') as HTMLElement | null;
    const stageWidth = stage?.clientWidth ?? this.gameWrapper.clientWidth;
    const stageHeight = stage?.clientHeight ?? this.lastStageHeight;
    const horizontalPadding = 8;

    if (stageWidth <= 0 || stageHeight <= 0) {
      return;
    }

    const heightLimit =
      this.deviceInfo.isMobile && this.deviceInfo.orientation === 'portrait'
        ? Math.min(stageHeight, window.innerHeight * 0.8)
        : stageHeight;

    const targetWidth = Math.floor(Math.min(stageWidth - horizontalPadding, heightLimit * (16 / 9)));
    const targetHeight = Math.floor(targetWidth * 9 / 16);

    if (targetWidth >= 320 && targetWidth !== this.lastCanvasWidth) {
      this.lastCanvasWidth = targetWidth;
      // 仅设置显示尺寸：canvas 固有宽高比会在高度为 auto 时覆盖 aspect-ratio，
      // 因此显式给出宽高像素值；内部分辨率恒为 1280×720（渲染器逻辑坐标系）。
      this.canvas.style.width = `${targetWidth}px`;
      this.canvas.style.height = `${targetHeight}px`;
      this.canvas.dataset.sizing = 'fixed';
    }
  }

  /**
   * 调整画布显示尺寸
   * 显示尺寸由 applyCanvasWidth 直接写入（宽 + 高 + 内部分辨率同步），
   * 保证在任何视口下都严格保持 16:9，不依赖 CSS 对 canvas 固有比例的推导。
   * Requirements: 2.1, 2.4
   */
  private adjustCanvasSize(): void {
    this.applyCanvasWidth();
  }

  /**
   * 调整状态栏布局
   * Requirements: 2.3, 2.4 - 确保UI元素可见，响应式布局
   *
   * 说明（UI 重构）：仅切换类名，具体尺寸/间距/换行规则由样式表定义，
   * 避免内联样式与 CSS 相互覆盖。
   */
  private adjustStatusBarLayout(): void {
    if (this.deviceInfo.isMobile && this.deviceInfo.orientation === 'portrait') {
      this.statusBar.classList.add('mobile-layout');
      this.statusBar.classList.remove('landscape-compact');
    } else if (this.deviceInfo.isMobile || this.deviceInfo.isTablet) {
      this.statusBar.classList.remove('mobile-layout');
      if (this.deviceInfo.orientation === 'landscape' && this.deviceInfo.screenHeight < 500) {
        this.statusBar.classList.add('landscape-compact');
      } else {
        this.statusBar.classList.remove('landscape-compact');
      }
    } else {
      this.statusBar.classList.remove('mobile-layout', 'landscape-compact');
    }
  }

  /**
   * 禁用缩放
   * Requirements: 2.4 - 禁止缩放以保持游戏体验一致性
   */
  private preventZoom(): void {
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
  private updateViewportMeta(): void {
    let viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
    
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
  private addMobileStyles(): void {
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
  private setupOrientationChangeListener(): void {
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
  private setupResizeListener(): void {
    // 使用ResizeObserver监听窗口大小变化
    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        this.handleResize();
      });
      this.resizeObserver.observe(document.body);
    } else {
      // 降级到window resize事件
      window.addEventListener('resize', () => {
        this.handleResize();
      });
    }
  }

  /**
   * 处理窗口大小变化
   * 注意：这里只重算画布与状态栏布局，且画布尺寸类名/CSS 变量是幂等的，
   * 避免 ResizeObserver 因自身改动再次触发导致抖动。
   */
  private handleResize(): void {
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
  getDeviceInfo(): Readonly<DeviceInfo> {
    return { ...this.deviceInfo };
  }

  /**
   * 销毁视口管理器
   */
  destroy(): void {
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