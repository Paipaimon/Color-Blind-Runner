import { describe, expect, it } from 'vitest';
import { parseClientMessage } from './messages.js';

describe('client message validation', () => {
  it.each(['null', '[]', '{}', '{', '{"type":"unknown"}', '{"type":"PLAYER_INPUT"}',
    '{"type":"PLAYER_INPUT","input":{"left":"true"}}', '{"type":"JOIN_ROOM","roomId":3}',
    '{"type":"PING","timestamp":"100"}'])('rejects invalid message %s', data => {
    expect(parseClientMessage(data)).toBeNull();
  });
  it('accepts the existing keyboard, touch and lobby protocol', () => {
    for (const message of [{ type: 'READY' }, { type: 'JOIN_ROOM' }, { type: 'LEAVE_ROOM' },
      { type: 'PLAYER_INPUT', input: { up: false, down: false, left: true, right: false } }]) {
      expect(parseClientMessage(JSON.stringify(message))).toEqual(message);
    }
  });
});
