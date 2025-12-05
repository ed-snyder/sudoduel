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

// GET /api/player/match-history - Get match history
router.get('/match-history', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await PlayerService.getMatchHistory(req.userId!, limit, offset);
    res.json(result);
  } catch (error: any) {
    console.error('Get match history error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/player/stats - Get player statistics
router.get('/stats', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const stats = await PlayerService.getPlayerStats(req.userId!);
    res.json(stats);
  } catch (error: any) {
    console.error('Get player stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
