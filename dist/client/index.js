/**
 * 客户端入口
 * 集成 WebSocket 客户端、输入处理器和画布渲染器
 * Requirements: 客户端集成
 *
 * 本次 UI 重构说明：
 * - 游戏逻辑、网络协议、输入合并与渲染数据流保持不变，仅重做界面编排层。
 * - 新增 DOM 驱动的操作按钮（准备/重新开始）、连接状态指示与断线提示层，
 *   使状态呈现集中在语义清晰的原生控件上，替代过去"点击画布任意处"的隐式交互。
 */
import { WebSocketClient } from './websocket-client.js';
import { InputHandler } from './input-handler.js';
import { TouchHandler } from './touch-handler.js';
import { InputMerger } from './input-merger.js';
import { CanvasRenderer } from './canvas-renderer.js';
import { ViewportManager } from './viewport-manager.js';
import { StatusBarRenderer } from './status-bar-renderer.js';
import { ServerMessageType } from '../shared/messages.js';
import { GameState, PlayerColor, ObstacleColor } from '../shared/types.js';
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
    isConnected = false;
    // DOM 编排元素
    canvas = null;
    statusBarEl = null;
    actionBtn = null;
    actionHint = null;
    connIndicator = null;
    connText = null;
    connOverlay = null;
    // 界面状态缓存
    lastActionSignature = null;
    connectionState = 'connecting';
    // 房间花名册（仅用于状态栏显示在线 / 已准备人数，不参与任何规则判定）
    onlinePlayerIds = new Set();
    readyPlayerIds = new Set();
    // 画面平滑推帧（仅视觉：以服务端广播为锚点做取景外推，不修改任何游戏数据）
    canvasAnimationId = null;
    /** 由相邻两次广播推算的世界速度（世界单位/秒） */
    worldSpeed = 0;
    /** 镜头当前世界位置（视觉插值结果，始终不超过服务端权威位置） */
    cameraWorldY = null;
    /** 上一帧时间戳（performance.now） */
    lastFrameTime = 0;
    /** 上一次广播的权威位置与时刻（用于估算世界速度） */
    prevServerWorldY = null;
    prevServerAt = 0;
    /** 本机是否已死亡（死亡后停止推帧） */
    isDeadLocally = false;
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
        this.canvas = canvas;
        this.statusBarEl = statusBar;
        // 界面元素（缺失时不致命，仅影响对应控件）
        this.actionBtn = document.getElementById('actionBtn');
        this.actionHint = document.getElementById('actionHint');
        this.connIndicator = document.getElementById('connIndicator');
        this.connText = document.getElementById('connText');
        this.connOverlay = document.getElementById('connOverlay');
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
        // 触控反馈挂载到画布之上的独立反馈层（该层不拦截指针事件）
        const feedbackLayer = document.getElementById('touchFeedbackLayer');
        this.touchHandler = new TouchHandler(canvas, this.inputMerger, feedbackLayer);
        // 键盘：空格 / 回车 等同于点击操作按钮
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'Enter' || e.key === 'Enter') {
                e.preventDefault();
                this.handleReadyAction();
            }
        });
        // 断开连接时的刷新按钮
        const reloadBtn = document.getElementById('reloadBtn');
        if (reloadBtn) {
            reloadBtn.addEventListener('click', () => window.location.reload());
        }
        // 操作按钮：准备 / 重开的主要入口
        if (this.actionBtn) {
            this.actionBtn.addEventListener('click', () => this.handleReadyAction());
        }
        // 触控设备上点击画布同样视为一次操作（保持原有触控体验）
        canvas.addEventListener('click', () => this.handleReadyAction());
        // 触屏点击画布：仅在非进行中状态下触发操作，避免与滑动操作冲突
        canvas.addEventListener('touchend', () => {
            if (!this.currentState)
                return;
            if (this.currentState.gameState === GameState.WAITING ||
                this.currentState.gameState === GameState.GAME_OVER) {
                this.handleReadyAction();
            }
        });
        // 切换后台时，冻结状态栏时间动画（避免累积误差与无意义绘制）
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.statusBarRenderer?.stopAnimation();
            }
            else if (this.currentState?.gameState === GameState.PLAYING) {
                this.statusBarRenderer?.startAnimation();
            }
        });
        // 显示初始界面
        this.renderInitialScreen();
        this.setConnectionState('connecting', '连接中…');
        // 调试辅助：?debug=layout 输出关键布局尺寸（供无头浏览器核验自适应）
        this.setupLayoutProbe(canvas, statusBar, gameWrapper);
        // 调试辅助：?debug=state&scene=<名称> 用真实渲染器渲染单个游戏状态（用于离线核验视觉样张）
        const debugMode = new URLSearchParams(window.location.search).get('debug');
        if (debugMode === 'state') {
            const scene = new URLSearchParams(window.location.search).get('scene') || 'playing';
            this.renderScene(scene);
        }
        // 调试辅助：?debug=hud&phase=<idle|playing|finished> 用真实渲染器输出指定阶段的状态栏样张
        if (debugMode === 'hud') {
            const phase = new URLSearchParams(window.location.search).get('phase') || 'playing';
            this.renderHudPhase(phase);
            return;
        }
        // 调试辅助：?debug=perf[&frames=N] 用真实渲染器连续绘制并统计每帧耗时
        if (debugMode === 'perf') {
            const frames = Number(new URLSearchParams(window.location.search).get('frames') || 120);
            this.runFrameProfile(Number.isFinite(frames) && frames > 0 ? frames : 120);
            return;
        }
        // 连接服务器
        await this.connect();
    }
    /**
     * 帧耗时测量（仅调试用）
     * 用真实 CanvasRenderer 连续绘制一局中的画面（含取景外推），
     * 统计每帧耗时的均值 / 中位数 / p95 / 最大值，用于核验是否稳定跑满刷新率。
     */
    runFrameProfile(frameCount = 240) {
        const cell = GAME_CONFIG.CELL_SIZE;
        const routeX = (route) => route * cell;
        const state = {
            gameState: GameState.PLAYING,
            scrollSpeed: 100,
            players: [
                { id: 'me', color: PlayerColor.BLUE, position: { x: routeX(1), y: 120 }, isAlive: true, distance: 128 },
                { id: 'p2', color: PlayerColor.RED, position: { x: routeX(2), y: 120 }, isAlive: true, distance: 96 }
            ],
            obstacles: []
        };
        // 生成一批障碍物，覆盖满屏
        for (let i = 0; i < 24; i++) {
            state.obstacles.push({
                id: `o${i}`,
                color: i % 2 === 0 ? ObstacleColor.RED : ObstacleColor.GREEN,
                position: { x: routeX(i % 3), y: 200 + i * 60 },
                width: cell,
                height: cell
            });
        }
        const renderer = new CanvasRenderer();
        const surface = this.canvas;
        renderer.init(surface);
        renderer.setMyPlayer('me', PlayerColor.BLUE);
        // 世界速度与运行时一致（服务端 WORLD_SPEED = 3 行/秒）
        const worldSpeed = 3;
        const frameMs = 1000 / 60;
        const samples = [];
        let cameraY = 120;
        // 同步连续绘制：测量单帧绘制成本（不依赖 rAF，便于无头环境核验）
        for (let frame = 0; frame < frameCount; frame++) {
            const started = performance.now();
            cameraY += worldSpeed * (frameMs / 1000);
            const me = state.players[0];
            me.position.y = cameraY;
            me.distance = Math.floor(cameraY - 120);
            renderer.render(state, cameraY);
            samples.push(performance.now() - started);
        }
        samples.sort((a, b) => a - b);
        const pick = (q) => samples[Math.min(samples.length - 1, Math.floor(samples.length * q))];
        const avg = samples.reduce((sum, v) => sum + v, 0) / samples.length;
        const report = {
            frames: samples.length,
            obstacles: state.obstacles.length,
            avgMs: Number(avg.toFixed(3)),
            medianMs: Number(pick(0.5).toFixed(3)),
            p95Ms: Number(pick(0.95).toFixed(3)),
            maxMs: Number(samples[samples.length - 1].toFixed(3)),
            budgetMs: Number(frameMs.toFixed(2)),
            headroomFps: Number((1000 / Math.max(0.001, avg)).toFixed(1))
        };
        const out = document.createElement('div');
        out.id = 'perfProbe';
        out.style.display = 'none';
        out.textContent = JSON.stringify(report);
        document.body.appendChild(out);
        console.log('[perf]', JSON.stringify(report));
    }
    /**
     * 状态栏阶段样张（仅调试用）
     * 用真实 StatusBarRenderer 渲染指定阶段的状态栏，便于离线核验信息层级与自适应表现。
     */
    renderHudPhase(phase) {
        const cell = GAME_CONFIG.CELL_SIZE;
        const states = {
            idle: {
                gameState: GameState.WAITING,
                scrollSpeed: 0,
                players: [
                    { id: 'me', color: PlayerColor.BLUE, position: { x: cell, y: 100 }, isAlive: true }
                ],
                obstacles: []
            },
            playing: {
                gameState: GameState.PLAYING,
                scrollSpeed: 100,
                players: [
                    { id: 'me', color: PlayerColor.BLUE, position: { x: cell, y: 100 }, isAlive: true, distance: 216 },
                    { id: 'p2', color: PlayerColor.RED, position: { x: cell * 2, y: 100 }, isAlive: true, distance: 144 },
                    { id: 'p3', color: PlayerColor.GREEN, position: { x: 0, y: 100 }, isAlive: false, distance: 72 }
                ],
                obstacles: [
                    { id: 'o1', color: ObstacleColor.RED, position: { x: 0, y: 300 }, width: cell, height: cell },
                    { id: 'o2', color: ObstacleColor.GREEN, position: { x: cell * 2, y: 380 }, width: cell, height: cell }
                ]
            },
            finished: {
                gameState: GameState.GAME_OVER,
                scrollSpeed: 0,
                players: [
                    { id: 'me', color: PlayerColor.BLUE, position: { x: cell, y: 100 }, isAlive: false, distance: 318 }
                ],
                obstacles: []
            }
        };
        const state = states[phase] || states.playing;
        // 隐藏实时界面，仅保留状态栏样张
        const wrapper = document.querySelector('.game-wrapper');
        if (wrapper) {
            wrapper.style.display = 'none';
        }
        const mount = document.createElement('div');
        mount.id = 'statusBar';
        mount.dataset.hudPhase = phase;
        mount.style.cssText = [
            'position:fixed',
            'left:0',
            'right:0',
            'top:0',
            'margin:24px auto',
            'max-width:1280px',
            'width:calc(100% - 48px)',
            'display:flex',
            'flex-wrap:wrap',
            'align-items:center',
            'gap:8px 16px',
            'padding:7px 14px',
            'border:1px solid rgba(255,255,255,.09)',
            'border-radius:12px',
            'background:rgba(255,255,255,.04)',
            'font-family:system-ui,sans-serif',
            'color:#eef1f7',
            'font-size:13px'
        ].join(';');
        document.body.appendChild(mount);
        const bar = new StatusBarRenderer(mount);
        bar.updateRoster(['me', 'p2', 'p3'], phase === 'idle' ? ['me'] : ['me', 'p2', 'p3']);
        bar.render(state, 'me', 'mv0pb4ai-vdzo48', PlayerColor.BLUE);
        bar.startAnimation();
    }
    /**
     * 连接到服务器
     */
    async connect() {
        try {
            this.setConnectionState('connecting', '连接中…');
            this.wsClient.onConnect(() => {
                this.isConnected = true;
                this.setConnectionState('online', '已连接');
                // 自动加入房间
                this.wsClient.joinRoom();
            });
            this.wsClient.onDisconnect(() => {
                this.isConnected = false;
                this.setConnectionState('offline', '连接断开');
                this.showDisconnectOverlay('与服务器的连接已断开，请刷新页面重新进入。');
                // Requirements: 6.1 - 断开连接时解绑所有输入处理器
                this.inputHandler.unbind();
                this.touchHandler.unbind();
                // 停止状态栏与画布动画
                if (this.statusBarRenderer) {
                    this.statusBarRenderer.stopAnimation();
                }
                this.stopCanvasAnimation();
                this.refreshActionButton();
            });
            this.wsClient.onError(() => {
                this.setConnectionState('offline', '连接错误');
                this.showDisconnectOverlay('无法连接到服务器，请确认服务已启动后刷新页面。');
            });
            await this.wsClient.connect();
        }
        catch (error) {
            this.setConnectionState('offline', '无法连接');
            this.showDisconnectOverlay('无法连接到服务器，请确认服务已启动后刷新页面。');
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
                case ServerMessageType.PLAYER_JOINED:
                    this.handlePlayerJoined(message);
                    break;
                case ServerMessageType.PLAYER_LEFT:
                    this.handlePlayerLeft(message);
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
        this.isReady = false;
        // 初始化花名册：服务端在 ROOM_JOINED 中下发房间内已有玩家
        this.onlinePlayerIds = new Set((message.players ?? []).map(p => p.id));
        this.onlinePlayerIds.add(message.playerId);
        this.readyPlayerIds = new Set();
        // 重置画面推帧状态（新一局从服务端锚点重新开始）
        this.stopCanvasAnimation();
        this.cameraWorldY = null;
        this.worldSpeed = 0;
        this.prevServerWorldY = null;
        this.isDeadLocally = false;
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
            this.statusBarRenderer.updateRoster(this.onlinePlayerIds, this.readyPlayerIds);
            this.statusBarRenderer.render(this.currentState, this.myPlayerId, message.roomId, message.playerColor);
        }
        this.refreshActionButton();
        // 调试辅助：?autoplay=1 时自动准备（需服务端房间人数达标），用于无头验证进行中界面
        if (new URLSearchParams(window.location.search).get('autoplay') === '1') {
            window.setTimeout(() => {
                if (this.currentState?.gameState === GameState.WAITING) {
                    this.handleReadyAction();
                }
            }, 300);
        }
    }
    /**
     * 处理其他玩家加入（用于状态栏在线人数）
     */
    handlePlayerJoined(message) {
        if (!message.player?.id)
            return;
        this.onlinePlayerIds.add(message.player.id);
        if (this.statusBarRenderer) {
            this.statusBarRenderer.updateRoster(this.onlinePlayerIds, this.readyPlayerIds);
            if (this.currentState && this.myPlayerId) {
                this.statusBarRenderer.render(this.currentState, this.myPlayerId, this.roomId || undefined, this.myPlayerColor || undefined);
            }
        }
        this.refreshActionButton();
    }
    /**
     * 处理其他玩家离开（用于状态栏在线人数）
     */
    handlePlayerLeft(message) {
        if (!message.playerId)
            return;
        this.onlinePlayerIds.delete(message.playerId);
        this.readyPlayerIds.delete(message.playerId);
        if (this.statusBarRenderer) {
            this.statusBarRenderer.updateRoster(this.onlinePlayerIds, this.readyPlayerIds);
            if (this.currentState && this.myPlayerId) {
                this.statusBarRenderer.render(this.currentState, this.myPlayerId, this.roomId || undefined, this.myPlayerColor || undefined);
            }
        }
        this.refreshActionButton();
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
        // 用相邻两次广播的位置差估算世界速度，供广播之间平滑推帧
        const me = message.state.players.find(p => p.id === this.myPlayerId);
        const now = performance.now();
        if (me) {
            if (this.prevServerWorldY !== null) {
                const elapsed = (now - this.prevServerAt) / 1000;
                const moved = me.position.y - this.prevServerWorldY;
                if (elapsed > 0.001 && moved >= 0) {
                    this.worldSpeed = moved / elapsed;
                }
            }
            this.prevServerWorldY = me.position.y;
            this.prevServerAt = now;
            if (this.cameraWorldY === null) {
                this.cameraWorldY = me.position.y;
            }
            if (!me.isAlive) {
                this.isDeadLocally = true;
            }
        }
        // Requirements: 3.1 - 使用新的状态栏渲染器更新游戏信息
        if (this.statusBarRenderer && this.myPlayerId) {
            this.statusBarRenderer.render(message.state, this.myPlayerId, this.roomId || undefined, this.myPlayerColor || undefined);
        }
        this.refreshActionButton();
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
            this.refreshActionButton();
        }
    }
    /**
     * 处理游戏开始
     */
    handleGameStart() {
        // Requirements: 1.5, 6.1, 6.2 - 绑定键盘和触控输入处理器
        this.inputHandler.bind();
        this.touchHandler.bind();
        this.isReady = false;
        this.isDeadLocally = false;
        this.cameraWorldY = null;
        this.worldSpeed = 0;
        this.prevServerWorldY = null;
        // Requirements: 3.5 - 启动状态栏动画（仅刷新时间数值）
        if (this.statusBarRenderer) {
            this.statusBarRenderer.startAnimation();
        }
        // 启动画面推帧：广播之间按显示刷新率补帧
        this.startCanvasAnimation();
        if (this.currentState && this.statusBarRenderer && this.myPlayerId) {
            this.statusBarRenderer.render(this.currentState, this.myPlayerId, this.roomId || undefined, this.myPlayerColor || undefined);
        }
        this.refreshActionButton();
    }
    /**
     * 处理游戏结束
     */
    handleGameOver(message) {
        // Requirements: 6.1 - 游戏结束时解绑所有输入处理器
        this.inputHandler.unbind();
        this.touchHandler.unbind();
        // 停止画面推帧，并以最终状态对齐渲染
        this.stopCanvasAnimation();
        this.isReady = false;
        this.currentState = message.finalState;
        this.renderer.render(message.finalState);
        // Requirements: 3.2, 3.3 - 显示游戏结束信息和最佳成绩对比
        if (this.statusBarRenderer && this.myPlayerId) {
            this.statusBarRenderer.render(message.finalState, this.myPlayerId, this.roomId || undefined, this.myPlayerColor || undefined);
            this.statusBarRenderer.stopAnimation();
        }
        this.refreshActionButton();
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
            this.refreshActionButton();
        }
    }
    /**
     * 处理错误消息
     */
    handleError(message) {
        console.error('服务器错误:', message);
        this.setConnectionState(this.connectionState, `错误: ${message.message}`);
    }
    /**
     * 处理准备操作（空格键、点击画布或点击操作按钮）
     */
    handleReadyAction() {
        if (!this.currentState || !this.isConnected)
            return;
        if (this.currentState.gameState === GameState.WAITING && !this.isReady) {
            this.wsClient.sendReady();
            this.isReady = true;
            // 记录本机准备状态，供状态栏统计已准备人数
            if (this.myPlayerId) {
                this.readyPlayerIds.add(this.myPlayerId);
            }
            // Requirements: 3.1 - 更新准备状态显示
            if (this.statusBarRenderer && this.myPlayerId) {
                this.statusBarRenderer.updateRoster(this.onlinePlayerIds, this.readyPlayerIds);
                this.statusBarRenderer.render(this.currentState, this.myPlayerId, this.roomId || undefined, this.myPlayerColor || undefined);
            }
            this.refreshActionButton();
        }
        else if (this.currentState.gameState === GameState.GAME_OVER) {
            // 重置渲染器状态
            this.renderer.resetAll();
            // 重新加入房间（花名册由新的 ROOM_JOINED 重建）
            this.resetRoster();
            this.wsClient.joinRoom();
            this.isReady = false;
            this.refreshActionButton();
        }
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
        this.currentState = defaultState;
        this.renderer.render(defaultState);
        this.refreshActionButton();
    }
    /**
     * 启动画面推帧：在两个状态广播之间按显示刷新率补帧
     * 只对"取景位置"做线性外推，不修改任何游戏数据，也不做任何碰撞或判定。
     */
    startCanvasAnimation() {
        this.lastFrameTime = 0;
        if (this.canvasAnimationId !== null)
            return;
        const frame = () => {
            this.renderInterpolatedFrame();
            this.canvasAnimationId = requestAnimationFrame(frame);
        };
        this.canvasAnimationId = requestAnimationFrame(frame);
    }
    /**
     * 停止画面推帧，并用服务端状态对齐渲染最后一帧
     */
    stopCanvasAnimation() {
        if (this.canvasAnimationId !== null) {
            cancelAnimationFrame(this.canvasAnimationId);
            this.canvasAnimationId = null;
        }
        this.lastFrameTime = 0;
        if (this.currentState) {
            this.renderer.render(this.currentState);
        }
    }
    /**
     * 渲染平滑帧
     *
     * 思路：以服务端广播的位置为权威锚点，按相邻两次广播推算出的世界速度，
     * 用真实帧间隔向前外推取景位置，因此画面以显示刷新率（通常 60Hz）推进，
     * 而不是等服务端 20Hz 的广播逐跳移动。外推位置永不超过服务端最新位置。
     */
    renderInterpolatedFrame() {
        const state = this.currentState;
        if (!state)
            return;
        if (state.gameState !== GameState.PLAYING)
            return;
        const me = state.players.find(p => p.id === this.myPlayerId);
        if (!me)
            return;
        const now = performance.now();
        const deltaSeconds = this.lastFrameTime > 0 ? (now - this.lastFrameTime) / 1000 : 0;
        this.lastFrameTime = now;
        // 死亡后不再推进，固定在自己死亡时的位置
        if (!me.isAlive || this.isDeadLocally) {
            this.isDeadLocally = true;
            this.cameraWorldY = me.position.y;
            this.renderer.render(state, me.position.y);
            return;
        }
        // 以服务端锚点校准：每收到一次广播就把镜头拉回权威位置
        if (this.cameraWorldY === null) {
            this.cameraWorldY = me.position.y;
        }
        // 每帧最多推进一个"广播周期应有的位移"，避免切后台回来后的跳变
        const maxStep = this.worldSpeed * Math.min(deltaSeconds, 0.25);
        const next = Math.min(this.cameraWorldY + maxStep, me.position.y);
        this.cameraWorldY = next;
        this.renderer.render(state, next);
    }
    /**
     * 重新加入房间时清空花名册
     */
    resetRoster() {
        this.onlinePlayerIds = new Set();
        this.readyPlayerIds = new Set();
        if (this.statusBarRenderer) {
            this.statusBarRenderer.updateRoster(this.onlinePlayerIds, this.readyPlayerIds);
        }
    }
    /**
     * 更新连接状态指示
     */
    setConnectionState(state, text) {
        this.connectionState = state;
        if (this.connIndicator && this.connIndicator.dataset.state !== state) {
            this.connIndicator.dataset.state = state;
        }
        if (this.connText && this.connText.textContent !== text) {
            this.connText.textContent = text;
        }
    }
    /**
     * 显示断线提示层
     */
    showDisconnectOverlay(text) {
        const textEl = document.getElementById('connOverlayText');
        if (textEl) {
            textEl.textContent = text;
        }
        if (this.connOverlay) {
            this.connOverlay.dataset.visible = 'true';
        }
    }
    /**
     * 隐藏断线提示层
     */
    hideDisconnectOverlay() {
        if (this.connOverlay) {
            this.connOverlay.dataset.visible = 'false';
        }
    }
    /**
     * 刷新底部操作按钮与提示文案
     * 以「状态签名」做脏检查，避免每帧写 DOM
     */
    refreshActionButton() {
        if (!this.actionBtn)
            return;
        // 大厅阶段以房间在线人数为准（服务端在等待阶段不下发玩家列表），
        // 对局开始后状态里的玩家数即为实际游玩人数。
        const rosterCount = this.onlinePlayerIds.size;
        const playerCount = this.currentState?.players.length || rosterCount || 0;
        const gameState = this.currentState?.gameState ?? GameState.WAITING;
        let label = '连接中…';
        let disabled = true;
        let variant = 'default';
        let hint = '';
        if (this.connectionState === 'offline') {
            label = '连接已断开';
            disabled = true;
            hint = '刷新页面后重试';
        }
        else if (!this.isConnected) {
            label = '连接中…';
            disabled = true;
        }
        else {
            switch (gameState) {
                case GameState.WAITING: {
                    const enoughPlayers = playerCount >= GAME_CONFIG.MIN_PLAYERS;
                    if (this.isReady) {
                        label = '已准备 · 等待队友';
                        disabled = true;
                    }
                    else if (enoughPlayers) {
                        label = '准备开始';
                        disabled = false;
                        variant = 'primary';
                    }
                    else {
                        label = `等待玩家 ${playerCount}/${GAME_CONFIG.MAX_PLAYERS}`;
                        disabled = true;
                    }
                    hint = '按 <kbd>空格</kbd> 也可以准备';
                    break;
                }
                case GameState.COUNTDOWN:
                    label = `倒计时 ${this.currentState?.countdown ?? GAME_CONFIG.COUNTDOWN_SECONDS}`;
                    disabled = true;
                    hint = '即将开始';
                    break;
                case GameState.PLAYING: {
                    const me = this.currentState?.players.find(p => p.id === this.myPlayerId);
                    if (me && !me.isAlive) {
                        label = '已死亡 · 观战中';
                    }
                    else {
                        label = '游戏进行中';
                    }
                    disabled = true;
                    hint = '按 <kbd>←</kbd> <kbd>→</kbd> 或 <kbd>A</kbd> <kbd>D</kbd> 切换路线';
                    break;
                }
                case GameState.GAME_OVER:
                    label = '重新开始';
                    disabled = false;
                    variant = 'accent';
                    hint = '按 <kbd>空格</kbd> 也可以重新开始';
                    break;
            }
        }
        const signature = { label, disabled, variant, hint };
        if (this.lastActionSignature &&
            this.lastActionSignature.label === signature.label &&
            this.lastActionSignature.disabled === signature.disabled &&
            this.lastActionSignature.variant === signature.variant &&
            this.lastActionSignature.hint === signature.hint) {
            return;
        }
        this.lastActionSignature = signature;
        if (this.actionBtn.textContent !== label) {
            this.actionBtn.textContent = label;
        }
        this.actionBtn.disabled = disabled;
        this.actionBtn.dataset.variant = variant;
        if (this.actionHint && this.actionHint.innerHTML !== hint) {
            this.actionHint.innerHTML = hint;
        }
        // 连接正常时收起断线提示层
        if (this.isConnected) {
            this.hideDisconnectOverlay();
        }
    }
    /**
     * 场景样张（仅调试用）
     * ?debug=state&scene=<名称> 时用真实 CanvasRenderer 渲染单个游戏状态并铺满视口，
     * 用于离线核验视觉层；不连接服务器、不改动任何游戏逻辑。
     */
    renderScene(name) {
        const cell = GAME_CONFIG.CELL_SIZE;
        const routeX = (route) => route * cell;
        // 典型对局状态：自己为蓝色且位于中间车道，前方有三色障碍物
        const playing = {
            gameState: GameState.PLAYING,
            scrollSpeed: 100,
            players: [
                { id: 'me', color: PlayerColor.BLUE, position: { x: routeX(1), y: 120 }, isAlive: true, distance: 128 },
                { id: 'p2', color: PlayerColor.RED, position: { x: routeX(2), y: 120 }, isAlive: true, distance: 96 },
                { id: 'p3', color: PlayerColor.GREEN, position: { x: routeX(0), y: 120 }, isAlive: false, distance: 64 }
            ],
            obstacles: [
                { id: 'o1', color: ObstacleColor.RED, position: { x: routeX(0), y: 300 }, width: cell, height: cell },
                { id: 'o2', color: ObstacleColor.GREEN, position: { x: routeX(2), y: 360 }, width: cell, height: cell },
                { id: 'o3', color: ObstacleColor.YELLOW, position: { x: routeX(1), y: 480 }, width: cell, height: cell }
            ]
        };
        const deadState = {
            ...playing,
            players: playing.players.map(p => (p.id === 'me' ? { ...p, isAlive: false } : p))
        };
        // 带换道历史的对局：用于核验路径线（玩家表现为一条按自身颜色着色的线）
        const walkLeft = {
            ...playing,
            players: playing.players.map(p => (p.id === 'me' ? { ...p, position: { x: routeX(0), y: 0 } } : p))
        };
        const walkRight = {
            ...playing,
            players: playing.players.map(p => (p.id === 'me' ? { ...p, position: { x: routeX(1), y: 60 } } : p))
        };
        const dangerState = { ...playing, proximityHints: [{ route: 1, intensity: 0.8 }] };
        const countdownState = { ...playing, gameState: GameState.COUNTDOWN, countdown: 3 };
        const waitingState = { gameState: GameState.WAITING, scrollSpeed: 0, players: [], obstacles: [] };
        const overState = { ...playing, gameState: GameState.GAME_OVER };
        const scenes = {
            waiting: { feed: [waitingState], state: waitingState },
            countdown: { feed: [playing, countdownState], state: countdownState },
            playing: { feed: [playing, playing], state: playing },
            path: { feed: [playing, walkLeft, walkRight], state: walkRight },
            danger: { feed: [playing, dangerState], state: dangerState },
            dead: { feed: [playing, deadState], state: deadState },
            gameover: { feed: [playing, overState], state: overState }
        };
        const scene = scenes[name] || scenes.playing;
        // 独立离屏画布渲染后以图片形式呈现：便于离线/无头环境核验视觉样张
        const wrapper = document.querySelector('.game-wrapper');
        if (wrapper) {
            wrapper.style.display = 'none';
        }
        const surface = document.createElement('canvas');
        surface.width = GAME_CONFIG.GAME_WIDTH;
        surface.height = GAME_CONFIG.GAME_HEIGHT;
        const renderer = new CanvasRenderer();
        renderer.init(surface);
        renderer.setMyPlayer('me', PlayerColor.BLUE);
        for (const step of scene.feed) {
            renderer.render(step);
        }
        renderer.render(scene.state);
        const preview = document.createElement('img');
        preview.id = 'scenePreview';
        preview.alt = `场景样张：${name}`;
        preview.src = surface.toDataURL('image/png');
        preview.style.cssText =
            'position:fixed;left:0;top:0;z-index:99;width:100vw;height:100vh;object-fit:contain;background:#0a0d13;';
        document.body.appendChild(preview);
    }
    /**
     * 布局探针（仅调试用）
     * 通过 URL 参数 ?debug=layout 启用，把关键元素尺寸写入 DOM，供无头浏览器 --dump-dom 读取。
     * 不参与任何游戏逻辑，也不影响正常访问。
     */
    setupLayoutProbe(canvas, statusBar, gameWrapper) {
        if (new URLSearchParams(window.location.search).get('debug') !== 'layout') {
            return;
        }
        window.setTimeout(() => {
            const stage = document.querySelector('.game-stage');
            const footer = document.querySelector('.game-footer');
            const header = document.querySelector('.game-header');
            const canvasRect = canvas.getBoundingClientRect();
            const metrics = {
                viewport: `${window.innerWidth}x${window.innerHeight}`,
                canvas: `${Math.round(canvasRect.width)}x${Math.round(canvasRect.height)}`,
                canvasLeft: `${Math.round(canvasRect.left)}`,
                canvasStyle: `${canvas.style.width || '-'} / ${canvas.style.height || '-'}`,
                stage: stage ? `${Math.round(stage.clientWidth)}x${Math.round(stage.clientHeight)}` : '-',
                statusBar: `${Math.round(statusBar.clientWidth)}x${Math.round(statusBar.clientHeight)}`,
                header: `${header?.clientHeight ?? 0}`,
                footer: `${footer?.clientHeight ?? 0}`,
                innerCanvas: `${canvas.width}x${canvas.height}`,
                statusClasses: statusBar.className,
                wrapper: `${gameWrapper.clientWidth}x${gameWrapper.clientHeight}`,
                overflow: document.body.scrollHeight > window.innerHeight ? 'YES' : 'no',
                statusText: statusBar.textContent?.replace(/\s+/g, ' ').trim(),
                buttonText: document.getElementById('actionBtn')?.textContent
            };
            const probe = document.createElement('div');
            probe.id = 'layoutProbe';
            probe.style.display = 'none';
            probe.textContent = JSON.stringify(metrics, null, 2);
            document.body.appendChild(probe);
        }, 1200);
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