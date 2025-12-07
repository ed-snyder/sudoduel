// ===========================================
// API & WebSocket Configuration
// ===========================================

// Detect if running in Capacitor (mobile app) or iOS simulator
const isCapacitor = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  // Check for Capacitor global (most reliable)
  if ((window as any).Capacitor) {
    return true;
  }
  
  // Check if running in Capacitor app by protocol
  // Capacitor apps use capacitor:// protocol or file:// for local files
  const protocol = window.location.protocol;
  if (protocol === 'capacitor:' || protocol === 'file:') {
    return true;
  }
  
  // Check if running in iOS simulator with Capacitor
  // iOS simulator running Capacitor app will have localhost origin but no Capacitor global yet
  // This is a fallback - ideally Capacitor should be loaded before this code runs
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '';
  const userAgent = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/.test(userAgent);
  
  // If we're on localhost with iOS user agent, likely iOS simulator
  // But only use production URLs if we're definitely in a built app (not dev server)
  if (isLocalhost && isIOS && import.meta.env.MODE === 'production') {
    return true;
  }
  
  return false;
};

const getApiUrl = (): string => {
  // Environment variable (production or build-time config)
  if (import.meta.env.VITE_API_URL) {
    const url = import.meta.env.VITE_API_URL;
    if (typeof window !== 'undefined') {
      console.log('[Config] Using API URL from env:', url);
    }
    return url;
  }
  
  // If running in Capacitor (mobile app), use production API
  const capacitorDetected = isCapacitor();
  if (capacitorDetected) {
    const url = 'https://api.sudoduel.com';
    if (typeof window !== 'undefined') {
      console.log('[Config] Capacitor detected, using production API:', url);
    }
    return url;
  }
  
  // Local development
  const url = 'http://localhost:3001';
  if (typeof window !== 'undefined') {
    console.log('[Config] Using localhost API URL:', url, 'Capacitor detected:', capacitorDetected);
  }
  return url;
};

const getWsUrl = (): string => {
  // Environment variable (production or build-time config)
  if (import.meta.env.VITE_WS_URL) {
    const url = import.meta.env.VITE_WS_URL;
    if (typeof window !== 'undefined') {
      console.log('[Config] Using WS URL from env:', url);
    }
    return url;
  }
  
  // If running in Capacitor (mobile app), use production WebSocket
  const capacitorDetected = isCapacitor();
  if (capacitorDetected) {
    const url = 'wss://api.sudoduel.com';
    if (typeof window !== 'undefined') {
      console.log('[Config] Capacitor detected, using production WS:', url);
    }
    return url;
  }
  
  // Local development
  const url = 'ws://localhost:3001';
  if (typeof window !== 'undefined') {
    console.log('[Config] Using localhost WS URL:', url, 'Capacitor detected:', capacitorDetected);
  }
  return url;
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
  
  patch: async <T>(path: string, body: unknown, token?: string): Promise<T> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const authToken = token || getToken();
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    
    try {
      const response = await fetch(`${API_URL}${path}`, {
        method: 'PATCH',
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
  
  delete: async <T>(path: string, token?: string): Promise<T> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const authToken = token || getToken();
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    
    try {
      const response = await fetch(`${API_URL}${path}`, {
        method: 'DELETE',
        headers,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Something went wrong' }));
        throw new Error(error.error || `API error: ${response.status}`);
      }
      // DELETE requests might return empty body
      const text = await response.text();
      return text ? JSON.parse(text) : ({} as T);
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

