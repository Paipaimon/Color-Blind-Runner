import { GameState } from '../shared/types.js';
import { GAME_CONFIG } from '../shared/constants.js';
/** Compact game status stays visible even when the mobile lobby HUD is hidden. */
export class SessionHud {
    root = document.getElementById('sessionHud');
    lives = document.getElementById('lives');
    distance = document.getElementById('liveDistance');
    effect = document.getElementById('activeEffect');
    result = document.getElementById('roundResult');
    controls = document.getElementById('mobileControls');
    render(state, playerId, winners) {
        const player = state.players.find(candidate => candidate.id === playerId);
        const playing = state.gameState === GameState.PLAYING;
        if (this.root)
            this.root.hidden = !playing;
        if (this.controls)
            this.controls.hidden = !playing || !player?.isAlive;
        if (this.lives) {
            const count = Math.max(0, Math.min(GAME_CONFIG.MAX_LIVES, player?.lives ?? GAME_CONFIG.MAX_LIVES));
            this.lives.textContent = '♥'.repeat(count) + '♡'.repeat(GAME_CONFIG.MAX_LIVES - count);
            this.lives.setAttribute('aria-label', `剩余 ${count} 条生命`);
        }
        if (this.distance)
            this.distance.textContent = `${(player?.distance ?? 0).toFixed(1)}m`;
        if (this.effect) {
            this.effect.textContent = !player?.isAlive ? '已出局 · 观战中'
                : player.shield ? '◇ 护盾已就绪'
                    : (player.invulnerableFor ?? 0) > 0 ? '受伤保护中' : '同色障碍不可见';
        }
        if (this.result) {
            this.result.hidden = state.gameState !== GameState.GAME_OVER;
            if (winners)
                this.result.textContent = winners.includes(playerId) ? '你是最后幸存者' : '本局结束，再试一次';
        }
    }
}
//# sourceMappingURL=session-hud.js.map