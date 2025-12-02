import { api } from '../config';

// Auth API
export const authAPI = {
  signup: (email: string, password: string, displayName: string) =>
    api.post('/api/auth/signup', { email, password, display_name: displayName }),

  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }),
};

// Player API
export const playerAPI = {
  getMe: () => api.get('/api/player/me'),
};

// Matchmaking API
export const matchmakingAPI = {
  join: () => api.post('/api/matchmaking/join', {}),
  leave: () => api.post('/api/matchmaking/leave', {}),
  status: () => api.get('/api/matchmaking/status'),
};

export default { authAPI, playerAPI, matchmakingAPI };
