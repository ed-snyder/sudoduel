import rateLimit from 'express-rate-limit';

// General API rate limit - 100 requests per 15 minutes
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limit for auth endpoints - 20 attempts per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for guest auth so users can quickly try the app
  skip: (req) => req.path === '/guest',
});

// Matchmaking limit - 20 joins per 5 minutes (prevents queue spam)
export const matchmakingLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20,
  message: { error: 'Too many matchmaking requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});
