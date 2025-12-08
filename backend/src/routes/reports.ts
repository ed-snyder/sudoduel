import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { query } from '../config/database';

const router = Router();

// POST /api/reports - Report a user
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { target_user_id, reason } = req.body;
    
    if (!target_user_id || typeof target_user_id !== 'number') {
      return res.status(400).json({ error: 'target_user_id is required and must be a number' });
    }
    
    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ error: 'reason is required and must be a string' });
    }
    
    // Validate reason matches expected pattern (uppercase enum values)
    const validReasons = ['CHEATING', 'OFFENSIVE_CONTENT'];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({ 
        error: `The string did not match the expected pattern. Valid reasons: ${validReasons.join(', ')}` 
      });
    }
    
    // Get the reporter's profile
    const reporterResult = await query(
      `SELECT id FROM player_profiles WHERE user_id = $1`,
      [req.userId!]
    );
    
    if (reporterResult.rows.length === 0) {
      return res.status(400).json({ error: 'Reporter profile not found' });
    }
    
    const reporterId = reporterResult.rows[0].id;
    
    // Check if target user exists
    const targetResult = await query(
      `SELECT id FROM player_profiles WHERE id = $1`,
      [target_user_id]
    );
    
    if (targetResult.rows.length === 0) {
      return res.status(400).json({ error: 'Target user not found' });
    }
    
    // Insert report (assuming reports table exists, or create it if needed)
    // For now, just log it - you can create a proper reports table later
    await query(
      `INSERT INTO reports (reporter_id, target_user_id, reason, created_at) 
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT DO NOTHING`,
      [reporterId, target_user_id, reason]
    ).catch(async (err) => {
      // If table doesn't exist, create it
      if (err.message.includes('relation "reports" does not exist')) {
        await query(`
          CREATE TABLE IF NOT EXISTS reports (
            id SERIAL PRIMARY KEY,
            reporter_id INTEGER NOT NULL REFERENCES player_profiles(id),
            target_user_id INTEGER NOT NULL REFERENCES player_profiles(id),
            reason VARCHAR(50) NOT NULL CHECK (reason IN ('CHEATING', 'OFFENSIVE_CONTENT')),
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(reporter_id, target_user_id, reason)
          )
        `);
        // Retry insert
        await query(
          `INSERT INTO reports (reporter_id, target_user_id, reason, created_at) 
           VALUES ($1, $2, $3, NOW())`,
          [reporterId, target_user_id, reason]
        );
      } else {
        throw err;
      }
    });
    
    res.json({ 
      success: true, 
      message: 'Report submitted successfully' 
    });
  } catch (error: any) {
    console.error('Report user error:', error);
    res.status(400).json({ error: error.message || 'Failed to submit report' });
  }
});

export default router;
