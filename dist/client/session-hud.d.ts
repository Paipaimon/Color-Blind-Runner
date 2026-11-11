import { VisibleState } from '../shared/types.js';
/** Compact game status stays visible even when the mobile lobby HUD is hidden. */
export declare class SessionHud {
    private root;
    private lives;
    private distance;
    private effect;
    private result;
    private controls;
    render(state: VisibleState, playerId: string, winners?: string[]): void;
}
//# sourceMappingURL=session-hud.d.ts.map