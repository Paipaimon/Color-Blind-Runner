export interface RoundPhase {
    id: 'warmup' | 'pressure' | 'sprint';
    label: string;
    startsAt: number;
    startsAtDistance: number;
    speed: number;
    minGap: number;
    maxGap: number;
    doubleChance: number;
}
export declare const ROUND_DURATION = 90;
export declare const ROUND_MAX_DISTANCE = 342;
export declare const ROUND_PHASES: readonly RoundPhase[];
export declare function phaseAtTime(seconds: number): RoundPhase;
export declare function phaseAtDistance(distance: number): RoundPhase;
//# sourceMappingURL=round-rules.d.ts.map