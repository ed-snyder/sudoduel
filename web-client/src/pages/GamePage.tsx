import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import SudokuGrid from '../components/SudokuGrid';
import NumberPad from '../components/NumberPad';
import { ForfeitModal } from '../components/ForfeitModal';

interface GamePageProps {
  matchId: number;
  onGameEnd: () => void;
}

interface PlayerState {
  score: number;              // Cells completed by player (not including initial clues)
  cells_completed: number;    // Total cells filled (including initial clues)
  time_remaining: number;    // Time-as-resource timer
  is_locked: boolean;        // true when timer hits 0
  is_solved: boolean;
}

export default function GamePage({ matchId, onGameEnd }: GamePageProps) {
  const { token, user, refreshUser } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  
  const [myGrid, setMyGrid] = useState<number[][]>([]);
  const [initialGrid, setInitialGrid] = useState<number[][]>([]);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [myState, setMyState] = useState<PlayerState>({ score: 0, cells_completed: 0, time_remaining: 90, is_locked: false, is_solved: false });
  const [opponentState, setOpponentState] = useState<PlayerState>({ score: 0, cells_completed: 0, time_remaining: 90, is_locked: false, is_solved: false });
  const [mySlot, setMySlot] = useState<number>(0);
  const [gameStatus, setGameStatus] = useState<'connecting' | 'waiting' | 'playing' | 'ended'>('connecting');
  const [myTimeRemaining, setMyTimeRemaining] = useState(90);
  const [opponentTimeRemaining, setOpponentTimeRemaining] = useState(90);
  const [timeChange, setTimeChange] = useState<number | null>(null); // Track time change for feedback (+3 or -15)
  const [gameResult, setGameResult] = useState<any>(null);
  const [lastMoveResult, setLastMoveResult] = useState<{ correct: boolean; row: number; col: number } | null>(null);
  const [opponentMoveFeedback, setOpponentMoveFeedback] = useState<{ correct: boolean } | null>(null); // Track opponent move feedback
  const opponentFeedbackTimeoutRef = useRef<number | null>(null);
  const [showForfeitModal, setShowForfeitModal] = useState(false);
  const [notesMode, setNotesMode] = useState(false);
  const [notes, setNotes] = useState<Map<string, number[]>>(new Map()); // key: "row-col", value: number[]
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [myName, setMyName] = useState<string>(user?.display_name || 'You');
  const [opponentName, setOpponentName] = useState<string>('Opponent');
  const [myRating, setMyRating] = useState<number | undefined>(user?.rating);

  // Connect to WebSocket
  useEffect(() => {
    const ws = new WebSocket(
      `ws://localhost:3001/ws/game?match_id=${matchId}&token=${token}`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      setGameStatus('waiting');
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleMessage(message);
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
    };

    ws.onerror = () => {
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
    switch (message.type) {
      case 'GAME_STATE':
        const receivedSlot = message.data.your_slot;
        setMySlot(Number(receivedSlot)); // Ensure it's a number
        // Align local gameStatus with server status in case we connected after start
        if (message.data.status === 'IN_PROGRESS') {
          setGameStatus('playing');
        } else if (message.data.status === 'WAITING') {
          setGameStatus('waiting');
        }
        setMyName(message.data.your_name || user?.display_name || 'You');
        setOpponentName(message.data.opponent_name || 'Opponent');
        if (receivedSlot === 1 || receivedSlot === '1') {
          setMyState(message.data.player1);
          setOpponentState(message.data.player2);
          setMyTimeRemaining(message.data.player1.time_remaining || 90);
          setOpponentTimeRemaining(message.data.player2.time_remaining || 90);
        } else if (receivedSlot === 2 || receivedSlot === '2') {
          setMyState(message.data.player2);
          setOpponentState(message.data.player1);
          setMyTimeRemaining(message.data.player2.time_remaining || 90);
          setOpponentTimeRemaining(message.data.player1.time_remaining || 90);
        }
        break;

      case 'GAME_START':
        const grid = message.data.initial_grid;
        setMyGrid(grid.map((row: number[]) => [...row]));
        setInitialGrid(grid.map((row: number[]) => [...row]));
        // Initialize timers from server
        if (mySlot === 1) {
          setMyTimeRemaining(message.data.player1_time_remaining || 90);
          setOpponentTimeRemaining(message.data.player2_time_remaining || 90);
        } else {
          setMyTimeRemaining(message.data.player2_time_remaining || 90);
          setOpponentTimeRemaining(message.data.player1_time_remaining || 90);
        }
        setGameStatus('playing');
        break;

      case 'MOVE_RESULT':
        const { player_id, slot, row, col, value, correct, time_change, player_state, game_ended, timer_update } = message.data;
        const myPlayerId = user?.id;

        // Prefer authoritative identity by player_id (player_profiles.id) from backend
        const isMyMoveById = myPlayerId != null && player_id === myPlayerId;
        const isMyMoveBySlot = slot === mySlot;
        const isMyMove = myPlayerId != null ? isMyMoveById : isMyMoveBySlot;

        if (isMyMove) {
          // Update MY grid and state
          if (correct) {
            // Correct move: update grid
            setMyGrid((prev) => {
              const newGrid = prev.map((r) => [...r]);
              newGrid[row][col] = value;
              return newGrid;
            });
            setTimeChange(time_change || 3); // +3 seconds
          } else {
            // Incorrect move: revert cell to empty (server already did this, but ensure UI matches)
            setMyGrid((prev) => {
              const newGrid = prev.map((r) => [...r]);
              newGrid[row][col] = 0;
              return newGrid;
            });
            setTimeChange(time_change || -15); // -15 seconds
          }
          setMyState(player_state);
          if (player_state.time_remaining !== undefined) {
            setMyTimeRemaining(player_state.time_remaining);
          }
          setLastMoveResult({ correct, row, col });
          
          // Clear time change feedback after 2 seconds
          setTimeout(() => setTimeChange(null), 2000);
        } else {
          // Update opponent state only (not their grid - we can't see it!)
          setOpponentState(player_state);
          if (player_state.time_remaining !== undefined) {
            setOpponentTimeRemaining(player_state.time_remaining);
          }
          // Show opponent move feedback (short, non-sticky)
          setOpponentMoveFeedback({ correct });
          // Clear any existing timeout before setting a new one
          if (opponentFeedbackTimeoutRef.current !== null) {
            clearTimeout(opponentFeedbackTimeoutRef.current);
          }
          opponentFeedbackTimeoutRef.current = window.setTimeout(() => {
            setOpponentMoveFeedback(null);
            opponentFeedbackTimeoutRef.current = null;
          }, 1200); // ~1.2s so it feels snappy
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
        
        // Check if game ended - trigger end game handling immediately
        if (game_ended) {
          console.log(`[GamePage] Game ended from MOVE_RESULT, waiting for GAME_END message`);
          // The GAME_END message will be sent by the backend, but we can prepare for it
        }
        break;

      case 'TIME_SYNC':
        // Update both timers and lock status from server
        // Don't update state if mySlot hasn't been set yet (wait for GAME_STATE)
        if (mySlot === 0) {
          console.log(`[GamePage] TIME_SYNC ignored: mySlot not set yet (waiting for GAME_STATE)`);
          break;
        }
        
        console.log(`[GamePage] TIME_SYNC received: player1_locked=${message.data.player1_locked}, player2_locked=${message.data.player2_locked}, mySlot=${mySlot}`);
        if (mySlot === 1) {
          setMyTimeRemaining(message.data.player1_time);
          setOpponentTimeRemaining(message.data.player2_time);
          setMyState(prev => {
            const newState = {
              ...prev,
              is_locked: message.data.player1_locked,
              score: message.data.player1_score !== undefined ? message.data.player1_score : prev.score,
              cells_completed: message.data.player1_cells_completed !== undefined ? message.data.player1_cells_completed : prev.cells_completed,
            };
            console.log(`[GamePage] Updating myState (slot 1): is_locked=${newState.is_locked}, score=${newState.score}, cells_completed=${newState.cells_completed}`);
            return newState;
          });
          setOpponentState(prev => ({
            ...prev,
            is_locked: message.data.player2_locked,
            score: message.data.player2_score !== undefined ? message.data.player2_score : prev.score,
            cells_completed: message.data.player2_cells_completed !== undefined ? message.data.player2_cells_completed : prev.cells_completed,
          }));
        } else if (mySlot === 2) {
          setMyTimeRemaining(message.data.player2_time);
          setOpponentTimeRemaining(message.data.player1_time);
          setMyState(prev => {
            const newState = {
              ...prev,
              is_locked: message.data.player2_locked,
              score: message.data.player2_score !== undefined ? message.data.player2_score : prev.score,
              cells_completed: message.data.player2_cells_completed !== undefined ? message.data.player2_cells_completed : prev.cells_completed,
            };
            console.log(`[GamePage] Updating myState (slot 2): is_locked=${newState.is_locked}, score=${newState.score}, cells_completed=${newState.cells_completed}`);
            return newState;
          });
          setOpponentState(prev => ({
            ...prev,
            is_locked: message.data.player1_locked,
            score: message.data.player1_score !== undefined ? message.data.player1_score : prev.score,
            cells_completed: message.data.player1_cells_completed !== undefined ? message.data.player1_cells_completed : prev.cells_completed,
          }));
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
        // Refresh user profile/rating so Lobby shows updated rating without full reload
        refreshUser().catch((err) => {
          console.error('Failed to refresh user after GAME_END:', err);
        });
        break;
    }
  };

  const handleCellClick = (row: number, col: number) => {
    if (gameStatus !== 'playing' || myState?.is_locked) {
      console.log(`[GamePage] Cell click blocked: gameStatus=${gameStatus}, is_locked=${myState?.is_locked}`);
      return;
    }

    // Check if cell is an initial clue - allow clicking for highlighting but log it
    const isInitial = initialGrid[row]?.[col] !== 0;
    if (isInitial) {
      console.log(`[GamePage] Clicked initial clue cell (${row}, ${col}) - allowing for highlighting`);
    }

    // If tapping the same cell again, clear selection/highlights
    if (selectedCell && selectedCell.row === row && selectedCell.col === col) {
      setSelectedCell(null);
      return;
    }

    // Select the cell (whether empty or has a number)
    // SudokuGrid will handle highlighting based on whether selected cell has a value
    // CRITICAL: This preserves the UX feature where clicking a cell with a number
    // highlights all identical numbers and related cells (row/column/3x3 box)
    console.log(`[GamePage] Selecting cell (${row}, ${col}), current value: ${myGrid[row]?.[col]}, isInitial: ${isInitial}`);
    setSelectedCell({ row, col });
  };

  const handleBackClick = () => {
    if (gameStatus === 'playing') {
      // Active game – confirm forfeit
      setShowForfeitModal(true);
    } else {
      // Game already ended or not started – safe to leave
      onGameEnd();
    }
  };

  const handleForfeit = () => {
    if (wsRef.current && gameStatus === 'playing') {
      wsRef.current.send(JSON.stringify({ type: 'FORFEIT' }));
    }
    setShowForfeitModal(false);
  };

  const handleNumberClick = (num: number) => {
    if (!selectedCell || gameStatus !== 'playing') {
      console.log(`[GamePage] Number click blocked: selectedCell=${!!selectedCell}, gameStatus=${gameStatus}`);
      return;
    }
    if (myState?.is_locked) {
      console.log(`[GamePage] Number click blocked: myState.is_locked=${myState.is_locked}, myState.score=${myState.score}, opponentState.is_locked=${opponentState.is_locked}, opponentState.score=${opponentState.score}`);
      return;
    }

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
      // Prevent placing numbers in initial clue cells
      if (initialGrid[selectedCell.row]?.[selectedCell.col] !== 0) {
        return;
      }
      
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
    if (!selectedCell || gameStatus !== 'playing' || myState?.is_locked) return;
    
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

  // Keep local rating in sync when user updates (e.g., after refreshUser)
  useEffect(() => {
    if (user?.rating !== undefined) {
      setMyRating(user.rating);
    }
  }, [user]);

  // Compute digit counts for number pad depletion styling (purely visual)
  const digitCounts: Record<number, number> = {};
  myGrid.forEach((row) => {
    row.forEach((value) => {
      if (value >= 1 && value <= 9) {
        digitCounts[value] = (digitCounts[value] || 0) + 1;
      }
    });
  });

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

    // Determine result based on winner_slot and reason
    const winnerSlot = gameResult.winner_slot;
    const reason = gameResult.reason || 'DRAW';
    const isDraw = winnerSlot === null || reason === 'DRAW';
    
    // Determine if I won based on winner_slot
    const didWin = winnerSlot !== null && winnerSlot === mySlot;
    const ratingChange = myResult.rating_change || 0;
    const myScore = myResult.score || 0;
    const opponentScore = opponentResult.score || 0;

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
              {isDraw ? '🤝 Draw!' : didWin ? '🏆 VICTORY!' : 'DEFEAT'}
            </h1>
            
          {/* Win reason / subtitle */}
          <p className="text-gray-300 text-sm sm:text-base">
            {reason === 'FORFEIT' && (didWin ? 'Win by forfeit' : 'Defeat by forfeit')}
            {reason === 'PUZZLE_SOLVED' && didWin && '✨ You completed the puzzle!'}
            {reason === 'PUZZLE_SOLVED' && !didWin && '⚡ Opponent completed the puzzle'}
            {reason === 'TIMEOUT_SCORE' && didWin && '🎯 Higher score at timeout!'}
            {reason === 'TIMEOUT_SCORE' && !didWin && '⏱️ Lower score at timeout'}
            {reason === 'DRAW' && 'Equal scores'}
          </p>
          </div>

          {/* Score comparison */}
          <div className="flex justify-center gap-8 mb-6">
            <div>
              <div className="text-sm text-gray-500">You</div>
              <div className="text-3xl font-bold text-gray-800">{myScore}</div>
            </div>
            <div className="text-2xl text-gray-300 self-center">—</div>
            <div>
              <div className="text-sm text-gray-500">Opponent</div>
              <div className="text-3xl font-bold text-gray-800">{opponentScore}</div>
            </div>
          </div>

          {/* Stats comparison */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
            <div className={`bg-gray-700 rounded-lg p-3 sm:p-4 border-2 ${
              didWin ? 'border-green-500' : isDraw ? 'border-yellow-500' : 'border-gray-600'
            }`}>
              <p className="text-blue-400 font-bold mb-2 text-sm sm:text-base">You</p>
              <div className="space-y-1 text-xs sm:text-sm">
                <p className="text-white">📊 Score: {myScore}</p>
                <p className="text-white">❌ {myResult.mistakes || 0} mistakes</p>
                <p className="text-white">⏱️ {formatTime(myResult.timeRemaining || 0)} remaining</p>
              </div>
            </div>
            <div className={`bg-gray-700 rounded-lg p-3 sm:p-4 border-2 ${
              !didWin && !isDraw ? 'border-red-500' : isDraw ? 'border-yellow-500' : 'border-gray-600'
            }`}>
              <p className="text-red-400 font-bold mb-2 text-sm sm:text-base">Opponent</p>
              <div className="space-y-1 text-xs sm:text-sm">
                <p className="text-white">📊 Score: {opponentScore}</p>
                <p className="text-white">❌ {opponentResult.mistakes || 0} mistakes</p>
                <p className="text-white">⏱️ {formatTime(opponentResult.timeRemaining || 0)} remaining</p>
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

  // Calculate status message based on score (not cells_completed)
  const scoreDiff = myState.score - opponentState.score;
  let statusMessage = 'Neck and neck!';
  let statusColor = 'text-gray-600';
  
  if (gameStatus === 'playing') {
    // Priority 1: Opponent move feedback (highest priority for visibility)
    if (opponentMoveFeedback) {
      if (opponentMoveFeedback.correct) {
        statusMessage = `🎯 ${opponentName} scored a cell!`;
        statusColor = 'text-green-500';
      } else {
        statusMessage = `❌ ${opponentName} made a mistake!`;
        statusColor = 'text-red-500';
      }
    }
    // Priority 2: My move feedback
    else if (lastMoveResult && lastMoveResult.correct === false) {
      statusMessage = '❌ Mistake! -15 seconds';
      statusColor = 'text-red-500';
    } else if (lastMoveResult && lastMoveResult.correct === true) {
      statusMessage = '✓ Correct! +3 seconds';
      statusColor = 'text-green-500';
    }
    // Priority 3: Lockout states
    else if (myState.is_locked) {
      statusMessage = "⏱️ You're locked! Watching opponent...";
      statusColor = 'text-gray-500';
    } else if (opponentState.is_locked) {
      statusMessage = '🔥 Opponent locked! Keep going!';
      statusColor = 'text-green-600';
    }
    // Priority 4: Low time warning
    else if (myTimeRemaining < 30) {
      statusMessage = '⚠️ Low time! Play carefully';
      statusColor = 'text-orange-500';
    }
    // Priority 5: Score comparison
    else if (scoreDiff > 0) {
      statusMessage = `You're ahead by ${scoreDiff} cell${scoreDiff > 1 ? 's' : ''}! 🔥`;
      statusColor = 'text-green-600';
    } else if (scoreDiff < 0) {
      const diff = Math.abs(scoreDiff);
      statusMessage = `Opponent leads by ${diff} cell${diff > 1 ? 's' : ''}`;
      statusColor = 'text-orange-500';
    }
  }

  // Main game UI
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col p-4">
      {/* Top Utility Bar */}
      <div className="w-full max-w-lg mx-auto mb-4 flex justify-between items-center">
        <button
          onClick={handleBackClick}
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
        {/* You */}
        <div className="bg-blue-900/50 rounded-lg p-2 sm:p-3 flex-1 min-w-0">
          <div className="flex items-center justify-between text-[11px] sm:text-xs">
            <div className="flex flex-col items-start truncate mr-2">
              <span className="text-blue-300 font-semibold truncate">{myName}</span>
              {myRating !== undefined && (
                <span className="text-blue-200 text-[10px] sm:text-xs">⭐ {Math.round(myRating)}</span>
              )}
            </div>
            <span
              className={`font-mono font-bold text-sm sm:text-base ${
                myTimeRemaining < 60 ? 'text-red-400' : 'text-white'
              }`}
            >
              {formatTime(myTimeRemaining)}
            </span>
          </div>
          {/* Progress bar - based on score (max ~50 player-solved cells) */}
          <div className="mt-1 h-1.5 rounded-full bg-blue-950/60 overflow-hidden">
            <div
              className="h-full bg-blue-400 transition-all duration-300"
              style={{ width: `${Math.min(100, (myState.score / 50) * 100)}%` }}
            />
          </div>
          <p className="text-white font-bold text-[11px] sm:text-xs mt-1 flex items-center justify-between">
            <span>📊 Score: {myState.score}</span>
            {scoreDiff > 0 && <span className="text-green-400 text-xs">▲</span>}
          </p>
          {myState.is_locked && (
            <p className="text-red-400 text-[11px] mt-1">OUT OF TIME</p>
          )}
        </div>
        
        {/* Opponent */}
        <div className="bg-red-900/50 rounded-lg p-2 sm:p-3 text-right flex-1 min-w-0">
          <div className="flex items-center justify-between text-[11px] sm:text-xs">
            <span
              className={`font-mono font-bold text-sm sm:text-base ${
                opponentTimeRemaining < 60 ? 'text-red-400' : 'text-white'
              }`}
            >
              {formatTime(opponentTimeRemaining)}
            </span>
            <div className="flex flex-col items-end truncate ml-2">
              <span className="text-red-300 font-semibold truncate">{opponentName}</span>
            </div>
          </div>
          {/* Opponent progress bar */}
          <div className="mt-1 h-1.5 rounded-full bg-red-950/60 overflow-hidden">
            <div
              className="h-full bg-red-400 transition-all duration-300"
              style={{ width: `${Math.min(100, (opponentState.score / 50) * 100)}%` }}
            />
          </div>
          <p className="text-white font-bold text-[11px] sm:text-xs mt-1 flex items-center justify-between">
            <span>📊 Score: {opponentState.score}</span>
            {scoreDiff < 0 && <span className="text-red-400 text-xs">▼</span>}
          </p>
          {opponentState.is_locked && (
            <p className="text-green-400 text-[11px] mt-1">LOCKED</p>
          )}
        </div>
      </div>

      {/* Status Strip */}
      <div className={`w-full max-w-lg mb-2 text-center py-2 text-sm font-medium ${statusColor} bg-gray-50`}>
        {statusMessage}
      </div>

      {/* Time change feedback */}
      {timeChange !== null && (
        <div className={`text-center py-1 mb-2 ${
          timeChange > 0 ? 'text-green-500' : 'text-red-500'
        } font-semibold`}>
          {timeChange > 0 ? `+${timeChange}s` : `${timeChange}s`}
        </div>
      )}

      {/* Sudoku Grid - Centered */}
      <div className="flex-1 flex items-center justify-center">
        <div className={`relative ${myState.is_locked ? 'pointer-events-none' : ''}`}>
          {myGrid.length > 0 && (
            <SudokuGrid
              grid={myGrid}
              initialGrid={initialGrid}
              selectedCell={selectedCell}
              onCellClick={handleCellClick}
              notes={notes}
              notesMode={notesMode}
              lockedOut={myState.is_locked}
              lastMoveResult={lastMoveResult}
            />
          )}
        </div>
      </div>


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
        disabled={gameStatus !== 'playing' || myState.is_locked}
        digitCounts={digitCounts}
      />

      {/* Forfeit confirmation modal */}
      <ForfeitModal
        isOpen={showForfeitModal}
        onConfirm={handleForfeit}
        onCancel={() => setShowForfeitModal(false)}
      />
    </div>
  );
}
