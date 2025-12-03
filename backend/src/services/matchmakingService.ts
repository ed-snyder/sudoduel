import { PlayerProfileModel } from '../models/PlayerProfile';
import { PlayerRatingModel } from '../models/PlayerRating';
import { MatchmakingQueueModel } from '../models/MatchmakingQueue';
import { MatchModel } from '../models/Match';
import { PuzzleModel } from '../models/Puzzle';

const DEFAULT_LADDER_ID = 1;
// For MVP, use a very wide rating window so players always find a match,
// even if their ratings have diverged significantly.
// Later this can be tightened and/or expanded over time spent in queue.
const RATING_WINDOW = 1000;

// Store active matches for players (in-memory cache)
const playerMatches = new Map<number, number>(); // playerId -> matchId

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
    
    // Try to find an opponent first
    console.log(`🔍 Looking for opponent...`);
    const opponent = await MatchmakingQueueModel.findOpponent(
      profile.id,
      DEFAULT_LADDER_ID,
      playerRating,
      RATING_WINDOW
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
      return { status: 'matched', match_id: matchId };
    }

    // Check one more time for an opponent after adding to queue
    // (in case someone joined while we were processing)
    const opponentAfterEnqueue = await MatchmakingQueueModel.findOpponent(
      profile.id,
      DEFAULT_LADDER_ID,
      playerRating,
      RATING_WINDOW
    );

    if (opponentAfterEnqueue) {
      // Check if opponent already has a match (race condition protection)
      if (playerMatches.has(opponentAfterEnqueue.player_id)) {
        const matchId = playerMatches.get(opponentAfterEnqueue.player_id)!;
        // Opponent already matched, join their match
        playerMatches.set(profile.id, matchId);
        await MatchmakingQueueModel.dequeue(profile.id, DEFAULT_LADDER_ID);
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
      
      return { status: 'matched', match_id: match.id };
    }

    return { status: 'queued', message: 'Waiting for opponent...' };
  },

  async leaveQueue(userId: number) {
    const profile = await PlayerProfileModel.findByUserId(userId);
    if (!profile) {
      throw new Error('Player profile not found');
    }

    await MatchmakingQueueModel.dequeue(profile.id, DEFAULT_LADDER_ID);
    playerMatches.delete(profile.id);
    
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
        RATING_WINDOW
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
};