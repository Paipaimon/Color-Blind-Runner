/**
 * 触控反馈管理器
 * 提供触控操作的视觉反馈效果
 * Requirements: 4.1 - 触控反馈的视觉效果
 */

/**
 * 触控反馈类型枚举
 */
export enum TouchFeedbackType {
  SWIPE_LEFT = 'swipe-left',
  SWIPE_RIGHT = 'swipe-right',
  SWIPE_UP = 'swipe-up',
  SWIPE_DOWN = 'swipe-down',
  TAP = 'tap'
}

/**
 * 触控反馈配置接口
 */
interface TouchFeedbackConfig {
  rippleDuration: number;      // 波纹动画持续时间(ms)
  indicatorDuration: number;   // 方向指示器持续时间(ms)
  maxFeedbackElements: number; // 最大同时显示的反馈元素数量
}

/**
 * 触控反馈管理器类
 * Requirements: 4.1 - 提供视觉反馈指示移动方向
 */
export class TouchFeedbackManager {
  private container: HTMLElement;
  private config: TouchFeedbackConfig;
  private activeFeedbacks: Set<HTMLElement> = new Set();

  constructor(container: HTMLElement) {
    this.container = container;
    this.config = {
      rippleDuration: 600,        // 波纹动画持续时间
      indicatorDuration: 500,     // 方向指示器持续时间
      maxFeedbackElements: 5      // 最大同时显示的反馈元素数量
    };

    // 确保容器具有相对定位
    if (getComputedStyle(this.container).position === 'static') {
      this.container.style.position = 'relative';
    }
  }

  /**
   * 显示触控波纹效果
   * Requirements: 4.1 - 视觉反馈指示移动方向
   */
  showTouchRipple(x: number, y: number, type: TouchFeedbackType = TouchFeedbackType.TAP): void {
    // 清理过多的反馈元素
    this.cleanupExcessFeedbacks();

    // 获取容器的边界矩形
    const rect = this.container.getBoundingClientRect();
    
    // 计算相对于容器的坐标
    const relativeX = x - rect.left;
    const relativeY = y - rect.top;

    // 创建波纹元素
    const ripple = document.createElement('div');
    ripple.className = `touch-feedback ${type}`;
    
    // 设置波纹位置和大小
    const size = this.calculateRippleSize();
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${relativeX - size / 2}px`;
    ripple.style.top = `${relativeY - size / 2}px`;

    // 添加到容器
    this.container.appendChild(ripple);
    this.activeFeedbacks.add(ripple);

    // 自动清理
    setTimeout(() => {
      this.removeFeedbackElement(ripple);
    }, this.config.rippleDuration);
  }

  /**
   * 显示滑动方向指示器
   * Requirements: 4.1 - 视觉反馈指示移动方向
   */
  showSwipeIndicator(type: TouchFeedbackType): void {
    // 清理过多的反馈元素
    this.cleanupExcessFeedbacks();

    const indicator = document.createElement('div');
    indicator.className = 'swipe-indicator';
    
    // 根据滑动类型设置图标
    const icon = this.getSwipeIcon(type);
    indicator.textContent = icon;

    // 添加到容器中央
    this.container.appendChild(indicator);
    this.activeFeedbacks.add(indicator);

    // 自动清理
    setTimeout(() => {
      this.removeFeedbackElement(indicator);
    }, this.config.indicatorDuration);
  }

  /**
   * 显示组合反馈效果（波纹 + 方向指示器）
   * Requirements: 4.1 - 完整的触控反馈体验
   */
  showCombinedFeedback(x: number, y: number, type: TouchFeedbackType): void {
    // 显示波纹效果
    this.showTouchRipple(x, y, type);
    
    // 只为滑动手势显示方向指示器
    if (type !== TouchFeedbackType.TAP) {
      this.showSwipeIndicator(type);
    }
  }

  /**
   * 根据滑动类型获取对应图标
   */
  private getSwipeIcon(type: TouchFeedbackType): string {
    switch (type) {
      case TouchFeedbackType.SWIPE_LEFT:
        return '←';
      case TouchFeedbackType.SWIPE_RIGHT:
        return '→';
      case TouchFeedbackType.SWIPE_UP:
        return '↑';
      case TouchFeedbackType.SWIPE_DOWN:
        return '↓';
      default:
        return '•';
    }
  }

  /**
   * 计算波纹大小（根据屏幕尺寸自适应）
   */
  private calculateRippleSize(): number {
    const containerRect = this.container.getBoundingClientRect();
    const minDimension = Math.min(containerRect.width, containerRect.height);
    
    // 基础大小为容器最小尺寸的10%，但不小于40px，不大于100px
    const baseSize = Math.max(40, Math.min(100, minDimension * 0.1));
    
    // 移动端适配
    if (this.isMobileDevice()) {
      return Math.max(50, baseSize);
    }
    
    return baseSize;
  }

  /**
   * 检测是否为移动设备
   */
  private isMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  /**
   * 清理过多的反馈元素
   */
  private cleanupExcessFeedbacks(): void {
    if (this.activeFeedbacks.size >= this.config.maxFeedbackElements) {
      // 移除最早的反馈元素
      const oldestFeedback = this.activeFeedbacks.values().next().value;
      if (oldestFeedback) {
        this.removeFeedbackElement(oldestFeedback);
      }
    }
  }

  /**
   * 移除反馈元素
   */
  private removeFeedbackElement(element: HTMLElement): void {
    if (this.activeFeedbacks.has(element)) {
      this.activeFeedbacks.delete(element);
      
      if (element.parentNode === this.container) {
        this.container.removeChild(element);
      }
    }
  }

  /**
   * 清理所有活动的反馈元素
   */
  clearAllFeedbacks(): void {
    this.activeFeedbacks.forEach(element => {
      if (element.parentNode === this.container) {
        this.container.removeChild(element);
      }
    });
    this.activeFeedbacks.clear();
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<TouchFeedbackConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 销毁管理器，清理所有资源
   */
  destroy(): void {
    this.clearAllFeedbacks();
  }
}