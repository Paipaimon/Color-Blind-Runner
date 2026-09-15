/**
 * 输入处理器
 * 监听键盘事件，通过输入合并器处理输入
 * Requirements: 2.5 - 客户端只发送输入命令，不修改本地游戏状态
 * Requirements: 6.1 - 键盘输入功能保持完全不变
 */
/**
 * 输入处理器类
 * 捕获键盘输入并通过输入合并器处理
 * Requirements: 6.1 - 键盘功能保持完全不变
 */
export class InputHandler {
    inputMerger;
    currentInput = {
        up: false,
        down: false,
        left: false,
        right: false
    };
    isBound = false;
    // 绑定的事件处理函数引用（用于解绑）
    keydownHandler;
    keyupHandler;
    constructor(inputMerger) {
        this.inputMerger = inputMerger;
        this.keydownHandler = this.handleKeyDown.bind(this);
        this.keyupHandler = this.handleKeyUp.bind(this);
    }
    /**
     * 绑定键盘事件
     */
    bind() {
        if (this.isBound)
            return;
        window.addEventListener('keydown', this.keydownHandler);
        window.addEventListener('keyup', this.keyupHandler);
        this.isBound = true;
    }
    /**
     * 解绑键盘事件
     */
    unbind() {
        if (!this.isBound)
            return;
        window.removeEventListener('keydown', this.keydownHandler);
        window.removeEventListener('keyup', this.keyupHandler);
        this.isBound = false;
        // 重置输入状态
        this.currentInput = {
            up: false,
            down: false,
            left: false,
            right: false
        };
    }
    /**
     * 处理按键按下事件
     * 支持方向键和 WASD 键
     */
    handleKeyDown(event) {
        const key = event.key.toLowerCase();
        let changed = false;
        switch (key) {
            case 'arrowup':
            case 'w':
                if (!this.currentInput.up) {
                    this.currentInput.up = true;
                    changed = true;
                }
                break;
            case 'arrowdown':
            case 's':
                if (!this.currentInput.down) {
                    this.currentInput.down = true;
                    changed = true;
                }
                break;
            case 'arrowleft':
            case 'a':
                if (!this.currentInput.left) {
                    this.currentInput.left = true;
                    changed = true;
                }
                break;
            case 'arrowright':
            case 'd':
                if (!this.currentInput.right) {
                    this.currentInput.right = true;
                    changed = true;
                }
                break;
            default:
                return; // 不处理其他按键
        }
        // 阻止默认行为（如页面滚动）
        event.preventDefault();
        // 只在输入变化时通知输入合并器
        if (changed) {
            this.notifyInputMerger();
        }
    }
    /**
     * 处理按键释放事件
     */
    handleKeyUp(event) {
        const key = event.key.toLowerCase();
        let changed = false;
        switch (key) {
            case 'arrowup':
            case 'w':
                if (this.currentInput.up) {
                    this.currentInput.up = false;
                    changed = true;
                }
                break;
            case 'arrowdown':
            case 's':
                if (this.currentInput.down) {
                    this.currentInput.down = false;
                    changed = true;
                }
                break;
            case 'arrowleft':
            case 'a':
                if (this.currentInput.left) {
                    this.currentInput.left = false;
                    changed = true;
                }
                break;
            case 'arrowright':
            case 'd':
                if (this.currentInput.right) {
                    this.currentInput.right = false;
                    changed = true;
                }
                break;
            default:
                return;
        }
        event.preventDefault();
        if (changed) {
            this.notifyInputMerger();
        }
    }
    /**
     * 通知输入合并器键盘输入状态变化
     * Requirements: 6.1 - 键盘功能保持完全不变，只是改为通过输入合并器处理
     */
    notifyInputMerger() {
        this.inputMerger.updateKeyboardInput({ ...this.currentInput });
    }
    /**
     * 获取当前输入状态（只读）
     */
    getCurrentInput() {
        return { ...this.currentInput };
    }
}
//# sourceMappingURL=input-handler.js.map