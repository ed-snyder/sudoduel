import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { GameStateManager } from './gameStateManager';
import { MatchModel } from '../models/Match';
import { PuzzleModel } from '../models/Puzzle';
import { PlayerRatingModel } from '../models/PlayerRating';
import { PlayerProfileModel } from '../models/PlayerProfile';
import { RatingService } from './ratingService';




interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  matchId?: number;
}

const clients = new Map<number, Set<AuthenticatedWebSocket>>();

export const setupWebSocketServer = (server: Server) => {
  const wss = new WebSocketServer({ server, path: '/ws/game' });

  wss.on('connection', async (ws: AuthenticatedWebSocket, req) => {
    console.log('🔌 WebSocket connection attempt');

    const url = new URL(req.url!, `http://${req.headers.host}`);
    const matchId = parseInt(url.searchParams.get('match_id') || '0');
    const token = url.searchParams.get('token') || '';

    if (!matchId || !token) {
      ws.close(1008, 'Missing match_id or token');
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
      ws.userId = decoded.userId;
      ws.matchId = matchId;

      const match = await MatchModel.findById(matchId);
      if (!match) {
        ws.close(1008, 'Match not found');
        return;
      }

      const players = await MatchModel.getPlayers(matchId);
      if (players.length !== 2) {
        ws.close(1008, 'Invalid match');
        return;
      }

      const profile = await PlayerProfileModel.findByUserId(decoded.userId);
      if (!profile) {
        ws.close(1008, 'Player profile not found');
        return;
      }
      
      // Check if this player's profile is in the match
      const playerSlot = players.find(p => p.player_id === profile.id);
      if (!playerSlot) {
        ws.close(1008, 'Not a player in this match');
        return;
      }

      const player1 = players[0];
      const player2 = players[1];
      if (!player1 || !player2) {
        ws.close(1008, 'Invalid match');
        return;
      }

      console.log(`✅ Player ${decoded.userId} connected to match ${matchId}`);

      if (!clients.has(matchId)) {
        clients.set(matchId, new Set());
      }
      clients.get(matchId)!.add(ws);

      let game = GameStateManager.getGame(matchId);
      if (!game) {
        const puzzle = await PuzzleModel.findById(match.puzzle_id);
        if (!puzzle) {
          ws.close(1008, 'Puzzle not found');
          return;
        }

        const player1 = players.find(p => p.slot === 1)!;
const player2 = players.find(p => p.slot === 2)!;

game = GameStateManager.createGame(
  matchId,
  puzzle.id,
  puzzle.initial_grid,
  puzzle.solution_grid,
  Number(player1.player_id),
  Number(player2.player_id),
  300
);

      }

      if (clients.get(matchId)!.size === 2 && game.status === 'WAITING') {
        GameStateManager.startGame(matchId, handleTimeout, handleTimerUpdate);
        await MatchModel.updateStatus(matchId, 'IN_PROGRESS');

        broadcastToMatch(matchId, {
          type: 'GAME_START',
          data: {
            initial_grid: game.player1.grid,
            time_limit: game.timeLimit,
            player1_time_remaining: game.player1.timeRemainingSeconds,
            player2_time_remaining: game.player2.timeRemainingSeconds,
          },
        });
      }

      ws.send(JSON.stringify({
        type: 'GAME_STATE',
        data: {
          status: game.status,
          your_slot: playerSlot.slot,
          player1: {
            cells_completed: game.player1.cellsCompleted,
            lives_remaining: game.player1.livesRemaining,
            is_locked_out: game.player1.isLockedOut,
            time_remaining: game.player1.timeRemainingSeconds,
          },
          player2: {
            cells_completed: game.player2.cellsCompleted,
            lives_remaining: game.player2.livesRemaining,
            is_locked_out: game.player2.isLockedOut,
            time_remaining: game.player2.timeRemainingSeconds,
          },
        },
      }));

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await handleMessage(ws, message);
        } catch (error) {
          console.error('Error handling message:', error);
        }
      });

      ws.on('close', () => {
        console.log(`🔌 Player ${ws.userId} disconnected from match ${matchId}`);
        clients.get(matchId)?.delete(ws);
        
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
  console.log(`🎯 Processing PLACE_NUMBER for user ${userId}`);
  const { row, col, value } = data;
  
  try {
    const userProfile = await PlayerProfileModel.findByUserId(userId);
    if (!userProfile) {
      console.error(`❌ Player profile not found for user ${userId}`);
      return;
    }
    
    console.log(`🔍 Applying move: userId=${userId}, userProfile.id=${userProfile.id}, row=${row}, col=${col}, value=${value}`);
    const result = GameStateManager.applyMove(matchId, userProfile.id, row, col, value);

    console.log(`✅ Move result:`, result);
    console.log(`🔍 Move was ${result.correct ? 'CORRECT' : 'INCORRECT'}`);
    console.log(`🔍 Player who made move: slot=${result.player.slot}, lives=${result.player.livesRemaining}, cells=${result.player.cellsCompleted}`);
    console.log(`🔍 gameEnded flag:`, result.gameEnded);

    if (result.success) {
      const game = GameStateManager.getGame(matchId);
      const timerValues = game ? GameStateManager.getTimerValues(matchId) : null;
      
      // Get opponent state for logging
      const opponent = game?.player1.playerId === userProfile.id ? game.player2 : game?.player1;
      console.log(`🔍 Broadcasting MOVE_RESULT: player slot=${result.player.slot}, opponent slot=${opponent?.slot}, opponent lives=${opponent?.livesRemaining}`);
      
      broadcastToMatch(matchId, {
        type: 'MOVE_RESULT',
        data: {
          player_id: userProfile.id, // Use player_profile.id, not user.id
          slot: result.player.slot, // Include slot for proper identification
          row,
          col,
          value,
          correct: result.correct,
          player_state: {
            slot: result.player.slot, // Include slot in player_state
            cells_completed: result.player.cellsCompleted,
            lives_remaining: result.player.livesRemaining,
            is_locked_out: result.player.isLockedOut,
            is_solved: result.player.isSolved,
            time_remaining: result.player.timeRemainingSeconds,
          },
          timer_update: timerValues ? {
            player1_time_remaining: timerValues.player1,
            player2_time_remaining: timerValues.player2,
          } : null,
        },
      });

      console.log(`🚦 Checking if game ended: ${result.gameEnded}`);
      if (result.gameEnded) {
        console.log(`🏁 Game ended, calling endGame...`);
        await endGame(matchId);
        console.log(`✅ endGame completed`);
      } else {
        console.log(`⏳ Game continues...`);
      }
    }
  } catch (error) {
    console.error(`❌ Error applying move:`, error);
  }
  break;
    case 'ERASE_CELL':
      console.log(`🗑️ Processing ERASE_CELL for user ${userId}`);
      const { row: eraseRow, col: eraseCol } = data;
      
      try {
        const userProfile = await PlayerProfileModel.findByUserId(userId);
        if (!userProfile) {
          console.error(`❌ Player profile not found for user ${userId}`);
          return;
        }
        
        const result = GameStateManager.eraseCell(matchId, userProfile.id, eraseRow, eraseCol);

        if (result.success) {
          const game = GameStateManager.getGame(matchId);
          const timerValues = game ? GameStateManager.getTimerValues(matchId) : null;
          
          broadcastToMatch(matchId, {
            type: 'ERASE_RESULT',
            data: {
              player_id: userProfile.id,
              slot: result.player.slot,
              row: eraseRow,
              col: eraseCol,
              player_state: {
                slot: result.player.slot,
                cells_completed: result.player.cellsCompleted,
                lives_remaining: result.player.livesRemaining,
                is_locked_out: result.player.isLockedOut,
                is_solved: result.player.isSolved,
                time_remaining: result.player.timeRemainingSeconds,
              },
              timer_update: timerValues ? {
                player1_time_remaining: timerValues.player1,
                player2_time_remaining: timerValues.player2,
              } : null,
            },
          });
        }
      } catch (error) {
        console.error(`❌ Error erasing cell:`, error);
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

async function handleTimeout(matchId: number) {
  console.log(`⏱️ Match ${matchId} timed out`);
  await endGame(matchId);
}

function handleTimerUpdate(matchId: number) {
  const timerValues = GameStateManager.getTimerValues(matchId);
  if (timerValues) {
    broadcastToMatch(matchId, {
      type: 'TIMER_UPDATE',
      data: {
        player1_time_remaining: timerValues.player1,
        player2_time_remaining: timerValues.player2,
      },
    });
  }
}

async function endGame(matchId: number) {
  console.log(`🎬 endGame CALLED for match ${matchId}`);

  const game = GameStateManager.getGame(matchId);
  console.log(`🎮 Game exists:`, !!game);
  console.log(`🎮 Game status:`, game?.status);

  if (!game || game.status === 'COMPLETED') {
    console.log(`⚠️ endGame early return - game already completed or doesn't exist`);
    return;
  }

  game.status = 'COMPLETED';
  console.log(`✅ Set game.status to COMPLETED in memory`);

  const results = GameStateManager.getFinalResults(matchId);
  console.log(`📊 Final results:`, results);

  if (!results) {
    console.log(`❌ No results returned, exiting endGame`);
    return;
  }

  console.log(`🏁 Match ${matchId} ended. Winner: ${results.winnerId || 'DRAW'}`);

  try {
    console.log(`💾 [1/6] Updating match status...`);
    await MatchModel.updateStatus(matchId, 'COMPLETED');
    console.log(`✅ [1/6] Match status updated`);

    console.log(`💾 [2/6] Setting result code: ${results.resultCode}`);
    await MatchModel.setResult(matchId, results.resultCode);
    console.log(`✅ [2/6] Result code set`);

    console.log(`💾 [3/6] Fetching match players...`);
    const matchPlayers = await MatchModel.getPlayers(matchId);
    console.log(`✅ [3/6] Got ${matchPlayers.length} players:`, matchPlayers.map(p => p.player_id));

    const player1Data = matchPlayers.find(p => p.slot === 1);
    const player2Data = matchPlayers.find(p => p.slot === 2);
    console.log(`👤 Player 1 data:`, player1Data?.player_id);
    console.log(`👤 Player 2 data:`, player2Data?.player_id);

    if (!player1Data || !player2Data) {
      console.log(`❌ Missing player data, exiting`);
      return;
    }

    console.log(`💾 [4/6] Fetching player ratings...`);
    const rating1 = await PlayerRatingModel.findByPlayerAndLadder(player1Data.player_id, 1);
    const rating2 = await PlayerRatingModel.findByPlayerAndLadder(player2Data.player_id, 1);
    console.log(`✅ [4/6] Rating 1:`, rating1?.rating);
    console.log(`✅ [4/6] Rating 2:`, rating2?.rating);

    if (!rating1 || !rating2) {
      console.error(`❌ Player ratings not found`);
      return;
    }

    let outcome: number;
    if (results.winnerId === results.player1.playerId) {
      outcome = 1;
    } else if (results.winnerId === results.player2.playerId) {
      outcome = 0;
    } else {
      outcome = 0.5;
    }
    console.log(`🎲 Outcome value: ${outcome}`);

    console.log(`💾 [5/6] Updating ratings with Glicko-2...`);
    const newRatings = await RatingService.updateRatings(
      rating1.id,
      rating1.rating,
      rating1.rd,
      rating1.volatility,
      rating1.last_update_at,
      rating2.id,
      rating2.rating,
      rating2.rd,
      rating2.volatility,
      rating2.last_update_at,
      outcome
    );
    console.log(`✅ [5/6] New ratings calculated:`, newRatings);

    console.log(`💾 [6/6] Saving player stats for player ${results.player1.playerId}...`);
    await MatchModel.updatePlayerStats(matchId, results.player1.playerId, {
      cellsCompleted: results.player1.cellsCompleted,
      livesUsed: 3 - results.player1.livesRemaining,
      livesRemaining: results.player1.livesRemaining,
      mistakes: results.player1.mistakes,
      timeSpentSeconds: results.player1.timeSpentSeconds,
      finalState: results.player1.finalState,
      isWinner: results.player1.isWinner,
      ratingAfter: newRatings.player1.rating,
      rdAfter: newRatings.player1.rd,
      volatilityAfter: newRatings.player1.volatility,
    });
    console.log(`✅ [6/6a] Player 1 stats saved`);

    console.log(`💾 [6/6] Saving player stats for player ${results.player2.playerId}...`);
    await MatchModel.updatePlayerStats(matchId, results.player2.playerId, {
      cellsCompleted: results.player2.cellsCompleted,
      livesUsed: 3 - results.player2.livesRemaining,
      livesRemaining: results.player2.livesRemaining,
      mistakes: results.player2.mistakes,
      timeSpentSeconds: results.player2.timeSpentSeconds,
      finalState: results.player2.finalState,
      isWinner: results.player2.isWinner,
      ratingAfter: newRatings.player2.rating,
      rdAfter: newRatings.player2.rd,
      volatilityAfter: newRatings.player2.volatility,
    });
    console.log(`✅ [6/6b] Player 2 stats saved`);

    console.log(`📤 Broadcasting GAME_END...`);
    broadcastToMatch(matchId, {
      type: 'GAME_END',
      data: {
        winner_id: results.winnerId,
        result: results.winnerId === results.player1.playerId ? 'WIN' : 
                results.winnerId === results.player2.playerId ? 'LOSS' : 'DRAW',
        player1: {
          ...results.player1,
          rating_before: rating1.rating,
          rating_after: newRatings.player1.rating,
          rating_change: newRatings.player1.rating - rating1.rating,
        },
        player2: {
          ...results.player2,
          rating_before: rating2.rating,
          rating_after: newRatings.player2.rating,
          rating_change: newRatings.player2.rating - rating2.rating,
        },
      },
    });

    console.log(`📤 GAME_END message broadcasted`);

    setTimeout(() => {
      GameStateManager.removeGame(matchId);
      clients.delete(matchId);
      console.log(`🧹 Cleaned up game state`);
    }, 30000);

  } catch (error) {
    console.error(`💥 ERROR in endGame:`, error);
  }
}
