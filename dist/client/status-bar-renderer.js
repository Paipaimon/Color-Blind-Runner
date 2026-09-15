/**
 * 增强状态栏渲染器
 * 显示详细的游戏信息和统计数据，支持移动端响应式布局
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5 - 增强状态栏信息显示
 */
import { GameState } from '../shared/types.js';
import { GAME_CONFIG } from '../shared/constants.js';
/**
 * 增强状态栏渲染器类
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5 - 显示详细游戏信息，支持移动端适配
 */
export class StatusBarRenderer {
    container;
    gameStats;
    isMobile = false;
    deviceInfo;
    animationFrameId = null;
    lastUpdateTime = 0;
    gameStartTime = 0;
    totalMoves = 0;
    maxSpeed = 0;
    personalBest = 0;
    constructor(container) {
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
    detectDeviceInfo() {
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
    loadPersonalBest() {
        try {
            const stored = localStorage.getItem('colorBlindRunner_personalBest');
            this.personalBest = stored ? parseFloat(stored) : 0;
        }
        catch (error) {
            console.warn('无法加载个人最佳成绩:', error);
            this.personalBest = 0;
        }
    }
    /**
     * 保存个人最佳成绩到本地存储
     */
    savePersonalBest(distance) {
        try {
            if (distance > this.personalBest) {
                this.personalBest = distance;
                localStorage.setItem('colorBlindRunner_personalBest', distance.toString());
            }
        }
        catch (error) {
            console.warn('无法保存个人最佳成绩:', error);
        }
    }
    /**
     * 设置移动端模式
     * Requirements: 3.4 - 移动端响应式状态栏布局
     */
    setMobileMode(isMobile) {
        this.isMobile = isMobile;
        this.adjustLayoutForDevice();
    }
    /**
     * 根据设备调整布局
     * Requirements: 3.4 - 移动端响应式状态栏布局
     */
    adjustLayoutForDevice() {
        if (this.isMobile) {
            this.container.classList.add('mobile-layout');
            // 横屏模式下进一步压缩
            if (this.deviceInfo.orientation === 'landscape' && this.deviceInfo.screenHeight < 500) {
                this.container.classList.add('landscape-compact');
            }
            else {
                this.container.classList.remove('landscape-compact');
            }
        }
        else {
            this.container.classList.remove('mobile-layout', 'landscape-compact');
        }
    }
    /**
     * 主渲染方法
     * Requirements: 3.1, 3.2, 3.3 - 显示游戏状态、死亡信息、排名信息
     */
    render(state, playerId, roomId, playerColor) {
        // 更新游戏统计数据
        this.updateGameStatsFromState(state, playerId);
        // 清空容器
        this.container.innerHTML = '';
        // 根据游戏状态渲染不同内容
        switch (state.gameState) {
            case GameState.WAITING:
            case GameState.COUNTDOWN:
                this.renderWaitingState(roomId, playerColor, state.players.length, state);
                break;
            case GameState.PLAYING:
                this.renderPlayingState(roomId, playerColor, state.players.length, state, playerId);
                break;
            case GameState.GAME_OVER:
                this.renderGameOverState(state, playerId);
                break;
        }
        // 应用设备特定的布局调整
        this.adjustLayoutForDevice();
    }
    /**
     * 渲染等待状态
     */
    renderWaitingState(roomId, playerColor, playerCount, state) {
        const basicInfo = this.createBasicInfoSection(roomId, playerColor, playerCount);
        this.container.appendChild(basicInfo);
        // 显示倒计时
        if (state?.countdown !== undefined) {
            const countdownEl = this.createStatItem('倒计时', `${state.countdown}秒`, '⏱️');
            countdownEl.classList.add('countdown-highlight');
            this.container.appendChild(countdownEl);
        }
    }
    /**
     * 渲染游戏进行状态
     * Requirements: 3.1 - 显示距离、存活时间、速度
     */
    renderPlayingState(roomId, playerColor, playerCount, state, playerId) {
        // 基本信息（在移动端可能隐藏部分）
        if (!this.isMobile || this.deviceInfo.orientation === 'portrait') {
            const basicInfo = this.createBasicInfoSection(roomId, playerColor, playerCount);
            this.container.appendChild(basicInfo);
        }
        // 游戏统计信息
        const statsSection = this.createGameStatsSection();
        this.container.appendChild(statsSection);
        // 玩家状态（如果已死亡）
        if (playerId && state) {
            const player = state.players.find(p => p.id === playerId);
            if (player && !player.isAlive) {
                const deathInfo = this.createStatItem('状态', '已死亡', '💀');
                deathInfo.classList.add('death-status');
                this.container.appendChild(deathInfo);
            }
        }
    }
    /**
     * 渲染游戏结束状态
     * Requirements: 3.2, 3.3 - 显示死亡信息（移除排行榜显示）
     */
    renderGameOverState(state, playerId) {
        // 最终统计
        const finalStats = this.createFinalStatsSection();
        this.container.appendChild(finalStats);
        // 个人最佳成绩对比
        const personalBestSection = this.createPersonalBestSection();
        this.container.appendChild(personalBestSection);
        // 保存个人最佳成绩
        this.savePersonalBest(this.gameStats.distance);
    }
    /**
     * 创建基本信息区域
     */
    createBasicInfoSection(roomId, playerColor, playerCount) {
        const section = document.createElement('div');
        section.className = 'status-section basic-info';
        if (roomId) {
            const roomEl = this.createStatItem('房间', roomId.substring(0, 8));
            section.appendChild(roomEl);
        }
        if (playerColor) {
            const colorEl = this.createColorIndicator(playerColor);
            section.appendChild(colorEl);
        }
        if (playerCount !== undefined) {
            const playersEl = this.createStatItem('玩家', `${playerCount}/${GAME_CONFIG.MAX_PLAYERS}`, '👥');
            section.appendChild(playersEl);
        }
        return section;
    }
    /**
     * 创建游戏统计区域
     * Requirements: 3.1 - 显示距离、存活时间（移除速度显示）
     */
    createGameStatsSection() {
        const section = document.createElement('div');
        section.className = 'status-section game-stats';
        // 距离
        const distanceEl = this.createStatItem('距离', `${this.gameStats.distance.toFixed(1)}m`, '📏');
        section.appendChild(distanceEl);
        // 存活时间
        const timeEl = this.createStatItem('时间', this.formatTime(this.gameStats.survivalTime), '⏱️');
        section.appendChild(timeEl);
        // 移除速度显示 - 根据用户要求取消主页的速度信息显示
        return section;
    }
    /**
     * 创建最终统计区域
     * Requirements: 3.2 - 显示最终统计数据（移除最高速度显示）
     */
    createFinalStatsSection() {
        const section = document.createElement('div');
        section.className = 'status-section final-stats';
        const title = document.createElement('div');
        title.className = 'section-title';
        title.textContent = '最终成绩';
        section.appendChild(title);
        const distanceEl = this.createStatItem('最终距离', `${this.gameStats.distance.toFixed(1)}m`, '🏁');
        const timeEl = this.createStatItem('存活时间', this.formatTime(this.gameStats.survivalTime), '⏱️');
        const movesEl = this.createStatItem('移动次数', this.gameStats.totalMoves.toString(), '🎮');
        section.appendChild(distanceEl);
        section.appendChild(timeEl);
        section.appendChild(movesEl);
        return section;
    }
    /**
     * 创建排名区域
     * Requirements: 3.3 - 显示排名信息
     */
    createRankingSection(ranking, playerId) {
        const section = document.createElement('div');
        section.className = 'status-section ranking';
        const title = document.createElement('div');
        title.className = 'section-title';
        title.textContent = '排行榜';
        section.appendChild(title);
        ranking.forEach((player, index) => {
            const rankItem = document.createElement('div');
            rankItem.className = 'rank-item';
            if (player.playerId === playerId) {
                rankItem.classList.add('my-rank');
            }
            const rankNumber = document.createElement('span');
            rankNumber.className = 'rank-number';
            rankNumber.textContent = `#${player.rank}`;
            const colorDot = document.createElement('span');
            colorDot.className = `color-dot color-${player.playerColor.toLowerCase()}`;
            const distance = document.createElement('span');
            distance.className = 'rank-distance';
            distance.textContent = `${player.distance.toFixed(1)}m`;
            const time = document.createElement('span');
            time.className = 'rank-time';
            time.textContent = this.formatTime(player.survivalTime);
            rankItem.appendChild(rankNumber);
            rankItem.appendChild(colorDot);
            rankItem.appendChild(distance);
            rankItem.appendChild(time);
            section.appendChild(rankItem);
        });
        return section;
    }
    /**
     * 创建个人最佳成绩区域
     * Requirements: 3.3 - 个人最佳成绩对比
     */
    createPersonalBestSection() {
        const section = document.createElement('div');
        section.className = 'status-section personal-best';
        const currentDistance = this.gameStats.distance;
        const isNewRecord = currentDistance > this.personalBest;
        if (isNewRecord) {
            const newRecordEl = this.createStatItem('新纪录!', `${currentDistance.toFixed(1)}m`, '🎉');
            newRecordEl.classList.add('new-record');
            section.appendChild(newRecordEl);
        }
        else {
            const bestEl = this.createStatItem('个人最佳', `${this.personalBest.toFixed(1)}m`, '🏆');
            const diffEl = this.createStatItem('差距', `${(this.personalBest - currentDistance).toFixed(1)}m`, '📊');
            section.appendChild(bestEl);
            section.appendChild(diffEl);
        }
        return section;
    }
    /**
     * 创建颜色指示器
     */
    createColorIndicator(color) {
        const item = document.createElement('div');
        item.className = 'status-item color-indicator';
        const label = document.createElement('span');
        label.className = 'status-label';
        label.textContent = '颜色:';
        const dot = document.createElement('span');
        dot.className = `color-dot color-${color.toLowerCase()}`;
        item.appendChild(label);
        item.appendChild(dot);
        return item;
    }
    /**
     * 创建统计项目元素
     */
    createStatItem(label, value, icon) {
        const item = document.createElement('div');
        item.className = 'status-item';
        const labelEl = document.createElement('span');
        labelEl.className = 'status-label';
        labelEl.textContent = icon ? `${icon} ${label}:` : `${label}:`;
        const valueEl = document.createElement('span');
        valueEl.className = 'status-value';
        valueEl.textContent = value;
        item.appendChild(labelEl);
        item.appendChild(valueEl);
        return item;
    }
    /**
     * 从游戏状态更新统计数据
     * Requirements: 3.1 - 实时更新游戏统计
     */
    updateGameStatsFromState(state, playerId) {
        const currentTime = Date.now();
        // 游戏开始时记录开始时间
        if (state.gameState === GameState.PLAYING && this.gameStartTime === 0) {
            this.gameStartTime = currentTime;
            this.lastUpdateTime = currentTime;
        }
        // 重置统计（游戏重新开始）
        if (state.gameState === GameState.WAITING) {
            this.gameStartTime = 0;
            this.totalMoves = 0;
            this.maxSpeed = 0;
            this.gameStats = {
                distance: 0,
                survivalTime: 0,
                averageSpeed: 0,
                maxSpeed: 0,
                totalMoves: 0
            };
            return;
        }
        // 计算存活时间
        if (this.gameStartTime > 0) {
            this.gameStats.survivalTime = (currentTime - this.gameStartTime) / 1000;
        }
        // 查找当前玩家
        const player = state.players.find(p => p.id === playerId);
        if (player && player.distance !== undefined) {
            this.gameStats.distance = player.distance;
        }
        // 计算速度（基于滚动速度和时间差）
        if (state.scrollSpeed > 0) {
            const currentSpeed = state.scrollSpeed;
            this.gameStats.averageSpeed = currentSpeed;
            if (currentSpeed > this.maxSpeed) {
                this.maxSpeed = currentSpeed;
                this.gameStats.maxSpeed = this.maxSpeed;
            }
        }
        this.lastUpdateTime = currentTime;
    }
    /**
     * 计算玩家排名
     * Requirements: 3.3 - 排名计算
     */
    calculatePlayerRanking(players) {
        const ranking = players
            .map(player => ({
            playerId: player.id,
            playerColor: player.color,
            distance: player.distance || 0,
            survivalTime: 0, // 这里需要从其他地方获取，暂时设为0
            rank: 0
        }))
            .sort((a, b) => b.distance - a.distance)
            .map((player, index) => ({
            ...player,
            rank: index + 1
        }));
        return ranking;
    }
    /**
     * 格式化时间显示
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        if (mins > 0) {
            return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
        }
        else {
            return `${secs}.${ms.toString().padStart(2, '0')}s`;
        }
    }
    /**
     * 更新游戏统计数据（外部调用）
     */
    updateGameStats(stats) {
        this.gameStats = { ...this.gameStats, ...stats };
    }
    /**
     * 增加移动次数计数
     */
    incrementMoveCount() {
        this.totalMoves++;
        this.gameStats.totalMoves = this.totalMoves;
    }
    /**
     * 启动平滑动画更新
     * Requirements: 3.5 - 平滑动画过渡效果
     */
    startAnimation() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        const animate = () => {
            // 这里可以添加平滑的数值过渡动画
            // 目前主要用于定期更新时间显示
            this.animationFrameId = requestAnimationFrame(animate);
        };
        animate();
    }
    /**
     * 停止动画更新
     */
    stopAnimation() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
    /**
     * 销毁渲染器，清理资源
     */
    destroy() {
        this.stopAnimation();
        window.removeEventListener('orientationchange', this.adjustLayoutForDevice);
        window.removeEventListener('resize', this.adjustLayoutForDevice);
    }
}
//# sourceMappingURL=status-bar-renderer.js.map