import { VisibleState } from '../shared/types.js';
import { TeamWarning } from '../shared/messages.js';
export declare class SessionHud {
    private root;
    private lives;
    private distance;
    private effect;
    private result;
    private review;
    private controls;
    private phase;
    private goal;
    private meta;
    private warning;
    private warningTimer;
    private previousBest;
    beginRound(): void;
    clearWarning(): void;
    showWarning(warning: TeamWarning, playerId: string): void;
    render(state: VisibleState, playerId: string, winners?: string[]): void;
}
//# sourceMappingURL=session-hud.d.ts.map