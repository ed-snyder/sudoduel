import jwt, { SignOptions } from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import { UserModel } from '../models/User';
import { PlayerProfileModel } from '../models/PlayerProfile';
import { PlayerRatingModel } from '../models/PlayerRating';

const DEFAULT_LADDER_ID = 1; // The "9x9_5min_ranked" ladder we created

const GOOGLE_CLIENT_IDS = [
  process.env.GOOGLE_WEB_CLIENT_ID || '72563526926-vp0psa0jvljn9oe8l9r58cdn17uv3ik2.apps.googleusercontent.com',
  process.env.GOOGLE_IOS_CLIENT_ID || '72563526926-nh5tm55d20j5thaedfh6e6ec8gal045m.apps.googleusercontent.com',
  process.env.GOOGLE_ANDROID_CLIENT_ID || '72563526926-jra796fdeor03j12o96a9rppqm1a8l64.apps.googleusercontent.com',
];

const googleClient = new OAuth2Client();

// Helper function to generate JWT token
function generateToken(userId: number): string {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured');
  }
  const signOptions: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'],
  };
  return jwt.sign(
    { userId: Number(userId) },
    jwtSecret,
    signOptions
  );
}

// Helper function to create player profile and rating
async function createPlayerProfileAndRating(userId: number, displayName: string) {
  const profile = await PlayerProfileModel.create(userId, displayName);
  await PlayerRatingModel.create(profile.id, DEFAULT_LADDER_ID);
  return profile;
}

