import { query } from '../config/database';

export interface Match {
  id: number;
  ladder_id: number;
  puzzle_id: number;
  status: string;
  result_code: number | null;
  created_at: Date;
  started_at: Date | null;
  ended_at: Date | null;
  server_region: string | null;
}

export interface MatchPlayer {
  id: number;
  match_id: number;
  player_id: number;
  slot: number;
  rating_before: number;
  rd_before: number;
  volatility_before: number;
  rating_after: number | null;
  rd_after: number | null;
  volatility_after: number | null;
  cells_completed: number;
  lives_used: number;
  lives_remaining: number;
  mistakes: number;
  time_spent_seconds: number;
  final_state: string | null;
  is_winner: boolean | null;
}

export const MatchModel = {
  // Create a new match
  async create(ladderId: number, puzzleId: number): Promise<Match> {
    const result = await query(
      `INSERT INTO matches (ladder_id, puzzle_id, status)
       VALUES ($1, $2, 'PENDING')
       RETURNING *`,
      [ladderId, puzzleId]
    );
    return result.rows[0];
  },

  // Add player to match
  async addPlayer(
    matchId: number,
    playerId: number,
    slot: number,
    rating: number,
    rd: number,
    volatility: number
  ): Promise<MatchPlayer> {
    const result = await query(
      `INSERT INTO match_players 
       (match_id, player_id, slot, rating_before, rd_before, volatility_before)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [matchId, playerId, slot, rating, rd, volatility]
    );
    return result.rows[0];
  },

  // Update match status - FIXED VERSION
  async updateStatus(matchId: number, status: string): Promise<void> {
    if (status === 'IN_PROGRESS') {
      await query(
        'UPDATE matches SET status = $1, started_at = NOW() WHERE id = $2',
        [status, matchId]
      );
    } else {
      await query(
        'UPDATE matches SET status = $1 WHERE id = $2',
        [status, matchId]
      );
    }
  },

  // Get match by ID
  async findById(matchId: number): Promise<Match | null> {
    const result = await query(
      'SELECT * FROM matches WHERE id = $1',
      [matchId]
    );
    return result.rows[0] || null;
  },

  // Get match players
  async getPlayers(matchId: number): Promise<MatchPlayer[]> {
    const result = await query(
      'SELECT * FROM match_players WHERE match_id = $1 ORDER BY slot',
      [matchId]
    );
    return result.rows;
  },
};
