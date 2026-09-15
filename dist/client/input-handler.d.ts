/**
 * 输入处理器
 * 监听键盘事件，通过输入合并器处理输入
 * Requirements: 2.5 - 客户端只发送输入命令，不修改本地游戏状态
 * Requirements: 6.1 - 键盘输入功能保持完全不变
 */
import { PlayerInput } from '../shared/messages.js';
import { InputMerger } from './input-merger.js';
/**
 * 输入处理器类
 * 捕获键盘输入并通过输入合并器处理
 * Requirements: 6.1 - 键盘功能保持完全不变
 */
export declare class InputHandler {
    private inputMerger;
    private currentInput;
    private isBound;
    private keydownHandler;
    private keyupHandler;
    constructor(inputMerger: InputMerger);
    /**
     * 绑定键盘事件
     */
    bind(): void;
    /**
     * 解绑键盘事件
     */
    unbind(): void;
    /**
     * 处理按键按下事件
     * 支持方向键和 WASD 键
     */
    private handleKeyDown;
    /**
     * 处理按键释放事件
     */
    private handleKeyUp;
    /**
     * 通知输入合并器键盘输入状态变化
     * Requirements: 6.1 - 键盘功能保持完全不变，只是改为通过输入合并器处理
     */
    private notifyInputMerger;
    /**
     * 获取当前输入状态（只读）
     */
    getCurrentInput(): Readonly<PlayerInput>;
}
//# sourceMappingURL=input-handler.d.ts.map