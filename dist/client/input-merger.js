/**
 * 输入合并器
 * 合并键盘和触控输入，处理优先级和冲突解决
 * Requirements: 1.5, 6.1, 6.2 - 正确合并两种输入方式，保持键盘功能不变
 */
/**
 * 输入源类型
 */
export var InputSource;
(function (InputSource) {
    InputSource["KEYBOARD"] = "keyboard";
    InputSource["TOUCH"] = "touch";
})(InputSource || (InputSource = {}));
/**
 * 输入合并器类
 * 负责合并键盘和触控输入，处理输入优先级
 */
export class InputMerger {
    wsClient;
    // 分别存储两种输入源的状态
    keyboardInput = {
        up: false,
        down: false,
        left: false,
        right: false
    };
    touchInput = {
        up: false,
        down: false,
        left: false,
        right: false
    };
    // 上次发送的合并输入状态
    previousMergedInput = {
        up: false,
        down: false,
        left: false,
        right: false
    };
    // 移动次数统计回调
    onMoveCallback;
    // 输入观察回调（仅调试用：观察合并后实际发出的输入）
    onInputObserver;
    // 输入优先级配置
    // Requirements: 6.2 - 处理输入优先级，键盘和触控可以同时工作
    inputPriority = {
        // 对于相同方向的输入，使用逻辑或运算（任一输入源激活即激活）
        // 这样键盘和触控可以协同工作，不会相互冲突
        mergeStrategy: 'OR'
    };
    constructor(wsClient) {
        this.wsClient = wsClient;
    }
    /**
     * 设置移动次数统计回调
     * Requirements: 3.1 - 统计移动次数用于游戏统计
     */
    setMoveCallback(callback) {
        this.onMoveCallback = callback;
    }
    /**
     * 观察合并后实际发出的输入（仅调试用）
     * 不改变任何输入行为，仅用于在浏览器内核验「触摸 → 输入」链路。
     */
    setInputObserver(observer) {
        this.onInputObserver = observer;
    }
    /**
     * 更新键盘输入状态
     * Requirements: 6.1 - 键盘输入功能保持完全不变
     */
    updateKeyboardInput(input) {
        this.keyboardInput = { ...input };
        this.sendMergedInputIfChanged();
    }
    /**
     * 更新触控输入状态
     * Requirements: 1.5 - 同时有键盘和触控输入时正确合并
     */
    updateTouchInput(input) {
        this.touchInput = { ...input };
        this.sendMergedInputIfChanged();
    }
    /**
     * 获取当前键盘输入状态（只读）
     */
    getKeyboardInput() {
        return { ...this.keyboardInput };
    }
    /**
     * 获取当前触控输入状态（只读）
     */
    getTouchInput() {
        return { ...this.touchInput };
    }
    /**
     * 获取当前合并后的输入状态（只读）
     */
    getMergedInput() {
        return this.mergeInputs();
    }
    /**
     * 合并两种输入源的输入状态
     * Requirements: 1.5, 6.2 - 正确处理输入优先级和冲突解决
     */
    mergeInputs() {
        // 使用逻辑或运算合并输入
        // 这意味着任一输入源激活某个方向，该方向就被激活
        // 这样可以实现键盘和触控的协同工作
        return {
            up: this.keyboardInput.up || this.touchInput.up,
            down: this.keyboardInput.down || this.touchInput.down,
            left: this.keyboardInput.left || this.touchInput.left,
            right: this.keyboardInput.right || this.touchInput.right
        };
    }
    /**
     * 检查合并后的输入是否发生变化，如果变化则发送到服务器
     * Requirements: 1.5 - 合并输入后发送到服务器
     * Requirements: 3.1 - 统计移动次数
     */
    sendMergedInputIfChanged() {
        const mergedInput = this.mergeInputs();
        if (this.hasMergedInputChanged(mergedInput)) {
            this.wsClient.sendInput(mergedInput);
            this.onInputObserver?.(mergedInput);
            // 检查是否有新的移动输入（从无移动到有移动）
            const hadMovement = this.previousMergedInput.left || this.previousMergedInput.right ||
                this.previousMergedInput.up || this.previousMergedInput.down;
            const hasMovement = mergedInput.left || mergedInput.right ||
                mergedInput.up || mergedInput.down;
            // 当从无移动变为有移动时，增加移动次数
            if (!hadMovement && hasMovement && this.onMoveCallback) {
                this.onMoveCallback();
            }
            this.previousMergedInput = { ...mergedInput };
        }
    }
    /**
     * 检查合并后的输入是否与上次发送的不同
     */
    hasMergedInputChanged(mergedInput) {
        return (mergedInput.up !== this.previousMergedInput.up ||
            mergedInput.down !== this.previousMergedInput.down ||
            mergedInput.left !== this.previousMergedInput.left ||
            mergedInput.right !== this.previousMergedInput.right);
    }
    /**
     * 重置所有输入状态
     * 用于清理状态，例如在断开连接时
     */
    reset() {
        this.keyboardInput = {
            up: false,
            down: false,
            left: false,
            right: false
        };
        this.touchInput = {
            up: false,
            down: false,
            left: false,
            right: false
        };
        this.previousMergedInput = {
            up: false,
            down: false,
            left: false,
            right: false
        };
    }
    /**
     * 获取输入源的调试信息
     * 用于调试和监控输入状态
     */
    getDebugInfo() {
        return {
            keyboard: this.getKeyboardInput(),
            touch: this.getTouchInput(),
            merged: this.getMergedInput(),
            strategy: this.inputPriority.mergeStrategy
        };
    }
}
//# sourceMappingURL=input-merger.js.map