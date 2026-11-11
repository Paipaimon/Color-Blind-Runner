import { GameState } from '../shared/types.js';
import { GAME_CONFIG } from '../shared/constants.js';
import { ROUND_MAX_DISTANCE, ROUND_PHASES } from '../shared/round-rules.js';
const COLOR_NAMES = { RED: '红色', BLUE: '蓝色', GREEN: '绿色', YELLOW: '黄色' };
const ROUTE_NAMES = ['左路', '中路', '右路'];
export class SessionHud {
    root = document.getElementById('sessionHud');
    lives = document.getElementById('lives');
    distance = document.getElementById('liveDistance');
    effect = document.getElementById('activeEffect');
    result = document.getElementById('roundResult');
    review = document.getElementById('roundReview');
    controls = document.getElementById('mobileControls');
    phase = document.getElementById('roundPhase');
    goal = document.getElementById('roundGoal');
    meta = document.getElementById('roundMeta');
    warning = document.getElementById('teamWarning');
    warningTimer;
    previousBest = 0;
    beginRound() {
        try {
            const stored = Number(localStorage.getItem('colorBlindRunner_personalBest'));
            this.previousBest = Number.isFinite(stored) ? Math.max(0, stored) : 0;
        }
        catch {
            this.previousBest = 0;
        }
        this.clearWarning();
    }
    clearWarning() {
        window.clearTimeout(this.warningTimer);
        if (this.warning)
            this.warning.hidden = true;
    }
    showWarning(warning, playerId) {
        if (!this.warning)
            return;
        this.clearWarning();
        this.warning.textContent = warning.toPlayerId === playerId
            ? `${COLOR_NAMES[warning.fromColor]}队友提醒 · ${ROUTE_NAMES[warning.route]}危险`
            : `已提醒${COLOR_NAMES[warning.toColor]}队友 · ${ROUTE_NAMES[warning.route]}`;
        this.warning.hidden = false;
        this.warningTimer = window.setTimeout(() => {
            if (this.warning)
                this.warning.hidden = true;
        }, warning.durationMs);
    }
    render(state, playerId, winners) {
        const player = state.players.find(candidate => candidate.id === playerId);
        const playing = state.gameState === GameState.PLAYING;
        if (this.root)
            this.root.hidden = !playing;
        if (this.meta)
            this.meta.hidden = !playing;
        if (this.controls)
            this.controls.hidden = !playing || !player?.isAlive;
        if (!playing)
            this.clearWarning();
        if (this.lives) {
            const count = Math.max(0, Math.min(GAME_CONFIG.MAX_LIVES, player?.lives ?? GAME_CONFIG.MAX_LIVES));
            this.lives.textContent = '♥'.repeat(count) + '♡'.repeat(GAME_CONFIG.MAX_LIVES - count);
            this.lives.setAttribute('aria-label', `剩余 ${count} 条生命`);
        }
        const distance = player?.distance ?? 0;
        const target = Math.min(ROUND_MAX_DISTANCE, Math.max(30, Math.floor(this.previousBest) + 1));
        if (this.distance)
            this.distance.textContent = `${distance.toFixed(1)}m`;
        if (this.phase) {
            const phase = ROUND_PHASES.find(candidate => candidate.id === state.phase);
            this.phase.textContent = `${phase?.label ?? '热身'} · 剩余 ${Math.ceil(state.remainingSeconds ?? 90)}s`;
        }
        if (this.goal)
            this.goal.textContent = distance + 0.01 >= target
                ? '本局目标已达成' : `目标 ${target}m · 还差 ${Math.max(0, target - distance).toFixed(1)}m`;
        if (this.effect) {
            this.effect.textContent = !player?.isAlive ? '已出局 · 观战中'
                : player.shield ? '◇ 护盾已就绪'
                    : (player.invulnerableFor ?? 0) > 0 ? '受伤保护中' : '点按障碍提醒队友';
        }
        if (this.result) {
            this.result.hidden = state.gameState !== GameState.GAME_OVER;
            if (winners)
                this.result.textContent = winners.includes(playerId)
                    ? state.endReason === 'time_limit' ? '完成 90 秒挑战！' : '你是最后幸存者'
                    : '本局结束，再试一次';
        }
        if (this.review) {
            this.review.hidden = state.gameState !== GameState.GAME_OVER;
            if (winners) {
                const progress = distance > this.previousBest + 0.01
                    ? `新纪录！比此前最佳多 ${Math.max(0, distance - this.previousBest).toFixed(1)}m`
                    : this.previousBest > distance + 0.01
                        ? `距离个人最佳还差 ${(this.previousBest - distance).toFixed(1)}m`
                        : '追平个人最佳';
                const damage = player?.lastDamage;
                const lesson = damage ? `最后受伤在${ROUTE_NAMES[damage.route]} ${damage.distance.toFixed(1)}m 处` : '本局没有损失生命';
                this.review.textContent = `${progress}。${lesson}。已提醒队友 ${player?.warningsSent ?? 0} 次。`;
            }
        }
    }
}
//# sourceMappingURL=session-hud.js.map