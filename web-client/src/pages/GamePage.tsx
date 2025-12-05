import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGameSounds } from '../hooks/useGameSounds';
import SudokuGrid from '../components/SudokuGrid';
import { ForfeitModal } from '../components/ForfeitModal';
import { createGameSocket } from '../config';
import { STARTING_TIME_SECONDS } from '../constants';
import { useMobileDetect } from '../hooks/useMobileDetect';

const EMOTES = ['🖕', '🍆🤏', '🤣🫵', '🍑'];
const EMOTE_DISPLAY_DURATION = 2000; // 2 seconds
const EMOTE_PICKER_DURATION = 3000; // 3 seconds

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
  const { isCapacitor } = useMobileDetect();
  const wsRef = useRef<WebSocket | null>(null);
  const { playCorrectSound, playIncorrectSound, resetStreak, initAudio } = useGameSounds();
  
  const [myGrid, setMyGrid] = useState<number[][]>([]);
  const [initialGrid, setInitialGrid] = useState<number[][]>([]);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [myState, setMyState] = useState<PlayerState>({ score: 0, cells_completed: 0, time_remaining: STARTING_TIME_SECONDS, is_locked: false, is_solved: false });
  const [opponentState, setOpponentState] = useState<PlayerState>({ score: 0, cells_completed: 0, time_remaining: STARTING_TIME_SECONDS, is_locked: false, is_solved: false });
  const [mySlot, setMySlot] = useState<number>(0);
  const mySlotRef = useRef<number>(0);
  const [gameStatus, setGameStatus] = useState<'connecting' | 'waiting' | 'playing' | 'ended'>('connecting');
  const [myTimeRemaining, setMyTimeRemaining] = useState(STARTING_TIME_SECONDS);
  const [opponentTimeRemaining, setOpponentTimeRemaining] = useState(STARTING_TIME_SECONDS);
  const [gameResult, setGameResult] = useState<any>(null);
  const [lastMoveResult, setLastMoveResult] = useState<{ correct: boolean; row: number; col: number } | null>(null);
  const [showForfeitModal, setShowForfeitModal] = useState(false);
  const [showEmotePicker, setShowEmotePicker] = useState(false);
  const [myEmote, setMyEmote] = useState<string | null>(null);
  const [opponentEmote, setOpponentEmote] = useState<string | null>(null);
  const [myEmoteFadingOut, setMyEmoteFadingOut] = useState(false);
  const [opponentEmoteFadingOut, setOpponentEmoteFadingOut] = useState(false);
  const emotePickerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myEmoteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opponentEmoteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [notes, setNotes] = useState<Map<string, number[]>>(new Map()); // key: "row-col", value: number[]
  // Connection status removed - no longer displayed in UI
  const [opponentName, setOpponentName] = useState<string>('Opponent');
  const [opponentScoredCells, setOpponentScoredCells] = useState<Set<string>>(new Set());
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [graceTimeRemaining, setGraceTimeRemaining] = useState(0);
  const [myTimerPaused, setMyTimerPaused] = useState(false);
  const [opponentRating, setOpponentRating] = useState<number | undefined>(undefined);

  // Connect to WebSocket
  useEffect(() => {
    if (!token) return;
    const ws = createGameSocket(matchId, token);
    wsRef.current = ws;

    ws.onopen = () => {
      setGameStatus('waiting');
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleMessage(message);
    };

    ws.onclose = () => {
      // Connection closed
    };

    ws.onerror = () => {
      // Connection error
    };

    return () => {
      ws.close();
      // Clean up emote timeouts
      if (emotePickerTimeoutRef.current) clearTimeout(emotePickerTimeoutRef.current);
      if (myEmoteTimeoutRef.current) clearTimeout(myEmoteTimeoutRef.current);
      if (opponentEmoteTimeoutRef.current) clearTimeout(opponentEmoteTimeoutRef.current);
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
        mySlotRef.current = Number(receivedSlot);
        // Align local gameStatus with server status in case we connected after start
        if (message.data.status === 'IN_PROGRESS') {
          setGameStatus('playing');
        } else if (message.data.status === 'WAITING') {
          setGameStatus('waiting');
        }
        setOpponentName(message.data.opponent_name || 'Opponent');
        if (receivedSlot === 1 || receivedSlot === '1') {
          setMyState(message.data.player1);
          setOpponentState(message.data.player2);
          setMyTimeRemaining(message.data.player1.time_remaining || STARTING_TIME_SECONDS);
          setOpponentTimeRemaining(message.data.player2.time_remaining || STARTING_TIME_SECONDS);
          setOpponentRating(message.data.opponent_rating);
        } else if (receivedSlot === 2 || receivedSlot === '2') {
          setMyState(message.data.player2);
          setOpponentState(message.data.player1);
          setMyTimeRemaining(message.data.player2.time_remaining || STARTING_TIME_SECONDS);
          setOpponentTimeRemaining(message.data.player1.time_remaining || STARTING_TIME_SECONDS);
          setOpponentRating(message.data.opponent_rating);
        }
        break;

      case 'GAME_START':
        initAudio();
        resetStreak();
        const grid = message.data.initial_grid;
        setMyGrid(grid.map((row: number[]) => [...row]));
        setInitialGrid(grid.map((row: number[]) => [...row]));
        // Initialize timers from server (use mySlotRef to avoid stale closure)
        if (mySlotRef.current === 1) {
          setMyTimeRemaining(message.data.player1_time_remaining || STARTING_TIME_SECONDS);
          setOpponentTimeRemaining(message.data.player2_time_remaining || STARTING_TIME_SECONDS);
        } else {
          setMyTimeRemaining(message.data.player2_time_remaining || STARTING_TIME_SECONDS);
          setOpponentTimeRemaining(message.data.player1_time_remaining || STARTING_TIME_SECONDS);
        }
        setGameStatus('playing');
        break;

      case 'MOVE_RESULT':
        const { player_id, slot, row, col, value, correct, player_state, game_ended, timer_update } = message.data;
        const myPlayerId = user?.id;

        // Prefer authoritative identity by player_id (player_profiles.id) from backend
        const isMyMoveById = myPlayerId != null && player_id === myPlayerId;
        const isMyMoveBySlot = slot === mySlotRef.current;
        const isMyMove = myPlayerId != null ? isMyMoveById : isMyMoveBySlot;

        if (isMyMove) {
          // Update MY grid and state
          if (correct) {
            // Correct move: update grid
            playCorrectSound();
            setMyGrid((prev) => {
              const newGrid = prev.map((r) => [...r]);
              newGrid[row][col] = value;
              return newGrid;
            });
          } else {
            // Incorrect move: revert cell to empty (server already did this, but ensure UI matches)
            playIncorrectSound();
            setMyGrid((prev) => {
              const newGrid = prev.map((r) => [...r]);
              newGrid[row][col] = 0;
              return newGrid;
            });
          }
          setMyState(player_state);
          setLastMoveResult({ correct, row, col });
          
          // Remove from opponent scored cells if player scores it (reclaimed)
          if (correct) {
            const cellKey = `${row}-${col}`;
            setOpponentScoredCells((prev) => {
              const newSet = new Set(prev);
              newSet.delete(cellKey);
              return newSet;
            });
          }
        } else {
          // Update opponent state only (not their grid - we can't see it!)
          setOpponentState(player_state);
          
          // Track opponent's scored cells
          if (correct) {
            const cellKey = `${row}-${col}`;
            setOpponentScoredCells((prev) => {
              // Only add if it's a new cell (not already in the set)
              // This prevents re-animating cells that were already highlighted
              if (!prev.has(cellKey)) {
                const newSet = new Set(prev);
                newSet.add(cellKey);
                return newSet;
              }
              return prev;
            });
          }
        }

        // Update timers from timer_update (authoritative source for both players)
        // This ensures both timers are synchronized correctly
        if (timer_update) {
          if (mySlotRef.current === 1) {
            setMyTimeRemaining(timer_update.player1_time_remaining);
            setOpponentTimeRemaining(timer_update.player2_time_remaining);
          } else if (mySlotRef.current === 2) {
            setMyTimeRemaining(timer_update.player2_time_remaining);
            setOpponentTimeRemaining(timer_update.player1_time_remaining);
          }
        } else {
          // Fallback: if timer_update not provided, use player_state.time_remaining
          // (This should rarely happen, but provides a safety net)
          if (isMyMove && player_state.time_remaining !== undefined) {
            setMyTimeRemaining(player_state.time_remaining);
          } else if (!isMyMove && player_state.time_remaining !== undefined) {
            setOpponentTimeRemaining(player_state.time_remaining);
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
        if (mySlotRef.current === 0) {
          console.log(`[GamePage] TIME_SYNC ignored: mySlot not set yet (waiting for GAME_STATE)`);
          break;
        }
        
        console.log(`[GamePage] TIME_SYNC received: player1_locked=${message.data.player1_locked}, player2_locked=${message.data.player2_locked}, mySlot=${mySlotRef.current}`);
        if (mySlotRef.current === 1) {
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
        } else if (mySlotRef.current === 2) {
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
        setOpponentDisconnected(false);
        setGraceTimeRemaining(0);
        setMyTimerPaused(false);
        // Refresh user profile/rating so Lobby shows updated rating without full reload
        refreshUser().catch((err) => {
          console.error('Failed to refresh user after GAME_END:', err);
        });
        break;

      case 'OPPONENT_DISCONNECTED':
        setOpponentDisconnected(true);
        setGraceTimeRemaining(message.data.grace_period_seconds);
        setMyTimerPaused(message.data.your_timer_paused);
        break;

      case 'OPPONENT_RECONNECTED':
        setOpponentDisconnected(false);
        setGraceTimeRemaining(0);
        setMyTimerPaused(false);
        break;

      case 'GRACE_PERIOD_UPDATE':
        setGraceTimeRemaining(message.data.seconds_remaining);
        break;

      case 'EMOTE':
        // Clear any existing opponent emote timeout
        if (opponentEmoteTimeoutRef.current) {
          clearTimeout(opponentEmoteTimeoutRef.current);
        }
        
        // Reset fade-out state
        setOpponentEmoteFadingOut(false);
        
        setOpponentEmote(message.data.emote);
        
        // Start fade-out after 2 seconds, then hide after animation completes
        opponentEmoteTimeoutRef.current = setTimeout(() => {
          setOpponentEmoteFadingOut(true);
          setTimeout(() => {
            setOpponentEmote(null);
            setOpponentEmoteFadingOut(false);
          }, 200); // Match fade-out animation duration
        }, EMOTE_DISPLAY_DURATION);
        break;
    }
  };

  const handleClaimWin = () => {
    if (wsRef.current && opponentDisconnected) {
      wsRef.current.send(JSON.stringify({ type: 'CLAIM_DISCONNECT_WIN' }));
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

  // Back button removed - forfeit can be accessed via other means if needed
  // const handleBackClick = () => { ... }

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

  // Rating no longer displayed in player info bar (removed)

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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <div className="text-gray-800 text-lg">Connecting to game...</div>
        </div>
      </div>
    );
  }

  // Waiting for opponent
  if (gameStatus === 'waiting') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <div className="text-gray-800 text-lg mb-1">Waiting for opponent</div>
          <div className="text-gray-500 text-sm">Please wait...</div>
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
    // Use cells_completed (includes pre-completed squares) instead of score
    const myScore = myResult.cellsCompleted || myResult.cells_completed || myResult.score || 0;
    const opponentScore = opponentResult.cellsCompleted || opponentResult.cells_completed || opponentResult.score || 0;

    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 sm:p-8 text-center max-w-md w-full shadow-lg border border-gray-200">
          {/* Result Header */}
          <div className="mb-6">
            <h1 className={`text-4xl sm:text-5xl font-bold mb-2 ${
              isDraw ? 'text-gray-600' : didWin ? 'text-green-500' : 'text-gray-800'
            }`}>
              {isDraw ? '🤝 Draw!' : didWin ? '🏆 VICTORY!' : 'DEFEAT'}
            </h1>
            
            {/* Win reason / subtitle */}
            <p className="text-gray-600 text-sm sm:text-base">
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
              <div className="text-3xl font-bold text-gray-800 font-mono">{myScore}/81</div>
            </div>
            <div className="text-2xl text-gray-300 self-center">—</div>
            <div>
              <div className="text-sm text-gray-500">Opponent</div>
              <div className="text-3xl font-bold text-gray-800 font-mono">{opponentScore}/81</div>
            </div>
          </div>

          {/* Stats comparison */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
            <div className={`bg-gray-50 rounded-lg p-3 sm:p-4 border ${
              didWin ? 'border-green-500' : isDraw ? 'border-gray-300' : 'border-gray-200'
            }`}>
              <p className="text-blue-500 font-bold mb-2 text-sm sm:text-base">You</p>
              <div className="space-y-1 text-xs sm:text-sm text-gray-600">
                <p>Score: <span className="font-mono font-bold">{myScore}/81</span></p>
                <p>Mistakes: <span className="font-mono">{myResult.mistakes || 0}</span></p>
                <p>Time: <span className="font-mono">{formatTime(myResult.timeRemaining || 0)}</span></p>
              </div>
            </div>
            <div className={`bg-gray-50 rounded-lg p-3 sm:p-4 border ${
              !didWin && !isDraw ? 'border-red-500' : isDraw ? 'border-gray-300' : 'border-gray-200'
            }`}>
              <p className="text-gray-600 font-bold mb-2 text-sm sm:text-base">Opponent</p>
              <div className="space-y-1 text-xs sm:text-sm text-gray-600">
                <p>Score: <span className="font-mono font-bold">{opponentScore}/81</span></p>
                <p>Mistakes: <span className="font-mono">{opponentResult.mistakes || 0}</span></p>
                <p>Time: <span className="font-mono">{formatTime(opponentResult.timeRemaining || 0)}</span></p>
              </div>
            </div>
          </div>

          {/* Rating change - Prominent */}
          <div className={`bg-gray-50 rounded-lg p-4 sm:p-5 mb-6 border ${
            ratingChange > 0 
              ? 'border-green-500' 
              : ratingChange < 0
              ? 'border-red-500'
              : 'border-gray-200'
          }`}>
            <p className="text-gray-600 mb-2 text-sm sm:text-base font-medium">Rating Change</p>
            <div className="flex items-center justify-center gap-2 sm:gap-3">
              <span className="text-xl sm:text-2xl font-bold text-gray-800 font-mono">
                {Math.round(myResult.rating_before || 1500)}
              </span>
              <span className="text-gray-400 text-lg sm:text-xl">→</span>
              <span className="text-2xl sm:text-3xl font-bold text-gray-800 font-mono">
                {Math.round(myResult.rating_after || 1500)}
              </span>
              <span className={`text-xl sm:text-2xl font-bold font-mono ${
                ratingChange > 0 ? 'text-green-500' : ratingChange < 0 ? 'text-red-500' : 'text-gray-400'
              }`}>
                ({ratingChange > 0 ? '+' : ''}{Math.round(ratingChange)})
              </span>
            </div>
          </div>

          <button
            onClick={onGameEnd}
            className="w-full py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 active:bg-blue-700 transition-colors text-base sm:text-lg"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  // Handle emote button
  const handleEmote = () => {
    // Toggle emote picker
    if (showEmotePicker) {
      setShowEmotePicker(false);
      if (emotePickerTimeoutRef.current) {
        clearTimeout(emotePickerTimeoutRef.current);
      }
    } else {
      setShowEmotePicker(true);
      // Auto-hide after 3 seconds
      emotePickerTimeoutRef.current = setTimeout(() => {
        setShowEmotePicker(false);
      }, EMOTE_PICKER_DURATION);
    }
  };

  const handleSelectEmote = (emote: string) => {
    // Hide picker
    setShowEmotePicker(false);
    if (emotePickerTimeoutRef.current) {
      clearTimeout(emotePickerTimeoutRef.current);
    }

    // Reset fade-out state
    setMyEmoteFadingOut(false);
    
    // Show my emote locally
    setMyEmote(emote);
    
    // Clear any existing timeout
    if (myEmoteTimeoutRef.current) {
      clearTimeout(myEmoteTimeoutRef.current);
    }
    
    // Start fade-out after 2 seconds, then hide after animation completes
    myEmoteTimeoutRef.current = setTimeout(() => {
      setMyEmoteFadingOut(true);
      setTimeout(() => {
        setMyEmote(null);
        setMyEmoteFadingOut(false);
      }, 200); // Match fade-out animation duration
    }, EMOTE_DISPLAY_DURATION);

    // Send to opponent via WebSocket
    wsRef.current?.send(JSON.stringify({
      type: 'EMOTE',
      data: { emote },
    }));
  };

  // Main game UI - Compact layout with header above grid
  return (
    <div className="min-h-screen bg-white flex flex-col relative" style={{ paddingTop: '0px', paddingBottom: '0px' }}>
      {/* Disconnect Banner */}
      {opponentDisconnected && (
        <div className="absolute inset-x-0 z-50 mx-4" style={{ top: isCapacitor ? '64px' : '64px' }}>
          <div className="bg-amber-500 text-white rounded-lg p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">Opponent disconnected</p>
                <p className="text-sm opacity-90">
                  Waiting {graceTimeRemaining}s for reconnection...
                </p>
                <p className="text-xs opacity-75 mt-1">Your timer is paused</p>
              </div>
              <button
                onClick={handleClaimWin}
                className="bg-white text-amber-600 px-4 py-2 rounded-lg font-semibold hover:bg-amber-50 transition-colors"
              >
                Claim Win
              </button>
            </div>
            {/* Progress bar showing grace period */}
            <div className="mt-3 h-1 bg-amber-400 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-1000"
                style={{ width: `${(graceTimeRemaining / 30) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Header Section - Push down significantly more */}
      <div className="flex-shrink-0" style={{ marginTop: '48px', paddingBottom: '0px' }}>
        {/* Settings button - top right, below safe area */}
        <div className="flex justify-end px-3 sm:px-4" style={{ paddingTop: '0px', paddingBottom: '4px' }}>
          <button
            onClick={() => setShowForfeitModal(true)}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Names and Scores - Compact header, reduced spacing */}
        <div className="px-3 sm:px-4" style={{ paddingTop: '0px', paddingBottom: '4px', marginTop: isCapacitor ? '4px' : '0px' }}>
          {/* Row 1: Names + ELO inline */}
          <div className="flex items-center justify-between" style={{ marginBottom: '3px' }}>
            {/* Left: Player */}
            <div className="flex items-center gap-2">
              <div className="text-lg sm:text-xl font-bold text-blue-500">{user?.display_name || 'You'}</div>
              <div className="text-xs sm:text-sm text-gray-500 font-mono">{Math.round(user?.rating || 1500)}</div>
            </div>
            {/* Right: Opponent */}
            <div className="flex items-center gap-2">
              <div className="text-lg sm:text-xl font-bold text-fuchsia-500">{opponentName}</div>
              <div className="text-xs sm:text-sm text-gray-500 font-mono">
                {opponentRating !== undefined ? Math.round(opponentRating) : '—'}
              </div>
            </div>
          </div>
          
          {/* Row 2: Cells completed (no spaces) */}
          <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
            {/* Left: Player score */}
            <div className="text-sm sm:text-base font-mono text-gray-700">
              {myState.cells_completed}/81
            </div>
            {/* Right: Opponent score */}
            <div className="text-sm sm:text-base font-mono text-gray-700">
              {opponentState.cells_completed}/81
            </div>
          </div>
        </div>

        {/* Timer boxes - Just above the border line, reduced spacing */}
        <div className="px-3 sm:px-4 border-b border-gray-200 relative" style={{ paddingTop: '0px', paddingBottom: '6px', marginTop: isCapacitor ? '8px' : '0px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '0px' }}>
            {/* Left: Player timer */}
            <div className="relative flex items-center gap-2">
              <div className={`px-1 py-0.5 rounded-lg border-2 ${myTimeRemaining < 30 ? 'bg-red-500/20 border-red-500' : 'bg-blue-500/20 border-blue-500'} ${myTimerPaused ? 'opacity-50' : ''}`}>
                <div className={`text-xl sm:text-2xl font-mono font-bold ${myTimeRemaining < 30 ? 'text-red-500' : 'text-blue-500'}`}>
                  {formatTime(myTimeRemaining)}
                  {myTimerPaused && <span className="ml-2 text-sm">⏸</span>}
                </div>
              </div>
              {/* Player emote - positioned to the right of timer */}
              {myEmote && (
                <div 
                  className={`text-xl sm:text-2xl pointer-events-none ${myEmoteFadingOut ? 'animate-fade-out' : 'animate-fade-in'}`}
                  key={myEmote}
                  style={{ 
                    zIndex: 10, 
                    lineHeight: '1',
                    whiteSpace: 'nowrap',
                    display: 'inline-block',
                    letterSpacing: '-0.1em'
                  }}
                >
                  {myEmote}
                </div>
              )}
            </div>
            {/* Right: Opponent timer */}
            <div className="relative flex items-center gap-2">
              {/* Opponent emote - positioned to the left of timer */}
              {opponentEmote && (
                <div 
                  className={`text-xl sm:text-2xl pointer-events-none ${opponentEmoteFadingOut ? 'animate-fade-out' : 'animate-fade-in'}`}
                  key={opponentEmote}
                  style={{ 
                    zIndex: 10, 
                    lineHeight: '1',
                    whiteSpace: 'nowrap',
                    display: 'inline-block',
                    letterSpacing: '-0.1em'
                  }}
                >
                  {opponentEmote}
                </div>
              )}
              <div className={`px-1 py-0.5 rounded-lg border-2 ${opponentTimeRemaining < 30 ? 'bg-red-500/20 border-red-500' : 'bg-fuchsia-500/20 border-fuchsia-500'}`}>
                <div className={`text-xl sm:text-2xl font-mono font-bold ${opponentTimeRemaining < 30 ? 'text-red-500' : 'text-fuchsia-500'}`}>
                  {formatTime(opponentTimeRemaining)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sudoku Grid - Absolutely positioned to center on screen, other elements unaffected */}
      <div className="absolute left-0 right-0 flex justify-center items-center px-2 sm:px-4" style={{ top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
        <div className={`relative w-full max-w-full ${myState.is_locked ? 'pointer-events-none opacity-50' : ''}`} style={{ pointerEvents: 'auto' }}>
          {myGrid.length > 0 && (
            <div className="w-full flex justify-center">
              <SudokuGrid
                grid={myGrid}
                initialGrid={initialGrid}
                selectedCell={selectedCell}
                onCellClick={handleCellClick}
                notes={notes}
                notesMode={notesMode}
                lockedOut={myState.is_locked}
                lastMoveResult={lastMoveResult}
                opponentScoredCells={opponentScoredCells}
              />
            </div>
          )}
        </div>
      </div>
      
      {/* Spacer to maintain layout flow for other elements */}
      <div className="flex-shrink-0" style={{ flex: '1 1 auto', minHeight: '0' }}></div>

      {/* Number Pad (1-9) - Positioned below grid with slightly more white space */}
      <div className="absolute left-0 right-0 px-3 sm:px-4 border-t border-gray-200 bg-white" style={{ top: 'calc(50vh + 230px)', paddingTop: '2px', paddingBottom: '2px' }}>
        <div className="grid grid-cols-9 gap-1.5 sm:gap-2 md:gap-2.5 max-w-md mx-auto">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
            const count = digitCounts[num] || 0;
            const depleted = count >= 9;
            return (
              <button
                key={num}
                onClick={() => handleNumberClick(num)}
                disabled={gameStatus !== 'playing' || myState.is_locked || depleted}
                className={`
                  min-h-[48px] sm:min-h-[56px] rounded-lg transition-colors touch-manipulation font-bold
                  ${depleted
                    ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    : gameStatus !== 'playing' || myState.is_locked
                    ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-50 text-blue-500 hover:bg-blue-100 active:bg-blue-200'
                  }
                `}
                style={{ fontSize: 'clamp(1.125rem, 4.5vw, 1.5rem)' }}
              >
                {num}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toolbar: [Erase] [Emote] [Notes] - Positioned below number pad */}
      <div className="absolute left-0 right-0 flex items-center justify-center gap-2 sm:gap-2 px-3 sm:px-4 border-t border-gray-200" style={{ top: 'calc(50vh + 290px)', paddingTop: '2px', paddingBottom: '4px' }}>
        {/* Erase */}
        <button
          onClick={handleErase}
          disabled={gameStatus !== 'playing' || myState.is_locked}
          className={`
            flex-1 min-h-[40px] sm:min-h-[44px] px-2 sm:px-3 rounded-lg transition-colors text-xs sm:text-sm font-medium
            ${gameStatus !== 'playing' || myState.is_locked
              ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
              : 'bg-gray-50 text-gray-700 hover:bg-gray-100 active:bg-gray-200'
            }
          `}
        >
          Erase
        </button>

        {/* Emote */}
        <button
          onClick={handleEmote}
          disabled={gameStatus !== 'playing' || myState.is_locked}
          className={`
            flex-1 min-h-[40px] sm:min-h-[44px] px-2 sm:px-3 rounded-lg transition-colors text-xs sm:text-sm font-medium
            ${gameStatus !== 'playing' || myState.is_locked
              ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
              : 'bg-gray-50 text-gray-700 hover:bg-gray-100 active:bg-gray-200'
            }
          `}
        >
          Emote
        </button>

        {/* Notes */}
        <button
          onClick={handleToggleNotes}
          disabled={gameStatus !== 'playing' || myState.is_locked}
          className={`
            flex-1 min-h-[40px] sm:min-h-[44px] px-2 sm:px-3 rounded-lg transition-colors text-xs sm:text-sm font-medium relative
            ${gameStatus !== 'playing' || myState.is_locked
              ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
              : notesMode
              ? 'bg-blue-50 text-blue-500 hover:bg-blue-100'
              : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            }
          `}
        >
          Notes
          {notesMode && (
            <span className="absolute -top-1 -right-1 text-xs px-1.5 py-0.5 bg-blue-500 text-white rounded-full font-semibold">ON</span>
          )}
        </button>
      </div>

      {/* Emote Picker - Below toolbar */}
      {showEmotePicker && (
        <div className="absolute left-0 right-0 flex items-center justify-center gap-1 sm:gap-2 px-6 sm:px-8 py-3 bg-gray-50 border-t border-gray-200 animate-fade-in" style={{ top: 'calc(50vh + 340px)' }}>
          {EMOTES.map((emote) => (
            <button
              key={emote}
              onClick={() => handleSelectEmote(emote)}
              className="text-3xl sm:text-4xl p-2 hover:bg-gray-200 active:bg-gray-300 rounded-lg transition-colors touch-manipulation"
              style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1' }}
            >
              <span style={{ display: 'inline', whiteSpace: 'nowrap' }}>{emote}</span>
            </button>
          ))}
        </div>
      )}

      {/* Forfeit confirmation modal */}
      <ForfeitModal
        isOpen={showForfeitModal}
        onConfirm={handleForfeit}
        onCancel={() => setShowForfeitModal(false)}
      />
    </div>
  );
}
