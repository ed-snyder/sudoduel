import { useState, useEffect, useRef, useCallback, useMemo, useDeferredValue } from 'react';
import { useSoundEffects } from '../hooks/useSoundEffects';
import { useHaptics } from '../hooks/useHaptics';
import SudokuGrid from '../components/SudokuGrid';
import BackgroundEffects from '../components/BackgroundEffects';
import { dailyAPI } from '../services/api';
import { log } from '../utils/logger';

interface DailyRunPageProps {
  onExit: () => void;
}

export default function DailyRunPage({ onExit }: DailyRunPageProps) {
  const { playCorrect, playIncorrect, initAudio } = useSoundEffects();
  const { error: hapticError, impact } = useHaptics();
  
  // Grid state
  const [myGrid, setMyGrid] = useState<number[][]>([]);
  const [initialGrid, setInitialGrid] = useState<number[][]>([]);
  const [solutionGrid, setSolutionGrid] = useState<number[][]>([]);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  
  // Game state
  const [gameStatus, setGameStatus] = useState<'loading' | 'playing' | 'complete' | 'already_done'>('loading');
  const [_cellsCompleted, setCellsCompleted] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  
  // Timer state - COUNTS UP in milliseconds
  const [elapsedTimeMs, setElapsedTimeMs] = useState(0);
  const [penaltyTimeMs, setPenaltyTimeMs] = useState(0);
  const startTimeRef = useRef<number>(0);
  const penaltyTimeMsRef = useRef(0); // Ref to track penalty for win calculation
  
  // Result state
  const [previousResult, setPreviousResult] = useState<{ time_ms: number; rank: number } | null>(null);
  const [finalResult, setFinalResult] = useState<{ rank: number; total_players: number; time_ms: number } | null>(null);
  
  // Total time for display
  const totalTimeMs = elapsedTimeMs + penaltyTimeMs;
  
  // Visual feedback state
  const [lastMoveResult, setLastMoveResult] = useState<{ correct: boolean; row: number; col: number } | null>(null);
  const [completedCells, setCompletedCells] = useState<Set<string>>(new Set());
  const [erroredCells, setErroredCells] = useState<Set<string>>(new Set());
  const [lastScoredCell, setLastScoredCell] = useState<{ row: number; col: number } | null>(null);
  const [showMicroShake, setShowMicroShake] = useState(false);
  
  // Notes state
  const [notesMode, setNotesMode] = useState(false);
  const [notes, setNotes] = useState<Map<string, number[]>>(new Map());
  
  // Streak tracking
  const myStreakRef = useRef(0);
  const [_longestStreak, setLongestStreak] = useState(0);
  
  // Timer ref
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCellPlacementRef = useRef(0);
  
  // Initialize audio on mount
  useEffect(() => {
    initAudio();
  }, [initAudio]);
  
  // Load puzzle on mount
  useEffect(() => {
    loadPuzzle();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);
  
  const parseGridString = (str: string): number[][] => {
    const grid: number[][] = [];
    for (let i = 0; i < 9; i++) {
      grid.push([]);
      for (let j = 0; j < 9; j++) {
        grid[i].push(parseInt(str[i * 9 + j]) || 0);
      }
    }
    return grid;
  };
  
  const loadPuzzle = async () => {
    try {
      setGameStatus('loading');
      setError('');
      
      const response = await dailyAPI.getPuzzle();
      
      // Check if already completed today
      if (response.already_completed && response.previous_result) {
        setPreviousResult(response.previous_result);
        setGameStatus('already_done');
        return;
      }
      
      const initial = parseGridString(response.puzzle.initial_grid);
      const solution = parseGridString(response.puzzle.solution_grid);
      
      setInitialGrid(initial);
      setSolutionGrid(solution);
      setMyGrid(initial.map(row => [...row]));
      
      const initialCount = initial.flat().filter(n => n !== 0).length;
      setCellsCompleted(initialCount);
      
      setGameStatus('playing');
      setIsLocked(false);
      setElapsedTimeMs(0);
      setPenaltyTimeMs(0);
      penaltyTimeMsRef.current = 0;
      setSelectedCell(null);
      setNotes(new Map());
      setNotesMode(false);
      setLastMoveResult(null);
      setCompletedCells(new Set());
      setErroredCells(new Set());
      setLastScoredCell(null);
      myStreakRef.current = 0;
      setLongestStreak(0);
      
      startTimer();
    } catch (err: any) {
      setError(err.message || 'Failed to load puzzle');
      setGameStatus('loading');
    }
  };
  
  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    startTimeRef.current = Date.now();
    
    timerRef.current = setInterval(() => {
      setElapsedTimeMs(Date.now() - startTimeRef.current);
    }, 100); // Update every 100ms for smooth display
  };
  
  // Synchronized feedback function
  const triggerScoreFeedback = useCallback((streak: number, row: number, col: number) => {
    const now = performance.now();
    log.feedback(`Triggered at ${now}ms for streak ${streak}`);
    
    // 1. Haptic - stronger feedback
    if (streak >= 8) {
      impact('heavy');
      setTimeout(() => impact('heavy'), 80);
    } else if (streak >= 5) {
      impact('heavy');
    } else if (streak >= 3) {
      impact('medium');
    } else {
      impact('medium');
    }
    
    // 2. Sound (handles streak-based pitch automatically)
    playCorrect();
    
    // 3. Visual state updates
    setLastMoveResult({ correct: true, row, col });
    
    // 4. Cell pop animation
    setLastScoredCell({ row, col });
    setTimeout(() => setLastScoredCell(null), 300);
    
    // 5. Screen shake after 5 correct guesses
    if (streak >= 5) {
      setShowMicroShake(true);
      setTimeout(() => setShowMicroShake(false), 150);
    }
  }, [playCorrect, impact]);
  
  const handleCellClick = useCallback((row: number, col: number) => {
    if (gameStatus !== 'playing' || isLocked) {
      return;
    }
    
    // If tapping the same cell again, clear selection
    if (selectedCell && selectedCell.row === row && selectedCell.col === col) {
      setSelectedCell(null);
      return;
    }
    
    // Select the cell (works for empty cells and cells with numbers for highlighting)
    setSelectedCell({ row, col });
  }, [gameStatus, isLocked, selectedCell]);
  
  // Check for completed rows/columns/boxes
  const checkCompletions = useCallback((grid: number[][], row: number, col: number) => {
    const newCompletedCells = new Set<string>();
    
    if (!grid || grid.length === 0 || !grid[row]) return;
    
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
  
  // Calculate almost-complete cells
  const calculateAlmostCompleteCells = useCallback((grid: number[][]): Set<string> => {
    const result = new Set<string>();
    
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
  
  const deferredGrid = useDeferredValue(myGrid);
  const almostCompleteCells = useMemo(() => calculateAlmostCompleteCells(deferredGrid), [deferredGrid, calculateAlmostCompleteCells]);
  
  // Clear notes containing a value from the same row, column, and 3x3 box
  const clearRelatedNotes = useCallback((row: number, col: number, value: number) => {
    setNotes(prev => {
      const newNotes = new Map(prev);
      
      const boxStartRow = Math.floor(row / 3) * 3;
      const boxStartCol = Math.floor(col / 3) * 3;
      const boxEndRow = boxStartRow + 3;
      const boxEndCol = boxStartCol + 3;
      
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (r === row && c === col) continue;
          
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
    if (!selectedCell || gameStatus !== 'playing' || isLocked) {
      return;
    }
    
    const { row, col } = selectedCell;
    
    // Prevent placing numbers in initial clue cells
    if (initialGrid.length > 0 && initialGrid[row]?.[col] !== 0) {
      return;
    }
    
    if (notesMode) {
      // Notes mode: toggle the number in notes
      const cellKey = `${row}-${col}`;
      setNotes((prev) => {
        const newNotes = new Map(prev);
        const currentNotes = newNotes.get(cellKey) || [];
        
        if (currentNotes.includes(num)) {
          const updated = currentNotes.filter(n => n !== num);
          if (updated.length === 0) {
            newNotes.delete(cellKey);
          } else {
            newNotes.set(cellKey, updated);
          }
        } else {
          newNotes.set(cellKey, [...currentNotes, num].sort());
        }
        
        return newNotes;
      });
    } else {
      // Normal mode: place number
      const isCorrect = solutionGrid.length > 0 && solutionGrid[row]?.[col] === num;
      const wasEmpty = myGrid[row]?.[col] === 0;
      const isInitialClue = initialGrid.length > 0 && initialGrid[row]?.[col] !== 0;
      
      if (isCorrect) {
        // Update streak
        const newStreak = myStreakRef.current + 1;
        myStreakRef.current = newStreak;
        setLongestStreak((prevLongest) => Math.max(prevLongest, newStreak));
        
        // Trigger synchronized feedback
        triggerScoreFeedback(newStreak, row, col);
        
        // Update grid
        const newGrid = myGrid.map((r) => [...r]);
        newGrid[row][col] = num;
        setMyGrid(newGrid);
        lastCellPlacementRef.current = Date.now();
        
        // Clear errored cell tracking
        const cellKey = `${row}-${col}`;
        setErroredCells(prev => {
          const newSet = new Set(prev);
          newSet.delete(cellKey);
          return newSet;
        });
        
        // Defer completion checks
        const deferCompletionCheck = () => {
          checkCompletions(newGrid, row, col);
        };
        
        if ('requestIdleCallback' in window) {
          requestIdleCallback(deferCompletionCheck, { timeout: 100 });
        } else {
          setTimeout(deferCompletionCheck, 0);
        }
        
        // Clear notes for this cell
        setNotes(prev => {
          const newNotes = new Map(prev);
          newNotes.delete(cellKey);
          return newNotes;
        });
        
        // Clear selection
        setSelectedCell(null);
        
        // Defer clearing related notes
        const deferClearNotes = () => {
          clearRelatedNotes(row, col, num);
        };
        if ('requestIdleCallback' in window) {
          requestIdleCallback(deferClearNotes, { timeout: 100 });
        } else {
          setTimeout(deferClearNotes, 0);
        }
        
        // Update cells completed count and check for win
        setCellsCompleted(prev => {
          const newCount = prev + (wasEmpty && !isInitialClue ? 1 : 0);
          // Check for win (all 81 cells filled correctly)
          if (newCount >= 81) {
            if (timerRef.current) clearInterval(timerRef.current);
            
            const finalTime = (Date.now() - startTimeRef.current) + penaltyTimeMsRef.current;
            
            dailyAPI.submitResult(finalTime)
              .then(result => {
                setFinalResult(result);
                setGameStatus('complete');
              })
              .catch(err => {
                console.error('Failed to submit result:', err);
                setFinalResult({ rank: 0, total_players: 0, time_ms: finalTime });
                setGameStatus('complete');
              });
          }
          return newCount;
        });
      } else {
        // Incorrect move
        const cellKey = `${row}-${col}`;
        const isFirstError = !erroredCells.has(cellKey);
        
        setLastMoveResult({ correct: false, row, col });
        
        if (isFirstError) {
          setErroredCells(prev => new Set(prev).add(cellKey));
        }
        
        // Play incorrect sound (also resets streak internally)
        playIncorrect();
        hapticError();
        myStreakRef.current = 0;
        
        // Clear selection
        setSelectedCell(null);
        
        // ADD 30 seconds penalty
        setPenaltyTimeMs(prev => prev + 30000);
        penaltyTimeMsRef.current += 30000;
      }
    }
  }, [selectedCell, gameStatus, isLocked, notesMode, initialGrid, solutionGrid, myGrid, erroredCells, triggerScoreFeedback, playIncorrect, hapticError, clearRelatedNotes, checkCompletions]);
  
  const handleErase = () => {
    if (!selectedCell || gameStatus !== 'playing' || isLocked) return;
    
    const { row, col } = selectedCell;
    
    // Can't erase initial clues
    if (initialGrid[row]?.[col] !== 0) return;
    
    // Can only erase if cell has a value
    const currentValue = myGrid[row]?.[col];
    if (currentValue === 0) {
      // Clear notes if any
      const cellKey = `${row}-${col}`;
      setNotes((prev) => {
        const newNotes = new Map(prev);
        newNotes.delete(cellKey);
        return newNotes;
      });
      return;
    }
    
    // Erase the cell
    setMyGrid(prev => {
      const newGrid = prev.map(r => [...r]);
      newGrid[row][col] = 0;
      return newGrid;
    });
    
    // Update cells completed count
    setCellsCompleted(prev => prev - 1);
    
    // Clear notes for this cell
    const cellKey = `${row}-${col}`;
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
  
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${tenths}`;
  };
  
  // Calculate digit counts for number pad depletion styling
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
  
  // Clear last move result after animation
  useEffect(() => {
    if (lastMoveResult) {
      const timer = setTimeout(() => setLastMoveResult(null), 500);
      return () => clearTimeout(timer);
    }
  }, [lastMoveResult]);
  
  const [error, setError] = useState('');
  
  if (gameStatus === 'loading') {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="text-center">
          <div 
            className="w-12 h-12 rounded-full animate-spin mx-auto mb-4"
            style={{
              border: '3px solid rgba(139, 0, 255, 0.3)',
              borderTopColor: '#00FFFF',
            }}
          />
          <div className="text-player text-xl font-display">Loading puzzle...</div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-void flex flex-col items-center justify-center gap-4">
        <div className="text-error text-xl font-display">{error}</div>
        <button
          onClick={onExit}
          className="px-6 py-3 bg-surface border border-player text-player rounded-lg font-display font-bold"
        >
          Back to Lobby
        </button>
      </div>
    );
  }
  
  return (
    <div className={`min-h-screen bg-void flex flex-col relative overflow-hidden ${showMicroShake ? 'animate-micro-shake' : ''}`}>
      <BackgroundEffects />
      
      {/* Header */}
      <div className="flex-shrink-0" style={{ marginTop: '48px', paddingBottom: '0px' }}>
        <div className="flex justify-between items-center px-3 sm:px-4" style={{ paddingTop: '0px', paddingBottom: '4px' }}>
          <button
            onClick={onExit}
            className="p-2 text-muted hover:text-secondary transition-colors"
            aria-label="Exit"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className="text-center">
            <div className="text-xs text-muted font-body uppercase tracking-wider">Daily Run</div>
            <div 
              className="text-2xl font-mono font-bold text-player"
              style={{ textShadow: '0 0 15px rgba(0, 255, 255, 0.5)' }}
            >
              {formatTime(totalTimeMs)}
            </div>
            {penaltyTimeMs > 0 && (
              <div className="text-xs text-error font-mono">
                +{Math.floor(penaltyTimeMs / 1000)}s penalties
              </div>
            )}
          </div>
          
          <div className="w-12" />
        </div>
      </div>
      
      {/* Sudoku Grid - Centered */}
      <div className="absolute left-0 right-0 flex justify-center items-center px-2 sm:px-4" style={{ top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 1 }}>
        <div 
          className={`relative w-full max-w-full ${
            isLocked ? 'pointer-events-none opacity-50' : ''
          } ${
            gameStatus !== 'playing' ? 'pointer-events-none' : ''
          }`}
          style={{ 
            pointerEvents: gameStatus !== 'playing' ? 'none' : 'auto',
            transition: 'opacity 0.2s ease-out',
          }}
        >
          {myGrid.length > 0 && (
            <div className="w-full flex justify-center">
              <SudokuGrid
                grid={myGrid}
                initialGrid={initialGrid}
                selectedCell={selectedCell}
                onCellClick={handleCellClick}
                notes={notes}
                notesMode={notesMode}
                lockedOut={isLocked || gameStatus !== 'playing'}
                animateIn={false}
                countdownPhase="complete"
                lastMoveResult={lastMoveResult}
                opponentScoredCells={new Set()}
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
      
      {/* Number Pad - positioned at bottom like multiplayer mode */}
      {gameStatus === 'playing' && (
        <div 
          className="absolute left-0 right-0 px-3 pt-1 pb-1"
          style={{ 
            bottom: '120px', // Space for toolbar below
            zIndex: 100,
            pointerEvents: 'auto',
          }}
        >
          <div className="grid grid-cols-9 w-full">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
              const count = digitCounts[num] || 0;
              const depleted = count >= 9;
              return (
                <button
                  key={num}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleNumberClick(num);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                  }}
                  disabled={gameStatus !== 'playing' || isLocked || depleted}
                  className="py-3 touch-manipulation font-heading font-bold flex items-center justify-center transition-none active:scale-95 active:text-player active:ring-2 active:ring-player active:ring-offset-0"
                  style={{
                    fontSize: 'clamp(1.5rem, 7vw, 2.25rem)',
                    color: depleted ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.95)',
                    WebkitTapHighlightColor: 'transparent',
                    outline: 'none',
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                  }}
                >
                  {num}
                </button>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Toolbar - positioned at bottom */}
      {gameStatus === 'playing' && (
        <div 
          className="absolute left-0 right-0 px-3 py-1 pb-safe"
          style={{ 
            bottom: 0,
            zIndex: 100,
            pointerEvents: 'auto',
          }}
        >
          <div className="flex justify-center gap-3 max-w-md mx-auto">
            {/* Erase Button */}
            <button
              onClick={handleErase}
              disabled={!selectedCell || gameStatus !== 'playing' || isLocked}
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
          </div>
        </div>
      )}
      
      {/* Completion Screen */}
      {gameStatus === 'complete' && finalResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/95">
          <div className="text-center space-y-6 px-4">
            <h1 
              className="text-4xl sm:text-5xl font-display font-black text-success"
              style={{ textShadow: '0 0 30px rgba(0, 255, 136, 0.5)' }}
            >
              DAILY RUN COMPLETE!
            </h1>
            
            <div 
              className="text-5xl font-mono font-bold text-player"
              style={{ textShadow: '0 0 20px rgba(0, 255, 255, 0.5)' }}
            >
              {formatTime(finalResult.time_ms)}
            </div>
            
            {finalResult.rank > 0 && (
              <div className="text-center">
                <div className="text-3xl font-display font-black text-secondary">
                  #{finalResult.rank}
                </div>
                <div className="text-muted">
                  of {finalResult.total_players} player{finalResult.total_players !== 1 ? 's' : ''} today
                </div>
              </div>
            )}
            
            <p className="text-muted">New puzzle at midnight UTC</p>
            
            <button
              onClick={onExit}
              className="px-8 py-3 bg-surface border-2 border-player text-player rounded-lg font-display font-bold hover:bg-player/10 transition-colors"
            >
              Back to Lobby
            </button>
          </div>
        </div>
      )}
      
      {/* Already Completed Screen */}
      {gameStatus === 'already_done' && previousResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/95">
          <div className="text-center space-y-6 px-4">
            <h1 
              className="text-4xl sm:text-5xl font-display font-black text-secondary"
              style={{ textShadow: '0 0 30px rgba(139, 0, 255, 0.5)' }}
            >
              ALREADY COMPLETED!
            </h1>
            
            <div 
              className="text-5xl font-mono font-bold text-player"
              style={{ textShadow: '0 0 20px rgba(0, 255, 255, 0.5)' }}
            >
              {formatTime(previousResult.time_ms)}
            </div>
            
            <div className="text-xl font-display text-muted">
              You placed <span className="text-player font-black">#{previousResult.rank}</span>
            </div>
            
            <p className="text-muted">New puzzle available at midnight UTC</p>
            
            <button
              onClick={onExit}
              className="px-8 py-3 bg-surface border-2 border-player text-player rounded-lg font-display font-bold hover:bg-player/10 transition-colors"
            >
              Back to Lobby
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
