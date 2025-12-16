import { PlayerProfileModel } from '../models/PlayerProfile';
import { PlayerRatingModel } from '../models/PlayerRating';
import { MatchmakingQueueModel } from '../models/MatchmakingQueue';
import { MatchModel } from '../models/Match';
import { PuzzleModel } from '../models/Puzzle';
import { query } from '../config/database';
import { createBotPlayer, getBotDisplayName, getBotDisplayRating, findBotNearRating } from './botService';

const DEFAULT_LADDER_ID = 1;
// Rating window is now handled by bands in MatchmakingQueueModel:
// ±50, ±100, ±200, ±300, ±500, ±750, ±1000
// This constant is kept for backwards compatibility and as a max window hint.
const RATING_WINDOW = 1000;

// Bot spawn delay: spawn bot after 12 seconds in queue
const BOT_SPAWN_DELAY_MS = 12000;

// Store active matches for players (in-memory cache)
const playerMatches = new Map<number, number>(); // playerId -> matchId

// Queue timers: track 12-second timers for bot spawning
const queueTimers = new Map<number, NodeJS.Timeout>(); // playerId -> timer

// Bot matches: track which matches are bot matches and bot info
const botMatches = new Map<number, { botPlayerId: number; botRating: number }>(); // matchId -> bot info

// Helper function to check if this is the player's first match ever
// Uses multiple checks to handle data inconsistencies
async function isFirstMatch(playerId: number): Promise<boolean> {
  // Check 1: match_players table
  const matchPlayersResult = await query(
    `SELECT COUNT(*) as count FROM match_players WHERE player_id = $1`,
    [playerId]
  );
  const matchCount = parseInt(matchPlayersResult.rows[0].count, 10);
  
  // Check 2: games_played in player_ratings (more reliable)
  const ratingsResult = await query(
    `SELECT games_played FROM player_ratings WHERE player_id = $1 AND ladder_id = 1`,
    [playerId]
  );
  const gamesPlayed = ratingsResult.rows[0]?.games_played || 0;
  
  // Player is only "first match" if BOTH indicate zero games
  const isFirst = matchCount === 0 && gamesPlayed === 0;
  
  if (matchCount !== gamesPlayed) {
    console.log(`⚠️ Data inconsistency for player ${playerId}: match_players=${matchCount}, games_played=${gamesPlayed}`);
  }
  
  console.log(`🎮 isFirstMatch check: player=${playerId}, matchCount=${matchCount}, gamesPlayed=${gamesPlayed}, result=${isFirst}`);
  
  return isFirst;
}

