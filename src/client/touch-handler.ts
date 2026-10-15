/**
 * 触控输入处理器
 * 检测滑动手势并通过输入合并器处理输入命令
 * Requirements: 1.1, 1.2, 1.3, 4.2, 4.3, 5.1, 4.1
 */

import { PlayerInput } from '../shared/messages.js';
import { InputMerger } from './input-merger.js';
import { TouchFeedbackManager, TouchFeedbackType } from './touch-feedback.js';

/**
 * 滑动方向枚举
 */
enum SwipeDirection {
  LEFT = 'left',
  RIGHT = 'right',
  UP = 'up',
  DOWN = 'down'
}

/**
 * 触控配置接口
 */
interface TouchConfig {
  minSwipeDistance: number;  // 最小滑动距离(px)
  maxSwipeTime: number;      // 最大滑动时间(ms)
  debounceTime: number;      // 防抖时间(ms)
  enableVerticalSwipe: boolean; // 是否启用垂直滑动
}

/**
 * 触控输入处理器类
 * 检测滑动手势并通过输入合并器处理输入命令
 */
export class TouchHandler {
  private element: HTMLElement;
  private inputMerger: InputMerger;
  private feedbackManager: TouchFeedbackManager;
  private feedbackElement: HTMLElement;
  private isEnabled: boolean = false;
  private isBound: boolean = false;
  
  // 触控状态
  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private touchStartTime: number = 0;
  private currentInput: PlayerInput = {
    up: false,
    down: false,
    left: false,
    right: false
  };
  
  // 配置参数
  private readonly config: TouchConfig = {
    minSwipeDistance: 18,     // 拖动多久即判定为换道（越小越灵敏）
    maxSwipeTime: 800,        // 最大滑动时间(ms)，放宽到 800ms 兼容慢速拖动
    debounceTime: 0,          // 拖动中即时触发，无需防抖
    enableVerticalSwipe: false // 当前游戏只需要左右移动
  };

  // 当前手势是否已经触发过换道（一次触摸只换一条道，避免连跳）
  private gestureConsumed: boolean = false;
  
  // 防抖相关
  private lastInputTime: number = 0;
  private debounceTimer: number | null = null;
  
  // 绑定的事件处理函数引用（用于解绑）
  private touchStartHandler: (e: TouchEvent) => void;
  private touchMoveHandler: (e: TouchEvent) => void;
  private touchEndHandler: (e: TouchEvent) => void;

  constructor(element: HTMLElement, inputMerger: InputMerger, feedbackLayer?: HTMLElement | null) {
    this.element = element;
    this.inputMerger = inputMerger;
    
    // Requirements: 4.1 - 初始化触控反馈管理器
    // 反馈元素默认挂载在画布上；若提供了独立反馈层（位于画布之上、不拦截指针事件），优先使用，
    // 这样波纹与方向指示不会被画布的 canvas 内容裁剪或覆盖。
    const feedbackContainer = feedbackLayer || element;
    this.feedbackManager = new TouchFeedbackManager(feedbackContainer);
    this.feedbackElement = feedbackContainer;
    
    // 绑定事件处理函数
    this.touchStartHandler = this.handleTouchStart.bind(this);
    this.touchMoveHandler = this.handleTouchMove.bind(this);
    this.touchEndHandler = this.handleTouchEnd.bind(this);
  }

  /**
   * 绑定触控事件
   * Requirements: 1.1, 1.2 - 检测左右滑动手势
   */
  bind(): void {
    if (this.isBound) return;

    this.element.addEventListener('touchstart', this.touchStartHandler, { passive: false });
    this.element.addEventListener('touchmove', this.touchMoveHandler, { passive: false });
    this.element.addEventListener('touchend', this.touchEndHandler, { passive: false });
    this.element.addEventListener('touchcancel', this.touchEndHandler, { passive: false });
    
    this.isBound = true;
    this.isEnabled = true;
  }

  /**
   * 解绑触控事件
   * Requirements: 1.3 - 停止发送移动命令
   */
  unbind(): void {
    if (!this.isBound) return;

    this.element.removeEventListener('touchstart', this.touchStartHandler);
    this.element.removeEventListener('touchmove', this.touchMoveHandler);
    this.element.removeEventListener('touchend', this.touchEndHandler);
    this.element.removeEventListener('touchcancel', this.touchEndHandler);
    
    this.isBound = false;
    this.isEnabled = false;
    
    // 清理防抖定时器
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    // Requirements: 4.1 - 清理触控反馈
    this.feedbackManager.clearAllFeedbacks();
    
    // 重置输入状态
    this.resetInput();
  }

  /**
   * 获取当前输入状态（只读）
   */
  getCurrentInput(): Readonly<PlayerInput> {
    return { ...this.currentInput };
  }

