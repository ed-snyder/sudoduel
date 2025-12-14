import { query } from '../config/database';
import { PlayerProfileModel } from '../models/PlayerProfile';

// Get today's date in UTC as YYYY-MM-DD string
function getTodayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

// Generate a seeded puzzle ID based on date
// Ensures all players get the same puzzle on the same day
function getDailyPuzzleId(date: string): number {
  let hash = 0;
  for (let i = 0; i < date.length; i++) {
    hash = ((hash << 5) - hash) + date.charCodeAt(i);
    hash = hash & hash;
  }
  // Puzzles have IDs 1-500
  return (Math.abs(hash) % 500) + 1;
}

export const DailyRunService = {
  // Get today's puzzle
  async getTodaysPuzzle() {
    const today = getTodayUTC();
    const puzzleId = getDailyPuzzleId(today);
    
    const result = await query(
      `SELECT id, initial_grid, solution_grid, difficulty 
       FROM puzzles WHERE id = $1`,
      [puzzleId]
    );
    
    if (result.rows.length === 0) {
      // Fallback to puzzle ID 1
      const fallback = await query(
        `SELECT id, initial_grid, solution_grid, difficulty 
         FROM puzzles WHERE id = 1`
      );
      return fallback.rows[0];
    }
    
    return result.rows[0];
  },

  // Check if user has completed today's run
  async hasCompletedToday(userId: number): Promise<{ completed: boolean; result?: { time_ms: number; rank: number } }> {
    const profile = await PlayerProfileModel.findByUserId(userId);
    if (!profile) throw new Error('Player not found');
    
    const today = getTodayUTC();
    
    const result = await query(
      `SELECT completion_time_ms FROM daily_run_results 
       WHERE player_id = $1 AND run_date = $2`,
      [profile.id, today]
    );
    
    if (result.rows.length === 0) {
      return { completed: false };
    }
    
    // Get their rank
    const rankResult = await query(
      `SELECT COUNT(*) + 1 as rank FROM daily_run_results 
       WHERE run_date = $1 AND completion_time_ms < $2`,
      [today, result.rows[0].completion_time_ms]
    );
    
    return {
      completed: true,
      result: {
        time_ms: parseInt(result.rows[0].completion_time_ms, 10),
        rank: parseInt(rankResult.rows[0].rank, 10)
      }
    };
  },

  // Submit a completed run
  async submitResult(userId: number, timeMs: number): Promise<{ rank: number; total_players: number; time_ms: number }> {
    const profile = await PlayerProfileModel.findByUserId(userId);
    if (!profile) throw new Error('Player not found');
    
    const today = getTodayUTC();
    
    // Check if already completed
    const existing = await query(
      `SELECT id FROM daily_run_results WHERE player_id = $1 AND run_date = $2`,
      [profile.id, today]
    );
    
    if (existing.rows.length > 0) {
      throw new Error('Already completed today\'s Daily Run');
    }
    
    // Insert result
    await query(
      `INSERT INTO daily_run_results (player_id, run_date, completion_time_ms)
       VALUES ($1, $2, $3)`,
      [profile.id, today, timeMs]
    );
    
    // Get rank
    const rankResult = await query(
      `SELECT COUNT(*) + 1 as rank FROM daily_run_results 
       WHERE run_date = $1 AND completion_time_ms < $2`,
      [today, timeMs]
    );
    
    // Get total players today
    const totalResult = await query(
      `SELECT COUNT(*) as total FROM daily_run_results WHERE run_date = $1`,
      [today]
    );
    
    return {
      rank: parseInt(rankResult.rows[0].rank, 10),
      total_players: parseInt(totalResult.rows[0].total, 10),
      time_ms: timeMs
    };
  },

  // Get today's leaderboard
  async getLeaderboard(userId: number): Promise<{
    top50: Array<{ rank: number; display_name: string; time_ms: number; is_you: boolean }>;
    your_result: { rank: number; time_ms: number } | null;
    total_players: number;
  }> {
    const profile = await PlayerProfileModel.findByUserId(userId);
    if (!profile) throw new Error('Player not found');
    
    const today = getTodayUTC();
    
    // Get top 50
    const top50Result = await query(
      `SELECT 
        pp.id as player_id,
        pp.display_name,
        dr.completion_time_ms as time_ms,
        RANK() OVER (ORDER BY dr.completion_time_ms ASC) as rank
       FROM daily_run_results dr
       JOIN player_profiles pp ON pp.id = dr.player_id
       WHERE dr.run_date = $1
       ORDER BY dr.completion_time_ms ASC
       LIMIT 50`,
      [today]
    );
    
    const top50 = top50Result.rows.map(row => ({
      rank: parseInt(row.rank, 10),
      display_name: row.display_name,
      time_ms: parseInt(row.time_ms, 10),
      is_you: row.player_id === profile.id
    }));
    
    // Get user's result
    const userResult = await query(
      `SELECT completion_time_ms FROM daily_run_results 
       WHERE player_id = $1 AND run_date = $2`,
      [profile.id, today]
    );
    
    let your_result = null;
    if (userResult.rows.length > 0) {
      const rankResult = await query(
        `SELECT COUNT(*) + 1 as rank FROM daily_run_results 
         WHERE run_date = $1 AND completion_time_ms < $2`,
        [today, userResult.rows[0].completion_time_ms]
      );
      your_result = {
        rank: parseInt(rankResult.rows[0].rank, 10),
        time_ms: parseInt(userResult.rows[0].completion_time_ms, 10)
      };
    }
    
    // Get total
    const totalResult = await query(
      `SELECT COUNT(*) as total FROM daily_run_results WHERE run_date = $1`,
      [today]
    );
    
    return {
      top50,
      your_result,
      total_players: parseInt(totalResult.rows[0].total, 10)
    };
  }
};
