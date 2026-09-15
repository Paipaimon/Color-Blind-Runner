/**
 * 游戏提示悬浮组件
 * 显示游戏操作提示和帮助信息
 */
/**
 * 游戏提示管理器类
 */
export class GameTipsManager {
    container;
    tipsButton;
    tipsPanel;
    isVisible = false;
    isMobile = false;
    constructor() {
        this.isMobile = this.detectMobileDevice();
        this.createTipsUI();
        this.setupEventListeners();
    }
    /**
     * 检测移动设备
     */
    detectMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            (window.innerWidth <= 768 && 'ontouchstart' in window);
    }
    /**
     * 创建提示UI
     */
    createTipsUI() {
        // 创建容器
        this.container = document.createElement('div');
        this.container.className = 'game-tips-container';
        // 创建提示按钮
        this.tipsButton = document.createElement('button');
        this.tipsButton.className = 'game-tips-button';
        this.tipsButton.innerHTML = '❓';
        this.tipsButton.title = '游戏提示';
        this.tipsButton.setAttribute('aria-label', '显示游戏操作提示');
        // 创建提示面板
        this.tipsPanel = document.createElement('div');
        this.tipsPanel.className = 'game-tips-panel';
        this.tipsPanel.innerHTML = this.generateTipsContent();
        // 组装UI
        this.container.appendChild(this.tipsButton);
        this.container.appendChild(this.tipsPanel);
        // 添加样式
        this.addStyles();
        // 添加到页面
        document.body.appendChild(this.container);
    }
    /**
     * 生成提示内容
     */
    generateTipsContent() {
        const keyboardTips = `
      <div class="tips-section">
        <h3>🎮 键盘操作</h3>
        <div class="tips-item">
          <span class="key">←</span>
          <span class="key">→</span>
          <span class="desc">左右移动</span>
        </div>
        <div class="tips-item">
          <span class="key">空格</span>
          <span class="desc">准备/重新开始</span>
        </div>
      </div>
    `;
        const touchTips = `
      <div class="tips-section">
        <h3>📱 触控操作</h3>
        <div class="tips-item">
          <span class="gesture">👈 左滑</span>
          <span class="desc">向左移动</span>
        </div>
        <div class="tips-item">
          <span class="gesture">👉 右滑</span>
          <span class="desc">向右移动</span>
        </div>
        <div class="tips-item">
          <span class="gesture">👆 点击</span>
          <span class="desc">准备/重新开始</span>
        </div>
      </div>
    `;
        const gameTips = `
      <div class="tips-section">
        <h3>🎯 游戏教程</h3>
        <div class="tips-item">
          <span class="tip-icon">🎨</span>
          <span class="desc">每个玩家有不同的颜色</span>
        </div>
        <div class="tips-item">
          <span class="tip-icon">👁️</span>
          <span class="desc">你只能看到别人的颜色</span>
        </div>
        <div class="tips-item">
          <span class="tip-icon">🚀</span>
          <span class="desc">避开障碍物，靠近会有提示</span>
        </div>
        
      </div>
    `;
        const closeButton = `
      <div class="tips-close">
        <button class="close-btn" aria-label="关闭提示">✕</button>
      </div>
    `;
        return `
      <div class="tips-header">
        <h2>🎮 游戏操作指南</h2>
      </div>
      <div class="tips-content">
        ${this.isMobile ? touchTips + keyboardTips : keyboardTips + touchTips}
        ${gameTips}
      </div>
      ${closeButton}
    `;
    }
    /**
     * 添加样式
     */
    addStyles() {
        const styleId = 'game-tips-styles';
        // 避免重复添加
        if (document.getElementById(styleId)) {
            return;
        }
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
      .game-tips-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
        font-family: 'Segoe UI', Arial, sans-serif;
      }

      .game-tips-button {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }

      .game-tips-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
      }

      .game-tips-button:active {
        transform: translateY(0);
      }

      .game-tips-button::before {
        content: '';
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        opacity: 0;
        transform: scale(0);
        transition: all 0.3s ease;
      }

      .game-tips-button:hover::before {
        opacity: 1;
        transform: scale(1);
      }

      .game-tips-panel {
        position: absolute;
        top: 60px;
        right: 0;
        width: 320px;
        max-height: 500px;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        opacity: 0;
        visibility: hidden;
        transform: translateY(-10px) scale(0.95);
        transition: all 0.3s ease;
        overflow: hidden;
        color: #333;
      }

      .game-tips-panel.visible {
        opacity: 1;
        visibility: visible;
        transform: translateY(0) scale(1);
      }

      .tips-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px 20px;
        text-align: center;
      }

      .tips-header h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
      }

      .tips-content {
        padding: 20px;
        max-height: 400px;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
      }

      .tips-content::-webkit-scrollbar {
        width: 4px;
      }

      .tips-content::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.1);
        border-radius: 2px;
      }

      .tips-content::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.3);
        border-radius: 2px;
      }

      .tips-section {
        margin-bottom: 20px;
      }

      .tips-section:last-child {
        margin-bottom: 0;
      }

      .tips-section h3 {
        margin: 0 0 12px 0;
        font-size: 16px;
        font-weight: 600;
        color: #444;
        border-bottom: 2px solid #eee;
        padding-bottom: 5px;
      }

      .tips-item {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
        padding: 8px 0;
      }

      .tips-item:last-child {
        margin-bottom: 0;
      }

      .key {
        display: inline-block;
        background: #f5f5f5;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 4px 8px;
        margin-right: 8px;
        font-family: monospace;
        font-size: 12px;
        font-weight: bold;
        color: #555;
        min-width: 30px;
        text-align: center;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      }

      .gesture {
        display: inline-block;
        background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);
        color: white;
        border-radius: 6px;
        padding: 4px 10px;
        margin-right: 12px;
        font-size: 12px;
        font-weight: 600;
        min-width: 60px;
        text-align: center;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
      }

      .tip-icon {
        font-size: 18px;
        margin-right: 12px;
        width: 24px;
        text-align: center;
      }

      .desc {
        flex: 1;
        font-size: 14px;
        color: #666;
        line-height: 1.4;
      }

      .tips-close {
        padding: 15px 20px;
        border-top: 1px solid #eee;
        text-align: center;
      }

      .close-btn {
        background: #ff6b6b;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px 16px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: all 0.2s ease;
      }

      .close-btn:hover {
        background: #ff5252;
        transform: translateY(-1px);
      }

      .close-btn:active {
        transform: translateY(0);
      }

      /* 移动端适配 */
      @media (max-width: 768px) {
        .game-tips-container {
          top: 15px;
          right: 15px;
        }

        .game-tips-button {
          width: 45px;
          height: 45px;
          font-size: 18px;
        }

        .game-tips-panel {
          width: calc(100vw - 30px);
          max-width: 300px;
          right: -10px;
        }

        .tips-header h2 {
          font-size: 16px;
        }

        .tips-content {
          padding: 15px;
        }

        .tips-section h3 {
          font-size: 14px;
        }

        .desc {
          font-size: 13px;
        }
      }

      @media (max-width: 480px) {
        .game-tips-container {
          top: 10px;
          right: 10px;
        }

        .game-tips-button {
          width: 40px;
          height: 40px;
          font-size: 16px;
        }

        .game-tips-panel {
          width: calc(100vw - 20px);
          right: -15px;
          top: 50px;
        }
      }

      /* 深色模式支持 */
      @media (prefers-color-scheme: dark) {
        .game-tips-panel {
          background: rgba(30, 30, 30, 0.95);
          color: #e0e0e0;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .tips-section h3 {
          color: #f0f0f0;
          border-bottom-color: #444;
        }

        .key {
          background: #444;
          border-color: #555;
          color: #e0e0e0;
        }

        .desc {
          color: #ccc;
        }

        .tips-close {
          border-top-color: #444;
        }
      }

      /* 动画效果 */
      @keyframes pulse {
        0%, 100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.05);
        }
      }

      .game-tips-button.pulse {
        animation: pulse 2s infinite;
      }
    `;
        document.head.appendChild(style);
    }
    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 点击按钮切换显示
        this.tipsButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleTips();
        });
        // 点击关闭按钮
        this.tipsPanel.addEventListener('click', (e) => {
            if (e.target.classList.contains('close-btn')) {
                this.hideTips();
            }
            e.stopPropagation();
        });
        // 点击外部区域关闭
        document.addEventListener('click', (e) => {
            if (this.isVisible && !this.container.contains(e.target)) {
                this.hideTips();
            }
        });
        // ESC键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hideTips();
            }
        });
        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            this.isMobile = this.detectMobileDevice();
            this.updateTipsContent();
        });
    }
    /**
     * 切换提示显示
     */
    toggleTips() {
        if (this.isVisible) {
            this.hideTips();
        }
        else {
            this.showTips();
        }
    }
    /**
     * 显示提示
     */
    showTips() {
        this.isVisible = true;
        this.tipsPanel.classList.add('visible');
        this.tipsButton.classList.remove('pulse');
    }
    /**
     * 隐藏提示
     */
    hideTips() {
        this.isVisible = false;
        this.tipsPanel.classList.remove('visible');
    }
    /**
     * 更新提示内容
     */
    updateTipsContent() {
        this.tipsPanel.innerHTML = this.generateTipsContent();
    }
    /**
     * 显示脉冲动画（用于吸引注意）
     */
    showPulse() {
        this.tipsButton.classList.add('pulse');
    }
    /**
     * 隐藏脉冲动画
     */
    hidePulse() {
        this.tipsButton.classList.remove('pulse');
    }
    /**
     * 销毁组件
     */
    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        // 移除样式
        const styles = document.getElementById('game-tips-styles');
        if (styles) {
            styles.remove();
        }
    }
}
//# sourceMappingURL=game-tips.js.map