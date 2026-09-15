/**
 * 种子随机数生成器
 * 使用 Mulberry32 算法实现可复现的伪随机数生成
 *
 * 用途：确保相同种子产生相同的障碍物序列
 * Requirements: 4.4 - 随机种子可复现性
 */
export declare class SeededRandom {
    private state;
    private readonly initialSeed;
    /**
     * 创建种子随机数生成器
     * @param seed 随机种子（整数）
     */
    constructor(seed: number);
    /**
     * 生成 [0, 1) 范围内的随机浮点数
     * 使用 Mulberry32 算法
     */
    next(): number;
    /**
     * 生成指定范围内的随机整数 [min, max]（包含两端）
     * @param min 最小值（包含）
     * @param max 最大值（包含）
     */
    nextInt(min: number, max: number): number;
    /**
     * 从数组中随机选择一个元素
     * @param array 待选择的数组
     */
    pick<T>(array: readonly T[]): T;
    /**
     * 生成指定范围内的随机浮点数 [min, max)
     * @param min 最小值（包含）
     * @param max 最大值（不包含）
     */
    nextFloat(min: number, max: number): number;
    /**
     * 重置生成器到初始状态
     * 重置后将产生与初始化时相同的随机序列
     */
    reset(): void;
    /**
     * 获取当前种子值
     */
    getSeed(): number;
}
//# sourceMappingURL=seeded-random.d.ts.map