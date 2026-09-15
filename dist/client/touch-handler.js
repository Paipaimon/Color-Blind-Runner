/**
 * 触控输入处理器
 * 检测滑动手势并通过输入合并器处理输入命令
 * Requirements: 1.1, 1.2, 1.3, 4.2, 4.3, 5.1, 4.1
 */
import { TouchFeedbackManager, TouchFeedbackType } from './touch-feedback.js';
/**
 * 滑动方向枚举
 */
var SwipeDirection;
(function (SwipeDirection) {
    SwipeDirection["LEFT"] = "left";
    SwipeDirection["RIGHT"] = "right";
    SwipeDirection["UP"] = "up";
    SwipeDirection["DOWN"] = "down";
})(SwipeDirection || (SwipeDirection = {}));
/**
 * 触控输入处理器类
 * 检测滑动手势并通过输入合并器处理输入命令
 */
export class TouchHandler {
    element;
    inputMerger;
    feedbackManager;
    isEnabled = false;
    isBound = false;
    // 触控状态
    touchStartX = 0;
    touchStartY = 0;
    touchStartTime = 0;
    currentInput = {
        up: false,
        down: false,
        left: false,
        right: false
    };
    // 配置参数
    config = {
        minSwipeDistance: 30, // 最小滑动距离(px)
        maxSwipeTime: 300, // 最大滑动时间(ms)
        debounceTime: 50, // 防抖时间(ms)
        enableVerticalSwipe: false // 当前游戏只需要左右移动
    };
    // 防抖相关
    lastInputTime = 0;
    debounceTimer = null;
    // 绑定的事件处理函数引用（用于解绑）
    touchStartHandler;
    touchMoveHandler;
    touchEndHandler;
    constructor(element, inputMerger) {
        this.element = element;
        this.inputMerger = inputMerger;
        // Requirements: 4.1 - 初始化触控反馈管理器
        this.feedbackManager = new TouchFeedbackManager(element);
        // 绑定事件处理函数
        this.touchStartHandler = this.handleTouchStart.bind(this);
        this.touchMoveHandler = this.handleTouchMove.bind(this);
        this.touchEndHandler = this.handleTouchEnd.bind(this);
    }
    /**
     * 绑定触控事件
     * Requirements: 1.1, 1.2 - 检测左右滑动手势
     */
    bind() {
        if (this.isBound)
            return;
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
    unbind() {
        if (!this.isBound)
            return;
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
    getCurrentInput() {
        return { ...this.currentInput };
    }
    /**
     * 处理触控开始事件
     * Requirements: 4.4 - 只处理第一个触控点
     */
    handleTouchStart(event) {
        if (!this.isEnabled || event.touches.length === 0)
            return;
        // Requirements: 4.4 - 多指触控时只处理第一个触控点
        const touch = event.touches[0];
        // Requirements: 4.5 - 检查触控是否在游戏画布范围内
        const rect = this.element.getBoundingClientRect();
        if (touch.clientX < rect.left || touch.clientX > rect.right ||
            touch.clientY < rect.top || touch.clientY > rect.bottom) {
            return;
        }
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
        this.touchStartTime = Date.now();
        // Requirements: 1.4 - 阻止默认触摸行为（页面滚动等）
        event.preventDefault();
    }
    /**
     * 处理触控移动事件
     * Requirements: 1.4 - 阻止页面滚动和其他默认触摸行为
     */
    handleTouchMove(event) {
        if (!this.isEnabled || event.touches.length === 0)
            return;
        // Requirements: 1.4 - 阻止默认触摸行为
        event.preventDefault();
    }
    /**
     * 处理触控结束事件
     * Requirements: 1.1, 1.2, 1.3, 4.2, 4.3, 4.1 - 检测滑动手势并转换为输入命令，显示视觉反馈
     */
    handleTouchEnd(event) {
        if (!this.isEnabled)
            return;
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
        // 检测滑动方向
        const direction = this.detectSwipeDirection(deltaX, deltaY, deltaTime);
        if (direction) {
            // Requirements: 4.1 - 显示触控反馈效果
            this.showSwipeFeedback(endX, endY, direction);
            this.updateInputFromSwipe(direction);
        }
        else {
            // Requirements: 1.3 - 无有效滑动时停止发送移动命令
            this.resetInput();
        }
    }
    /**
     * 检测滑动方向
     * Requirements: 4.2, 4.3 - 实现手势过滤逻辑（最小距离、最大时间）
     */
    detectSwipeDirection(deltaX, deltaY, deltaTime) {
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
        }
        else if (this.config.enableVerticalSwipe) {
            // 垂直滑动（当前游戏不需要，但保留接口）
            return deltaY > 0 ? SwipeDirection.DOWN : SwipeDirection.UP;
        }
        return null;
    }
    /**
     * 根据滑动方向更新输入状态
     * Requirements: 1.1, 1.2 - 左右滑动转换为移动输入命令
     */
    updateInputFromSwipe(direction) {
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
    resetInput() {
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
    notifyInputMerger() {
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
    doNotifyInputMerger() {
        this.inputMerger.updateTouchInput({ ...this.currentInput });
        this.lastInputTime = Date.now();
    }
    /**
     * 显示滑动反馈效果
     * Requirements: 4.1 - 提供视觉反馈指示移动方向
     */
    showSwipeFeedback(x, y, direction) {
        let feedbackType;
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
    getFeedbackManager() {
        return this.feedbackManager;
    }
    /**
     * 销毁触控处理器，清理所有资源
     */
    destroy() {
        this.unbind();
        this.feedbackManager.destroy();
    }
}
//# sourceMappingURL=touch-handler.js.map