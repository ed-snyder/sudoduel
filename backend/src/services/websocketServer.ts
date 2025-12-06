import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { GameStateManager } from './gameStateManager';
import { MatchModel } from '../models/Match';
import { PuzzleModel } from '../models/Puzzle';
import { PlayerProfileModel } from '../models/PlayerProfile';
import { PlayerRatingModel } from '../models/PlayerRating';
import { UserModel } from '../models/User';
import { RatingService } from './ratingService';
import { MatchmakingService } from './matchmakingService';
import { TIME_BONUS_CORRECT, TIME_PENALTY_INCORRECT, STARTING_TIME_SECONDS } from '../constants';




interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  matchId?: number;
}

const clients = new Map<number, Set<AuthenticatedWebSocket>>();
const gracePeriodIntervals = new Map<number, NodeJS.Timeout>();
const rematchRequests = new Map<number, { requestedBy: number; expiresAt: number }>();

export const setupWebSocketServer = (server: Server) => {
  const wss = new WebSocketServer({ server, path: '/ws/game' });

  wss.on('connection', async (ws: AuthenticatedWebSocket, req) => {

    const url = new URL(req.url!, `http://${req.headers.host}`);
    const matchId = parseInt(url.searchParams.get('match_id') || '0');
    const token = url.searchParams.get('token') || '';

    if (!matchId || !token) {
      ws.close(1008, 'Missing match_id or token');
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
      
      // Verify user still exists (logs out users whose accounts were deleted)
      const user = await UserModel.findById(decoded.userId);
      if (!user) {
        ws.close(1008, 'User account no longer exists');
        return;
      }
      
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

        const slot1 = players.find(p => p.slot === 1)!;
        const slot2 = players.find(p => p.slot === 2)!;

        game = GameStateManager.createGame(
          matchId,
          puzzle.id,
          puzzle.initial_grid,
          puzzle.solution_grid,
          Number(slot1.player_id),
          Number(slot2.player_id),
          STARTING_TIME_SECONDS
        );
      }

      // Compute opponent profile for this connection
      const opponentRow = players.find(p => p.player_id !== profile.id)!;
      const opponentProfile = await PlayerProfileModel.findById(opponentRow.player_id);
      
      // Get opponent rating
      const opponentRating = await PlayerRatingModel.findByPlayerAndLadder(opponentRow.player_id, 1);

      // Check if this is a reconnection
      if (game?.disconnectedPlayerId === profile.id) {
        const reconnected = GameStateManager.handleReconnect(matchId, profile.id);
        
        if (reconnected) {
          // Clear grace period update interval
          const existingInterval = gracePeriodIntervals.get(matchId);
          if (existingInterval) {
            clearInterval(existingInterval);
            gracePeriodIntervals.delete(matchId);
          }
          
          // Notify both players game is resuming
          broadcastToMatch(matchId, {
            type: 'OPPONENT_RECONNECTED',
            data: {
              timers_resumed: true,
            },
          });
        }
      }

      if (clients.get(matchId)!.size === 2 && game.status === 'WAITING') {
        GameStateManager.startGame(matchId, handleTimeout, handleTimerUpdate);
        await MatchModel.updateStatus(matchId, 'IN_PROGRESS');

        broadcastToMatch(matchId, {
          type: 'GAME_START',
          data: {
            initial_grid: game.player1.grid,
            solution_grid: game.solutionGrid, // Send solution for client-side validation
            player1_time_remaining: game.player1.timeRemaining,
            player2_time_remaining: game.player2.timeRemaining,
          },
        });
      }

      ws.send(JSON.stringify({
        type: 'GAME_STATE',
        data: {
          status: game.status,
          your_slot: playerSlot.slot,
          your_name: profile.display_name,
          opponent_name: opponentProfile?.display_name || 'Opponent',
          opponent_rating: opponentRating?.rating || 1500,
          player1: {
            score: game.player1.score,
            cells_completed: game.player1.cellsCompleted,
            time_remaining: game.player1.timeRemaining,
            is_locked: game.player1.isLocked,
          },
          player2: {
            score: game.player2.score,
            cells_completed: game.player2.cellsCompleted,
            time_remaining: game.player2.timeRemaining,
            is_locked: game.player2.isLocked,
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

      ws.on('close', async () => {
        const game = GameStateManager.getGame(matchId);
        const wasInProgress = game?.status === 'IN_PROGRESS';
        const remainingClients = clients.get(matchId)?.size || 0;
        
        console.log(`[WS] DISCONNECT userId=${ws.userId} playerId=${profile.id} matchId=${matchId} gameStatus=${game?.status || 'N/A'} remainingClients=${remainingClients}`);
        
        clients.get(matchId)?.delete(ws);
        
        if (clients.get(matchId)?.size === 0) {
          clients.delete(matchId);
          console.log(`[WS] No clients remaining for match ${matchId}, cleaned up`);
        } else if (wasInProgress) {
          // Start disconnect handling
          GameStateManager.handleDisconnect(matchId, profile.id, async (matchId) => {
            await endGame(matchId);
          });
          
          // Notify remaining player
          broadcastToMatch(matchId, {
            type: 'OPPONENT_DISCONNECTED',
            data: {
              grace_period_seconds: 15,
              your_timer_paused: true,
            },
          });
          
          // Start sending grace period updates every second
          const graceUpdateInterval = setInterval(() => {
            const currentGame = GameStateManager.getGame(matchId);
            if (!currentGame || !currentGame.disconnectTime) {
              clearInterval(graceUpdateInterval);
              gracePeriodIntervals.delete(matchId);
              return;
            }
            
            const elapsed = Date.now() - currentGame.disconnectTime;
            const remaining = Math.max(0, 15000 - elapsed);
            
            if (remaining > 0) {
              broadcastToMatch(matchId, {
                type: 'GRACE_PERIOD_UPDATE',
                data: {
                  seconds_remaining: Math.ceil(remaining / 1000),
                },
              });
            } else {
              clearInterval(graceUpdateInterval);
              gracePeriodIntervals.delete(matchId);
            }
          }, 1000);
          gracePeriodIntervals.set(matchId, graceUpdateInterval);
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
      
      try {
        const userProfile = await PlayerProfileModel.findByUserId(userId);
        if (!userProfile) {
          console.error(`❌ Player profile not found for user ${userId}`);
          return;
        }

        console.log(
          `[WS] PLACE_NUMBER from userId=${userId} playerId=${userProfile.id} row=${row} col=${col} value=${value}`
        );
        const result = GameStateManager.applyMove(matchId, userProfile.id, row, col, value);

        console.log(
          `[WS] MOVE_RESULT userId=${userId} playerId=${userProfile.id} ` +
          `success=${result.success} correct=${result.correct} ` +
          `score=${result.player.score} isLocked=${result.player.isLocked} ` +
          `cellsCompleted=${result.player.cellsCompleted} timeRemaining=${result.player.timeRemaining} gameEnded=${result.gameEnded}`
        );

        if (result.success) {
          const game = GameStateManager.getGame(matchId);
          const timerValues = game ? GameStateManager.getTimerValues(matchId) : null;
          
          broadcastToMatch(matchId, {
            type: 'MOVE_RESULT',
            data: {
              player_id: userProfile.id,
              slot: result.player.slot,
              row,
              col,
              value,
              correct: result.correct,
              time_change: result.correct ? TIME_BONUS_CORRECT : -TIME_PENALTY_INCORRECT,
              player_state: {
                slot: result.player.slot,
                score: result.player.score,
                cells_completed: result.player.cellsCompleted,
                is_locked: result.player.isLocked,
                is_solved: result.player.isSolved,
                time_remaining: result.player.timeRemaining,
              },
              game_ended: result.gameEnded || false,
              winner_slot: result.winner || null,
              timer_update: timerValues ? {
                player1_time_remaining: timerValues.player1,
                player2_time_remaining: timerValues.player2,
              } : null,
            },
          });

          if (result.gameEnded) {
            console.log(`[WS] gameEnded=true, calling endGame for match ${matchId}`);
            await endGame(matchId);
          }
        } else {
          // Log why the move was rejected (locked out or timed out)
          console.log(
            `[WS] MOVE_REJECTED userId=${userId} playerId=${userProfile.id} ` +
            `isLocked=${result.player.isLocked} ` +
            `timeRemaining=${result.player.timeRemaining}`
          );
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
                score: result.player.score,
                cells_completed: result.player.cellsCompleted,
                is_locked: result.player.isLocked,
                is_solved: result.player.isSolved,
                time_remaining: result.player.timeRemaining,
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
    case 'FORFEIT':
      try {
        const userProfile = await PlayerProfileModel.findByUserId(userId);
        if (!userProfile) {
          console.error(`❌ Player profile not found for user ${userId}`);
          return;
        }

        const game = GameStateManager.getGame(matchId);
        if (!game || game.status !== 'IN_PROGRESS') {
          console.log(`[WS] FORFEIT ignored: match ${matchId} not in progress`);
          return;
        }

        console.log(`[WS] FORFEIT from userId=${userId} playerId=${userProfile.id} in match ${matchId}`);
        // Mark forfeit in game state and then end the game (ratings, stats, GAME_END)
        GameStateManager.forfeit(matchId, userProfile.id);
        await endGame(matchId);
      } catch (error) {
        console.error(`❌ Error handling FORFEIT:`, error);
      }
      break;
    case 'PING':
      ws.send(JSON.stringify({ type: 'PONG' }));
      break;
    // CLAIM_DISCONNECT_WIN removed - players must wait for grace period to expire
    // Disconnected players will automatically forfeit after 15 seconds
    case 'EMOTE':
      try {
        const userProfile = await PlayerProfileModel.findByUserId(userId);
        if (!userProfile) {
          console.error(`❌ Player profile not found for user ${userId}`);
          return;
        }

        const match = await MatchModel.findById(matchId);
        if (!match) {
          return;
        }

        const players = await MatchModel.getPlayers(matchId);
        const playerSlot = players.find(p => p.player_id === userProfile.id);
        if (!playerSlot) {
          return;
        }

        // Broadcast emote to opponent only
        const emoteData = {
          type: 'EMOTE',
          data: {
            emote: data.emote,
            from_slot: playerSlot.slot,
          },
        };
        
        // Send to all other clients in the match (not sender)
        clients.get(matchId)?.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(emoteData));
          }
        });
      } catch (error) {
        console.error(`❌ Error handling EMOTE:`, error);
      }
      break;
    case 'REMATCH_REQUEST':
      try {
        const userProfile = await PlayerProfileModel.findByUserId(userId);
        if (!userProfile) {
          console.error(`❌ Player profile not found for user ${userId}`);
          return;
        }

        const match = await MatchModel.findById(matchId);
        if (!match) {
          return;
        }

        const players = await MatchModel.getPlayers(matchId);
        const playerSlot = players.find(p => p.player_id === userProfile.id);
        if (!playerSlot) {
          return;
        }

        const existing = rematchRequests.get(matchId);
        
        // Check if opponent already requested rematch
        if (existing && existing.requestedBy !== userProfile.id) {
          // Both players requested - create new match!
          const opponentSlot = players.find(p => p.player_id !== userProfile.id);
          if (!opponentSlot) {
            return;
          }

          // Get a random puzzle for the rematch
          const puzzle = await PuzzleModel.getRandomByLadder(1);
          if (!puzzle) {
            console.error('❌ No puzzle available for rematch');
            return;
          }

          // Create new match
          const newMatch = await MatchModel.create(1, puzzle.id);
          
          // Add both players to new match (keep same slots)
          const player1Rating = await PlayerRatingModel.findByPlayerAndLadder(userProfile.id, 1);
          const player2Rating = await PlayerRatingModel.findByPlayerAndLadder(opponentSlot.player_id, 1);
          
          await MatchModel.addPlayer(
            newMatch.id,
            userProfile.id,
            playerSlot.slot,
            player1Rating?.rating || 1500,
            player1Rating?.rd || 350,
            player1Rating?.volatility || 0.06
          );
          
          await MatchModel.addPlayer(
            newMatch.id,
            opponentSlot.player_id,
            opponentSlot.slot,
            player2Rating?.rating || 1500,
            player2Rating?.rd || 350,
            player2Rating?.volatility || 0.06
          );

          // Send rematch accepted directly to both players
          console.log(`🔄 Rematch accepted! Sending REMATCH_ACCEPTED to match ${matchId} with new_match_id ${newMatch.id}`);
          console.log(`   Player 1: ${userProfile.id}, Player 2: ${opponentSlot.player_id}`);
          
          const rematchMessage = {
            type: 'REMATCH_ACCEPTED',
            data: { new_match_id: newMatch.id },
          };
          const rematchMessageStr = JSON.stringify(rematchMessage);
          
          // Send to all clients connected to the old match
          const matchClients = clients.get(matchId);
          if (matchClients) {
            console.log(`   Sending to ${matchClients.size} connected clients`);
            let sentCount = 0;
            matchClients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                try {
                  client.send(rematchMessageStr);
                  sentCount++;
                  console.log(`   ✅ Sent REMATCH_ACCEPTED to client (userId: ${(client as any).userId})`);
                } catch (error) {
                  console.error(`   ❌ Error sending to client:`, error);
                }
              } else {
                console.log(`   ⚠️ Client not OPEN (readyState: ${client.readyState})`);
              }
            });
            console.log(`   📤 Successfully sent to ${sentCount} client(s)`);
          } else {
            console.log(`   ⚠️ No clients found for match ${matchId}`);
          }
          
          // Also try to send via broadcast as fallback
          broadcastToMatch(matchId, rematchMessage);

          rematchRequests.delete(matchId);
        } else {
          // Store request with 10-second expiry
          rematchRequests.set(matchId, {
            requestedBy: userProfile.id,
            expiresAt: Date.now() + 10000,
          });

          // Broadcast rematch pending
          broadcastToMatch(matchId, {
            type: 'REMATCH_PENDING',
            data: {
              requested_by: playerSlot.slot,
              expires_at: Date.now() + 10000,
            },
          });

          // Auto-expire after 10 seconds
          setTimeout(() => {
            const current = rematchRequests.get(matchId);
            if (current && current.requestedBy === userProfile.id) {
              rematchRequests.delete(matchId);
              broadcastToMatch(matchId, {
                type: 'REMATCH_DECLINED',
              });
            }
          }, 10000);
        }
      } catch (error) {
        console.error(`❌ Error handling REMATCH_REQUEST:`, error);
      }
      break;
    case 'REMATCH_CANCEL':
      try {
        const userProfile = await PlayerProfileModel.findByUserId(userId);
        if (!userProfile) {
          return;
        }

        const existing = rematchRequests.get(matchId);
        if (existing && existing.requestedBy === userProfile.id) {
          rematchRequests.delete(matchId);
          broadcastToMatch(matchId, {
            type: 'REMATCH_DECLINED',
          });
        }
      } catch (error) {
        console.error(`❌ Error handling REMATCH_CANCEL:`, error);
      }
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
  const game = GameStateManager.getGame(matchId);
  if (game) {
    // Include score and other state in TIME_SYNC so frontend stays in sync
    broadcastToMatch(matchId, {
      type: 'TIME_SYNC',
      data: {
        player1_time: game.player1.timeRemaining,
        player2_time: game.player2.timeRemaining,
        player1_locked: game.player1.isLocked,
        player2_locked: game.player2.isLocked,
        player1_score: game.player1.score,
        player2_score: game.player2.score,
        player1_cells_completed: game.player1.cellsCompleted,
        player2_cells_completed: game.player2.cellsCompleted,
      },
    });
  }
}

async function endGame(matchId: number) {
  console.log(`🎬 endGame CALLED for match ${matchId}`);

  const game = GameStateManager.getGame(matchId);
  console.log(`🎮 Game exists:`, !!game);
  console.log(`🎮 Game status:`, game?.status);

  if (!game) {
    console.log(`⚠️ endGame early return - game doesn't exist`);
    return;
  }

  // Only proceed if game is still IN_PROGRESS (allow multiple calls but only process once)
  if (game.status === 'COMPLETED') {
    console.log(`⚠️ endGame early return - game already completed`);
    return;
  }

  // Set status to COMPLETED immediately to prevent race conditions
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
      livesUsed: 0, // No longer using lives
      livesRemaining: 0, // No longer using lives
      mistakes: results.player1.mistakes,
      timeSpentSeconds: 0, // Not tracking time spent in new system
      finalState: results.player1.finalState,
      isWinner: results.player1.isWinner,
      ratingAfter: newRatings.player1.rating,
      rdAfter: newRatings.player1.rd,
      volatilityAfter: newRatings.player1.volatility,
      timeAtFinish: results.player1.timeRemaining ?? null,
      longestCellStreak: results.player1.longestCellStreak ?? 0,
    });
    console.log(`✅ [6/6a] Player 1 stats saved`);

    console.log(`💾 [6/6] Saving player stats for player ${results.player2.playerId}...`);
    await MatchModel.updatePlayerStats(matchId, results.player2.playerId, {
      cellsCompleted: results.player2.cellsCompleted,
      livesUsed: 0, // No longer using lives
      livesRemaining: 0, // No longer using lives
      mistakes: results.player2.mistakes,
      timeSpentSeconds: 0, // Not tracking time spent in new system
      finalState: results.player2.finalState,
      isWinner: results.player2.isWinner,
      ratingAfter: newRatings.player2.rating,
      rdAfter: newRatings.player2.rd,
      volatilityAfter: newRatings.player2.volatility,
      timeAtFinish: results.player2.timeRemaining ?? null,
      longestCellStreak: results.player2.longestCellStreak ?? 0,
    });
    console.log(`✅ [6/6b] Player 2 stats saved`);

    // Update win streaks and peak rating (if columns exist)
    console.log(`💾 [7/7] Updating win streaks and peak ratings...`);
    try {
      const { query } = await import('../config/database');
      
      // Update player 1 win streak and peak rating
      if (results.player1.isWinner) {
        await query(`
          UPDATE player_profiles 
          SET current_win_streak = current_win_streak + 1,
              best_win_streak = GREATEST(best_win_streak, current_win_streak + 1),
              peak_rating = GREATEST(peak_rating, $1)
          WHERE id = $2
        `, [newRatings.player1.rating, results.player1.playerId]);
      } else {
        await query(`
          UPDATE player_profiles 
          SET current_win_streak = 0,
              peak_rating = GREATEST(peak_rating, $1)
          WHERE id = $2
        `, [newRatings.player1.rating, results.player1.playerId]);
      }
      
      // Update player 2 win streak and peak rating
      if (results.player2.isWinner) {
        await query(`
          UPDATE player_profiles 
          SET current_win_streak = current_win_streak + 1,
              best_win_streak = GREATEST(best_win_streak, current_win_streak + 1),
              peak_rating = GREATEST(peak_rating, $1)
          WHERE id = $2
        `, [newRatings.player2.rating, results.player2.playerId]);
      } else {
        await query(`
          UPDATE player_profiles 
          SET current_win_streak = 0,
              peak_rating = GREATEST(peak_rating, $1)
          WHERE id = $2
        `, [newRatings.player2.rating, results.player2.playerId]);
      }
      console.log(`✅ [7/7] Win streaks and peak ratings updated`);
    } catch (error: any) {
      // If columns don't exist (migration not run), skip this step
      if (error.message && error.message.includes('column') && (error.message.includes('current_win_streak') || error.message.includes('peak_rating'))) {
        console.warn(`[endGame] Win streak columns not found, skipping (migration may not be run)`);
      } else {
        // Log other errors but don't fail the game end
        console.error(`[endGame] Error updating win streaks:`, error);
      }
    }

    // Clear matchmaking cache for this match so players can join new games
    MatchmakingService.clearMatch(matchId);

    console.log(`📤 Broadcasting GAME_END...`);
    
    // Determine winner slot and reason
    let winnerSlot: 1 | 2 | null = null;
    let reason: 'PUZZLE_SOLVED' | 'TIMEOUT_SCORE' | 'DRAW' | 'FORFEIT' = 'DRAW';
    
    if (results.winnerId === results.player1.playerId) {
      winnerSlot = 1;
    } else if (results.winnerId === results.player2.playerId) {
      winnerSlot = 2;
    }

    // Determine reason: FORFEIT override if set, otherwise based on final states
    if (game?.forfeitWinnerId != null) {
      reason = 'FORFEIT';
    } else if (winnerSlot === null) {
      reason = 'DRAW';
    } else {
      const winnerResult = winnerSlot === 1 ? results.player1 : results.player2;
      reason = winnerResult.finalState === 'SOLVED' ? 'PUZZLE_SOLVED' : 'TIMEOUT_SCORE';
    }
    
    broadcastToMatch(matchId, {
      type: 'GAME_END',
      data: {
        winner_slot: winnerSlot,
        reason,
        final_scores: {
          player1: results.player1.score,
          player2: results.player2.score,
        },
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
