import { Router, Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { validateUsername } from '../utils/usernameValidator';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { query } from '../config/database';

const router = Router();

// POST /api/auth/signup
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, display_name } = req.body;

    // Validation
    if (!email || !password || !display_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Validate display name (critical for Apple App Store compliance)
    if (!display_name || typeof display_name !== 'string') {
      return res.status(400).json({ error: 'Display name is required' });
    }
    
    const usernameValidation = validateUsername(display_name);
    if (!usernameValidation.valid) {
      return res.status(400).json({ error: usernameValidation.error || 'Invalid display name' });
    }

    const result = await AuthService.signup(email, password, display_name.trim());
    
    res.status(201).json(result);
  } catch (error: any) {
    console.error('Signup error:', error);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password' });
    }

    const result = await AuthService.login(email, password);
    
    res.json(result);
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(401).json({ error: error.message });
  }
});

// DELETE /api/auth/account - Permanently delete user account
router.delete('/account', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Helper to safely run delete queries (ignores "table/column doesn't exist" errors)
  const safeDelete = async (sql: string, params: any[]): Promise<void> => {
    try {
      await query(sql, params);
    } catch (err: any) {
      const msg = err.message || '';
      // Ignore missing table/column errors
      if (msg.includes('does not exist') || msg.includes('column')) {
        console.log(`[Delete Account] Skipping: ${msg}`);
        return;
      }
      throw err;
    }
  };

  try {
    await query('BEGIN');

    // Get player profile ID for this user
    const profileResult = await query(
      'SELECT id FROM player_profiles WHERE user_id = $1',
      [userId]
    );
    const playerProfileId = profileResult.rows[0]?.id;

    console.log(`[Delete Account] Starting deletion for user ${userId}, player profile ${playerProfileId}`);

    if (playerProfileId) {
      // Delete from all related tables (order matters for foreign keys)
      
      // 1. Matchmaking queue
      await safeDelete('DELETE FROM matchmaking_queue WHERE player_id = $1', [playerProfileId]);
      
      // 2. Match players (removes from match history but keeps matches for other player)
      await safeDelete('DELETE FROM match_players WHERE player_id = $1', [playerProfileId]);
      
      // 3. Head-to-head stats (both sides)
      await safeDelete('DELETE FROM head_to_head_stats WHERE player1_id = $1 OR player2_id = $1', [playerProfileId]);
      
      // 4. Friend match requests (both directions)
      await safeDelete('DELETE FROM friend_match_requests WHERE from_player_id = $1 OR to_player_id = $1', [playerProfileId]);
      
      // 5. Friendships (both directions)
      await safeDelete('DELETE FROM friendships WHERE player_id = $1 OR friend_id = $1', [playerProfileId]);
      
      // 6. Friend requests (both directions)
      await safeDelete('DELETE FROM friend_requests WHERE from_player_id = $1 OR to_player_id = $1', [playerProfileId]);
      
      // 7. Player ratings
      await safeDelete('DELETE FROM player_ratings WHERE player_id = $1', [playerProfileId]);
      
      // 8. Blocked users (user_id is users.id, blocked_user_id is player_profiles.id)
      await safeDelete('DELETE FROM blocked_users WHERE user_id = $1', [userId]);
      await safeDelete('DELETE FROM blocked_users WHERE blocked_user_id = $1', [playerProfileId]);
      
      // 9. Reports (reporter_id and target_user_id both reference player_profiles.id)
      await safeDelete('DELETE FROM reports WHERE reporter_id = $1', [playerProfileId]);
      await safeDelete('DELETE FROM reports WHERE target_user_id = $1', [playerProfileId]);
      
      // 10. Delete player profile itself
      await query('DELETE FROM player_profiles WHERE id = $1', [playerProfileId]);
      console.log(`[Delete Account] Deleted player profile ${playerProfileId}`);
    }

    // 11. Finally delete the user
    await query('DELETE FROM users WHERE id = $1', [userId]);
    console.log(`[Delete Account] Deleted user ${userId}`);

    await query('COMMIT');
    console.log(`[Delete Account] Successfully completed deletion for user ${userId}`);

    res.json({ success: true, message: 'Account permanently deleted' });
  } catch (error: any) {
    await query('ROLLBACK');
    console.error('[Delete Account] FAILED:', error);
    // Return the actual error message for debugging
    res.status(500).json({ error: error.message || 'Failed to delete account' });
  }
});

export default router;
