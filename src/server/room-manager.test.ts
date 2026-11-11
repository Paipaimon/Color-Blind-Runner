import { expect, it } from 'vitest';
import { RoomManager } from './room-manager.js';
import { GameState } from '../shared/types.js';

it('cancels countdown, resets readiness, and removes empty completed rooms', () => {
  const manager = new RoomManager();
  const roomId = manager.createRoom();
  const a = manager.joinRoom(roomId)!;
  const b = manager.joinRoom(roomId)!;
  manager.setPlayerReady(roomId, a.id, true);
  manager.setPlayerReady(roomId, b.id, true);
  expect(manager.startGame(roomId)).toBe(true);
  manager.cancelCountdown(roomId);
  manager.leaveRoom(roomId, b.id);
  expect(manager.getRoom(roomId)?.gameState).toBe(GameState.WAITING);
  expect(manager.isPlayerReady(roomId, a.id)).toBe(false);
  expect(manager.beginPlaying(roomId)).toBe(false);
  manager.endGame(roomId);
  manager.leaveRoom(roomId, a.id);
  expect(manager.getAllRooms()).toEqual([]);
  expect(manager.getRoomByPlayerId(a.id)).toBeNull();
});
