/**
 * 输入合并器
 * 合并键盘和触控输入，处理优先级和冲突解决
 * Requirements: 1.5, 6.1, 6.2 - 正确合并两种输入方式，保持键盘功能不变
 */
import { PlayerInput } from '../shared/messages.js';
import { WebSocketClient } from './websocket-client.js';
/**
 * 输入源类型
 */
export declare enum InputSource {
    KEYBOARD = "keyboard",
    TOUCH = "touch"
}
/**
 * 输入合并器类
 * 负责合并键盘和触控输入，处理输入优先级
 */
export declare class InputMerger {
    private wsClient;
    private keyboardInput;
    private touchInput;
    private previousMergedInput;
    private onMoveCallback?;
    private onInputObserver?;
    private readonly inputPriority;
    constructor(wsClient: WebSocketClient);
    /**
     * 设置移动次数统计回调
     * Requirements: 3.1 - 统计移动次数用于游戏统计
     */
    setMoveCallback(callback: () => void): void;
    /**
     * 观察合并后实际发出的输入（仅调试用）
     * 不改变任何输入行为，仅用于在浏览器内核验「触摸 → 输入」链路。
     */
    setInputObserver(observer: (input: PlayerInput) => void): void;
    /**
     * 更新键盘输入状态
     * Requirements: 6.1 - 键盘输入功能保持完全不变
     */
    updateKeyboardInput(input: PlayerInput): void;
    /**
     * 更新触控输入状态
     * Requirements: 1.5 - 同时有键盘和触控输入时正确合并
     */
    updateTouchInput(input: PlayerInput): void;
    /**
     * 获取当前键盘输入状态（只读）
     */
    getKeyboardInput(): Readonly<PlayerInput>;
    /**
     * 获取当前触控输入状态（只读）
     */
    getTouchInput(): Readonly<PlayerInput>;
    /**
     * 获取当前合并后的输入状态（只读）
     */
    getMergedInput(): Readonly<PlayerInput>;
    /**
     * 合并两种输入源的输入状态
     * Requirements: 1.5, 6.2 - 正确处理输入优先级和冲突解决
     */
    private mergeInputs;
    /**
     * 检查合并后的输入是否发生变化，如果变化则发送到服务器
     * Requirements: 1.5 - 合并输入后发送到服务器
     * Requirements: 3.1 - 统计移动次数
     */
    private sendMergedInputIfChanged;
    /**
     * 检查合并后的输入是否与上次发送的不同
     */
    private hasMergedInputChanged;
    /**
     * 重置所有输入状态
     * 用于清理状态，例如在断开连接时
     */
    reset(): void;
    /**
     * 获取输入源的调试信息
     * 用于调试和监控输入状态
     */
    getDebugInfo(): {
        keyboard: PlayerInput;
        touch: PlayerInput;
        merged: PlayerInput;
        strategy: string;
    };
}
//# sourceMappingURL=input-merger.d.ts.map