export const MatchmakingService = {
  async joinQueue(userId: number) {
    console.log(`🎯 Matchmaking: User ${userId} joining queue`);

    const profile = await PlayerProfileModel.findByUserId(userId);
    console.log(`👤 Profile found:`, profile?.id);

    if (!profile) {
      throw new Error('Player profile not found');
    }

    // Check if player already has an active match
    if (playerMatches.has(profile.id)) {
      const matchId = playerMatches.get(profile.id)!;
      console.log(`✅ Player ${profile.id} already has match ${matchId}`);
      return { status: 'matched', match_id: matchId };
    }

    let rating = await PlayerRatingModel.findByPlayerAndLadder(
      profile.id,
      DEFAULT_LADDER_ID
    );
    console.log(`⭐ Rating loaded:`, rating ? `rating=${rating.rating} rd=${rating.rd} games_played=${rating.games_played}` : 'NOT FOUND');

    if (!rating) {
      // Create default rating if not exists
      await PlayerRatingModel.create(profile.id, DEFAULT_LADDER_ID);
      rating = await PlayerRatingModel.findByPlayerAndLadder(
        profile.id,
        DEFAULT_LADDER_ID
      );
      console.log(`🆕 Created new rating:`, rating?.rating);
    }

    const playerRating = rating?.rating || 1500;
    const playerRd = rating?.rd || 350;

    // Check if this is the player's first match ever - create bot match
    const firstMatch = await isFirstMatch(profile.id);
    if (firstMatch) {
      console.log(`🤖 First match for player ${profile.id}, creating bot match`);
      const botMatch = await this.createBotMatch(profile.id);
      playerMatches.set(profile.id, botMatch.id);
      return { 
        status: 'matched', 
        match_id: botMatch.id,
        is_bot_match: true,
        opponent: {
          displayName: getBotDisplayName(),
          rating: getBotDisplayRating(),
          isBot: true,
        }
      };
    }

    // Check if already in queue
    const inQueue = await MatchmakingQueueModel.isPlayerInQueue(profile.id, DEFAULT_LADDER_ID);
    
    if (inQueue) {
      // Already in queue - check if we got matched while waiting
      if (playerMatches.has(profile.id)) {
        const matchId = playerMatches.get(profile.id)!;
        console.log(`✅ Match found (was in queue): ${matchId}`);
        return { status: 'matched', match_id: matchId };
      }
      // Still waiting, return queued status without logging
      return { status: 'queued', message: 'Waiting for opponent...' };
    }

    // Not in queue yet - proceed with joining
    console.log(`📋 Not in queue, joining...`);
    
    // Try to find an opponent first (excluding blocked users)
    console.log(`🔍 Looking for opponent...`);
    const opponent = await MatchmakingQueueModel.findOpponent(
      profile.id,
      DEFAULT_LADDER_ID,
      playerRating,
      RATING_WINDOW,
      userId // Pass userId to exclude blocked users
    );

    if (opponent) {
      // Check if opponent already has a match (race condition protection)
      if (playerMatches.has(opponent.player_id)) {
        const matchId = playerMatches.get(opponent.player_id)!;
        // Opponent already matched, join their match
        playerMatches.set(profile.id, matchId);
        await MatchmakingQueueModel.dequeue(profile.id, DEFAULT_LADDER_ID);
        return { status: 'matched', match_id: matchId };
      }

      console.log(`✅ Found opponent:`, opponent.player_id);
      // Create match
      const match = await this.createMatch(profile.id, opponent.player_id);
      
      // Store match for both players
      playerMatches.set(profile.id, match.id);
      playerMatches.set(opponent.player_id, match.id);
      
      // Remove opponent from queue
      await MatchmakingQueueModel.dequeue(opponent.player_id, DEFAULT_LADDER_ID);
      
      return { status: 'matched', match_id: match.id };
    }

    // No opponent found, add to queue
    console.log(`📝 Adding to queue...`);
    await MatchmakingQueueModel.enqueue(
      profile.id,
      DEFAULT_LADDER_ID,
      playerRating,
      playerRd
    );

    // Check again if someone matched with us while we were processing
    if (playerMatches.has(profile.id)) {
      const matchId = playerMatches.get(profile.id)!;
      console.log(`✅ Match found while processing: ${matchId}`);
      // Remove from queue since we're matched
      await MatchmakingQueueModel.dequeue(profile.id, DEFAULT_LADDER_ID);
      // Cancel bot spawn timer if it exists
      const timer = queueTimers.get(profile.id);
      if (timer) {
        clearTimeout(timer);
        queueTimers.delete(profile.id);
      }
      return { status: 'matched', match_id: matchId };
    }

    // Check one more time for an opponent after adding to queue
    // (in case someone joined while we were processing)
    const opponentAfterEnqueue = await MatchmakingQueueModel.findOpponent(
      profile.id,
      DEFAULT_LADDER_ID,
      playerRating,
      RATING_WINDOW,
      userId // Pass userId to exclude blocked users
    );

    if (opponentAfterEnqueue) {
      // Check if opponent already has a match (race condition protection)
      if (playerMatches.has(opponentAfterEnqueue.player_id)) {
        const matchId = playerMatches.get(opponentAfterEnqueue.player_id)!;
        // Opponent already matched, join their match
        playerMatches.set(profile.id, matchId);
        await MatchmakingQueueModel.dequeue(profile.id, DEFAULT_LADDER_ID);
        // Cancel bot spawn timer if it exists
        const timer = queueTimers.get(profile.id);
        if (timer) {
          clearTimeout(timer);
          queueTimers.delete(profile.id);
        }
        return { status: 'matched', match_id: matchId };
      }

      console.log(`✅ Found opponent after enqueue:`, opponentAfterEnqueue.player_id);
      // Create match
      const match = await this.createMatch(profile.id, opponentAfterEnqueue.player_id);
      
      // Store match for both players
      playerMatches.set(profile.id, match.id);
      playerMatches.set(opponentAfterEnqueue.player_id, match.id);
      
      // Remove both from queue
      await MatchmakingQueueModel.dequeue(profile.id, DEFAULT_LADDER_ID);
      await MatchmakingQueueModel.dequeue(opponentAfterEnqueue.player_id, DEFAULT_LADDER_ID);
      
      // Cancel bot spawn timer if it exists
      const timer = queueTimers.get(profile.id);
      if (timer) {
        clearTimeout(timer);
        queueTimers.delete(profile.id);
      }
      
      return { status: 'matched', match_id: match.id };
    }

    // No human opponent found - start 12-second timer to spawn bot
    console.log(`⏱️ Starting ${BOT_SPAWN_DELAY_MS}ms timer for bot spawn (player ${profile.id})`);
    const botTimer = setTimeout(async () => {
      // Check if player still in queue and doesn't have a match
      const stillInQueue = await MatchmakingQueueModel.isPlayerInQueue(profile.id, DEFAULT_LADDER_ID);
      const hasMatch = playerMatches.has(profile.id);
      
      if (stillInQueue && !hasMatch) {
        console.log(`🤖 Timer expired, spawning bot for player ${profile.id}`);
        await this.spawnBotOpponent(profile.id, playerRating);
      } else {
        console.log(`⏱️ Timer expired but player ${profile.id} no longer needs bot (inQueue=${stillInQueue}, hasMatch=${hasMatch})`);
      }
      
      queueTimers.delete(profile.id);
    }, BOT_SPAWN_DELAY_MS);
    
    queueTimers.set(profile.id, botTimer);

    return { status: 'queued', message: 'Waiting for opponent...' };
  },

  async leaveQueue(userId: number) {
    const profile = await PlayerProfileModel.findByUserId(userId);
    if (!profile) {
      throw new Error('Player profile not found');
    }

    await MatchmakingQueueModel.dequeue(profile.id, DEFAULT_LADDER_ID);
    playerMatches.delete(profile.id);
    
    // Cancel bot spawn timer if it exists
    const timer = queueTimers.get(profile.id);
    if (timer) {
      clearTimeout(timer);
      queueTimers.delete(profile.id);
    }
    
    return { status: 'left_queue' };
  },

  async checkStatus(userId: number) {
    const profile = await PlayerProfileModel.findByUserId(userId);
    if (!profile) {
      throw new Error('Player profile not found');
    }

    // Check if we have a match
    if (playerMatches.has(profile.id)) {
      const matchId = playerMatches.get(profile.id)!;
      return { status: 'matched', match_id: matchId };
    }

    // Check if we're in queue
    const inQueue = await MatchmakingQueueModel.isPlayerInQueue(profile.id, DEFAULT_LADDER_ID);
    if (inQueue) {
      // Try to find an opponent while we're in queue
      const rating = await PlayerRatingModel.findByPlayerAndLadder(
        profile.id,
        DEFAULT_LADDER_ID
      );
      const playerRating = rating?.rating || 1500;
      
      const opponent = await MatchmakingQueueModel.findOpponent(
        profile.id,
        DEFAULT_LADDER_ID,
        playerRating,
        RATING_WINDOW,
        userId // Pass userId to exclude blocked users
      );

      if (opponent) {
        // Check if opponent already has a match (race condition protection)
        if (playerMatches.has(opponent.player_id)) {
          const matchId = playerMatches.get(opponent.player_id)!;
          // Opponent already matched, join their match
          playerMatches.set(profile.id, matchId);
          await MatchmakingQueueModel.dequeue(profile.id, DEFAULT_LADDER_ID);
          return { status: 'matched', match_id: matchId };
        }

        console.log(`✅ Found opponent during status check:`, opponent.player_id);
        // Create match
        const match = await this.createMatch(profile.id, opponent.player_id);
        
        // Store match for both players
        playerMatches.set(profile.id, match.id);
        playerMatches.set(opponent.player_id, match.id);
        
        // Remove both from queue
        await MatchmakingQueueModel.dequeue(profile.id, DEFAULT_LADDER_ID);
        await MatchmakingQueueModel.dequeue(opponent.player_id, DEFAULT_LADDER_ID);
        
        return { status: 'matched', match_id: match.id };
      }

      return { status: 'queued', message: 'Waiting for opponent...' };
    }

    return { status: 'not_queued', message: 'Not in queue' };
  },

  async createMatch(player1Id: number, player2Id: number) {
    console.log(`🎮 Creating match: Player ${player1Id} vs Player ${player2Id}`);
    
    const puzzle = await PuzzleModel.getRandomByLadder(DEFAULT_LADDER_ID);
    if (!puzzle) {
      throw new Error('No puzzle available');
    }

    const match = await MatchModel.create(DEFAULT_LADDER_ID, puzzle.id);

    // Get ratings for both players
    const rating1 = await PlayerRatingModel.findByPlayerAndLadder(player1Id, DEFAULT_LADDER_ID);
    const rating2 = await PlayerRatingModel.findByPlayerAndLadder(player2Id, DEFAULT_LADDER_ID);

    // Add players to match
    await MatchModel.addPlayer(
      match.id,
      player1Id,
      1,
      rating1?.rating || 1500,
      rating1?.rd || 350,
      rating1?.volatility || 0.06
    );

    await MatchModel.addPlayer(
      match.id,
      player2Id,
      2,
      rating2?.rating || 1500,
      rating2?.rd || 350,
      rating2?.volatility || 0.06
    );

    console.log(`✅ Match ${match.id} created`);
    return match;
  },

  // Clean up match from cache (call after game ends)
  clearMatch(matchId: number) {
    console.log(`🧹 [Matchmaking] Clearing match ${matchId} from cache`);
    for (const [playerId, mId] of playerMatches.entries()) {
      if (Number(mId) === Number(matchId)) {
        console.log(`🧹 [Matchmaking] Removing player ${playerId} (matchId=${mId}) from cache`);
        playerMatches.delete(playerId);
      }
    }
  },

  // Create a bot match for first-time players
  async createBotMatch(playerId: number) {
    console.log(`🤖 Creating bot match for player ${playerId}`);

    const puzzle = await PuzzleModel.getRandomByLadder(DEFAULT_LADDER_ID);
    if (!puzzle) {
      throw new Error('No puzzle available');
    }

    const botPlayer = createBotPlayer();

    // Create match with is_bot_match = true and is_ranked = false
    const matchResult = await query(
      `INSERT INTO matches (ladder_id, puzzle_id, status, is_bot_match, is_ranked)
       VALUES ($1, $2, 'PENDING', true, false)
       RETURNING *`,
      [DEFAULT_LADDER_ID, puzzle.id]
    );
    const match = matchResult.rows[0];

    // Get player's rating
    const rating = await PlayerRatingModel.findByPlayerAndLadder(playerId, DEFAULT_LADDER_ID);

    // Add human player as slot 1
    await query(
      `INSERT INTO match_players (match_id, player_id, slot, is_bot, rating_before, rd_before, volatility_before)
       VALUES ($1, $2, 1, false, $3, $4, $5)`,
      [match.id, playerId, rating?.rating || 1500, rating?.rd || 350, rating?.volatility || 0.06]
    );

    // Add bot as slot 2 (player_id is NULL for bot)
    await query(
      `INSERT INTO match_players (match_id, player_id, slot, is_bot, bot_id, rating_before, rd_before, volatility_before)
       VALUES ($1, NULL, 2, true, $2, $3, 350, 0.06)`,
      [match.id, botPlayer.id, getBotDisplayRating()]
    );

    console.log(`✅ Bot match ${match.id} created for player ${playerId}`);
    return match;
  },

  // Spawn a bot opponent after 12 seconds in queue
  async spawnBotOpponent(humanPlayerId: number, humanRating: number) {
    const bot = await findBotNearRating(humanRating);
    if (!bot) {
      console.error(`❌ No bot found for rating ${humanRating}`);
      return null;
    }

    console.log(`🤖 Spawning bot ${bot.displayName} (rating: ${Math.round(bot.rating)}) for player ${humanPlayerId}`);

    // Create match with is_bot_match flag set in database
    const puzzle = await PuzzleModel.getRandomByLadder(DEFAULT_LADDER_ID);
    if (!puzzle) {
      throw new Error('No puzzle available');
    }

    // Create match with is_bot_match = true
    const matchResult = await query(
      `INSERT INTO matches (ladder_id, puzzle_id, status, is_bot_match, is_ranked)
       VALUES ($1, $2, 'PENDING', true, true)
       RETURNING *`,
      [DEFAULT_LADDER_ID, puzzle.id]
    );
    const match = matchResult.rows[0];

    // Get ratings for both players
    const rating1 = await PlayerRatingModel.findByPlayerAndLadder(humanPlayerId, DEFAULT_LADDER_ID);
    const rating2 = await PlayerRatingModel.findByPlayerAndLadder(bot.playerId, DEFAULT_LADDER_ID);

    // Add human player to match
    await MatchModel.addPlayer(
      match.id,
      humanPlayerId,
      1,
      rating1?.rating || 1500,
      rating1?.rd || 350,
      rating1?.volatility || 0.06
    );

    // Add bot player to match
    await MatchModel.addPlayer(
      match.id,
      bot.playerId,
      2,
      rating2?.rating || 1500,
      rating2?.rd || 350,
      rating2?.volatility || 0.06
    );

    // CRITICAL: Store bot match info BEFORE setting playerMatches
    // This prevents a race condition where the client connects before bot info is available
    botMatches.set(match.id, {
      botPlayerId: bot.playerId,
      botRating: bot.rating,
    });

    // Now set playerMatches - this triggers the client to connect
    playerMatches.set(humanPlayerId, match.id);
    await MatchmakingQueueModel.dequeue(humanPlayerId, DEFAULT_LADDER_ID);

    console.log(`✅ Bot match ${match.id} created for player ${humanPlayerId} vs bot ${bot.playerId}`);
    return match;
  },
};

// Export helper functions for websocket server
export function getBotMatchInfo(matchId: number) {
  return botMatches.get(matchId);
}

export function clearBotMatchInfo(matchId: number) {
  botMatches.delete(matchId);
}