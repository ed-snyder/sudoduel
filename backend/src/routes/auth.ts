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

  // Safe delete that won't fail if table doesn't exist
  const safeDelete = async (sql: string, params: any[]) => {
    try {
      await query(sql, params);
    } catch (err: any) {
      if (!err.message.includes('does not exist') && !err.message.includes('relation') && !err.message.includes('table')) {
        throw err;
      }
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

    if (playerProfileId) {
      // Delete in order to respect foreign key constraints
      // Most tables have ON DELETE CASCADE, but we'll be explicit
      
      // 1. Delete from matchmaking queue
      await safeDelete('DELETE FROM matchmaking_queue WHERE player_id = $1', [playerProfileId]);
      
      // 2. Delete match players records (keeps match history but removes player link)
      await safeDelete('DELETE FROM match_players WHERE player_id = $1', [playerProfileId]);
      
      // 3. Delete head-to-head stats
      await safeDelete('DELETE FROM head_to_head_stats WHERE player1_id = $1 OR player2_id = $1', [playerProfileId]);
      
      // 4. Delete friend match requests
      await safeDelete('DELETE FROM friend_match_requests WHERE from_player_id = $1 OR to_player_id = $1', [playerProfileId]);
      
      // 5. Delete friendships (both directions)
      await safeDelete('DELETE FROM friendships WHERE player_id = $1 OR friend_id = $1', [playerProfileId]);
      
      // 6. Delete friend requests (both directions)
      await safeDelete('DELETE FROM friend_requests WHERE from_player_id = $1 OR to_player_id = $1', [playerProfileId]);
      
      // 7. Delete player ratings
      await safeDelete('DELETE FROM player_ratings WHERE player_id = $1', [playerProfileId]);
      
      // 8. Delete blocks (user_id references users table, blocked_user_id references player_profiles)
      await safeDelete('DELETE FROM blocked_users WHERE user_id = $1', [userId]);
      await safeDelete('DELETE FROM blocked_users WHERE blocked_user_id = $1', [playerProfileId]);
      
      // 9. Delete reports BY this user (keep reports OF this user for moderation)
      await safeDelete('DELETE FROM reports WHERE reporter_id = $1', [userId]);
      
      // 10. Delete player profile (this should cascade most things, but we've been explicit above)
      await query('DELETE FROM player_profiles WHERE id = $1', [playerProfileId]);
    }

    // 11. Finally, delete the user account itself
    await query('DELETE FROM users WHERE id = $1', [userId]);

    await query('COMMIT');

    res.json({ success: true, message: 'Account permanently deleted' });
  } catch (error: any) {
    await query('ROLLBACK');
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account. Please try again.' });
  }
});

export default router;
