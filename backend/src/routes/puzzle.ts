import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { PuzzleService } from '../services/puzzleService';

const router = Router();

const DEFAULT_LADDER_ID = 1;

// GET /api/puzzle/random - Get a random puzzle (with solution for solo mode)
router.get('/random', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Include solution for solo mode (client-side validation)
    const includeSolution = req.query.solo === 'true';
    const puzzle = await PuzzleService.getRandomPuzzle(DEFAULT_LADDER_ID, includeSolution);
    res.json(puzzle);
  } catch (error: any) {
    console.error('Get puzzle error:', error);
    res.status(404).json({ error: error.message });
  }
});

export default router;
