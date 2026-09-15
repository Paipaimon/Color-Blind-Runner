/**
 * 验证输入合并器功能的简单脚本
 */

// 模拟 PlayerInput 类型
const createInput = (up = false, down = false, left = false, right = false) => ({
  up, down, left, right
});

// 模拟 WebSocketClient
class MockWebSocketClient {
  constructor() {
    this.sentInputs = [];
  }

  sendInput(input) {
    this.sentInputs.push({ ...input });
    console.log('发送输入:', input);
  }

  getLastSentInput() {
    return this.sentInputs[this.sentInputs.length - 1];
  }
}

// 简化的 InputMerger 实现用于验证
class InputMerger {
  constructor(wsClient) {
    this.wsClient = wsClient;
    this.keyboardInput = createInput();
    this.touchInput = createInput();
    this.previousMergedInput = createInput();
  }

  updateKeyboardInput(input) {
    this.keyboardInput = { ...input };
    this.sendMergedInputIfChanged();
  }

  updateTouchInput(input) {
    this.touchInput = { ...input };
    this.sendMergedInputIfChanged();
  }

  mergeInputs() {
    return {
      up: this.keyboardInput.up || this.touchInput.up,
      down: this.keyboardInput.down || this.touchInput.down,
      left: this.keyboardInput.left || this.touchInput.left,
      right: this.keyboardInput.right || this.touchInput.right
    };
  }

  sendMergedInputIfChanged() {
    const mergedInput = this.mergeInputs();
    
    if (this.hasMergedInputChanged(mergedInput)) {
      this.wsClient.sendInput(mergedInput);
      this.previousMergedInput = { ...mergedInput };
    }
  }

  hasMergedInputChanged(mergedInput) {
    return (
      mergedInput.up !== this.previousMergedInput.up ||
      mergedInput.down !== this.previousMergedInput.down ||
      mergedInput.left !== this.previousMergedInput.left ||
      mergedInput.right !== this.previousMergedInput.right
    );
  }

  getMergedInput() {
    return this.mergeInputs();
  }
}

// 测试用例
console.log('=== 输入合并器功能验证 ===\n');

const mockWsClient = new MockWebSocketClient();
const inputMerger = new InputMerger(mockWsClient);

console.log('1. 测试键盘输入:');
inputMerger.updateKeyboardInput(createInput(false, false, true, false));
console.log('合并结果:', inputMerger.getMergedInput());
console.log('');

console.log('2. 测试触控输入:');
inputMerger.updateTouchInput(createInput(false, false, false, true));
console.log('合并结果:', inputMerger.getMergedInput());
console.log('');

console.log('3. 测试输入合并 (键盘左 + 触控右):');
inputMerger.updateKeyboardInput(createInput(false, false, true, false));
inputMerger.updateTouchInput(createInput(false, false, false, true));
console.log('合并结果:', inputMerger.getMergedInput());
console.log('');

console.log('4. 测试逻辑或运算:');
inputMerger.updateKeyboardInput(createInput(true, false, true, false));
inputMerger.updateTouchInput(createInput(false, true, false, true));
console.log('合并结果:', inputMerger.getMergedInput());
console.log('预期结果: { up: true, down: true, left: true, right: true }');
console.log('');

console.log('5. 测试相同输入不重复发送:');
const initialCount = mockWsClient.sentInputs.length;
inputMerger.updateKeyboardInput(createInput(true, false, true, false)); // 相同输入
console.log('发送次数变化:', mockWsClient.sentInputs.length - initialCount);
console.log('');

console.log('=== 验证完成 ===');
console.log('总共发送的输入次数:', mockWsClient.sentInputs.length);
console.log('所有发送的输入:', mockWsClient.sentInputs);