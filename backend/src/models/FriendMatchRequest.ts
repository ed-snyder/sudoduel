import { query } from '../config/database';

export interface FriendMatchRequest {
  id: number;
  from_player_id: number;
  to_player_id: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';
  match_id: number | null;
  created_at: Date;
  responded_at: Date | null;
  expires_at: Date;
}

export interface FriendMatchRequestWithDetails {
  id: number;
  from_player_id: number;
  from_display_name: string;
  from_rating: number;
  to_player_id: number;
  to_display_name: string;
  to_rating: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';
  match_id: number | null;
  created_at: Date;
  expires_at: Date;
}

export const FriendMatchRequestModel = {
  // Create a new friend match request
  async create(fromPlayerId: number, toPlayerId: number): Promise<FriendMatchRequest> {
    // Check for existing pending request from same sender
    const existing = await query(
      `SELECT * FROM friend_match_requests 
       WHERE from_player_id = $1 AND to_player_id = $2 AND status = 'PENDING'
         AND expires_at > NOW()`,
      [fromPlayerId, toPlayerId]
    );

    if (existing.rows.length > 0) {
      throw new Error('Match request already pending');
    }

    // Expire any old pending requests from same sender to same recipient
    await query(
      `UPDATE friend_match_requests 
       SET status = 'EXPIRED' 
       WHERE from_player_id = $1 AND to_player_id = $2 AND status = 'PENDING'`,
      [fromPlayerId, toPlayerId]
    );

    const result = await query(
      `INSERT INTO friend_match_requests (from_player_id, to_player_id, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '30 seconds')
       RETURNING *`,
      [fromPlayerId, toPlayerId]
    );
    return result.rows[0];
  },

  // Get a match request by ID
  async findById(id: number): Promise<FriendMatchRequest | null> {
    const result = await query(
      `SELECT * FROM friend_match_requests WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  // Get pending match request sent to a player
  async getPendingRequestsForPlayer(playerId: number): Promise<FriendMatchRequestWithDetails[]> {
    const result = await query(
      `SELECT 
        fmr.id,
        fmr.from_player_id,
        from_pp.display_name as from_display_name,
        COALESCE(from_pr.rating, 1500) as from_rating,
        fmr.to_player_id,
        to_pp.display_name as to_display_name,
        COALESCE(to_pr.rating, 1500) as to_rating,
        fmr.status,
        fmr.match_id,
        fmr.created_at,
        fmr.expires_at
       FROM friend_match_requests fmr
       JOIN player_profiles from_pp ON from_pp.id = fmr.from_player_id
       JOIN player_profiles to_pp ON to_pp.id = fmr.to_player_id
       LEFT JOIN player_ratings from_pr ON from_pr.player_id = fmr.from_player_id AND from_pr.ladder_id = 1
       LEFT JOIN player_ratings to_pr ON to_pr.player_id = fmr.to_player_id AND to_pr.ladder_id = 1
       WHERE fmr.to_player_id = $1 
         AND fmr.status = 'PENDING'
         AND fmr.expires_at > NOW()
       ORDER BY fmr.created_at DESC`,
      [playerId]
    );
    return result.rows;
  },

  // Get current pending request sent by a player
  async getPendingRequestFromPlayer(playerId: number): Promise<FriendMatchRequestWithDetails | null> {
    const result = await query(
      `SELECT 
        fmr.id,
        fmr.from_player_id,
        from_pp.display_name as from_display_name,
        COALESCE(from_pr.rating, 1500) as from_rating,
        fmr.to_player_id,
        to_pp.display_name as to_display_name,
        COALESCE(to_pr.rating, 1500) as to_rating,
        fmr.status,
        fmr.match_id,
        fmr.created_at,
        fmr.expires_at
       FROM friend_match_requests fmr
       JOIN player_profiles from_pp ON from_pp.id = fmr.from_player_id
       JOIN player_profiles to_pp ON to_pp.id = fmr.to_player_id
       LEFT JOIN player_ratings from_pr ON from_pr.player_id = fmr.from_player_id AND from_pr.ladder_id = 1
       LEFT JOIN player_ratings to_pr ON to_pr.player_id = fmr.to_player_id AND to_pr.ladder_id = 1
       WHERE fmr.from_player_id = $1 
         AND fmr.status = 'PENDING'
         AND fmr.expires_at > NOW()
       ORDER BY fmr.created_at DESC
       LIMIT 1`,
      [playerId]
    );
    return result.rows[0] || null;
  },

  // Accept a match request
  async accept(requestId: number, playerId: number, matchId: number): Promise<FriendMatchRequest> {
    const result = await query(
      `UPDATE friend_match_requests 
       SET status = 'ACCEPTED', match_id = $3, responded_at = NOW()
       WHERE id = $1 AND to_player_id = $2 AND status = 'PENDING' AND expires_at > NOW()
       RETURNING *`,
      [requestId, playerId, matchId]
    );

    if (result.rows.length === 0) {
      throw new Error('Match request not found, expired, or already responded');
    }

    return result.rows[0];
  },

  // Reject a match request
  async reject(requestId: number, playerId: number): Promise<FriendMatchRequest> {
    const result = await query(
      `UPDATE friend_match_requests 
       SET status = 'REJECTED', responded_at = NOW()
       WHERE id = $1 AND to_player_id = $2 AND status = 'PENDING'
       RETURNING *`,
      [requestId, playerId]
    );

    if (result.rows.length === 0) {
      throw new Error('Match request not found or already responded');
    }

    return result.rows[0];
  },

  // Cancel a match request (by sender)
  async cancel(requestId: number, playerId: number): Promise<FriendMatchRequest> {
    const result = await query(
      `UPDATE friend_match_requests 
       SET status = 'CANCELLED', responded_at = NOW()
       WHERE id = $1 AND from_player_id = $2 AND status = 'PENDING'
       RETURNING *`,
      [requestId, playerId]
    );

    if (result.rows.length === 0) {
      throw new Error('Match request not found or already responded');
    }

    return result.rows[0];
  },

  // Cancel all pending requests from a player
  async cancelAllFromPlayer(playerId: number): Promise<number> {
    const result = await query(
      `UPDATE friend_match_requests 
       SET status = 'CANCELLED', responded_at = NOW()
       WHERE from_player_id = $1 AND status = 'PENDING'`,
      [playerId]
    );
    return result.rowCount || 0;
  },

  // Expire old pending requests (cleanup job)
  async expireOldRequests(): Promise<number> {
    const result = await query(
      `UPDATE friend_match_requests 
       SET status = 'EXPIRED'
       WHERE status = 'PENDING' AND expires_at <= NOW()`
    );
    return result.rowCount || 0;
  },

  // Check if there's a pending request between two players
  async hasPendingRequest(fromPlayerId: number, toPlayerId: number): Promise<boolean> {
    const result = await query(
      `SELECT 1 FROM friend_match_requests 
       WHERE from_player_id = $1 AND to_player_id = $2 
         AND status = 'PENDING' AND expires_at > NOW()`,
      [fromPlayerId, toPlayerId]
    );
    return result.rows.length > 0;
  },
};
