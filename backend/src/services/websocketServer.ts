import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { GameStateManager } from './gameStateManager';
import { MatchModel } from '../models/Match';
import { PuzzleModel } from '../models/Puzzle';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  matchId?: number;
}

const clients = new Map<number, Set<AuthenticatedWebSocket>>(); // matchId -> Set of clients

export const setupWebSocketServer = (server: Server) => {
  const wss = new WebSocketServer({ server, path: '/ws/game' });

  wss.on('connection', async (ws: AuthenticatedWebSocket, req) => {
    console.log('🔌 WebSocket connection attempt');

    // Extract match_id and token from query params
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const matchId = parseInt(url.searchParams.get('match_id') || '0');
    const token = url.searchParams.get('token') || '';

    if (!matchId || !token) {
      ws.close(1008, 'Missing match_id or token');
      return;
    }

    try {
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
      ws.userId = decoded.userId;
      ws.matchId = matchId;

      // Get match from database
      const match = await MatchModel.findById(matchId);
      if (!match) {
        ws.close(1008, 'Match not found');
        return;
      }

      // Get match players
      const players = await MatchModel.getPlayers(matchId);
      if (players.length !== 2) {
        ws.close(1008, 'Invalid match');
        return;
      }

      // Check if this user is a player in this match
      const playerSlot = players.find(p => p.player_id === decoded.userId);
      if (!playerSlot) {
        ws.close(1008, 'Not a player in this match');
        return;
      }

      console.log(`✅ Player ${decoded.userId} connected to match ${matchId}`);

      // Add client to match clients
      if (!clients.has(matchId)) {
        clients.set(matchId, new Set());
      }
      clients.get(matchId)!.add(ws);

      // Initialize game state if not already done
      let game = GameStateManager.getGame(matchId);
      if (!game) {
        const puzzle = await PuzzleModel.findById(match.puzzle_id);
        if (!puzzle) {
          ws.close(1008, 'Puzzle not found');
          return;
        }

        game = GameStateManager.createGame(
          matchId,
          puzzle.id,
          puzzle.initial_grid,
          puzzle.solution_grid,
          players[0].player_id,
          players[1].player_id,
          300 // 5 minutes
        );
      }

      // If both players connected, start the game
      if (clients.get(matchId)!.size === 2 && game.status === 'WAITING') {
        GameStateManager.startGame(matchId);
        await MatchModel.updateStatus(matchId, 'IN_PROGRESS');

        // Send game start to both players
        broadcastToMatch(matchId, {
          type: 'GAME_START',
          data: {
            initial_grid: game.player1.grid,
            time_limit: game.timeLimit,
          },
        });
      }

      // Send current game state to the connecting player
      ws.send(JSON.stringify({
        type: 'GAME_STATE',
        data: {
          status: game.status,
          your_slot: playerSlot.slot,
          player1: {
            cells_completed: game.player1.cellsCompleted,
            lives_remaining: game.player1.livesRemaining,
            is_locked_out: game.player1.isLockedOut,
          },
          player2: {
            cells_completed: game.player2.cellsCompleted,
            lives_remaining: game.player2.livesRemaining,
            is_locked_out: game.player2.isLockedOut,
          },
        },
      }));

      // Handle messages
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await handleMessage(ws, message);
        } catch (error) {
          console.error('Error handling message:', error);
        }
      });

      // Handle disconnect
      ws.on('close', () => {
        console.log(`🔌 Player ${ws.userId} disconnected from match ${matchId}`);
        clients.get(matchId)?.delete(ws);
        
        // If match clients empty, cleanup
        if (clients.get(matchId)?.size === 0) {
          clients.delete(matchId);
        }
      });

    } catch (error) {
      console.error('WebSocket auth error:', error);
      ws.close(1008, 'Authentication failed');
    }
  });

  console.log('🎮 WebSocket game server ready on /ws/game');
};

async function handleMessage(ws: AuthenticatedWebSocket, message: any) {
  const { type, data } = message;
  const matchId = ws.matchId!;
  const userId = ws.userId!;

  switch (type) {
    case 'PLACE_NUMBER':
      const { row, col, value } = data;
      const result = GameStateManager.applyMove(matchId, userId, row, col, value);

      if (result.success) {
        // Broadcast move result to both players
        broadcastToMatch(matchId, {
          type: 'MOVE_RESULT',
          data: {
            player_id: userId,
            row,
            col,
            value,
            correct: result.correct,
            player_state: {
              cells_completed: result.player.cellsCompleted,
              lives_remaining: result.player.livesRemaining,
              is_locked_out: result.player.isLockedOut,
              is_solved: result.player.isSolved,
            },
          },
        });

        // Check if game ended
        if (result.player.isSolved) {
          await endGame(matchId, userId, 'SOLVED');
        }
      }
      break;

    case 'PING':
      ws.send(JSON.stringify({ type: 'PONG' }));
      break;
  }
}

function broadcastToMatch(matchId: number, message: any) {
  const matchClients = clients.get(matchId);
  if (matchClients) {
    const messageStr = JSON.stringify(message);
    matchClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }
}

async function endGame(matchId: number, winnerId: number, reason: string) {
  const game = GameStateManager.getGame(matchId);
  if (!game) return;

  game.status = 'COMPLETED';
  
  await MatchModel.updateStatus(matchId, 'COMPLETED');

  broadcastToMatch(matchId, {
    type: 'GAME_END',
    data: {
      winner_id: winnerId,
      reason,
      final_state: {
        player1: {
          cells_completed: game.player1.cellsCompleted,
          lives_remaining: game.player1.livesRemaining,
          mistakes: game.player1.mistakes,
        },
        player2: {
          cells_completed: game.player2.cellsCompleted,
          lives_remaining: game.player2.livesRemaining,
          mistakes: game.player2.mistakes,
        },
      },
    },
  });

  // Clean up after a delay
  setTimeout(() => {
    GameStateManager.removeGame(matchId);
    clients.delete(matchId);
  }, 10000); // 10 seconds
}
