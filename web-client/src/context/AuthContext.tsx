import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { authAPI, playerAPI } from '../services/api';

interface User {
  // IMPORTANT: This is the player_profile ID, not the auth users.id
  // We always normalize to the player profile so it matches backend player_id
  id: number;
  display_name: string;
  rating?: number;
  games_played?: number;
  tutorial_completed?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Load user on mount if token exists
  useEffect(() => {
    if (token) {
      refreshUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const refreshUser = async () => {
    try {
      const playerInfo = await playerAPI.getMe() as { id: number; display_name: string; rating?: number; games_played?: number; tutorial_completed?: boolean };
      setUser({
        id: playerInfo.id,
        display_name: playerInfo.display_name,
        rating: playerInfo.rating,
        games_played: playerInfo.games_played,
        tutorial_completed: playerInfo.tutorial_completed,
      });
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    }
  };

  const login = async (email: string, password: string) => {
    const response = await authAPI.login(email, password) as { token: string };
    localStorage.setItem('token', response.token);
    setToken(response.token);
    // After login, normalize user to player_profile via /player/me
    await refreshUser();
  };

  const signup = async (email: string, password: string, displayName: string) => {
    const response = await authAPI.signup(email, password, displayName) as { token: string };
    localStorage.setItem('token', response.token);
    setToken(response.token);
    // After signup, normalize user to player_profile via /player/me
    await refreshUser();
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
