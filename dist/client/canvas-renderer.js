/**
 * 画布渲染器 - 网格布局版本
 * 玩家固定在底部，视角向上移动，障碍物相对向下滚动
 */
import { GameState, PlayerColor, ObstacleColor } from '../shared/types.js';
import { GAME_CONFIG } from '../shared/constants.js';
const PLAYER_COLOR_MAP = {
    [PlayerColor.RED]: '#E91E63',
    [PlayerColor.GREEN]: '#4CAF50',
    [PlayerColor.BLUE]: '#2196F3',
    [PlayerColor.YELLOW]: '#FFEB3B'
};
const OBSTACLE_COLOR_MAP = {
    [ObstacleColor.RED]: '#E91E63',
    [ObstacleColor.GREEN]: '#4CAF50',
    [ObstacleColor.BLUE]: '#2196F3',
    [ObstacleColor.YELLOW]: '#FFEB3B',
    [ObstacleColor.CYAN]: '#00BCD4',
    [ObstacleColor.MAGENTA]: '#E91E63',
    [ObstacleColor.WHITE]: '#FFFFFF'
};
export class CanvasRenderer {
    canvas = null;
    ctx = null;
    width = GAME_CONFIG.GAME_WIDTH;
    height = GAME_CONFIG.GAME_HEIGHT;
    cellSize = GAME_CONFIG.CELL_SIZE;
    offsetX = GAME_CONFIG.GAME_AREA_OFFSET; // 游戏区域左侧偏移
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
    init(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        if (!this.ctx)
            throw new Error('无法获取 Canvas 2D 上下文');
        canvas.width = this.width;
        canvas.height = this.height;
        this.resetAll();
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
    }
    render(state) {
        if (!this.ctx)
            return;
        this.clear();
        switch (state.gameState) {
            case GameState.WAITING:
                this.renderWaitingScreen(state);
                break;
            case GameState.COUNTDOWN:
                this.renderCountdown(state);
                break;
            case GameState.PLAYING:
                this.renderGame(state);
                break;
            case GameState.GAME_OVER:
                this.renderGameOver();
                break;
        }
    }
    clear() {
        if (!this.ctx)
            return;
        this.ctx.fillStyle = '#F5F5F5';
        this.ctx.fillRect(0, 0, this.width, this.height);
        // 渲染游戏区域边界
        this.renderBoundary();
    }
    /**
     * 渲染游戏区域边界
     * 靠近障碍物时边界变红
     */
    renderBoundary() {
        if (!this.ctx)
            return;
        const gameAreaWidth = GAME_CONFIG.GRID_COLS * this.cellSize;
        // 根据危险状态选择边界颜色
        const borderColor = this.isDanger ? '#ff8b8b' : '#ddd';
        const lineWidth = this.isDanger ? 4 : 2;
        // 左边界
        this.ctx.strokeStyle = borderColor;
        this.ctx.lineWidth = lineWidth;
        this.ctx.beginPath();
        this.ctx.moveTo(this.offsetX, 0);
        this.ctx.lineTo(this.offsetX, this.height);
        this.ctx.stroke();
        // 右边界
        this.ctx.beginPath();
        this.ctx.moveTo(this.offsetX + gameAreaWidth, 0);
        this.ctx.lineTo(this.offsetX + gameAreaWidth, this.height);
        this.ctx.stroke();
    }
    renderGame(state) {
        const myPlayer = state.players.find(p => p.id === this.myPlayerId);
        if (!myPlayer)
            return;
        const worldY = myPlayer.position.y;
        const newCol = Math.floor(myPlayer.position.x / this.cellSize);
        // 初始化起始位置
        if (!this.gameStarted) {
            this.startWorldY = worldY;
            this.gameStarted = true;
        }
        // 检测玩家死亡
        if (!myPlayer.isAlive && !this.isDead) {
            this.isDead = true;
            // 使用服务器发送的距离，如果没有则使用本地计算的距离
            this.deathDistance = myPlayer.distance ?? Math.floor(worldY - this.startWorldY);
        }
        // 计算距离：死亡后使用死亡时的距离
        if (this.isDead) {
            this.distance = this.deathDistance;
        }
        else {
            this.distance = myPlayer.distance ?? Math.floor(worldY - this.startWorldY);
        }
        // 更新障碍物缓存
        this.updateObstacleCache(state.obstacles, worldY);
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
     */
    renderDeathOverlay() {
        if (!this.ctx)
            return;
        // 半透明红色遮罩
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        // 死亡提示文字
        this.ctx.fillStyle = '#FF5252';
        this.ctx.font = 'bold 18px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('你已死亡', this.width / 2, this.height / 2 - 20);
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '14px Arial';
        this.ctx.fillText(`最终距离: ${this.deathDistance}`, this.width / 2, this.height / 2 + 10);
        this.ctx.fillText('观看其他玩家...', this.width / 2, this.height / 2 + 35);
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
                // 从屏幕坐标反算世界坐标
                const playerY = this.height - this.cellSize;
                const obstacleWorldY = worldY + (playerY - obs.position.y) / this.cellSize;
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
            return;
        }
        // 如果有近距离提示，且当前列有提示，则标记为危险
        if (proximityHints && proximityHints.length > 0) {
            // 检查当前列是否有近距离提示
            const hasHintInCurrentCol = proximityHints.some(hint => hint.route === this.currentCol);
            this.isDanger = hasHintInCurrentCol;
        }
        else {
            this.isDanger = false;
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
        const lineColor = this.myPlayerColor ? PLAYER_COLOR_MAP[this.myPlayerColor] : '#757575';
        this.ctx.strokeStyle = lineColor;
        this.ctx.lineWidth = 4;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        // 玩家位置在底部
        const playerScreenY = this.height - this.cellSize;
        this.ctx.beginPath();
        // 从当前位置开始（玩家所在位置）
        const currentX = this.offsetX + (this.currentCol + 0.5) * this.cellSize;
        this.ctx.moveTo(currentX, playerScreenY);
        // 当前绘制位置的X坐标
        let drawX = currentX;
        // 从最新的转折点开始，向下绘制（走过的路径在下方）
        // 转折点的worldY < 当前worldY，所以在屏幕下方
        for (let i = this.pathPoints.length - 1; i >= 0; i--) {
            const point = this.pathPoints[i];
            // 计算转折点的屏幕Y坐标
            // 转折点worldY比当前worldY小，在屏幕下方
            // 屏幕Y = playerScreenY + (worldY - point.worldY) * cellSize
            const screenY = playerScreenY + (worldY - point.worldY) * this.cellSize;
            // 如果转折点在屏幕上方（不应该发生）
            if (screenY < 0)
                continue;
            // 如果已经超出屏幕底部，画到底部后停止
            if (screenY > this.height) {
                this.ctx.lineTo(drawX, this.height);
                break;
            }
            const pointX = this.offsetX + (point.col + 0.5) * this.cellSize;
            // 绘制：先垂直到转折点Y，再水平到转折点X
            this.ctx.lineTo(drawX, screenY); // 垂直线
            this.ctx.lineTo(pointX, screenY); // 水平线
            drawX = pointX;
        }
        // 计算起始位置的屏幕Y
        // 起始位置的worldY是startWorldY，比当前worldY小，在屏幕下方
        const startScreenY = playerScreenY + (worldY - this.startWorldY) * this.cellSize;
        // 始终延伸到起始位置或屏幕底部
        if (startScreenY >= 0 && startScreenY <= this.height) {
            // 起始位置在屏幕内，延伸到起始位置
            this.ctx.lineTo(drawX, startScreenY);
        }
        else if (startScreenY > this.height) {
            // 起始位置在屏幕外下方，延伸到屏幕底部
            this.ctx.lineTo(drawX, this.height);
        }
        this.ctx.stroke();
    }
    /**
     * 渲染障碍物（从缓存）
     * 玩家在底部，障碍物从顶部向下滚动
     */
    renderObstacles(worldY) {
        if (!this.ctx)
            return;
        const playerY = this.height - this.cellSize;
        for (const obs of this.obstacleCache.values()) {
            const color = OBSTACLE_COLOR_MAP[obs.color] || '#FFFFFF';
            // 从世界坐标计算屏幕坐标
            // 障碍物worldY比玩家worldY大时，在屏幕上方
            const screenY = playerY - (obs.worldY - worldY) * this.cellSize;
            const x = this.offsetX + obs.col * this.cellSize;
            if (screenY >= -this.cellSize && screenY < this.height) {
                this.ctx.fillStyle = color;
                this.ctx.fillRect(x + 3, screenY + 3, this.cellSize - 6, this.cellSize - 6);
            }
        }
    }
    /**
     * 渲染距离
     */
    renderDistance() {
        if (!this.ctx)
            return;
        this.ctx.fillStyle = '#333';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(`距离: ${this.distance}`, 10, 10);
    }
    renderWaitingScreen(state) {
        if (!this.ctx)
            return;
        this.resetAll();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '18px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('等待玩家', this.width / 2, this.height / 2 - 50);
        const playerCount = state.players.length;
        this.ctx.font = '14px Arial';
        this.ctx.fillText(`${playerCount}/${GAME_CONFIG.MAX_PLAYERS}`, this.width / 2, this.height / 2 - 20);
        if (playerCount >= GAME_CONFIG.MIN_PLAYERS) {
            this.ctx.fillStyle = '#4CAF50';
            this.ctx.fillText('按空格或点击屏幕准备', this.width / 2, this.height / 2 + 10);
        }
    }
    renderCountdown(state) {
        if (!this.ctx)
            return;
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 60px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(String(state.countdown ?? ''), this.width / 2, this.height / 2);
    }
    renderGameOver() {
        if (!this.ctx)
            return;
        // 先渲染最终游戏画面
        if (this.finalState) {
            // 先渲染路径（显示完整走过的痕迹，向下延伸）
            const lineColor = this.myPlayerColor ? PLAYER_COLOR_MAP[this.myPlayerColor] : '#757575';
            this.ctx.strokeStyle = lineColor;
            this.ctx.lineWidth = 4;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.beginPath();
            const currentX = this.offsetX + (this.finalState.currentCol + 0.5) * this.cellSize;
            const playerY = this.height - this.cellSize;
            this.ctx.moveTo(currentX, playerY);
            let drawX = currentX;
            const worldY = this.finalState.worldY;
            for (let i = this.finalState.pathPoints.length - 1; i >= 0; i--) {
                const point = this.finalState.pathPoints[i];
                const screenY = playerY + (worldY - point.worldY) * this.cellSize;
                if (screenY < 0)
                    continue;
                if (screenY > this.height) {
                    this.ctx.lineTo(drawX, this.height);
                    break;
                }
                const pointX = this.offsetX + (point.col + 0.5) * this.cellSize;
                this.ctx.lineTo(drawX, screenY);
                this.ctx.lineTo(pointX, screenY);
                drawX = pointX;
            }
            // 延伸到起始位置或屏幕底部
            const startScreenY = playerY + (worldY - this.startWorldY) * this.cellSize;
            if (startScreenY >= 0 && startScreenY <= this.height) {
                this.ctx.lineTo(drawX, startScreenY);
            }
            else if (startScreenY > this.height) {
                this.ctx.lineTo(drawX, this.height);
            }
            this.ctx.stroke();
            // 再渲染障碍物（在路径上面）
            for (const obs of this.finalState.obstacles) {
                const color = OBSTACLE_COLOR_MAP[obs.color] || '#FFFFFF';
                const screenY = playerY - (obs.worldY - this.finalState.worldY) * this.cellSize;
                const x = this.offsetX + obs.col * this.cellSize;
                if (screenY >= -this.cellSize && screenY < this.height) {
                    this.ctx.fillStyle = color;
                    this.ctx.fillRect(x + 3, screenY + 3, this.cellSize - 6, this.cellSize - 6);
                }
            }
        }
        // 半透明遮罩
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        // 游戏结束文字
        this.ctx.fillStyle = '#FF5252';
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('游戏结束', this.width / 2, this.height / 2 - 40);
        // 显示最终距离
        const finalDistance = this.finalState?.distance ?? this.distance;
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '18px Arial';
        this.ctx.fillText(`最终距离: ${finalDistance}`, this.width / 2, this.height / 2);
        // 重新开始提示
        this.ctx.fillStyle = '#4CAF50';
        this.ctx.font = '14px Arial';
        this.ctx.fillText('按空格或点击屏幕重新开始', this.width / 2, this.height / 2 + 40);
    }
    getSize() {
        return { width: this.width, height: this.height };
    }
}
//# sourceMappingURL=canvas-renderer.js.map