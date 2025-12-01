import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import SudokuGrid from '../components/SudokuGrid';
import NumberPad from '../components/NumberPad';

interface GamePageProps {
  matchId: number;
  onGameEnd: () => void;
}

interface PlayerState {
  cells_completed: number;
  lives_remaining: number;
  is_locked_out: boolean;
  is_solved: boolean;
}

export default function GamePage({ matchId, onGameEnd }: GamePageProps) {
  const { token, user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  
  const [myGrid, setMyGrid] = useState<number[][]>([]);
  const [initialGrid, setInitialGrid] = useState<number[][]>([]);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [myState, setMyState] = useState<PlayerState>({ cells_completed: 0, lives_remaining: 3, is_locked_out: false, is_solved: false });
  const [opponentState, setOpponentState] = useState<PlayerState>({ cells_completed: 0, lives_remaining: 3, is_locked_out: false, is_solved: false });
  const [mySlot, setMySlot] = useState<number>(0);
  const [gameStatus, setGameStatus] = useState<'connecting' | 'waiting' | 'playing' | 'ended'>('connecting');
  const [myTimeRemaining, setMyTimeRemaining] = useState(300);
  const [opponentTimeRemaining, setOpponentTimeRemaining] = useState(300);
  const [gameResult, setGameResult] = useState<any>(null);
  const [lastMoveResult, setLastMoveResult] = useState<{ correct: boolean; row: number; col: number } | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [notes, setNotes] = useState<Map<string, number[]>>(new Map()); // key: "row-col", value: number[]
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');

  // Connect to WebSocket
  useEffect(() => {
    const ws = new WebSocket(
      `ws://localhost:3001/ws/game?match_id=${matchId}&token=${token}`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to game server');
      setConnectionStatus('connected');
      setGameStatus('waiting');
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleMessage(message);
    };

    ws.onclose = () => {
      console.log('Disconnected from game server');
      setConnectionStatus('disconnected');
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('disconnected');
    };

    return () => {
      ws.close();
    };
  }, [matchId, token]);

  // Timer is now managed by server - no client-side countdown needed

  // Clear last move result after animation
  useEffect(() => {
    if (lastMoveResult) {
      const timer = setTimeout(() => setLastMoveResult(null), 500);
      return () => clearTimeout(timer);
    }
  }, [lastMoveResult]);

  const handleMessage = (message: any) => {
    console.log('Received:', message);

    switch (message.type) {
      case 'GAME_STATE':
        const receivedSlot = message.data.your_slot;
        console.log(`🎮🎮🎮 GAME_STATE received: your_slot=${receivedSlot} (type: ${typeof receivedSlot})`);
        console.log(`🎮🎮🎮 Setting mySlot to ${receivedSlot}`);
        setMySlot(Number(receivedSlot)); // Ensure it's a number
        // Get player profile ID from API to set myPlayerId
        // For now, we'll use slot-based identification which is more reliable
        if (receivedSlot === 1 || receivedSlot === '1') {
          console.log(`🎮 I am player 1`);
          setMyState(message.data.player1);
          setOpponentState(message.data.player2);
          setMyTimeRemaining(message.data.player1.time_remaining || 300);
          setOpponentTimeRemaining(message.data.player2.time_remaining || 300);
        } else if (receivedSlot === 2 || receivedSlot === '2') {
          console.log(`🎮 I am player 2`);
          setMyState(message.data.player2);
          setOpponentState(message.data.player1);
          setMyTimeRemaining(message.data.player2.time_remaining || 300);
          setOpponentTimeRemaining(message.data.player1.time_remaining || 300);
        } else {
          console.error(`⚠️ Invalid slot received: ${receivedSlot} (type: ${typeof receivedSlot})`);
        }
        break;

      case 'GAME_START':
        const grid = message.data.initial_grid;
        setMyGrid(grid.map((row: number[]) => [...row]));
        setInitialGrid(grid.map((row: number[]) => [...row]));
        // Initialize timers from server
        if (mySlot === 1) {
          setMyTimeRemaining(message.data.player1_time_remaining || 300);
          setOpponentTimeRemaining(message.data.player2_time_remaining || 300);
        } else {
          setMyTimeRemaining(message.data.player2_time_remaining || 300);
          setOpponentTimeRemaining(message.data.player1_time_remaining || 300);
        }
        setGameStatus('playing');
        break;

      case 'MOVE_RESULT':
        const { player_id, slot, row, col, value, correct, player_state, timer_update } = message.data;
        const myPlayerId = user?.id;
        
        // Prefer authoritative identity by player_id (player_profiles.id) from backend
        // myPlayerId comes from AuthContext and is normalized to player_profiles.id
        const isMyMoveById = myPlayerId !== undefined && myPlayerId !== null && player_id === myPlayerId;

        // Fallback: use slot comparison if for some reason myPlayerId is not available
        const moveSlot = slot !== undefined ? Number(slot) : (player_state?.slot !== undefined ? Number(player_state.slot) : null);
        const mySlotNum = Number(mySlot); // Ensure mySlot is a number
        const isMyMoveBySlot = moveSlot !== null && moveSlot !== undefined && mySlotNum !== 0 && moveSlot === mySlotNum;

        const isMyMove = isMyMoveById || (!myPlayerId && isMyMoveBySlot);

        console.log('📨 MOVE_RESULT', {
          player_id,
          myPlayerId,
          slot,
          moveSlot,
          mySlotNum,
          isMyMoveById,
          isMyMoveBySlot,
          isMyMove,
        });

        if (isMyMove) {
          // Update MY grid and state
          console.log(`✅✅✅ UPDATING MY STATE (I made this move, slot ${mySlot})`);
          if (correct) {
            setMyGrid((prev) => {
              const newGrid = prev.map((r) => [...r]);
              newGrid[row][col] = value;
              return newGrid;
            });
          }
          setMyState(player_state);
          if (player_state.time_remaining !== undefined) {
            setMyTimeRemaining(player_state.time_remaining);
          }
          setLastMoveResult({ correct, row, col });
          console.log(`✅✅✅ MY STATE UPDATED:`, player_state);
        } else {
          // Update opponent state only (not their grid - we can't see it!)
          console.log(`🔴🔴🔴 UPDATING OPPONENT STATE (opponent made this move, their slot ${moveSlot}, my slot ${mySlot})`);
          setOpponentState(player_state);
          if (player_state.time_remaining !== undefined) {
            setOpponentTimeRemaining(player_state.time_remaining);
          }
          console.log(`🔴🔴🔴 OPPONENT STATE UPDATED:`, player_state);
        }

        // Update timers if provided
        if (timer_update) {
          if (mySlot === 1) {
            setMyTimeRemaining(timer_update.player1_time_remaining);
            setOpponentTimeRemaining(timer_update.player2_time_remaining);
          } else {
            setMyTimeRemaining(timer_update.player2_time_remaining);
            setOpponentTimeRemaining(timer_update.player1_time_remaining);
          }
        }
        break;

      case 'TIMER_UPDATE':
        // Update both timers from server
        if (mySlot === 1) {
          setMyTimeRemaining(message.data.player1_time_remaining);
          setOpponentTimeRemaining(message.data.player2_time_remaining);
        } else {
          setMyTimeRemaining(message.data.player2_time_remaining);
          setOpponentTimeRemaining(message.data.player1_time_remaining);
        }
        break;

      case 'ERASE_RESULT':
        const { player_id: _erasePlayerId, slot: eraseSlot, row: eraseRow, col: eraseCol, player_state: erasePlayerState, timer_update: eraseTimerUpdate } = message.data;
        const isMyErase = eraseSlot === mySlot || erasePlayerState.slot === mySlot;

        if (isMyErase) {
          // Update my grid
          setMyGrid((prev) => {
            const newGrid = prev.map((r) => [...r]);
            newGrid[eraseRow][eraseCol] = 0;
            return newGrid;
          });
          setMyState(erasePlayerState);
          if (erasePlayerState.time_remaining !== undefined) {
            setMyTimeRemaining(erasePlayerState.time_remaining);
          }
        } else {
          // Update opponent state
          setOpponentState(erasePlayerState);
          if (erasePlayerState.time_remaining !== undefined) {
            setOpponentTimeRemaining(erasePlayerState.time_remaining);
          }
        }

        // Update timers if provided
        if (eraseTimerUpdate) {
          if (mySlot === 1) {
            setMyTimeRemaining(eraseTimerUpdate.player1_time_remaining);
            setOpponentTimeRemaining(eraseTimerUpdate.player2_time_remaining);
          } else {
            setMyTimeRemaining(eraseTimerUpdate.player2_time_remaining);
            setOpponentTimeRemaining(eraseTimerUpdate.player1_time_remaining);
          }
        }
        break;

      case 'GAME_END':
        setGameStatus('ended');
        setGameResult(message.data);
        break;
    }
  };

  const handleCellClick = (row: number, col: number) => {
    if (gameStatus !== 'playing' || myState?.is_locked_out) return;
    setSelectedCell({ row, col });
  };

  const handleNumberClick = (num: number) => {
    if (!selectedCell || gameStatus !== 'playing' || myState?.is_locked_out) return;

    if (notesMode) {
      // In notes mode: toggle the number in notes for this cell
      const cellKey = `${selectedCell.row}-${selectedCell.col}`;
      setNotes((prev) => {
        const newNotes = new Map(prev);
        const currentNotes = newNotes.get(cellKey) || [];
        
        if (currentNotes.includes(num)) {
          // Remove note if it exists
          const updated = currentNotes.filter(n => n !== num);
          if (updated.length === 0) {
            newNotes.delete(cellKey);
          } else {
            newNotes.set(cellKey, updated);
          }
        } else {
          // Add note
          newNotes.set(cellKey, [...currentNotes, num].sort());
        }
        
        return newNotes;
      });
    } else {
      // Normal mode: place number
      wsRef.current?.send(
        JSON.stringify({
          type: 'PLACE_NUMBER',
          data: {
            row: selectedCell.row,
            col: selectedCell.col,
            value: num,
          },
        })
      );
      
      setSelectedCell(null);
    }
  };

  const handleErase = () => {
    if (!selectedCell || gameStatus !== 'playing' || myState?.is_locked_out) return;
    
    // Check if cell is initial clue - can't erase those
    if (initialGrid[selectedCell.row] && initialGrid[selectedCell.row][selectedCell.col] !== 0) {
      return;
    }

    // Check if cell has a value - can only erase if it's incorrect
    const currentValue = myGrid[selectedCell.row]?.[selectedCell.col];
    if (currentValue === 0) {
      // Clear notes if any
      const cellKey = `${selectedCell.row}-${selectedCell.col}`;
      setNotes((prev) => {
        const newNotes = new Map(prev);
        newNotes.delete(cellKey);
        return newNotes;
      });
      return;
    }

    // Send erase request to server
    wsRef.current?.send(
      JSON.stringify({
        type: 'ERASE_CELL',
        data: {
          row: selectedCell.row,
          col: selectedCell.col,
        },
      })
    );

    // Also clear notes for this cell
    const cellKey = `${selectedCell.row}-${selectedCell.col}`;
    setNotes((prev) => {
      const newNotes = new Map(prev);
      newNotes.delete(cellKey);
      return newNotes;
    });
    
    setSelectedCell(null);
  };

  const handleToggleNotes = () => {
    setNotesMode((prev) => !prev);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Connecting screen
  if (gameStatus === 'connecting') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Connecting to game...</div>
      </div>
    );
  }

  // Waiting for opponent
  if (gameStatus === 'waiting') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">
          Waiting for opponent to connect...
        </div>
      </div>
    );
  }

  // Game ended
  if (gameStatus === 'ended' && gameResult) {
    const myPlayerId = user?.id;

    // Prefer authoritative identity by player_id from backend results
    const myResult =
      myPlayerId && gameResult.player1.playerId === myPlayerId
        ? gameResult.player1
        : myPlayerId && gameResult.player2.playerId === myPlayerId
        ? gameResult.player2
        : mySlot === 1
        ? gameResult.player1
        : gameResult.player2;

    const opponentResult =
      myResult === gameResult.player1 ? gameResult.player2 : gameResult.player1;

    const didWin =
      myPlayerId != null
        ? gameResult.winner_id === myPlayerId
        : myResult.isWinner;

    const isDraw = !gameResult.winner_id;
    const ratingChange = myResult.rating_change || 0;

    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-xl p-6 sm:p-8 text-center max-w-md w-full shadow-2xl border border-gray-700">
          {/* Result Header with Animation */}
          <div className={`mb-6 transform transition-all duration-500 ${
            isDraw ? 'scale-100' : didWin ? 'scale-110' : 'scale-95'
          }`}>
            <h1 className={`text-4xl sm:text-5xl font-bold mb-2 ${
              isDraw ? 'text-yellow-400' : didWin ? 'text-green-400' : 'text-red-400'
            }`}>
              {isDraw ? '🤝 Draw!' : didWin ? '🎉 Victory!' : '😔 Defeat'}
            </h1>
            
            {/* Win reason */}
            <p className="text-gray-300 text-sm sm:text-base">
              {myResult.finalState === 'SOLVED' && '✨ You completed the puzzle!'}
              {myResult.finalState === 'LOCKED_OUT' && '💔 You ran out of lives'}
              {myResult.finalState === 'TIMEOUT' && '⏱️ Time ran out'}
              {opponentResult.finalState === 'LOCKED_OUT' && didWin && '🎯 Opponent ran out of lives'}
              {opponentResult.finalState === 'SOLVED' && !didWin && '⚡ Opponent completed the puzzle'}
              {isDraw && 'Equal cells at timeout'}
            </p>
          </div>

          {/* Stats comparison */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
            <div className={`bg-gray-700 rounded-lg p-3 sm:p-4 border-2 ${
              didWin ? 'border-green-500' : isDraw ? 'border-yellow-500' : 'border-gray-600'
            }`}>
              <p className="text-blue-400 font-bold mb-2 text-sm sm:text-base">You</p>
              <div className="space-y-1 text-xs sm:text-sm">
                <p className="text-white">📊 {myResult.cellsCompleted} cells</p>
                <p className="text-white">❌ {myResult.mistakes} mistakes</p>
                <p className="text-white">❤️ {myResult.livesRemaining} lives</p>
                <p className="text-white">⏱️ {formatTime(myResult.timeSpentSeconds || 0)}</p>
              </div>
            </div>
            <div className={`bg-gray-700 rounded-lg p-3 sm:p-4 border-2 ${
              !didWin && !isDraw ? 'border-red-500' : isDraw ? 'border-yellow-500' : 'border-gray-600'
            }`}>
              <p className="text-red-400 font-bold mb-2 text-sm sm:text-base">Opponent</p>
              <div className="space-y-1 text-xs sm:text-sm">
                <p className="text-white">📊 {opponentResult.cellsCompleted} cells</p>
                <p className="text-white">❌ {opponentResult.mistakes} mistakes</p>
                <p className="text-white">❤️ {opponentResult.livesRemaining} lives</p>
                <p className="text-white">⏱️ {formatTime(opponentResult.timeSpentSeconds || 0)}</p>
              </div>
            </div>
          </div>

          {/* Rating change - Prominent */}
          <div className={`bg-gradient-to-r rounded-lg p-4 sm:p-5 mb-6 ${
            ratingChange > 0 
              ? 'from-green-900/50 to-green-800/50 border border-green-500' 
              : ratingChange < 0
              ? 'from-red-900/50 to-red-800/50 border border-red-500'
              : 'from-gray-700 to-gray-600 border border-gray-500'
          }`}>
            <p className="text-gray-300 mb-2 text-sm sm:text-base">Rating Change</p>
            <div className="flex items-center justify-center gap-2 sm:gap-3">
              <span className="text-xl sm:text-2xl font-bold text-white">
                {Math.round(myResult.rating_before || 1500)}
              </span>
              <span className="text-gray-400 text-lg sm:text-xl">→</span>
              <span className="text-2xl sm:text-3xl font-bold text-white">
                {Math.round(myResult.rating_after || 1500)}
              </span>
              <span className={`text-xl sm:text-2xl font-bold ${
                ratingChange > 0 ? 'text-green-400' : ratingChange < 0 ? 'text-red-400' : 'text-gray-400'
              }`}>
                ({ratingChange > 0 ? '+' : ''}{Math.round(ratingChange)})
              </span>
            </div>
          </div>

          <button
            onClick={onGameEnd}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3 px-8 rounded-lg transition w-full text-base sm:text-lg shadow-lg"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  // Calculate status message
  const cellDiff = myState.cells_completed - opponentState.cells_completed;
  const statusMessage = cellDiff > 0 
    ? `You're ahead by ${cellDiff} cell${cellDiff !== 1 ? 's' : ''}`
    : cellDiff < 0
    ? `Opponent is ahead by ${Math.abs(cellDiff)} cell${Math.abs(cellDiff) !== 1 ? 's' : ''}`
    : 'Tied';

  // Main game UI
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col p-4">
      {/* Top Utility Bar */}
      <div className="w-full max-w-lg mx-auto mb-4 flex justify-between items-center">
        <button
          onClick={onGameEnd}
          className="text-gray-400 hover:text-white transition text-sm"
        >
          ← Back to Lobby
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">9x9 • 5min Ranked</span>
          <div className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500' : 
            connectionStatus === 'connecting' ? 'bg-yellow-500' : 
            'bg-red-500'
          }`} title={connectionStatus} />
        </div>
      </div>

      {/* Match Header Row */}
      <div className="flex justify-between items-center w-full max-w-lg mb-2 gap-2">
        <div className="bg-blue-900/50 rounded-lg p-2 sm:p-3 flex-1 min-w-0">
          <p className="text-xs text-blue-300 uppercase">You</p>
          <p className="text-white font-bold text-xs sm:text-sm">
            ❤️ {myState.lives_remaining} | 📊 {myState.cells_completed}/81
          </p>
          {myState.is_locked_out && (
            <p className="text-red-400 text-xs">LOCKED OUT</p>
          )}
        </div>
        
        <div className="text-center px-2">
          <p className={`text-sm sm:text-lg font-bold font-mono ${myTimeRemaining < 60 ? 'text-red-400' : 'text-white'}`}>
            {formatTime(myTimeRemaining)}
          </p>
          <p className="text-xs text-gray-400">vs</p>
          <p className={`text-sm sm:text-lg font-bold font-mono ${opponentTimeRemaining < 60 ? 'text-red-400' : 'text-white'}`}>
            {formatTime(opponentTimeRemaining)}
          </p>
        </div>
        
        <div className="bg-red-900/50 rounded-lg p-2 sm:p-3 text-right flex-1 min-w-0">
          <p className="text-xs text-red-300 uppercase">Opponent</p>
          <p className="text-white font-bold text-xs sm:text-sm">
            ❤️ {opponentState.lives_remaining} | 📊 {opponentState.cells_completed}/81
          </p>
          {opponentState.is_locked_out && (
            <p className="text-green-400 text-xs">LOCKED OUT</p>
          )}
        </div>
      </div>

      {/* Status Strip */}
      <div className="w-full max-w-lg mb-2 text-center">
        <p className="text-sm text-gray-300">
          {statusMessage} • You: {myState.cells_completed}/81 • Opponent: {opponentState.cells_completed}/81
        </p>
      </div>

      {/* Status messages */}
      {myState.is_locked_out && (
        <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-2 rounded mb-4">
          ⚠️ You're locked out! Waiting for timer or opponent...
        </div>
      )}
      
      {opponentState.is_locked_out && !myState.is_locked_out && (
        <div className="bg-green-500/20 border border-green-500 text-green-300 px-4 py-2 rounded mb-4">
          ✅ Opponent is locked out! Keep going to win!
        </div>
      )}

      {/* Sudoku Grid - Centered */}
      <div className="flex-1 flex items-center justify-center">
        {myGrid.length > 0 && (
          <SudokuGrid
            grid={myGrid}
            initialGrid={initialGrid}
            selectedCell={selectedCell}
            onCellClick={handleCellClick}
            notes={notes}
            notesMode={notesMode}
          />
        )}
      </div>

      {/* Last move feedback */}
      {lastMoveResult && (
        <div className={`mt-2 px-4 py-1 rounded ${lastMoveResult.correct ? 'bg-green-500/50 text-green-200' : 'bg-red-500/50 text-red-200'}`}>
          {lastMoveResult.correct ? '✓ Correct!' : '✗ Wrong! -1 life, +10s penalty'}
        </div>
      )}

      {/* Notes mode indicator */}
      {notesMode && (
        <div className="bg-blue-500/20 border border-blue-500 text-blue-300 px-4 py-2 rounded mb-2">
          📝 Notes Mode Active
        </div>
      )}

      {/* Number Pad */}
      <NumberPad
        onNumberClick={handleNumberClick}
        onErase={handleErase}
        onToggleNotes={handleToggleNotes}
        notesMode={notesMode}
        disabled={gameStatus !== 'playing' || myState.is_locked_out}
      />
    </div>
  );
}
