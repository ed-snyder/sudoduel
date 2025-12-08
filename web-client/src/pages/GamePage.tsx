import { useState, useEffect, useRef, useCallback, useMemo, useDeferredValue } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGameSounds } from '../hooks/useGameSounds';
import { useHaptics } from '../hooks/useHaptics';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import SudokuGrid from '../components/SudokuGrid';
import { ForfeitModal } from '../components/ForfeitModal';
import { ProgressBar } from '../components/ProgressBar';
import ResultScreen from '../components/ResultScreen';
import GameBackgroundEffects from '../components/GameBackgroundEffects';
import { createGameSocket } from '../config';
import { STARTING_TIME_SECONDS } from '../constants';
import { useMobileDetect } from '../hooks/useMobileDetect';

const DEFAULT_EMOTES = ['😂', '😢', '😍', '💩'];
const EMOTE_DISPLAY_DURATION = 2000; // 2 seconds

interface GamePageProps {
  matchId: number;
  onGameEnd: () => void;
  onRematch?: (newMatchId: number) => void;
  onFindNewMatch?: (newMatchId: number) => void;
}

interface PlayerState {
  score: number;              // Cells completed by player (not including initial clues)
  cells_completed: number;    // Total cells filled (including initial clues)
  time_remaining: number;    // Time-as-resource timer
  is_locked: boolean;        // true when timer hits 0
  is_solved: boolean;
}

