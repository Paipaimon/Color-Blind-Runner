/**
 * 画布渲染器 - 网格布局版本
 * 玩家固定在底部，视角向上移动，障碍物相对向下滚动
 *
 * 本次 UI 重构说明：
 * - 渲染几何、坐标换算、状态缓存与数据来源（服务端投影后的可见状态）完全保持不变。
 * - 仅重做视觉层：统一主题色、渐变背景、车道框架、发光轨迹、圆角障碍物与排版。
 */

import { VisibleState, Obstacle, GameState, PlayerColor, ObstacleColor, ProximityHint } from '../shared/types.js';
import { GAME_CONFIG } from '../shared/constants.js';

/** 玩家颜色映射 */
const PLAYER_COLOR_MAP: Record<PlayerColor, string> = {
  [PlayerColor.RED]: '#ff4d6d',
  [PlayerColor.GREEN]: '#35d07f',
  [PlayerColor.BLUE]: '#4d9dff',
  [PlayerColor.YELLOW]: '#ffd23f'
};

/** 障碍物颜色映射 */
const OBSTACLE_COLOR_MAP: Record<ObstacleColor, string> = {
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
} as const;

// 路径点 - 记录玩家在某个世界Y位置时所在的列
interface PathPoint {
  col: number;
  worldY: number;
}

// 缓存的障碍物
interface CachedObstacle {
  id: string;
  color: ObstacleColor;
  col: number;
  worldY: number;  // 世界坐标
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private width: number = GAME_CONFIG.GAME_WIDTH;
  private height: number = GAME_CONFIG.GAME_HEIGHT;
  private cellSize: number = GAME_CONFIG.CELL_SIZE;
  private offsetX: number = GAME_CONFIG.GAME_AREA_OFFSET;  // 游戏区域左侧偏移
  private myPlayerId: string | null = null;
  private myPlayerColor: PlayerColor | null = null;

  // 路径点列表
  private pathPoints: PathPoint[] = [];
  private currentCol: number = 1;

  // 障碍物缓存（避免闪烁）
  private obstacleCache: Map<string, CachedObstacle> = new Map();

  // 游戏数据
  private distance: number = 0;
  private startWorldY: number = 0;
  private gameStarted: boolean = false;

  // 玩家死亡状态
  private isDead: boolean = false;
  private deathDistance: number = 0;  // 死亡时的距离

  // 游戏结束时的最终状态
  private finalState: {
    distance: number;
    pathPoints: PathPoint[];
    currentCol: number;
    obstacles: CachedObstacle[];
    worldY: number;
  } | null = null;

  // 危险状态（靠近障碍物）
  private isDanger: boolean = false;
  private dangerIntensity: number = 0;

