const API_URL = 'http://localhost:3001/api';

// Get token from localStorage
const getToken = () => localStorage.getItem('token');

// API request helper
async function request(endpoint: string, options: RequestInit = {}) {
  const token = getToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong');
  }

  return data;
}

// Auth API
export const authAPI = {
  signup: (email: string, password: string, displayName: string) =>
    request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, display_name: displayName }),
    }),

  login: (email: string, password: string) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
};

// Player API
export const playerAPI = {
  getMe: () => request('/player/me'),
};

// Matchmaking API
export const matchmakingAPI = {
  join: () => request('/matchmaking/join', { method: 'POST' }),
  leave: () => request('/matchmaking/leave', { method: 'POST' }),
  status: () => request('/matchmaking/status', { method: 'GET' }),
};

export default { authAPI, playerAPI, matchmakingAPI };
