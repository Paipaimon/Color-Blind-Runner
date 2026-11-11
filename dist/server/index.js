import { phaseAtTime, ROUND_DURATION } from '../shared/round-rules.js';
import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoomManager } from './room-manager.js';
import { GameLoop, GameState as LoopState } from './game-loop.js';
import { VisibilityFilter } from './visibility-filter.js';
import { applyInput } from './player-logic.js';
import { GAME_CONFIG } from '../shared/constants.js';
import { GameState } from '../shared/types.js';
import { ClientMessageType, ServerMessageType, parseClientMessage } from '../shared/messages.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};
/** Explicit public roots, with canonical path validation before every read. */
export async function readPublicFile(url) {
    const pathname = decodeURIComponent(url.split('?')[0]);
    if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').includes('..'))
        throw new Error('Invalid path');
    let root;
    let relative;
    if (pathname.startsWith('/dist/client/') || pathname.startsWith('/dist/shared/')) {
        const area = pathname.startsWith('/dist/client/') ? 'client' : 'shared';
        root = path.join(ROOT, 'dist', area);
        relative = pathname.slice(`/dist/${area}/`.length);
        if (!relative.endsWith('.js') || relative.endsWith('.test.js'))
            throw new Error('Not public');
    }
    else {
        root = path.join(ROOT, 'public');
        relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    }
    const [canonicalRoot, target] = await Promise.all([realpath(root), realpath(path.resolve(root, relative))]);
    const withinRoot = path.relative(canonicalRoot, target);
    if (withinRoot.startsWith('..') || path.isAbsolute(withinRoot))
        throw new Error('Not public');
    const mime = MIME[path.extname(target)];
    if (!mime)
        throw new Error('Not public');
    return { data: await readFile(target), mime };
}
export class GameServer {
    httpServer;
    wss;
    roomManager = new RoomManager();
    visibility = new VisibilityFilter();
    gameLoop;
    connections = new Map();
    playerSockets = new Map();
    countdownTimers = new Map();
    heartbeat;
    ready;
    constructor(port = GAME_CONFIG.DEFAULT_PORT, host = '0.0.0.0') {
        this.gameLoop = new GameLoop({
            onPlayerDied: (roomId, playerId) => {
                this.roomManager.markPlayerDead(roomId, playerId);
                this.broadcast(roomId, { type: ServerMessageType.PLAYER_DIED, playerId, killedBy: 'obstacle' });
            },
            onGameEnded: (roomId, scores) => {
                this.roomManager.endGame(roomId);
                const room = this.gameLoop.getRoom(roomId);
                for (const player of room.players) {
                    const ws = this.playerSockets.get(player.id);
                    if (ws)
                        this.send(ws, { type: ServerMessageType.GAME_OVER,
                            winners: scores.filter(score => score.alive).map(score => score.id),
                            finalState: this.project(room, player.id) });
                }
                this.broadcastLobby(roomId);
            },
            onStateUpdate: (roomId, room) => {
                for (const player of room.players) {
                    const ws = this.playerSockets.get(player.id);
                    if (ws)
                        this.send(ws, { type: ServerMessageType.GAME_STATE,
                            state: this.project(room, player.id), timestamp: Date.now() });
                }
            }
        });
        this.httpServer = http.createServer((req, res) => { void this.handleHttp(req, res); });
        this.wss = new WebSocketServer({ server: this.httpServer, maxPayload: 4096 });
        this.wss.on('connection', ws => this.connect(ws));
        this.wss.on('error', error => console.error('[WebSocket]', error));
        this.heartbeat = setInterval(() => {
            for (const [ws, connection] of this.connections) {
                if (!connection.alive) {
                    ws.terminate();
                    continue;
                }
                connection.alive = false;
                ws.ping();
            }
        }, GAME_CONFIG.HEARTBEAT_INTERVAL);
        this.ready = new Promise((resolve, reject) => {
            this.httpServer.once('error', reject);
            this.httpServer.listen(port, host, () => {
                this.httpServer.removeListener('error', reject);
                resolve();
            });
        });
    }
    get port() {
        const address = this.httpServer.address();
        return typeof address === 'object' && address ? address.port : 0;
    }
    async handleHttp(req, res) {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.writeHead(405, { Allow: 'GET, HEAD' });
            res.end();
            return;
        }
        try {
            const { data, mime } = await readPublicFile(req.url ?? '/');
            res.writeHead(200, { 'Content-Type': mime, 'Content-Length': data.length,
                'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
            res.end(req.method === 'HEAD' ? undefined : data);
        }
        catch {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        }
    }
    connect(ws) {
        const connection = { playerId: null, roomId: null, alive: true, windowStart: Date.now(), messages: 0 };
        this.connections.set(ws, connection);
        ws.on('pong', () => { connection.alive = true; });
        ws.on('message', (data, binary) => {
            if (Date.now() - connection.windowStart >= 1000) {
                connection.windowStart = Date.now();
                connection.messages = 0;
            }
            if (++connection.messages > 120) {
                ws.close(1008, 'Too many messages');
                return;
            }
            const message = binary ? null : parseClientMessage(data.toString());
            if (!message) {
                this.error(ws, 'INVALID_MESSAGE', '消息格式无效');
                return;
            }
            try {
                switch (message.type) {
                    case ClientMessageType.JOIN_ROOM:
                        this.join(ws, connection, message.roomId);
                        break;
                    case ClientMessageType.LEAVE_ROOM:
                        this.leave(ws, connection);
                        break;
                    case ClientMessageType.READY:
                        if (!connection.roomId || !connection.playerId) {
                            this.error(ws, 'NOT_IN_ROOM', '请先加入房间');
                            break;
                        }
                        this.roomManager.setPlayerReady(connection.roomId, connection.playerId, true);
                        this.broadcastLobby(connection.roomId);
                        if (this.roomManager.areAllPlayersReady(connection.roomId))
                            this.startCountdown(connection.roomId);
                        break;
                    case ClientMessageType.PLAYER_INPUT: {
                        if (!connection.roomId || !connection.playerId)
                            break;
                        const player = this.gameLoop.getRoom(connection.roomId)?.players.find(p => p.id === connection.playerId);
                        if (!player?.alive || message.input.left === message.input.right)
                            break;
                        const route = applyInput(player.route, { type: message.input.left ? 'move_left' : 'move_right' });
                        this.gameLoop.handlePlayerInput(connection.roomId, player.id, route);
                        break;
                    }
                    case ClientMessageType.WARN_OBSTACLE: {
                        if (!connection.roomId || !connection.playerId)
                            break;
                        const warning = this.gameLoop.warnObstacle(connection.roomId, connection.playerId, message.obstacleId);
                        if (warning) {
                            for (const id of [warning.fromPlayerId, warning.toPlayerId]) {
                                const recipient = this.playerSockets.get(id);
                                if (recipient)
                                    this.send(recipient, { type: ServerMessageType.TEAM_WARNING, warning });
                            }
                        }
                        break;
                    }
                    case ClientMessageType.PING:
                        this.send(ws, { type: ServerMessageType.PONG, timestamp: message.timestamp, serverTime: Date.now() });
                        break;
                }
            }
            catch (error) {
                console.error('[Message]', error);
                this.error(ws, 'SERVER_ERROR', '请求未能完成');
            }
        });
        const disconnect = () => {
            if (!this.connections.has(ws))
                return;
            this.leave(ws, connection);
            this.connections.delete(ws);
        };
        ws.on('close', disconnect);
        ws.on('error', () => { disconnect(); ws.terminate(); });
    }
    join(ws, connection, requestedRoom) {
        if (connection.roomId)
            this.leave(ws, connection);
        const result = requestedRoom
            ? { roomId: requestedRoom, player: this.roomManager.joinRoom(requestedRoom) }
            : this.roomManager.joinOrCreateRoom();
        if (!result?.player) {
            this.error(ws, 'ROOM_UNAVAILABLE', '房间不可加入，请重新匹配');
            return;
        }
        connection.roomId = result.roomId;
        connection.playerId = result.player.id;
        this.playerSockets.set(result.player.id, ws);
        this.send(ws, { type: ServerMessageType.ROOM_JOINED, roomId: result.roomId,
            playerId: result.player.id, playerColor: result.player.color,
            players: this.roomManager.getPlayersInRoom(result.roomId) });
        this.broadcast(result.roomId, { type: ServerMessageType.PLAYER_JOINED, player: result.player });
        this.broadcastLobby(result.roomId);
    }
    leave(ws, connection) {
        const { roomId, playerId } = connection;
        if (!roomId || !playerId)
            return;
        connection.roomId = null;
        connection.playerId = null;
        this.playerSockets.delete(playerId);
        if (this.gameLoop.isRunning(roomId)) {
            this.broadcast(roomId, { type: ServerMessageType.PLAYER_DIED, playerId, killedBy: 'disconnect' });
            this.gameLoop.disconnectPlayer(roomId, playerId);
        }
        const timer = this.countdownTimers.get(roomId);
        if (timer) {
            clearInterval(timer);
            this.countdownTimers.delete(roomId);
            this.roomManager.cancelCountdown(roomId);
        }
        this.roomManager.leaveRoom(roomId, playerId);
        this.send(ws, { type: ServerMessageType.ROOM_LEFT });
        this.broadcast(roomId, { type: ServerMessageType.PLAYER_LEFT, playerId });
        this.broadcastLobby(roomId);
    }
    broadcastLobby(roomId) {
        const room = this.roomManager.getRoom(roomId);
        if (!room || room.gameState === GameState.PLAYING)
            return;
        this.broadcast(roomId, { type: ServerMessageType.ROOM_STATE, state: {
                players: this.roomManager.getPlayersInRoom(roomId), obstacles: [], powerUps: [],
                gameState: room.gameState, scrollSpeed: 0
            } });
    }
    startCountdown(roomId) {
        const rematch = this.roomManager.getRoom(roomId)?.gameState === GameState.GAME_OVER;
        if (!this.roomManager.startGame(roomId))
            return;
        let seconds = rematch ? 2 : GAME_CONFIG.COUNTDOWN_SECONDS;
        this.broadcast(roomId, { type: ServerMessageType.COUNTDOWN, seconds });
        const timer = setInterval(() => {
            seconds--;
            if (seconds > 0) {
                this.broadcast(roomId, { type: ServerMessageType.COUNTDOWN, seconds });
                return;
            }
            clearInterval(timer);
            this.countdownTimers.delete(roomId);
            if (!this.roomManager.beginPlaying(roomId)) {
                this.roomManager.cancelCountdown(roomId);
                this.broadcastLobby(roomId);
                return;
            }
            const room = { id: roomId, seed: Date.now(), obstacles: [], worldPosition: 0,
                gameState: LoopState.PLAYING,
                players: this.roomManager.getPlayersInRoom(roomId).map(player => ({
                    id: player.id, color: player.color, route: 1, alive: true, distance: 0, ready: true
                })) };
            this.gameLoop.start(room);
            this.broadcast(roomId, { type: ServerMessageType.GAME_START });
        }, 1000);
        this.countdownTimers.set(roomId, timer);
    }
    project(room, playerId) {
        const viewer = room.players.find(player => player.id === playerId);
        const viewPosition = viewer.alive ? room.worldPosition : viewer.distance;
        const cell = GAME_CONFIG.CELL_SIZE;
        return {
            gameState: room.gameState === LoopState.ENDED ? GameState.GAME_OVER : GameState.PLAYING,
            scrollSpeed: phaseAtTime(room.elapsed ?? 0).speed,
            phase: phaseAtTime(room.elapsed ?? 0).id,
            remainingSeconds: Math.max(0, ROUND_DURATION - (room.elapsed ?? 0)),
            endReason: room.endReason,
            players: room.players.map(player => ({
                id: player.id, color: player.color, isAlive: player.alive,
                position: { x: player.route * cell + cell / 2, y: player.distance },
                distance: player.distance, lives: player.lives, shield: player.shield,
                invulnerableFor: Math.max(0, (player.invulnerableUntil ?? 0) - (room.elapsed ?? 0)),
                survivalTime: player.survivalTime, totalMoves: player.totalMoves,
                warningsSent: player.warningsSent, lastDamage: player.lastDamage
            })),
            obstacles: this.visibility.filterObstacles(room.obstacles, viewer.color)
                .map(obstacle => ({ id: obstacle.id, color: obstacle.color,
                position: { x: obstacle.route * cell, y: GAME_CONFIG.GAME_HEIGHT - (obstacle.y - viewPosition + 1) * cell },
                width: cell, height: cell }))
                .filter(obstacle => obstacle.position.y >= -cell && obstacle.position.y < GAME_CONFIG.GAME_HEIGHT),
            proximityHints: viewer.alive ? this.visibility.generateProximityHints(room.obstacles, viewer) : [],
            powerUps: (room.powerUps ?? []).filter(pickup => !pickup.collectedBy.has(playerId)
                && pickup.worldY >= viewPosition - 1 && pickup.worldY <= viewPosition + GAME_CONFIG.GRID_ROWS)
                .map(({ id, kind, route, worldY }) => ({ id, kind, route, worldY }))
        };
    }
    send(ws, message) {
        if (ws.readyState !== WebSocket.OPEN)
            return;
        if (ws.bufferedAmount > 1024 * 1024) {
            ws.terminate();
            return;
        }
        if (message.type === ServerMessageType.GAME_STATE && ws.bufferedAmount > 65536)
            return;
        ws.send(JSON.stringify(message));
    }
    error(ws, code, message) {
        this.send(ws, { type: ServerMessageType.ERROR, code, message });
    }
    broadcast(roomId, message) {
        for (const player of this.roomManager.getPlayersInRoom(roomId)) {
            const ws = this.playerSockets.get(player.id);
            if (ws)
                this.send(ws, message);
        }
    }
    async close() {
        clearInterval(this.heartbeat);
        for (const timer of this.countdownTimers.values())
            clearInterval(timer);
        this.countdownTimers.clear();
        for (const room of this.roomManager.getAllRooms())
            this.gameLoop.stop(room.id);
        for (const ws of this.connections.keys())
            ws.terminate();
        this.wss.close();
        this.httpServer.closeAllConnections();
        await new Promise(resolve => this.httpServer.close(() => resolve()));
    }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const server = new GameServer(Number(process.env.PORT || GAME_CONFIG.DEFAULT_PORT));
    server.ready.then(() => console.log(`Game server listening on ${server.port}`)).catch(error => {
        console.error(error);
        void server.close().then(() => { process.exitCode = 1; });
    });
    for (const signal of ['SIGINT', 'SIGTERM']) {
        process.once(signal, () => { void server.close(); });
    }
}
//# sourceMappingURL=index.js.map