import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { GameStateManager } from './gameStateManager';
import { MatchModel } from '../models/Match';
import { PuzzleModel } from '../models/Puzzle';
import { PlayerProfileModel } from '../models/PlayerProfile';
import { PlayerRatingModel } from '../models/PlayerRating';
import { UserModel } from '../models/User';
import { RatingService } from './ratingService';
import { MatchmakingService } from './matchmakingService';
import { cache, CacheKeys } from './cacheService';
import { HeadToHeadModel } from '../models/HeadToHead';
import { TIME_BONUS_CORRECT, TIME_PENALTY_INCORRECT, STARTING_TIME_SECONDS } from '../constants';
import { query } from '../config/database';
import { 
  initBotState, 
  cleanupBotState, 
  calculateNextBotMove, 
  getBotMoveDelay, 
  setBotMoveTimer,
  getBotDisplayName,
  getBotDisplayRating,
  getBotState,
  startBotLoop,
  stopBotLoop,
  isBot
} from './botService';
import { getBotMatchInfo, clearBotMatchInfo } from './matchmakingService';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  matchId?: number;
  playerId?: number; // Cached on connection to avoid DB lookup in time-critical handlers
}

const clients = new Map<number, Set<AuthenticatedWebSocket>>();
const gracePeriodIntervals = new Map<number, NodeJS.Timeout>();
const rematchRequests = new Map<number, { requestedBy: number; expiresAt: number }>();
const botMatches = new Map<number, boolean>(); // Track which matches are bot matches

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

      // Check if this is a bot match (either legacy first-match bot or queue-based bot)
      const botMatchInfo = getBotMatchInfo(matchId);
      const isBotMatch = (match as any).is_bot_match === true || botMatchInfo !== undefined;
      if (isBotMatch) {
        botMatches.set(matchId, true);
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
      
      // Store playerId on WebSocket for quick access (avoids DB lookup in FORFEIT handler)
      ws.playerId = profile.id;
      
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

      // For bot matches, identify the bot player (player_id is NULL or the is_bot flag is true)
      const botPlayerSlot = players.find(p => (p as any).is_bot === true);
      const humanPlayerSlot = players.find(p => p.player_id === profile.id);

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

        // For bot matches, identify which player is the bot
        // Queue-based bots have real player_ids, legacy bots have NULL player_id
        let player1Id: number;
        let player2Id: number;
        
        if (isBotMatch) {
          const botMatch = getBotMatchInfo(matchId);
          if (botMatch) {
            // Queue-based bot: bot has real player_id
            player1Id = slot1.player_id!;
            player2Id = slot2.player_id!;
          } else {
            // Legacy bot match: bot has NULL player_id
            player1Id = slot1.player_id ?? -1;
            player2Id = slot2.player_id ?? -1;
          }
        } else {
          // Regular match: both are real players
          player1Id = slot1.player_id!;
          player2Id = slot2.player_id!;
        }

        game = GameStateManager.createGame(
          matchId,
          puzzle.id,
          puzzle.initial_grid,
          puzzle.solution_grid,
          Number(player1Id),
          Number(player2Id),
          STARTING_TIME_SECONDS
        );

        // Initialize bot state if this is a bot match
        if (isBotMatch) {
          initBotState(matchId);
        }
      }

      // Compute opponent info for this connection
      const opponentRow = players.find(p => p.player_id !== profile.id)!;
      let opponentName: string;
      let opponentRatingValue: number;
      let opponentIsPremium: boolean;

      // Check if opponent is a bot
      const botMatch = getBotMatchInfo(matchId);
      const isOpponentBot = botMatch ? botMatch.botPlayerId === opponentRow.player_id :
                            (isBotMatch && ((opponentRow as any).is_bot || !opponentRow.player_id));

      if (isOpponentBot) {
        // Determine if this is a legacy first-match bot or queue-based bot
        const isLegacyBot = !opponentRow.player_id;
        
        if (isLegacyBot) {
          // Legacy first-match bot: always named "Sudobot"
          opponentName = 'Sudobot';
          opponentRatingValue = getBotDisplayRating();
        } else if (botMatch) {
          // Queue-based bot: get display name from profile
          const botProfile = await PlayerProfileModel.findById(opponentRow.player_id);
          opponentName = botProfile?.display_name || 'Bot';
          opponentRatingValue = botMatch.botRating;
        } else {
          // Queue-based bot but missing botMatch info - get from DB
          const botProfile = await PlayerProfileModel.findById(opponentRow.player_id);
          const botRating = await PlayerRatingModel.findByPlayerAndLadder(opponentRow.player_id, 1);
          opponentName = botProfile?.display_name || 'Bot';
          opponentRatingValue = botRating?.rating || 1500;
        }
        opponentIsPremium = false;
      } else {
        // Human opponent
        const opponentProfile = await PlayerProfileModel.findById(opponentRow.player_id);
        const opponentRating = await PlayerRatingModel.findByPlayerAndLadder(opponentRow.player_id, 1);
        opponentName = opponentProfile?.display_name || 'Opponent';
        opponentRatingValue = opponentRating?.rating || 1500;
        opponentIsPremium = opponentProfile?.is_premium || false;
      }

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

      // For bot matches, start with 1 client; for regular matches, need 2 clients
      const clientsNeeded = isBotMatch ? 1 : 2;
      const currentClients = clients.get(matchId)!.size;
      
      if (currentClients >= clientsNeeded && game.status === 'WAITING') {
        // Mark game as starting (prevents re-triggering)
        (game as any).status = 'STARTING';
        
        // Send countdown to both players
        const countdownStartTime = Date.now();
        console.log(`[TIMING] Match ${matchId} sending GAME_COUNTDOWN at ${countdownStartTime}`);
        broadcastToMatch(matchId, {
          type: 'GAME_COUNTDOWN',
          data: { 
            seconds: 3,
            server_timestamp: countdownStartTime,
          },
        });
        
        // Wait for countdown, then start
        setTimeout(async () => {
          const currentGame = GameStateManager.getGame(matchId);
          if (!currentGame) return;
          
          const preDbTime = Date.now();
          GameStateManager.startGame(matchId, handleTimeout, handleTimerUpdate);
          await MatchModel.updateStatus(matchId, 'IN_PROGRESS');
          const postDbTime = Date.now();
          console.log(`[TIMING] Match ${matchId} DB update took ${postDbTime - preDbTime}ms`);
          
          const now = Date.now();
          // Calculate when gameplay should actually start (after client countdown animation)
          // Client countdown is 4800ms, add 200ms network buffer for synchronization
          const COUNTDOWN_ANIMATION_MS = 4800;
          const NETWORK_BUFFER_MS = 200;
          const playAtTimestamp = now + COUNTDOWN_ANIMATION_MS + NETWORK_BUFFER_MS;
          
          console.log(`[TIMING] Match ${matchId} sending GAME_START at ${now}, play_at: ${playAtTimestamp} (${playAtTimestamp - now}ms from now)`);
          broadcastToMatch(matchId, {
            type: 'GAME_START',
            data: {
              server_timestamp: now,
              game_start_time: now,
              play_at_timestamp: playAtTimestamp, // Synchronized start time
              initial_grid: currentGame.player1.grid,
              solution_grid: currentGame.solutionGrid,
              player1_time_remaining: currentGame.player1.timeRemaining,
              player2_time_remaining: currentGame.player2.timeRemaining,
              is_bot_match: isBotMatch,
            },
          });

          // Start bot move loop for bot matches
          if (isBotMatch) {
            let botMatch = getBotMatchInfo(matchId);
            
            // If botMatchInfo is missing but this is a queue-based bot match,
            // try to reconstruct bot info from match players and player_profiles
            if (!botMatch && (match as any).is_bot_match === true) {
              // Query match_players joined with player_profiles to find the bot
              const botResult = await query(
                `SELECT mp.player_id, pp.is_bot, pr.rating
                 FROM match_players mp
                 JOIN player_profiles pp ON pp.id = mp.player_id
                 JOIN player_ratings pr ON pr.player_id = mp.player_id AND pr.ladder_id = 1
                 WHERE mp.match_id = $1 AND pp.is_bot = TRUE`,
                [matchId]
              );
              
              if (botResult.rows.length > 0) {
                const botRow = botResult.rows[0];
                botMatch = {
                  botPlayerId: botRow.player_id,
                  botRating: botRow.rating,
                };
              }
            }
            
            if (botMatch) {
              // Queue-based bot match: use new bot system
              startBotLoop(
                matchId,
                botMatch.botPlayerId,
                botMatch.botRating,
                handleBotMove,
                () => {} // onGameEnd - endGame handles cleanup
              );
            } else {
              // Legacy first-match bot: use old bot system
              startBotMoveLoop(matchId);
            }
          }
        }, 3000);
      }

      // Send GAME_STATE - use 'STARTING' if game is starting, otherwise use actual status
      const statusToSend = (game as any).status === 'STARTING' ? 'WAITING' : game.status;
      ws.send(JSON.stringify({
        type: 'GAME_STATE',
        data: {
          status: statusToSend,
          your_slot: playerSlot.slot,
          your_name: profile.display_name,
          opponent_name: opponentName,
          opponent_rating: opponentRatingValue,
          opponent_is_premium: opponentIsPremium,
          is_bot_match: isBotMatch,
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
        
        clients.get(matchId)?.delete(ws);
        
        if (clients.get(matchId)?.size === 0) {
          clients.delete(matchId);
          // Clear matchmaking cache so players can join new games
          MatchmakingService.clearMatch(matchId);
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
  const playerId = ws.playerId!; // Cached on connection to avoid DB lookup in time-critical handlers

  switch (type) {
    case 'PLACE_NUMBER':
      const { row, col, value } = data;
      
      try {
        // Use cached playerId - NO DB lookup needed!
        if (!playerId) {
          console.error(`❌ No cached playerId for user ${userId}`);
          return;
        }

        const result = GameStateManager.applyMove(matchId, playerId, row, col, value);

        if (result.success) {
          const game = GameStateManager.getGame(matchId);
          const timerValues = game ? GameStateManager.getTimerValues(matchId) : null;
          
          // Get opponent state for the broadcast (compare by slot, not object reference)
          const opponent = game ? (result.player.slot === 1 ? game.player2 : game.player1) : null;
          
          broadcastToMatch(matchId, {
            type: 'MOVE_RESULT',
            data: {
              player_id: playerId,
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
              opponent_state: opponent ? {
                slot: opponent.slot,
                score: opponent.score,
                cells_completed: opponent.cellsCompleted,
                is_locked: opponent.isLocked,
                is_solved: opponent.isSolved,
                time_remaining: opponent.timeRemaining,
              } : null,
              game_ended: result.gameEnded || false,
              winner_slot: result.winner || null,
              timer_update: timerValues ? {
                player1_time_remaining: timerValues.player1,
                player2_time_remaining: timerValues.player2,
              } : null,
            },
          });

          if (result.gameEnded) {
            try {
              await endGame(matchId);
            } catch (error) {
              console.error(`[WS] CRITICAL: Error in endGame for match ${matchId}:`, error);
              // Try to send GAME_END message even if endGame fails
              const finalGame = GameStateManager.getGame(matchId);
              if (finalGame) {
                try {
                  const finalResults = GameStateManager.getFinalResults(matchId);
                  if (finalResults) {
                    broadcastToMatch(matchId, {
                      type: 'GAME_END',
                      data: {
                        winner_slot: finalResults.resultCode === 1 ? 1 : finalResults.resultCode === 2 ? 2 : null,
                        reason: 'TIMEOUT_SCORE',
                        is_ranked: true,
                        final_scores: {
                          player1: finalResults.player1.score,
                          player2: finalResults.player2.score,
                        },
                        player1: finalResults.player1,
                        player2: finalResults.player2,
                      },
                    });
                  }
                } catch (err) {
                  console.error(`[WS] Failed to send fallback GAME_END:`, err);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error applying move:`, error);
      }
      break;
    case 'ERASE_CELL':
      const { row: eraseRow, col: eraseCol } = data;
      
      try {
        // Use cached playerId - NO DB lookup needed!
        if (!playerId) {
          console.error(`❌ No cached playerId for user ${userId}`);
          return;
        }
        
        const result = GameStateManager.eraseCell(matchId, playerId, eraseRow, eraseCol);

        if (result.success) {
          const game = GameStateManager.getGame(matchId);
          const timerValues = game ? GameStateManager.getTimerValues(matchId) : null;
          
          broadcastToMatch(matchId, {
            type: 'ERASE_RESULT',
            data: {
              player_id: playerId,
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
    // FORFEIT case removed - forfeit only happens via disconnect (grace period expiry)
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
          const rematchMessage = {
            type: 'REMATCH_ACCEPTED',
            data: { new_match_id: newMatch.id },
          };
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
  if (!matchClients) {
    console.log(`[BROADCAST] Match ${matchId} - NO CLIENTS in map for message type: ${message.type}`);
    return;
  }
  
  const messageStr = JSON.stringify(message);
  let sentCount = 0;
  let closedCount = 0;
  
  matchClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
      sentCount++;
    } else {
      closedCount++;
    }
  });
  
  // Log TIME_SYNC delivery (but not every second - only if there's an issue)
  if (message.type === 'TIME_SYNC' && (sentCount === 0 || closedCount > 0)) {
    console.log(`[BROADCAST] Match ${matchId} TIME_SYNC - sent: ${sentCount}, closed: ${closedCount}, total: ${matchClients.size}`);
  }
  
  // Always log non-TIME_SYNC important messages
  if (message.type !== 'TIME_SYNC') {
    console.log(`[BROADCAST] Match ${matchId} ${message.type} - sent to ${sentCount}/${matchClients.size} clients`);
  }
}

async function handleTimeout(matchId: number) {
  await endGame(matchId);
}

function handleTimerUpdate(matchId: number) {
  const game = GameStateManager.getGame(matchId);
  if (game) {
    // Include score and other state in TIME_SYNC so frontend stays in sync
    broadcastToMatch(matchId, {
      type: 'TIME_SYNC',
      data: {
        server_timestamp: Date.now(),
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

/**
 * Start the bot move loop for a bot match
 * Bot makes moves every 8-12 seconds, with one intentional mistake around 2 minutes
 */
function startBotMoveLoop(matchId: number) {
  const runBotMove = async () => {
    const game = GameStateManager.getGame(matchId);
    if (!game || game.status !== 'IN_PROGRESS') {
      cleanupBotState(matchId);
      return;
    }

    // Bot is player 2 (slot 2)
    const botPlayer = game.player2;
    
    // Don't make moves if bot is locked out
    if (botPlayer.isLocked) {
      return;
    }

    // Don't make moves if human has already won
    if (game.player1.isSolved) {
      return;
    }

    const elapsedMs = game.startedAt ? Date.now() - game.startedAt : 0;
    
    // Get the bot's current view of the grid (we use the solution grid for reference)
    const botMove = calculateNextBotMove(
      matchId,
      game.solutionGrid,
      botPlayer.grid,
      elapsedMs
    );

    if (botMove) {
      if (botMove.isMistake) {
        // Bot makes a mistake - loses time and doesn't score
        botPlayer.mistakes++;
        botPlayer.timeRemaining = Math.max(0, botPlayer.timeRemaining - 10);
        
        // Check if bot locked out
        if (botPlayer.timeRemaining <= 0) {
          botPlayer.isLocked = true;
        }
        
        // Broadcast the mistake (opponent sees bot lose time)
        broadcastToMatch(matchId, {
          type: 'MOVE_RESULT',
          data: {
            player_id: -1, // Bot ID
            slot: 2,
            row: botMove.row,
            col: botMove.col,
            value: botMove.value,
            correct: false,
            time_change: -10,
            player_state: {
              slot: 2,
              score: botPlayer.score,
              cells_completed: botPlayer.cellsCompleted,
              is_locked: botPlayer.isLocked,
              is_solved: false,
              time_remaining: botPlayer.timeRemaining,
            },
            game_ended: false,
            winner_slot: null,
          },
        });
      } else {
        // Bot makes a correct move
        botPlayer.grid[botMove.row][botMove.col] = botMove.value;
        botPlayer.score++;
        botPlayer.cellsCompleted++;
        botPlayer.timeRemaining += 3; // TIME_BONUS_CORRECT
        
        // Broadcast the move
        broadcastToMatch(matchId, {
          type: 'MOVE_RESULT',
          data: {
            player_id: -1, // Bot ID
            slot: 2,
            row: botMove.row,
            col: botMove.col,
            value: botMove.value,
            correct: true,
            time_change: 3,
            player_state: {
              slot: 2,
              score: botPlayer.score,
              cells_completed: botPlayer.cellsCompleted,
              is_locked: botPlayer.isLocked,
              is_solved: botPlayer.cellsCompleted === 81,
              time_remaining: botPlayer.timeRemaining,
            },
            game_ended: false,
            winner_slot: null,
          },
        });

        // Check if bot somehow solved (shouldn't happen in practice)
        if (botPlayer.cellsCompleted === 81) {
          botPlayer.isSolved = true;
          await endGame(matchId);
          cleanupBotState(matchId);
          return;
        }
      }

      // Check victory conditions after bot move
      // If human is locked and bot surpassed their score
      if (game.player1.isLocked && botPlayer.score > game.player1.score) {
        await endGame(matchId);
        cleanupBotState(matchId);
        return;
      }
    }

    // Schedule next bot move
    if (game.status === 'IN_PROGRESS' && !botPlayer.isLocked) {
      const delay = getBotMoveDelay();
      const timer = setTimeout(runBotMove, delay);
      setBotMoveTimer(matchId, timer);
    }
  };

  // Start first bot move after initial delay
  const firstMoveDelay = getBotMoveDelay();
  const timer = setTimeout(runBotMove, firstMoveDelay);
  setBotMoveTimer(matchId, timer);
}

/**
 * Handle bot move for queue-based bot matches
 */
async function handleBotMove(
  matchId: number,
  botPlayerId: number,
  row: number,
  col: number,
  value: number
) {
  const result = GameStateManager.applyMove(matchId, botPlayerId, row, col, value);

  if (!result.success) {
    console.log(`🤖 [MATCH ${matchId}] Bot move FAILED: row=${row}, col=${col}, value=${value}`);
    return;
  }
  
  // Log bot progress toward puzzle completion
  console.log(`🤖 [MATCH ${matchId}] Bot cellsCompleted=${result.player.cellsCompleted}/81, score=${result.player.score}, gameEnded=${result.gameEnded}`);

  // CRITICAL: Manually verify bot's actual grid state vs cellsCompleted
  // Count actual filled cells in bot's grid
  let actualFilledCells = 0;
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (result.player.grid[row] && result.player.grid[row][col] !== 0) {
        actualFilledCells++;
      }
    }
  }
  
  if (actualFilledCells !== result.player.cellsCompleted) {
    console.log(`🤖 [MATCH ${matchId}] MISMATCH: Bot actualFilledCells=${actualFilledCells} but cellsCompleted=${result.player.cellsCompleted}`);
  }
  
  // CRITICAL: Manually check if bot has completed puzzle (similar to legacy bot system)
  // This handles cases where cellsCompleted might not be accurate due to race conditions
  if (!result.gameEnded && (result.player.cellsCompleted >= 81 || actualFilledCells >= 81)) {
    console.log(`🤖 [MATCH ${matchId}] Bot puzzle complete! cellsCompleted=${result.player.cellsCompleted}, actualFilledCells=${actualFilledCells}, gameEnded=${result.gameEnded} - manually triggering game end`);
    result.player.isSolved = true;
    result.player.cellsCompleted = Math.max(result.player.cellsCompleted, actualFilledCells);
    result.gameEnded = true;
    result.winner = result.player.slot;
  }

  const game = GameStateManager.getGame(matchId);
  if (!game) return;

  // Get opponent (human) state for the broadcast (compare by slot, not object reference)
  const opponent = result.player.slot === 1 ? game.player2 : game.player1;
  const timerValues = GameStateManager.getTimerValues(matchId);

  // Broadcast to human player
  broadcastToMatch(matchId, {
    type: 'MOVE_RESULT',
    data: {
      player_id: botPlayerId,
      slot: result.player.slot,
      row,
      col,
      value: result.correct ? value : 0,
      correct: result.correct,
      time_change: result.correct ? TIME_BONUS_CORRECT : -TIME_PENALTY_INCORRECT,
      player_state: {
        slot: result.player.slot,
        score: result.player.score,
        cells_completed: result.player.cellsCompleted,
        mistakes: result.player.mistakes,
        time_remaining: result.player.timeRemaining,
        is_locked: result.player.isLocked,
        is_solved: result.player.isSolved,
      },
      opponent_state: opponent ? {
        slot: opponent.slot,
        score: opponent.score,
        cells_completed: opponent.cellsCompleted,
        is_locked: opponent.isLocked,
        is_solved: opponent.isSolved,
        time_remaining: opponent.timeRemaining,
      } : null,
      game_ended: result.gameEnded || false,
      winner_slot: result.winner || null,
      timer_update: timerValues ? {
        player1_time_remaining: timerValues.player1,
        player2_time_remaining: timerValues.player2,
      } : null,
    },
  });

  if (result.gameEnded) {
    console.log(`🤖 [MATCH ${matchId}] Bot triggered game end! Calling endGame...`);
    try {
      await endGame(matchId);
      console.log(`🤖 [MATCH ${matchId}] endGame completed successfully`);
    } catch (error) {
      console.error(`[WS] CRITICAL: Error in endGame for bot match ${matchId}:`, error);
    }
  }
}

async function endGame(matchId: number) {
  console.log(`[endGame] Called for match ${matchId}`);
  const game = GameStateManager.getGame(matchId);

  if (!game) {
    console.log(`[endGame] Match ${matchId}: game not found in gameStates!`);
    return;
  }

  // Only proceed if game is still IN_PROGRESS (allow multiple calls but only process once)
  if (game.status === 'COMPLETED') {
    console.log(`[endGame] Match ${matchId}: game already COMPLETED, skipping`);
    return;
  }

  // Set status to COMPLETED immediately to prevent race conditions
  console.log(`[endGame] Match ${matchId}: setting status to COMPLETED (was ${game.status})`);
  game.status = 'COMPLETED';

  const results = GameStateManager.getFinalResults(matchId);

  if (!results) {
    console.log(`[endGame] Match ${matchId}: getFinalResults returned null!`);
    return;
  }

  console.log(`🏁 Match ${matchId} ended. Winner: ${results.winnerId || 'DRAW'}`);

  // IMMEDIATE: Send preliminary GAME_END so client shows "GAME OVER!" instantly
  // Rating data will be sent in a follow-up message after DB operations complete
  const preliminaryWinnerSlot = results.winnerId === results.player1.playerId ? 1 
    : results.winnerId === results.player2.playerId ? 2 
    : null;
  const preliminaryReason = preliminaryWinnerSlot === null ? 'DRAW' 
    : (results.player1.isSolved || results.player2.isSolved) ? 'PUZZLE_SOLVED' 
    : 'TIMEOUT_SCORE';
  
  broadcastToMatch(matchId, {
    type: 'GAME_END',
    data: {
      winner_slot: preliminaryWinnerSlot,
      reason: preliminaryReason,
      is_ranked: true, // Will be confirmed after DB check
      final_scores: {
        player1: results.player1.score,
        player2: results.player2.score,
      },
      player1: {
        ...results.player1,
        // Preliminary - rating data will come in RATING_UPDATE
        rating_before: 0,
        rating_after: 0,
        rating_change: 0,
      },
      player2: {
        ...results.player2,
        rating_before: 0,
        rating_after: 0,
        rating_change: 0,
      },
    },
  });

  try {
    // Now do all the DB operations (client already has GAME_END)
    const match = await MatchModel.findById(matchId);
    const isRanked = match?.is_ranked !== false; // Default to ranked if not set
    const isBotMatch = botMatches.get(matchId) || (match as any).is_bot_match === true;

    // Clean up bot state if this is a bot match
    if (isBotMatch) {
      const botMatch = getBotMatchInfo(matchId);
      if (botMatch) {
        // Queue-based bot: stop bot loop and clear match info
        stopBotLoop(matchId);
        clearBotMatchInfo(matchId);
      } else {
        // Legacy first-match bot: use old cleanup
        cleanupBotState(matchId);
      }
      botMatches.delete(matchId);
    }

    await MatchModel.updateStatus(matchId, 'COMPLETED');
    await MatchModel.setResult(matchId, results.resultCode);

    const matchPlayers = await MatchModel.getPlayers(matchId);

    const player1Data = matchPlayers.find(p => p.slot === 1);
    const player2Data = matchPlayers.find(p => p.slot === 2);

    // For bot matches, check if it's a queue-based bot (ranked) or legacy first-match bot (unranked)
    if (isBotMatch) {
      const botMatchInfo = getBotMatchInfo(matchId);
      const isQueueBasedBot = player2Data?.player_id != null; // Queue-based bots have real player_id
      const isBotMatchRanked = isRanked && isQueueBasedBot;
      
      if (!player1Data) {
        return;
      }

      const rating1 = await PlayerRatingModel.findByPlayerAndLadder(player1Data.player_id, 1);
      if (!rating1) {
        return;
      }

      let newRatings: {
        player1: { rating: number; rd: number; volatility: number };
        player2: { rating: number; rd: number; volatility: number };
      };
      let botRatingForDisplay = getBotDisplayRating();

      if (isBotMatchRanked && player2Data?.player_id) {
        // Queue-based bot: update both ratings using Glicko-2
        const rating2 = await PlayerRatingModel.findByPlayerAndLadder(player2Data.player_id, 1);
        if (!rating2) {
          return;
        }

        botRatingForDisplay = rating2.rating;

        let outcome: number;
        if (results.winnerId === results.player1.playerId) {
          outcome = 1; // Human wins
        } else if (results.winnerId === results.player2.playerId) {
          outcome = 0; // Bot wins
        } else {
          outcome = 0.5; // Draw
        }

        newRatings = await RatingService.updateRatings(
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
      } else {
        // Legacy first-match bot: no rating changes
        newRatings = {
          player1: { rating: rating1.rating, rd: rating1.rd, volatility: rating1.volatility },
          player2: { rating: botRatingForDisplay, rd: 350, volatility: 0.06 },
        };
        
        if (botMatchInfo) {
          botRatingForDisplay = botMatchInfo.botRating;
        }
      }

      // Update human player stats
      await MatchModel.updatePlayerStats(matchId, player1Data.player_id, {
        cellsCompleted: results.player1.cellsCompleted,
        livesUsed: 0,
        livesRemaining: 0,
        mistakes: results.player1.mistakes,
        timeSpentSeconds: 0,
        finalState: results.player1.finalState,
        isWinner: results.player1.isWinner,
        ratingAfter: newRatings.player1.rating,
        rdAfter: newRatings.player1.rd,
        volatilityAfter: newRatings.player1.volatility,
        timeAtFinish: results.player1.timeRemaining ?? null,
        longestCellStreak: results.player1.longestCellStreak ?? 0,
      });

      // Update bot player stats if it's a real bot player
      if (isBotMatchRanked && player2Data?.player_id) {
        await MatchModel.updatePlayerStats(matchId, player2Data.player_id, {
          cellsCompleted: results.player2.cellsCompleted,
          livesUsed: 0,
          livesRemaining: 0,
          mistakes: results.player2.mistakes,
          timeSpentSeconds: 0,
          finalState: results.player2.finalState,
          isWinner: results.player2.isWinner,
          ratingAfter: newRatings.player2.rating,
          rdAfter: newRatings.player2.rd,
          volatilityAfter: newRatings.player2.volatility,
          timeAtFinish: results.player2.timeRemaining ?? null,
          longestCellStreak: results.player2.longestCellStreak ?? 0,
        });
      }

      // Clear matchmaking cache
      MatchmakingService.clearMatch(matchId);
      cache.invalidate(`stats:${player1Data.player_id}`);
      cache.invalidate(`history:`);
      cache.invalidate(`profile:`);

      // Determine winner slot and reason
      let winnerSlot: 1 | 2 | null = null;
      let reason: 'PUZZLE_SOLVED' | 'TIMEOUT_SCORE' | 'DRAW' | 'FORFEIT' = 'DRAW';
      
      if (results.winnerId === results.player1.playerId) {
        winnerSlot = 1;
      } else if (results.winnerId === results.player2.playerId) {
        winnerSlot = 2;
      }

      if (winnerSlot === null) {
        reason = 'DRAW';
      } else {
        const winnerResult = winnerSlot === 1 ? results.player1 : results.player2;
        reason = winnerResult.finalState === 'SOLVED' ? 'PUZZLE_SOLVED' : 'TIMEOUT_SCORE';
      }

      // Send RATING_UPDATE with final rating data (GAME_END already sent at start of endGame)
      broadcastToMatch(matchId, {
        type: 'RATING_UPDATE',
        data: {
          is_ranked: isBotMatchRanked,
          is_bot_match: true,
          player1: {
            rating_before: rating1.rating,
            rating_after: newRatings.player1.rating,
            rating_change: newRatings.player1.rating - rating1.rating,
          },
          player2: {
            rating_before: Math.round(botRatingForDisplay),
            rating_after: Math.round(newRatings.player2.rating),
            rating_change: isBotMatchRanked ? newRatings.player2.rating - botRatingForDisplay : 0,
          },
        },
      });

      setTimeout(() => {
        GameStateManager.removeGame(matchId);
        clients.delete(matchId);
      }, 30000);

      return; // Exit early for bot matches
    }

    if (!player1Data || !player2Data) {
      return;
    }

    const rating1 = await PlayerRatingModel.findByPlayerAndLadder(player1Data.player_id, 1);
    const rating2 = await PlayerRatingModel.findByPlayerAndLadder(player2Data.player_id, 1);

    if (!rating1 || !rating2) {
      return;
    }

    // Calculate new ratings only if match is ranked
    let newRatings: {
      player1: { rating: number; rd: number; volatility: number };
      player2: { rating: number; rd: number; volatility: number };
    };

    if (isRanked) {
      let outcome: number;
      if (results.winnerId === results.player1.playerId) {
        outcome = 1;
      } else if (results.winnerId === results.player2.playerId) {
        outcome = 0;
      } else {
        outcome = 0.5;
      }

      newRatings = await RatingService.updateRatings(
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
    } else {
      // Unranked match - no rating changes
      newRatings = {
        player1: {
          rating: rating1.rating,
          rd: rating1.rd,
          volatility: rating1.volatility,
        },
        player2: {
          rating: rating2.rating,
          rd: rating2.rd,
          volatility: rating2.volatility,
        },
      };
    }

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

    // Update head-to-head stats
    try {
      await HeadToHeadModel.updateAfterMatch(
        results.player1.playerId,
        results.player2.playerId,
        results.winnerId || null
      );
    } catch (error: any) {
      // Don't fail match completion if H2H update fails
    }

    // Update win streaks and peak rating (if columns exist) - only for ranked matches
    if (isRanked) {
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
      } catch (error: any) {
        // If columns don't exist (migration not run), skip silently
      }
    }

    // Clear matchmaking cache for this match so players can join new games
    MatchmakingService.clearMatch(matchId);

    // Invalidate player caches for both players
    cache.invalidate(`stats:${player1Data.player_id}`);
    cache.invalidate(`stats:${player2Data.player_id}`);
    cache.invalidate(`history:`);
    cache.invalidate(`profile:`);
    // Invalidate H2H cache for both players (they have stats against each other)
    cache.invalidate(CacheKeys.headToHead(player1Data.player_id, player2Data.player_id));
    
    // Determine winner slot and reason
    let winnerSlot: 1 | 2 | null = null;
    let reason: 'PUZZLE_SOLVED' | 'TIMEOUT_SCORE' | 'DRAW' | 'FORFEIT' = 'DRAW';
    
    if (results.winnerId === results.player1.playerId) {
      winnerSlot = 1;
    } else if (results.winnerId === results.player2.playerId) {
      winnerSlot = 2;
    }

    // CRITICAL: Check for forfeit FIRST - this must override everything
    // Check both forfeitingPlayerId and forfeitWinnerId to ensure we catch all forfeit cases
    const hasForfeit = game?.forfeitingPlayerId != null || game?.forfeitWinnerId != null;
    
    if (hasForfeit) {
      reason = 'FORFEIT';
    } else if (winnerSlot === null) {
      reason = 'DRAW';
    } else {
      const winnerResult = winnerSlot === 1 ? results.player1 : results.player2;
      reason = winnerResult.finalState === 'SOLVED' ? 'PUZZLE_SOLVED' : 'TIMEOUT_SCORE';
    }
    
    // Send RATING_UPDATE with final rating data (GAME_END already sent at start of endGame)
    broadcastToMatch(matchId, {
      type: 'RATING_UPDATE',
      data: {
        is_ranked: isRanked,
        player1: {
          rating_before: rating1.rating,
          rating_after: newRatings.player1.rating,
          rating_change: newRatings.player1.rating - rating1.rating,
        },
        player2: {
          rating_before: rating2.rating,
          rating_after: newRatings.player2.rating,
          rating_change: newRatings.player2.rating - rating2.rating,
        },
      },
    });

    setTimeout(() => {
      GameStateManager.removeGame(matchId);
      clients.delete(matchId);
    }, 30000);

  } catch (error) {
    console.error(`[endGame] Error:`, error);
  }
}
