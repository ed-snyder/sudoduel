import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { FriendService } from '../services/friendService';

const router = Router();

// GET /api/friends - Get all friends
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const friends = await FriendService.getFriends(req.userId!);
    res.json({ friends });
  } catch (error: any) {
    console.error('Get friends error:', error);
    res.status(400).json({ error: error.message });
  }
});

// GET /api/friends/search - Search for players by display name
router.get('/search', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query || query.length < 2) {
      return res.json({ players: [] });
    }
    const players = await FriendService.searchPlayers(req.userId!, query);
    res.json({ players });
  } catch (error: any) {
    console.error('Search players error:', error);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/friends/request - Send a friend request by display name
router.post('/request', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { display_name } = req.body;
    if (!display_name) {
      return res.status(400).json({ error: 'Display name is required' });
    }
    const result = await FriendService.sendFriendRequest(req.userId!, display_name);
    res.json(result);
  } catch (error: any) {
    console.error('Send friend request error:', error);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/friends/request/:playerId - Send a friend request by player ID
router.post('/request/:playerId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = parseInt(req.params.playerId, 10);
    if (isNaN(playerId)) {
      return res.status(400).json({ error: 'Invalid player ID' });
    }
    const result = await FriendService.sendFriendRequestById(req.userId!, playerId);
    res.json(result);
  } catch (error: any) {
    console.error('Send friend request by ID error:', error);
    res.status(400).json({ error: error.message });
  }
});

// GET /api/friends/requests/received - Get pending friend requests (received)
router.get('/requests/received', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const requests = await FriendService.getPendingRequestsReceived(req.userId!);
    res.json({ requests });
  } catch (error: any) {
    console.error('Get received requests error:', error);
    res.status(400).json({ error: error.message });
  }
});

// GET /api/friends/requests/sent - Get pending friend requests (sent)
router.get('/requests/sent', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const requests = await FriendService.getPendingRequestsSent(req.userId!);
    res.json({ requests });
  } catch (error: any) {
    console.error('Get sent requests error:', error);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/friends/requests/:requestId/accept - Accept a friend request
router.post('/requests/:requestId/accept', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const requestId = parseInt(req.params.requestId, 10);
    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    const result = await FriendService.acceptFriendRequest(req.userId!, requestId);
    res.json(result);
  } catch (error: any) {
    console.error('Accept friend request error:', error);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/friends/requests/:requestId/reject - Reject a friend request
router.post('/requests/:requestId/reject', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const requestId = parseInt(req.params.requestId, 10);
    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    const result = await FriendService.rejectFriendRequest(req.userId!, requestId);
    res.json(result);
  } catch (error: any) {
    console.error('Reject friend request error:', error);
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/friends/requests/:requestId - Cancel a sent friend request
router.delete('/requests/:requestId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const requestId = parseInt(req.params.requestId, 10);
    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    const result = await FriendService.cancelFriendRequest(req.userId!, requestId);
    res.json(result);
  } catch (error: any) {
    console.error('Cancel friend request error:', error);
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/friends/:friendId - Remove a friend
router.delete('/:friendId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const friendId = parseInt(req.params.friendId, 10);
    if (isNaN(friendId)) {
      return res.status(400).json({ error: 'Invalid friend ID' });
    }
    const result = await FriendService.removeFriend(req.userId!, friendId);
    res.json(result);
  } catch (error: any) {
    console.error('Remove friend error:', error);
    res.status(400).json({ error: error.message });
  }
});

// GET /api/friends/head-to-head/:opponentId - Get head-to-head stats with an opponent
router.get('/head-to-head/:opponentId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const opponentId = parseInt(req.params.opponentId, 10);
    if (isNaN(opponentId)) {
      return res.status(400).json({ error: 'Invalid opponent ID' });
    }
    const stats = await FriendService.getHeadToHeadStats(req.userId!, opponentId);
    res.json({ stats });
  } catch (error: any) {
    console.error('Get head-to-head stats error:', error);
    res.status(400).json({ error: error.message });
  }
});

// =====================================================
// MATCH REQUESTS
// =====================================================

// POST /api/friends/match-request/:friendId - Send a match request to a friend
router.post('/match-request/:friendId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const friendId = parseInt(req.params.friendId, 10);
    if (isNaN(friendId)) {
      return res.status(400).json({ error: 'Invalid friend ID' });
    }
    const result = await FriendService.sendMatchRequest(req.userId!, friendId);
    res.json(result);
  } catch (error: any) {
    console.error('Send match request error:', error);
    res.status(400).json({ error: error.message });
  }
});

// GET /api/friends/match-requests - Get pending match requests received
router.get('/match-requests', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const requests = await FriendService.getPendingMatchRequests(req.userId!);
    res.json({ requests });
  } catch (error: any) {
    console.error('Get match requests error:', error);
    res.status(400).json({ error: error.message });
  }
});

// GET /api/friends/match-request/outgoing - Get current outgoing match request
router.get('/match-request/outgoing', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const request = await FriendService.getCurrentOutgoingMatchRequest(req.userId!);
    res.json({ request });
  } catch (error: any) {
    console.error('Get outgoing match request error:', error);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/friends/match-requests/:requestId/accept - Accept a match request
router.post('/match-requests/:requestId/accept', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const requestId = parseInt(req.params.requestId, 10);
    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    const result = await FriendService.acceptMatchRequest(req.userId!, requestId);
    res.json(result);
  } catch (error: any) {
    console.error('Accept match request error:', error);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/friends/match-requests/:requestId/reject - Reject a match request
router.post('/match-requests/:requestId/reject', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const requestId = parseInt(req.params.requestId, 10);
    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    const result = await FriendService.rejectMatchRequest(req.userId!, requestId);
    res.json(result);
  } catch (error: any) {
    console.error('Reject match request error:', error);
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/friends/match-requests/:requestId - Cancel a match request
router.delete('/match-requests/:requestId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const requestId = parseInt(req.params.requestId, 10);
    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    const result = await FriendService.cancelMatchRequest(req.userId!, requestId);
    res.json(result);
  } catch (error: any) {
    console.error('Cancel match request error:', error);
    res.status(400).json({ error: error.message });
  }
});

// =====================================================
// DISPLAY NAME VALIDATION
// =====================================================

// GET /api/friends/check-name - Check if display name is available
router.get('/check-name', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const name = req.query.name as string;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const available = await FriendService.isDisplayNameAvailable(name, req.userId!);
    res.json({ available });
  } catch (error: any) {
    console.error('Check name error:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
