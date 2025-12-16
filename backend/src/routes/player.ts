import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { PlayerService } from '../services/playerService';
import { FriendService } from '../services/friendService';
import { PlayerProfileModel } from '../models/PlayerProfile';
import { PlayerRatingModel } from '../models/PlayerRating';
import { query } from '../config/database';
import { validateUsername } from '../utils/usernameValidator';
import { cache, CacheKeys } from '../services/cacheService';

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

// POST /api/player/set-initial-rating - Set initial rating for new players (during tutorial)
router.post('/set-initial-rating', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rating } = req.body;
    
    // Validate rating (only allow 500 or 1500)
    if (rating !== 500 && rating !== 1500) {
      return res.status(400).json({ error: 'Invalid rating value' });
    }
    
    // Get player profile
    const profile = await PlayerProfileModel.findByUserId(req.userId!);
    if (!profile) {
      return res.status(404).json({ error: 'Player profile not found' });
    }
    
    // Check if player has played any games (prevent abuse)
    const gamesPlayedResult = await query(
      `SELECT COUNT(*) as count FROM match_players WHERE player_id = $1`,
      [profile.id]
    );
    
    const gamesPlayed = parseInt(gamesPlayedResult.rows[0].count, 10);
    if (gamesPlayed > 0) {
      return res.status(400).json({ error: 'Cannot change rating after playing games' });
    }
    
    // Update rating for default ladder (ladder_id = 1)
    await query(
      `UPDATE player_ratings 
       SET rating = $1, rd = 350 
       WHERE player_id = $2 AND ladder_id = 1`,
      [rating, profile.id]
    );
    
    // Invalidate cached profile so refreshUser gets the new rating
    cache.delete(CacheKeys.playerProfile(req.userId!));
    
    console.log(`[Rating] User ${req.userId} initial rating set to: ${rating}`);
    
    res.json({ success: true, newRating: rating });
  } catch (error: any) {
    console.error('Set initial rating error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/player/premium - Update premium status (for dev/testing)
router.patch('/premium', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { is_premium } = req.body;
    
    if (typeof is_premium !== 'boolean') {
      return res.status(400).json({ error: 'is_premium must be a boolean' });
    }

    // Update the player's premium status
    const result = await query(
      `UPDATE player_profiles 
       SET is_premium = $1 
       WHERE user_id = $2
       RETURNING id, display_name, is_premium`,
      [is_premium, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player profile not found' });
    }

    console.log(`[Premium] User ${req.userId} premium status updated to: ${is_premium}`);
    
    res.json({ 
      success: true, 
      is_premium: result.rows[0].is_premium,
      display_name: result.rows[0].display_name
    });
  } catch (error: any) {
    console.error('Update premium status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/player/:playerId/profile - Get another player's public profile
router.get('/:playerId/profile', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const targetPlayerId = parseInt(req.params.playerId, 10);
    if (isNaN(targetPlayerId)) {
      return res.status(400).json({ error: 'Invalid player ID' });
    }

    // Get target player's profile
    const profile = await PlayerProfileModel.findById(targetPlayerId);
    if (!profile) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Get target player's rating
    const rating = await PlayerRatingModel.findByPlayerAndLadder(targetPlayerId, 1);
    const playerRating = rating?.rating || 1500;

    // Get rank if player is premium (only premium players are ranked)
    let rank = null;
    if (profile.is_premium) {
      // Count only PREMIUM players with higher rating
      const rankResult = await query(
        `SELECT COUNT(*) + 1 as rank
         FROM player_ratings pr
         JOIN player_profiles pp ON pp.id = pr.player_id
         WHERE pr.ladder_id = 1 AND pr.rating > $1 AND pp.is_premium = true`,
        [playerRating]
      );
      rank = parseInt(rankResult.rows[0].rank, 10);
    }

    // Get total PREMIUM players for context
    const totalResult = await query(
      `SELECT COUNT(*) as total 
       FROM player_ratings pr
       JOIN player_profiles pp ON pp.id = pr.player_id
       WHERE pr.ladder_id = 1 AND pp.is_premium = true`,
      []
    );
    const totalPlayers = parseInt(totalResult.rows[0].total, 10);

    res.json({
      player_id: profile.id,
      display_name: profile.display_name,
      rating: Math.round(playerRating),
      is_premium: profile.is_premium || false,
      rank: rank,
      total_players: totalPlayers,
    });
  } catch (error: any) {
    console.error('Get player profile error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
