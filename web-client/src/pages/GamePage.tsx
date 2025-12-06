import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGameSounds } from '../hooks/useGameSounds';
import { useHaptics } from '../hooks/useHaptics';
import SudokuGrid from '../components/SudokuGrid';
import { ForfeitModal } from '../components/ForfeitModal';
import { ProgressBar } from '../components/ProgressBar';
import { createGameSocket } from '../config';
import { STARTING_TIME_SECONDS } from '../constants';
import { useMobileDetect } from '../hooks/useMobileDetect';

const EMOTES = ['🖕', '🍆🤏', '🤣🫵', '🍑'];
const EMOTE_DISPLAY_DURATION = 2000; // 2 seconds
const EMOTE_PICKER_DURATION = 3000; // 3 seconds

interface GamePageProps {
  matchId: number;
  onGameEnd: () => void;
  onRematch?: (newMatchId: number) => void;
}

interface PlayerState {
  score: number;              // Cells completed by player (not including initial clues)
  cells_completed: number;    // Total cells filled (including initial clues)
  time_remaining: number;    // Time-as-resource timer
  is_locked: boolean;        // true when timer hits 0
  is_solved: boolean;
}

export default function GamePage({ matchId, onGameEnd, onRematch }: GamePageProps) {
  const { token, user, refreshUser } = useAuth();
  const { isCapacitor } = useMobileDetect();
  const wsRef = useRef<WebSocket | null>(null);
  const { playCorrectSound, playIncorrectSound, resetStreak, initAudio, playVictorySound, playDefeatSound } = useGameSounds();
  const { victory: hapticVictory, bigWin: hapticBigWin, error: hapticError, vibrate } = useHaptics();
  
  // Synchronized feedback function - all feedback fires together
  const triggerScoreFeedback = useCallback((streak: number, row: number, col: number) => {
    const now = performance.now();
    if (import.meta.env.DEV) {
      console.log(`[FEEDBACK] Triggered at ${now}ms for streak ${streak}`);
    }
    
    // 1. Haptic (fires first as it has hardware latency)
    // Use patterns with rhythm - gaps are as important as vibrations
    if (streak >= 8) {
      vibrate([15, 25, 15, 25, 40]); // Triumphant pattern
    } else if (streak >= 5) {
      vibrate([10, 20, 30]); // Building crescendo
    } else if (streak >= 3) {
      vibrate([8, 40, 12]); // Quick double-tap (heartbeat)
    } else {
      vibrate([12, 0, 8]); // Thump with tiny echo
    }
    
    // 2. Sound (no delay)
    playCorrectSound();
    
    // 3. Visual state updates (triggers on next render, but initiated same frame)
    setLastMoveResult({ correct: true, row, col });
    setShowScorePulse(streak >= 5 ? 'intense' : 'normal');
    setTimeout(() => setShowScorePulse('none'), 400);
    
    // 4. Cell pop animation
    setLastScoredCell({ row, col });
    setTimeout(() => setLastScoredCell(null), 300);
    
    // 5. Micro-shake at streak milestones
    if ([3, 5, 8].includes(streak)) {
      setShowMicroShake(true);
      setTimeout(() => setShowMicroShake(false), 150);
    }
    
    // 6. SUPER flash at streak 8
    if (streak === 8) {
      setShowSuperFlash(true);
      setTimeout(() => setShowSuperFlash(false), 600);
    }
  }, [playCorrectSound, vibrate]);
  
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
  
  // Streak system - only track longest streak for display
  const [longestStreak, setLongestStreak] = useState(0);
  const myStreakRef = useRef(0);
  const opponentStreakRef = useRef(0);
  
  // Rematch system
  const [rematchState, setRematchState] = useState<'idle' | 'requested' | 'waiting'>('idle');
  const [rematchCountdown, setRematchCountdown] = useState(10);
  // Rematch series tracking - reserved for future use
  // const [rematchSeries, setRematchSeries] = useState({ wins: 0, losses: 0 });
  
  // Pressure indicators
  const prevScoreDiffRef = useRef<number>(0);
  const [showDefeatOverlay, setShowDefeatOverlay] = useState(false);
  const [displayedRating, setDisplayedRating] = useState<number | null>(null);
  const [showScreenShake, setShowScreenShake] = useState(false);
  
  // Addictive scoring feedback system state
  const [showScorePulse, setShowScorePulse] = useState<'none' | 'normal' | 'intense'>('none');
  const [showMicroShake, setShowMicroShake] = useState(false);
  const [showSuperFlash, setShowSuperFlash] = useState(false);
  const [lastScoredCell, setLastScoredCell] = useState<{ row: number; col: number } | null>(null);
  const [completedCells, setCompletedCells] = useState<Set<string>>(new Set());

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

  // Rating counter animation on game end
  useEffect(() => {
    if (gameStatus === 'ended' && gameResult && gameResult.player1 && gameResult.player2) {
      try {
        const myPlayerId = user?.id;
        const myResult = myPlayerId && gameResult.player1?.playerId === myPlayerId
          ? gameResult.player1
          : myPlayerId && gameResult.player2?.playerId === myPlayerId
          ? gameResult.player2
          : mySlot === 1
          ? gameResult.player1
          : gameResult.player2;
        
        if (!myResult) return;
        
        const ratingBefore = myResult.rating_before || 1500;
        const ratingAfter = myResult.rating_after || 1500;
        const diff = ratingAfter - ratingBefore;
        
        // Initialize displayedRating only once
        if (displayedRating === null) {
          setDisplayedRating(ratingBefore);
        }
        
        if (diff !== 0) {
          const steps = Math.min(Math.abs(diff), 30); // Cap at 30 steps
          const duration = 1000; // 1 second total
          const stepTime = duration / steps;
          const increment = diff > 0 ? Math.ceil(diff / steps) : Math.floor(diff / steps);
          
          let current = ratingBefore;
          const interval = setInterval(() => {
            current += increment;
            if ((diff > 0 && current >= ratingAfter) || (diff < 0 && current <= ratingAfter)) {
              setDisplayedRating(ratingAfter);
              clearInterval(interval);
            } else {
              setDisplayedRating(current);
            }
          }, stepTime);
          
          return () => clearInterval(interval);
        } else {
          setDisplayedRating(ratingAfter);
        }
      } catch (error) {
        console.error('Error in rating counter animation:', error);
      }
    }
  }, [gameStatus, gameResult, user?.id, mySlot]); // Removed displayedRating from dependencies to prevent infinite loop

  // Clear last move result after animation
  useEffect(() => {
    if (lastMoveResult) {
      const timer = setTimeout(() => setLastMoveResult(null), 500);
      return () => clearTimeout(timer);
    }
  }, [lastMoveResult]);

  // PERFORMANCE: Measure DOM paint time after state updates
  useEffect(() => {
    if (import.meta.env.DEV) {
      // Use requestAnimationFrame to measure after paint
      requestAnimationFrame(() => {
        performance.mark('dom-paint-complete');
        const measures = performance.getEntriesByName('number-click-to-state', 'measure');
        if (measures.length > 0) {
          performance.measure('state-to-paint', 'number-click-state-update', 'dom-paint-complete');
          const stateToPaint = performance.getEntriesByName('state-to-paint', 'measure')[0];
          if (stateToPaint && stateToPaint.duration > 16) {
            console.warn(`[PERF] State to paint took ${stateToPaint.duration.toFixed(2)}ms (target: <16ms)`);
          }
        }
      });
    }
  }, [myGrid, selectedCell]);


  // Rematch handlers - defined early to avoid hook ordering issues
  const handleRematchRequest = useCallback(() => {
    console.log('[REMATCH] handleRematchRequest called, state:', rematchState);
    if (!wsRef.current) {
      console.log('[REMATCH] No WebSocket connection');
      return;
    }
    
    // If opponent already requested rematch, accept it by sending REMATCH_REQUEST
    // Backend will detect both players requested and create new match
    if (rematchState === 'waiting') {
      console.log('[REMATCH] Accepting rematch request');
      wsRef.current.send(JSON.stringify({ type: 'REMATCH_REQUEST' }));
      // State will be updated by REMATCH_ACCEPTED message
      return;
    }
    
    // If idle, request rematch
    if (rematchState === 'idle') {
      console.log('[REMATCH] Requesting rematch');
      setRematchState('requested');
      wsRef.current.send(JSON.stringify({ type: 'REMATCH_REQUEST' }));
      
      // Start countdown
      let countdown = 10;
      setRematchCountdown(countdown);
      const interval = setInterval(() => {
        countdown--;
        setRematchCountdown(countdown);
        if (countdown <= 0) {
          clearInterval(interval);
          setRematchState('idle');
        }
      }, 1000);
      
      // Store interval ref for cleanup
      const cleanup = () => clearInterval(interval);
      return cleanup;
    }
  }, [rematchState]);

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
        myStreakRef.current = 0;
        opponentStreakRef.current = 0;
        setLongestStreak(0);
        prevScoreDiffRef.current = 0;
        setDisplayedRating(null); // Reset rating display for new game
        setShowDefeatOverlay(false);
        setShowScreenShake(false);
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
            // Correct move: NOW play synchronized feedback (haptic, sound, visual)
            const newStreak = myStreakRef.current + 1;
            myStreakRef.current = newStreak;
            setLongestStreak((prevLongest) => Math.max(prevLongest, newStreak));
            
            // Trigger all feedback synchronously
            triggerScoreFeedback(newStreak, row, col);
            
            // Completion flash (deferred check)
            setTimeout(() => {
              setMyGrid((prevGrid) => {
                checkCompletions(prevGrid, row, col);
                return prevGrid; // Return unchanged
              });
            }, 0);
            
            // Clear notes from the placed cell itself (already done optimistically, but ensure)
            const cellKey = `${row}-${col}`;
            setNotes(prev => {
              const newNotes = new Map(prev);
              newNotes.delete(cellKey);
              return newNotes;
            });
            
            // Clear related notes (same row, column, box)
            clearRelatedNotes(row, col, value);
            
            // Grid already updated optimistically, no need to update again
            // Update state to reflect server's authoritative score/time
            setMyState(player_state);
          } else {
            // Incorrect move: IMMEDIATELY switch from optimistic correct feedback to incorrect
            // CRITICAL: Override optimistic correct feedback instantly
            setLastMoveResult({ correct: false, row, col });
            playIncorrectSound();
            hapticError();
            
            // Revert grid to remove the incorrectly placed number
            setMyGrid((prev) => {
              const newGrid = prev.map((r) => [...r]);
              newGrid[row][col] = 0;
              return newGrid;
            });
            
            // Break streak
            myStreakRef.current = 0;
            
            // Revert optimistic score update (server's player_state has correct values)
            setMyState(player_state);
          }
          
          // Update pressure indicators
          const newScoreDiff = player_state.score - opponentState.score;
          prevScoreDiffRef.current = newScoreDiff;
          
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
            // Update opponent streak tracking
            opponentStreakRef.current += 1;
            
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
            
            // Optional: play distant tick for opponent moves
            // playDistantTick(); // Uncomment if enabled in settings
          } else {
            // Opponent made incorrect move - reset their streak
            opponentStreakRef.current = 0;
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
        
        // Determine if we won for effects
        const myPlayerIdForEnd = user?.id;
        const myResultForEnd = myPlayerIdForEnd && message.data.player1?.playerId === myPlayerIdForEnd
          ? message.data.player1
          : myPlayerIdForEnd && message.data.player2?.playerId === myPlayerIdForEnd
          ? message.data.player2
          : mySlotRef.current === 1
          ? message.data.player1
          : message.data.player2;
        const winnerSlotForEnd = message.data.winner_slot;
        const didWinForEnd = winnerSlotForEnd !== null && winnerSlotForEnd === mySlotRef.current;
        const ratingChangeForEnd = myResultForEnd?.rating_change || 0;
        
        // Trigger victory/defeat effects
        if (didWinForEnd) {
          playVictorySound();
          hapticVictory();
          
          // Screen shake for big wins
          if (ratingChangeForEnd >= 30) {
            setShowScreenShake(true);
            hapticBigWin();
            setTimeout(() => setShowScreenShake(false), 400);
          }
          
          // Initialize rating counter animation (will be handled by useEffect)
          // Don't set displayedRating here to avoid conflicts with useEffect
        } else {
          setShowDefeatOverlay(true);
          playDefeatSound();
        }
        
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

      case 'REMATCH_PENDING':
        console.log('[REMATCH] REMATCH_PENDING received, requested_by:', message.data.requested_by, 'mySlot:', mySlotRef.current);
        if (message.data.requested_by !== mySlotRef.current) {
          console.log('[REMATCH] Setting state to waiting');
          setRematchState('waiting');
        }
        break;

      case 'REMATCH_ACCEPTED':
        console.log('[REMATCH] REMATCH_ACCEPTED received, new_match_id:', message.data.new_match_id);
        console.log('[REMATCH] Current rematchState:', rematchState);
        // Navigate to new match
        if (message.data.new_match_id) {
          console.log('[REMATCH] Navigating to new match...');
          if (onRematch) {
            // Use callback if provided (preferred)
            console.log('[REMATCH] Using onRematch callback');
            onRematch(message.data.new_match_id);
          } else {
            // Fallback to window.location for compatibility
            console.log('[REMATCH] Using window.location fallback');
            window.location.href = `/game/${message.data.new_match_id}`;
          }
        } else {
          console.error('[REMATCH] No new_match_id in REMATCH_ACCEPTED message');
        }
        break;

      case 'REMATCH_DECLINED':
        setRematchState('idle');
        break;
    }
  };


  const handleCellClick = useCallback((row: number, col: number) => {
    // PERFORMANCE: Mark start of cell click handling
    if (import.meta.env.DEV) {
      performance.mark('cell-click-start');
    }

    if (gameStatus !== 'playing' || myState?.is_locked) {
      if (import.meta.env.DEV) {
        console.log(`[GamePage] Cell click blocked: gameStatus=${gameStatus}, is_locked=${myState?.is_locked}`);
      }
      return;
    }

    // Check if cell is an initial clue - allow clicking for highlighting but log it
    const isInitial = initialGrid[row]?.[col] !== 0;
    if (isInitial && import.meta.env.DEV) {
      console.log(`[GamePage] Clicked initial clue cell (${row}, ${col}) - allowing for highlighting`);
    }

    // If tapping the same cell again, clear selection/highlights
    if (selectedCell && selectedCell.row === row && selectedCell.col === col) {
      setSelectedCell(null);
      if (import.meta.env.DEV) {
        performance.mark('cell-click-state-update');
        performance.measure('cell-click-to-state', 'cell-click-start', 'cell-click-state-update');
      }
      return;
    }

    // Select the cell (whether empty or has a number)
    // SudokuGrid will handle highlighting based on whether selected cell has a value
    // CRITICAL: This preserves the UX feature where clicking a cell with a number
    // highlights all identical numbers and related cells (row/column/3x3 box)
    // OPTIMIZED: Removed myGrid from dependencies - we don't need it for selection
    if (import.meta.env.DEV) {
      console.log(`[GamePage] Selecting cell (${row}, ${col}), isInitial: ${isInitial}`);
    }
    setSelectedCell({ row, col });
    
    if (import.meta.env.DEV) {
      performance.mark('cell-click-state-update');
      performance.measure('cell-click-to-state', 'cell-click-start', 'cell-click-state-update');
    }
  }, [gameStatus, myState?.is_locked, initialGrid, selectedCell]);

  // Back button removed - forfeit can be accessed via other means if needed
  // const handleBackClick = () => { ... }

  const handleForfeit = () => {
    if (wsRef.current && gameStatus === 'playing') {
      wsRef.current.send(JSON.stringify({ type: 'FORFEIT' }));
    }
    setShowForfeitModal(false);
  };

  // Check for completed rows/columns/boxes and trigger flash
  const checkCompletions = useCallback((grid: number[][], row: number, col: number) => {
    const newCompletedCells = new Set<string>();
    
    // Guard: return early if grid is not initialized
    if (!grid || grid.length === 0 || !grid[row]) {
      return;
    }
    
    // Check row
    if (grid[row].every(v => v !== 0)) {
      for (let c = 0; c < 9; c++) newCompletedCells.add(`${row}-${c}`);
    }
    
    // Check column
    if (grid.every(r => r[col] !== 0)) {
      for (let r = 0; r < 9; r++) newCompletedCells.add(`${r}-${col}`);
    }
    
    // Check box
    const boxRowStart = Math.floor(row / 3) * 3;
    const boxColStart = Math.floor(col / 3) * 3;
    let boxComplete = true;
    for (let r = boxRowStart; r < boxRowStart + 3; r++) {
      for (let c = boxColStart; c < boxColStart + 3; c++) {
        if (grid[r][c] === 0) boxComplete = false;
      }
    }
    if (boxComplete) {
      for (let r = boxRowStart; r < boxRowStart + 3; r++) {
        for (let c = boxColStart; c < boxColStart + 3; c++) {
          newCompletedCells.add(`${r}-${c}`);
        }
      }
    }
    
    if (newCompletedCells.size > 0) {
      setCompletedCells(newCompletedCells);
      setTimeout(() => setCompletedCells(new Set()), 400);
    }
  }, []);

  // Calculate almost-complete cells (last empty cell in row/col/box)
  const calculateAlmostCompleteCells = useCallback((grid: number[][]): Set<string> => {
    const result = new Set<string>();
    
    // Guard: return empty set if grid is not initialized or empty
    if (!grid || grid.length === 0 || !grid[0] || grid[0].length === 0) {
      return result;
    }
    
    // Check each row
    for (let row = 0; row < 9; row++) {
      if (!grid[row]) continue;
      const emptyCells: string[] = [];
      for (let col = 0; col < 9; col++) {
        if (grid[row][col] === 0) emptyCells.push(`${row}-${col}`);
      }
      if (emptyCells.length === 1) result.add(emptyCells[0]);
    }
    
    // Check each column
    for (let col = 0; col < 9; col++) {
      const emptyCells: string[] = [];
      for (let row = 0; row < 9; row++) {
        if (grid[row] && grid[row][col] === 0) emptyCells.push(`${row}-${col}`);
      }
      if (emptyCells.length === 1) result.add(emptyCells[0]);
    }
    
    // Check each 3x3 box
    for (let boxRow = 0; boxRow < 3; boxRow++) {
      for (let boxCol = 0; boxCol < 3; boxCol++) {
        const emptyCells: string[] = [];
        for (let r = boxRow * 3; r < boxRow * 3 + 3; r++) {
          for (let c = boxCol * 3; c < boxCol * 3 + 3; c++) {
            if (grid[r] && grid[r][c] === 0) emptyCells.push(`${r}-${c}`);
          }
        }
        if (emptyCells.length === 1) result.add(emptyCells[0]);
      }
    }
    
    return result;
  }, []);

  const almostCompleteCells = useMemo(() => calculateAlmostCompleteCells(myGrid), [myGrid, calculateAlmostCompleteCells]);

  // Clear notes containing a value from the same row, column, and 3x3 box
  // OPTIMIZED: Memoized to avoid recreating function on every render
  const clearRelatedNotes = useCallback((row: number, col: number, value: number) => {
    setNotes(prev => {
      const newNotes = new Map(prev);
      
      // Get the 3x3 box starting position
      const boxStartRow = Math.floor(row / 3) * 3;
      const boxStartCol = Math.floor(col / 3) * 3;
      
      // OPTIMIZED: Pre-calculate bounds to avoid repeated calculations
      const boxEndRow = boxStartRow + 3;
      const boxEndCol = boxStartCol + 3;
      
      // Check all cells
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          // Skip the cell that was just filled
          if (r === row && c === col) continue;
          
          // Check if cell is in same row, column, or box
          const sameRow = r === row;
          const sameCol = c === col;
          const sameBox = r >= boxStartRow && r < boxEndRow && c >= boxStartCol && c < boxEndCol;
          
          if (sameRow || sameCol || sameBox) {
            const cellKey = `${r}-${c}`;
            const cellNotes = newNotes.get(cellKey);
            
            if (cellNotes && cellNotes.includes(value)) {
              const updated = cellNotes.filter(n => n !== value);
              if (updated.length === 0) {
                newNotes.delete(cellKey);
              } else {
                newNotes.set(cellKey, updated);
              }
            }
          }
        }
      }
      
      return newNotes;
    });
  }, []);

  const handleNumberClick = useCallback((num: number) => {
    // PERFORMANCE: Mark start of number click handling
    if (import.meta.env.DEV) {
      performance.mark('number-click-start');
    }

    if (!selectedCell || gameStatus !== 'playing') {
      if (import.meta.env.DEV) {
        console.log(`[GamePage] Number click blocked: selectedCell=${!!selectedCell}, gameStatus=${gameStatus}`);
      }
      return;
    }
    if (myState?.is_locked) {
      if (import.meta.env.DEV) {
        console.log(`[GamePage] Number click blocked: myState.is_locked=${myState.is_locked}, myState.score=${myState.score}, opponentState.is_locked=${opponentState.is_locked}, opponentState.score=${opponentState.score}`);
      }
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
      
      if (import.meta.env.DEV) {
        performance.mark('number-click-state-update');
        performance.measure('number-click-to-state', 'number-click-start', 'number-click-state-update');
      }
    } else {
      // Normal mode: place number
      // Prevent placing numbers in initial clue cells
      if (initialGrid[selectedCell.row]?.[selectedCell.col] !== 0) {
        return;
      }
      
      const { row, col } = selectedCell;
      const cellKey = `${row}-${col}`;
      
      // Check if cell was empty (for optimistic score update)
      const wasEmpty = myGrid[row]?.[col] === 0;
      const isInitialClue = initialGrid[row]?.[col] !== 0;
      
      // OPTIMISTIC: Update UI immediately, but DON'T play feedback yet
      // Feedback will only play after server confirms the move is correct
      // This prevents incorrect moves from playing correct feedback first
      
      // OPTIMISTIC: Update score counter immediately (increment if cell was empty and not initial clue)
      if (wasEmpty && !isInitialClue) {
        setMyState(prev => ({
          ...prev,
          cells_completed: prev.cells_completed + 1,
          score: prev.score + 1,
        }));
      }
      
      // OPTIMISTIC: Batch all state updates together for single render
      // React 18+ automatically batches these, but being explicit helps
      setMyGrid((prev) => {
        const newGrid = prev.map((r) => [...r]);
        newGrid[row][col] = num;
        return newGrid;
      });
      
      // OPTIMISTIC: Clear notes for this cell (batched with grid update)
      setNotes(prev => {
        const newNotes = new Map(prev);
        newNotes.delete(cellKey);
        return newNotes;
      });
      
      // Clear selection immediately (batched)
      setSelectedCell(null);
      
      if (import.meta.env.DEV) {
        performance.mark('number-click-state-update');
        performance.measure('number-click-to-state', 'number-click-start', 'number-click-state-update');
      }
      
      // DEFER: Clear related notes AFTER visual update (non-blocking)
      // Use requestIdleCallback with setTimeout fallback to avoid blocking paint
      // Store in ref to avoid stale closure
      const clearNotesRef = clearRelatedNotes;
      const deferClearNotes = () => {
        clearNotesRef(row, col, num);
      };
      if ('requestIdleCallback' in window) {
        requestIdleCallback(deferClearNotes, { timeout: 100 });
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(deferClearNotes, 0);
      }
      
      // Then send to server (non-blocking, doesn't wait for response)
      wsRef.current?.send(
        JSON.stringify({
          type: 'PLACE_NUMBER',
          data: {
            row,
            col,
            value: num,
          },
        })
      );
    }
  }, [selectedCell, gameStatus, myState?.is_locked, notesMode, initialGrid, wsRef, clearRelatedNotes]);

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

  // Calculate progress percentages (0-100)
  const totalCells = 81;
  const myProgress = (myState.cells_completed / totalCells) * 100;
  const opponentProgress = (opponentState.cells_completed / totalCells) * 100;

  // Rating no longer displayed in player info bar (removed)

  // Compute digit counts for number pad depletion styling (purely visual)
  // MEMOIZED: Only recalculate when grid changes, not on every render
  const digitCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    myGrid.forEach((row) => {
      row.forEach((value) => {
        if (value >= 1 && value <= 9) {
          counts[value] = (counts[value] || 0) + 1;
        }
      });
    });
    return counts;
  }, [myGrid]);

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
    const ratingBefore = myResult.rating_before || 1500;
    const ratingAfter = myResult.rating_after || 1500;
    // Use cells_completed (includes pre-completed squares) instead of score
    const myScore = myResult.cellsCompleted || myResult.cells_completed || myResult.score || 0;
    const opponentScore = opponentResult.cellsCompleted || opponentResult.cells_completed || opponentResult.score || 0;
    
    // Close loss detection
    const cellDifference = opponentScore - myScore;
    const wasClose = !didWin && !isDraw && cellDifference <= 5;

    // Use displayed rating if available, otherwise use ratingAfter
    const currentDisplayedRating = displayedRating !== null ? displayedRating : ratingAfter;

    return (
      <div className={`min-h-screen bg-white flex items-center justify-center p-4 relative ${showScreenShake ? 'screen-shake' : ''}`}>
        {/* Defeat overlay */}
        {showDefeatOverlay && <div className="absolute inset-0 defeat-overlay z-40 pointer-events-none" />}
        
        <div className="bg-white rounded-xl p-6 sm:p-8 text-center max-w-md w-full shadow-lg border border-gray-200 relative z-50">
          {/* Result Header */}
          <div className="mb-6">
            <h1 className={`text-4xl sm:text-5xl font-bold mb-2 ${
              isDraw ? 'text-gray-600' : didWin ? 'text-green-500 victory-text' : 'text-gray-800'
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
            
            {/* Close loss message */}
            {wasClose && (
              <p className="text-cyan-400 text-sm mt-2">
                Almost! {cellDifference} more cell{cellDifference !== 1 ? 's' : ''} would have won.
              </p>
            )}
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

          {/* Rating change - Prominent with animation */}
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
                {Math.round(ratingBefore)}
              </span>
              <span className="text-gray-400 text-lg sm:text-xl">→</span>
              <span className={`text-2xl sm:text-3xl font-bold font-mono ${
                ratingChange > 0 ? 'text-green-500' : ratingChange < 0 ? 'text-red-500' : 'text-gray-800'
              }`}>
                {Math.round(currentDisplayedRating)}
              </span>
              <span className={`text-xl sm:text-2xl font-bold font-mono ${
                ratingChange > 0 ? 'text-green-500' : ratingChange < 0 ? 'text-red-500' : 'text-gray-400'
              }`}>
                ({ratingChange > 0 ? '+' : ''}{Math.round(ratingChange)})
              </span>
            </div>
          </div>

          {/* Longest streak stat */}
          {longestStreak > 0 && (
            <div className="mb-4">
              <p className="text-gray-500 text-sm">
                Longest streak: <span className="text-cyan-400 font-mono font-bold">{longestStreak}</span>
              </p>
            </div>
          )}

          {/* Rematch series - reserved for future use */}
          {/* {rematchSeries.wins + rematchSeries.losses > 0 && (
            <div className="mb-4">
              <p className="text-sm text-gray-500">
                Series: <span className="text-green-400">{rematchSeries.wins}</span>
                {' - '}
                <span className="text-red-400">{rematchSeries.losses}</span>
              </p>
            </div>
          )} */}

          {/* Rematch button */}
          <div className="relative z-[60] w-full mb-3" style={{ pointerEvents: rematchState === 'requested' ? 'none' : 'auto' }}>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[REMATCH] Button clicked, state:', rematchState);
                if (rematchState !== 'requested') {
                  handleRematchRequest();
                }
              }}
              disabled={rematchState === 'requested'}
              className={`
                w-full py-3 rounded-lg font-semibold transition-colors text-base sm:text-lg relative
                ${rematchState === 'idle' 
                  ? 'bg-cyan-500 hover:bg-cyan-600 text-white cursor-pointer active:bg-cyan-700' 
                  : rematchState === 'waiting'
                  ? 'bg-green-500 hover:bg-green-600 text-white cursor-pointer active:bg-green-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'}
              `}
              style={{
                pointerEvents: rematchState === 'requested' ? 'none' : 'auto',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                position: 'relative',
                zIndex: 100
              }}
              type="button"
            >
              {rematchState === 'idle' && 'Rematch'}
              {rematchState === 'requested' && `Waiting... (${rematchCountdown}s)`}
              {rematchState === 'waiting' && 'Opponent wants rematch! Tap to accept'}
            </button>
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
    <div className={`min-h-screen bg-white flex flex-col relative ${showScreenShake ? 'screen-shake' : ''} ${showMicroShake ? 'micro-shake' : ''}`} style={{ paddingTop: '0px', paddingBottom: '0px' }}>
      {/* Score pulse overlay - raspberry blue vignette */}
      {showScorePulse !== 'none' && (
        <div 
          className={`fixed inset-0 z-50 pointer-events-none ${
            showScorePulse === 'intense' ? 'score-pulse-intense' : 'score-pulse'
          }`} 
        />
      )}
      
      {/* SUPER flash overlay */}
      {showSuperFlash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <span className="super-flash text-5xl font-black tracking-widest">SUPER!</span>
        </div>
      )}
      
      {/* Disconnect Banner */}
      {opponentDisconnected && (
        <div className="absolute inset-x-0 z-50 mx-4" style={{ top: isCapacitor ? '64px' : '64px' }}>
          <div className="bg-amber-500 text-white rounded-lg p-4 shadow-lg">
            <div>
              <p className="font-semibold">Opponent disconnected</p>
              <p className="text-sm opacity-90">
                Waiting {graceTimeRemaining}s for reconnection...
              </p>
              <p className="text-xs opacity-75 mt-1">Your timer is paused</p>
            </div>
            {/* Progress bar showing grace period */}
            <div className="mt-3 h-1 bg-amber-400 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-1000"
                style={{ width: `${(graceTimeRemaining / 15) * 100}%` }}
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
          
          {/* Row 2: Cells completed with progress bars */}
          <div className="flex items-center justify-between gap-2" style={{ marginBottom: '4px' }}>
            {/* Left: Player progress bar */}
            <div className="flex items-center gap-2">
              <ProgressBar 
                progress={myProgress} 
                color="blue" 
                className="w-[120px]"
              />
              <div className="text-xs sm:text-sm font-mono font-semibold text-blue-500 whitespace-nowrap">
                {myState.cells_completed}/81
              </div>
            </div>
            {/* Right: Opponent progress bar */}
            <div className="flex items-center gap-2">
              <div className="text-xs sm:text-sm font-mono font-semibold text-fuchsia-500 whitespace-nowrap">
                {opponentState.cells_completed}/81
              </div>
              <ProgressBar 
                progress={opponentProgress} 
                color="pink" 
                className="w-[120px]"
              />
            </div>
          </div>
          
        </div>

        {/* Timer boxes - Just above the border line, reduced spacing */}
        <div className="px-3 sm:px-4 border-b border-gray-200 relative" style={{ paddingTop: '0px', paddingBottom: '6px', marginTop: isCapacitor ? '8px' : '0px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '0px' }}>
            {/* Left: Player timer */}
            <div className="relative">
              <div className={`px-1 py-0.5 rounded-lg border-2 ${myTimeRemaining < 30 ? 'bg-red-500/20 border-red-500' : 'bg-blue-500/20 border-blue-500'} ${myTimerPaused ? 'opacity-50' : ''}`}>
                <div className={`text-xl sm:text-2xl font-mono font-bold ${myTimeRemaining < 30 ? 'text-red-500' : 'text-blue-500'}`}>
                  {formatTime(myTimeRemaining)}
                  {myTimerPaused && <span className="ml-2 text-sm">⏸</span>}
                </div>
              </div>
              {/* Player emote - absolutely positioned to the right of timer, closer to center */}
              {myEmote && (
                <div 
                  className={`absolute text-4xl sm:text-5xl pointer-events-none ${myEmoteFadingOut ? 'animate-fade-out' : 'animate-fade-in'}`}
                  key={myEmote}
                  style={{ 
                    zIndex: 10,
                    left: '100%',
                    marginLeft: '25px',
                    top: '12%',
                    transform: 'translateY(-50%)',
                    lineHeight: '1',
                    whiteSpace: 'nowrap',
                    display: 'block',
                    letterSpacing: '-0.1em'
                  }}
                >
                  {myEmote}
                </div>
              )}
            </div>
            {/* Right: Opponent timer */}
            <div className="relative">
              {/* Opponent emote - absolutely positioned to the left of timer, closer to center */}
              {opponentEmote && (
                <div 
                  className={`absolute text-4xl sm:text-5xl pointer-events-none ${opponentEmoteFadingOut ? 'animate-fade-out' : 'animate-fade-in'}`}
                  key={opponentEmote}
                  style={{ 
                    zIndex: 10,
                    right: '100%',
                    marginRight: '25px',
                    top: '12%',
                    transform: 'translateY(-50%)',
                    lineHeight: '1',
                    whiteSpace: 'nowrap',
                    display: 'block',
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
                lastScoredCell={lastScoredCell}
                completedCells={completedCells}
                almostCompleteCells={almostCompleteCells}
                currentStreak={myStreakRef.current}
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
                style={{ 
                  fontSize: 'clamp(1.125rem, 4.5vw, 1.5rem)',
                  willChange: 'background-color', // GPU acceleration hint
                  transitionDuration: '75ms', // Faster transition
                }}
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
