import { query } from '../config/database';

export interface Puzzle {
  id: number;
  ladder_id: number;
  initial_grid: string;
  solution_grid: string;
  difficulty: string;
  created_at: Date;
  metadata: any;
}

export const PuzzleModel = {
  // Get a random puzzle for a ladder
  async getRandomByLadder(ladderId: number): Promise<Puzzle | null> {
    const result = await query(
      `SELECT * FROM puzzles 
       WHERE ladder_id = $1 
       ORDER BY RANDOM() 
       LIMIT 1`,
      [ladderId]
    );
    return result.rows[0] || null;
  },

  // Get puzzle by ID
  async findById(puzzleId: number): Promise<Puzzle | null> {
    const result = await query(
      'SELECT * FROM puzzles WHERE id = $1',
      [puzzleId]
    );
    return result.rows[0] || null;
  },
};
