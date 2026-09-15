/**
 * 种子随机数生成器
 * 使用 Mulberry32 算法实现可复现的伪随机数生成
 *
 * 用途：确保相同种子产生相同的障碍物序列
 * Requirements: 4.4 - 随机种子可复现性
 */
export class SeededRandom {
    state;
    initialSeed;
    /**
     * 创建种子随机数生成器
     * @param seed 随机种子（整数）
     */
    constructor(seed) {
        // 确保种子为正整数
        this.initialSeed = Math.abs(Math.floor(seed)) || 1;
        this.state = this.initialSeed;
    }
    /**
     * 生成 [0, 1) 范围内的随机浮点数
     * 使用 Mulberry32 算法
     */
    next() {
        // Mulberry32 算法
        let t = (this.state += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    /**
     * 生成指定范围内的随机整数 [min, max]（包含两端）
     * @param min 最小值（包含）
     * @param max 最大值（包含）
     */
    nextInt(min, max) {
        const range = max - min + 1;
        return Math.floor(this.next() * range) + min;
    }
    /**
     * 从数组中随机选择一个元素
     * @param array 待选择的数组
     */
    pick(array) {
        if (array.length === 0) {
            throw new Error('Cannot pick from empty array');
        }
        const index = this.nextInt(0, array.length - 1);
        return array[index];
    }
    /**
     * 生成指定范围内的随机浮点数 [min, max)
     * @param min 最小值（包含）
     * @param max 最大值（不包含）
     */
    nextFloat(min, max) {
        return this.next() * (max - min) + min;
    }
    /**
     * 重置生成器到初始状态
     * 重置后将产生与初始化时相同的随机序列
     */
    reset() {
        this.state = this.initialSeed;
    }
    /**
     * 获取当前种子值
     */
    getSeed() {
        return this.initialSeed;
    }
}
//# sourceMappingURL=seeded-random.js.map