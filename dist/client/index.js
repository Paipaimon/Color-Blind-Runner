/**
 * 客户端入口
 * 集成 WebSocket 客户端、输入处理器和画布渲染器
 * Requirements: 客户端集成
 */
import { WebSocketClient } from './websocket-client.js';
import { InputHandler } from './input-handler.js';
import { TouchHandler } from './touch-handler.js';
import { InputMerger } from './input-merger.js';
import { CanvasRenderer } from './canvas-renderer.js';
import { ViewportManager } from './viewport-manager.js';
import { StatusBarRenderer } from './status-bar-renderer.js';
import { ServerMessageType } from '../shared/messages.js';
import { GameState, PlayerColor } from '../shared/types.js';
import { GAME_CONFIG } from '../shared/constants.js';
/**
 * 游戏客户端类
 * 协调所有客户端组件，集成输入合并功能和移动端适配
 * Requirements: 1.5, 6.1, 6.2 - 支持键盘和触控输入合并
 * Requirements: 2.1, 2.2, 2.3, 2.4 - 移动端界面适配
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5 - 增强状态栏信息显示
 */
class GameClient {
    wsClient;
    inputMerger;
    inputHandler;
    touchHandler;
    renderer;
    viewportManager = null;
    statusBarRenderer = null;
    currentState = null;
    myPlayerId = null;
    myPlayerColor = null;
    roomId = null;
    isReady = false;
    constructor() {
        // 获取服务器地址
        const serverUrl = this.getServerUrl();
        // 初始化组件
        this.wsClient = new WebSocketClient(serverUrl);
        // Requirements: 1.5, 6.1, 6.2 - 创建输入合并器，集成键盘和触控输入
        this.inputMerger = new InputMerger(this.wsClient);
        this.inputHandler = new InputHandler(this.inputMerger);
        // 触控处理器将在 init 方法中初始化（需要画布元素）
        this.touchHandler = null; // 将在 init 中正确初始化
        this.renderer = new CanvasRenderer();
        // 设置消息处理
        this.setupMessageHandlers();
    }
    /**
     * 获取服务器 WebSocket 地址
     * 支持通过 URL 参数指定服务器地址：?server=192.168.1.100
     *
     * 连接规则：
     * - 如果通过 HTTPS 访问，使用 wss:// 协议（通过反向代理）
     * - 如果通过 HTTP 访问，使用 ws:// 协议
     * - 本地开发时可通过 ?server=localhost 指定本地服务器
     */
    getServerUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const serverParam = urlParams.get('server');
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = serverParam || window.location.hostname || 'localhost';
        // 如果是通过反向代理访问（HTTPS），不需要指定端口
        // 如果是本地开发（HTTP），需要指定端口
        let url;
        if (window.location.protocol === 'https:') {
            // 生产环境：通过反向代理，不需要端口
            url = `${protocol}//${host}`;
        }
        else {
            // 开发环境：直接连接到 Node.js 服务器
            const port = GAME_CONFIG.DEFAULT_PORT;
            url = `${protocol}//${host}:${port}`;
        }
        console.log('[WebSocket] 连接地址:', url);
        return url;
    }
    /**
     * 初始化游戏
     */
    async init() {
        // 获取画布元素
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) {
            throw new Error('找不到 gameCanvas 元素');
        }
        // 获取状态栏和游戏包装器元素
        const statusBar = document.getElementById('statusBar');
        const gameWrapper = document.querySelector('.game-wrapper');
        if (!statusBar) {
            throw new Error('找不到 statusBar 元素');
        }
        if (!gameWrapper) {
            throw new Error('找不到 game-wrapper 元素');
        }
        // Requirements: 2.1, 2.2, 2.3, 2.4 - 初始化视口管理器
        this.viewportManager = new ViewportManager(canvas, statusBar, gameWrapper);
        this.viewportManager.init();
        // Requirements: 3.1, 3.2, 3.3, 3.4, 3.5 - 初始化增强状态栏渲染器
        this.statusBarRenderer = new StatusBarRenderer(statusBar);
        // 设置移动次数统计回调
        this.inputMerger.setMoveCallback(() => {
            if (this.statusBarRenderer) {
                this.statusBarRenderer.incrementMoveCount();
            }
        });
        // 初始化渲染器
        this.renderer.init(canvas);
        // Requirements: 1.1, 1.2, 1.3 - 初始化触控处理器
        this.touchHandler = new TouchHandler(canvas, this.inputMerger);
        // 绑定空格键用于准备/重新开始
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.handleReadyAction();
            }
        });
        // 绑定点击屏幕准备功能（解决移动端准备问题）
        canvas.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleReadyAction();
        });
        // 绑定触摸屏幕准备功能（移动端）
        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            // 只有在非游戏状态下才处理准备操作，避免与游戏操作冲突
            if (this.currentState &&
                (this.currentState.gameState === GameState.WAITING ||
                    this.currentState.gameState === GameState.GAME_OVER)) {
                this.handleReadyAction();
            }
        });
        // 显示初始界面
        this.renderInitialScreen();
        // 连接服务器
        await this.connect();
    }
    /**
     * 连接到服务器
     */
    async connect() {
        try {
            this.updateStatus('正在连接服务器...');
            this.wsClient.onConnect(() => {
                this.updateStatus('已连接，正在加入房间...');
                // 自动加入房间
                this.wsClient.joinRoom();
            });
            this.wsClient.onDisconnect(() => {
                this.updateStatus('连接断开，请刷新页面重试');
                // Requirements: 6.1 - 断开连接时解绑所有输入处理器
                this.inputHandler.unbind();
                this.touchHandler.unbind();
                // 停止状态栏动画
                if (this.statusBarRenderer) {
                    this.statusBarRenderer.stopAnimation();
                }
            });
            this.wsClient.onError(() => {
                this.updateStatus('连接错误，请检查服务器是否运行');
            });
            await this.wsClient.connect();
        }
        catch (error) {
            this.updateStatus('无法连接到服务器');
            console.error('连接失败:', error);
        }
    }
    /**
     * 设置消息处理器
     */
    setupMessageHandlers() {
        this.wsClient.onMessage((message) => {
            switch (message.type) {
                case ServerMessageType.ROOM_JOINED:
                    this.handleRoomJoined(message);
                    break;
                case ServerMessageType.GAME_STATE:
                    this.handleGameState(message);
                    break;
                case ServerMessageType.COUNTDOWN:
                    this.handleCountdown(message);
                    break;
                case ServerMessageType.GAME_START:
                    this.handleGameStart();
                    break;
                case ServerMessageType.GAME_OVER:
                    this.handleGameOver(message);
                    break;
                case ServerMessageType.PLAYER_DIED:
                    this.handlePlayerDied(message);
                    break;
                case ServerMessageType.ERROR:
                    this.handleError(message);
                    break;
            }
        });
    }
    /**
     * 处理加入房间成功
     */
    handleRoomJoined(message) {
        this.roomId = message.roomId;
        this.myPlayerId = message.playerId;
        this.myPlayerColor = message.playerColor;
        // 重置渲染器并设置玩家信息
        this.renderer.resetAll();
        this.renderer.setMyPlayer(message.playerId, message.playerColor);
        // 初始化当前状态为等待状态
        this.currentState = {
            players: [],
            obstacles: [],
            scrollSpeed: 0,
            gameState: GameState.WAITING
        };
        // Requirements: 3.1, 3.2, 3.3, 3.4 - 使用新的状态栏渲染器
        if (this.statusBarRenderer && this.myPlayerId && this.myPlayerColor) {
            this.statusBarRenderer.render(this.currentState, this.myPlayerId, message.roomId, message.playerColor);
        }
    }
    /**
     * 获取颜色的中文名称
     */
    getColorName(color) {
        const names = {
            [PlayerColor.RED]: '红色',
            [PlayerColor.GREEN]: '绿色',
            [PlayerColor.BLUE]: '蓝色',
            [PlayerColor.YELLOW]: '黄色'
        };
        return names[color] || color;
    }
    /**
     * 处理游戏状态更新
     * Requirements: 8.3, 8.4 - 接收并渲染服务器状态
     * Requirements: 3.1 - 实时更新游戏统计信息
     */
    handleGameState(message) {
        this.currentState = message.state;
        // Requirements: 8.4 - 直接渲染接收到的状态，不做修改
        this.renderer.render(message.state);
        // Requirements: 3.1 - 使用新的状态栏渲染器更新游戏信息
        if (this.statusBarRenderer && this.myPlayerId) {
            this.statusBarRenderer.render(message.state, this.myPlayerId, this.roomId || undefined, this.myPlayerColor || undefined);
        }
    }
    /**
     * 处理倒计时
     */
    handleCountdown(message) {
        if (this.currentState) {
            this.currentState.countdown = message.seconds;
            this.currentState.gameState = GameState.COUNTDOWN;
            this.renderer.render(this.currentState);
            // Requirements: 3.1 - 更新状态栏显示倒计时
            if (this.statusBarRenderer && this.myPlayerId) {
                this.statusBarRenderer.render(this.currentState, this.myPlayerId, this.roomId || undefined, this.myPlayerColor || undefined);
            }
        }
    }
    /**
     * 处理游戏开始
     */
    handleGameStart() {
        // Requirements: 1.5, 6.1, 6.2 - 绑定键盘和触控输入处理器
        this.inputHandler.bind();
        this.touchHandler.bind();
        // Requirements: 3.5 - 启动状态栏动画
        if (this.statusBarRenderer) {
            this.statusBarRenderer.startAnimation();
        }
        if (this.currentState && this.statusBarRenderer && this.myPlayerId) {
            this.statusBarRenderer.render(this.currentState, this.myPlayerId, this.roomId || undefined, this.myPlayerColor || undefined);
        }
    }
    /**
     * 处理游戏结束
     */
    handleGameOver(message) {
        // Requirements: 6.1 - 游戏结束时解绑所有输入处理器
        this.inputHandler.unbind();
        this.touchHandler.unbind();
        this.isReady = false;
        this.currentState = message.finalState;
        this.renderer.render(message.finalState);
        // Requirements: 3.2, 3.3 - 显示游戏结束信息和排名
        if (this.statusBarRenderer && this.myPlayerId) {
            this.statusBarRenderer.render(message.finalState, this.myPlayerId, this.roomId || undefined, this.myPlayerColor || undefined);
            this.statusBarRenderer.stopAnimation();
        }
    }
    /**
     * 处理玩家死亡
     */
    handlePlayerDied(message) {
        if (message.playerId === this.myPlayerId) {
            // Requirements: 3.2 - 显示死亡状态信息
            if (this.currentState && this.statusBarRenderer && this.myPlayerId) {
                this.statusBarRenderer.render(this.currentState, this.myPlayerId, this.roomId || undefined, this.myPlayerColor || undefined);
            }
        }
    }
    /**
     * 处理错误消息
     */
    handleError(message) {
        this.updateStatus(`错误: ${message.message}`);
        console.error('服务器错误:', message);
    }
    /**
     * 处理准备操作（空格键或点击屏幕）
     */
    handleReadyAction() {
        if (!this.currentState)
            return;
        if (this.currentState.gameState === GameState.WAITING && !this.isReady) {
            this.wsClient.sendReady();
            this.isReady = true;
            // Requirements: 3.1 - 更新准备状态显示
            if (this.statusBarRenderer && this.myPlayerId) {
                this.statusBarRenderer.render(this.currentState, this.myPlayerId, this.roomId || undefined, this.myPlayerColor || undefined);
            }
        }
        else if (this.currentState.gameState === GameState.GAME_OVER) {
            // 重置渲染器状态
            this.renderer.resetAll();
            // 重新加入房间
            this.wsClient.joinRoom();
            this.isReady = false;
        }
    }
    /**
     * 处理空格键（保持向后兼容）
     */
    handleSpaceKey() {
        this.handleReadyAction();
    }
    /**
     * 渲染初始界面
     */
    renderInitialScreen() {
        const defaultState = {
            players: [],
            obstacles: [],
            scrollSpeed: 0,
            gameState: GameState.WAITING
        };
        this.renderer.render(defaultState);
    }
    /**
     * 更新状态显示
     */
    updateStatus(text) {
        console.log('[状态]', text);
    }
    /**
     * 更新状态栏
     */
    updateStatusBar(roomId, color, playerCount, status) {
        // 更新房间ID
        const roomIdEl = document.getElementById('roomId');
        if (roomIdEl) {
            roomIdEl.textContent = roomId.substring(0, 8);
        }
        // 更新颜色点
        const colorDot = document.getElementById('colorDot');
        if (colorDot) {
            colorDot.className = 'color-dot';
            switch (color) {
                case PlayerColor.RED:
                    colorDot.classList.add('color-red');
                    break;
                case PlayerColor.GREEN:
                    colorDot.classList.add('color-green');
                    break;
                case PlayerColor.BLUE:
                    colorDot.classList.add('color-blue');
                    break;
                case PlayerColor.YELLOW:
                    colorDot.classList.add('color-yellow');
                    break;
            }
        }
        // 更新玩家数量
        const playerCountEl = document.getElementById('playerCount');
        if (playerCountEl) {
            playerCountEl.textContent = `${playerCount}/${GAME_CONFIG.MAX_PLAYERS}`;
        }
        // 更新游戏状态
        const gameStatusEl = document.getElementById('gameStatus');
        if (gameStatusEl) {
            gameStatusEl.textContent = status;
        }
    }
}
// 页面加载完成后初始化游戏
window.addEventListener('DOMContentLoaded', async () => {
    const client = new GameClient();
    try {
        await client.init();
    }
    catch (error) {
        console.error('游戏初始化失败:', error);
    }
});
//# sourceMappingURL=index.js.map