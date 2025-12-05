import { PlayerProfileModel } from '../models/PlayerProfile';
import { PlayerRatingModel } from '../models/PlayerRating';
import { query } from '../config/database';

const DEFAULT_LADDER_ID = 1;

export interface MatchHistoryEntry {
  match_id: number;
  date: Date;
  opponent_name: string;
  result: 'WIN' | 'LOSS' | 'DRAW';
  cells_completed: number;
  opponent_cells_completed: number;
  mistakes: number;
  rating_before: number;
  rating_after: number;
  rating_change: number;
}

export interface PlayerStats {
  current_rating: number;
  games_played: number;
  total_matches: number;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number;
  accuracy: number;
  rating_change_1d: number | null;
  rating_change_30d: number | null;
  rating_change_90d: number | null;
  rating_change_all_time: number | null;
}

export const PlayerService = {
  // Get full player info with rating
  async getPlayerInfo(userId: number) {
    const profile = await PlayerProfileModel.findByUserId(userId);
    
    if (!profile) {
      throw new Error('Player profile not found');
    }

    const rating = await PlayerRatingModel.findByPlayerAndLadder(
      profile.id,
      DEFAULT_LADDER_ID
    );

    return {
      id: profile.id,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      country_code: profile.country_code,
      rating: rating?.rating || 1500,
      rd: rating?.rd || 350,
      games_played: rating?.games_played || 0,
    };
  },

  // Get match history for a player
  async getMatchHistory(userId: number, limit: number = 50, offset: number = 0) {
    const profile = await PlayerProfileModel.findByUserId(userId);
    if (!profile) {
      throw new Error('Player profile not found');
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM match_players mp
       JOIN matches m ON mp.match_id = m.id
       WHERE mp.player_id = $1 AND m.status = 'COMPLETED'`,
      [profile.id]
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Get match history with opponent info
    const result = await query(
      `SELECT 
        mp.match_id,
        COALESCE(m.ended_at, m.created_at) as date,
        opponent.display_name as opponent_name,
        CASE 
          WHEN mp.is_winner = true THEN 'WIN'
          WHEN mp.is_winner = false THEN 'LOSS'
          ELSE 'DRAW'
        END as result,
        mp.cells_completed,
        opponent_mp.cells_completed as opponent_cells_completed,
        mp.mistakes,
        mp.rating_before,
        mp.rating_after,
        COALESCE(mp.rating_after, mp.rating_before) - mp.rating_before as rating_change
       FROM match_players mp
       JOIN matches m ON mp.match_id = m.id
       JOIN match_players opponent_mp ON opponent_mp.match_id = m.id AND opponent_mp.player_id != mp.player_id
       JOIN player_profiles opponent ON opponent.id = opponent_mp.player_id
       WHERE mp.player_id = $1 AND m.status = 'COMPLETED'
       ORDER BY date DESC
       LIMIT $2 OFFSET $3`,
      [profile.id, limit, offset]
    );

    return {
      matches: result.rows.map(row => ({
        match_id: row.match_id,
        date: row.date,
        opponent_name: row.opponent_name,
        result: row.result,
        cells_completed: row.cells_completed,
        opponent_cells_completed: row.opponent_cells_completed,
        mistakes: row.mistakes,
        rating_before: parseFloat(row.rating_before),
        rating_after: row.rating_after ? parseFloat(row.rating_after) : null,
        rating_change: row.rating_change ? parseFloat(row.rating_change) : 0,
      })),
      total,
      limit,
      offset,
    };
  },

  // Get player statistics
  async getPlayerStats(userId: number): Promise<PlayerStats> {
    const profile = await PlayerProfileModel.findByUserId(userId);
    if (!profile) {
      throw new Error('Player profile not found');
    }

    const rating = await PlayerRatingModel.findByPlayerAndLadder(
      profile.id,
      DEFAULT_LADDER_ID
    );

    // Get aggregated stats
    const statsResult = await query(
      `SELECT 
        COUNT(*) as total_matches,
        SUM(CASE WHEN mp.is_winner = true THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN mp.is_winner = false THEN 1 ELSE 0 END) as losses,
        SUM(CASE WHEN mp.is_winner IS NULL THEN 1 ELSE 0 END) as draws,
        SUM(mp.cells_completed) as total_cells_completed,
        SUM(mp.mistakes) as total_mistakes
       FROM match_players mp
       JOIN matches m ON mp.match_id = m.id
       WHERE mp.player_id = $1 AND m.status = 'COMPLETED'`,
      [profile.id]
    );

    const stats = statsResult.rows[0];
    const totalMatches = parseInt(stats.total_matches || '0', 10);
    const wins = parseInt(stats.wins || '0', 10);
    const losses = parseInt(stats.losses || '0', 10);
    const draws = parseInt(stats.draws || '0', 10);
    const totalCellsCompleted = parseInt(stats.total_cells_completed || '0', 10);
    const totalMistakes = parseInt(stats.total_mistakes || '0', 10);
    
    const winRate = totalMatches > 0 ? (wins / totalMatches) * 100 : 0;
    const accuracy = (totalCellsCompleted + totalMistakes) > 0 
      ? (totalCellsCompleted / (totalCellsCompleted + totalMistakes)) * 100 
      : 0;

    // Get rating changes for different time periods
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Get earliest match in each period
    const ratingChange1d = await this.getRatingChange(profile.id, oneDayAgo);
    const ratingChange30d = await this.getRatingChange(profile.id, thirtyDaysAgo);
    const ratingChange90d = await this.getRatingChange(profile.id, ninetyDaysAgo);
    const ratingChangeAllTime = await this.getRatingChange(profile.id, new Date(0));

    return {
      current_rating: rating?.rating || 1500,
      games_played: rating?.games_played || 0,
      total_matches: totalMatches,
      wins,
      losses,
      draws,
      win_rate: Math.round(winRate * 10) / 10, // Round to 1 decimal
      accuracy: Math.round(accuracy * 10) / 10, // Round to 1 decimal
      rating_change_1d: ratingChange1d,
      rating_change_30d: ratingChange30d,
      rating_change_90d: ratingChange90d,
      rating_change_all_time: ratingChangeAllTime,
    };
  },

  // Helper: Get rating change since a date
  async getRatingChange(playerId: number, sinceDate: Date): Promise<number | null> {
    const result = await query(
      `SELECT rating_before
       FROM match_players mp
       JOIN matches m ON mp.match_id = m.id
       WHERE mp.player_id = $1 
         AND m.status = 'COMPLETED'
         AND COALESCE(m.ended_at, m.created_at) >= $2
       ORDER BY COALESCE(m.ended_at, m.created_at) ASC
       LIMIT 1`,
      [playerId, sinceDate]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const rating = await PlayerRatingModel.findByPlayerAndLadder(playerId, DEFAULT_LADDER_ID);
    const currentRating = rating?.rating || 1500;
    const ratingBefore = parseFloat(result.rows[0].rating_before);

    return currentRating - ratingBefore;
  },
};
