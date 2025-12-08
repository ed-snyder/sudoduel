import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { query } from '../config/database';
import { PlayerProfileModel } from '../models/PlayerProfile';

const router = Router();

// POST /api/users/block - Block a user
router.post('/block', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { target_user_id } = req.body;
    
    if (!target_user_id || typeof target_user_id !== 'number') {
      return res.status(400).json({ error: 'target_user_id is required and must be a number' });
    }
    
    // Get the blocker's profile
    const blockerProfile = await PlayerProfileModel.findByUserId(req.userId!);
    if (!blockerProfile) {
      return res.status(400).json({ error: 'Blocker profile not found' });
    }
    
    // Check if trying to block yourself
    const targetProfile = await PlayerProfileModel.findById(target_user_id);
    if (!targetProfile) {
      return res.status(400).json({ error: 'Target user not found' });
    }
    
    if (blockerProfile.id === target_user_id) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }
    
    // Ensure blocked_users table exists
    try {
      await query(`SELECT 1 FROM blocked_users LIMIT 1`);
    } catch (err: any) {
      // If table doesn't exist, create it
      if (err.message.includes('relation "blocked_users" does not exist')) {
        await query(`
          CREATE TABLE IF NOT EXISTS blocked_users (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            blocked_user_id INTEGER NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(user_id, blocked_user_id)
          )
        `);
        await query(`
          CREATE INDEX IF NOT EXISTS idx_blocked_users_user ON blocked_users(user_id)
        `);
        await query(`
          CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON blocked_users(blocked_user_id)
        `);
      } else {
        throw err;
      }
    }
    
    // Check if already blocked
    const existingBlock = await query(
      `SELECT id FROM blocked_users WHERE user_id = $1 AND blocked_user_id = $2`,
      [req.userId!, target_user_id]
    );
    
    if (existingBlock.rows.length > 0) {
      return res.status(400).json({ error: 'User already blocked' });
    }
    
    // Insert block
    await query(
      `INSERT INTO blocked_users (user_id, blocked_user_id, created_at) 
       VALUES ($1, $2, NOW())`,
      [req.userId!, target_user_id]
    );
    
    res.json({ 
      success: true, 
      message: 'User blocked successfully' 
    });
  } catch (error: any) {
    console.error('Block user error:', error);
    res.status(400).json({ error: error.message || 'Failed to block user' });
  }
});

// POST /api/users/unblock - Unblock a user
router.post('/unblock', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { target_user_id } = req.body;
    
    if (!target_user_id || typeof target_user_id !== 'number') {
      return res.status(400).json({ error: 'target_user_id is required and must be a number' });
    }
    
    // Remove block
    const result = await query(
      `DELETE FROM blocked_users WHERE user_id = $1 AND blocked_user_id = $2`,
      [req.userId!, target_user_id]
    );
    
    if (result.rowCount === 0) {
      return res.status(400).json({ error: 'User is not blocked' });
    }
    
    res.json({ 
      success: true, 
      message: 'User unblocked successfully' 
    });
  } catch (error: any) {
    console.error('Unblock user error:', error);
    res.status(400).json({ error: error.message || 'Failed to unblock user' });
  }
});

export default router;
