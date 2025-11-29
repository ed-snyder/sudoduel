import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { PuzzleService } from '../services/puzzleService';

const router = Router();

const DEFAULT_LADDER_ID = 1;

// GET /api/puzzle/random - Get a random puzzle
router.get('/random', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const puzzle = await PuzzleService.getRandomPuzzle(DEFAULT_LADDER_ID);
    res.json(puzzle);
  } catch (error: any) {
    console.error('Get puzzle error:', error);
    res.status(404).json({ error: error.message });
  }
});

export default router;