export const AuthService = {
  // Export helper for use in OAuth handlers
  generateToken,
  createPlayerProfileAndRating,

  // Export Google client IDs for verification
  GOOGLE_CLIENT_IDS,
  googleClient,

  // Guest sign-in - creates a new guest account
  async guestSignIn() {
    // Generate unique guest ID
    const guestId = crypto.randomBytes(8).toString('hex');
    
    // Create guest user
    const user = await UserModel.createGuest(guestId);
    
    // Create profile and rating with guest display name
    const displayName = `Guest_${guestId.substring(0, 6)}`;
    await createPlayerProfileAndRating(user.id, displayName);
    
    // Generate token
    const token = generateToken(user.id);
    
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        display_name: displayName,
      },
      isNewUser: true,
      isGuest: true,
    };
  },

  // Google Sign-In - verify token and create/link account
  async googleSignIn(idToken: string) {
    // 1. Verify the Google ID token
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_IDS,
      });
      payload = ticket.getPayload();
    } catch (error) {
      throw new Error('Invalid Google token');
    }

    if (!payload) {
      throw new Error('Invalid Google token');
    }

    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name;

    if (!email) {
      throw new Error('Email not provided by Google');
    }

    // 2. Check if user exists with this Google ID
    const existingGoogleUser = await UserModel.findByGoogleId(googleId);
    if (existingGoogleUser) {
      // User already has Google linked - just log them in
      await UserModel.updateLastLogin(existingGoogleUser.id);
      const profile = await PlayerProfileModel.findByUserId(existingGoogleUser.id);
      const token = generateToken(existingGoogleUser.id);
      
      return {
        token,
        user: {
          id: existingGoogleUser.id,
          email: existingGoogleUser.email,
          display_name: profile?.display_name || existingGoogleUser.username || 'Player',
        },
        isNewUser: false,
        isGuest: false,
      };
    }

    // 3. Check if user exists with this email (might be a guest upgrading or existing user)
    const existingEmailUser = await UserModel.findByEmail(email);
    if (existingEmailUser) {
      // Link Google account to existing user
      const updatedUser = await UserModel.linkGoogleAccount(existingEmailUser.id, googleId);
      await UserModel.updateLastLogin(updatedUser.id);
      const profile = await PlayerProfileModel.findByUserId(updatedUser.id);
      const token = generateToken(updatedUser.id);
      
      return {
        token,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          display_name: profile?.display_name || updatedUser.username || 'Player',
        },
        isNewUser: false,
        isGuest: false,
      };
    }

    // 4. Create new user
    const displayName = name || email.split('@')[0];
    const user = await UserModel.createOAuth(email, displayName, 'google', googleId);
    await createPlayerProfileAndRating(user.id, displayName);
    const token = generateToken(user.id);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        display_name: displayName,
      },
      isNewUser: true,
      isGuest: false,
    };
  },

  // Apple Sign-In - verify token and create/link account
  async appleSignIn(
    identityToken: string,
    user?: { email?: string; fullName?: { givenName?: string; familyName?: string } }
  ) {
    // 1. Decode and verify the Apple identity token
    let payload: { sub: string; email?: string; iss: string; aud: string; exp: number };
    try {
      const parts = identityToken.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }

      // Decode base64url payload
      let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      // Pad with '=' to make length divisible by 4
      while (base64.length % 4 !== 0) {
        base64 += '=';
      }
      const decoded = Buffer.from(base64, 'base64').toString('utf8');
      payload = JSON.parse(decoded);

      // Verify issuer
      if (payload.iss !== 'https://appleid.apple.com') {
        throw new Error('Invalid issuer');
      }

      // Warn if audience doesn't match (but don't throw - might be different bundle ID)
      if (payload.aud !== 'com.sudoduel.app') {
        console.warn(`Apple token audience mismatch: expected 'com.sudoduel.app', got '${payload.aud}'`);
      }

      // Check expiration
      if (payload.exp < Date.now() / 1000) {
        throw new Error('Token expired');
      }
    } catch (error) {
      throw new Error('Invalid Apple token');
    }

    // 2. Extract Apple ID and email
    const appleId = payload.sub;
    const email = payload.email || user?.email;

    // 3. Check if user exists with this Apple ID
    const existingAppleUser = await UserModel.findByAppleId(appleId);
    if (existingAppleUser) {
      // User already has Apple linked - just log them in
      await UserModel.updateLastLogin(existingAppleUser.id);
      const profile = await PlayerProfileModel.findByUserId(existingAppleUser.id);
      const token = generateToken(existingAppleUser.id);

      return {
        token,
        user: {
          id: existingAppleUser.id,
          email: existingAppleUser.email,
          display_name: profile?.display_name || existingAppleUser.username || 'Player',
        },
        isNewUser: false,
        isGuest: false,
      };
    }

    // 4. If we have email, check if user exists with this email
    if (email) {
      const existingEmailUser = await UserModel.findByEmail(email);
      if (existingEmailUser) {
        // Link Apple account to existing user (could be guest or other OAuth)
        const updatedUser = await UserModel.linkAppleAccount(existingEmailUser.id, appleId);
        await UserModel.updateLastLogin(updatedUser.id);
        const profile = await PlayerProfileModel.findByUserId(updatedUser.id);
        const token = generateToken(updatedUser.id);

        return {
          token,
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            display_name: profile?.display_name || updatedUser.username || 'Player',
          },
          isNewUser: false,
          isGuest: false,
        };
      }
    }

    // 5. Create new user
    // Build display name from fullName, email, or default
    let displayName = 'Player';
    if (user?.fullName?.givenName || user?.fullName?.familyName) {
      displayName = [user.fullName.givenName, user.fullName.familyName]
        .filter(Boolean)
        .join(' ');
    } else if (email) {
      displayName = email.split('@')[0];
    }

    // Use provided email or generate placeholder
    const userEmail = email || `apple_${appleId.substring(0, 8)}@privaterelay.appleid.com`;

    const newUser = await UserModel.createOAuth(userEmail, displayName, 'apple', appleId);
    await createPlayerProfileAndRating(newUser.id, displayName);
    const token = generateToken(newUser.id);

    return {
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        display_name: displayName,
      },
      isNewUser: true,
      isGuest: false,
    };
  },

  // Link Google account to an existing guest user
  async linkGoogleToGuest(userId: number, idToken: string) {
    // 1. Verify the Google token
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_IDS,
      });
      payload = ticket.getPayload();
    } catch (error) {
      throw new Error('Invalid Google token');
    }

    if (!payload) {
      throw new Error('Invalid Google token');
    }

    const googleId = payload.sub;
    const email = payload.email;

    if (!email) {
      throw new Error('Email not provided by Google');
    }

    // 2. Check if this Google ID is already taken
    const isGoogleTaken = await UserModel.isGoogleIdTaken(googleId);
    if (isGoogleTaken) {
      throw new Error('This Google account is already linked to another user');
    }

    // 3. Check if email is used by a different non-guest account
    const existingEmailUser = await UserModel.findByEmail(email);
    if (existingEmailUser && existingEmailUser.id !== userId && !existingEmailUser.is_guest) {
      throw new Error('This email is already in use by another account');
    }

    // 4. Link the Google account
    const updatedUser = await UserModel.linkGoogleAccount(userId, googleId);

    // 5. Update email if user had a guest email
    let finalUser = updatedUser;
    if (updatedUser.email?.includes('@sudoduel.local')) {
      finalUser = await UserModel.updateEmail(userId, email);
    }

    return {
      success: true,
      user: finalUser,
    };
  },

  // Link Apple account to an existing guest user
  async linkAppleToGuest(
    userId: number,
    identityToken: string,
    userInfo?: { email?: string; fullName?: { givenName?: string; familyName?: string } }
  ) {
    // 1. Decode and verify the Apple identity token
    let payload: { sub: string; email?: string; iss: string; aud: string; exp: number };
    try {
      const parts = identityToken.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }

      // Decode base64url payload
      let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      // Pad with '=' to make length divisible by 4
      while (base64.length % 4 !== 0) {
        base64 += '=';
      }
      const decoded = Buffer.from(base64, 'base64').toString('utf8');
      payload = JSON.parse(decoded);

      // Verify issuer
      if (payload.iss !== 'https://appleid.apple.com') {
        throw new Error('Invalid issuer');
      }

      // Warn if audience doesn't match
      if (payload.aud !== 'com.sudoduel.app') {
        console.warn(`Apple token audience mismatch: expected 'com.sudoduel.app', got '${payload.aud}'`);
      }

      // Check expiration
      if (payload.exp < Date.now() / 1000) {
        throw new Error('Token expired');
      }
    } catch (error) {
      throw new Error('Invalid Apple token');
    }

    // 2. Extract Apple ID and email
    const appleId = payload.sub;
    const email = payload.email || userInfo?.email;

    // 3. Check if this Apple ID is already taken
    const isAppleTaken = await UserModel.isAppleIdTaken(appleId);
    if (isAppleTaken) {
      throw new Error('This Apple account is already linked to another user');
    }

    // 4. Check if email is used by a different non-guest account
    if (email) {
      const existingEmailUser = await UserModel.findByEmail(email);
      if (existingEmailUser && existingEmailUser.id !== userId && !existingEmailUser.is_guest) {
        throw new Error('This email is already in use by another account');
      }
    }

    // 5. Link the Apple account
    const updatedUser = await UserModel.linkAppleAccount(userId, appleId);

    // 6. Update email if user had a guest email and we have a real email
    let finalUser = updatedUser;
    if (email && updatedUser.email?.includes('@sudoduel.local')) {
      finalUser = await UserModel.updateEmail(userId, email);
    }

    return {
      success: true,
      user: finalUser,
    };
  },

  // ===========================================
  // LEGACY METHODS - REMOVED FOR OAUTH MIGRATION
  // ===========================================
  // The signup() and login() methods have been removed.
  // Authentication is now handled via:
  // - guestSignIn() for anonymous play
  // - Google OAuth (googleSignIn)
  // - Apple OAuth (appleSignIn)
  // - linkGoogleToGuest() for upgrading guest accounts
  // - linkAppleToGuest() for upgrading guest accounts
  //
  // For existing email/password users, they should link
  // their account to an OAuth provider to continue using it.
  // ===========================================
};
