import { API_URL } from '../config';

interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// Send a friend request
export async function sendFriendRequest(token: string, targetUserId: number): Promise<ApiResponse> {
  const response = await fetch(`${API_URL}/api/friends/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ target_user_id: targetUserId }),
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Failed to send friend request');
  }
  
  return data;
}

// Report a user - simplified without details
export async function reportUser(
  token: string, 
  targetUserId: number, 
  reason: string
): Promise<ApiResponse> {
  const response = await fetch(`${API_URL}/api/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ 
      target_user_id: targetUserId,
      reason,
    }),
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Failed to submit report');
  }
  
  return data;
}
