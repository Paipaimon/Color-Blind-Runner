import { GAME_CONFIG } from '../shared/constants.js';
import { SeededRandom } from './seeded-random.js';
/** Each player can collect each pickup once. */
export class PowerUpGenerator {
    random;
    nextY = 10;
    counter = 0;
    constructor(seed) {
        this.random = new SeededRandom(seed ^ 0x51ed270b);
    }
    generate(worldPosition) {
        const result = [];
        while (this.nextY <= worldPosition + GAME_CONFIG.GRID_ROWS + 10) {
            result.push({
                id: `pickup_${this.counter++}`,
                kind: this.random.pick(['heart', 'shield']),
                route: this.random.nextInt(0, GAME_CONFIG.GRID_COLS - 1),
                worldY: this.nextY,
                collectedBy: new Set()
            });
            this.nextY += this.random.nextInt(14, 20);
        }
        return result;
    }
}
//# sourceMappingURL=power-ups.js.map