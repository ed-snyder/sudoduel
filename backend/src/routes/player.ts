import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { PlayerService } from '../services/playerService';

const router = Router();

// GET /api/player/me - Get current player info
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerInfo = await PlayerService.getPlayerInfo(req.userId!);
    res.json(playerInfo);
  } catch (error: any) {
    console.error('Get player info error:', error);
    res.status(404).json({ error: error.message });
  }
});

export default router;
