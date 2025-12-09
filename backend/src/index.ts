import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import authRoutes from './routes/auth';
import playerRoutes from './routes/player';
import puzzleRoutes from './routes/puzzle';
import matchmakingRoutes from './routes/matchmaking';
import friendsRoutes from './routes/friends';
import reportsRoutes from './routes/reports';
import usersRoutes from './routes/users';
import leaderboardRoutes from './routes/leaderboard';
import { setupWebSocketServer } from './services/websocketServer';
import { warmupDatabase } from './config/database';
import { cache } from './services/cacheService';
import './config/database';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
const isDevelopment = process.env.NODE_ENV !== 'production';

const allowedOrigins = [
  process.env.FRONTEND_URL, // From Railway environment variable
  'https://app.sudoduel.com',
  'https://sudoduel.com',
  'https://www.sudoduel.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  // Capacitor mobile apps
  'capacitor://localhost',
  'http://localhost',
].filter(Boolean); // Remove undefined values

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    // In development, allow any localhost origin
    if (isDevelopment && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
      return callback(null, true);
    }
    
    // Check against allowed origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Log rejected origin for debugging
    console.warn(`CORS: Rejected origin: ${origin}`);
    console.log(`CORS: Allowed origins: ${allowedOrigins.join(', ')}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    cache_size: cache.stats().size,
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/player', playerRoutes);
app.use('/api/puzzle', puzzleRoutes);
app.use('/api/matchmaking', matchmakingRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Create HTTP server
const server = createServer(app);

// Setup WebSocket server
setupWebSocketServer(server);

// Start server with warmup
async function startServer() {
  try {
    console.log('🚀 Starting Sudoduel server...');
    
    // Warm up database connections BEFORE starting server
    await warmupDatabase();
    
    server.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Database URL: ${process.env.DATABASE_URL ? 'Set' : 'NOT SET'}`);
      console.log(`📊 Cache service initialized`);
    });

    // Graceful shutdown handler
    process.on('SIGTERM', async () => {
      console.log('🛑 SIGTERM received, shutting down gracefully...');
      cache.shutdown();
      server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
      });
      setTimeout(() => {
        console.error('⚠️ Forcing shutdown after 10s timeout');
        process.exit(1);
      }, 10000);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Handle server errors gracefully
server.on('error', (err: any) => {
  console.error('❌ Server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  // Don't exit - let Railway handle restarts
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - let Railway handle restarts
});
