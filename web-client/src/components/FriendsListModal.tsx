import { useState, useEffect, useCallback } from 'react';
import { friendsAPI } from '../services/api';
import type { Friend, FriendRequest, PlayerSearchResult, MatchRequest } from '../services/api';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

interface FriendsListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMatchFound?: (matchId: number) => void;
}

type Tab = 'friends' | 'requests' | 'search';

const vibrate = async () => {
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Haptics not available
  }
};

export default function FriendsListModal({ isOpen, onClose, onMatchFound }: FriendsListModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingReceived, setPendingReceived] = useState<FriendRequest[]>([]);
  const [pendingSent, setPendingSent] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Match request state
  const [outgoingMatchRequest, setOutgoingMatchRequest] = useState<MatchRequest | null>(null);
  const [incomingMatchRequests, setIncomingMatchRequests] = useState<MatchRequest[]>([]);
  const [matchRequestPolling, setMatchRequestPolling] = useState(false);

  // Load friends data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadFriends();
      loadRequests();
      loadMatchRequests();
    }
  }, [isOpen]);

  // Always poll for incoming match requests when modal is open
  useEffect(() => {
    if (!isOpen) return;
    
    const interval = setInterval(() => {
      loadMatchRequests();
    }, 2000);

    return () => clearInterval(interval);
  }, [isOpen]);

  const checkMatchRequestStatus = useCallback(async () => {
    try {
      const response = await friendsAPI.getCurrentOutgoingMatchRequest();
      if (response.request) {
        setOutgoingMatchRequest(response.request);
        setMatchRequestPolling(true);
      } else {
        setOutgoingMatchRequest(null);
        setMatchRequestPolling(false);
      }
    } catch (err: any) {
      console.error('Failed to check match request status:', err);
    }
  }, []);

  // Separate polling for outgoing request status (when waiting for response)
  useEffect(() => {
    if (!isOpen || !matchRequestPolling) return;
    
    const interval = setInterval(() => {
      checkMatchRequestStatus();
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, matchRequestPolling, checkMatchRequestStatus]);

  const loadFriends = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await friendsAPI.getFriends();
      setFriends(response.friends || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async () => {
    try {
      const [received, sent] = await Promise.all([
        friendsAPI.getPendingRequestsReceived(),
        friendsAPI.getPendingRequestsSent(),
      ]);
      setPendingReceived(received.requests || []);
      setPendingSent(sent.requests || []);
    } catch (err: any) {
      console.error('Failed to load requests:', err);
    }
  };

  const loadMatchRequests = async () => {
    try {
      const [incoming, outgoing] = await Promise.all([
        friendsAPI.getPendingMatchRequests(),
        friendsAPI.getCurrentOutgoingMatchRequest(),
      ]);
      setIncomingMatchRequests(incoming.requests || []);
      setOutgoingMatchRequest(outgoing.request);
      setMatchRequestPolling(!!outgoing.request);
    } catch (err: any) {
      console.error('Failed to load match requests:', err);
    }
  };

  const checkMatchRequestStatus = async () => {
    try {
      const response = await friendsAPI.getCurrentOutgoingMatchRequest();
      if (response.request) {
        if (response.request.status === 'ACCEPTED' && response.request.match_id) {
          // Match created! Navigate to game
          setMatchRequestPolling(false);
          setOutgoingMatchRequest(null);
          vibrate();
          if (onMatchFound) {
            onMatchFound(response.request.match_id);
            onClose();
          }
          return;
        } else if (response.request.status === 'PENDING') {
          setOutgoingMatchRequest(response.request);
        } else {
          // Rejected, cancelled, or expired
          setMatchRequestPolling(false);
          setOutgoingMatchRequest(null);
        }
      } else {
        setMatchRequestPolling(false);
        setOutgoingMatchRequest(null);
      }

      // Also check for incoming requests
      const incoming = await friendsAPI.getPendingMatchRequests();
      setIncomingMatchRequests(incoming.requests || []);
    } catch (err: any) {
      console.error('Failed to check match request status:', err);
    }
  };

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await friendsAPI.searchPlayers(query);
      setSearchResults(response.players || []);
    } catch (err: any) {
      console.error('Search failed:', err);
    }
  }, []);

  const handleSendFriendRequest = async (playerId: number) => {
    setActionLoading(`friend-${playerId}`);
    vibrate();
    try {
      await friendsAPI.sendFriendRequestById(playerId);
      // Refresh search results and requests
      if (searchQuery) {
        const response = await friendsAPI.searchPlayers(searchQuery);
        setSearchResults(response.players || []);
      }
      await loadRequests();
    } catch (err: any) {
      setError(err.message || 'Failed to send request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcceptFriendRequest = async (requestId: number) => {
    setActionLoading(`accept-${requestId}`);
    vibrate();
    try {
      await friendsAPI.acceptFriendRequest(requestId);
      await loadFriends();
      await loadRequests();
    } catch (err: any) {
      setError(err.message || 'Failed to accept request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectFriendRequest = async (requestId: number) => {
    setActionLoading(`reject-${requestId}`);
    vibrate();
    try {
      await friendsAPI.rejectFriendRequest(requestId);
      await loadRequests();
    } catch (err: any) {
      setError(err.message || 'Failed to reject request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelFriendRequest = async (requestId: number) => {
    setActionLoading(`cancel-${requestId}`);
    vibrate();
    try {
      await friendsAPI.cancelFriendRequest(requestId);
      await loadRequests();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveFriend = async (friendId: number) => {
    if (!confirm('Are you sure you want to remove this friend?')) return;
    
    setActionLoading(`remove-${friendId}`);
    vibrate();
    try {
      await friendsAPI.removeFriend(friendId);
      await loadFriends();
    } catch (err: any) {
      setError(err.message || 'Failed to remove friend');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendMatchRequest = async (friendId: number) => {
    setActionLoading(`match-${friendId}`);
    vibrate();
    try {
      await friendsAPI.sendMatchRequest(friendId);
      setMatchRequestPolling(true);
      await loadMatchRequests();
    } catch (err: any) {
      setError(err.message || 'Failed to send match request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelMatchRequest = async () => {
    if (!outgoingMatchRequest) return;
    
    setActionLoading('cancel-match');
    vibrate();
    try {
      await friendsAPI.cancelMatchRequest(outgoingMatchRequest.id);
      setOutgoingMatchRequest(null);
      setMatchRequestPolling(false);
    } catch (err: any) {
      setError(err.message || 'Failed to cancel request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcceptMatchRequest = async (requestId: number) => {
    setActionLoading(`accept-match-${requestId}`);
    vibrate();
    try {
      const response = await friendsAPI.acceptMatchRequest(requestId);
      if (response.matchId && onMatchFound) {
        onMatchFound(response.matchId);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to accept match request');
      await loadMatchRequests();
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectMatchRequest = async (requestId: number) => {
    setActionLoading(`reject-match-${requestId}`);
    vibrate();
    try {
      await friendsAPI.rejectMatchRequest(requestId);
      await loadMatchRequests();
    } catch (err: any) {
      setError(err.message || 'Failed to decline match request');
    } finally {
      setActionLoading(null);
    }
  };

  const requestCount = pendingReceived.length + incomingMatchRequests.length;

  if (!isOpen) return null;

  // Show match request waiting screen
  if (outgoingMatchRequest) {
    const expiresAt = new Date(outgoingMatchRequest.expires_at).getTime();
    const now = Date.now();
    const secondsRemaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="absolute inset-0 bg-void/90 backdrop-blur-sm" />
        
        <div 
          className="relative bg-surface border border-grid-line rounded-xl w-full max-w-sm overflow-hidden animate-scale-in"
          style={{ boxShadow: '0 0 30px rgba(139,0,255,0.2)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 text-center">
            {/* Spinning loader */}
            <div className="mx-auto w-16 h-16 mb-4">
              <div 
                className="w-full h-full border-4 border-grid-line border-t-player rounded-full animate-spin"
                style={{ boxShadow: '0 0 20px rgba(0,255,255,0.3)' }}
              />
            </div>
            
            <h3 className="font-heading font-bold text-lg text-primary mb-2">
              Waiting for Response
            </h3>
            <p className="text-secondary font-body text-sm mb-1">
              Sent request to <span className="text-player">{outgoingMatchRequest.to_display_name}</span>
            </p>
            <p className="text-muted font-mono text-xs mb-6">
              Expires in {secondsRemaining}s
            </p>

            <button
              onClick={handleCancelMatchRequest}
              disabled={actionLoading === 'cancel-match'}
              className="w-full py-3 font-body font-bold uppercase tracking-widest rounded-lg transition-all active:scale-95"
              style={{
                background: 'rgb(20, 12, 30)',
                border: '2px solid rgba(255,51,102,0.5)',
                color: '#FF3366',
              }}
            >
              {actionLoading === 'cancel-match' ? '...' : 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show incoming match request modal
  if (incomingMatchRequests.length > 0) {
    const request = incomingMatchRequests[0];
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="absolute inset-0 bg-void/90 backdrop-blur-sm" />
        
        <div 
          className="relative bg-surface border-2 border-player rounded-xl w-full max-w-sm overflow-hidden animate-scale-in"
          style={{ boxShadow: '0 0 30px rgba(0,255,255,0.4)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 text-center">
            {/* Pulsing icon */}
            <div 
              className="mx-auto w-20 h-20 rounded-full flex items-center justify-center text-3xl mb-4"
              style={{
                background: 'linear-gradient(135deg, rgba(0,255,255,0.3) 0%, rgba(139,0,255,0.3) 100%)',
                border: '3px solid rgba(0,255,255,0.5)',
                boxShadow: '0 0 20px rgba(0,255,255,0.3)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            >
              ⚔️
            </div>
            
            <h3 
              className="font-heading font-bold text-xl text-player mb-2"
              style={{ textShadow: '0 0 10px rgba(0,255,255,0.4)' }}
            >
              {request.from_display_name} wants to duel!
            </h3>
            <p className="text-secondary font-body text-sm mb-1">
              Rating: <span className="text-player font-mono">{Math.round(request.from_rating)}</span>
            </p>
            <p className="text-muted font-body text-xs mb-6">
              Friendly match • No rating change
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => handleRejectMatchRequest(request.id)}
                disabled={actionLoading?.startsWith('reject-match')}
                className="flex-1 py-3 font-body font-bold uppercase tracking-widest rounded-lg transition-all active:scale-95"
                style={{
                  background: 'rgb(20, 12, 30)',
                  border: '2px solid rgba(139,0,255,0.5)',
                  color: 'rgba(255,255,255,0.7)',
                }}
              >
                I'll Pass
              </button>
              <button
                onClick={() => handleAcceptMatchRequest(request.id)}
                disabled={actionLoading?.startsWith('accept-match')}
                className="flex-1 py-3 font-body font-bold uppercase tracking-widest rounded-lg transition-all active:scale-95"
                style={{
                  background: 'rgb(15, 10, 25)',
                  border: '2px solid #00FFFF',
                  color: '#00FFFF',
                  boxShadow: '0 0 15px rgba(0,255,255,0.3)',
                }}
              >
                {actionLoading?.startsWith('accept-match') ? '...' : 'Accept'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-void/90 backdrop-blur-sm" />
      
      <div 
        className="relative bg-surface border border-grid-line rounded-xl w-full max-w-sm overflow-hidden animate-scale-in max-h-[80vh] flex flex-col"
        style={{ boxShadow: '0 0 30px rgba(139,0,255,0.2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-grid-line">
          <h2 className="font-heading font-bold text-lg text-primary">Friends</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-player transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-grid-line">
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-2 text-sm font-body font-semibold transition-colors ${
              activeTab === 'friends' 
                ? 'text-player border-b-2 border-player' 
                : 'text-muted hover:text-secondary'
            }`}
          >
            Friends ({friends.length})
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-1 py-2 text-sm font-body font-semibold transition-colors relative ${
              activeTab === 'requests' 
                ? 'text-player border-b-2 border-player' 
                : 'text-muted hover:text-secondary'
            }`}
          >
            Requests
            {requestCount > 0 && (
              <span 
                className="absolute top-1 right-4 w-5 h-5 rounded-full bg-opponent text-white text-xs flex items-center justify-center font-bold"
                style={{ boxShadow: '0 0 8px rgba(255,0,255,0.5)' }}
              >
                {requestCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-2 text-sm font-body font-semibold transition-colors ${
              activeTab === 'search' 
                ? 'text-player border-b-2 border-player' 
                : 'text-muted hover:text-secondary'
            }`}
          >
            Add
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="mx-4 mt-4 p-3 rounded-lg bg-error/10 border border-error/30 text-error text-sm font-body">
              {error}
              <button onClick={() => setError('')} className="ml-2 underline">Dismiss</button>
            </div>
          )}

          {/* Friends Tab */}
          {activeTab === 'friends' && (
            <div className="p-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-4 border-surface border-t-player rounded-full animate-spin" />
                </div>
              ) : friends.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">👥</div>
                  <p className="text-muted font-body text-sm">No friends yet</p>
                  <button
                    onClick={() => setActiveTab('search')}
                    className="mt-3 text-player text-sm font-body underline"
                  >
                    Find friends to add
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {friends.map((friend) => (
                    <div
                      key={friend.friend_id}
                      className="flex items-center gap-3 p-3 rounded-lg"
                      style={{
                        background: 'rgba(30,15,45,0.5)',
                        border: '1px solid rgba(139,0,255,0.2)',
                      }}
                    >
                      {/* Avatar */}
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                        style={{
                          background: 'linear-gradient(135deg, rgba(0,255,255,0.2) 0%, rgba(139,0,255,0.2) 100%)',
                          border: '2px solid rgba(139,0,255,0.4)',
                        }}
                      >
                        {friend.display_name.charAt(0).toUpperCase()}
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-body font-semibold text-primary truncate">
                          {friend.display_name}
                        </p>
                        <p className="text-xs text-muted font-mono">
                          {Math.round(friend.rating)} • {friend.games_played} games
                        </p>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSendMatchRequest(friend.friend_id)}
                          disabled={actionLoading === `match-${friend.friend_id}`}
                          className="p-2 rounded-lg transition-all active:scale-95"
                          style={{
                            background: 'rgba(0,255,255,0.1)',
                            border: '1px solid rgba(0,255,255,0.4)',
                          }}
                          title="Send match request"
                        >
                          {actionLoading === `match-${friend.friend_id}` ? (
                            <div className="w-4 h-4 border-2 border-player border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <span className="text-sm">⚔️</span>
                          )}
                        </button>
                        <button
                          onClick={() => handleRemoveFriend(friend.friend_id)}
                          disabled={actionLoading === `remove-${friend.friend_id}`}
                          className="p-2 rounded-lg transition-all active:scale-95 text-muted hover:text-error"
                          style={{
                            background: 'rgba(255,51,102,0.1)',
                            border: '1px solid rgba(255,51,102,0.2)',
                          }}
                          title="Remove friend"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Requests Tab */}
          {activeTab === 'requests' && (
            <div className="p-4 space-y-4">
              {/* Received Requests */}
              {pendingReceived.length > 0 && (
                <div>
                  <h3 className="text-xs text-muted font-body uppercase tracking-wider mb-2">
                    Received ({pendingReceived.length})
                  </h3>
                  <div className="space-y-2">
                    {pendingReceived.map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center gap-3 p-3 rounded-lg"
                        style={{
                          background: 'rgba(0,255,255,0.05)',
                          border: '1px solid rgba(0,255,255,0.2)',
                        }}
                      >
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                          style={{
                            background: 'linear-gradient(135deg, rgba(0,255,255,0.2) 0%, rgba(139,0,255,0.2) 100%)',
                            border: '2px solid rgba(0,255,255,0.4)',
                          }}
                        >
                          {request.from_display_name.charAt(0).toUpperCase()}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-body font-semibold text-primary truncate">
                            {request.from_display_name}
                          </p>
                          <p className="text-xs text-muted font-mono">
                            {Math.round(request.from_rating)}
                          </p>
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAcceptFriendRequest(request.id)}
                            disabled={actionLoading === `accept-${request.id}`}
                            className="p-2 rounded-lg transition-all active:scale-95"
                            style={{
                              background: 'rgba(0,255,136,0.2)',
                              border: '1px solid rgba(0,255,136,0.4)',
                              color: '#00FF88',
                            }}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleRejectFriendRequest(request.id)}
                            disabled={actionLoading === `reject-${request.id}`}
                            className="p-2 rounded-lg transition-all active:scale-95"
                            style={{
                              background: 'rgba(255,51,102,0.1)',
                              border: '1px solid rgba(255,51,102,0.3)',
                              color: '#FF3366',
                            }}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sent Requests */}
              {pendingSent.length > 0 && (
                <div>
                  <h3 className="text-xs text-muted font-body uppercase tracking-wider mb-2">
                    Sent ({pendingSent.length})
                  </h3>
                  <div className="space-y-2">
                    {pendingSent.map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center gap-3 p-3 rounded-lg"
                        style={{
                          background: 'rgba(139,0,255,0.05)',
                          border: '1px solid rgba(139,0,255,0.2)',
                        }}
                      >
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                          style={{
                            background: 'rgba(139,0,255,0.2)',
                            border: '2px solid rgba(139,0,255,0.4)',
                          }}
                        >
                          {request.to_display_name.charAt(0).toUpperCase()}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-body font-semibold text-primary truncate">
                            {request.to_display_name}
                          </p>
                          <p className="text-xs text-muted font-mono">
                            Pending
                          </p>
                        </div>
                        
                        <button
                          onClick={() => handleCancelFriendRequest(request.id)}
                          disabled={actionLoading === `cancel-${request.id}`}
                          className="p-2 rounded-lg transition-all active:scale-95 text-muted hover:text-error"
                          style={{
                            background: 'rgba(255,51,102,0.1)',
                            border: '1px solid rgba(255,51,102,0.2)',
                          }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pendingReceived.length === 0 && pendingSent.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">📭</div>
                  <p className="text-muted font-body text-sm">No pending requests</p>
                </div>
              )}
            </div>
          )}

          {/* Search Tab */}
          {activeTab === 'search' && (
            <div className="p-4">
              {/* Search Input */}
              <div className="mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search by display name..."
                  className="w-full px-4 py-3 bg-elevated border border-grid-line rounded-lg text-primary font-body focus:outline-none focus:border-player focus:shadow-glow-player-subtle transition-all"
                />
              </div>

              {/* Search Results */}
              {searchQuery.length < 2 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">🔍</div>
                  <p className="text-muted font-body text-sm">Enter at least 2 characters to search</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">🔎</div>
                  <p className="text-muted font-body text-sm">No players found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-3 p-3 rounded-lg"
                      style={{
                        background: 'rgba(30,15,45,0.5)',
                        border: '1px solid rgba(139,0,255,0.2)',
                      }}
                    >
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                        style={{
                          background: 'linear-gradient(135deg, rgba(0,255,255,0.2) 0%, rgba(139,0,255,0.2) 100%)',
                          border: '2px solid rgba(139,0,255,0.4)',
                        }}
                      >
                        {player.display_name.charAt(0).toUpperCase()}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-body font-semibold text-primary truncate">
                          {player.display_name}
                        </p>
                        <p className="text-xs text-muted font-mono">
                          {Math.round(player.rating)}
                        </p>
                      </div>
                      
                      {player.is_friend ? (
                        <span className="text-xs text-success font-body px-2 py-1 rounded-full bg-success/10">
                          Friend
                        </span>
                      ) : player.has_pending_request ? (
                        <span className="text-xs text-warning font-body px-2 py-1 rounded-full bg-warning/10">
                          Pending
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSendFriendRequest(player.id)}
                          disabled={actionLoading === `friend-${player.id}`}
                          className="px-3 py-2 rounded-lg transition-all active:scale-95 text-sm font-body font-semibold"
                          style={{
                            background: 'rgba(0,255,255,0.1)',
                            border: '1px solid rgba(0,255,255,0.4)',
                            color: '#00FFFF',
                          }}
                        >
                          {actionLoading === `friend-${player.id}` ? '...' : 'Add'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
