import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { PlayerService } from '../services/playerService';
import { FriendService } from '../services/friendService';
import { PlayerProfileModel } from '../models/PlayerProfile';
import { query } from '../config/database';
import { validateUsername } from '../utils/usernameValidator';

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

// PATCH /api/player/profile - Update player profile (including display name)
router.patch('/profile', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { display_name } = req.body;
    
    if (!display_name) {
      return res.status(400).json({ error: 'Display name is required' });
    }

    // Validate display name format and profanity
    const trimmedName = display_name.trim();
    const usernameValidation = validateUsername(trimmedName);
    if (!usernameValidation.valid) {
      return res.status(400).json({ error: usernameValidation.error || 'Invalid display name' });
    }

    // Check if display name is available
    const isAvailable = await FriendService.isDisplayNameAvailable(trimmedName, req.userId!);
    if (!isAvailable) {
      return res.status(409).json({ error: 'Display name is already taken' });
    }

    // Get player profile
    const result = await query(
      `SELECT id FROM player_profiles WHERE user_id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player profile not found' });
    }

    // Update display name
    await query(
      `UPDATE player_profiles SET display_name = $1 WHERE user_id = $2`,
      [trimmedName, req.userId]
    );

    res.json({ success: true, display_name: trimmedName });
  } catch (error: any) {
    console.error('Update profile error:', error);
    
    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Display name is already taken' });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// GET /api/player/check-name - Check if display name is available (public endpoint, no auth required for quick checks)
router.get('/check-name', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const name = req.query.name as string;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      return res.json({ available: false, reason: 'Name too short' });
    }

    const available = await FriendService.isDisplayNameAvailable(trimmedName, req.userId!);
    res.json({ available });
  } catch (error: any) {
    console.error('Check name error:', error);
    res.status(400).json({ error: error.message });
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

// GET /api/player/rank - Get current player's global rank
router.get('/rank', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const rankData = await PlayerService.getPlayerRank(req.userId!);
    res.json(rankData);
  } catch (error: any) {
    console.error('Get player rank error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/player/tutorial-complete - Mark tutorial as complete
router.patch('/tutorial-complete', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const profile = await PlayerProfileModel.findByUserId(req.userId!);
    if (!profile) {
      return res.status(404).json({ error: 'Player profile not found' });
    }

    // Mark tutorial as complete (idempotent)
    await PlayerProfileModel.markTutorialComplete(profile.id);

    // Get updated profile to return timestamp
    const updatedProfile = await PlayerProfileModel.findById(profile.id);

    res.json({
      success: true,
      tutorial_completed: true,
      tutorial_completed_at: updatedProfile?.tutorial_completed_at || new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Mark tutorial complete error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
