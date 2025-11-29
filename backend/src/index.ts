import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import authRoutes from './routes/auth';
import playerRoutes from './routes/player';
import puzzleRoutes from './routes/puzzle';
import matchmakingRoutes from './routes/matchmaking';
import { setupWebSocketServer } from './services/websocketServer';
import './config/database';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Sudoduel backend is running!' });
});

app.use('/api/auth', authRoutes);
app.use('/api/player', playerRoutes);
app.use('/api/puzzle', puzzleRoutes);
app.use('/api/matchmaking', matchmakingRoutes);

// Create HTTP server
const server = createServer(app);

// Setup WebSocket server
setupWebSocketServer(server);

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
