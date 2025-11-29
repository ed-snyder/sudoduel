import { PuzzleModel } from '../models/Puzzle';

export const PuzzleService = {
  // Get a random puzzle for a ladder
  async getRandomPuzzle(ladderId: number) {
    const puzzle = await PuzzleModel.getRandomByLadder(ladderId);
    
    if (!puzzle) {
      throw new Error('No puzzles available for this ladder');
    }

    // Return puzzle WITHOUT the solution (client shouldn't see it)
    return {
      id: puzzle.id,
      initial_grid: puzzle.initial_grid,
      difficulty: puzzle.difficulty,
    };
  },

  // Get puzzle WITH solution (server-side only, for validation)
  async getPuzzleWithSolution(puzzleId: number) {
    const puzzle = await PuzzleModel.findById(puzzleId);
    
    if (!puzzle) {
      throw new Error('Puzzle not found');
    }

    return puzzle;
  },
};
