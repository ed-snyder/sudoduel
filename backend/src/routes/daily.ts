import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { DailyRunService } from '../services/dailyRunService';

const router = Router();

// GET /api/daily/puzzle - Get today's puzzle
router.get('/puzzle', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const status = await DailyRunService.hasCompletedToday(req.userId!);
    const puzzle = await DailyRunService.getTodaysPuzzle();
    
    res.json({
      puzzle: {
        id: puzzle.id,
        initial_grid: puzzle.initial_grid,
        solution_grid: puzzle.solution_grid,
      },
      already_completed: status.completed,
      previous_result: status.result || null
    });
  } catch (error: any) {
    console.error('Get daily puzzle error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/daily/complete - Submit completion time
router.post('/complete', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { time_ms } = req.body;
    
    if (typeof time_ms !== 'number' || time_ms < 0) {
      return res.status(400).json({ error: 'Invalid time' });
    }
    
    const result = await DailyRunService.submitResult(req.userId!, time_ms);
    res.json(result);
  } catch (error: any) {
    console.error('Submit daily run error:', error);
    
    if (error.message.includes('Already completed')) {
      return res.status(409).json({ error: error.message });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// GET /api/daily/leaderboard - Get today's leaderboard
router.get('/leaderboard', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const leaderboard = await DailyRunService.getLeaderboard(req.userId!);
    res.json(leaderboard);
  } catch (error: any) {
    console.error('Get daily leaderboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