  /**
   * 处理触控开始事件
   * Requirements: 4.4 - 只处理第一个触控点
   */
  private handleTouchStart(event: TouchEvent): void {
    if (!this.isEnabled || event.touches.length === 0) return;
    
    // Requirements: 4.4 - 多指触控时只处理第一个触控点
    const touch = event.touches[0];
    
    // Requirements: 4.5 - 检查触控是否在游戏画布范围内
    // 反馈层与画布同尺寸且不拦截事件，命中判定取两者并集，避免因层叠导致边缘触控失效
    const rect = this.element.getBoundingClientRect();
    const inCanvas = touch.clientX >= rect.left && touch.clientX <= rect.right &&
                     touch.clientY >= rect.top && touch.clientY <= rect.bottom;

    if (!inCanvas) {
      const feedbackRect = this.feedbackElement.getBoundingClientRect();
      const inFeedbackLayer = touch.clientX >= feedbackRect.left && touch.clientX <= feedbackRect.right &&
                              touch.clientY >= feedbackRect.top && touch.clientY <= feedbackRect.bottom;
      if (!inFeedbackLayer) {
        return;
      }
    }
    
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.touchStartTime = Date.now();
    // 新手势开始：允许本次触摸触发一次换道
    this.gestureConsumed = false;
    
    // Requirements: 1.4 - 阻止默认触摸行为（页面滚动等）
    event.preventDefault();
  }

  /**
   * 处理触控移动事件
   *
   * 关键：拖动过程中一旦横向位移超过阈值就立即换道（不等抬手），
   * 这样操作是「即时」的，也不会因为抬手前手指抖回而丢失手势。
   * 一次触摸只换一条道（gestureConsumed），避免长按拖动连续换道。
   */
  private handleTouchMove(event: TouchEvent): void {
    if (!this.isEnabled || event.touches.length === 0) return;

    // Requirements: 1.4 - 阻止默认触摸行为
    event.preventDefault();

    if (this.gestureConsumed) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;
    const deltaTime = Date.now() - this.touchStartTime;

    if (deltaTime > this.config.maxSwipeTime) return;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // 横向位移达到阈值，且横向明显大于纵向 → 判定换道
    if (absX >= this.config.minSwipeDistance && absX > absY) {
      const direction = deltaX > 0 ? SwipeDirection.RIGHT : SwipeDirection.LEFT;
      this.gestureConsumed = true;
      this.showSwipeFeedback(touch.clientX, touch.clientY, direction);
      this.updateInputFromSwipe(direction);
    }
  }

  /**
   * 处理触控结束事件
   * Requirements: 1.1, 1.2, 1.3, 4.2, 4.3, 4.1 - 检测滑动手势并转换为输入命令，显示视觉反馈
   */
  private handleTouchEnd(event: TouchEvent): void {
    if (!this.isEnabled) return;
    
    // Requirements: 1.4 - 阻止默认触摸行为
    event.preventDefault();
    
    const currentTime = Date.now();
    const deltaTime = currentTime - this.touchStartTime;
    
    // 获取最后的触控位置
    let endX = this.touchStartX;
    let endY = this.touchStartY;
    
    if (event.changedTouches.length > 0) {
      const touch = event.changedTouches[0];
      endX = touch.clientX;
      endY = touch.clientY;
    }
    
    const deltaX = endX - this.touchStartX;
    const deltaY = endY - this.touchStartY;
    
    // 拖动阶段已经触发过换道：本次触摸不再重复触发
    if (this.gestureConsumed) {
      this.gestureConsumed = false;
      return;
    }
    
    // 检测滑动方向（抬手时才越过阈值的情况）
    const direction = this.detectSwipeDirection(deltaX, deltaY, deltaTime);

    if (direction) {
      // Requirements: 4.1 - 显示触控反馈效果
      this.showSwipeFeedback(endX, endY, direction);
      this.updateInputFromSwipe(direction);
      this.gestureConsumed = false;
      return;
    }

    // 滑动未达阈值时，尝试识别为「点击左右半区」的轻触移动，
    // 这是移动端竖屏单手操作的常见 fallback，能显著提升操作成功率。
    if (this.isTap(deltaX, deltaY, deltaTime)) {
      const tapDirection = this.detectTapDirection(endX, endY);
      if (tapDirection) {
        this.showSwipeFeedback(endX, endY, tapDirection);
        this.updateInputFromSwipe(tapDirection);
        this.gestureConsumed = false;
        return;
      }
    }

    this.gestureConsumed = false;

    // Requirements: 1.3 - 无有效滑动时停止发送移动命令
    this.resetInput();
  }

  /**
   * 检测滑动方向
   * Requirements: 4.2, 4.3 - 实现手势过滤逻辑（最小距离、最大时间）
   */
  private detectSwipeDirection(deltaX: number, deltaY: number, deltaTime: number): SwipeDirection | null {
    // Requirements: 4.3 - 滑动时间过长则忽略
    if (deltaTime > this.config.maxSwipeTime) {
      return null;
    }
    
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Requirements: 4.2 - 滑动距离过短则忽略
    if (distance < this.config.minSwipeDistance) {
      return null;
    }
    
    // 确定主要滑动方向
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    
    if (absX > absY) {
      // 水平滑动
      return deltaX > 0 ? SwipeDirection.RIGHT : SwipeDirection.LEFT;
    } else if (this.config.enableVerticalSwipe) {
      // 垂直滑动（当前游戏不需要，但保留接口）
      return deltaY > 0 ? SwipeDirection.DOWN : SwipeDirection.UP;
    }
    
    return null;
  }

