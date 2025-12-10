import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { query } from '../config/database';
import { PlayerProfileModel } from '../models/PlayerProfile';
import { PlayerRatingModel } from '../models/PlayerRating';

const router = Router();
const DEFAULT_LADDER_ID = 1;

// GET /api/leaderboard - Get leaderboard data
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

    // Get top 100 players
    const top100Result = await query(
      `SELECT 
        pp.id as player_id,
        pp.display_name,
        pr.rating,
        RANK() OVER (ORDER BY pr.rating DESC) as rank
       FROM player_ratings pr
       JOIN player_profiles pp ON pp.id = pr.player_id
       WHERE pr.ladder_id = $1
       ORDER BY pr.rating DESC
       LIMIT 100`,
      [DEFAULT_LADDER_ID]
    );

    // Get current user's rank
    // Count players with higher rating, then add 1
    const userRankResult = await query(
      `SELECT COUNT(*)::int as rank
       FROM player_ratings
       WHERE ladder_id = $1 AND rating > $2`,
      [DEFAULT_LADDER_ID, currentUserRating]
    );
    const userRank = parseInt(userRankResult.rows[0].rank, 10) + 1;

    // Get total player count
    const totalResult = await query(
      `SELECT COUNT(*) as total FROM player_ratings WHERE ladder_id = $1`,
      [DEFAULT_LADDER_ID]
    );
    const totalPlayers = parseInt(totalResult.rows[0].total, 10);

    // Format top 100
    const top100 = top100Result.rows.map(row => ({
      rank: parseInt(row.rank, 10),
      player_id: row.player_id,
      display_name: row.display_name,
      rating: Math.round(parseFloat(row.rating)),
      is_you: row.player_id === profile.id,
    }));

    // If user is outside top 100, get their neighborhood (±5 players)
    let neighborhood: any[] = [];
    if (userRank > 100) {
      const neighborhoodResult = await query(
        `WITH ranked_players AS (
          SELECT 
            pp.id as player_id,
            pp.display_name,
            pr.rating,
            RANK() OVER (ORDER BY pr.rating DESC) as rank
          FROM player_ratings pr
          JOIN player_profiles pp ON pp.id = pr.player_id
          WHERE pr.ladder_id = $1
        )
        SELECT * FROM ranked_players
        WHERE rank BETWEEN $2 AND $3
        ORDER BY rank ASC`,
        [DEFAULT_LADDER_ID, Math.max(1, userRank - 5), userRank + 5]
      );

      neighborhood = neighborhoodResult.rows.map(row => ({
        rank: parseInt(row.rank, 10),
        player_id: row.player_id,
        display_name: row.display_name,
        rating: Math.round(parseFloat(row.rating)),
        is_you: row.player_id === profile.id,
      }));
    }

    res.json({
      top100,
      neighborhood,
      your_rank: userRank,
      total_players: totalPlayers,
    });
  } catch (error: any) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
