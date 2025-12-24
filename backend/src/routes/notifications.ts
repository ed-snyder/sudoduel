import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { query } from '../config/database';
import { sendPushToUser, isFirebaseInitialized } from '../services/pushService';

const router = Router();

// GET /api/notifications/test - Test push (REMOVE AFTER TESTING)
router.get('/test', authMiddleware, async (req: AuthRequest, res: Response) => {
  console.log('🧪 Test push endpoint called');
  console.log('Firebase initialized:', isFirebaseInitialized());
  
  try {
    // Check if user has tokens
    const tokenResult = await query(
      'SELECT token, platform FROM device_tokens WHERE user_id = $1',
      [req.userId]
    );
    console.log(`User ${req.userId} has ${tokenResult.rows.length} device tokens`);
    tokenResult.rows.forEach((row, i) => {
      console.log(`  Token ${i + 1}: ${row.token.substring(0, 30)}... (${row.platform})`);
    });
    
    await sendPushToUser(
      req.userId!,
      'Test Push 🎉',
      'This is a test notification from Sudoduel!',
      { type: 'test' }
    );
    
    res.json({
      success: true,
      firebaseInitialized: isFirebaseInitialized(),
      tokensFound: tokenResult.rows.length,
    });
  } catch (error: any) {
    console.error('Test push error:', error);
    res.json({ success: false, error: error.message });
  }
});

// POST /api/notifications/register - Register device token
router.post('/register', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { token, platform } = req.body;
    
    if (!token || !platform) {
      return res.status(400).json({ error: 'Token and platform required' });
    }
    
    if (!['ios', 'android'].includes(platform)) {
      return res.status(400).json({ error: 'Platform must be ios or android' });
    }

    // Get player_id for this user
    const playerResult = await query(
      'SELECT id FROM player_profiles WHERE user_id = $1',
      [req.userId]
    );
    const playerId = playerResult.rows[0]?.id || null;

    await query(
      `INSERT INTO device_tokens (user_id, player_id, token, platform, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, token) 
       DO UPDATE SET platform = $4, player_id = $2, updated_at = NOW()`,
      [req.userId, playerId, token, platform]
    );

    console.log(`📱 Device token registered: user=${req.userId}, platform=${platform}`);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Register token error:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

// POST /api/notifications/unregister - Remove device token (on logout)
router.post('/unregister', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.body;
    
    if (token) {
      await query(
        'DELETE FROM device_tokens WHERE user_id = $1 AND token = $2',
        [req.userId, token]
      );
      console.log(`📱 Device token unregistered: user=${req.userId}`);
    } else {
      // Remove all tokens for this user
      await query(
        'DELETE FROM device_tokens WHERE user_id = $1',
        [req.userId]
      );
      console.log(`📱 All device tokens unregistered: user=${req.userId}`);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Unregister token error:', error);
    res.status(500).json({ error: 'Failed to unregister device' });
  }
});

export default router;