export default function GamePage({ matchId, onGameEnd, onRematch, onFindNewMatch }: GamePageProps) {
  const { token, user, refreshUser } = useAuth();
  const { isCapacitor } = useMobileDetect();
  const wsRef = useRef<WebSocket | null>(null);
  const { playCorrectSound, playIncorrectSound, playSofterErrorSound, resetStreak, initAudio, playVictorySound, playDefeatSound } = useGameSounds();
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
  const [solutionGrid, setSolutionGrid] = useState<number[][]>([]);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [myState, setMyState] = useState<PlayerState>({ score: 0, cells_completed: 0, time_remaining: STARTING_TIME_SECONDS, is_locked: false, is_solved: false });
  const [opponentState, setOpponentState] = useState<PlayerState>({ score: 0, cells_completed: 0, time_remaining: STARTING_TIME_SECONDS, is_locked: false, is_solved: false });
  const [mySlot, setMySlot] = useState<number>(0);
  const mySlotRef = useRef<number>(0);
  const [gameStatus, setGameStatus] = useState<'connecting' | 'waiting' | 'playing' | 'ended'>('connecting');
  const [myTimeRemaining, setMyTimeRemaining] = useState(STARTING_TIME_SECONDS);
  const [opponentTimeRemaining, setOpponentTimeRemaining] = useState(STARTING_TIME_SECONDS);
  const [countdown, setCountdown] = useState<number | null>(null);
  const serverTimeOffsetRef = useRef<number>(0);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [gameResult, setGameResult] = useState<any>(null);
  const [emotes, setEmotes] = useState<string[]>(DEFAULT_EMOTES);
  const warmUpDoneRef = useRef(false);
  const lastCellPlacementRef = useRef(0);
  
  // Load custom emotes from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('customEmotes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 4) {
          setEmotes(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to load custom emotes');
    }
  }, []);

  // Warm-up function to force browser to pre-compute expensive operations
  const warmUpRenderer = useCallback(() => {
    if (warmUpDoneRef.current) return;
    warmUpDoneRef.current = true;
    
    try {
      // Ensure document.body exists before accessing it
      if (!document.body) {
        console.warn('[PERF] document.body not ready, skipping warm-up');
        return;
      }

      console.log('[PERF] Starting renderer warm-up...');
      
      // Pre-warm haptics engine - do a silent/minimal haptic
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {
        // Ignore errors, just warming up
      });
      
      // 1. Pre-warm font rendering by forcing layout calculation
      const warmUpDiv = document.createElement('div');
      warmUpDiv.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;';
      warmUpDiv.innerHTML = `
        <span style="font-family: Industry, Orbitron, sans-serif; font-size: 1.5rem; font-weight: bold; color: rgba(255, 255, 255, 0.95);">123456789</span>
        <span style="font-family: Industry, Orbitron, sans-serif; font-size: 1.5rem; font-weight: bold; color: #00FFFF; text-shadow: 0 0 12px rgba(0,255,255,0.7);">123456789</span>
      `;
      document.body.appendChild(warmUpDiv);
      
      // Force layout calculation
      void warmUpDiv.offsetHeight;
      
      // 2. Pre-warm CSS animations by triggering them
      warmUpDiv.innerHTML += `
        <div class="breathing-line" style="width:100px;height:2px;background:white;stroke:rgb(255,255,255);stroke-width:1;"></div>
        <div class="breathing-line-thick" style="width:100px;height:2px;background:white;stroke:rgb(255,255,255);stroke-width:2;"></div>
        <div class="breathing-glow" style="width:100px;height:100px;"></div>
        <span class="breathing-text" style="font-family: Industry, Orbitron, sans-serif; color: rgba(255, 255, 255, 0.95);">1</span>
        <span class="breathing-cyan-text" style="font-family: Industry, Orbitron, sans-serif; color: #00FFFF;">1</span>
      `;
      
      // Force style recalc
      void warmUpDiv.offsetHeight;
      
      // Clean up after browser has processed
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            if (warmUpDiv.parentNode) {
              document.body.removeChild(warmUpDiv);
            }
            console.log('[PERF] Renderer warm-up complete');
          } catch (e) {
            // Ignore cleanup errors
            console.warn('[PERF] Warm-up cleanup failed:', e);
          }
        });
      });
    } catch (e) {
      // Silently fail - warm-up is non-critical
      console.warn('[PERF] Warm-up failed:', e);
    }
  }, []);

  // Warm up renderer when game becomes 'playing'
  useEffect(() => {
    if (gameStatus === 'playing' && myGrid.length > 0 && initialGrid.length > 0) {
      // Warm up on first game load
      warmUpRenderer();
      
      // Pre-warm the grid state update path with a dummy update
      const warmUpStateUpdate = () => {
        // Force React to go through the full update path
        // by setting state to same value (React will still reconcile)
        setSelectedCell(prev => prev);
      };
      
      if ('requestIdleCallback' in window) {
        requestIdleCallback(warmUpStateUpdate, { timeout: 100 });
      } else {
        setTimeout(warmUpStateUpdate, 0);
      }
    }
  }, [gameStatus, myGrid.length, initialGrid.length, warmUpRenderer]);
  
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
  const [isPlayerPremium] = useState<boolean>(true);
  const [isOpponentPremium] = useState<boolean>(true);
  const [erroredCells, setErroredCells] = useState<Set<string>>(new Set()); // Track cells that have received incorrect guesses
  
  // Background effect triggers
  const [bgPlayerScored, setBgPlayerScored] = useState(false);
  const [bgOpponentScored, setBgOpponentScored] = useState(false);
  const [bgMistakeMade, setBgMistakeMade] = useState(false);
  
  // Streak system - track longest streak (used internally, not displayed in ResultScreen)
  const [_longestStreak, setLongestStreak] = useState(0);
  const myStreakRef = useRef(0);
  const opponentStreakRef = useRef(0);
  
  // Rematch system
  const [rematchState, setRematchState] = useState<'idle' | 'requested' | 'waiting'>('idle');
  const [rematchCountdown, setRematchCountdown] = useState(10);
  // Rematch series tracking - reserved for future use
  // const [rematchSeries, setRematchSeries] = useState({ wins: 0, losses: 0 });
  
  // Pressure indicators
  const prevScoreDiffRef = useRef<number>(0);
  const [displayedRating, setDisplayedRating] = useState<number | null>(null);
  const [showScreenShake, setShowScreenShake] = useState(false);
  
  // Addictive scoring feedback system state
  const [showScorePulse, setShowScorePulse] = useState<'none' | 'normal' | 'intense'>('none');
  const [showMicroShake, setShowMicroShake] = useState(false);
  const [showSuperFlash, setShowSuperFlash] = useState(false);
  const [lastScoredCell, setLastScoredCell] = useState<{ row: number; col: number } | null>(null);
  const [completedCells, setCompletedCells] = useState<Set<string>>(new Set());
  
  // Event banner system
  interface BannerMessage {
    text: string;
    colorClass: string;
    priority: number;
    type?: 'positive' | 'negative' | 'neutral';
  }
  const [bannerMessage, setBannerMessage] = useState<BannerMessage | null>(null);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCellsRemainingRef = useRef<number>(41); // Start with max empty cells
  const [isDownToWire, setIsDownToWire] = useState(false);
  const [shownLowTimeWarning, setShownLowTimeWarning] = useState(false);
  
  // Function to show a banner message
  const showBanner = useCallback((text: string, colorClass: string, priority: number, duration: number = 2000, type?: 'positive' | 'negative' | 'neutral') => {
    // Clear any existing timeout
    if (bannerTimeoutRef.current) {
      clearTimeout(bannerTimeoutRef.current);
    }
    
    // Check priority - only show if higher or equal priority than current
    // Higher number = higher priority
    setBannerMessage(prev => {
      if (prev && prev.priority > priority) {
        return prev; // Keep existing higher priority message
      }
      return { text, colorClass, priority, type: type || 'neutral' };
    });
    
    // Auto-hide after duration
    bannerTimeoutRef.current = setTimeout(() => {
      setBannerMessage(null);
    }, duration);
  }, []);
  
  // Cleanup banner timeout on unmount
  useEffect(() => {
    return () => {
      if (bannerTimeoutRef.current) {
        clearTimeout(bannerTimeoutRef.current);
      }
    };
  }, []);

  // Connect to WebSocket
  useEffect(() => {
    if (!token) return;
    
    // Reset game state when matchId changes (for rematch/new match)
    setGameStatus('connecting');
    setGameResult(null);
    setRematchState('idle');
    setRematchCountdown(30);
    
    const ws = createGameSocket(matchId, token);
    wsRef.current = ws;

    ws.onopen = () => {
      // Don't set to 'waiting' automatically - wait for GAME_STATE message
      // This prevents overriding 'ended' status if reconnecting after game end
      setGameStatus('connecting');
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
      // Clean up countdown interval
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [matchId, token]);

  // Client-side timer countdown for smooth UI updates
  // Uses performance.now() for accurate timing and drift correction
  useEffect(() => {
    if (gameStatus !== 'playing' || myTimerPaused) return;
    
    let lastTickTime = performance.now();
    let accumulatedTime = 0;
    
    const interval = setInterval(() => {
      const now = performance.now();
      const elapsed = now - lastTickTime;
      lastTickTime = now;
      accumulatedTime += elapsed;
      
      // Only decrement when a full second has passed
      if (accumulatedTime >= 1000) {
        const secondsToDecrement = Math.floor(accumulatedTime / 1000);
        accumulatedTime = accumulatedTime % 1000;
        
        setMyTimeRemaining(prev => Math.max(0, prev - secondsToDecrement));
      }
    }, 100); // Check every 100ms for smoother countdown
    
    return () => clearInterval(interval);
  }, [gameStatus, myTimerPaused]);

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

  // Banner trigger 1: Lead changes (Priority: 5)
  useEffect(() => {
    if (gameStatus !== 'playing') return;
    
    const myScore = myState.score;
    const oppScore = opponentState.score;
    const currentDiff = myScore - oppScore;
    const prevDiff = prevScoreDiffRef.current;
    
    // Gained the lead: was behind or tied, now ahead
    if (prevDiff <= 0 && currentDiff > 0) {
      showBanner("Gained the Lead!", "text-indigo-500", 5, 2000, 'positive');
    }
    // Lost the lead: was ahead or tied, now behind
    else if (prevDiff >= 0 && currentDiff < 0) {
      showBanner("Lost the Lead!", "text-pink-500", 5, 2000, 'negative');
    }
    
    prevScoreDiffRef.current = currentDiff;
  }, [myState.score, opponentState.score, gameStatus, showBanner]);
  
  // Banner trigger 2: Cells remaining milestones (Priority: 3)
  useEffect(() => {
    if (gameStatus !== 'playing') return;
    
    const cellsRemaining = 81 - myState.cells_completed;
    const prevRemaining = prevCellsRemainingRef.current;
    
    // Only trigger when crossing the threshold (not on initial load)
    if (prevRemaining > 9 && cellsRemaining <= 9 && cellsRemaining === 9) {
      showBanner("9 cells left!", "text-indigo-500", 3, 2000, 'positive');
    } else if (prevRemaining > 3 && cellsRemaining <= 3 && cellsRemaining === 3) {
      showBanner("3 cells left!", "text-indigo-500", 3, 2000, 'positive');
    } else if (prevRemaining > 1 && cellsRemaining <= 1 && cellsRemaining === 1) {
      showBanner("Final cell!", "text-indigo-500", 3, 2000, 'positive');
    }
    
    prevCellsRemainingRef.current = cellsRemaining;
  }, [myState.cells_completed, gameStatus, showBanner]);
  
  // Banner trigger 3: Down to the wire (Priority: 7)
  useEffect(() => {
    if (gameStatus !== 'playing') return;
    
    const myCellsRemaining = 81 - myState.cells_completed;
    const oppCellsRemaining = 81 - opponentState.cells_completed;
    
    const bothUnder9 = myCellsRemaining <= 9 && oppCellsRemaining <= 9;
    
    if (bothUnder9 && !isDownToWire) {
      setIsDownToWire(true);
      showBanner("Down to the wire!", "text-red-500", 7, 3000, 'negative');
    } else if (!bothUnder9) {
      setIsDownToWire(false);
    }
  }, [myState.cells_completed, opponentState.cells_completed, gameStatus, isDownToWire, showBanner]);
  
  // Banner trigger 4: Running out of time (Priority: 10 - Highest)
  useEffect(() => {
    if (gameStatus !== 'playing') return;
    
    if (myTimeRemaining < 15 && myTimeRemaining > 0 && !shownLowTimeWarning) {
      setShownLowTimeWarning(true);
      showBanner("Running out of time!", "text-red-500", 10, 3000, 'negative');
    }
    
    // Reset warning if time goes back above 15 (shouldn't happen, but handle edge case)
    if (myTimeRemaining >= 15) {
      setShownLowTimeWarning(false);
    }
  }, [myTimeRemaining, gameStatus, shownLowTimeWarning, showBanner]);
  
  // Critical state vignette
  const isCriticalState = useMemo(() => {
    if (gameStatus !== 'playing') return false;
    
    const myCellsRemaining = 81 - myState.cells_completed;
    const oppCellsRemaining = 81 - opponentState.cells_completed;
    const bothUnder9 = myCellsRemaining <= 9 && oppCellsRemaining <= 9;
    const lowTime = myTimeRemaining < 15 && myTimeRemaining > 0;
    
    return bothUnder9 || lowTime;
  }, [myState.cells_completed, opponentState.cells_completed, myTimeRemaining, gameStatus]);
  
  // Clear banner and reset states when game ends
  useEffect(() => {
    if (gameStatus === 'ended') {
      setBannerMessage(null);
      setIsDownToWire(false);
      setShownLowTimeWarning(false);
      if (bannerTimeoutRef.current) {
        clearTimeout(bannerTimeoutRef.current);
        bannerTimeoutRef.current = null;
    }
    }
  }, [gameStatus]);

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
        // Reset rematch state when new game starts
        setRematchState('idle');
        setRematchCountdown(30);
        
        const receivedSlot = message.data.your_slot;
        setMySlot(Number(receivedSlot)); // Ensure it's a number
        mySlotRef.current = Number(receivedSlot);
        // Align local gameStatus with server status in case we connected after start
        // Don't override 'ended' status - if game has ended, keep it ended
        if (gameStatus !== 'ended') {
          if (message.data.status === 'IN_PROGRESS') {
            setGameStatus('playing');
          } else if (message.data.status === 'WAITING') {
            setGameStatus('waiting');
          } else if (message.data.status === 'ENDED') {
            setGameStatus('ended');
          }
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

      case 'GAME_COUNTDOWN':
        // Clear any existing countdown interval
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }
        setCountdown(message.data.seconds);
        // Start local countdown for smooth UI
        countdownIntervalRef.current = setInterval(() => {
          setCountdown(prev => {
            if (prev === null || prev <= 1) {
              if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
              }
              return null;
            }
            return prev - 1;
          });
        }, 1000);
        break;

      case 'GAME_START':
        // Clear countdown interval if still running
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        setCountdown(null);
        initAudio();
        resetStreak();
        myStreakRef.current = 0;
        opponentStreakRef.current = 0;
        setLongestStreak(0);
        prevScoreDiffRef.current = 0;
        setDisplayedRating(null); // Reset rating display for new game
        setShowScreenShake(false);
        // Reset banner states
        setBannerMessage(null);
        setIsDownToWire(false);
        setShownLowTimeWarning(false);
        prevCellsRemainingRef.current = 41;
        if (bannerTimeoutRef.current) {
          clearTimeout(bannerTimeoutRef.current);
          bannerTimeoutRef.current = null;
        }
        // CRITICAL: Reset ALL game state for rematch/new game
        setMyState({ score: 0, cells_completed: 0, time_remaining: STARTING_TIME_SECONDS, is_locked: false, is_solved: false });
        setOpponentState({ score: 0, cells_completed: 0, time_remaining: STARTING_TIME_SECONDS, is_locked: false, is_solved: false });
        setOpponentScoredCells(new Set()); // CRITICAL: Clear opponent scored cells
        setErroredCells(new Set()); // Reset errored cells tracking
        setLastMoveResult(null);
        setSelectedCell(null);
        setNotes(new Map());
        setCompletedCells(new Set());
        setLastScoredCell(null);
        setShowScorePulse('none');
        setShowMicroShake(false);
        setShowSuperFlash(false);
        setMyEmote(null);
        setOpponentEmote(null);
        setMyEmoteFadingOut(false);
        setOpponentEmoteFadingOut(false);
        const grid = message.data.initial_grid;
        const solution = message.data.solution_grid || [];
        setMyGrid(grid.map((row: number[]) => [...row]));
        setInitialGrid(grid.map((row: number[]) => [...row]));
        setSolutionGrid(solution.map((row: number[]) => [...row]));
        
        // Calculate server time offset for drift correction
        const clientNow = Date.now();
        const serverTime = message.data.server_timestamp;
        if (serverTime) {
          serverTimeOffsetRef.current = serverTime - clientNow;
        }
        
        // Set initial time from server (authoritative)
        const myTime = mySlotRef.current === 1 
          ? message.data.player1_time_remaining 
          : message.data.player2_time_remaining;
        setMyTimeRemaining(myTime || STARTING_TIME_SECONDS);
        
        const opponentTime = mySlotRef.current === 1 
          ? message.data.player2_time_remaining 
          : message.data.player1_time_remaining;
        setOpponentTimeRemaining(opponentTime || STARTING_TIME_SECONDS);
        
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
            // Correct move: Feedback already played optimistically via local validation
            // Completion flash already triggered locally - do NOT re-trigger to avoid delay
            // Just sync state with server's authoritative values
            const newStreak = myStreakRef.current + 1;
            myStreakRef.current = newStreak;
              setLongestStreak((prevLongest) => Math.max(prevLongest, newStreak));
            
            // Clear notes from the placed cell itself (already done optimistically, but ensure)
            const cellKey = `${row}-${col}`;
            setNotes(prev => {
              const newNotes = new Map(prev);
              newNotes.delete(cellKey);
              return newNotes;
            });
            
            // Clear related notes (same row, column, box) - already done optimistically
            clearRelatedNotes(row, col, value);
            
            // Grid already updated optimistically, no need to update again
            // Update state to reflect server's authoritative score/time
            setMyState(player_state);
            
            // Trigger background effects
            setBgPlayerScored(prev => !prev); // Toggle to trigger effect
          } else {
            // Incorrect move: Server confirms incorrect (matches our local validation)
            // Error feedback already played locally - do NOT re-trigger to avoid duplicate flash
            // Only revert grid and sync state
            
            // Revert grid to remove the incorrectly placed number
            setMyGrid((prev) => {
              const newGrid = prev.map((r) => [...r]);
              newGrid[row][col] = 0;
              return newGrid;
            });
          
            // Reset streak (already done locally, but ensure consistency)
            myStreakRef.current = 0;
            
            // Revert optimistic score update (server's player_state has correct values)
          setMyState(player_state);
          
          // Trigger background effects
          setBgMistakeMade(prev => !prev);
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
            
            // Trigger background effects
            setBgOpponentScored(prev => !prev);
            
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
        // Skip TIME_SYNC processing for 200ms after cell placement to allow paint to complete
        if (Date.now() - lastCellPlacementRef.current < 200) {
          console.log(`[GamePage] TIME_SYNC throttled - recent cell placement`);
          break;
        }
        
        // Update both timers and lock status from server
        // Don't update state if mySlot hasn't been set yet (wait for GAME_STATE)
        if (mySlotRef.current === 0) {
          console.log(`[GamePage] TIME_SYNC ignored: mySlot not set yet (waiting for GAME_STATE)`);
          break;
        }
        
        console.log(`[GamePage] TIME_SYNC received: player1_locked=${message.data.player1_locked}, player2_locked=${message.data.player2_locked}, mySlot=${mySlotRef.current}`);
        if (mySlotRef.current === 1) {
          const myServerTime = message.data.player1_time;
          const myLocked = message.data.player1_locked;
          const myScore = message.data.player1_score;
          const myCells = message.data.player1_cells_completed;
          const opponentLocked = message.data.player2_locked;
          const opponentScore = message.data.player2_score;
          const opponentCells = message.data.player2_cells_completed;
          
          // Correct if drift > 1 second
          setMyTimeRemaining(prev => {
            if (Math.abs(prev - myServerTime) > 1) {
              console.log(`[TIMER] Correcting drift: local=${prev} server=${myServerTime}`);
              return myServerTime;
            }
            return prev;
          });
          setOpponentTimeRemaining(message.data.player2_time);
          
          // Only update state if values actually changed to avoid unnecessary re-renders
          setMyState(prev => {
            // Check if anything actually changed
            if (
              prev.is_locked === myLocked &&
              prev.score === (myScore !== undefined ? myScore : prev.score) &&
              prev.cells_completed === (myCells !== undefined ? myCells : prev.cells_completed)
            ) {
              // No change, return same reference to skip re-render
              return prev;
            }
            
            // Values changed, update state
            const newState = {
              ...prev,
              is_locked: myLocked,
              score: myScore !== undefined ? myScore : prev.score,
              cells_completed: myCells !== undefined ? myCells : prev.cells_completed,
            };
            console.log(`[GamePage] Updating myState (slot 1): is_locked=${newState.is_locked}, score=${newState.score}, cells_completed=${newState.cells_completed}`);
            return newState;
          });
          
          setOpponentState(prev => {
            // Check if anything actually changed
            if (
              prev.is_locked === opponentLocked &&
              prev.score === (opponentScore !== undefined ? opponentScore : prev.score) &&
              prev.cells_completed === (opponentCells !== undefined ? opponentCells : prev.cells_completed)
            ) {
              // No change, return same reference to skip re-render
              return prev;
            }
            
            // Values changed, update state
            return {
              ...prev,
              is_locked: opponentLocked,
              score: opponentScore !== undefined ? opponentScore : prev.score,
              cells_completed: opponentCells !== undefined ? opponentCells : prev.cells_completed,
            };
          });
        } else if (mySlotRef.current === 2) {
          const myServerTime = message.data.player2_time;
          const myLocked = message.data.player2_locked;
          const myScore = message.data.player2_score;
          const myCells = message.data.player2_cells_completed;
          const opponentLocked = message.data.player1_locked;
          const opponentScore = message.data.player1_score;
          const opponentCells = message.data.player1_cells_completed;
          
          // Correct if drift > 1 second
          setMyTimeRemaining(prev => {
            if (Math.abs(prev - myServerTime) > 1) {
              console.log(`[TIMER] Correcting drift: local=${prev} server=${myServerTime}`);
              return myServerTime;
            }
            return prev;
          });
          setOpponentTimeRemaining(message.data.player1_time);
          
          // Only update state if values actually changed to avoid unnecessary re-renders
          setMyState(prev => {
            // Check if anything actually changed
            if (
              prev.is_locked === myLocked &&
              prev.score === (myScore !== undefined ? myScore : prev.score) &&
              prev.cells_completed === (myCells !== undefined ? myCells : prev.cells_completed)
            ) {
              // No change, return same reference to skip re-render
              return prev;
            }
            
            // Values changed, update state
            const newState = {
              ...prev,
              is_locked: myLocked,
              score: myScore !== undefined ? myScore : prev.score,
              cells_completed: myCells !== undefined ? myCells : prev.cells_completed,
            };
            console.log(`[GamePage] Updating myState (slot 2): is_locked=${newState.is_locked}, score=${newState.score}, cells_completed=${newState.cells_completed}`);
            return newState;
          });
          
          setOpponentState(prev => {
            // Check if anything actually changed
            if (
              prev.is_locked === opponentLocked &&
              prev.score === (opponentScore !== undefined ? opponentScore : prev.score) &&
              prev.cells_completed === (opponentCells !== undefined ? opponentCells : prev.cells_completed)
            ) {
              // No change, return same reference to skip re-render
              return prev;
            }
            
            // Values changed, update state
            return {
              ...prev,
              is_locked: opponentLocked,
              score: opponentScore !== undefined ? opponentScore : prev.score,
              cells_completed: opponentCells !== undefined ? opponentCells : prev.cells_completed,
            };
          });
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
        // Reset rematch state for new game end
        setRematchState('idle');
        setRematchCountdown(30);
        
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
          // Defeat overlay handled by ResultScreen component
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
    const startTime = performance.now();
    console.log(`[PERF] Cell click START: ${startTime.toFixed(2)}ms`);

    if (gameStatus !== 'playing' || myState?.is_locked) {
      console.log(`[PERF] Cell click blocked: gameStatus=${gameStatus}, is_locked=${myState?.is_locked}`);
      return;
    }

    console.log(`[PERF] After selection check: ${(performance.now() - startTime).toFixed(2)}ms`);

    // Check if cell is an initial clue - allow clicking for highlighting but log it
    const isInitial = initialGrid[row]?.[col] !== 0;
    if (isInitial) {
      console.log(`[PERF] Clicked initial clue cell (${row}, ${col})`);
    }

    console.log(`[PERF] After initial check: ${(performance.now() - startTime).toFixed(2)}ms`);

    // If tapping the same cell again, clear selection/highlights
    if (selectedCell && selectedCell.row === row && selectedCell.col === col) {
      console.log(`[PERF] Before setSelectedCell(null): ${(performance.now() - startTime).toFixed(2)}ms`);
      setSelectedCell(null);
      console.log(`[PERF] After setSelectedCell(null): ${(performance.now() - startTime).toFixed(2)}ms`);
      console.log(`[PERF] Cell click END (deselect): ${(performance.now() - startTime).toFixed(2)}ms`);
      return;
    }

    // Select the cell (whether empty or has a number)
    // SudokuGrid will handle highlighting based on whether selected cell has a value
    // CRITICAL: This preserves the UX feature where clicking a cell with a number
    // highlights all identical numbers and related cells (row/column/3x3 box)
    // OPTIMIZED: Removed myGrid from dependencies - we don't need it for selection
    console.log(`[PERF] Before setSelectedCell: ${(performance.now() - startTime).toFixed(2)}ms`);
    setSelectedCell({ row, col });
    console.log(`[PERF] After setSelectedCell: ${(performance.now() - startTime).toFixed(2)}ms`);
    
    console.log(`[PERF] Cell click END: ${(performance.now() - startTime).toFixed(2)}ms`);
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

  // Defer expensive calculation to avoid blocking paint on first cell placement
  const deferredGrid = useDeferredValue(myGrid);
  const almostCompleteCells = useMemo(() => calculateAlmostCompleteCells(deferredGrid), [deferredGrid, calculateAlmostCompleteCells]);

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
    const startTime = performance.now();
    console.log(`[PERF] Number click START: ${startTime.toFixed(2)}ms`);

    if (!selectedCell || gameStatus !== 'playing') {
      console.log(`[PERF] Number click blocked: selectedCell=${!!selectedCell}, gameStatus=${gameStatus}`);
      return;
    }
    if (myState?.is_locked) {
      console.log(`[PERF] Number click blocked: myState.is_locked=${myState.is_locked}`);
      return;
    }

    console.log(`[PERF] After validation checks: ${(performance.now() - startTime).toFixed(2)}ms`);

    if (notesMode) {
      console.log(`[PERF] Notes mode - before setNotes: ${(performance.now() - startTime).toFixed(2)}ms`);
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
      console.log(`[PERF] Notes mode - after setNotes: ${(performance.now() - startTime).toFixed(2)}ms`);
      console.log(`[PERF] Number click END (notes mode): ${(performance.now() - startTime).toFixed(2)}ms`);
    } else {
      console.log(`[PERF] Normal mode - before validation: ${(performance.now() - startTime).toFixed(2)}ms`);
      // Normal mode: place number
      // Prevent placing numbers in initial clue cells
      if (initialGrid[selectedCell.row]?.[selectedCell.col] !== 0) {
        console.log(`[PERF] Blocked - initial clue cell: ${(performance.now() - startTime).toFixed(2)}ms`);
        return;
      }
      
      const { row, col } = selectedCell;
      
      console.log(`[PERF] Before validation: ${(performance.now() - startTime).toFixed(2)}ms`);
      
      // INSTANT LOCAL VALIDATION: Check correctness using solution grid
      const isCorrect = solutionGrid.length > 0 && solutionGrid[row]?.[col] === num;
      const wasEmpty = myGrid[row]?.[col] === 0;
      const isInitialClue = initialGrid[row]?.[col] !== 0;
      
      console.log(`[PERF] After validation (isCorrect=${isCorrect}): ${(performance.now() - startTime).toFixed(2)}ms`);
      
      // INSTANT FEEDBACK: Trigger immediately based on local validation
      if (isCorrect) {
        console.log(`[PERF] Before sound/feedback: ${(performance.now() - startTime).toFixed(2)}ms`);
        // Update streak immediately
        const newStreak = myStreakRef.current + 1;
        myStreakRef.current = newStreak;
        setLongestStreak((prevLongest) => Math.max(prevLongest, newStreak));
        
        console.log(`[PERF] Before triggerScoreFeedback: ${(performance.now() - startTime).toFixed(2)}ms`);
        // Trigger synchronized feedback instantly
        triggerScoreFeedback(newStreak, row, col);
        console.log(`[PERF] After triggerScoreFeedback: ${(performance.now() - startTime).toFixed(2)}ms`);
        
        // OPTIMISTIC: Update score counter immediately (increment if cell was empty and not initial clue)
        console.log(`[PERF] Before setMyState: ${(performance.now() - startTime).toFixed(2)}ms`);
        if (wasEmpty && !isInitialClue) {
          setMyState(prev => ({
            ...prev,
            cells_completed: prev.cells_completed + 1,
            score: prev.score + 1,
          }));
        }
        console.log(`[PERF] After setMyState: ${(performance.now() - startTime).toFixed(2)}ms`);
      } else {
        // INSTANT ERROR FEEDBACK: Incorrect move
        const cellKey = `${row}-${col}`;
        const isFirstError = !erroredCells.has(cellKey);
        
        console.log(`[PERF] Error path - before setLastMoveResult: ${(performance.now() - startTime).toFixed(2)}ms`);
        setLastMoveResult({ correct: false, row, col });
        
        // Track errored cell
        if (isFirstError) {
          setErroredCells(prev => new Set(prev).add(cellKey));
        }
        
        console.log(`[PERF] Error path - before playIncorrectSound: ${(performance.now() - startTime).toFixed(2)}ms`);
        // Use different sound for first vs subsequent errors
        if (isFirstError) {
          playIncorrectSound();
        } else {
          playSofterErrorSound();
        }
        console.log(`[PERF] Error path - after playIncorrectSound: ${(performance.now() - startTime).toFixed(2)}ms`);
        hapticError();
        myStreakRef.current = 0; // Reset streak on error
        
        // Don't update grid for incorrect moves - let server handle it
      }
      
      // OPTIMISTIC: Update grid only for correct moves (we know it's correct locally)
      if (isCorrect) {
        // Clear errored cell tracking when cell becomes correct
        const cellKey = `${row}-${col}`;
        setErroredCells(prev => {
          const newSet = new Set(prev);
          newSet.delete(cellKey);
          return newSet;
        });
        
        console.log(`[PERF] Before setMyGrid: ${(performance.now() - startTime).toFixed(2)}ms`);
        // Create new grid with the number placed
        const newGrid = myGrid.map((r) => [...r]);
        newGrid[row][col] = num;
        const beforeSetState = performance.now();
        setMyGrid(newGrid);
        // Track cell placement time for TIME_SYNC throttling
        lastCellPlacementRef.current = Date.now();
        console.log(`[PERF] After setMyGrid (scheduled): ${(performance.now() - startTime).toFixed(2)}ms`);
        
        // Measure when React actually commits the render
        requestAnimationFrame(() => {
          const afterRAF = performance.now();
          console.log(`[PERF] After requestAnimationFrame (paint scheduled): ${(afterRAF - startTime).toFixed(2)}ms (${(afterRAF - beforeSetState).toFixed(2)}ms after setState)`);
          
          requestAnimationFrame(() => {
            const afterSecondRAF = performance.now();
            console.log(`[PERF] After second requestAnimationFrame (painted): ${(afterSecondRAF - startTime).toFixed(2)}ms (${(afterSecondRAF - beforeSetState).toFixed(2)}ms after setState)`);
          });
        });
      
        // DEFER expensive completion checks to avoid blocking paint
        // Use requestIdleCallback to run after paint, or setTimeout as fallback
        const deferCompletionCheck = () => {
          console.log(`[PERF] Deferred checkCompletions START: ${(performance.now() - startTime).toFixed(2)}ms`);
          checkCompletions(newGrid, row, col);
          console.log(`[PERF] Deferred checkCompletions END: ${(performance.now() - startTime).toFixed(2)}ms`);
        };
        
        if ('requestIdleCallback' in window) {
          requestIdleCallback(deferCompletionCheck, { timeout: 100 });
        } else {
          setTimeout(deferCompletionCheck, 0);
        }
        
        // OPTIMISTIC: Clear notes for this cell (batched with grid update)
        setNotes(prev => {
          const newNotes = new Map(prev);
          newNotes.delete(cellKey);
          return newNotes;
        });
      
        // Clear selection immediately (batched)
      setSelectedCell(null);
      
        // DEFER: Clear related notes AFTER visual update (non-blocking)
        const clearNotesRef = clearRelatedNotes;
        const deferClearNotes = () => {
          clearNotesRef(row, col, num);
        };
        if ('requestIdleCallback' in window) {
          requestIdleCallback(deferClearNotes, { timeout: 100 });
        } else {
          setTimeout(deferClearNotes, 0);
        }
      } else {
        // For incorrect moves, still clear selection but don't update grid
        console.log(`[PERF] Error path - before setSelectedCell(null): ${(performance.now() - startTime).toFixed(2)}ms`);
        setSelectedCell(null);
        console.log(`[PERF] Error path - after setSelectedCell(null): ${(performance.now() - startTime).toFixed(2)}ms`);
      }
      
      console.log(`[PERF] Before ws.send: ${(performance.now() - startTime).toFixed(2)}ms`);
      // Send to server (for synchronization, not validation - we already validated locally)
      if (wsRef.current) {
        wsRef.current.send(
          JSON.stringify({
            type: 'PLACE_NUMBER',
            data: {
              row,
              col,
              value: num,
            },
          })
        );
        console.log(`[PERF] After ws.send: ${(performance.now() - startTime).toFixed(2)}ms`);
      } else {
        console.log(`[PERF] wsRef.current is null, skipping send: ${(performance.now() - startTime).toFixed(2)}ms`);
      }
      
      console.log(`[PERF] Number click END: ${(performance.now() - startTime).toFixed(2)}ms`);
    }
  }, [selectedCell, gameStatus, myState?.is_locked, notesMode, initialGrid, solutionGrid, wsRef, clearRelatedNotes, triggerScoreFeedback, playIncorrectSound, hapticError]);

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
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="text-center">
          <div 
            className="w-12 h-12 rounded-full animate-spin mx-auto mb-4"
            style={{
              border: '3px solid rgba(139, 0, 255, 0.2)',
              borderTopColor: '#00FFFF',
            }}
          />
          <div className="text-primary text-lg font-body">Connecting to game...</div>
        </div>
      </div>
    );
  }


  // Game ended - check this BEFORE waiting screen to prevent stuck state
  // Also handle case where we have gameResult but status might be 'waiting' (safeguard)
  if (gameResult && (gameStatus === 'ended' || gameStatus === 'waiting')) {
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
    const isRanked = gameResult.is_ranked !== false; // Default to ranked if not set
    
    // Determine if I won based on winner_slot
    const didWin = winnerSlot !== null && winnerSlot === mySlot;
    // For unranked matches, rating_change should be 0
    const ratingChange = isRanked ? (myResult.rating_change || 0) : 0;
    const ratingBefore = myResult.rating_before || 1500;
    const ratingAfter = isRanked ? (myResult.rating_after || 1500) : ratingBefore;
    // Use cells_completed (includes pre-completed squares) instead of score
    const myScore = myResult.cellsCompleted || myResult.cells_completed || myResult.score || 0;
    const opponentScore = opponentResult.cellsCompleted || opponentResult.cells_completed || opponentResult.score || 0;

    // Prepare data for ResultScreen
    const myResultData = {
      playerId: myResult.playerId || 0,
      displayName: myResult.displayName,
      score: myScore,
      cellsCompleted: myScore,
      mistakes: myResult.mistakes || 0,
      timeRemaining: myResult.timeRemaining || 0,
      rating_before: ratingBefore,
      rating_after: ratingAfter,
      rating_change: ratingChange,
    };

    const opponentResultData = {
      playerId: opponentResult.playerId || 0,
      displayName: opponentResult.displayName || opponentName,
      score: opponentScore,
      cellsCompleted: opponentScore,
      mistakes: opponentResult.mistakes || 0,
      timeRemaining: opponentResult.timeRemaining || 0,
      rating_before: opponentResult.rating_before || 1500,
      rating_after: isRanked ? (opponentResult.rating_after || 1500) : (opponentResult.rating_before || 1500),
      rating_change: isRanked ? (opponentResult.rating_change || 0) : 0,
    };

    return (
      <ResultScreen
        didWin={didWin}
        isDraw={isDraw}
        reason={reason as 'PUZZLE_SOLVED' | 'TIMEOUT_SCORE' | 'DRAW' | 'FORFEIT'}
        myResult={myResultData}
        opponentResult={opponentResultData}
        isRanked={isRanked}
        onRematch={handleRematchRequest}
        onBackToLobby={onGameEnd}
        onFindNewMatch={onFindNewMatch || ((_matchId: number) => onGameEnd())}
        rematchState={rematchState}
        rematchCountdown={rematchCountdown}
      />
    );
  }

  // Waiting for opponent - only show if game hasn't ended
  if (gameStatus === 'waiting') {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="text-center">
          <div 
            className="w-12 h-12 rounded-full animate-spin mx-auto mb-4"
            style={{
              border: '3px solid rgba(139, 0, 255, 0.2)',
              borderTopColor: '#00FFFF',
            }}
          />
          <div className="text-primary text-lg font-body mb-1">Waiting for opponent</div>
          <div className="text-muted text-sm font-body">Please wait...</div>
        </div>
      </div>
    );
  }



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
    <div className={`min-h-screen bg-void flex flex-col relative ${showScreenShake ? 'screen-shake' : ''} ${showMicroShake ? 'micro-shake' : ''}`} style={{ paddingTop: '0px', paddingBottom: '0px', zIndex: 1 }}>
      {/* Battlefield Background */}
      <GameBackgroundEffects 
        playerScored={bgPlayerScored}
        opponentScored={bgOpponentScored}
        mistakeMade={bgMistakeMade}
        timeRemaining={myTimeRemaining}
        criticalTime={30}
      />

      {/* Countdown overlay */}
      {countdown !== null && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="text-8xl font-bold text-white animate-pulse">
              {countdown}
            </div>
            <div className="text-2xl text-white/80 mt-4">
              Get Ready!
            </div>
          </div>
        </div>
      )}

      {/* Critical state vignette */}
      {isCriticalState && (
        <div className="critical-vignette fixed inset-0 pointer-events-none z-40" />
      )}
      
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
          <div 
            className="rounded-lg p-4 shadow-lg"
            style={{
              background: 'rgba(255, 184, 0, 0.2)',
              border: '2px solid rgba(255, 184, 0, 0.5)',
              color: '#FFB800',
            }}
          >
            <div>
              <p className="font-semibold font-body">Opponent disconnected</p>
              <p className="text-sm opacity-90 font-body">
                Waiting {graceTimeRemaining}s for reconnection...
              </p>
              <p className="text-xs opacity-75 mt-1 font-body">Your timer is paused</p>
            </div>
            {/* Progress bar showing grace period */}
            <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255, 184, 0, 0.3)' }}>
              <div 
                className="h-full transition-all duration-1000"
                style={{ 
                  width: `${(graceTimeRemaining / 15) * 100}%`,
                  background: '#FFB800',
                }}
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
            className="p-2 text-muted hover:text-secondary transition-colors"
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
              <div className={`text-lg sm:text-xl ${isPlayerPremium ? 'premium-player-name' : 'non-premium-name'}`}>
                {user?.display_name || 'You'}
              </div>
              <div className="text-xs sm:text-sm text-muted font-mono">{Math.round(user?.rating || 1500)}</div>
            </div>
            {/* Right: Opponent */}
            <div className="flex items-center gap-2">
              <div className={`text-lg sm:text-xl ${isOpponentPremium ? 'premium-opponent-name' : 'non-premium-name'}`}>
                {opponentName}
              </div>
              <div className="text-xs sm:text-sm text-muted font-mono">
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
              <div className="text-xs sm:text-sm font-mono font-semibold text-player whitespace-nowrap">
                {myState.cells_completed}/81
              </div>
            </div>
            {/* Right: Opponent progress bar */}
            <div className="flex items-center gap-2">
              <div className="text-xs sm:text-sm font-mono font-semibold text-opponent whitespace-nowrap">
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
        <div className="px-3 sm:px-4 border-b border-grid-line relative" style={{ paddingTop: '0px', paddingBottom: '6px', marginTop: isCapacitor ? '8px' : '0px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '0px' }}>
            {/* Left: Player timer */}
            <div className="relative">
              <div className={`px-2 py-1 rounded-lg border-2 ${
                myTimeRemaining < 30 
                  ? 'bg-error/20 border-error' 
                  : 'bg-player/20 border-player'
              } ${myTimerPaused ? 'opacity-50' : ''}`}
                style={{
                  boxShadow: myTimeRemaining < 30 
                    ? '0 0 15px rgba(255,51,102,0.4)' 
                    : '0 0 15px rgba(0,255,255,0.3)',
                }}
              >
                <div className={`text-xl sm:text-2xl font-mono font-bold ${
                  myTimeRemaining < 30 ? 'text-error' : myTimeRemaining < 60 ? 'text-gold' : 'text-primary'
                }`}>
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
                    letterSpacing: '-0.1em',
                    background: 'rgba(255, 255, 255, 0.95)',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    boxShadow: '0 0 15px rgba(255, 255, 255, 0.5), 0 0 25px rgba(255, 255, 255, 0.3)',
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
                    letterSpacing: '-0.1em',
                    background: 'rgba(255, 255, 255, 0.95)',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    boxShadow: '0 0 15px rgba(255, 255, 255, 0.5), 0 0 25px rgba(255, 255, 255, 0.3)',
                  }}
                >
                  {opponentEmote}
                </div>
              )}
              <div className={`px-2 py-1 rounded-lg border-2 ${
                opponentTimeRemaining < 30 
                  ? 'bg-error/20 border-error' 
                  : 'bg-opponent/20 border-opponent'
              }`}
                style={{
                  boxShadow: opponentTimeRemaining < 30 
                    ? '0 0 15px rgba(255,51,102,0.4)' 
                    : '0 0 15px rgba(255,0,255,0.3)',
                }}
              >
                <div className={`text-xl sm:text-2xl font-mono font-bold ${
                  opponentTimeRemaining < 30 ? 'text-error' : 'text-opponent'
                }`}>
                  {formatTime(opponentTimeRemaining)}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* EVENT BANNER - Between timer and grid */}
        <div className="h-10 flex items-center justify-center">
          {bannerMessage && (
            <span 
              className="font-heading font-bold text-lg uppercase tracking-wider"
              style={{
                color: bannerMessage.type === 'positive' ? '#00FFFF' : bannerMessage.type === 'negative' ? '#FF3366' : '#FFFFFF',
                textShadow: bannerMessage.type === 'positive' 
                  ? '0 0 15px rgba(0, 255, 255, 0.6)' 
                  : bannerMessage.type === 'negative'
                  ? '0 0 15px rgba(255, 51, 102, 0.6)'
                  : '0 0 10px rgba(255, 255, 255, 0.4)',
              }}
            >
              {bannerMessage.text}
            </span>
          )}
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
                erroredCells={erroredCells}
              />
            </div>
          )}
        </div>
      </div>
      
      {/* Spacer to push number pad and toolbar below the grid */}
      <div className="flex-shrink-0" style={{ minHeight: '50vh' }}></div>

      {/* Number Pad - below grid */}
      <div className="px-3 pt-1 pb-1">
        <div className="grid grid-cols-9 gap-1.5 max-w-md mx-auto">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
            const count = digitCounts[num] || 0;
            const depleted = count >= 9;
            return (
              <button
                key={num}
                onClick={() => handleNumberClick(num)}
                disabled={gameStatus !== 'playing' || myState.is_locked || depleted}
                className="aspect-square rounded-lg transition-all touch-manipulation font-heading font-bold flex items-center justify-center"
                style={{
                  fontSize: 'clamp(1rem, 4vw, 1.5rem)',
                  background: depleted ? 'rgba(30, 20, 40, 0.3)' : 'transparent',
                  border: depleted ? '2px solid rgba(139, 0, 255, 0.2)' : '2px solid rgba(139, 0, 255, 0.6)',
                  color: depleted ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.95)',
                  boxShadow: depleted ? 'none' : '0 0 10px rgba(139, 0, 255, 0.2)',
                  minHeight: '44px',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {num}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toolbar OR Emoji Picker - they swap, same position */}
      <div className="px-3 py-1 pb-safe">
        {!showEmotePicker ? (
          <>
            {/* Normal Toolbar */}
            <div className="flex justify-center gap-3 max-w-md mx-auto">
            {/* Erase Button */}
            <button
              onClick={handleErase}
              disabled={!selectedCell || gameStatus !== 'playing' || myState.is_locked}
              className="flex-1 py-4 rounded-xl font-body font-semibold text-base transition-all touch-manipulation disabled:opacity-40"
              style={{
                background: 'rgba(20, 12, 30, 0.8)',
                border: '2px solid rgba(139, 0, 255, 0.5)',
                color: 'rgba(255, 255, 255, 0.9)',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              Erase
            </button>

            {/* Notes Button */}
            <button
              onClick={handleToggleNotes}
              className="flex-1 py-4 rounded-xl font-body font-semibold text-base transition-all touch-manipulation"
              style={{
                background: notesMode ? 'rgba(0, 255, 255, 0.2)' : 'rgba(20, 12, 30, 0.8)',
                border: notesMode ? '2px solid #00FFFF' : '2px solid rgba(139, 0, 255, 0.5)',
                color: notesMode ? '#00FFFF' : 'rgba(255, 255, 255, 0.9)',
                boxShadow: notesMode ? '0 0 15px rgba(0, 255, 255, 0.3)' : 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {notesMode ? 'Notes ON' : 'Notes'}
            </button>

            {/* Emote Button */}
            <button
              onClick={() => setShowEmotePicker(true)}
              className="flex-1 py-4 rounded-xl font-body font-semibold text-base transition-all touch-manipulation flex items-center justify-center"
              style={{
                background: 'rgba(20, 12, 30, 0.8)',
                border: '2px solid rgba(139, 0, 255, 0.5)',
                color: 'rgba(255, 255, 255, 0.9)',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              Emote
            </button>
          </div>
          </>
        ) : (
          <>
            {/* Emoji Picker - replaces toolbar */}
            <div className="flex justify-center gap-3 max-w-md mx-auto">
            {emotes.map((emote, index) => (
              <button
                key={index}
                onClick={() => {
                  handleSelectEmote(emote);
                  setShowEmotePicker(false);
                }}
                className="flex-1 py-3 rounded-xl transition-all active:scale-95 flex items-center justify-center"
                style={{
                  background: 'rgba(139, 0, 255, 0.2)',
                  border: '2px solid rgba(139, 0, 255, 0.5)',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span style={{ 
                  fontSize: '1.75rem', 
                  lineHeight: 1,
                  display: 'inline-flex',
                  flexDirection: 'row',
                  whiteSpace: 'nowrap',
                }}>
                  {emote}
                </span>
              </button>
            ))}
            {/* Close button */}
            <button
              onClick={() => setShowEmotePicker(false)}
              className="py-3 px-4 rounded-xl transition-all touch-manipulation flex items-center justify-center"
              style={{
                background: 'rgba(255, 51, 102, 0.2)',
                border: '2px solid rgba(255, 51, 102, 0.5)',
                color: '#FF3366',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              ✕
            </button>
          </div>
          </>
        )}
      </div>

      {/* Forfeit confirmation modal */}
      <ForfeitModal
        isOpen={showForfeitModal}
        onConfirm={handleForfeit}
        onCancel={() => setShowForfeitModal(false)}
      />
    </div>
  );
}
