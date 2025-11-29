import { MatchmakingQueueModel } from '../models/MatchmakingQueue';
import { MatchModel } from '../models/Match';
import { PlayerProfileModel } from '../models/PlayerProfile';
import { PlayerRatingModel } from '../models/PlayerRating';
import { PuzzleService } from './puzzleService';

const DEFAULT_LADDER_ID = 1;
const RATING_WINDOW = 200; // ±200 rating points

export const MatchmakingService = {
  // Join matchmaking queue
  async joinQueue(userId: number) {
    // Get player profile
    const profile = await PlayerProfileModel.findByUserId(userId);
    if (!profile) {
      throw new Error('Player profile not found');
    }

    // Get player rating
    const rating = await PlayerRatingModel.findByPlayerAndLadder(
      profile.id,
      DEFAULT_LADDER_ID
    );
    if (!rating) {
      throw new Error('Player rating not found');
    }

    // Check if already in queue
    const inQueue = await MatchmakingQueueModel.isPlayerInQueue(
      profile.id,
      DEFAULT_LADDER_ID
    );
    if (inQueue) {
      return { status: 'queued', message: 'Already in queue' };
    }

    // Try to find an opponent
    const opponent = await MatchmakingQueueModel.findOpponent(
      profile.id,
      DEFAULT_LADDER_ID,
      rating.rating,
      RATING_WINDOW
    );

    if (opponent) {
      // Found a match! Create the match
      const match = await this.createMatch(profile.id, opponent.player_id);
      
      // Remove both players from queue
      await MatchmakingQueueModel.dequeue(profile.id, DEFAULT_LADDER_ID);
      await MatchmakingQueueModel.dequeue(opponent.player_id, DEFAULT_LADDER_ID);

      return {
        status: 'matched',
        match_id: match.id,
      };
    } else {
      // No opponent found, add to queue
      await MatchmakingQueueModel.enqueue(
        profile.id,
        DEFAULT_LADDER_ID,
        rating.rating,
        rating.rd
      );

      return {
        status: 'queued',
        message: 'Waiting for opponent...',
      };
    }
  },

  // Leave matchmaking queue
  async leaveQueue(userId: number) {
    const profile = await PlayerProfileModel.findByUserId(userId);
    if (!profile) {
      throw new Error('Player profile not found');
    }

    await MatchmakingQueueModel.dequeue(profile.id, DEFAULT_LADDER_ID);

    return { status: 'left_queue' };
  },

  // Create a match between two players
  async createMatch(player1Id: number, player2Id: number) {
    // Get a random puzzle
    const puzzle = await PuzzleService.getRandomPuzzle(DEFAULT_LADDER_ID);

    // Create match
    const match = await MatchModel.create(DEFAULT_LADDER_ID, puzzle.id);

    // Get ratings for both players
    const rating1 = await PlayerRatingModel.findByPlayerAndLadder(
      player1Id,
      DEFAULT_LADDER_ID
    );
    const rating2 = await PlayerRatingModel.findByPlayerAndLadder(
      player2Id,
      DEFAULT_LADDER_ID
    );

    if (!rating1 || !rating2) {
      throw new Error('Player ratings not found');
    }

    // Add both players to match
    await MatchModel.addPlayer(
      match.id,
      player1Id,
      1,
      rating1.rating,
      rating1.rd,
      rating1.volatility
    );
    await MatchModel.addPlayer(
      match.id,
      player2Id,
      2,
      rating2.rating,
      rating2.rd,
      rating2.volatility
    );

    return match;
  },
};
