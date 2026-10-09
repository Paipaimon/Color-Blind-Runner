/**
 * 增强状态栏渲染器
 * 显示详细的游戏信息和统计数据，支持移动端响应式布局
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5 - 增强状态栏信息显示
 *
 * 实现要点（本次 UI 重构）：
 * - DOM 结构在构造时一次性建立并按数据槽（data-slot）缓存，渲染时只增量更新文本与类名，
 *   避免旧实现每帧 innerHTML 重建导致的样式抖动与性能浪费。
 * - 对外的公开方法签名保持不变，index.ts / viewport-manager.ts 无需感知内部变化。
 */

import { VisibleState, GameState, PlayerColor } from '../shared/types.js';
import { GAME_CONFIG } from '../shared/constants.js';

/**
 * 游戏统计数据接口
 */
export interface GameStats {
  distance: number;        // 当前距离
  survivalTime: number;    // 存活时间（秒）
  averageSpeed: number;    // 平均速度
  maxSpeed: number;        // 最大速度
  totalMoves: number;      // 总移动次数
  deathReason?: string;    // 死亡原因
  personalBest?: number;   // 个人最佳距离
}

/**
 * 玩家排名信息接口
 */
export interface PlayerRanking {
  playerId: string;
  playerColor: PlayerColor;
  distance: number;
  survivalTime: number;
  rank: number;
}

/**
 * 设备信息接口
 */
export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
  orientation: 'portrait' | 'landscape';
}

/** 状态栏布局模式：不同游戏阶段呈现不同的信息密度 */
type BarLayout = 'idle' | 'playing' | 'finished';

/** 颜色中文名（仅用于展示自身颜色，不泄露任何障碍物信息） */
const COLOR_LABEL: Record<PlayerColor, string> = {
  [PlayerColor.RED]: '红',
  [PlayerColor.GREEN]: '绿',
  [PlayerColor.BLUE]: '蓝',
  [PlayerColor.YELLOW]: '黄'
};

/** 颜色对应的 CSS 修饰类 */
const COLOR_CLASS: Record<PlayerColor, string> = {
  [PlayerColor.RED]: 'color-red',
  [PlayerColor.GREEN]: 'color-green',
  [PlayerColor.BLUE]: 'color-blue',
  [PlayerColor.YELLOW]: 'color-yellow'
};

/**
 * 增强状态栏渲染器类
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5 - 显示详细游戏信息，支持移动端适配
 */
export class StatusBarRenderer {
  private container: HTMLElement;
  private gameStats: GameStats;
  private isMobile: boolean = false;
  private deviceInfo: DeviceInfo;
  private animationFrameId: number | null = null;
  private gameStartTime: number = 0;
  private totalMoves: number = 0;
  private maxSpeed: number = 0;
  private personalBest: number = 0;
  private bestSaved: boolean = false;

  /** 当前渲染的布局模式，用于判断是否需要重建区块结构 */
  private layout: BarLayout = 'idle';

  /** 自身颜色（由 render 传入并记忆，供结束态复用） */
  private myPlayerColor: PlayerColor | null = null;

  /** 房间花名册：在线与已准备人数（由 updateRoster 从服务端广播维护） */
  private onlineIds: Set<string> = new Set();
  private readyIds: Set<string> = new Set();

  /** DOM 数据槽缓存 */
  private rootSection: HTMLElement | null = null;
  private roomChip: HTMLElement | null = null;
  private pipsWrap: HTMLElement | null = null;
  private onlineValue: HTMLElement | null = null;
  private readyValue: HTMLElement | null = null;
  private playingValue: HTMLElement | null = null;
  private colorDot: HTMLElement | null = null;
  private colorValue: HTMLElement | null = null;
  private statePill: HTMLElement | null = null;
  private statsSection: HTMLElement | null = null;
  private distanceValue: HTMLElement | null = null;
  private timeValue: HTMLElement | null = null;
  private resultSection: HTMLElement | null = null;
  private bestSection: HTMLElement | null = null;

  /** 上一次写入的文本，避免重复赋值触发重排 */
  private lastText: Map<string, string> = new Map();

