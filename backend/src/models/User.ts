import { query } from '../config/database';

export interface User {
  id: number;
  email: string | null;
  password_hash: string | null;
  username: string | null;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
  google_id: string | null;
  apple_id: string | null;
  is_guest: boolean;
  auth_provider: 'email' | 'google' | 'apple' | 'guest';
}

export const UserModel = {
  // Create a new user (legacy/migration - kept for existing email/password users)
  async create(email: string, passwordHash: string, displayName: string): Promise<User> {
    const result = await query(
      `INSERT INTO users (email, password_hash, username, auth_provider, is_guest)
       VALUES ($1, $2, $3, 'email', false)
       RETURNING *`,
      [email, passwordHash, displayName]
    );
    return result.rows[0];
  },

  // Create a guest user
  async createGuest(guestId: string): Promise<User> {
    const email = `guest_${guestId}@sudoduel.local`;
    const username = `Guest_${guestId.substring(0, 6)}`;
    
    const result = await query(
      `INSERT INTO users (email, username, is_guest, auth_provider)
       VALUES ($1, $2, true, 'guest')
       RETURNING *`,
      [email, username]
    );
    return result.rows[0];
  },

  // Create a user via OAuth provider
  async createOAuth(
    email: string | null,
    displayName: string,
    provider: 'google' | 'apple',
    providerId: string
  ): Promise<User> {
    const googleId = provider === 'google' ? providerId : null;
    const appleId = provider === 'apple' ? providerId : null;
    
    const result = await query(
      `INSERT INTO users (email, username, google_id, apple_id, auth_provider, is_guest)
       VALUES ($1, $2, $3, $4, $5, false)
       RETURNING *`,
      [email, displayName, googleId, appleId, provider]
    );
    return result.rows[0];
  },

  // Find user by email
  async findByEmail(email: string): Promise<User | null> {
    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  },

  // Find user by ID
  async findById(id: number): Promise<User | null> {
    const result = await query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  },

  // Find user by Google ID
  async findByGoogleId(googleId: string): Promise<User | null> {
    const result = await query(
      'SELECT * FROM users WHERE google_id = $1',
      [googleId]
    );
    return result.rows[0] || null;
  },

  // Find user by Apple ID
  async findByAppleId(appleId: string): Promise<User | null> {
    const result = await query(
      'SELECT * FROM users WHERE apple_id = $1',
      [appleId]
    );
    return result.rows[0] || null;
  },

  // Update last login
  async updateLastLogin(id: number): Promise<void> {
    await query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [id]
    );
  },

  // Link Google account to existing user (converts guest to full account)
  async linkGoogleAccount(userId: number, googleId: string): Promise<User> {
    const result = await query(
      `UPDATE users 
       SET google_id = $1, is_guest = false, auth_provider = 'google', updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [googleId, userId]
    );
    return result.rows[0];
  },

  // Link Apple account to existing user (converts guest to full account)
  async linkAppleAccount(userId: number, appleId: string): Promise<User> {
    const result = await query(
      `UPDATE users 
       SET apple_id = $1, is_guest = false, auth_provider = 'apple', updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [appleId, userId]
    );
    return result.rows[0];
  },

  // Link email/password to existing user (converts guest to full account)
  async linkEmailPassword(userId: number, email: string, passwordHash: string): Promise<User> {
    const result = await query(
      `UPDATE users 
       SET email = $1, password_hash = $2, is_guest = false, auth_provider = 'email', updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [email, passwordHash, userId]
    );
    return result.rows[0];
  },

  // Check if Google ID is already taken
  async isGoogleIdTaken(googleId: string): Promise<boolean> {
    const result = await query(
      'SELECT 1 FROM users WHERE google_id = $1 LIMIT 1',
      [googleId]
    );
    return result.rows.length > 0;
  },

  // Check if Apple ID is already taken
  async isAppleIdTaken(appleId: string): Promise<boolean> {
    const result = await query(
      'SELECT 1 FROM users WHERE apple_id = $1 LIMIT 1',
      [appleId]
    );
    return result.rows.length > 0;
  },

  // Update user's email
  async updateEmail(userId: number, email: string): Promise<User> {
    const result = await query(
      `UPDATE users 
       SET email = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [email, userId]
    );
    return result.rows[0];
  },
};
