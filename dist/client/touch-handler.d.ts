/**
 * 触控输入处理器
 * 检测滑动手势并通过输入合并器处理输入命令
 * Requirements: 1.1, 1.2, 1.3, 4.2, 4.3, 5.1, 4.1
 */
import { PlayerInput } from '../shared/messages.js';
import { InputMerger } from './input-merger.js';
import { TouchFeedbackManager } from './touch-feedback.js';
/**
 * 触控输入处理器类
 * 检测滑动手势并通过输入合并器处理输入命令
 */
export declare class TouchHandler {
    private element;
    private inputMerger;
    private feedbackManager;
    private feedbackElement;
    private isEnabled;
    private isBound;
    private touchStartX;
    private touchStartY;
    private touchStartTime;
    private currentInput;
    private readonly config;
    private gestureConsumed;
    private resetTimer;
    private touchStartHandler;
    private touchMoveHandler;
    private touchEndHandler;
    constructor(element: HTMLElement, inputMerger: InputMerger, feedbackLayer?: HTMLElement | null);
    /**
     * 绑定触控事件
     * Requirements: 1.1, 1.2 - 检测左右滑动手势
     */
    bind(): void;
    /**
     * 解绑触控事件
     * Requirements: 1.3 - 停止发送移动命令
     */
    unbind(): void;
    /**
     * 获取当前输入状态（只读）
     */
    getCurrentInput(): Readonly<PlayerInput>;
    /**
     * 处理触控开始事件
     * Requirements: 4.4 - 只处理第一个触控点
     */
    private handleTouchStart;
    /**
     * 处理触控移动事件
     *
     * 关键：拖动过程中一旦横向位移超过阈值就立即换道（不等抬手），
     * 这样操作是「即时」的，也不会因为抬手前手指抖回而丢失手势。
     * 一次触摸只换一条道（gestureConsumed），避免长按拖动连续换道。
     */
    private handleTouchMove;
    /**
     * 处理触控结束事件
     * Requirements: 1.1, 1.2, 1.3, 4.2, 4.3, 4.1 - 检测滑动手势并转换为输入命令，显示视觉反馈
     */
    private handleTouchEnd;
    /**
     * 检测滑动方向
     * Requirements: 4.2, 4.3 - 实现手势过滤逻辑（最小距离、最大时间）
     */
    private detectSwipeDirection;
    /**
     * 判断是否为短促轻触（滑动距离 < 18px、耗时 < 400ms）
     * 用于在滑动未达阈值时，提供「点击屏幕左右区域即可换道」的兜底交互。
     * 阈值放宽是为了兼容真机上的轻微抖动与稍慢的点按。
     */
    private isTap;
    /**
     * 根据轻触位置在画布上的横向区域判断移动方向
     * 左侧 40% 区域 = 左移，右侧 40% 区域 = 右移，中间 20% 忽略。
     * 中间死区收窄是为了让「点哪边就往哪边走」在真机上更容易命中。
     */
    private detectTapDirection;
    /**
     * 根据滑动方向更新输入状态
     * Requirements: 1.1, 1.2 - 左右滑动转换为移动输入命令
     */
    private updateInputFromSwipe;
    /**
     * 清除尚未执行的延时重置
     */
    private clearResetTimer;
    /**
     * 重置输入状态
     * Requirements: 1.3 - 停止发送移动命令
     */
    private resetInput;
    /**
     * 通知输入合并器触控输入状态变化
     *
     * 说明：InputMerger 内部已做「仅当合并结果变化时才发送」的去重，
     * 因此这里不再叠加防抖定时器——多个定时器与「延时重置」叠在一起时，
     * 会出现后一次滑动发出的输入被前一次的定时器清掉的问题。
     */
    private notifyInputMerger;
    /**
     * 显示滑动反馈效果
     * Requirements: 4.1 - 提供视觉反馈指示移动方向
     */
    private showSwipeFeedback;
    /**
     * 获取触控反馈管理器（用于外部配置）
     */
    getFeedbackManager(): TouchFeedbackManager;
    /**
     * 销毁触控处理器，清理所有资源
     */
    destroy(): void;
}
//# sourceMappingURL=touch-handler.d.ts.map