  /**
   * 判断是否为短促轻触（滑动距离 < 18px、耗时 < 400ms）
   * 用于在滑动未达阈值时，提供「点击屏幕左右区域即可换道」的兜底交互。
   * 阈值放宽是为了兼容真机上的轻微抖动与稍慢的点按。
   */
  private isTap(deltaX: number, deltaY: number, deltaTime: number): boolean {
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    return distance < 18 && deltaTime < 400;
  }

  /**
   * 根据轻触位置在画布上的横向区域判断移动方向
   * 左侧 40% 区域 = 左移，右侧 40% 区域 = 右移，中间 20% 忽略。
   * 中间死区收窄是为了让「点哪边就往哪边走」在真机上更容易命中。
   */
  private detectTapDirection(x: number, y: number): SwipeDirection | null {
    const rect = this.element.getBoundingClientRect();
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      return null;
    }
    const relativeX = x - rect.left;
    const ratio = relativeX / rect.width;
    if (ratio < 0.4) return SwipeDirection.LEFT;
    if (ratio > 0.6) return SwipeDirection.RIGHT;
    return null;
  }

  /**
   * 根据滑动方向更新输入状态
   * Requirements: 1.1, 1.2 - 左右滑动转换为移动输入命令
   */
  private updateInputFromSwipe(direction: SwipeDirection): void {
    // 重置所有输入
    this.currentInput = {
      up: false,
      down: false,
      left: false,
      right: false
    };
    
    // 根据滑动方向设置对应输入
    switch (direction) {
      case SwipeDirection.LEFT:
        this.currentInput.left = true;
        break;
      case SwipeDirection.RIGHT:
        this.currentInput.right = true;
        break;
      case SwipeDirection.UP:
        this.currentInput.up = true;
        break;
      case SwipeDirection.DOWN:
        this.currentInput.down = true;
        break;
    }
    
    // Requirements: 5.1 - 使用防抖机制通知输入合并器
    this.notifyInputMerger();
    
    // 滑动手势是瞬时的，立即重置输入状态
    // 这样可以避免持续发送移动命令
    setTimeout(() => {
      this.resetInput();
    }, 100); // 短暂延迟确保输入被处理
  }

  /**
   * 重置输入状态
   * Requirements: 1.3 - 停止发送移动命令
   */
  private resetInput(): void {
    this.currentInput = {
      up: false,
      down: false,
      left: false,
      right: false
    };
    this.notifyInputMerger();
  }

  /**
   * 通知输入合并器触控输入状态变化
   * Requirements: 5.1 - 防抖机制避免过度频繁输入
   */
  private notifyInputMerger(): void {
    const currentTime = Date.now();
    
    // Requirements: 5.1 - 防抖机制
    if (currentTime - this.lastInputTime < this.config.debounceTime) {
      // 清除之前的定时器
      if (this.debounceTimer !== null) {
        clearTimeout(this.debounceTimer);
      }
      
      // 设置新的定时器
      this.debounceTimer = window.setTimeout(() => {
        this.doNotifyInputMerger();
        this.debounceTimer = null;
      }, this.config.debounceTime);
      
      return;
    }
    
    this.doNotifyInputMerger();
  }

  /**
   * 实际通知输入合并器
   */
  private doNotifyInputMerger(): void {
    this.inputMerger.updateTouchInput({ ...this.currentInput });
    this.lastInputTime = Date.now();
  }

  /**
   * 显示滑动反馈效果
   * Requirements: 4.1 - 提供视觉反馈指示移动方向
   */
  private showSwipeFeedback(x: number, y: number, direction: SwipeDirection): void {
    let feedbackType: TouchFeedbackType;
    
    switch (direction) {
      case SwipeDirection.LEFT:
        feedbackType = TouchFeedbackType.SWIPE_LEFT;
        break;
      case SwipeDirection.RIGHT:
        feedbackType = TouchFeedbackType.SWIPE_RIGHT;
        break;
      case SwipeDirection.UP:
        feedbackType = TouchFeedbackType.SWIPE_UP;
        break;
      case SwipeDirection.DOWN:
        feedbackType = TouchFeedbackType.SWIPE_DOWN;
        break;
      default:
        feedbackType = TouchFeedbackType.TAP;
    }
    
    // 显示组合反馈效果（波纹 + 方向指示器）
    this.feedbackManager.showCombinedFeedback(x, y, feedbackType);
  }

  /**
   * 获取触控反馈管理器（用于外部配置）
   */
  getFeedbackManager(): TouchFeedbackManager {
    return this.feedbackManager;
  }

  /**
   * 销毁触控处理器，清理所有资源
   */
  destroy(): void {
    this.unbind();
    this.feedbackManager.destroy();
  }
}