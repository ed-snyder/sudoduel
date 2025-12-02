// ===========================================
// API & WebSocket Configuration
// ===========================================

const getApiUrl = (): string => {
  // Environment variable (production)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // Local development
  const url = 'http://localhost:3001';
  if (typeof window !== 'undefined') {
    console.log('[Config] Using API URL:', url);
  }
  return url;
};

const getWsUrl = (): string => {
  // Environment variable (production)
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  // Local development
  return 'ws://localhost:3001';
};

export const API_URL = getApiUrl();
export const WS_URL = getWsUrl();

// ===========================================
// API Helper Functions
// ===========================================

// Get token from localStorage
const getToken = () => localStorage.getItem('token');

export const api = {
  get: async <T>(path: string, token?: string): Promise<T> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const authToken = token || getToken();
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    
    try {
      const response = await fetch(`${API_URL}${path}`, { headers });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Something went wrong' }));
        throw new Error(error.error || `API error: ${response.status}`);
      }
      return response.json();
    } catch (error: any) {
      // Handle network errors (backend not running, CORS, etc.)
      if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        throw new Error(`Cannot connect to server at ${API_URL}. Make sure the backend is running.`);
      }
      throw error;
    }
  },
  
  post: async <T>(path: string, body: unknown, token?: string): Promise<T> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const authToken = token || getToken();
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    
    try {
      const response = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Something went wrong' }));
        throw new Error(error.error || `API error: ${response.status}`);
      }
      return response.json();
    } catch (error: any) {
      // Handle network errors (backend not running, CORS, etc.)
      if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        throw new Error(`Cannot connect to server at ${API_URL}. Make sure the backend is running.`);
      }
      throw error;
    }
  },
};

// ===========================================
// WebSocket Helper
// ===========================================

export const createGameSocket = (matchId: number, token: string): WebSocket => {
  const protocol = WS_URL.startsWith('wss://') ? 'wss' : 'ws';
  const baseUrl = WS_URL.replace(/^wss?:\/\//, '');
  const url = `${protocol}://${baseUrl}/ws/game?match_id=${matchId}&token=${token}`;
  return new WebSocket(url);
};

