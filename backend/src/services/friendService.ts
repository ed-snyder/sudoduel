import { FriendshipModel, FriendWithDetails, FriendRequestWithDetails, HeadToHeadStats } from '../models/Friendship';
import { FriendMatchRequestModel, FriendMatchRequestWithDetails } from '../models/FriendMatchRequest';
import { PlayerProfileModel } from '../models/PlayerProfile';
import { PlayerRatingModel } from '../models/PlayerRating';
import { MatchModel } from '../models/Match';
import { PuzzleModel } from '../models/Puzzle';
import { query } from '../config/database';
import { cache, CacheKeys, CacheTTL } from './cacheService';

const DEFAULT_LADDER_ID = 1;

// In-memory storage for pending friend match requests and their WebSocket connections
// This allows real-time notification when a friend sends/responds to match requests
interface PendingMatchRequestInfo {
  requestId: number;
  fromPlayerId: number;
  toPlayerId: number;
  createdAt: number;
  expiresAt: number;
}

const pendingFriendMatches = new Map<number, PendingMatchRequestInfo>(); // requestId -> info
const playerMatchRequests = new Map<number, number>(); // playerId -> requestId (for quick lookup)

export const FriendService = {
  // Get all friends for a user
  async getFriends(userId: number): Promise<FriendWithDetails[]> {
    const profile = await PlayerProfileModel.findByUserId(userId);
    if (!profile) {
      throw new Error('Player profile not found');
    }

    const cacheKey = CacheKeys.friends(profile.id);
    
    return cache.getOrSet(cacheKey, CacheTTL.FRIENDS, async () => {
      return FriendshipModel.getFriends(profile.id);
    });
  },

  // Send a friend request
  async sendFriendRequest(userId: number, toDisplayName: string): Promise<{ success: boolean; message: string; request?: FriendRequestWithDetails }> {
    const profile = await PlayerProfileModel.findByUserId(userId);
    if (!profile) {
      throw new Error('Player profile not found');
    }

    // Find the target player by display name
    const targetResult = await query(
      `SELECT id FROM player_profiles WHERE LOWER(display_name) = LOWER($1)`,
      [toDisplayName]
    );

    if (targetResult.rows.length === 0) {
      throw new Error('Player not found');
    }

    const targetPlayerId = targetResult.rows[0].id;

    if (targetPlayerId === profile.id) {
      throw new Error('Cannot send friend request to yourself');
    }

    // Check if the target has blocked the sender
    const isBlocked = await query(
      `SELECT 1 FROM blocked_users 
       WHERE user_id = (SELECT user_id FROM player_profiles WHERE id = $1)
       AND blocked_user_id = $2`,
      [targetPlayerId, profile.id]
    );
    
    if (isBlocked.rows.length > 0) {
      // Don't reveal they're blocked - use generic error
      throw new Error('Unable to send friend request');
    }

    try {
      const request = await FriendshipModel.createFriendRequest(profile.id, targetPlayerId);
      
      // Invalidate caches
      cache.invalidate(`friends:${profile.id}`);
      cache.invalidate(`friends:${targetPlayerId}`);
      cache.invalidate(`friend_count:${profile.id}`);
      cache.invalidate(`friend_count:${targetPlayerId}`);
      
      // Check if this auto-accepted (mutual request)
      if (request.status === 'ACCEPTED') {
        return { 
          success: true, 
          message: 'Friend request accepted! You are now friends.',
        };
      }

      // Get full details
      const pending = await FriendshipModel.getPendingRequestsSent(profile.id);
      const fullRequest = pending.find(r => r.id === request.id);

      return { 
        success: true, 
        message: 'Friend request sent',
        request: fullRequest,
      };
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Send a friend request by player ID (used from result screen)
  async sendFriendRequestById(userId: number, toPlayerId: number): Promise<{ success: boolean; message: string }> {
    const profile = await PlayerProfileModel.findByUserId(userId);
    if (!profile) {
      throw new Error('Player profile not found');
    }

    if (toPlayerId === profile.id) {
      throw new Error('Cannot send friend request to yourself');
    }

    // Verify target exists
    const target = await PlayerProfileModel.findById(toPlayerId);
    if (!target) {
      throw new Error('Player not found');
    }

    // Check if the target has blocked the sender
    const isBlocked = await query(
      `SELECT 1 FROM blocked_users 
       WHERE user_id = (SELECT user_id FROM player_profiles WHERE id = $1)
       AND blocked_user_id = $2`,
      [toPlayerId, profile.id]
    );
    
    if (isBlocked.rows.length > 0) {
      // Don't reveal they're blocked - use generic error
      throw new Error('Unable to send friend request');
    }

    try {
      const request = await FriendshipModel.createFriendRequest(profile.id, toPlayerId);
      
      // Invalidate caches
      cache.invalidate(`friends:${profile.id}`);
      cache.invalidate(`friends:${toPlayerId}`);
      cache.invalidate(`friend_count:${profile.id}`);
      cache.invalidate(`friend_count:${toPlayerId}`);
      
      if (request.status === 'ACCEPTED') {
        return { 
          success: true, 
          message: 'Friend request accepted! You are now friends.',
        };
      }

      return { 
        success: true, 
        message: 'Friend request sent',
      };
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Accept a friend request
  async acceptFriendRequest(userId: number, requestId: number): Promise<{ success: boolean; message: string }> {
    const profile = await PlayerProfileModel.findByUserId(userId);
    if (!profile) {
      throw new Error('Player profile not found');
    }

    try {
      const request = await FriendshipModel.getPendingRequestsReceived(profile.id);
      const friendRequest = request.find(r => r.id === requestId);
      const otherPlayerId = friendRequest?.from_player_id;
      
      await FriendshipModel.acceptFriendRequest(requestId, profile.id);
      
      // Invalidate caches
      if (otherPlayerId) {
        cache.invalidate(`friends:${profile.id}`);
        cache.invalidate(`friends:${otherPlayerId}`);
        cache.invalidate(`friend_count:${profile.id}`);
        cache.invalidate(`friend_count:${otherPlayerId}`);
      }
      
      return { success: true, message: 'Friend request accepted' };
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Reject a friend request
  async rejectFriendRequest(userId: number, requestId: number): Promise<{ success: boolean; message: string }> {
    const profile = await PlayerProfileModel.findByUserId(userId);
    if (!profile) {
      throw new Error('Player profile not found');
    }

    try {
      await FriendshipModel.rejectFriendRequest(requestId, profile.id);
      return { success: true, message: 'Friend request rejected' };
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Cancel a sent friend request
  async cancelFriendRequest(userId: number, requestId: number): Promise<{ success: boolean; message: string }> {
    const profile = await PlayerProfileModel.findByUserId(userId);
    if (!profile) {
      throw new Error('Player profile not found');
    }

    try {
      await FriendshipModel.cancelFriendRequest(requestId, profile.id);
      return { success: true, message: 'Friend request cancelled' };
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Get pending friend requests (received)
  async getPendingRequestsReceived(userId: number): Promise<FriendRequestWithDetails[]> {
    const profile = await PlayerProfileModel.findByUserId(userId);
    if (!profile) {
      throw new Error('Player profile not found');
    }
    return FriendshipModel.getPendingRequestsReceived(profile.id);
  },

  // Get pending friend requests (sent)
  async getPendingRequestsSent(userId: number): Promise<FriendRequestWithDetails[]> {
    const profile = await PlayerProfileModel.findByUserId(userId);
    if (!profile) {
      throw new Error('Player profile not found');
    }
    return FriendshipModel.getPendingRequestsSent(profile.id);
  },

  // Remove a friend
  async removeFriend(userId: number, friendId: number): Promise<{ success: boolean; message: string }> {
    const profile = await PlayerProfileModel.findByUserId(userId);
    if (!profile) {
      throw new Error('Player profile not found');
    }

    const areFriends = await FriendshipModel.areFriends(profile.id, friendId);
    if (!areFriends) {
      throw new Error('Not friends with this player');
    }

    await FriendshipModel.removeFriendship(profile.id, friendId);
    
    // Invalidate caches
    cache.invalidate(`friends:${profile.id}`);
    cache.invalidate(`friends:${friendId}`);
    cache.invalidate(`friend_count:${profile.id}`);
    cache.invalidate(`friend_count:${friendId}`);
    
    return { success: true, message: 'Friend removed' };
  },

  // Search for players
  async searchPlayers(userId: number, searchQuery: string) {
    const profile = await PlayerProfileModel.findByUserId(userId);
    if (!profile) {
      throw new Error('Player profile not found');
    }

    if (!searchQuery || searchQuery.length < 2) {
      return [];
    }

    return FriendshipModel.searchPlayers(searchQuery, profile.id);
  },

  // Get head-to-head stats
  async getHeadToHeadStats(userId: number, opponentId: number): Promise<HeadToHeadStats | null> {
    const profile = await PlayerProfileModel.findByUserId(userId);
    if (!profile) {
      throw new Error('Player profile not found');
    }
    return FriendshipModel.getHeadToHeadStats(profile.id, opponentId);
  },

  // Send a match request to a friend
  async sendMatchRequest(userId: number, friendId: number): Promise<{
    success: boolean;
    requestId: number;
    message: string;
  }> {
    const profile = await PlayerProfileModel.findByUserId(userId);
    if (!profile) {
      throw new Error('Player profile not found');
    }

    // Verify they are friends
    const areFriends = await FriendshipModel.areFriends(profile.id, friendId);
    if (!areFriends) {
      throw new Error('You can only send match requests to friends');
    }

    // Check for existing pending request
    const existingRequest = await FriendMatchRequestModel.getPendingRequestFromPlayer(profile.id);
    if (existingRequest) {
      throw new Error('You already have a pending match request');
    }

    const request = await FriendMatchRequestModel.create(profile.id, friendId);

    // Store in memory for real-time tracking
    const expiresAt = new Date(request.expires_at).getTime();
    pendingFriendMatches.set(request.id, {
      requestId: request.id,
      fromPlayerId: profile.id,
      toPlayerId: friendId,
      createdAt: Date.now(),
      expiresAt,
    });
    playerMatchRequests.set(profile.id, request.id);

    // Set up auto-expiry
    const timeUntilExpiry = expiresAt - Date.now();
    setTimeout(() => {
      this.cleanupExpiredRequest(request.id);
    }, Math.max(0, timeUntilExpiry));

    return {
      success: true,
      requestId: request.id,
      message: 'Match request sent',
    };
  },

  // Accept a match request and create the match
  async acceptMatchRequest(userId: number, requestId: number): Promise<{
    success: boolean;
    matchId: number;
    message: string;
  }> {
    const profile = await PlayerProfileModel.findByUserId(userId);
    if (!profile) {
      throw new Error('Player profile not found');
    }

    // Get the request
    const request = await FriendMatchRequestModel.findById(requestId);
    if (!request) {
      throw new Error('Match request not found');
    }

    if (request.to_player_id !== profile.id) {
      throw new Error('This match request was not sent to you');
    }

    if (request.status !== 'PENDING') {
      throw new Error('Match request is no longer pending');
    }

    if (new Date(request.expires_at) < new Date()) {
      throw new Error('Match request has expired');
    }

    // Create an unranked match
    const puzzle = await PuzzleModel.getRandomByLadder(DEFAULT_LADDER_ID);
    if (!puzzle) {
      throw new Error('No puzzle available');
    }

    const match = await MatchModel.create(DEFAULT_LADDER_ID, puzzle.id, false); // false = not ranked

    // Get ratings for both players
    const rating1 = await PlayerRatingModel.findByPlayerAndLadder(request.from_player_id, DEFAULT_LADDER_ID);
    const rating2 = await PlayerRatingModel.findByPlayerAndLadder(profile.id, DEFAULT_LADDER_ID);

    // Add players to match
    await MatchModel.addPlayer(
      match.id,
      request.from_player_id,
      1,
      rating1?.rating || 1500,
      rating1?.rd || 350,
      rating1?.volatility || 0.06
    );

    await MatchModel.addPlayer(
      match.id,
      profile.id,
      2,
      rating2?.rating || 1500,
      rating2?.rd || 350,
      rating2?.volatility || 0.06
    );

    // Accept the request
    await FriendMatchRequestModel.accept(requestId, profile.id, match.id);

    // Clean up memory
    this.cleanupExpiredRequest(requestId);

    return {
      success: true,
      matchId: match.id,
      message: 'Match created! Connecting...',
    };
  },

  // Reject a match request
  async rejectMatchRequest(userId: number, requestId: number): Promise<{ success: boolean; message: string }> {
    const profile = await PlayerProfileModel.findByUserId(userId);
    if (!profile) {
      throw new Error('Player profile not found');
    }

    await FriendMatchRequestModel.reject(requestId, profile.id);
    
    // Clean up memory
    this.cleanupExpiredRequest(requestId);

    return { success: true, message: 'Match request declined' };
  },

  // Cancel a sent match request
  async cancelMatchRequest(userId: number, requestId: number): Promise<{ success: boolean; message: string }> {
    const profile = await PlayerProfileModel.findByUserId(userId);
    if (!profile) {
      throw new Error('Player profile not found');
    }

    await FriendMatchRequestModel.cancel(requestId, profile.id);
    
    // Clean up memory
    this.cleanupExpiredRequest(requestId);

    return { success: true, message: 'Match request cancelled' };
  },

  // Get pending match requests for a player
  async getPendingMatchRequests(userId: number): Promise<FriendMatchRequestWithDetails[]> {
    const profile = await PlayerProfileModel.findByUserId(userId);
    if (!profile) {
      throw new Error('Player profile not found');
    }
    return FriendMatchRequestModel.getPendingRequestsForPlayer(profile.id);
  },

  // Get the current outgoing match request for a player
  async getCurrentOutgoingMatchRequest(userId: number): Promise<FriendMatchRequestWithDetails | null> {
    const profile = await PlayerProfileModel.findByUserId(userId);
    if (!profile) {
      throw new Error('Player profile not found');
    }
    return FriendMatchRequestModel.getPendingRequestFromPlayer(profile.id);
  },

  // Check if display name is available
  async isDisplayNameAvailable(displayName: string, currentUserId?: number): Promise<boolean> {
    let excludeId: number | null = null;
    
    if (currentUserId) {
      const profile = await PlayerProfileModel.findByUserId(currentUserId);
      excludeId = profile?.id || null;
    }

    const result = await query(
      `SELECT 1 FROM player_profiles 
       WHERE LOWER(display_name) = LOWER($1)
         AND ($2::bigint IS NULL OR id != $2)`,
      [displayName, excludeId]
    );

    return result.rows.length === 0;
  },

  // Clean up expired request from memory
  cleanupExpiredRequest(requestId: number): void {
    const info = pendingFriendMatches.get(requestId);
    if (info) {
      playerMatchRequests.delete(info.fromPlayerId);
      pendingFriendMatches.delete(requestId);
    }
  },

  // Get request info from memory (for WebSocket notifications)
  getMatchRequestInfo(requestId: number): PendingMatchRequestInfo | undefined {
    return pendingFriendMatches.get(requestId);
  },

  // Get player's current outgoing request ID
  getPlayerOutgoingRequestId(playerId: number): number | undefined {
    return playerMatchRequests.get(playerId);
  },
};
