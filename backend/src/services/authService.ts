import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User';
import { PlayerProfileModel } from '../models/PlayerProfile';
import { PlayerRatingModel } from '../models/PlayerRating';

const SALT_ROUNDS = 10;
const DEFAULT_LADDER_ID = 1; // The "9x9_5min_ranked" ladder we created

export const AuthService = {
  // Sign up a new user
  async signup(email: string, password: string, displayName: string) {
    // Check if user already exists
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const user = await UserModel.create(email, passwordHash, displayName);

    // Create player profile
    const profile = await PlayerProfileModel.create(user.id, displayName);

    // Initialize rating for default ladder
    await PlayerRatingModel.create(profile.id, DEFAULT_LADDER_ID);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        display_name: displayName,
      },
    };
  },

  // Login existing user
  async login(email: string, password: string) {
    // Find user
    const user = await UserModel.findByEmail(email);
    if (!user || !user.password_hash) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    // Update last login
    await UserModel.updateLastLogin(user.id);

    // Get profile
    const profile = await PlayerProfileModel.findByUserId(user.id);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        display_name: profile?.display_name || user.username || 'Player',
      },
    };
  },
};
