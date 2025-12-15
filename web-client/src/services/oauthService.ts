import { Capacitor } from '@capacitor/core';

// Google Sign-In user interface
export interface GoogleUser {
  email: string;
  familyName: string;
  givenName: string;
  id: string;
  imageUrl: string;
  name: string;
  authentication: {
    accessToken: string;
    idToken: string;
    refreshToken?: string;
  };
}

// Apple Sign-In response interface
export interface AppleSignInResponse {
  response: {
    user: string;
    email: string | null;
    givenName: string | null;
    familyName: string | null;
    identityToken: string;
    authorizationCode: string;
  };
}

// Plugin type definitions
interface GoogleAuthPlugin {
  initialize(options: { clientId: string; scopes: string[]; grantOfflineAccess: boolean }): Promise<void>;
  signIn(): Promise<GoogleUser>;
  signOut(): Promise<void>;
}

// Use 'any' for Apple Sign In plugin due to version differences in type definitions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppleSignInPlugin = any;

class OAuthService {
  private googleAuthPlugin: GoogleAuthPlugin | null = null;
  private appleSignInPlugin: AppleSignInPlugin | null = null;
  private initialized = false;

  /**
   * Initialize OAuth plugins (must be called before use)
   * Only initializes on native platforms
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (!Capacitor.isNativePlatform()) {
      console.log('[OAuthService] Skipping initialization - not a native platform');
      this.initialized = true;
      return;
    }

    try {
      // Dynamically import and initialize Google Auth plugin
      const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
      this.googleAuthPlugin = GoogleAuth;
      
      await this.googleAuthPlugin.initialize({
        clientId: '72563526926-vp0psa0jvljn9oe8l9r58cdn17uv3ik2.apps.googleusercontent.com',
        scopes: ['profile', 'email'],
        grantOfflineAccess: true,
      });
      console.log('[OAuthService] Google Auth initialized');
    } catch (error) {
      console.error('[OAuthService] Failed to initialize Google Auth:', error);
    }

    // Apple Sign In is only available on iOS
    if (Capacitor.getPlatform() === 'ios') {
      try {
        const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');
        this.appleSignInPlugin = SignInWithApple;
        console.log('[OAuthService] Apple Sign In initialized');
      } catch (error) {
        console.error('[OAuthService] Failed to initialize Apple Sign In:', error);
      }
    }

    this.initialized = true;
  }

  /**
   * Sign in with Google
   * @returns { idToken, user } on success, null if cancelled
   */
  async signInWithGoogle(): Promise<{ idToken: string; user: GoogleUser } | null> {
    if (!this.googleAuthPlugin) {
      throw new Error('Google Auth not initialized');
    }

    try {
      const user = await this.googleAuthPlugin.signIn();
      
      if (!user || !user.authentication?.idToken) {
        console.log('[OAuthService] Google sign-in: no token received');
        return null;
      }

      return {
        idToken: user.authentication.idToken,
        user,
      };
    } catch (error: any) {
      // Handle user cancellation
      const message = error?.message?.toLowerCase() || '';
      const code = error?.code?.toString() || '';
      
      if (
        message.includes('canceled') ||
        message.includes('cancelled') ||
        message.includes('user cancel') ||
        code === '12501' || // Google Sign-In cancel code on Android
        code === '1001'     // Apple cancel code
      ) {
        console.log('[OAuthService] Google sign-in cancelled by user');
        return null;
      }

      console.error('[OAuthService] Google sign-in error:', error);
      throw error;
    }
  }

  /**
   * Sign out from Google
   */
  async signOutFromGoogle(): Promise<void> {
    if (!this.googleAuthPlugin) {
      return;
    }

    try {
      await this.googleAuthPlugin.signOut();
      console.log('[OAuthService] Signed out from Google');
    } catch (error) {
      console.error('[OAuthService] Google sign-out error:', error);
    }
  }

  /**
   * Sign in with Apple
   * @returns { identityToken, user } on success, null if cancelled
   */
  async signInWithApple(): Promise<{
    identityToken: string;
    user?: {
      email: string | null;
      givenName: string | null;
      familyName: string | null;
    };
  } | null> {
    if (!this.appleSignInPlugin) {
      throw new Error('Apple Sign In not initialized');
    }

    try {
      // Only pass scopes - no clientId or redirectURI needed for native
      const result = await this.appleSignInPlugin.authorize({
        scopes: 'email name',
      });

      if (!result?.response?.identityToken) {
        console.log('[OAuthService] Apple sign-in: no token received');
        return null;
      }

      return {
        identityToken: result.response.identityToken,
        user: {
          email: result.response.email,
          givenName: result.response.givenName,
          familyName: result.response.familyName,
        },
      };
    } catch (error: any) {
      // Handle user cancellation
      const message = error?.message?.toLowerCase() || '';
      const code = error?.code?.toString() || '';
      
      if (
        message.includes('canceled') ||
        message.includes('cancelled') ||
        message.includes('user cancel') ||
        code === '1001' // Apple authorization cancelled
      ) {
        console.log('[OAuthService] Apple sign-in cancelled by user');
        return null;
      }

      console.error('[OAuthService] Apple sign-in error:', error);
      throw error;
    }
  }

  /**
   * Check if Google Sign-In is available
   * Available on native platforms (iOS and Android)
   */
  isGoogleAvailable(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Check if Apple Sign-In is available
   * Only available on iOS native platform
   */
  isAppleAvailable(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  }
}

// Export singleton instance
export const oauthService = new OAuthService();
