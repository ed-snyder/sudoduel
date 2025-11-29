# Sudoduel

A competitive head-to-head Sudoku game where two players race to solve the same puzzle under time and accuracy pressure.

## 🎮 Project Status

**Phase 2 & 3 Complete** - Backend core functionality working!

### ✅ Completed Features

- **Authentication System**
  - User signup and login with JWT tokens
  - Password hashing with bcrypt
  - Protected API endpoints

- **Player Profiles & Ratings**
  - Automatic profile creation on signup
  - Glicko-2 rating system initialization
  - Default rating: 1500, RD: 350

- **Puzzle System**
  - 5 seeded Sudoku puzzles (Easy, Medium, Hard)
  - Random puzzle selection
  - Server-side solution validation

- **Matchmaking**
  - Queue-based matchmaking
  - Rating-based pairing (±200 rating window)
  - Automatic match creation

- **Real-Time Game Engine**
  - WebSocket-based live gameplay
  - Move validation against solution
  - Lives system (3 lives, -1 per mistake)
  - Time penalties (10 seconds per mistake)
  - Synchronized game state between players
  - Lock-out on life depletion

### 🚧 In Progress / Todo

- [ ] Timer system (5-minute countdown)
- [ ] End-game detection (timeout, completion, lockout)
- [ ] Glicko-2 rating calculation after matches
- [ ] Match result storage
- [ ] Frontend UI (React)
- [ ] Mobile responsiveness

---

## 🏗️ Architecture

### Tech Stack

**Backend:**
- Node.js + Express + TypeScript
- PostgreSQL database
- WebSocket (ws) for real-time gameplay
- JWT authentication
- bcrypt for password hashing

**Frontend (Planned):**
- React + TypeScript
- Vite
- Tailwind CSS
- Socket.io-client

---

## 📊 Database Schema

8 core tables:
1. `users` - Authentication
2. `player_profiles` - Player info
3. `ladders` - Game modes (currently: 9x9 5min Ranked)
4. `player_ratings` - Glicko-2 ratings per ladder
5. `puzzles` - Sudoku puzzle library
6. `matches` - Match records
7. `match_players` - Player participation & stats
8. `matchmaking_queue` - Active matchmaking queue

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- npm

### Installation

1. **Clone the repository**
```bash
   git clone https://github.com/yourusername/sudoduel.git
   cd sudoduel
```

2. **Set up database**
```bash
   createdb sudoduel
   createuser sudoduel_user -P
   psql -U sudoduel_user -d sudoduel -f database/migrations/001_initial_schema.sql
   psql -U sudoduel_user -d sudoduel -f database/seeds/puzzles.sql
```

3. **Configure backend**
```bash
   cd backend
   cp .env.example .env
   # Edit .env with your database credentials
   npm install
```

4. **Build shared types**
```bash
   cd ../shared
   npm install
   npm run build
```

5. **Start backend**
```bash
   cd ../backend
   npm run dev
```

### Testing the Game

See `TESTING.md` for instructions on testing matchmaking and gameplay with two players.

---

## 📝 API Endpoints

### Auth
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login

### Player
- `GET /api/player/me` - Get current player info (protected)

### Puzzle
- `GET /api/puzzle/random` - Get random puzzle (protected)

### Matchmaking
- `POST /api/matchmaking/join` - Join queue (protected)
- `POST /api/matchmaking/leave` - Leave queue (protected)

### WebSocket
- `ws://localhost:3001/ws/game?match_id=X&token=Y` - Connect to live match

---

## 🎯 Game Rules

- **Time Limit:** 5 minutes per player
- **Lives:** 3 lives, lose 1 per mistake
- **Time Penalty:** +10 seconds per mistake
- **Win Conditions:**
  1. Complete the puzzle first
  2. Have more correct cells when time expires
  3. Opponent gets locked out (0 lives) with fewer cells
- **Draw:** Equal cells at timeout

---

## 📈 Roadmap

### Phase 4: Complete Backend MVP
- [ ] Implement countdown timers
- [ ] End-game detection and results
- [ ] Glicko-2 rating updates
- [ ] Match history storage

### Phase 5: Frontend
- [ ] Login/signup UI
- [ ] Matchmaking lobby
- [ ] Sudoku game board
- [ ] Live opponent state display
- [ ] Post-game rating screen

### Phase 6: Deployment
- [ ] Deploy backend (Railway/Render)
- [ ] Deploy frontend (Vercel)
- [ ] Set up production database
- [ ] SSL/WebSocket security

### Phase 7: Polish & Launch
- [ ] Mobile PWA
- [ ] Leaderboards
- [ ] Match replays
- [ ] Beta testing

---

## 🧪 Development
```bash
# Backend development
cd backend
npm run dev

# Watch shared types
cd shared
npm run watch

# Database migrations
psql -U sudoduel_user -d sudoduel -f database/migrations/XXX.sql
```

---

## 📄 License

MIT

---

## 👤 Author

Eric - Solo developer building Sudoduel

---

**Built with ❤️ and lots of TypeScript**
