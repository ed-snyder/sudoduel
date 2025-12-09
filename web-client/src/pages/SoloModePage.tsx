import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { puzzleAPI } from '../services/api';
import SudokuGrid from '../components/SudokuGrid';
import BackgroundEffects from '../components/BackgroundEffects';
import { STARTING_TIME_SECONDS, TIME_BONUS_CORRECT, TIME_PENALTY_INCORRECT } from '../constants';

interface SoloModePageProps {
  onExit: () => void;
}

export default function SoloModePage({ onExit }: SoloModePageProps) {
  const { } = useAuth();
  
  // Puzzle state
  const [initialGrid, setInitialGrid] = useState<number[][]>([]);
  const [solutionGrid, setSolutionGrid] = useState<number[][]>([]);
  const [myGrid, setMyGrid] = useState<number[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Game state
  const [gameStatus, setGameStatus] = useState<'loading' | 'playing' | 'won' | 'lost'>('loading');
  const [timeRemaining, setTimeRemaining] = useState(STARTING_TIME_SECONDS);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [, setCellsCompleted] = useState(0); // Used in setter for win condition check
  const [notes, setNotes] = useState<Map<string, number[]>>(new Map());
  const [notesMode, setNotesMode] = useState(false);
  
  // Timer ref
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Load puzzle on mount
  useEffect(() => {
    loadPuzzle();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);
  
  const loadPuzzle = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch random puzzle with solution for solo mode
      const response = await puzzleAPI.getRandom();
      
      // Parse grids (assuming they come as strings of 81 chars)
      const initial = parseGrid(response.initial_grid);
      const solution = parseGrid(response.solution_grid);
      
      setInitialGrid(initial);
      setSolutionGrid(solution);
      setMyGrid(initial.map(row => [...row]));
      
      // Count initial cells
      const initialCount = initial.flat().filter(n => n !== 0).length;
      setCellsCompleted(initialCount);
      
      setGameStatus('playing');
      setLoading(false);
      
      // Start timer
      startTimer();
    } catch (err: any) {
      setError(err.message || 'Failed to load puzzle');
      setLoading(false);
    }
  };
  
  const parseGrid = (gridString: string): number[][] => {
    const grid: number[][] = [];
    for (let i = 0; i < 9; i++) {
      const row: number[] = [];
      for (let j = 0; j < 9; j++) {
        row.push(parseInt(gridString[i * 9 + j]) || 0);
      }
      grid.push(row);
    }
    return grid;
  };
  
  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Time's up - lose
          if (timerRef.current) clearInterval(timerRef.current);
          setGameStatus('lost');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };
  
  const handleCellClick = useCallback((row: number, col: number) => {
    if (gameStatus !== 'playing') return;
    if (initialGrid[row]?.[col] !== 0) return; // Can't select initial clues
    
    if (selectedCell?.row === row && selectedCell?.col === col) {
      setSelectedCell(null);
    } else {
      setSelectedCell({ row, col });
    }
  }, [gameStatus, initialGrid, selectedCell]);
  
  const handleNumberClick = useCallback((num: number) => {
    if (gameStatus !== 'playing' || !selectedCell) return;
    
    const { row, col } = selectedCell;
    
    // Can't modify initial clues
    if (initialGrid[row]?.[col] !== 0) return;
    
    if (notesMode) {
      // Toggle note
      const cellKey = `${row}-${col}`;
      setNotes(prev => {
        const newNotes = new Map(prev);
        const current = newNotes.get(cellKey) || [];
        if (current.includes(num)) {
          const updated = current.filter(n => n !== num);
          if (updated.length === 0) {
            newNotes.delete(cellKey);
          } else {
            newNotes.set(cellKey, updated);
          }
        } else {
          newNotes.set(cellKey, [...current, num].sort());
        }
        return newNotes;
      });
    } else {
      // Place number
      const isCorrect = solutionGrid[row]?.[col] === num;
      
      // Update grid
      setMyGrid(prev => {
        const newGrid = prev.map(r => [...r]);
        newGrid[row][col] = num;
        return newGrid;
      });
      
      // Clear notes for this cell
      const cellKey = `${row}-${col}`;
      setNotes(prev => {
        const newNotes = new Map(prev);
        newNotes.delete(cellKey);
        return newNotes;
      });
      
      if (isCorrect) {
        // +5 seconds
        setTimeRemaining(prev => prev + TIME_BONUS_CORRECT);
        setCellsCompleted(prev => {
          const newCount = prev + 1;
          // Check for win (81 cells filled correctly)
          if (newCount >= 81) {
            if (timerRef.current) clearInterval(timerRef.current);
            setGameStatus('won');
          }
          return newCount;
        });
      } else {
        // -30 seconds
        setTimeRemaining(prev => {
          const newTime = Math.max(0, prev - TIME_PENALTY_INCORRECT);
          if (newTime <= 0) {
            if (timerRef.current) clearInterval(timerRef.current);
            setGameStatus('lost');
          }
          return newTime;
        });
      }
    }
  }, [gameStatus, selectedCell, initialGrid, solutionGrid, notesMode]);
  
  const handlePlayAgain = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeRemaining(STARTING_TIME_SECONDS);
    setSelectedCell(null);
    setNotes(new Map());
    setNotesMode(false);
    setGameStatus('loading');
    loadPuzzle();
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Calculate digit counts for number pad
  const digitCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let i = 1; i <= 9; i++) counts[i] = 0;
    myGrid.forEach(row => {
      row.forEach(cell => {
        if (cell !== 0) counts[cell]++;
      });
    });
    return counts;
  }, [myGrid]);

  if (loading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="text-player text-xl font-display">Loading puzzle...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-void flex flex-col items-center justify-center gap-4">
        <div className="text-error text-xl font-display">{error}</div>
        <button
          onClick={onExit}
          className="px-6 py-3 bg-surface border border-player text-player rounded-lg"
        >
          Back to Lobby
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void flex flex-col">
      <BackgroundEffects />
      
      {/* Header */}
      <div className="flex justify-between items-center p-4 relative z-10">
        <button
          onClick={onExit}
          className="text-muted hover:text-player transition-colors"
        >
          ← Exit
        </button>
        
        <div className="text-center">
          <div className="text-xs text-muted font-body uppercase tracking-wider">Solo Mode</div>
          <div 
            className="text-2xl font-mono font-bold text-player"
            style={{ textShadow: '0 0 15px rgba(0,255,255,0.5)' }}
          >
            {formatTime(timeRemaining)}
          </div>
        </div>
        
        <div className="w-12" /> {/* Spacer for centering */}
      </div>
      
      {/* Game area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative z-10">
        {gameStatus === 'playing' && (
          <>
            <SudokuGrid
              grid={myGrid}
              initialGrid={initialGrid}
              selectedCell={selectedCell}
              onCellClick={handleCellClick}
              notes={notes}
              notesMode={notesMode}
              lockedOut={false}
              animateIn={false}
              countdownPhase="complete"
            />
            
            {/* Number pad */}
            <div className="mt-6 grid grid-cols-9 gap-1.5 max-w-md w-full">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => {
                const depleted = digitCounts[num] >= 9;
                return (
                  <button
                    key={num}
                    onClick={() => handleNumberClick(num)}
                    disabled={depleted}
                    className="aspect-square rounded-lg font-heading font-bold transition-all touch-manipulation"
                    style={{
                      fontSize: 'clamp(1rem, 4vw, 1.5rem)',
                      background: depleted ? 'rgba(30, 20, 40, 0.3)' : 'transparent',
                      border: depleted ? '2px solid rgba(139, 0, 255, 0.2)' : '2px solid rgba(139, 0, 255, 0.6)',
                      color: depleted ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.95)',
                      boxShadow: depleted ? 'none' : '0 0 10px rgba(139, 0, 255, 0.2)',
                      minHeight: '44px',
                    }}
                  >
                    {num}
                  </button>
                );
              })}
            </div>
            
            {/* Notes toggle */}
            <button
              onClick={() => setNotesMode(!notesMode)}
              className={`mt-4 px-6 py-2 rounded-lg font-body transition-all ${
                notesMode 
                  ? 'bg-player/20 border-2 border-player text-player' 
                  : 'bg-surface border-2 border-grid-line text-secondary'
              }`}
            >
              Notes {notesMode ? 'ON' : 'OFF'}
            </button>
          </>
        )}
        
        {/* Win/Lose screens */}
        {(gameStatus === 'won' || gameStatus === 'lost') && (
          <div className="text-center space-y-6">
            <h1 
              className={`text-4xl font-display font-black ${
                gameStatus === 'won' ? 'text-success' : 'text-error'
              }`}
              style={{ 
                textShadow: gameStatus === 'won' 
                  ? '0 0 30px rgba(0, 255, 136, 0.5)' 
                  : '0 0 30px rgba(255, 51, 102, 0.5)'
              }}
            >
              {gameStatus === 'won' ? 'PUZZLE COMPLETE!' : 'TIME\'S UP!'}
            </h1>
            
            <p className="text-secondary font-body">
              {gameStatus === 'won' 
                ? `Finished with ${formatTime(timeRemaining)} remaining`
                : 'Better luck next time!'
              }
            </p>
            
            <div className="flex gap-4 justify-center">
              <button
                onClick={handlePlayAgain}
                className="px-6 py-3 bg-player/20 border-2 border-player text-player font-display font-bold rounded-lg hover:bg-player/30 transition-all"
              >
                Play Again
              </button>
              <button
                onClick={onExit}
                className="px-6 py-3 bg-surface border-2 border-grid-line text-secondary font-display font-bold rounded-lg hover:border-player hover:text-player transition-all"
              >
                Back to Lobby
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
