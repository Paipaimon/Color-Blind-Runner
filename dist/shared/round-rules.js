export const ROUND_DURATION = 90;
export const ROUND_MAX_DISTANCE = 342;
export const ROUND_PHASES = [
    { id: 'warmup', label: '热身', startsAt: 0, startsAtDistance: 0, speed: 3, minGap: 3, maxGap: 4, doubleChance: 0 },
    { id: 'pressure', label: '加压', startsAt: 15, startsAtDistance: 45, speed: 3.6, minGap: 2.8, maxGap: 3.4, doubleChance: 0.25 },
    { id: 'sprint', label: '冲刺', startsAt: 45, startsAtDistance: 153, speed: 4.2, minGap: 2.4, maxGap: 3, doubleChance: 0.45 }
];
export function phaseAtTime(seconds) {
    return ROUND_PHASES[seconds >= 45 ? 2 : seconds >= 15 ? 1 : 0];
}
export function phaseAtDistance(distance) {
    return ROUND_PHASES[distance >= 153 ? 2 : distance >= 45 ? 1 : 0];
}
//# sourceMappingURL=round-rules.js.map