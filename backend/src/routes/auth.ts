import { Router, Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { validateUsername } from '../utils/usernameValidator';

const router = Router();

// POST /api/auth/signup
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, display_name } = req.body;

    // Validation
    if (!email || !password || !display_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Validate display name (critical for Apple App Store compliance)
    if (!display_name || typeof display_name !== 'string') {
      return res.status(400).json({ error: 'Display name is required' });
    }
    
    const usernameValidation = validateUsername(display_name);
    if (!usernameValidation.valid) {
      return res.status(400).json({ error: usernameValidation.error || 'Invalid display name' });
    }

    const result = await AuthService.signup(email, password, display_name.trim());
    
    res.status(201).json(result);
  } catch (error: any) {
    console.error('Signup error:', error);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password' });
    }

    const result = await AuthService.login(email, password);
    
    res.json(result);
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(401).json({ error: error.message });
  }
});

export default router;
