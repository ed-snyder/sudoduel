import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { MatchmakingService } from '../services/matchmakingService';

const router = Router();

// POST /api/matchmaking/join - Join the queue
router.post('/join', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await MatchmakingService.joinQueue(req.userId!);
    res.json(result);
  } catch (error: any) {
    console.error('Matchmaking join error:', error);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/matchmaking/leave - Leave the queue
router.post('/leave', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await MatchmakingService.leaveQueue(req.userId!);
    res.json(result);
  } catch (error: any) {
    console.error('Matchmaking leave error:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
