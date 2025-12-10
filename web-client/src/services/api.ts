import { api } from '../config';

// =====================================================
// FRIENDS API
// =====================================================

export interface Friend {
  friend_id: number;
  display_name: string;
  rating: number;
  games_played: number;
  is_online?: boolean;
  friendship_date: string;
}

export interface FriendRequest {
  id: number;
  from_player_id: number;
  from_display_name: string;
  from_rating: number;
  to_player_id: number;
  to_display_name: string;
  to_rating: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  created_at: string;
}

export interface PlayerSearchResult {
  id: number;
  display_name: string;
  rating: number;
  is_friend: boolean;
  has_pending_request: boolean;
}

export interface HeadToHeadStats {
  opponent_id: number;
  opponent_name: string;
  wins: number;
  losses: number;
  draws: number;
  total_matches: number;
  last_match_at: string | null;
}

export interface MatchRequest {
  id: number;
  from_player_id: number;
  from_display_name: string;
  from_rating: number;
  to_player_id: number;
  to_display_name: string;
  to_rating: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';
  match_id: number | null;
  created_at: string;
  expires_at: string;
}

export const friendsAPI = {
  // Get all friends
  getFriends: () => api.get('/api/friends') as Promise<{ friends: Friend[] }>,

  // Search for players by display name
  searchPlayers: (query: string) => 
    api.get(`/api/friends/search?q=${encodeURIComponent(query)}`) as Promise<{ players: PlayerSearchResult[] }>,

  // Send a friend request by display name
  sendFriendRequest: (displayName: string) => 
    api.post('/api/friends/request', { display_name: displayName }) as Promise<{ success: boolean; message: string }>,

  // Send a friend request by player ID
  sendFriendRequestById: (playerId: number) => 
    api.post(`/api/friends/request/${playerId}`, {}) as Promise<{ success: boolean; message: string }>,

  // Get pending friend requests received
  getPendingRequestsReceived: () => 
    api.get('/api/friends/requests/received') as Promise<{ requests: FriendRequest[] }>,

  // Get pending friend requests sent
  getPendingRequestsSent: () => 
    api.get('/api/friends/requests/sent') as Promise<{ requests: FriendRequest[] }>,

  // Accept a friend request
  acceptFriendRequest: (requestId: number) => 
    api.post(`/api/friends/requests/${requestId}/accept`, {}) as Promise<{ success: boolean; message: string }>,

  // Reject a friend request
  rejectFriendRequest: (requestId: number) => 
    api.post(`/api/friends/requests/${requestId}/reject`, {}) as Promise<{ success: boolean; message: string }>,

  // Cancel a sent friend request
  cancelFriendRequest: (requestId: number) => 
    api.delete(`/api/friends/requests/${requestId}`) as Promise<{ success: boolean; message: string }>,

  // Remove a friend
  removeFriend: (friendId: number) => 
    api.delete(`/api/friends/${friendId}`) as Promise<{ success: boolean; message: string }>,

  // Get head-to-head stats with an opponent
  getHeadToHeadStats: (opponentId: number) => 
    api.get(`/api/friends/head-to-head/${opponentId}`) as Promise<{ stats: HeadToHeadStats | null }>,

  // Check if display name is available
  checkDisplayName: (name: string) => 
    api.get(`/api/friends/check-name?name=${encodeURIComponent(name)}`) as Promise<{ available: boolean }>,

  // =====================================================
  // MATCH REQUESTS
  // =====================================================

  // Send a match request to a friend
  sendMatchRequest: (friendId: number) => 
    api.post(`/api/friends/match-request/${friendId}`, {}) as Promise<{ success: boolean; requestId: number; message: string }>,

  // Get pending match requests received
  getPendingMatchRequests: () => 
    api.get('/api/friends/match-requests') as Promise<{ requests: MatchRequest[] }>,

  // Get current outgoing match request
  getCurrentOutgoingMatchRequest: () => 
    api.get('/api/friends/match-request/outgoing') as Promise<{ request: MatchRequest | null }>,

  // Accept a match request
  acceptMatchRequest: (requestId: number) => 
    api.post(`/api/friends/match-requests/${requestId}/accept`, {}) as Promise<{ success: boolean; matchId: number; message: string }>,

  // Reject a match request
  rejectMatchRequest: (requestId: number) => 
    api.post(`/api/friends/match-requests/${requestId}/reject`, {}) as Promise<{ success: boolean; message: string }>,

  // Cancel a match request
  cancelMatchRequest: (requestId: number) => 
    api.delete(`/api/friends/match-requests/${requestId}`) as Promise<{ success: boolean; message: string }>,
};

