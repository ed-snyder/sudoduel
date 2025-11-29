import { query } from '../config/database';

export interface User {
  id: number;
  email: string;
  password_hash: string | null;
  username: string | null;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
}

export const UserModel = {
  // Create a new user
  async create(email: string, passwordHash: string, displayName: string): Promise<User> {
    const result = await query(
      `INSERT INTO users (email, password_hash, username)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [email, passwordHash, displayName]
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

  // Update last login
  async updateLastLogin(id: number): Promise<void> {
    await query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [id]
    );
  },
};
