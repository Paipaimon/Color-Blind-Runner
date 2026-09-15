/**
 * 输入合并集成测试
 * 验证 InputHandler、TouchHandler 和 InputMerger 的协同工作
 * Requirements: 1.5, 6.1, 6.2
 */
import { InputMerger } from './input-merger.js';
import { InputHandler } from './input-handler.js';
import { TouchHandler } from './touch-handler.js';
/**
 * 模拟 WebSocketClient 用于测试
 */
class MockWebSocketClient {
    sentInputs = [];
    sendInput(input) {
        this.sentInputs.push({ ...input });
        console.log('WebSocket 发送输入:', JSON.stringify(input));
    }
    getLastSentInput() {
        return this.sentInputs[this.sentInputs.length - 1];
    }
    clear() {
        this.sentInputs = [];
    }
}
/**
 * 模拟 DOM 元素用于测试
 */
class MockElement {
    eventListeners = new Map();
    addEventListener(event, handler) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(handler);
    }
    removeEventListener(event, handler) {
        const handlers = this.eventListeners.get(event);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }
    getBoundingClientRect() {
        return {
            left: 0,
            top: 0,
            right: 800,
            bottom: 600,
            width: 800,
            height: 600,
            x: 0,
            y: 0,
            toJSON: () => ({})
        };
    }
    // 模拟触发事件
    triggerEvent(event, eventData) {
        const handlers = this.eventListeners.get(event);
        if (handlers) {
            handlers.forEach(handler => handler(eventData));
        }
    }
}
/**
 * 集成测试函数
 */
function runIntegrationTest() {
    console.log('=== 输入合并集成测试 ===\n');
    // 创建模拟对象
    const mockWsClient = new MockWebSocketClient();
    const mockElement = new MockElement();
    // 创建输入合并器和处理器
    const inputMerger = new InputMerger(mockWsClient);
    const inputHandler = new InputHandler(inputMerger);
    const touchHandler = new TouchHandler(mockElement, inputMerger);
    console.log('1. 测试键盘输入处理:');
    mockWsClient.clear();
    // 模拟键盘输入
    const keyboardInput = {
        up: false,
        down: false,
        left: true,
        right: false
    };
    inputMerger.updateKeyboardInput(keyboardInput);
    console.log('键盘输入状态:', JSON.stringify(inputMerger.getKeyboardInput()));
    console.log('合并后输入:', JSON.stringify(inputMerger.getMergedInput()));
    console.log('发送次数:', mockWsClient.sentInputs.length);
    console.log('');
    console.log('2. 测试触控输入处理:');
    // 模拟触控输入
    const touchInput = {
        up: false,
        down: false,
        left: false,
        right: true
    };
    inputMerger.updateTouchInput(touchInput);
    console.log('触控输入状态:', JSON.stringify(inputMerger.getTouchInput()));
    console.log('合并后输入:', JSON.stringify(inputMerger.getMergedInput()));
    console.log('发送次数:', mockWsClient.sentInputs.length);
    console.log('');
    console.log('3. 测试输入合并逻辑:');
    const expectedMerged = {
        up: false,
        down: false,
        left: true, // 来自键盘
        right: true // 来自触控
    };
    const actualMerged = inputMerger.getMergedInput();
    console.log('预期合并结果:', JSON.stringify(expectedMerged));
    console.log('实际合并结果:', JSON.stringify(actualMerged));
    console.log('合并正确:', JSON.stringify(actualMerged) === JSON.stringify(expectedMerged));
    console.log('');
    console.log('4. 测试输入变化检测:');
    const initialCount = mockWsClient.sentInputs.length;
    // 发送相同的输入，不应该触发新的发送
    inputMerger.updateKeyboardInput(keyboardInput);
    console.log('重复输入后发送次数变化:', mockWsClient.sentInputs.length - initialCount);
    // 发送不同的输入，应该触发新的发送
    const newKeyboardInput = {
        up: true,
        down: false,
        left: true,
        right: false
    };
    inputMerger.updateKeyboardInput(newKeyboardInput);
    console.log('新输入后发送次数变化:', mockWsClient.sentInputs.length - initialCount);
    console.log('');
    console.log('5. 测试调试信息:');
    const debugInfo = inputMerger.getDebugInfo();
    console.log('调试信息:', JSON.stringify(debugInfo, null, 2));
    console.log('');
    console.log('=== 集成测试完成 ===');
    console.log('总发送次数:', mockWsClient.sentInputs.length);
    console.log('所有发送的输入:');
    mockWsClient.sentInputs.forEach((input, index) => {
        console.log(`  ${index + 1}:`, JSON.stringify(input));
    });
}
// 运行测试
runIntegrationTest();
//# sourceMappingURL=integration-test.js.map