  constructor(container: HTMLElement) {
    this.container = container;
    this.gameStats = {
      distance: 0,
      survivalTime: 0,
      averageSpeed: 0,
      maxSpeed: 0,
      totalMoves: 0
    };

    // 检测设备信息
    this.deviceInfo = this.detectDeviceInfo();
    this.isMobile = this.deviceInfo.isMobile || this.deviceInfo.isTablet;

    // 从本地存储加载个人最佳成绩
    this.loadPersonalBest();

    // 构建基础骨架
    this.applyLayout('idle');

    // 监听方向变化
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.deviceInfo = this.detectDeviceInfo();
        this.adjustLayoutForDevice();
      }, 100);
    });

    // 监听窗口大小变化
    window.addEventListener('resize', () => {
      this.deviceInfo = this.detectDeviceInfo();
      this.adjustLayoutForDevice();
    });
  }

  /**
   * 检测设备信息
   * Requirements: 3.4 - 移动端响应式状态栏布局
   */
  private detectDeviceInfo(): DeviceInfo {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const isTablet = /ipad|android(?!.*mobile)/i.test(userAgent);

    return {
      isMobile: isMobile && !isTablet,
      isTablet,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      pixelRatio: window.devicePixelRatio || 1,
      orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
    };
  }

  /**
   * 从本地存储加载个人最佳成绩
   */
  private loadPersonalBest(): void {
    try {
      const stored = localStorage.getItem('colorBlindRunner_personalBest');
      this.personalBest = stored ? parseFloat(stored) : 0;
      if (!Number.isFinite(this.personalBest)) {
        this.personalBest = 0;
      }
    } catch (error) {
      console.warn('无法加载个人最佳成绩:', error);
      this.personalBest = 0;
    }
  }

  /**
   * 保存个人最佳成绩到本地存储
   */
  private savePersonalBest(distance: number): void {
    try {
      if (distance > this.personalBest) {
        this.personalBest = distance;
        localStorage.setItem('colorBlindRunner_personalBest', distance.toString());
      }
    } catch (error) {
      console.warn('无法保存个人最佳成绩:', error);
    }
  }

  /**
   * 设置移动端模式
   * Requirements: 3.4 - 移动端响应式状态栏布局
   */
  setMobileMode(isMobile: boolean): void {
    this.isMobile = isMobile;
    this.adjustLayoutForDevice();
  }

  /**
   * 根据设备调整布局
   * Requirements: 3.4 - 移动端响应式状态栏布局
   */
  private adjustLayoutForDevice(): void {
    if (this.isMobile) {
      this.container.classList.add('mobile-layout');

      // 横屏模式下进一步压缩
      if (this.deviceInfo.orientation === 'landscape' && this.deviceInfo.screenHeight < 500) {
        this.container.classList.add('landscape-compact');
      } else {
        this.container.classList.remove('landscape-compact');
      }
    } else {
      this.container.classList.remove('mobile-layout', 'landscape-compact');
    }
  }

  /**
   * 更新房间花名册（在线人数 / 已准备人数）
   * 数据来自服务端广播（ROOM_JOINED / PLAYER_JOINED / PLAYER_LEFT）与本地准备动作，
   * 仅用于界面呈现，不参与任何规则判定。
   *
   * @param onlineIds 当前在线玩家ID
   * @param readyIds 当前已准备玩家ID
   */
  updateRoster(onlineIds: Iterable<string>, readyIds: Iterable<string>): void {
    this.onlineIds = new Set(onlineIds);
    this.readyIds = new Set(readyIds);

    if (this.onlineValue) {
      this.setText(this.onlineValue, `${this.onlineCount}/${GAME_CONFIG.MAX_PLAYERS}`);
    }
    if (this.readyValue) {
      this.setText(this.readyValue, `${this.readyCount}/${GAME_CONFIG.MAX_PLAYERS}`);
    }
    if (this.pipsWrap) {
      const pips = this.pipsWrap.children;
      for (let i = 0; i < pips.length; i++) {
        (pips[i] as HTMLElement).classList.toggle('filled', i < this.onlineCount);
      }
    }
  }

  /** 在线人数 */
  private get onlineCount(): number {
    return this.onlineIds.size;
  }

  /** 已准备人数（只统计仍在线的玩家） */
  private get readyCount(): number {
    let count = 0;
    for (const id of this.readyIds) {
      if (this.onlineIds.has(id)) count++;
    }
    return count;
  }

  /**
   * 主渲染方法
   * Requirements: 3.1, 3.2, 3.3 - 显示游戏状态、死亡信息
   */
  render(state: VisibleState, playerId: string, roomId?: string, playerColor?: PlayerColor): void {
    if (playerColor) {
      this.myPlayerColor = playerColor;
    }

    // 更新游戏统计数据
    this.updateGameStatsFromState(state, playerId);

    // 等待/倒计时统一按大厅态呈现
    const targetLayout: BarLayout =
      state.gameState === GameState.PLAYING ? 'playing'
        : state.gameState === GameState.GAME_OVER ? 'finished'
          : 'idle';

    this.applyLayout(targetLayout);

    // 基础信息区（房间号 / 在线人数 / 已准备人数 / 游玩人数）
    this.updateBasicInfo(roomId, playerColor, state.players.length);

    // 状态胶囊
    this.updateStatePill(state, playerId);

    // 数值区
    this.refreshValueSlots();

    // 结束时额外渲染个人最佳对比
    if (targetLayout === 'finished') {
      this.renderPersonalBestSection();
    }

    // 应用设备特定的布局调整
    this.adjustLayoutForDevice();
  }

  /**
   * 构建 / 切换状态栏骨架
   * 仅在布局模式变化时重建节点，其余情况复用已有 DOM
   */
  private applyLayout(layout: BarLayout): void {
    if (this.layout === layout && this.statsSection) {
      return;
    }

    this.layout = layout;
    this.clearSlotCache();

    // —— 左：当前阶段最关心的一个数值 ——
    const statsSection = document.createElement('div');
    statsSection.className = 'status-section game-stats';

    if (layout === 'idle') {
      // 人数用圆点表示占用，避免与"已准备"混淆
      const onlineItem = document.createElement('div');
      onlineItem.className = 'status-item';
      onlineItem.dataset.slot = 'online-count';

      const onlineLabel = document.createElement('span');
      onlineLabel.className = 'status-label';
      onlineLabel.textContent = '在线人数';

      const pipsWrap = document.createElement('span');
      pipsWrap.className = 'player-pips';
      for (let i = 0; i < GAME_CONFIG.MAX_PLAYERS; i++) {
        pipsWrap.appendChild(document.createElement('i'));
      }

      const onlineValue = document.createElement('span');
      onlineValue.className = 'status-value mono';
      onlineValue.dataset.slot = 'online-count-value';

      onlineItem.appendChild(onlineLabel);
      onlineItem.appendChild(pipsWrap);
      onlineItem.appendChild(onlineValue);
      statsSection.appendChild(onlineItem);

      this.pipsWrap = pipsWrap;
      this.onlineValue = onlineValue;

      // 已准备人数
      const readyItem = this.createValueItem('已准备', 'ready-count', 'mono');
      readyItem.root.classList.add('ready-item');
      statsSection.appendChild(readyItem.root);
      this.readyValue = readyItem.value;
    } else {
      // 开局后：显示游玩人数与实时数值
      const playingItem = this.createValueItem('游玩人数', 'playing-count', 'mono');
      statsSection.appendChild(playingItem.root);
      this.playingValue = playingItem.value;

      const distanceItem = this.createValueItem('距离', 'stat-distance', 'mono lg');
      const timeItem = this.createValueItem('时间', 'stat-time', 'mono lg');
      statsSection.appendChild(distanceItem.root);
      statsSection.appendChild(timeItem.root);
      this.distanceValue = distanceItem.value;
      this.timeValue = timeItem.value;
    }

    this.statsSection = statsSection;

    // —— 中：房间信息（房号；对局中隐藏，改由 updateBasicInfo 决定） ——
    const rootSection = document.createElement('div');
    rootSection.className = 'status-section basic-info';
    this.roomChip = null;

    // —— 右：状态胶囊 ——
    const statePill = document.createElement('span');
    statePill.className = 'state-pill';
    statePill.dataset.tone = 'wait';
    statePill.textContent = '准备中';

    // —— 组装 ——
    this.container.innerHTML = '';
    this.container.appendChild(rootSection);
    this.container.appendChild(statsSection);
    this.container.appendChild(statePill);
    this.rootSection = rootSection;
    this.statePill = statePill;

    // 完成态：最终成绩 + 个人最佳
    if (layout === 'finished') {
      this.resultSection = this.createResultSection();
      this.bestSection = document.createElement('div');
      this.bestSection.className = 'status-section personal-best';
      this.container.appendChild(this.resultSection);
      this.container.appendChild(this.bestSection);
    }

    this.container.classList.toggle('is-playing', layout === 'playing');
  }

  /**
   * 创建「标签 + 数值」的统计单元
   */
  private createValueItem(label: string, slot: string, extraClass?: string): { root: HTMLElement; value: HTMLElement } {
    const root = document.createElement('div');
    root.className = 'status-item';
    root.dataset.slot = slot;

    const labelEl = document.createElement('span');
    labelEl.className = 'status-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = extraClass ? `status-value ${extraClass}` : 'status-value';
    valueEl.dataset.slot = `${slot}-value`;

    root.appendChild(labelEl);
    root.appendChild(valueEl);
    return { root, value: valueEl };
  }

  /**
   * 创建最终成绩区块
   */
  private createResultSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'status-section result-stats';

    const distance = this.createValueItem('最终距离', 'result-distance', 'mono lg');
    const time = this.createValueItem('存活时间', 'result-time', 'mono');
    const moves = this.createValueItem('移动次数', 'result-moves', 'mono');

    section.appendChild(distance.root);
    section.appendChild(time.root);
    section.appendChild(moves.root);
    return section;
  }

  /**
   * 更新基础信息区（房间号 / 在线人数 / 已准备人数 / 游玩人数）
   * 用最少的数字回答"现在有几个人、准备了多少、几人在玩"。
   */
  private updateBasicInfo(roomId?: string, playerColor?: PlayerColor, playerCount?: number): void {
    if (!this.rootSection) return;

    // 房间号仅在大厅需要（供玩家口头约房），对局中让位给实时数值
    if (roomId && this.layout === 'idle') {
      if (!this.roomChip) {
        const roomItem = document.createElement('div');
        roomItem.className = 'status-item';
        const chip = document.createElement('span');
        chip.className = 'room-chip';
        chip.dataset.slot = 'room-id';
        chip.textContent = roomId.substring(0, 8);
        roomItem.appendChild(chip);
        this.rootSection.appendChild(roomItem);
        this.roomChip = chip;
      } else {
        this.setText(this.roomChip, roomId.substring(0, 8));
      }
    }

    // 对局中隐藏房间号，保持状态栏只呈现当前最关心的数字
    if (this.roomChip && this.layout !== 'idle') {
      this.roomChip.parentElement?.classList.add('hidden');
    } else if (this.roomChip) {
      this.roomChip.parentElement?.classList.remove('hidden');
    }

    // 数值槽各自独立更新（布局重建后槽引用会刷新）
    if (this.onlineValue) {
      this.setText(this.onlineValue, `${this.onlineCount}/${GAME_CONFIG.MAX_PLAYERS}`);
    }
    if (this.readyValue) {
      this.setText(this.readyValue, `${this.readyCount}/${GAME_CONFIG.MAX_PLAYERS}`);
    }
    if (this.playingValue && playerCount !== undefined) {
      this.setText(this.playingValue, `${playerCount}/${GAME_CONFIG.MAX_PLAYERS}`);
    }

    // 自身颜色：小圆点 + 颜色名（仅对局中展示，大厅由"我的颜色"提示承担）
    if (playerColor && this.layout !== 'idle') {
      const colorClass = COLOR_CLASS[playerColor];
      if (!this.colorDot) {
        const colorItem = document.createElement('div');
        colorItem.className = 'status-item color-indicator compact';

        const dot = document.createElement('span');
        dot.className = `color-dot ${colorClass}`;

        const value = document.createElement('span');
        value.className = 'status-value';
        value.dataset.slot = 'color-value';
        value.textContent = COLOR_LABEL[playerColor];

        colorItem.appendChild(dot);
        colorItem.appendChild(value);
        this.rootSection.appendChild(colorItem);

        this.colorDot = dot;
        this.colorValue = value;
      } else {
        this.colorDot.className = `color-dot ${colorClass}`;
        if (this.colorValue) {
          this.setText(this.colorValue, COLOR_LABEL[playerColor]);
        }
      }
    }

    // 在线人数的占用点位
    if (this.pipsWrap) {
      const pips = this.pipsWrap.children;
      for (let i = 0; i < pips.length; i++) {
        (pips[i] as HTMLElement).classList.toggle('filled', i < this.onlineCount);
      }
    }
  }

  /**
   * 更新状态胶囊：等待 / 倒计时 / 进行中 / 已死亡 / 结束
   */
  private updateStatePill(state: VisibleState, playerId: string): void {
    if (!this.statePill) return;

    let text = '准备中';
    let tone = 'wait';

    switch (state.gameState) {
      case GameState.WAITING:
        // 人数达标且全员准备 → 即将开始；人数达标 → 可准备；否则继续等人
        if (this.onlineCount >= GAME_CONFIG.MIN_PLAYERS && this.readyCount >= this.onlineCount) {
          text = '即将开始';
          tone = 'ready';
        } else if (this.onlineCount >= GAME_CONFIG.MIN_PLAYERS) {
          text = '可准备';
          tone = 'wait';
        } else {
          text = '等待玩家';
          tone = 'wait';
        }
        break;

      case GameState.COUNTDOWN:
        text = `倒计时 ${state.countdown ?? GAME_CONFIG.COUNTDOWN_SECONDS}`;
        tone = 'ready';
        break;

      case GameState.PLAYING: {
        const me = state.players.find(p => p.id === playerId);
        if (me && !me.isAlive) {
          text = '已死亡 · 观战';
          tone = 'danger';
        } else {
          text = '进行中';
          tone = 'play';
        }
        break;
      }

      case GameState.GAME_OVER:
        text = '本局结束';
        tone = 'danger';
        break;
    }

    this.setText(this.statePill, text);
    if (this.statePill.dataset.tone !== tone) {
      this.statePill.dataset.tone = tone;
    }
  }

  /**
   * 刷新数值槽（距离 / 时间 / 最终成绩）
   * Requirements: 3.1 - 显示距离、存活时间
   */
  private refreshValueSlots(): void {
    const distanceText = `${this.gameStats.distance.toFixed(1)}m`;
    const timeText = this.formatTime(this.gameStats.survivalTime);

    if (this.distanceValue) {
      this.setText(this.distanceValue, distanceText);
    }
    if (this.timeValue) {
      this.setText(this.timeValue, timeText);
    }

    // 存活时间动画只更新同一数值槽，避免重复查找
    if (this.resultSection) {
      const slotDistance = this.resultSection.querySelector('[data-slot="result-distance-value"]');
      const slotTime = this.resultSection.querySelector('[data-slot="result-time-value"]');
      const slotMoves = this.resultSection.querySelector('[data-slot="result-moves-value"]');
      if (slotDistance) this.setText(slotDistance as HTMLElement, distanceText);
      if (slotTime) this.setText(slotTime as HTMLElement, timeText);
      if (slotMoves) this.setText(slotMoves as HTMLElement, this.gameStats.totalMoves.toString());
    }
  }

  /**
   * 渲染个人最佳对比
   * Requirements: 3.3 - 个人最佳成绩对比
   */
  private renderPersonalBestSection(): void {
    if (!this.bestSection) return;

    const currentDistance = this.gameStats.distance;
    const isNewRecord = currentDistance > 0 && currentDistance > this.personalBest;

    this.bestSection.innerHTML = '';
    this.lastText.clear();

    if (isNewRecord) {
      const record = this.createStatItem('新纪录', `${currentDistance.toFixed(1)}m`, '🎉');
      record.classList.add('new-record');
      this.bestSection.appendChild(record);
    } else {
      const best = this.createStatItem('个人最佳', `${this.personalBest.toFixed(1)}m`, '🏆');
      const diff = this.createStatItem('差距', `${Math.max(0, this.personalBest - currentDistance).toFixed(1)}m`, '📊');
      this.bestSection.appendChild(best);
      this.bestSection.appendChild(diff);
    }

    // 仅在进入结束态时写一次本地存储
    if (!this.bestSaved) {
      this.savePersonalBest(currentDistance);
      this.bestSaved = true;
    }
  }

  /**
   * 创建统计项目元素
   */
  private createStatItem(label: string, value: string, icon?: string): HTMLElement {
    const item = document.createElement('div');
    item.className = 'status-item';

    const labelEl = document.createElement('span');
    labelEl.className = 'status-label';
    labelEl.textContent = icon ? `${icon} ${label}` : label;

    const valueEl = document.createElement('span');
    valueEl.className = 'status-value mono';
    valueEl.textContent = value;

    item.appendChild(labelEl);
    item.appendChild(valueEl);

    return item;
  }

  /**
   * 创建颜色指示器（保留旧接口，供外部复用）
   */
  private createColorIndicator(color: PlayerColor): HTMLElement {
    const item = document.createElement('div');
    item.className = 'status-item color-indicator';

    const label = document.createElement('span');
    label.className = 'status-label';
    label.textContent = '我的颜色';

    const dot = document.createElement('span');
    dot.className = `color-dot ${COLOR_CLASS[color]}`;

    const value = document.createElement('span');
    value.className = 'status-value';
    value.textContent = COLOR_LABEL[color];

    item.appendChild(label);
    item.appendChild(dot);
    item.appendChild(value);

    return item;
  }

  /**
   * 从游戏状态更新统计数据
   * Requirements: 3.1 - 实时更新游戏统计
   */
  private updateGameStatsFromState(state: VisibleState, playerId: string): void {
    const currentTime = Date.now();

    // 重开一局：重置统计
    if (state.gameState === GameState.WAITING) {
      if (this.gameStartTime !== 0 || this.gameStats.totalMoves !== 0 || this.gameStats.distance !== 0) {
        this.gameStartTime = 0;
        this.totalMoves = 0;
        this.maxSpeed = 0;
        this.bestSaved = false;
        this.gameStats = {
          distance: 0,
          survivalTime: 0,
          averageSpeed: 0,
          maxSpeed: 0,
          totalMoves: 0
        };
      }
      return;
    }

    // 游戏开始时记录开始时间
    if (state.gameState === GameState.PLAYING && this.gameStartTime === 0) {
      this.gameStartTime = currentTime;
    }

    // 计算存活时间（结束后冻结为最终值）
    if (this.gameStartTime > 0 && state.gameState === GameState.PLAYING) {
      this.gameStats.survivalTime = (currentTime - this.gameStartTime) / 1000;
    }

    // 查找当前玩家
    const player = state.players.find(p => p.id === playerId);
    if (player && player.distance !== undefined) {
      this.gameStats.distance = player.distance;
    }

    // 记录滚动速度峰值（内部统计，不直接展示）
    if (state.scrollSpeed > 0) {
      this.gameStats.averageSpeed = state.scrollSpeed;
      if (state.scrollSpeed > this.maxSpeed) {
        this.maxSpeed = state.scrollSpeed;
        this.gameStats.maxSpeed = this.maxSpeed;
      }
    }
  }

  /**
   * 计算玩家排名（保留接口能力，当前界面不展示排行榜）
   * Requirements: 3.3 - 排名计算
   */
  private calculatePlayerRanking(players: VisibleState['players']): PlayerRanking[] {
    return players
      .map(player => ({
        playerId: player.id,
        playerColor: player.color,
        distance: player.distance || 0,
        survivalTime: 0,
        rank: 0
      }))
      .sort((a, b) => b.distance - a.distance)
      .map((player, index) => ({
        ...player,
        rank: index + 1
      }));
  }

  /**
   * 格式化时间显示
   */
  private formatTime(seconds: number): string {
    const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
    const mins = Math.floor(safe / 60);
    const secs = Math.floor(safe % 60);
    const ms = Math.floor((safe % 1) * 100);

    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
    return `${secs}.${ms.toString().padStart(2, '0')}s`;
  }

  /**
   * 文本写入（带脏检查）
   */
  private setText(el: HTMLElement, text: string): void {
    const key = el.dataset.slot || el.className;
    if (this.lastText.get(key) === text) {
      return;
    }
    this.lastText.set(key, text);
    el.textContent = text;
  }

  /**
   * 清空文本缓存（结构重建后调用）
   */
  private clearSlotCache(): void {
    this.lastText.clear();
    this.rootSection = null;
    this.roomChip = null;
    this.pipsWrap = null;
    this.onlineValue = null;
    this.readyValue = null;
    this.playingValue = null;
    this.colorDot = null;
    this.colorValue = null;
    this.statePill = null;
    this.statsSection = null;
    this.distanceValue = null;
    this.timeValue = null;
    this.resultSection = null;
    this.bestSection = null;
  }

  /**
   * 更新游戏统计数据（外部调用）
   */
  updateGameStats(stats: Partial<GameStats>): void {
    this.gameStats = { ...this.gameStats, ...stats };
  }

  /**
   * 增加移动次数计数
   */
  incrementMoveCount(): void {
    this.totalMoves++;
    this.gameStats.totalMoves = this.totalMoves;
  }

  /**
   * 启动平滑动画更新
   * Requirements: 3.5 - 平滑动画过渡效果
   * 仅刷新时间槽，不重建任何 DOM
   */
  startAnimation(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    const animate = () => {
      if (this.timeValue && this.gameStartTime > 0 && this.layout === 'playing') {
        const elapsed = (Date.now() - this.gameStartTime) / 1000;
        this.setText(this.timeValue, this.formatTime(elapsed));
      }
      this.animationFrameId = requestAnimationFrame(animate);
    };

    animate();
  }

  /**
   * 停止动画更新
   */
  stopAnimation(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * 销毁渲染器，清理资源
   */
  destroy(): void {
    this.stopAnimation();
    this.clearSlotCache();
    this.container.innerHTML = '';
  }
}
