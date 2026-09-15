/**
 * 输入合并器测试
 * 验证键盘和触控输入的正确合并
 * Requirements: 1.5, 6.1, 6.2
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { InputMerger } from './input-merger.js';
// 简单的模拟 WebSocketClient
class MockWebSocketClient {
    sentInputs = [];
    sendInput(input) {
        this.sentInputs.push({ ...input });
    }
    getLastSentInput() {
        return this.sentInputs[this.sentInputs.length - 1];
    }
    clear() {
        this.sentInputs = [];
    }
}
describe('InputMerger', () => {
    let inputMerger;
    let mockWsClient;
    beforeEach(() => {
        mockWsClient = new MockWebSocketClient();
        inputMerger = new InputMerger(mockWsClient);
    });
    describe('键盘输入处理', () => {
        it('应该正确处理键盘输入', () => {
            const keyboardInput = {
                up: false,
                down: false,
                left: true,
                right: false
            };
            inputMerger.updateKeyboardInput(keyboardInput);
            expect(inputMerger.getKeyboardInput()).toEqual(keyboardInput);
            expect(inputMerger.getMergedInput()).toEqual(keyboardInput);
            expect(mockWsClient.getLastSentInput()).toEqual(keyboardInput);
        });
        it('应该保持键盘功能完全不变', () => {
            // Requirements: 6.1 - 键盘输入功能保持完全不变
            const keyboardInput1 = {
                up: true,
                down: false,
                left: false,
                right: false
            };
            const keyboardInput2 = {
                up: false,
                down: true,
                left: false,
                right: false
            };
            inputMerger.updateKeyboardInput(keyboardInput1);
            expect(mockWsClient.getLastSentInput()).toEqual(keyboardInput1);
            inputMerger.updateKeyboardInput(keyboardInput2);
            expect(mockWsClient.getLastSentInput()).toEqual(keyboardInput2);
        });
    });
    describe('触控输入处理', () => {
        it('应该正确处理触控输入', () => {
            const touchInput = {
                up: false,
                down: false,
                left: false,
                right: true
            };
            inputMerger.updateTouchInput(touchInput);
            expect(inputMerger.getTouchInput()).toEqual(touchInput);
            expect(inputMerger.getMergedInput()).toEqual(touchInput);
            expect(mockWsClient.getLastSentInput()).toEqual(touchInput);
        });
    });
    describe('输入合并逻辑', () => {
        it('应该正确合并键盘和触控输入', () => {
            // Requirements: 1.5 - 同时有键盘和触控输入时正确合并
            const keyboardInput = {
                up: true,
                down: false,
                left: true,
                right: false
            };
            const touchInput = {
                up: false,
                down: true,
                left: false,
                right: true
            };
            const expectedMerged = {
                up: true, // keyboard OR touch = true OR false = true
                down: true, // keyboard OR touch = false OR true = true
                left: true, // keyboard OR touch = true OR false = true
                right: true // keyboard OR touch = false OR true = true
            };
            inputMerger.updateKeyboardInput(keyboardInput);
            inputMerger.updateTouchInput(touchInput);
            expect(inputMerger.getMergedInput()).toEqual(expectedMerged);
            expect(mockWsClient.getLastSentInput()).toEqual(expectedMerged);
        });
        it('应该使用逻辑或运算合并输入', () => {
            // Requirements: 6.2 - 处理输入优先级，使用逻辑或运算
            const testCases = [
                {
                    keyboard: { up: true, down: false, left: false, right: false },
                    touch: { up: false, down: false, left: false, right: false },
                    expected: { up: true, down: false, left: false, right: false }
                },
                {
                    keyboard: { up: false, down: false, left: false, right: false },
                    touch: { up: true, down: false, left: false, right: false },
                    expected: { up: true, down: false, left: false, right: false }
                },
                {
                    keyboard: { up: true, down: false, left: false, right: false },
                    touch: { up: true, down: false, left: false, right: false },
                    expected: { up: true, down: false, left: false, right: false }
                }
            ];
            testCases.forEach(({ keyboard, touch, expected }) => {
                inputMerger.reset();
                mockWsClient.clear();
                inputMerger.updateKeyboardInput(keyboard);
                inputMerger.updateTouchInput(touch);
                expect(inputMerger.getMergedInput()).toEqual(expected);
            });
        });
        it('应该在输入变化时发送合并后的输入', () => {
            const keyboardInput = {
                up: false,
                down: false,
                left: true,
                right: false
            };
            const touchInput = {
                up: false,
                down: false,
                left: false,
                right: true
            };
            inputMerger.updateKeyboardInput(keyboardInput);
            expect(mockWsClient.sentInputs).toHaveLength(1);
            inputMerger.updateTouchInput(touchInput);
            expect(mockWsClient.sentInputs).toHaveLength(2);
            const expectedMerged = {
                up: false,
                down: false,
                left: true,
                right: true
            };
            expect(mockWsClient.getLastSentInput()).toEqual(expectedMerged);
        });
        it('应该在输入未变化时不发送重复输入', () => {
            const sameInput = {
                up: false,
                down: false,
                left: true,
                right: false
            };
            inputMerger.updateKeyboardInput(sameInput);
            expect(mockWsClient.sentInputs).toHaveLength(1);
            // 发送相同的输入，不应该再次调用 sendInput
            inputMerger.updateKeyboardInput(sameInput);
            expect(mockWsClient.sentInputs).toHaveLength(1);
        });
    });
    describe('状态管理', () => {
        it('应该正确重置所有输入状态', () => {
            const keyboardInput = {
                up: true,
                down: true,
                left: true,
                right: true
            };
            const touchInput = {
                up: true,
                down: true,
                left: true,
                right: true
            };
            inputMerger.updateKeyboardInput(keyboardInput);
            inputMerger.updateTouchInput(touchInput);
            inputMerger.reset();
            const emptyInput = {
                up: false,
                down: false,
                left: false,
                right: false
            };
            expect(inputMerger.getKeyboardInput()).toEqual(emptyInput);
            expect(inputMerger.getTouchInput()).toEqual(emptyInput);
            expect(inputMerger.getMergedInput()).toEqual(emptyInput);
        });
        it('应该提供调试信息', () => {
            const keyboardInput = {
                up: true,
                down: false,
                left: false,
                right: false
            };
            const touchInput = {
                up: false,
                down: false,
                left: true,
                right: false
            };
            inputMerger.updateKeyboardInput(keyboardInput);
            inputMerger.updateTouchInput(touchInput);
            const debugInfo = inputMerger.getDebugInfo();
            expect(debugInfo.keyboard).toEqual(keyboardInput);
            expect(debugInfo.touch).toEqual(touchInput);
            expect(debugInfo.merged).toEqual({
                up: true,
                down: false,
                left: true,
                right: false
            });
            expect(debugInfo.strategy).toBe('OR');
        });
    });
});
//# sourceMappingURL=input-merger.test.js.map