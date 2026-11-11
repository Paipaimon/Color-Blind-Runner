import { PowerUpKind } from '../shared/types.js';
export interface PowerUp {
    id: string;
    kind: PowerUpKind;
    route: number;
    worldY: number;
    collectedBy: Set<string>;
}
/** Each player can collect each pickup once. */
export declare class PowerUpGenerator {
    private random;
    private nextY;
    private counter;
    constructor(seed: number);
    generate(worldPosition: number): PowerUp[];
}
//# sourceMappingURL=power-ups.d.ts.map