import { PowerUpKind } from '../shared/types.js';
import { GAME_CONFIG } from '../shared/constants.js';
import { SeededRandom } from './seeded-random.js';

export interface PowerUp {
  id: string;
  kind: PowerUpKind;
  route: number;
  worldY: number;
  collectedBy: Set<string>;
}

/** Each player can collect each pickup once. */
export class PowerUpGenerator {
  private random: SeededRandom;
  private nextY = 10;
  private counter = 0;

  constructor(seed: number) {
    this.random = new SeededRandom(seed ^ 0x51ed270b);
  }

  generate(worldPosition: number): PowerUp[] {
    const result: PowerUp[] = [];
    while (this.nextY <= worldPosition + GAME_CONFIG.GRID_ROWS + 10) {
      result.push({
        id: `pickup_${this.counter++}`,
        kind: this.random.pick(['heart', 'shield'] as const),
        route: this.random.nextInt(0, GAME_CONFIG.GRID_COLS - 1),
        worldY: this.nextY,
        collectedBy: new Set()
      });
      this.nextY += this.random.nextInt(14, 20);
    }
    return result;
  }
}
