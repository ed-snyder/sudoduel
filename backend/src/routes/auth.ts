import { Router, Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { query } from '../config/database';

const router = Router();

// ===========================================
// OAUTH + GUEST AUTHENTICATION ROUTES
// ===========================================

// POST /api/auth/guest - Create a new guest account
router.post('/guest', async (_req: Request, res: Response) => {
  try {
    const result = await AuthService.guestSignIn();
    res.status(201).json(result);
  } catch (error: any) {
    console.error('Guest sign-in error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/google - Sign in with Google
router.post('/google', async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'Missing idToken' });
    }

    const result = await AuthService.googleSignIn(idToken);
    res.json(result);
  } catch (error: any) {
    console.error('Google sign-in error:', error);
    res.status(401).json({ error: error.message });
  }
});

// POST /api/auth/apple - Sign in with Apple
router.post('/apple', async (req: Request, res: Response) => {
  try {
    const { identityToken, user } = req.body;

    if (!identityToken) {
      return res.status(400).json({ error: 'Missing identityToken' });
    }

    const result = await AuthService.appleSignIn(identityToken, user);
    res.json(result);
  } catch (error: any) {
    console.error('Apple sign-in error:', error);
    res.status(401).json({ error: error.message });
  }
});

// ===========================================
// GUEST ACCOUNT LINKING ROUTES
// ===========================================

// POST /api/auth/guest/link-google - Link Google account to guest
router.post('/guest/link-google', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'Missing idToken' });
    }

    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await AuthService.linkGoogleToGuest(req.userId, idToken);
    res.json(result);
  } catch (error: any) {
    console.error('Link Google error:', error);
    // Return 400 for linking conflicts, 401 for auth errors
    const status = error.message.includes('already') ? 400 : 401;
    res.status(status).json({ error: error.message });
  }
});

// POST /api/auth/guest/link-apple - Link Apple account to guest
router.post('/guest/link-apple', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { identityToken, user } = req.body;

    if (!identityToken) {
      return res.status(400).json({ error: 'Missing identityToken' });
    }

    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await AuthService.linkAppleToGuest(req.userId, identityToken, user);
    res.json(result);
  } catch (error: any) {
    console.error('Link Apple error:', error);
    // Return 400 for linking conflicts, 401 for auth errors
    const status = error.message.includes('already') ? 400 : 401;
    res.status(status).json({ error: error.message });
  }
});

// ===========================================
// ACCOUNT MANAGEMENT
// ===========================================

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

// ===========================================
// LEGACY ROUTES - REMOVED FOR OAUTH MIGRATION
// ===========================================
// POST /signup and POST /login have been removed.
// Authentication is now handled via:
// - POST /guest (anonymous play)
// - POST /google (Google OAuth)
// - POST /apple (Apple OAuth)
// - POST /guest/link-google (upgrade guest account)
// - POST /guest/link-apple (upgrade guest account)
// ===========================================

export default router;
