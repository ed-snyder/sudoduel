import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { query } from '../config/database';
import { PlayerProfileModel } from '../models/PlayerProfile';
import { PlayerRatingModel } from '../models/PlayerRating';

const router = Router();
const DEFAULT_LADDER_ID = 1;

// GET /api/leaderboard - Get leaderboard data (all players, but rank visibility gated to premium)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Get current user's profile and rating
    const profile = await PlayerProfileModel.findByUserId(req.userId!);
    if (!profile) {
      return res.status(404).json({ error: 'Player profile not found' });
    }

    const userRating = await PlayerRatingModel.findByPlayerAndLadder(
      profile.id,
      DEFAULT_LADDER_ID
    );
    const currentUserRating = userRating?.rating || 1500;
    const userIsPremium = profile.is_premium || false;

    // Get ALL players (no limit)
    const allPlayersResult = await query(
      `SELECT 
        pp.id as player_id,
        pp.display_name,
        pr.rating,
        RANK() OVER (ORDER BY pr.rating DESC) as rank
       FROM player_ratings pr
       JOIN player_profiles pp ON pp.id = pr.player_id
       WHERE pr.ladder_id = $1
       ORDER BY pr.rating DESC`,
      [DEFAULT_LADDER_ID]
    );

    // Calculate user's actual rank among ALL players
    const userRankResult = await query(
      `SELECT COUNT(*)::int as rank
       FROM player_ratings pr
       WHERE pr.ladder_id = $1 AND pr.rating > $2`,
      [DEFAULT_LADDER_ID, currentUserRating]
    );
    const actualUserRank = parseInt(userRankResult.rows[0].rank, 10) + 1;

    // Get total player count (ALL players)
    const totalResult = await query(
      `SELECT COUNT(*) as total 
       FROM player_ratings pr
       WHERE pr.ladder_id = $1`,
      [DEFAULT_LADDER_ID]
    );
    const totalPlayers = parseInt(totalResult.rows[0].total, 10);

    // Format all players
    const allPlayers = allPlayersResult.rows.map(row => ({
      rank: parseInt(row.rank, 10),
      player_id: row.player_id,
      display_name: row.display_name,
      rating: Math.round(parseFloat(row.rating)),
      is_you: row.player_id === profile.id,
    }));

    res.json({
      top100: allPlayers, // Keep field name for backwards compatibility
      neighborhood: [], // No longer needed since we show all players
      your_rank: userIsPremium ? actualUserRank : null, // Soft wall: only premium can see their rank
      total_players: totalPlayers,
    });
  } catch (error: any) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
