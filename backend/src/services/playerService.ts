import { PlayerProfileModel } from '../models/PlayerProfile';
import { PlayerRatingModel } from '../models/PlayerRating';
import { query } from '../config/database';
import { cache, CacheKeys, CacheTTL } from './cacheService';

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
  // Existing stats
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
  
  // New speed stats
  cpm: number;                    // Cells per minute
  avgTimeAtWin: number;           // Seconds remaining on wins
  fastestWin: number;             // Seconds remaining on fastest win
  
  // New competition stats
  upsetRate: number;              // Win % vs higher-rated opponents (0-100)
  peakRating: number;             // Highest rating achieved
  
  // New streak stats
  currentWinStreak: number;       // Current consecutive wins
  bestWinStreak: number;          // Best ever consecutive wins
  avgCellStreak: number;          // Average longest in-game streak
}

export const PlayerService = {
  // Get full player info with rating
  async getPlayerInfo(userId: number) {
    const cacheKey = CacheKeys.playerProfile(userId);
    
    return cache.getOrSet(cacheKey, CacheTTL.PROFILE, async () => {
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
    });
  },

  // Get match history for a player
  async getMatchHistory(userId: number, limit: number = 50, offset: number = 0) {
    const profile = await PlayerProfileModel.findByUserId(userId);
    if (!profile) {
      throw new Error('Player profile not found');
    }

    const cacheKey = CacheKeys.matchHistory(userId, limit, offset);
    
    return cache.getOrSet(cacheKey, CacheTTL.MATCH_HISTORY, async () => {
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
          opponent.id as opponent_id,
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
          opponent_id: parseInt(row.opponent_id, 10),
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
    });
  },

  // Get player statistics
  async getPlayerStats(userId: number): Promise<PlayerStats> {
    const cacheKey = CacheKeys.playerStats(userId);
    
    return cache.getOrSet(cacheKey, CacheTTL.STATS, async () => {
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

    // Speed Stats: CPM (Cells per Minute) - handle missing columns gracefully
    let cpm = 0;
    let avgTimeAtWin = 0;
    let fastestWin = 0;
    
    try {
      const cpmResult = await query(
        `SELECT 
          SUM(mp.cells_completed) as total_cells,
          SUM(COALESCE(mp.time_at_finish, 0)) as total_time_remaining
        FROM match_players mp
        JOIN matches m ON mp.match_id = m.id
        WHERE mp.player_id = $1 AND m.status = 'COMPLETED'`,
        [profile.id]
      );
      
      const totalCells = parseInt(cpmResult.rows[0]?.total_cells || '0', 10);
      const totalTimeRemaining = parseInt(cpmResult.rows[0]?.total_time_remaining || '0', 10);
      // Calculate total time played: STARTING_TIME (210) * games - total_time_remaining
      const STARTING_TIME = 210;
      const totalTimePlayedSeconds = (totalMatches * STARTING_TIME) - totalTimeRemaining;
      cpm = totalTimePlayedSeconds > 0 ? (totalCells / (totalTimePlayedSeconds / 60)) : 0;

      // Speed Stats: Avg Time at Win & Fastest Win
      const winTimeResult = await query(
        `SELECT 
          AVG(mp.time_at_finish) as avg_time_remaining,
          MAX(mp.time_at_finish) as fastest_win_time_remaining
        FROM match_players mp
        JOIN matches m ON mp.match_id = m.id
        WHERE mp.player_id = $1 
          AND m.status = 'COMPLETED' 
          AND mp.is_winner = true
          AND mp.time_at_finish IS NOT NULL`,
        [profile.id]
      );
      
      avgTimeAtWin = Math.round(parseFloat(winTimeResult.rows[0]?.avg_time_remaining || '0'));
      fastestWin = parseInt(winTimeResult.rows[0]?.fastest_win_time_remaining || '0', 10);
    } catch (error: any) {
      if (error.message && error.message.includes('column') && error.message.includes('time_at_finish')) {
        console.warn(`[PlayerService] time_at_finish column not found, using defaults (migration may not be run)`);
      } else {
        console.error(`[PlayerService] Error calculating speed stats:`, error);
      }
    }

    // Competition Stats: Upset Rate
    const upsetResult = await query(
      `SELECT 
        COUNT(*) FILTER (WHERE mp.is_winner = true) as upset_wins,
        COUNT(*) as total_underdog_games
      FROM match_players mp
      JOIN matches m ON mp.match_id = m.id
      JOIN match_players opp ON opp.match_id = m.id AND opp.player_id != mp.player_id
      WHERE mp.player_id = $1 
        AND m.status = 'COMPLETED'
        AND mp.rating_before < opp.rating_before`,
      [profile.id]
    );
    
    const upsetWins = parseInt(upsetResult.rows[0]?.upset_wins || '0', 10);
    const underdogGames = parseInt(upsetResult.rows[0]?.total_underdog_games || '0', 10);
    const upsetRate = underdogGames > 0 ? (upsetWins / underdogGames) * 100 : 0;

    // Get peak rating and win streaks from player_profiles - handle missing columns gracefully
    let peakRating = rating?.rating || 1500;
    let currentWinStreak = 0;
    let bestWinStreak = 0;
    let avgCellStreak = 0;
    
    try {
      const profileStatsResult = await query(
        `SELECT peak_rating, current_win_streak, best_win_streak
         FROM player_profiles
         WHERE id = $1`,
        [profile.id]
      );
      const profileStats = profileStatsResult.rows[0];
      peakRating = parseFloat(profileStats?.peak_rating || String(rating?.rating || 1500));
      currentWinStreak = parseInt(profileStats?.current_win_streak || '0', 10);
      bestWinStreak = parseInt(profileStats?.best_win_streak || '0', 10);

      // Streak Stats: Avg Cell Streak
      const cellStreakResult = await query(
        `SELECT AVG(longest_cell_streak) as avg_streak
        FROM match_players mp
        JOIN matches m ON mp.match_id = m.id
        WHERE mp.player_id = $1 AND m.status = 'COMPLETED' AND mp.longest_cell_streak > 0`,
        [profile.id]
      );
      
      avgCellStreak = Math.round(parseFloat(cellStreakResult.rows[0]?.avg_streak || '0') * 10) / 10;
    } catch (error: any) {
      if (error.message && error.message.includes('column')) {
        console.warn(`[PlayerService] Stats columns not found, using defaults (migration may not be run)`);
      } else {
        console.error(`[PlayerService] Error fetching profile stats:`, error);
      }
    }

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
      // New stats
      cpm: Math.round(cpm * 10) / 10,
      avgTimeAtWin,
      fastestWin,
      upsetRate: Math.round(upsetRate * 10) / 10,
      peakRating,
      currentWinStreak,
      bestWinStreak,
      avgCellStreak,
    };
    });
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

  // Get player's global rank based on rating
  async getPlayerRank(userId: number) {
    const profile = await PlayerProfileModel.findByUserId(userId);
    if (!profile) {
      throw new Error('Player profile not found');
    }

    const rating = await PlayerRatingModel.findByPlayerAndLadder(
      profile.id,
      DEFAULT_LADDER_ID
    );

    const playerRating = rating?.rating || 1500;

    // Count how many players have a higher rating
    const higherRatedResult = await query(
      `SELECT COUNT(*) as count
       FROM player_ratings pr
       WHERE pr.ladder_id = $1
         AND pr.rating > $2`,
      [DEFAULT_LADDER_ID, playerRating]
    );

    const higherRatedCount = parseInt(higherRatedResult.rows[0].count, 10);
    const rank = higherRatedCount + 1;

    // Get total player count
    const totalPlayersResult = await query(
      `SELECT COUNT(DISTINCT pr.player_id) as count
       FROM player_ratings pr
       WHERE pr.ladder_id = $1`,
      [DEFAULT_LADDER_ID]
    );

    const totalPlayers = parseInt(totalPlayersResult.rows[0].count, 10);

    return {
      rank,
      total_players: totalPlayers,
      rating: playerRating,
    };
  },
};
