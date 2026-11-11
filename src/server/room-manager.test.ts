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

it('retains player identities and colours for a rematch and resets readiness', () => {
  const manager = new RoomManager();
  const roomId = manager.createRoom();
  const a = manager.joinRoom(roomId)!;
  const b = manager.joinRoom(roomId)!;
  manager.setPlayerReady(roomId, a.id, true);
  manager.setPlayerReady(roomId, b.id, true);
  manager.startGame(roomId);
  manager.beginPlaying(roomId);
  manager.markPlayerDead(roomId, a.id);
  manager.endGame(roomId);
  expect(manager.isPlayerReady(roomId, a.id)).toBe(false);
  manager.setPlayerReady(roomId, a.id, true);
  expect(manager.startGame(roomId)).toBe(false);
  manager.setPlayerReady(roomId, b.id, true);
  expect(manager.startGame(roomId)).toBe(true);
  expect(manager.beginPlaying(roomId)).toBe(true);
  expect(manager.getPlayersInRoom(roomId).map(p => [p.id, p.color])).toEqual([[a.id, a.color], [b.id, b.color]]);
});