// =====================================================
// PLAYER API (extended)
// =====================================================

export interface UserRank {
  rank: number;
  total_players: number;
  rating: number;
}

export interface PlayerPublicProfile {
  player_id: number;
  display_name: string;
  rating: number;
  is_premium: boolean;
  rank: number | null;
  total_players: number;
}

export const playerAPI = {
  getMe: () => api.get('/api/player/me'),
  getMatchHistory: (limit = 50, offset = 0) => 
    api.get(`/api/player/match-history?limit=${limit}&offset=${offset}`),
  getStats: () => api.get('/api/player/stats'),
  getRank: () => api.get('/api/player/rank') as Promise<UserRank>,
  getPlayerProfile: (playerId: number) =>
    api.get(`/api/player/${playerId}/profile`) as Promise<PlayerPublicProfile>,
  
  // Update profile (display name)
  updateProfile: (displayName: string) => 
    api.patch('/api/player/profile', { display_name: displayName }) as Promise<{ success: boolean; display_name: string }>,
  
  // Check if display name is available
  checkDisplayName: (name: string) => 
    api.get(`/api/player/check-name?name=${encodeURIComponent(name)}`) as Promise<{ available: boolean; reason?: string }>,
  
  // Mark tutorial as complete
  markTutorialComplete: () => 
    api.patch('/api/player/tutorial-complete', {}) as Promise<{ success: boolean; tutorial_completed: boolean; tutorial_completed_at: string }>,
  
  // Update premium status
  updatePremiumStatus: (isPremium: boolean) =>
    api.put('/api/player/premium', { is_premium: isPremium }) as Promise<{
      success: boolean;
      is_premium: boolean;
      display_name: string;
    }>,
};

// =====================================================
// AUTH API
// =====================================================

export const authAPI = {
  signup: (email: string, password: string, displayName: string) =>
    api.post('/api/auth/signup', { email, password, display_name: displayName }),

  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }),

  deleteAccount: () => api.delete('/api/auth/account') as Promise<{ success: boolean; message: string }>,
};

// =====================================================
// MATCHMAKING API
// =====================================================

export const matchmakingAPI = {
  join: () => api.post('/api/matchmaking/join', {}),
  leave: () => api.post('/api/matchmaking/leave', {}),
  status: () => api.get('/api/matchmaking/status'),
};

// =====================================================
// PUZZLE API
// =====================================================

export const puzzleAPI = {
  getRandom: () => api.get('/api/puzzle/random?solo=true') as Promise<{
    id: number;
    initial_grid: string;
    solution_grid: string;
    difficulty: string;
  }>,
};

// =====================================================
// LEADERBOARD API
// =====================================================

export interface LeaderboardEntry {
  rank: number;
  player_id: number;
  display_name: string;
  rating: number;
  is_you: boolean;
}

export interface LeaderboardResponse {
  top100: LeaderboardEntry[];
  neighborhood: LeaderboardEntry[];
  your_rank: number;
  total_players: number;
}

export const leaderboardAPI = {
  getLeaderboard: () => 
    api.get('/api/leaderboard') as Promise<LeaderboardResponse>,
};

export default { authAPI, playerAPI, matchmakingAPI, friendsAPI, puzzleAPI, leaderboardAPI };
