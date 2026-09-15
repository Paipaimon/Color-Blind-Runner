/**
 * StatusBarRenderer 测试
 * 验证增强状态栏渲染器的基本功能
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatusBarRenderer } from './status-bar-renderer.js';
import { GameState, PlayerColor } from '../shared/types.js';
// Mock DOM environment
const mockContainer = {
    innerHTML: '',
    appendChild: vi.fn(),
    classList: {
        add: vi.fn(),
        remove: vi.fn()
    }
};
// Mock localStorage
const mockLocalStorage = {
    getItem: vi.fn(),
    setItem: vi.fn()
};
Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage
});
// Mock window properties
Object.defineProperty(window, 'innerWidth', {
    writable: true,
    value: 1024
});
Object.defineProperty(window, 'innerHeight', {
    writable: true,
    value: 768
});
Object.defineProperty(navigator, 'userAgent', {
    writable: true,
    value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
});
describe('StatusBarRenderer', () => {
    let renderer;
    beforeEach(() => {
        vi.clearAllMocks();
        mockContainer.innerHTML = '';
        renderer = new StatusBarRenderer(mockContainer);
    });
    it('应该正确初始化', () => {
        expect(renderer).toBeDefined();
        expect(mockLocalStorage.getItem).toHaveBeenCalledWith('colorBlindRunner_personalBest');
    });
    it('应该正确渲染等待状态', () => {
        const state = {
            players: [
                { id: 'player1', color: PlayerColor.RED, position: { x: 0, y: 0 }, isAlive: true }
            ],
            obstacles: [],
            scrollSpeed: 0,
            gameState: GameState.WAITING
        };
        renderer.render(state, 'player1', 'room123', PlayerColor.RED);
        expect(mockContainer.appendChild).toHaveBeenCalled();
    });
    it('应该正确渲染游戏进行状态', () => {
        const state = {
            players: [
                { id: 'player1', color: PlayerColor.RED, position: { x: 0, y: 0 }, isAlive: true, distance: 100 }
            ],
            obstacles: [],
            scrollSpeed: 5,
            gameState: GameState.PLAYING
        };
        renderer.render(state, 'player1', 'room123', PlayerColor.RED);
        expect(mockContainer.appendChild).toHaveBeenCalled();
    });
    it('应该正确渲染游戏结束状态', () => {
        const state = {
            players: [
                { id: 'player1', color: PlayerColor.RED, position: { x: 0, y: 0 }, isAlive: false, distance: 150 },
                { id: 'player2', color: PlayerColor.BLUE, position: { x: 0, y: 0 }, isAlive: false, distance: 120 }
            ],
            obstacles: [],
            scrollSpeed: 0,
            gameState: GameState.GAME_OVER
        };
        renderer.render(state, 'player1', 'room123', PlayerColor.RED);
        expect(mockContainer.appendChild).toHaveBeenCalled();
    });
    it('应该正确增加移动次数', () => {
        renderer.incrementMoveCount();
        // 验证移动次数被增加（通过渲染状态来验证）
        const state = {
            players: [{ id: 'player1', color: PlayerColor.RED, position: { x: 0, y: 0 }, isAlive: true }],
            obstacles: [],
            scrollSpeed: 0,
            gameState: GameState.PLAYING
        };
        renderer.render(state, 'player1');
        expect(mockContainer.appendChild).toHaveBeenCalled();
    });
    it('应该正确设置移动端模式', () => {
        renderer.setMobileMode(true);
        expect(mockContainer.classList.add).toHaveBeenCalledWith('mobile-layout');
    });
    it('应该正确启动和停止动画', () => {
        const mockRequestAnimationFrame = vi.fn();
        const mockCancelAnimationFrame = vi.fn();
        global.requestAnimationFrame = mockRequestAnimationFrame;
        global.cancelAnimationFrame = mockCancelAnimationFrame;
        renderer.startAnimation();
        expect(mockRequestAnimationFrame).toHaveBeenCalled();
        renderer.stopAnimation();
        expect(mockCancelAnimationFrame).toHaveBeenCalled();
    });
});
//# sourceMappingURL=status-bar-renderer.test.js.map