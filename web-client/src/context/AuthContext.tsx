import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { authAPI, playerAPI } from '../services/api';
import { oauthService } from '../services/oauthService';

interface User {
  // IMPORTANT: This is the player_profile ID, not the auth users.id
  // We always normalize to the player profile so it matches backend player_id
  id: number;
  display_name: string;
  rating?: number;
  games_played?: number;
  tutorial_completed?: boolean;
  is_guest?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  justSignedUp: boolean;
  needsDisplayName: boolean;
  isGuest: boolean;
  loginAsGuest: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  linkGoogle: () => Promise<{ success: boolean }>;
  linkApple: () => Promise<{ success: boolean }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  clearJustSignedUp: () => void;
  clearNeedsDisplayName: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [justSignedUp, setJustSignedUp] = useState(false);
  const [needsDisplayName, setNeedsDisplayName] = useState(false);

  // Computed value for isGuest
  const isGuest = user?.is_guest ?? false;

  // Load user on mount if token exists, and initialize OAuth
  useEffect(() => {
    // Initialize OAuth service for native platforms
    oauthService.initialize().catch(console.error);

    if (token) {
      refreshUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const refreshUser = async () => {
    try {
      const playerInfo = await playerAPI.getMe() as { 
        id: number; 
        display_name: string; 
        rating?: number; 
        games_played?: number; 
        tutorial_completed?: boolean;
        is_guest?: boolean;
      };
      setUser({
        id: playerInfo.id,
        display_name: playerInfo.display_name,
        rating: playerInfo.rating,
        games_played: playerInfo.games_played,
        tutorial_completed: playerInfo.tutorial_completed,
        is_guest: playerInfo.is_guest,
      });
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    }
  };

  // Guest sign-in
  const loginAsGuest = async () => {
    const response = await authAPI.guest();
    localStorage.setItem('token', response.token);
    setToken(response.token);
    await refreshUser();
    setNeedsDisplayName(true); // Guests need to pick a display name
    setJustSignedUp(true);
  };

  // Google sign-in
  const loginWithGoogle = async () => {
    // First, get the ID token from the native Google Auth plugin
    const googleResult = await oauthService.signInWithGoogle();
    
    // User cancelled
    if (!googleResult) {
      return;
    }

    // Send to backend for verification and account creation/login
    const response = await authAPI.googleSignIn(googleResult.idToken);
    localStorage.setItem('token', response.token);
    setToken(response.token);
    await refreshUser();

    // If new user, they need to pick a display name
    if (response.isNewUser) {
      setNeedsDisplayName(true);
      setJustSignedUp(true);
    }
  };

  // Apple sign-in
  const loginWithApple = async () => {
    // First, get the identity token from the native Apple Sign In plugin
    const appleResult = await oauthService.signInWithApple();
    
    // User cancelled
    if (!appleResult) {
      return;
    }

    // Build user info for backend
    const userInfo = appleResult.user ? {
      email: appleResult.user.email ?? undefined,
      fullName: {
        givenName: appleResult.user.givenName ?? undefined,
        familyName: appleResult.user.familyName ?? undefined,
      },
    } : undefined;

    // Send to backend for verification and account creation/login
    const response = await authAPI.appleSignIn(appleResult.identityToken, userInfo);
    localStorage.setItem('token', response.token);
    setToken(response.token);
    await refreshUser();

    // If new user, they need to pick a display name
    if (response.isNewUser) {
      setNeedsDisplayName(true);
      setJustSignedUp(true);
    }
  };

  // Link Google account to current (guest) user
  const linkGoogle = async (): Promise<{ success: boolean }> => {
    // First, get the ID token from the native Google Auth plugin
    const googleResult = await oauthService.signInWithGoogle();
    
    // User cancelled
    if (!googleResult) {
      return { success: false };
    }

    // Send to backend to link the account
    const response = await authAPI.linkGoogle(googleResult.idToken);
    
    // Refresh user to get updated is_guest status
    await refreshUser();
    
    return { success: response.success };
  };

  // Link Apple account to current (guest) user
  const linkApple = async (): Promise<{ success: boolean }> => {
    // First, get the identity token from the native Apple Sign In plugin
    const appleResult = await oauthService.signInWithApple();
    
    // User cancelled
    if (!appleResult) {
      return { success: false };
    }

    // Build user info for backend
    const userInfo = appleResult.user ? {
      email: appleResult.user.email ?? undefined,
      fullName: {
        givenName: appleResult.user.givenName ?? undefined,
        familyName: appleResult.user.familyName ?? undefined,
      },
    } : undefined;

    // Send to backend to link the account
    const response = await authAPI.linkApple(appleResult.identityToken, userInfo);
    
    // Refresh user to get updated is_guest status
    await refreshUser();
    
    return { success: response.success };
  };

  const clearJustSignedUp = () => {
    console.log('[AuthContext] clearJustSignedUp called - setting to false');
    setJustSignedUp(false);
  };

  const clearNeedsDisplayName = () => {
    setNeedsDisplayName(false);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setNeedsDisplayName(false);
    setJustSignedUp(false);
    
    // Sign out from Google if logged in via Google
    oauthService.signOutFromGoogle().catch(console.error);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      loading, 
      justSignedUp, 
      needsDisplayName,
      isGuest,
      loginAsGuest,
      loginWithGoogle,
      loginWithApple,
      linkGoogle,
      linkApple,
      logout, 
      refreshUser, 
      clearJustSignedUp,
      clearNeedsDisplayName,
    }}>
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
