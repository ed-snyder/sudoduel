# Testing Sudoduel

Guide for testing the multiplayer gameplay.

## Prerequisites

Install `wscat` for WebSocket testing:
```bash
npm install -g wscat
```

## Full Test Flow

### 1. Create Two Player Accounts

**Player 1:**
```bash
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "player1@test.com",
    "password": "password123",
    "display_name": "Player1"
  }'
```

Save the token from the response.

**Player 2:**
```bash
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "player2@test.com",
    "password": "password123",
    "display_name": "Player2"
  }'
```

Save this token too.

### 2. Start Matchmaking

**Player 1 joins queue:**
```bash
curl -X POST http://localhost:3001/api/matchmaking/join \
  -H "Authorization: Bearer PLAYER1_TOKEN"
```

Response: `{"status":"queued"}`

**Player 2 joins queue:**
```bash
curl -X POST http://localhost:3001/api/matchmaking/join \
  -H "Authorization: Bearer PLAYER2_TOKEN"
```

Response: `{"status":"matched","match_id":1}`

Note the `match_id`!

### 3. Connect via WebSocket

**Terminal 1 - Player 1:**
```bash
wscat -c "ws://localhost:3001/ws/game?match_id=1&token=PLAYER1_TOKEN"
```

**Terminal 2 - Player 2:**
```bash
wscat -c "ws://localhost:3001/ws/game?match_id=1&token=PLAYER2_TOKEN"
```

Both should see:
- `{"type":"GAME_STATE",...}`
- `{"type":"GAME_START",...}` (when both connected)

### 4. Play the Game

**Make moves:**
```json
{"type":"PLACE_NUMBER","data":{"row":0,"col":2,"value":4}}
```

**Test ping:**
```json
{"type":"PING"}
```

Response: `{"type":"PONG"}`

### 5. Check Game State

Both players see move results in real-time:
```json
{"type":"MOVE_RESULT","data":{"correct":true,"player_state":{...}}}
```

## Verified Features

- ✅ Matchmaking pairs players correctly
- ✅ WebSocket connections authenticate
- ✅ Game starts when both players connect
- ✅ Moves are validated server-side
- ✅ Incorrect moves decrease lives
- ✅ Correct moves increase cells_completed
- ✅ Both players see each other's moves in real-time
- ✅ Lockout occurs at 0 lives

## Database Inspection
```bash
psql -U sudoduel_user -d sudoduel

# View matches
SELECT * FROM matches;

# View match players
SELECT * FROM match_players;

# View puzzle used
SELECT initial_grid, solution_grid FROM puzzles WHERE id = X;

\q
```