  // 当前世界滚动位置（仅用于背景网格的视觉滚动）
  private scrollWorldY: number = 0;

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) throw new Error('无法获取 Canvas 2D 上下文');
    // 内部分辨率恒为 1280×720：全部绘制坐标基于该逻辑尺寸，显示缩放交给 CSS。
    // 注意：不要按显示尺寸改写 canvas.width/height，否则坐标系会随之改变导致画面错位。
    canvas.width = this.width;
    canvas.height = this.height;
    this.resetAll();
  }

  setMyPlayer(playerId: string, color: PlayerColor): void {
    this.myPlayerId = playerId;
    this.myPlayerColor = color;
  }

  resetAll(): void {
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

  render(state: VisibleState): void {
    if (!this.ctx) return;
    this.clear();

    // 暴露当前状态供调试工具读取（无逻辑作用）
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
        this.renderGame(state);
        break;
      case GameState.GAME_OVER:
        this.renderGameOver();
        break;
    }
  }

  /**
   * 绘制舞台：背景、车道、网格与边框
   */
  clear(): void {
    if (!this.ctx) return;

    const gameAreaWidth = GAME_CONFIG.GRID_COLS * this.cellSize;
    const gameAreaHeight = GAME_CONFIG.GRID_ROWS * this.cellSize;

    // 游戏区域整体背景
    const bg = this.ctx.createLinearGradient(0, 0, 0, this.height);
    bg.addColorStop(0, THEME.bgTop);
    bg.addColorStop(1, THEME.bgBottom);
    this.ctx.fillStyle = bg;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // 左右留白（暗角），让视线聚焦到三条车道上
    this.ctx.fillStyle = THEME.gutter;
    this.ctx.fillRect(0, 0, this.offsetX, this.height);
    this.ctx.fillRect(this.offsetX + gameAreaWidth, 0, this.width - this.offsetX - gameAreaWidth, this.height);

    // 车道交替底色
    this.ctx.fillStyle = THEME.laneAlt;
    this.ctx.fillRect(this.offsetX + this.cellSize, 0, this.cellSize, this.height);

    // 横向滚动网格（提供运动参照）
    this.renderScrollGrid();

    // 车道分隔线
    this.ctx.strokeStyle = THEME.laneSeparator;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    for (let col = 1; col < GAME_CONFIG.GRID_COLS; col++) {
      const x = Math.round(this.offsetX + col * this.cellSize) + 0.5;
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
    }
    this.ctx.stroke();

    // 危险光晕（自己颜色的障碍物逼近时）
    if (this.isDanger) {
      const tint = this.ctx.createLinearGradient(0, 0, 0, this.height);
      const alpha = Math.min(1, 0.4 + this.dangerIntensity * 0.6);
      tint.addColorStop(0, `rgba(255, 60, 60, ${0.05 * alpha})`);
      tint.addColorStop(1, `rgba(255, 60, 60, ${0.16 * alpha})`);
      this.ctx.fillStyle = tint;
      this.ctx.fillRect(this.offsetX, 0, gameAreaWidth, this.height);
    }

    // 游戏区域边框
    this.renderBoundary(gameAreaHeight);
  }

  /**
   * 横向滚动网格线
   * 使用与障碍物相同的世界滚动换算，因此不需要额外状态
   */
  private renderScrollGrid(): void {
    if (!this.ctx) return;

    const playerY = this.height - this.cellSize;
    const worldOffset = this.gameStarted ? (this.scrollWorldY % this.cellSize) : 0;

    this.ctx.strokeStyle = THEME.gridLine;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    for (let y = playerY - worldOffset; y > -this.cellSize; y -= this.cellSize) {
      const py = Math.round(y) + 0.5;
      this.ctx.moveTo(this.offsetX, py);
      this.ctx.lineTo(this.offsetX + GAME_CONFIG.GRID_COLS * this.cellSize, py);
    }
    this.ctx.stroke();
  }

  /** 当前世界滚动位置（用于网格滚动，纯视觉） */

  /**
   * 渲染游戏区域边框
   * 靠近障碍物时边框转为警示色
   */
  private renderBoundary(gameAreaHeight: number): void {
    if (!this.ctx) return;

    const gameAreaWidth = GAME_CONFIG.GRID_COLS * this.cellSize;
    const x = this.offsetX;
    const y = (this.height - gameAreaHeight) / 2;

    if (this.isDanger) {
      this.ctx.save();
      this.ctx.shadowColor = THEME.dangerFrame;
      this.ctx.shadowBlur = 18 + this.dangerIntensity * 22;
      this.ctx.strokeStyle = THEME.dangerFrame;
      this.ctx.lineWidth = 2 + this.dangerIntensity * 2;
    } else {
      this.ctx.save();
      this.ctx.strokeStyle = THEME.frame;
      this.ctx.lineWidth = 1.5;
    }

    this.ctx.beginPath();
    this.ctx.roundRect(x + 0.5, y + 0.5, gameAreaWidth - 1, gameAreaHeight - 1, 14);
    this.ctx.stroke();
    this.ctx.restore();
  }

  private renderGame(state: VisibleState): void {
    const myPlayer = state.players.find(p => p.id === this.myPlayerId);
    if (!myPlayer) return;

    const worldY = myPlayer.position.y;
    const newCol = Math.floor(myPlayer.position.x / this.cellSize);

    // 初始化起始位置
    if (!this.gameStarted) {
      this.startWorldY = worldY;
      this.gameStarted = true;
    }

    // 记录世界滚动位置（用于网格动画）
    this.scrollWorldY = worldY * this.cellSize;

    // 检测玩家死亡
    if (!myPlayer.isAlive && !this.isDead) {
      this.isDead = true;
      // 使用服务器发送的距离，如果没有则使用本地计算的距离
      this.deathDistance = myPlayer.distance ?? Math.floor(worldY - this.startWorldY);
    }

    // 计算距离：死亡后使用死亡时的距离
    if (this.isDead) {
      this.distance = this.deathDistance;
    } else {
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

    // 渲染玩家本体
    if (!this.isDead) {
      this.renderPlayer(worldY);
    }

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
   * 渲染玩家本体：底部车道上的圆角光块
   */
  private renderPlayer(worldY: number): void {
    if (!this.ctx) return;

    const color = this.myPlayerColor ? PLAYER_COLOR_MAP[this.myPlayerColor] : '#c9d2e3';
    const playerY = this.height - this.cellSize;
    const cx = this.offsetX + (this.currentCol + 0.5) * this.cellSize;
    const cy = playerY + this.cellSize / 2;
    const size = this.cellSize - THEME.obstacleInset * 2;

    this.ctx.save();
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 26;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.roundRect(cx - size / 2, cy - size / 2, size, size, THEME.obstacleRadius);
    this.ctx.fill();
    this.ctx.restore();

    // 内层高光
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    this.ctx.beginPath();
    this.ctx.roundRect(cx - size / 2 + 3, cy - size / 2 + 3, size - 6, (size - 6) / 2.6, THEME.obstacleRadius - 3);
    this.ctx.fill();
  }

  /**
   * 渲染死亡提示覆盖层
   */
  private renderDeathOverlay(): void {
    if (!this.ctx) return;

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
  private saveFinalState(worldY: number): void {
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
  private updateObstacleCache(obstacles: Obstacle[], worldY: number): void {
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
  private checkDanger(proximityHints?: ProximityHint[]): void {
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
    } else {
      this.isDanger = false;
      this.dangerIntensity = 0;
    }
  }

  /**
   * 更新路径
   * 不清除历史路径点，始终保留完整痕迹
   */
  private updatePath(newCol: number, worldY: number): void {
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
  private renderPath(worldY: number): void {
    if (!this.ctx) return;
    if (!this.gameStarted) return;

    const lineColor = this.myPlayerColor ? PLAYER_COLOR_MAP[this.myPlayerColor] : '#c9d2e3';

    this.ctx.save();
    this.ctx.strokeStyle = lineColor;
    this.ctx.lineWidth = 5;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.shadowColor = lineColor;
    this.ctx.shadowBlur = 16;
    this.ctx.globalAlpha = 0.92;

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
      if (screenY < 0) continue;

      // 如果已经超出屏幕底部，画到底部后停止
      if (screenY > this.height) {
        this.ctx.lineTo(drawX, this.height);
        break;
      }

      const pointX = this.offsetX + (point.col + 0.5) * this.cellSize;

      // 绘制：先垂直到转折点Y，再水平到转折点X
      this.ctx.lineTo(drawX, screenY);  // 垂直线
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
    } else if (startScreenY > this.height) {
      // 起始位置在屏幕外下方，延伸到屏幕底部
      this.ctx.lineTo(drawX, this.height);
    }

    this.ctx.stroke();
    this.ctx.restore();
  }

  /**
   * 渲染障碍物（从缓存）
   * 玩家在底部，障碍物从顶部向下滚动
   */
  private renderObstacles(worldY: number): void {
    if (!this.ctx) return;

    const playerY = this.height - this.cellSize;

    for (const obs of this.obstacleCache.values()) {
      const color = OBSTACLE_COLOR_MAP[obs.color] || '#f4f6fb';

      // 从世界坐标计算屏幕坐标
      // 障碍物worldY比玩家worldY大时，在屏幕上方
      const screenY = playerY - (obs.worldY - worldY) * this.cellSize;
      const x = this.offsetX + obs.col * this.cellSize;

      if (screenY >= -this.cellSize && screenY < this.height) {
        this.drawObstacle(x, screenY, color);
      }
    }
  }

  /**
   * 绘制单个障碍物（圆角 + 内高光 + 微弱投影）
   */
  private drawObstacle(x: number, screenY: number, color: string): void {
    if (!this.ctx) return;

    const inset = THEME.obstacleInset;
    const size = this.cellSize - inset * 2;

    this.ctx.save();
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    this.ctx.shadowBlur = 12;
    this.ctx.shadowOffsetY = 4;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.roundRect(x + inset, screenY + inset, size, size, THEME.obstacleRadius);
    this.ctx.fill();
    this.ctx.restore();

    // 顶部内高光，增加体积感
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    this.ctx.beginPath();
    this.ctx.roundRect(x + inset + 3, screenY + inset + 3, size - 6, (size - 6) / 2.6, THEME.obstacleRadius - 3);
    this.ctx.fill();
  }

  /**
   * 渲染距离
   * 绘制在游戏区域右侧留白处，不遮挡车道
   */
  private renderDistance(): void {
    if (!this.ctx) return;

    const gameAreaRight = this.offsetX + GAME_CONFIG.GRID_COLS * this.cellSize;
    const x = gameAreaRight + 24;

    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';

    this.ctx.fillStyle = THEME.textDim;
    this.ctx.font = `11px ${THEME.fontFamily}`;
    this.ctx.fillText('距离', x, 18);

    this.ctx.fillStyle = THEME.textPrimary;
    this.ctx.font = `700 22px ${THEME.fontMono}`;
    this.ctx.fillText(`${this.distance}`, x, 34);
  }

  /**
   * 等待画面
   * 画布只呈现空舞台；玩家数、房间号、准备状态由 DOM 状态栏与操作按钮承载，
   * 避免在游戏区域内叠加文字造成信息重复。
   */
  private renderWaitingScreen(_state: VisibleState): void {
    if (!this.ctx) return;
    this.resetAll();

    // 中心区域轻微提亮，作为空舞台的视觉焦点
    const glow = this.ctx.createRadialGradient(
      this.width / 2, this.height / 2, 20,
      this.width / 2, this.height / 2, this.height * 0.62
    );
    glow.addColorStop(0, 'rgba(111, 168, 255, 0.07)');
    glow.addColorStop(1, 'rgba(111, 168, 255, 0)');
    this.ctx.fillStyle = glow;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // 车道中央的呼吸光标：表达"等待中"的静止感，不含方向引导
    const t = (Date.now() % 2200) / 2200;
    const pulse = 0.35 + 0.5 * Math.sin(t * Math.PI * 2);
    const cx = this.offsetX + (1 + 0.5) * this.cellSize;
    const cy = this.height - this.cellSize * 1.5;

    this.ctx.save();
    this.ctx.globalAlpha = Math.max(0.28, pulse);
    this.ctx.strokeStyle = 'rgba(190, 210, 245, 0.85)';
    this.ctx.lineWidth = 2;
    this.ctx.shadowColor = 'rgba(140, 180, 255, 0.6)';
    this.ctx.shadowBlur = 14;
    this.ctx.beginPath();
    this.ctx.roundRect(cx - 22, cy - 22, 44, 44, 12);
    this.ctx.stroke();
    this.ctx.restore();
  }

  /**
   * 倒计时画面
   */
  private renderCountdown(state: VisibleState): void {
    if (!this.ctx) return;

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

  /**
   * 游戏结束画面
   */
  private renderGameOver(): void {
    if (!this.ctx) return;

    const playerY = this.height - this.cellSize;

    // 先渲染最终游戏画面
    if (this.finalState) {
      // 先渲染路径（显示完整走过的痕迹，向下延伸）
      const lineColor = this.myPlayerColor ? PLAYER_COLOR_MAP[this.myPlayerColor] : '#c9d2e3';
      this.ctx.save();
      this.ctx.strokeStyle = lineColor;
      this.ctx.lineWidth = 5;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.shadowColor = lineColor;
      this.ctx.shadowBlur = 16;
      this.ctx.globalAlpha = 0.9;

      this.ctx.beginPath();
      const currentX = this.offsetX + (this.finalState.currentCol + 0.5) * this.cellSize;
      this.ctx.moveTo(currentX, playerY);

      let drawX = currentX;
      const worldY = this.finalState.worldY;

      for (let i = this.finalState.pathPoints.length - 1; i >= 0; i--) {
        const point = this.finalState.pathPoints[i];
        const screenY = playerY + (worldY - point.worldY) * this.cellSize;

        if (screenY < 0) continue;
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
      } else if (startScreenY > this.height) {
        this.ctx.lineTo(drawX, this.height);
      }

      this.ctx.stroke();
      this.ctx.restore();

      // 再渲染障碍物（在路径上面）
      for (const obs of this.finalState.obstacles) {
        const color = OBSTACLE_COLOR_MAP[obs.color] || '#f4f6fb';
        const screenY = playerY - (obs.worldY - this.finalState.worldY) * this.cellSize;
        const x = this.offsetX + obs.col * this.cellSize;

        if (screenY >= -this.cellSize && screenY < this.height) {
          this.drawObstacle(x, screenY, color);
        }
      }
    }

    // 半透明遮罩
    const veil = this.ctx.createLinearGradient(0, 0, 0, this.height);
    veil.addColorStop(0, 'rgba(8, 10, 15, 0.72)');
    veil.addColorStop(1, 'rgba(8, 10, 15, 0.86)');
    this.ctx.fillStyle = veil;
    this.ctx.fillRect(0, 0, this.width, this.height);

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

  getSize(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }
}
