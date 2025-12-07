import { query } from '../config/database';

export interface Friendship {
  id: number;
  player_id: number;
  friend_id: number;
  created_at: Date;
}

export interface FriendRequest {
  id: number;
  from_player_id: number;
  to_player_id: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  created_at: Date;
  responded_at: Date | null;
}

export interface FriendWithDetails {
  friend_id: number;
  display_name: string;
  rating: number;
  games_played: number;
  is_online?: boolean;
  friendship_date: Date;
}

export interface FriendRequestWithDetails {
  id: number;
  from_player_id: number;
  from_display_name: string;
  from_rating: number;
  to_player_id: number;
  to_display_name: string;
  to_rating: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  created_at: Date;
}

export interface HeadToHeadStats {
  opponent_id: number;
  opponent_name: string;
  wins: number;
  losses: number;
  draws: number;
  total_matches: number;
  last_match_at: Date | null;
}

export const FriendshipModel = {
  // Check if two players are friends
  async areFriends(playerId: number, otherPlayerId: number): Promise<boolean> {
    const result = await query(
      `SELECT 1 FROM friendships 
       WHERE player_id = $1 AND friend_id = $2`,
      [playerId, otherPlayerId]
    );
    return result.rows.length > 0;
  },

  // Get all friends for a player
  async getFriends(playerId: number): Promise<FriendWithDetails[]> {
    const result = await query(
      `SELECT 
        f.friend_id,
        pp.display_name,
        COALESCE(pr.rating, 1500) as rating,
        COALESCE(pr.games_played, 0) as games_played,
        f.created_at as friendship_date
       FROM friendships f
       JOIN player_profiles pp ON pp.id = f.friend_id
       LEFT JOIN player_ratings pr ON pr.player_id = f.friend_id AND pr.ladder_id = 1
       WHERE f.player_id = $1
       ORDER BY pp.display_name ASC`,
      [playerId]
    );
    return result.rows;
  },

  // Add a friendship (creates both directions)
  async addFriendship(playerId: number, friendId: number): Promise<void> {
    // Use a transaction to add both directions
    await query('BEGIN');
    try {
      await query(
        `INSERT INTO friendships (player_id, friend_id)
         VALUES ($1, $2)
         ON CONFLICT (player_id, friend_id) DO NOTHING`,
        [playerId, friendId]
      );
      await query(
        `INSERT INTO friendships (player_id, friend_id)
         VALUES ($1, $2)
         ON CONFLICT (player_id, friend_id) DO NOTHING`,
        [friendId, playerId]
      );
      await query('COMMIT');
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  },

  // Remove a friendship (removes both directions)
  async removeFriendship(playerId: number, friendId: number): Promise<void> {
    await query('BEGIN');
    try {
      await query(
        `DELETE FROM friendships WHERE player_id = $1 AND friend_id = $2`,
        [playerId, friendId]
      );
      await query(
        `DELETE FROM friendships WHERE player_id = $1 AND friend_id = $2`,
        [friendId, playerId]
      );
      await query('COMMIT');
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  },

  // Create a friend request
  async createFriendRequest(fromPlayerId: number, toPlayerId: number): Promise<FriendRequest> {
    // Check if already friends
    const alreadyFriends = await this.areFriends(fromPlayerId, toPlayerId);
    if (alreadyFriends) {
      throw new Error('Already friends with this player');
    }

    // Check for existing pending request (either direction)
    const existing = await query(
      `SELECT * FROM friend_requests 
       WHERE ((from_player_id = $1 AND to_player_id = $2) 
              OR (from_player_id = $2 AND to_player_id = $1))
         AND status = 'PENDING'`,
      [fromPlayerId, toPlayerId]
    );

    if (existing.rows.length > 0) {
      const existingRequest = existing.rows[0];
      // If the other person already sent us a request, accept it
      if (existingRequest.from_player_id === toPlayerId) {
        return this.acceptFriendRequest(existingRequest.id, toPlayerId);
      }
      throw new Error('Friend request already pending');
    }

    const result = await query(
      `INSERT INTO friend_requests (from_player_id, to_player_id)
       VALUES ($1, $2)
       RETURNING *`,
      [fromPlayerId, toPlayerId]
    );
    return result.rows[0];
  },

  // Accept a friend request
  async acceptFriendRequest(requestId: number, respondingPlayerId: number): Promise<FriendRequest> {
    const request = await query(
      `SELECT * FROM friend_requests WHERE id = $1 AND to_player_id = $2 AND status = 'PENDING'`,
      [requestId, respondingPlayerId]
    );

    if (request.rows.length === 0) {
      throw new Error('Friend request not found or already responded');
    }

    const friendRequest = request.rows[0];

    // Update the request
    await query(
      `UPDATE friend_requests SET status = 'ACCEPTED', responded_at = NOW() WHERE id = $1`,
      [requestId]
    );

    // Create the friendship
    await this.addFriendship(friendRequest.from_player_id, friendRequest.to_player_id);

    return { ...friendRequest, status: 'ACCEPTED' };
  },

  // Reject a friend request
  async rejectFriendRequest(requestId: number, respondingPlayerId: number): Promise<FriendRequest> {
    const request = await query(
      `SELECT * FROM friend_requests WHERE id = $1 AND to_player_id = $2 AND status = 'PENDING'`,
      [requestId, respondingPlayerId]
    );

    if (request.rows.length === 0) {
      throw new Error('Friend request not found or already responded');
    }

    await query(
      `UPDATE friend_requests SET status = 'REJECTED', responded_at = NOW() WHERE id = $1`,
      [requestId]
    );

    return { ...request.rows[0], status: 'REJECTED' };
  },

  // Get pending friend requests received by a player
  async getPendingRequestsReceived(playerId: number): Promise<FriendRequestWithDetails[]> {
    const result = await query(
      `SELECT 
        fr.id,
        fr.from_player_id,
        from_pp.display_name as from_display_name,
        COALESCE(from_pr.rating, 1500) as from_rating,
        fr.to_player_id,
        to_pp.display_name as to_display_name,
        COALESCE(to_pr.rating, 1500) as to_rating,
        fr.status,
        fr.created_at
       FROM friend_requests fr
       JOIN player_profiles from_pp ON from_pp.id = fr.from_player_id
       JOIN player_profiles to_pp ON to_pp.id = fr.to_player_id
       LEFT JOIN player_ratings from_pr ON from_pr.player_id = fr.from_player_id AND from_pr.ladder_id = 1
       LEFT JOIN player_ratings to_pr ON to_pr.player_id = fr.to_player_id AND to_pr.ladder_id = 1
       WHERE fr.to_player_id = $1 AND fr.status = 'PENDING'
       ORDER BY fr.created_at DESC`,
      [playerId]
    );
    return result.rows;
  },

  // Get pending friend requests sent by a player
  async getPendingRequestsSent(playerId: number): Promise<FriendRequestWithDetails[]> {
    const result = await query(
      `SELECT 
        fr.id,
        fr.from_player_id,
        from_pp.display_name as from_display_name,
        COALESCE(from_pr.rating, 1500) as from_rating,
        fr.to_player_id,
        to_pp.display_name as to_display_name,
        COALESCE(to_pr.rating, 1500) as to_rating,
        fr.status,
        fr.created_at
       FROM friend_requests fr
       JOIN player_profiles from_pp ON from_pp.id = fr.from_player_id
       JOIN player_profiles to_pp ON to_pp.id = fr.to_player_id
       LEFT JOIN player_ratings from_pr ON from_pr.player_id = fr.from_player_id AND from_pr.ladder_id = 1
       LEFT JOIN player_ratings to_pr ON to_pr.player_id = fr.to_player_id AND to_pr.ladder_id = 1
       WHERE fr.from_player_id = $1 AND fr.status = 'PENDING'
       ORDER BY fr.created_at DESC`,
      [playerId]
    );
    return result.rows;
  },

  // Cancel a sent friend request
  async cancelFriendRequest(requestId: number, fromPlayerId: number): Promise<void> {
    const result = await query(
      `DELETE FROM friend_requests 
       WHERE id = $1 AND from_player_id = $2 AND status = 'PENDING'`,
      [requestId, fromPlayerId]
    );
    if (result.rowCount === 0) {
      throw new Error('Friend request not found');
    }
  },

  // Search players by display name (for adding friends)
  async searchPlayers(searchQuery: string, excludePlayerId: number, limit: number = 10): Promise<Array<{
    id: number;
    display_name: string;
    rating: number;
    is_friend: boolean;
    has_pending_request: boolean;
  }>> {
    const result = await query(
      `SELECT 
        pp.id,
        pp.display_name,
        COALESCE(pr.rating, 1500) as rating,
        EXISTS(SELECT 1 FROM friendships f WHERE f.player_id = $2 AND f.friend_id = pp.id) as is_friend,
        EXISTS(
          SELECT 1 FROM friend_requests fr 
          WHERE ((fr.from_player_id = $2 AND fr.to_player_id = pp.id) 
                 OR (fr.from_player_id = pp.id AND fr.to_player_id = $2))
            AND fr.status = 'PENDING'
        ) as has_pending_request
       FROM player_profiles pp
       LEFT JOIN player_ratings pr ON pr.player_id = pp.id AND pr.ladder_id = 1
       WHERE pp.id != $2
         AND LOWER(pp.display_name) LIKE LOWER($1)
       ORDER BY 
         pp.display_name = $3 DESC,  -- Exact match first
         pp.display_name ASC
       LIMIT $4`,
      [`%${searchQuery}%`, excludePlayerId, searchQuery, limit]
    );
    return result.rows;
  },

  // Get head-to-head stats with another player
  async getHeadToHeadStats(playerId: number, opponentId: number): Promise<HeadToHeadStats | null> {
    // Ensure consistent ordering
    const [lowerId, higherId] = playerId < opponentId 
      ? [playerId, opponentId] 
      : [opponentId, playerId];
    
    const isPlayer1 = playerId < opponentId;

    const result = await query(
      `SELECT 
        h2h.*,
        pp.display_name as opponent_name
       FROM head_to_head_stats h2h
       JOIN player_profiles pp ON pp.id = $3
       WHERE h2h.player1_id = $1 AND h2h.player2_id = $2`,
      [lowerId, higherId, opponentId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      opponent_id: opponentId,
      opponent_name: row.opponent_name,
      wins: isPlayer1 ? row.player1_wins : row.player2_wins,
      losses: isPlayer1 ? row.player2_wins : row.player1_wins,
      draws: row.draws,
      total_matches: row.player1_wins + row.player2_wins + row.draws,
      last_match_at: row.last_match_at,
    };
  },

  // Update head-to-head stats after a match
  async updateHeadToHeadStats(player1Id: number, player2Id: number, winnerId: number | null): Promise<void> {
    await query(
      `SELECT update_head_to_head_stats($1, $2, $3)`,
      [player1Id, player2Id, winnerId]
    );
  },

  // Get friend count for a player
  async getFriendCount(playerId: number): Promise<number> {
    const result = await query(
      `SELECT COUNT(*) as count FROM friendships WHERE player_id = $1`,
      [playerId]
    );
    return parseInt(result.rows[0].count, 10);
  },
};
