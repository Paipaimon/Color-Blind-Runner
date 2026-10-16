/**
 * 画布渲染器 - 网格布局版本
 * 玩家固定在底部，视角向上移动，障碍物相对向下滚动
 *
 * 本次 UI 重构说明：
 * - 渲染几何、坐标换算、状态缓存与数据来源（服务端投影后的可见状态）完全保持不变。
 * - 仅重做视觉层：统一主题色、渐变背景、车道框架、发光轨迹、圆角障碍物与排版。
 */
import { GameState, PlayerColor, ObstacleColor } from '../shared/types.js';
import { GAME_CONFIG, computeLayoutParams } from '../shared/constants.js';
/** 玩家颜色映射 */
const PLAYER_COLOR_MAP = {
    [PlayerColor.RED]: '#ff4d6d',
    [PlayerColor.GREEN]: '#35d07f',
    [PlayerColor.BLUE]: '#4d9dff',
    [PlayerColor.YELLOW]: '#ffd23f'
};
/** 障碍物颜色映射 */
const OBSTACLE_COLOR_MAP = {
    [ObstacleColor.RED]: '#ff4d6d',
    [ObstacleColor.GREEN]: '#35d07f',
    [ObstacleColor.BLUE]: '#4d9dff',
    [ObstacleColor.YELLOW]: '#ffd23f',
    [ObstacleColor.CYAN]: '#22d3ee',
    [ObstacleColor.MAGENTA]: '#e879f9',
    [ObstacleColor.WHITE]: '#f4f6fb'
};
/** 主题常量（集中管理，便于统一调整视觉风格） */
const THEME = {
    bgTop: '#1b2230',
    bgBottom: '#0d1119',
    gutter: '#0a0d13',
    laneAlt: 'rgba(255, 255, 255, 0.035)',
    gridLine: 'rgba(150, 175, 220, 0.1)',
    laneSeparator: 'rgba(150, 175, 220, 0.12)',
    frame: 'rgba(150, 175, 220, 0.42)',
    dangerFrame: 'rgba(255, 82, 82, 0.9)',
    textPrimary: '#eef1f7',
    textDim: '#9aa3b5',
    fontFamily: "system-ui, -apple-system, 'Segoe UI', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    fontMono: "ui-monospace, 'SF Mono', 'JetBrains Mono', Consolas, monospace",
    obstacleInset: 6,
    obstacleRadius: 10
};
export class CanvasRenderer {
    canvas = null;
    ctx = null;
    width = GAME_CONFIG.GAME_WIDTH;
    height = GAME_CONFIG.GAME_HEIGHT;
    cellSize = GAME_CONFIG.CELL_SIZE;
    offsetX = GAME_CONFIG.GAME_AREA_OFFSET; // 游戏区域左侧偏移
    scale = 1; // 视觉缩放因子（移动端竖屏放大车道）
    layoutParams;
    layoutMode = 'desktop';
    myPlayerId = null;
    myPlayerColor = null;
    // 路径点列表
    pathPoints = [];
    currentCol = 1;
    // 障碍物缓存（避免闪烁）
    obstacleCache = new Map();
    // 游戏数据
    distance = 0;
    startWorldY = 0;
    gameStarted = false;
    // 玩家死亡状态
    isDead = false;
    deathDistance = 0; // 死亡时的距离
    // 游戏结束时的最终状态
    finalState = null;
    // 危险状态（靠近障碍物）
    isDanger = false;
    dangerIntensity = 0;
    // 当前世界滚动位置（网格换算与障碍物使用同一坐标系）
    scrollWorldY = 0;
    // 背景渐变缓存（尺寸不变时复用，避免每帧重建 CanvasGradient）
    cachedBackground = null;
    cachedVeil = null;
    // 已渲染帧数（仅用于调试观测渲染节奏）
    frameCount = 0;
    // 是否已就「找不到本机玩家」告警过（避免每帧刷日志）
    warnedMissingPlayer = false;
    // 上一帧服务端下发的取景位置（本机玩家缺失时作为回退基准）
    prevServerWorldY = 0;
    constructor() {
        this.layoutParams = computeLayoutParams(GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT);
    }
    init(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        if (!this.ctx)
            throw new Error('无法获取 Canvas 2D 上下文');
        this.applyLayoutFromCanvas();
        canvas.width = this.width;
        canvas.height = this.height;
        this.resetAll();
    }
    /**
     * 从画布元素的 data-* 属性读取显示尺寸，重算内部布局与分辨率。
     * 若尺寸/模式变化则返回 true，调用方需清空渐变缓存并同步 canvas.width/height。
     */
    applyLayoutFromCanvas() {
        if (!this.canvas)
            return false;
        const dw = Number(this.canvas.dataset.displayWidth) || this.canvas.clientWidth || GAME_CONFIG.GAME_WIDTH;
        const dh = Number(this.canvas.dataset.displayHeight) || this.canvas.clientHeight || GAME_CONFIG.GAME_HEIGHT;
        const next = computeLayoutParams(dw, dh);
        const changed = next.mode !== this.layoutMode ||
            next.gameWidth !== this.width ||
            next.gameHeight !== this.height ||
            next.cellSize !== this.cellSize ||
            next.offsetX !== this.offsetX ||
            next.scale !== this.scale;
        if (!changed)
            return false;
        this.layoutParams = next;
        this.layoutMode = next.mode;
        this.width = next.gameWidth;
        this.height = next.gameHeight;
        this.cellSize = next.cellSize;
        this.offsetX = next.offsetX;
        this.scale = next.scale;
        this.cachedBackground = null;
        this.cachedVeil = null;
        if (this.canvas && (this.canvas.width !== this.width || this.canvas.height !== this.height)) {
            // 重要：改写 canvas.width/height 会把画布清成透明黑。
            // 已缓存的渐变是按旧上下文尺寸创建的，必须一并失效，否则首帧会有一部分
            // 没被背景覆盖，看起来就是「顶部（或某处）一块黑」。
            this.canvas.width = this.width;
            this.canvas.height = this.height;
            this.cachedBackground = null;
            this.cachedVeil = null;
        }
        if (this.canvas) {
            // 调试标记：本次采用的布局参数（便于真机核对赛道是否铺满）
            this.canvas.dataset.scale = String(Number(this.scale.toFixed(4)));
            this.canvas.dataset.offsetX = String(Number(this.offsetX.toFixed(2)));
            this.canvas.dataset.internalSize = `${this.width}x${this.height}`;
        }
        return true;
    }
    setMyPlayer(playerId, color) {
        this.myPlayerId = playerId;
        this.myPlayerColor = color;
    }
    resetAll() {
        this.pathPoints = [];
        this.currentCol = 1;
        this.obstacleCache.clear();
        this.distance = 0;
        this.startWorldY = 0;
        this.gameStarted = false;
        this.finalState = null;
        this.isDead = false;
        this.deathDistance = 0;
        this.isDanger = false;
        this.dangerIntensity = 0;
    }
    /**
     * 渲染一帧
     *
     * @param state 服务端投影后的可见状态（唯一数据来源，不做任何修改）
     * @param worldYOverride 可选的世界位置覆盖值：仅用于在两帧广播之间做视觉插值，
     *        使画面以显示器刷新率（60Hz+）平滑推进，而不必等待 20Hz 的状态广播。
     *        不传时按状态自身的坐标渲染（离散更新路径）。
     */
    render(state, worldYOverride) {
        if (!this.ctx)
            return;
        this.frameCount++;
        this.applyLayoutFromCanvas();
        // 调试：记录每帧的取景位置变化（仅当 __SYNC_TRACE__ 打开时）
        if (window.__SYNC_TRACE__) {
            const before = this.scrollWorldY;
            // eslint-disable-next-line no-console
            console.log(`[render] state=${state.gameState} override=${worldYOverride ?? 'none'} ` +
                `scrollBefore=${before.toFixed(3)} found=${state.players.some(p => p.id === this.myPlayerId)} ` +
                `myId=${this.myPlayerId}`);
        }
        // 背景用单位矩阵绘制（覆盖整个画布），赛道内容用缩放矩阵绘制
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.clear();
        if (this.canvas && this.canvas.dataset.gameState !== state.gameState) {
            this.canvas.dataset.gameState = state.gameState;
        }
        switch (state.gameState) {
            case GameState.WAITING:
                this.renderWaitingScreen(state);
                break;
            case GameState.COUNTDOWN:
                this.renderCountdown(state);
                break;
            case GameState.PLAYING:
                this.renderGame(state, worldYOverride);
                break;
            case GameState.GAME_OVER:
                this.renderGameOver();
                break;
        }
        // 恢复单位变换，避免影响外部读取
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    /**
     * 绘制舞台：背景、车道、网格与边框
     *
     * 背景用单位矩阵绘制（覆盖整个画布），
     * 赛道内容（车道、网格、边框）用缩放矩阵绘制，使移动端竖屏时赛道占满宽度。
     */
    clear() {
        if (!this.ctx)
            return;
        const gameAreaWidth = GAME_CONFIG.GRID_COLS * this.cellSize;
        const gameAreaHeight = GAME_CONFIG.GRID_ROWS * this.cellSize;
        const isMobilePortrait = this.layoutMode === 'mobile-portrait';
        // 游戏区域整体背景（渐变缓存复用）—— 用单位矩阵覆盖整个画布
        if (!this.cachedBackground) {
            const bg = this.ctx.createLinearGradient(0, 0, 0, this.height);
            bg.addColorStop(0, THEME.bgTop);
            bg.addColorStop(1, THEME.bgBottom);
            this.cachedBackground = bg;
        }
        this.ctx.fillStyle = this.cachedBackground;
        this.ctx.fillRect(0, 0, this.width, this.height);
        // 桌面/横屏保留左右暗角；移动端竖屏去掉暗角
        if (!isMobilePortrait) {
            this.ctx.fillStyle = THEME.gutter;
            this.ctx.fillRect(0, 0, this.offsetX, this.height);
            this.ctx.fillRect(this.offsetX + gameAreaWidth, 0, this.width - this.offsetX - gameAreaWidth, this.height);
        }
        // 设置缩放变换：移动端竖屏时放大并居中赛道
        if (isMobilePortrait) {
            this.ctx.setTransform(this.scale, 0, 0, this.scale, this.offsetX, 0);
        }
        else {
            this.ctx.setTransform(1, 0, 0, 1, this.offsetX, 0);
        }
        // 车道交替底色（逻辑坐标系，offsetX=0 因为已在变换中平移）
        this.ctx.fillStyle = THEME.laneAlt;
        this.ctx.fillRect(this.cellSize, 0, this.cellSize, this.height / this.scale);
        // 横向滚动网格（提供运动参照）
        this.renderScrollGrid();
        // 车道分隔线
        this.ctx.strokeStyle = THEME.laneSeparator;
        this.ctx.lineWidth = 1 / this.scale;
        this.ctx.beginPath();
        for (let col = 1; col < GAME_CONFIG.GRID_COLS; col++) {
            const x = Math.round(col * this.cellSize) + 0.5;
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height / this.scale);
        }
        this.ctx.stroke();
        // 危险光晕
        if (this.isDanger) {
            const tint = this.ctx.createLinearGradient(0, 0, 0, this.height / this.scale);
            const alpha = Math.min(1, 0.4 + this.dangerIntensity * 0.6);
            tint.addColorStop(0, `rgba(255, 60, 60, ${0.05 * alpha})`);
            tint.addColorStop(1, `rgba(255, 60, 60, ${0.16 * alpha})`);
            this.ctx.fillStyle = tint;
            this.ctx.fillRect(0, 0, gameAreaWidth, this.height / this.scale);
        }
        // 游戏区域边框
        this.renderBoundary(gameAreaHeight);
    }
    /**
     * 横向滚动网格线
     * 玩家在车道内横向移动时，格子整体跟着平移半格，使格子中心与玩家/障碍物中心对齐；
     * 纵向按世界坐标换算，因此与障碍物同速同向向下流动，每个障碍物都落在格子里。
     *
     * 注意：调用此方法时，ctx 变换矩阵已包含 offsetX 平移和 scale 缩放，
     * 因此此处坐标全部使用逻辑坐标系（offsetX=0，高度需除以 scale）。
     */
    renderScrollGrid() {
        if (!this.ctx)
            return;
        const logicalHeight = this.height / this.scale;
        const left = 0;
        const right = GAME_CONFIG.GRID_COLS * this.cellSize;
        const playerY = logicalHeight - this.cellSize;
        // 玩家列中心相对车道中心的偏移（半格），让格子随横向移动平移
        const laneCenterCol = (GAME_CONFIG.GRID_COLS - 1) / 2;
        const panX = (this.currentCol - laneCenterCol) * this.cellSize * 0.5;
        this.ctx.strokeStyle = THEME.gridLine;
        this.ctx.lineWidth = 1 / this.scale;
        this.ctx.beginPath();
        // 横线：屏幕 Y = playerY - (worldY - scrollWorldY) * cellSize
        // 取整数 worldY，使障碍物（同样位于整数世界行）正好落在格子中心
        const worldTop = this.scrollWorldY + (playerY - 0) / this.cellSize;
        const worldBottom = this.scrollWorldY + (playerY - logicalHeight) / this.cellSize;
        const firstLine = Math.ceil(worldBottom);
        const lastLine = Math.floor(worldTop);
        for (let worldLine = firstLine; worldLine <= lastLine; worldLine++) {
            const screenY = Math.round(playerY - (worldLine - this.scrollWorldY) * this.cellSize) + 0.5;
            if (screenY < 0 || screenY > logicalHeight)
                continue;
            this.ctx.moveTo(left, screenY);
            this.ctx.lineTo(right, screenY);
        }
        // 竖线：随横向平移，保持格子为正方形
        for (let x = left + panX; x <= right; x += this.cellSize) {
            const px = Math.round(x) + 0.5;
            if (px < left || px > right)
                continue;
            this.ctx.moveTo(px, 0);
            this.ctx.lineTo(px, logicalHeight);
        }
        this.ctx.stroke();
    }
    /**
     * 渲染游戏区域边框
     * 靠近障碍物时边框转为警示色
     *
     * 注意：调用此方法时，ctx 变换矩阵已包含 offsetX 平移和 scale 缩放，
     * 因此此处坐标全部使用逻辑坐标系。
     * 移动端竖屏：边框贴赛道左右边缘，不做圆角（视觉上赛道占满全宽）
     */
    renderBoundary(gameAreaHeight) {
        if (!this.ctx)
            return;
        const gameAreaWidth = GAME_CONFIG.GRID_COLS * this.cellSize;
        const logicalHeight = this.height / this.scale;
        const isMobilePortrait = this.layoutMode === 'mobile-portrait';
        const x = 0;
        const drawWidth = gameAreaWidth;
        const radius = isMobilePortrait ? 0 : 14;
        const y = (logicalHeight - gameAreaHeight) / 2;
        if (this.isDanger) {
            this.ctx.save();
            this.ctx.shadowColor = THEME.dangerFrame;
            this.ctx.shadowBlur = (18 + this.dangerIntensity * 22) / this.scale;
            this.ctx.strokeStyle = THEME.dangerFrame;
            this.ctx.lineWidth = (2 + this.dangerIntensity * 2) / this.scale;
        }
        else {
            this.ctx.save();
            this.ctx.strokeStyle = THEME.frame;
            this.ctx.lineWidth = 1.5 / this.scale;
        }
        this.ctx.beginPath();
        if (radius > 0) {
            this.ctx.roundRect(x + 0.5, y + 0.5, drawWidth - 1, gameAreaHeight - 1, radius);
        }
        else {
            this.ctx.rect(x + 0.5, y + 0.5, drawWidth - 1, gameAreaHeight - 1);
        }
        this.ctx.stroke();
        this.ctx.restore();
    }
    /**
     * 渲染进行中的画面
     *
     * @param state 服务端状态
     * @param worldYOverride 可选的世界位置插值结果（仅影响取景与绘制位置，不修改任何游戏数据）
     */
    renderGame(state, worldYOverride) {
        const myPlayer = state.players.find(p => p.id === this.myPlayerId);
        // 取景位置：优先用插值结果，其次本机玩家坐标。
        // 注意：这里不能因为「找不到本机玩家」就直接 return——那会让网格取景停在旧值，
        // 而障碍物仍按新坐标绘制，表现为「方块与格子不同步」。因此改为回退到可用坐标继续渲染。
        const cameraFromState = myPlayer ? myPlayer.position.y : this.scrollWorldY;
        const worldY = worldYOverride ?? cameraFromState;
        if (!myPlayer) {
            // 理论上不会发生（服务端始终下发本机玩家）；仅记录一次以便真机排查
            if (!this.warnedMissingPlayer) {
                this.warnedMissingPlayer = true;
                console.warn('[CanvasRenderer] 本机玩家不在状态中，已回退渲染取景', {
                    myPlayerId: this.myPlayerId,
                    playerIds: state.players.map(p => p.id)
                });
            }
        }
        else {
            this.warnedMissingPlayer = false;
        }
        const newCol = myPlayer
            ? Math.floor(myPlayer.position.x / this.cellSize)
            : this.currentCol;
        // 初始化起始位置
        if (!this.gameStarted) {
            this.startWorldY = worldY;
            this.gameStarted = true;
        }
        // 记录当前世界位置（网格换算与障碍物使用同一坐标系）
        this.scrollWorldY = worldY;
        this.prevServerWorldY = cameraFromState;
        // 检测玩家死亡
        if (myPlayer && !myPlayer.isAlive && !this.isDead) {
            this.isDead = true;
            // 使用服务器发送的距离，如果没有则使用本地计算的距离
            this.deathDistance = myPlayer.distance ?? Math.floor(worldY - this.startWorldY);
        }
        // 距离：始终按当前取景位置计算，保证读数与画面同步推进；
        // 服务端在广播中给出权威 distance 时以其为基准把误差归零（不产生回退）。
        if (this.isDead) {
            this.distance = this.deathDistance;
        }
        else if (myPlayer && myPlayer.distance !== undefined) {
            const cameraDistance = Math.round(worldY - this.startWorldY);
            this.distance = Math.max(this.distance, Math.min(myPlayer.distance, cameraDistance));
        }
        else {
            this.distance = Math.round(worldY - this.startWorldY);
        }
        // 更新障碍物缓存：用「本机玩家的服务端坐标」建立缓存（世界坐标必须来自服务端）。
        // 本机玩家缺失时退回上一帧取景位置，保证缓存仍在同一坐标系下推进。
        this.updateObstacleCache(state.obstacles, myPlayer ? myPlayer.position.y : this.prevServerWorldY);
        // 检测是否靠近自己颜色的障碍物（使用服务器发送的proximityHints）
        this.checkDanger(state.proximityHints);
        // 先渲染路径（在障碍物下面）
        if (!this.isDead) {
            this.updatePath(newCol, worldY);
        }
        this.renderPath(worldY);
        // 再渲染障碍物（在路径上面）
        this.renderObstacles(worldY);
        // 渲染距离
        this.renderDistance();
        // 如果死亡，显示死亡提示
        if (this.isDead) {
            this.renderDeathOverlay();
        }
        // 保存当前状态用于游戏结束
        this.saveFinalState(worldY);
    }
    /**
     * 渲染死亡提示覆盖层
     *
     * 注意：此方法使用单位矩阵绘制全屏遮罩和文字。
     */
    renderDeathOverlay() {
        if (!this.ctx)
            return;
        // 用单位矩阵绘制全屏遮罩
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        // 半透明红色遮罩
        const veil = this.ctx.createLinearGradient(0, 0, 0, this.height);
        veil.addColorStop(0, 'rgba(120, 12, 24, 0.34)');
        veil.addColorStop(1, 'rgba(60, 6, 14, 0.5)');
        this.ctx.fillStyle = veil;
        this.ctx.fillRect(0, 0, this.width, this.height);
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        // 提示牌
        const cardW = 340;
        const cardH = 132;
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(12, 15, 21, 0.82)';
        this.ctx.strokeStyle = 'rgba(255, 82, 82, 0.45)';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.roundRect(centerX - cardW / 2, centerY - cardH / 2, cardW, cardH, 18);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
        this.ctx.fillStyle = '#ff6b6b';
        this.ctx.font = `650 22px ${THEME.fontFamily}`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('你已死亡', centerX, centerY - 32);
        this.ctx.fillStyle = THEME.textPrimary;
        this.ctx.font = `600 16px ${THEME.fontMono}`;
        this.ctx.fillText(`最终距离 ${this.deathDistance}m`, centerX, centerY + 4);
        this.ctx.fillStyle = THEME.textDim;
        this.ctx.font = `13px ${THEME.fontFamily}`;
        this.ctx.fillText('正在观战', centerX, centerY + 34);
    }
    /**
     * 保存最终状态
     */
    saveFinalState(worldY) {
        this.finalState = {
            distance: this.distance,
            pathPoints: [...this.pathPoints],
            currentCol: this.currentCol,
            obstacles: Array.from(this.obstacleCache.values()),
            worldY: worldY
        };
    }
    /**
     * 更新障碍物缓存
     * 玩家在底部，障碍物从顶部出现
     */
    updateObstacleCache(obstacles, worldY) {
        // 添加新障碍物到缓存
        for (const obs of obstacles) {
            if (!this.obstacleCache.has(obs.id)) {
                // 从屏幕坐标反算世界坐标。
                //
                // 关键：服务端投影障碍物用的是固定基准 (GAME_HEIGHT - CELL_SIZE)，
                // 见 server/index.ts：
                //   screenY = GAME_HEIGHT - (obstacle.y - viewWorldPosition + 1) * CELL_SIZE
                // 因此这里必须用同一个基准做逆变换，否则两者相差
                // (this.height - GAME_HEIGHT) / cellSize 个网格单位。
                // 移动端竖屏内部高度是 1280（不是 720），若沿用 this.height，
                // 反算出的世界坐标会偏 8.3 格，导致障碍物提前 / 延迟出现与消失。
                const serverAnchorY = GAME_CONFIG.GAME_HEIGHT - this.cellSize;
                const obstacleWorldY = worldY + (serverAnchorY - obs.position.y) / this.cellSize;
                this.obstacleCache.set(obs.id, {
                    id: obs.id,
                    color: obs.color,
                    col: Math.floor(obs.position.x / this.cellSize),
                    worldY: obstacleWorldY
                });
            }
        }
        // 清理已经滚出屏幕的障碍物（向下滚出）
        for (const [id, obs] of this.obstacleCache) {
            if (obs.worldY < worldY - 2) {
                this.obstacleCache.delete(id);
            }
        }
    }
    /**
     * 检测是否靠近自己颜色的障碍物
     * 使用服务器发送的proximityHints来判断危险
     */
    checkDanger(proximityHints) {
        if (this.isDead) {
            this.isDanger = false;
            this.dangerIntensity = 0;
            return;
        }
        // 如果有近距离提示，且当前列有提示，则标记为危险
        if (proximityHints && proximityHints.length > 0) {
            // 检查当前列是否有近距离提示
            const currentHint = proximityHints.find(hint => hint.route === this.currentCol);
            this.isDanger = Boolean(currentHint);
            this.dangerIntensity = currentHint ? Math.max(0, Math.min(1, currentHint.intensity)) : 0;
        }
        else {
            this.isDanger = false;
            this.dangerIntensity = 0;
        }
    }
    /**
     * 更新路径
     * 不清除历史路径点，始终保留完整痕迹
     */
    updatePath(newCol, worldY) {
        if (newCol !== this.currentCol) {
            this.pathPoints.push({
                col: this.currentCol,
                worldY: worldY
            });
            this.currentCol = newCol;
        }
        // 不再清除历史路径点，始终保留完整痕迹
    }
    /**
     * 渲染路径线
     * 玩家在底部，痕迹向下延伸到屏幕外（表示走过的路径）
     */
    renderPath(worldY) {
        if (!this.ctx)
            return;
        if (!this.gameStarted)
            return;
        const lineColor = this.myPlayerColor ? PLAYER_COLOR_MAP[this.myPlayerColor] : '#c9d2e3';
        const logicalHeight = this.height / this.scale;
        this.ctx.save();
        this.ctx.strokeStyle = lineColor;
        this.ctx.lineWidth = 5 / this.scale;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.shadowColor = lineColor;
        this.ctx.shadowBlur = 16 / this.scale;
        this.ctx.globalAlpha = 0.92;
        // 玩家位置在底部
        const playerScreenY = logicalHeight - this.cellSize;
        this.ctx.beginPath();
        // 从当前位置开始（玩家所在位置）
        const currentX = (this.currentCol + 0.5) * this.cellSize;
        this.ctx.moveTo(currentX, playerScreenY);
        // 当前绘制位置的X坐标
        let drawX = currentX;
        // 从最新的转折点开始，向下绘制（走过的路径在下方）
        // 转折点的worldY < 当前worldY，所以在屏幕下方
        for (let i = this.pathPoints.length - 1; i >= 0; i--) {
            const point = this.pathPoints[i];
            // 计算转折点的屏幕Y坐标
            const screenY = playerScreenY + (worldY - point.worldY) * this.cellSize;
            // 如果转折点在屏幕上方（不应该发生）
            if (screenY < 0)
                continue;
            // 如果已经超出屏幕底部，画到底部后停止
            if (screenY > logicalHeight) {
                this.ctx.lineTo(drawX, logicalHeight);
                break;
            }
            const pointX = (point.col + 0.5) * this.cellSize;
            // 绘制：先垂直到转折点Y，再水平到转折点X
            this.ctx.lineTo(drawX, screenY); // 垂直线
            this.ctx.lineTo(pointX, screenY); // 水平线
            drawX = pointX;
        }
        // 计算起始位置的屏幕Y
        const startScreenY = playerScreenY + (worldY - this.startWorldY) * this.cellSize;
        // 始终延伸到起始位置或屏幕底部
        if (startScreenY >= 0 && startScreenY <= logicalHeight) {
            this.ctx.lineTo(drawX, startScreenY);
        }
        else if (startScreenY > logicalHeight) {
            this.ctx.lineTo(drawX, logicalHeight);
        }
        this.ctx.stroke();
        this.ctx.restore();
    }
    /**
     * 渲染障碍物（从缓存）
     * 玩家在底部，障碍物从顶部向下滚动
     *
     * 注意：调用此方法时，ctx 变换矩阵已包含 offsetX 平移和 scale 缩放，
     * 因此此处坐标全部使用逻辑坐标系。
     */
    renderObstacles(worldY) {
        if (!this.ctx)
            return;
        const logicalHeight = this.height / this.scale;
        const playerY = logicalHeight - this.cellSize;
        for (const obs of this.obstacleCache.values()) {
            const color = OBSTACLE_COLOR_MAP[obs.color] || '#f4f6fb';
            // 从世界坐标计算屏幕坐标
            const screenY = playerY - (obs.worldY - worldY) * this.cellSize;
            const x = obs.col * this.cellSize;
            if (screenY >= -this.cellSize && screenY < logicalHeight) {
                this.drawObstacle(x, screenY, color);
            }
        }
    }
    /**
     * 绘制单个障碍物（圆角 + 内高光 + 微弱投影）
     */
    drawObstacle(x, screenY, color) {
        if (!this.ctx)
            return;
        const inset = THEME.obstacleInset / this.scale;
        const size = this.cellSize - inset * 2;
        this.ctx.save();
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        this.ctx.shadowBlur = 12 / this.scale;
        this.ctx.shadowOffsetY = 4 / this.scale;
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.roundRect(x + inset, screenY + inset, size, size, THEME.obstacleRadius / this.scale);
        this.ctx.fill();
        this.ctx.restore();
        // 顶部内高光，增加体积感
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.beginPath();
        this.ctx.roundRect(x + inset + 3 / this.scale, screenY + inset + 3 / this.scale, size - 6 / this.scale, (size - 6 / this.scale) / 2.6, (THEME.obstacleRadius - 3) / this.scale);
        this.ctx.fill();
    }
    /**
     * 渲染距离
     * - 桌面/横屏：绘制在游戏区域右侧留白处，不遮挡车道
     * - 移动端竖屏：绘制在左上角，叠加在赛道上方但留足边距，避免遮挡玩家与障碍物
     *
     * 注意：调用此方法时，ctx 变换矩阵已包含 offsetX 平移和 scale 缩放，
     * 因此此处坐标全部使用逻辑坐标系，字体大小需除以 scale。
     */
    renderDistance() {
        if (!this.ctx)
            return;
        let x;
        let labelY;
        let valueY;
        let labelSize;
        let valueSize;
        let align;
        if (this.layoutMode === 'mobile-portrait') {
            x = 10 / this.scale;
            labelY = 12 / this.scale;
            valueY = 28 / this.scale;
            labelSize = 10 / this.scale;
            valueSize = 20 / this.scale;
            align = 'left';
        }
        else {
            const gameAreaWidth = GAME_CONFIG.GRID_COLS * this.cellSize;
            x = gameAreaWidth + 24 / this.scale;
            labelY = 18 / this.scale;
            valueY = 34 / this.scale;
            labelSize = 11 / this.scale;
            valueSize = 22 / this.scale;
            align = 'left';
        }
        this.ctx.textAlign = align;
        this.ctx.textBaseline = 'top';
        this.ctx.fillStyle = THEME.textDim;
        this.ctx.font = `${labelSize}px ${THEME.fontFamily}`;
        this.ctx.fillText('距离', x, labelY);
        this.ctx.fillStyle = THEME.textPrimary;
        this.ctx.font = `700 ${valueSize}px ${THEME.fontMono}`;
        this.ctx.fillText(`${this.distance}`, x, valueY);
    }
    /**
     * 等待画面
     * 画布只呈现空舞台（车道与格子）；玩家数、准备状态由 DOM 状态栏与操作按钮承载，
     * 避免在游戏区域内叠加文字或光标造成信息重复。
     *
     * 注意：此方法使用单位矩阵绘制全屏渐变（clear 已用缩放矩阵绘制赛道）。
     */
    renderWaitingScreen(_state) {
        if (!this.ctx)
            return;
        // 注意：这里不再调用 resetAll()。
        // 等待画面在大厅阶段会被反复渲染，若每帧重置，会把「刚开局前」累积的
        // scrollWorldY / 障碍物缓存 / gameStarted 反复清零，
        // 造成开局瞬间取景与方块错位（看起来像方块延迟或错位）。
        // 状态清理改由「重开一局 / 重新加入房间」时显式调用 resetAll() 负责。
        // 用单位矩阵绘制全屏渐变
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        // 中心区域轻微提亮，作为空舞台的视觉焦点
        const glow = this.ctx.createRadialGradient(this.width / 2, this.height / 2, 20, this.width / 2, this.height / 2, this.height * 0.62);
        glow.addColorStop(0, 'rgba(111, 168, 255, 0.07)');
        glow.addColorStop(1, 'rgba(111, 168, 255, 0)');
        this.ctx.fillStyle = glow;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }
    /**
     * 倒计时画面
     *
     * 注意：此方法使用单位矩阵绘制全屏遮罩和文字。
     */
    renderCountdown(state) {
        if (!this.ctx)
            return;
        // 用单位矩阵绘制全屏遮罩
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.fillStyle = 'rgba(8, 10, 15, 0.55)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        // 光环
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(111, 168, 255, 0.5)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 86, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();
        this.ctx.fillStyle = THEME.textPrimary;
        this.ctx.font = `700 96px ${THEME.fontMono}`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(String(state.countdown ?? ''), centerX, centerY + 4);
        this.ctx.fillStyle = THEME.textDim;
        this.ctx.font = `13px ${THEME.fontFamily}`;
        this.ctx.fillText('即将开始', centerX, centerY + 92);
    }
    getVeilGradient() {
        if (!this.ctx)
            return null;
        if (!this.cachedVeil) {
            const veil = this.ctx.createLinearGradient(0, 0, 0, this.height);
            veil.addColorStop(0, 'rgba(8, 10, 15, 0.72)');
            veil.addColorStop(1, 'rgba(8, 10, 15, 0.86)');
            this.cachedVeil = veil;
        }
        return this.cachedVeil;
    }
    /**
     * 游戏结束画面
     *
     * 注意：路径和障碍物使用缩放矩阵（逻辑坐标系），遮罩和文字使用单位矩阵。
     */
    renderGameOver() {
        if (!this.ctx)
            return;
        const logicalHeight = this.height / this.scale;
        const playerY = logicalHeight - this.cellSize;
        // 先渲染最终游戏画面（使用缩放矩阵，逻辑坐标系）
        if (this.finalState) {
            // 先渲染路径（显示完整走过的痕迹，向下延伸）
            const lineColor = this.myPlayerColor ? PLAYER_COLOR_MAP[this.myPlayerColor] : '#c9d2e3';
            this.ctx.save();
            this.ctx.strokeStyle = lineColor;
            this.ctx.lineWidth = 5 / this.scale;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.shadowColor = lineColor;
            this.ctx.shadowBlur = 16 / this.scale;
            this.ctx.globalAlpha = 0.9;
            this.ctx.beginPath();
            const currentX = (this.finalState.currentCol + 0.5) * this.cellSize;
            this.ctx.moveTo(currentX, playerY);
            let drawX = currentX;
            const worldY = this.finalState.worldY;
            for (let i = this.finalState.pathPoints.length - 1; i >= 0; i--) {
                const point = this.finalState.pathPoints[i];
                const screenY = playerY + (worldY - point.worldY) * this.cellSize;
                if (screenY < 0)
                    continue;
                if (screenY > logicalHeight) {
                    this.ctx.lineTo(drawX, logicalHeight);
                    break;
                }
                const pointX = (point.col + 0.5) * this.cellSize;
                this.ctx.lineTo(drawX, screenY);
                this.ctx.lineTo(pointX, screenY);
                drawX = pointX;
            }
            // 延伸到起始位置或屏幕底部
            const startScreenY = playerY + (worldY - this.startWorldY) * this.cellSize;
            if (startScreenY >= 0 && startScreenY <= logicalHeight) {
                this.ctx.lineTo(drawX, startScreenY);
            }
            else if (startScreenY > logicalHeight) {
                this.ctx.lineTo(drawX, logicalHeight);
            }
            this.ctx.stroke();
            this.ctx.restore();
            // 再渲染障碍物（在路径上面）
            for (const obs of this.finalState.obstacles) {
                const color = OBSTACLE_COLOR_MAP[obs.color] || '#f4f6fb';
                const screenY = playerY - (obs.worldY - this.finalState.worldY) * this.cellSize;
                const x = obs.col * this.cellSize;
                if (screenY >= -this.cellSize && screenY < logicalHeight) {
                    this.drawObstacle(x, screenY, color);
                }
            }
        }
        // 半透明遮罩和文字使用单位矩阵
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        const veil = this.getVeilGradient();
        if (veil) {
            this.ctx.fillStyle = veil;
            this.ctx.fillRect(0, 0, this.width, this.height);
        }
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        // 结算面板
        const cardW = 380;
        const cardH = 168;
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(16, 20, 28, 0.86)';
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.roundRect(centerX - cardW / 2, centerY - cardH / 2, cardW, cardH, 20);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = THEME.textDim;
        this.ctx.font = `12px ${THEME.fontFamily}`;
        this.ctx.fillText('本局结束', centerX, centerY - 54);
        this.ctx.fillStyle = THEME.textPrimary;
        this.ctx.font = `700 52px ${THEME.fontMono}`;
        this.ctx.fillText(`${this.finalState?.distance ?? this.distance}`, centerX, centerY - 6);
        this.ctx.fillStyle = THEME.textDim;
        this.ctx.font = `12px ${THEME.fontFamily}`;
        this.ctx.fillText('距离（米）', centerX, centerY + 32);
        this.ctx.fillStyle = 'rgba(111, 168, 255, 0.9)';
        this.ctx.font = `13px ${THEME.fontFamily}`;
        this.ctx.fillText('点击下方按钮重新开始', centerX, centerY + 62);
    }
    getSize() {
        return { width: this.width, height: this.height };
    }
    /**
     * 调试只读快照：当前取景位置与最前方障碍物的屏幕位置
     *
     * 用于核验「障碍物是否随取景平滑移动」：若在两次状态广播之间该值连续变化，
     * 说明插值推帧生效；若呈脉冲式跳变则说明画面只在广播到达时更新。
     * 不参与游戏逻辑，仅读取渲染器内部缓存。
     */
    getDebugSnapshot() {
        let top = null;
        for (const obs of this.obstacleCache.values()) {
            if (!top || obs.worldY > top.worldY) {
                top = obs;
            }
        }
        const playerY = this.height - this.cellSize;
        return {
            cameraWorldY: this.scrollWorldY,
            topObstacleScreenY: top ? playerY - (top.worldY - this.scrollWorldY) * this.cellSize : null,
            topObstacleWorldY: top ? top.worldY : null,
            frameCount: this.frameCount
        };
    }
}
//# sourceMappingURL=canvas-renderer.js.map