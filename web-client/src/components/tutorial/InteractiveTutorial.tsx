import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import SudokuGrid from '../SudokuGrid';
import { ProgressBar } from '../ProgressBar';
import TutorialProgress from './TutorialProgress';
import TutorialMessage from './TutorialMessage';
import { useSoundEffects } from '../../hooks/useSoundEffects';
import { useHaptics } from '../../hooks/useHaptics';
import { playerAPI } from '../../services/api';
import type { TutorialPhase } from './tutorialData';
import { 
  TUTORIAL_GRID, 
  TUTORIAL_SOLUTION, 
  TUTORIAL_INITIAL_GRID,
  TUTORIAL_CELLS,
} from './tutorialData';
import './InteractiveTutorial.css';

interface InteractiveTutorialProps {
  onComplete: () => void;
  onSkip: () => void;
  onSkillSelect?: (level: 'beginner' | 'experienced') => Promise<void>;
  isReplay?: boolean;
}

export default function InteractiveTutorial({ 
  onComplete, 
  onSkip, 
  onSkillSelect,
  isReplay = false,
}: InteractiveTutorialProps) {
  // Core state
  const [phase, setPhase] = useState<TutorialPhase>('intro');
  const [grid, setGrid] = useState<number[][]>(() => 
    TUTORIAL_GRID.map(row => [...row])
  );
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [notes] = useState<Map<string, number[]>>(new Map());
  const [lastMoveResult, setLastMoveResult] = useState<{ row: number; col: number; correct: boolean } | null>(null);
  
  // Tutorial-specific state
  const [fakeTimer, setFakeTimer] = useState(120);
  const [fakeOpponentProgress, setFakeOpponentProgress] = useState(45);
  const [fakeOpponentTimer, setFakeOpponentTimer] = useState(115);
  const [practiceCount, setPracticeCount] = useState(0);
  const [showTimerDelta, setShowTimerDelta] = useState<{ value: number; key: number } | null>(null);
  const [showLockoutSplash, setShowLockoutSplash] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [showShake, setShowShake] = useState(false);
  const [highlightedNumber, setHighlightedNumber] = useState<number | null>(null);
  const [highlightedCell, setHighlightedCell] = useState<{ row: number; col: number } | null>(null);
  
  // Refs
  const timerDeltaKeyRef = useRef(0);
  const autoAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockoutIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const opponentProgressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Hooks
  const { 
    playCellTap, 
    playCorrect, 
    playIncorrect, 
    playLockout,
    playButtonTap,
  } = useSoundEffects();
  const { impact, error: hapticError } = useHaptics();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
      if (lockoutIntervalRef.current) clearInterval(lockoutIntervalRef.current);
      if (opponentProgressIntervalRef.current) clearInterval(opponentProgressIntervalRef.current);
    };
  }, []);

  // Format time as M:SS
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(Math.max(0, seconds) / 60);
    const secs = Math.max(0, seconds) % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Auto-advance for intro phase only
  useEffect(() => {
    if (phase === 'intro') {
      const timeoutId = setTimeout(() => {
        setPhase('tap-cell');
      }, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [phase]);

  // Set up highlights based on phase
  useEffect(() => {
    switch (phase) {
      case 'tap-cell':
        setHighlightedCell(TUTORIAL_CELLS.firstCell);
        setHighlightedNumber(null);
        break;
      case 'enter-number':
        setHighlightedNumber(TUTORIAL_CELLS.firstCell.answer);
        setHighlightedCell(null);
        break;
      case 'practice-more':
        if (practiceCount === 0) {
          setHighlightedCell(TUTORIAL_CELLS.practiceCell1);
        } else if (practiceCount === 1) {
          setHighlightedCell(TUTORIAL_CELLS.practiceCell2);
        }
        setHighlightedNumber(null);
        break;
      case 'force-mistake':
        setSelectedCell(TUTORIAL_CELLS.mistakeCell);
        setHighlightedNumber(TUTORIAL_CELLS.mistakeCell.wrongAnswer);
        setHighlightedCell(null);
        break;
      default:
        setHighlightedCell(null);
        setHighlightedNumber(null);
    }
  }, [phase, practiceCount]);

  // Lockout demo animation
  useEffect(() => {
    if (phase === 'lockout-demo') {
      setFakeTimer(10);
      
      lockoutIntervalRef.current = setInterval(() => {
        setFakeTimer(prev => {
          if (prev <= 1) {
            if (lockoutIntervalRef.current) clearInterval(lockoutIntervalRef.current);
            playLockout();
            hapticError();
            setShowLockoutSplash(true);
            return 0;
          }
          return prev - 1;
        });
      }, 300); // Fast countdown for demo
    }
    return () => {
      if (lockoutIntervalRef.current) clearInterval(lockoutIntervalRef.current);
    };
  }, [phase, playLockout, hapticError]);

  // Opponent progress demo animation
  useEffect(() => {
    if (phase === 'opponent-progress-demo') {
      setFakeOpponentProgress(45);
      
      opponentProgressIntervalRef.current = setInterval(() => {
        setFakeOpponentProgress(prev => {
          if (prev >= 75) {
            if (opponentProgressIntervalRef.current) clearInterval(opponentProgressIntervalRef.current);
            autoAdvanceTimeoutRef.current = setTimeout(() => {
              setPhase('win-conditions');
            }, 1000);
            return 75;
          }
          return prev + 2;
        });
        setFakeOpponentTimer(prev => Math.max(100, prev - 1));
      }, 150);
    }
    return () => {
      if (opponentProgressIntervalRef.current) clearInterval(opponentProgressIntervalRef.current);
    };
  }, [phase]);

  // Handle cell click
  const handleCellClick = useCallback((row: number, col: number) => {
    // Only allow clicking empty cells
    if (TUTORIAL_INITIAL_GRID[row][col] !== 0) return;
    
    // Check if this cell is already filled
    if (grid[row][col] !== 0) return;

    playCellTap();
    impact('light');
    setSelectedCell({ row, col });

    // Phase-specific behavior
    if (phase === 'tap-cell') {
      if (row === TUTORIAL_CELLS.firstCell.row && col === TUTORIAL_CELLS.firstCell.col) {
        setPhase('enter-number');
      }
    } else if (phase === 'practice-more') {
      // Allow selecting practice cells
      if (practiceCount === 0 && row === TUTORIAL_CELLS.practiceCell1.row && col === TUTORIAL_CELLS.practiceCell1.col) {
        setHighlightedNumber(TUTORIAL_CELLS.practiceCell1.answer);
      } else if (practiceCount === 1 && row === TUTORIAL_CELLS.practiceCell2.row && col === TUTORIAL_CELLS.practiceCell2.col) {
        setHighlightedNumber(TUTORIAL_CELLS.practiceCell2.answer);
      }
    }
  }, [phase, grid, practiceCount, playCellTap, impact]);

  // Handle number click
  const handleNumberClick = useCallback((num: number) => {
    if (!selectedCell) return;
    
    const { row, col } = selectedCell;
    const correctAnswer = TUTORIAL_SOLUTION[row][col];
    const isCorrect = num === correctAnswer;

    if (phase === 'enter-number') {
      if (isCorrect) {
        // Correct answer
        playCorrect();
        impact('medium');
        
        setGrid(prev => {
          const newGrid = prev.map(r => [...r]);
          newGrid[row][col] = num;
          return newGrid;
        });
        
        setLastMoveResult({ row, col, correct: true });
        setPhase('correct-feedback');
        
        // Show timer increase
        timerDeltaKeyRef.current++;
        setShowTimerDelta({ value: 5, key: timerDeltaKeyRef.current });
        setFakeTimer(prev => prev + 5);
        
        setTimeout(() => setShowTimerDelta(null), 1500);
        
        // Auto-advance after feedback
        autoAdvanceTimeoutRef.current = setTimeout(() => {
          setLastMoveResult(null);
          setPhase('practice-more');
          setSelectedCell(null);
        }, 1500);
      }
    } else if (phase === 'practice-more') {
      if (isCorrect) {
        playCorrect();
        impact('medium');
        
        setGrid(prev => {
          const newGrid = prev.map(r => [...r]);
          newGrid[row][col] = num;
          return newGrid;
        });
        
        setLastMoveResult({ row, col, correct: true });
        
        // Show timer increase
        timerDeltaKeyRef.current++;
        setShowTimerDelta({ value: 5, key: timerDeltaKeyRef.current });
        setFakeTimer(prev => prev + 5);
        setTimeout(() => setShowTimerDelta(null), 1500);
        
        setPracticeCount(prev => {
          const newCount = prev + 1;
          if (newCount >= 2) {
            // Done with practice, move to mistake demo
            autoAdvanceTimeoutRef.current = setTimeout(() => {
              setLastMoveResult(null);
              setPhase('force-mistake');
            }, 1000);
          }
          return newCount;
        });
        
        setSelectedCell(null);
        setHighlightedNumber(null);
      }
    } else if (phase === 'force-mistake') {
      if (num === TUTORIAL_CELLS.mistakeCell.wrongAnswer) {
        // Forced mistake - handle feedback ourselves, don't pass to SudokuGrid
        // (SudokuGrid would play its own sounds and show -30s animation)
        playIncorrect();
        hapticError();
        setShowShake(true);
        setTimeout(() => setShowShake(false), 400);
        
        // Show timer decrease (tutorial uses -5s, not -30s like real game)
        timerDeltaKeyRef.current++;
        setShowTimerDelta({ value: -5, key: timerDeltaKeyRef.current });
        setFakeTimer(prev => Math.max(0, prev - 5));
        setTimeout(() => setShowTimerDelta(null), 1500);
        
        setPhase('mistake-feedback');
        
        autoAdvanceTimeoutRef.current = setTimeout(() => {
          setSelectedCell(null);
        }, 2000);
      }
    }
  }, [selectedCell, phase, playCorrect, playIncorrect, impact, hapticError]);

  // Phase advancement handlers
  const advancePhase = useCallback((nextPhase: TutorialPhase) => {
    playButtonTap();
    setPhase(nextPhase);
  }, [playButtonTap]);

  // Handle skill selection
  const handleSkillSelect = useCallback(async (level: 'beginner' | 'experienced') => {
    playButtonTap();
    impact('medium');
    
    if (onSkillSelect) {
      try {
        await onSkillSelect(level);
      } catch (error) {
        console.error('Failed to set skill level:', error);
      }
    }
    
    setPhase('ready');
  }, [onSkillSelect, playButtonTap, impact]);

  // Handle tutorial complete
  const handleComplete = useCallback(async () => {
    playButtonTap();
    impact('heavy');
    
    try {
      await playerAPI.markTutorialComplete();
      localStorage.setItem('sudoduel_tutorial_completed', 'true');
      onComplete();
    } catch (error) {
      console.error('Failed to mark tutorial complete:', error);
      localStorage.setItem('sudoduel_tutorial_completed', 'true');
      onComplete();
    }
  }, [onComplete, playButtonTap, impact]);

  // Handle skip
  const handleSkip = useCallback(async () => {
    setShowSkipConfirm(false);
    
    try {
      await playerAPI.markTutorialComplete();
      localStorage.setItem('sudoduel_tutorial_completed', 'true');
      onSkip();
    } catch (error) {
      console.error('Failed to mark tutorial complete:', error);
      localStorage.setItem('sudoduel_tutorial_completed', 'true');
      onSkip();
    }
  }, [onSkip]);

  // Calculate progress percentages
  const myProgress = useMemo(() => {
    const filledCells = grid.flat().filter(c => c !== 0).length;
    return Math.round((filledCells / 81) * 100);
  }, [grid]);

  // Render phase-specific content
  const renderPhaseContent = () => {
    switch (phase) {
      case 'intro':
        return (
          <TutorialMessage 
            message="Let's learn how to play Sudoduel"
            position="center"
          />
        );

      case 'tap-cell':
        return (
          <TutorialMessage 
            message="Tap the highlighted cell to select it"
            position="bottom"
          />
        );

      case 'enter-number':
        return (
          <TutorialMessage 
            message={`Now tap ${TUTORIAL_CELLS.firstCell.answer} to fill the cell`}
            position="bottom"
          />
        );

      case 'correct-feedback':
        return (
          <TutorialMessage 
            message="Nice! Correct answers add time ✓"
            subMessage="+5 seconds"
            position="bottom"
          />
        );

      case 'practice-more':
        return (
          <TutorialMessage 
            message={`Fill in ${2 - practiceCount} more cell${practiceCount === 1 ? '' : 's'} to practice`}
            position="bottom"
          />
        );

      case 'force-mistake':
        return (
          <TutorialMessage 
            message={`What happens if you're wrong? Tap ${TUTORIAL_CELLS.mistakeCell.wrongAnswer} to find out`}
            position="bottom"
          />
        );

      case 'mistake-feedback':
        return (
          <TutorialMessage 
            message="Mistakes cost you time!"
            subMessage="But don't worry—the cell resets so you can try again"
            showNext
            onNext={() => advancePhase('timer-explanation')}
            position="bottom"
          />
        );

      case 'timer-explanation':
        return (
          <TutorialMessage 
            message="This is your time bank"
            subMessage="Every correct answer adds time. Every mistake costs time."
            showNext
            onNext={() => advancePhase('lockout-demo')}
            position="bottom"
          />
        );

      case 'lockout-demo':
        return (
          <>
            {showLockoutSplash && (
              <div className="fixed inset-0 z-[2520] flex items-center justify-center bg-void/90">
                <div className="text-center lockout-splash-enter">
                  <h2 
                    className="font-heading font-black text-4xl text-error mb-4"
                    style={{ textShadow: '0 0 30px rgba(255, 51, 102, 0.8)' }}
                  >
                    LOCKED OUT!
                  </h2>
                  <p className="font-body text-secondary mb-6">
                    You can only watch and send emotes
                  </p>
                  <button
                    onClick={() => {
                      setShowLockoutSplash(false);
                      setFakeTimer(120);
                      advancePhase('opponent-intro');
                    }}
                    className="py-3 px-8 rounded-xl font-body font-semibold transition-all active:scale-[0.98]"
                    style={{
                      background: 'rgba(0, 255, 255, 0.1)',
                      border: '2px solid rgba(0, 255, 255, 0.5)',
                      color: '#00FFFF',
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
            {!showLockoutSplash && (
              <TutorialMessage 
                message="If your timer hits zero, you're locked out!"
                position="bottom"
              />
            )}
          </>
        );

      case 'opponent-intro':
        return (
          <TutorialMessage 
            message="Your opponent solves the same puzzle"
            subMessage="You can't see their grid, but you can see their progress"
            showNext
            onNext={() => advancePhase('opponent-progress-demo')}
            position="bottom"
          />
        );

      case 'opponent-progress-demo':
        return (
          <TutorialMessage 
            message="Race to finish first!"
            position="bottom"
          />
        );

      case 'win-conditions':
        return (
          <TutorialMessage 
            message="How to win"
            position="center"
          >
            <div className="mt-4 space-y-2 text-left">
              <div className="win-condition-item">
                <span className="win-condition-check">✓</span>
                <span className="win-condition-text">Complete the puzzle first → Instant win</span>
              </div>
              <div className="win-condition-item">
                <span className="win-condition-check">✓</span>
                <span className="win-condition-text">Opponent times out + you have more cells → You win</span>
              </div>
              <div className="win-condition-item">
                <span className="win-condition-check">✓</span>
                <span className="win-condition-text">Both timeout → Higher score wins</span>
              </div>
              <div className="win-condition-item">
                <span className="win-condition-check">✓</span>
                <span className="win-condition-text">Same score at timeout → Draw</span>
              </div>
            </div>
            <button
              onClick={() => advancePhase('tools-notes')}
              className="w-full mt-4 py-3 px-6 rounded-xl font-body font-semibold transition-all active:scale-[0.98]"
              style={{
                background: 'rgba(0, 255, 255, 0.1)',
                border: '2px solid rgba(0, 255, 255, 0.5)',
                color: '#00FFFF',
              }}
            >
              Next
            </button>
          </TutorialMessage>
        );

      case 'tools-notes':
        return (
          <TutorialMessage 
            message="Notes mode lets you mark possible numbers"
            subMessage="Tap to toggle notes on/off"
            showNext
            onNext={() => advancePhase('tools-emotes')}
            position="bottom"
          />
        );

      case 'tools-emotes':
        return (
          <TutorialMessage 
            message="Send emotes to communicate—or distract!"
            subMessage="Especially useful when you're locked out 😈"
            showNext
            onNext={() => isReplay ? handleComplete() : advancePhase('skill-selection')}
            nextLabel={isReplay ? "Done" : "Next"}
            position="bottom"
          />
        );

      case 'skill-selection':
        return (
          <div className="fixed inset-0 z-[2510] flex items-center justify-center p-4">
            <div 
              className="bg-surface border border-grid-line rounded-xl p-6 max-w-sm w-full animate-fade-in"
              style={{ boxShadow: '0 0 30px rgba(139, 0, 255, 0.3)' }}
            >
              <h2 className="font-heading font-bold text-2xl text-player text-center mb-2">
                One last thing...
              </h2>
              <p className="font-body text-secondary text-center mb-2">
                Sudoduel matches you with players of similar skill.
              </p>
              <p className="font-heading text-primary text-lg text-center mb-6">
                How experienced are you with Sudoku?
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={() => handleSkillSelect('beginner')}
                  className="w-full py-4 px-6 rounded-xl transition-all active:scale-[0.98] skill-button"
                  style={{
                    background: 'rgba(0, 255, 255, 0.1)',
                    border: '2px solid rgba(0, 255, 255, 0.5)',
                    boxShadow: '0 0 20px rgba(0, 255, 255, 0.2)',
                  }}
                >
                  <span className="text-player font-heading text-lg block">I'm a beginner</span>
                  <p className="text-secondary text-sm mt-1">Match me with other newcomers</p>
                </button>
                
                <button
                  onClick={() => handleSkillSelect('experienced')}
                  className="w-full py-4 px-6 rounded-xl transition-all active:scale-[0.98] skill-button"
                  style={{
                    background: 'rgba(255, 0, 255, 0.1)',
                    border: '2px solid rgba(255, 0, 255, 0.5)',
                    boxShadow: '0 0 20px rgba(255, 0, 255, 0.2)',
                  }}
                >
                  <span className="text-opponent font-heading text-lg block">I've played before</span>
                  <p className="text-secondary text-sm mt-1">Standard matchmaking</p>
                </button>
              </div>
            </div>
          </div>
        );

      case 'ready':
        return (
          <div className="fixed inset-0 z-[2510] flex items-center justify-center p-4">
            <div 
              className="bg-surface border border-grid-line rounded-xl p-6 max-w-sm w-full text-center animate-fade-in"
              style={{ boxShadow: '0 0 30px rgba(0, 255, 255, 0.3)' }}
            >
              <h2 
                className="font-heading font-bold text-3xl text-player mb-2"
                style={{ textShadow: '0 0 20px rgba(0, 255, 255, 0.5)' }}
              >
                You're ready!
              </h2>
              <p className="font-body text-secondary text-lg mb-6">
                Time to find your first opponent
              </p>
              <button
                onClick={handleComplete}
                className="w-full py-4 px-6 rounded-xl font-body font-bold text-lg transition-all active:scale-[0.98]"
                style={{
                  background: 'rgba(0, 255, 255, 0.2)',
                  border: '2px solid #00FFFF',
                  color: '#00FFFF',
                  boxShadow: '0 0 20px rgba(0, 255, 255, 0.4)',
                }}
              >
                Start Playing
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Determine if grid should be dimmed
  const isGridDimmed = phase === 'intro' || phase === 'skill-selection' || phase === 'ready' || phase === 'win-conditions';
  
  // Determine if number pad should be visible
  const showNumberPad = ['tap-cell', 'enter-number', 'practice-more', 'force-mistake'].includes(phase);

  return (
    <div className={`interactive-tutorial ${showShake ? 'tutorial-shake' : ''}`}>
      {/* Progress dots */}
      <div className="fixed top-12 left-0 right-0 z-[2520]">
        <TutorialProgress currentPhase={phase} />
      </div>

      {/* Skip button */}
      <button
        onClick={() => setShowSkipConfirm(true)}
        className="fixed top-12 right-4 z-[2520] px-4 py-2 rounded-lg font-body text-sm text-muted tutorial-skip-button"
        style={{
          background: 'rgba(26, 6, 64, 0.6)',
          border: '1px solid rgba(139, 0, 255, 0.3)',
        }}
      >
        Skip
      </button>

      {/* Main game layout */}
      <div className="h-full flex flex-col pt-24">
        {/* Header with names and progress */}
        <div className="flex-shrink-0 px-3 py-2">
          {/* Names row */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="non-premium-player-name text-lg">You</span>
              <span className="text-xs text-muted font-mono">1500</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="non-premium-opponent-name text-lg">Opponent</span>
              <span className="text-xs text-muted font-mono">1500</span>
            </div>
          </div>
          
          {/* Progress bars row */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <ProgressBar progress={myProgress} color="blue" className="w-[120px]" />
              <span className="text-xs font-mono font-semibold text-player">
                {Math.round(myProgress * 81 / 100)}/81
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-opponent">
                {Math.round(fakeOpponentProgress * 81 / 100)}/81
              </span>
              <ProgressBar progress={fakeOpponentProgress} color="pink" className="w-[120px]" />
            </div>
          </div>
        </div>

        {/* Timers row */}
        <div className="px-3 py-2 border-b border-grid-line">
          <div className="flex items-center justify-between">
            {/* Player timer */}
            <div className="relative">
              <div 
                className={`px-2 py-1 rounded-lg border-2 ${
                  fakeTimer < 30 
                    ? 'bg-error/20 border-error' 
                    : 'bg-player/20 border-player'
                } ${phase === 'timer-explanation' ? 'timer-highlight-pulse' : ''}`}
                style={{
                  boxShadow: fakeTimer < 30 
                    ? '0 0 15px rgba(255,51,102,0.4)' 
                    : '0 0 15px rgba(0,255,255,0.3)',
                }}
              >
                <div className={`text-xl font-mono font-bold ${
                  fakeTimer < 30 ? 'text-error' : 'text-primary'
                }`}>
                  {formatTime(fakeTimer)}
                </div>
              </div>
              
              {/* Timer delta animation */}
              {showTimerDelta && (
                <div 
                  key={showTimerDelta.key}
                  className={`absolute -top-6 left-1/2 -translate-x-1/2 font-heading font-bold text-lg timer-delta-float ${
                    showTimerDelta.value > 0 ? 'timer-delta-positive' : 'timer-delta-negative'
                  }`}
                >
                  {showTimerDelta.value > 0 ? '+' : ''}{showTimerDelta.value}s
                </div>
              )}
            </div>
            
            {/* Opponent timer */}
            <div 
              className={`px-2 py-1 rounded-lg border-2 bg-opponent/20 border-opponent ${
                phase === 'opponent-intro' ? 'timer-highlight-pulse' : ''
              }`}
              style={{ boxShadow: '0 0 15px rgba(255,0,255,0.3)' }}
            >
              <div className="text-xl font-mono font-bold text-opponent">
                {formatTime(fakeOpponentTimer)}
              </div>
            </div>
          </div>
        </div>

        {/* Grid section */}
        <div className="flex-1 flex items-center justify-center px-2">
          <div 
            className={`relative w-full max-w-full transition-opacity duration-300 ${
              isGridDimmed ? 'opacity-40' : 'opacity-100'
            }`}
            style={{ pointerEvents: isGridDimmed ? 'none' : 'auto' }}
          >
            <div className="w-full flex justify-center">
              <SudokuGrid
                grid={grid}
                initialGrid={TUTORIAL_INITIAL_GRID}
                selectedCell={selectedCell}
                onCellClick={handleCellClick}
                notes={notes}
                notesMode={false}
                lockedOut={isGridDimmed}
                animateIn={false}
                countdownPhase="complete"
                lastMoveResult={lastMoveResult}
                correctFeedbackText="+5s!"
              />
            </div>
            
            {/* Highlighted cell overlay */}
            {highlightedCell && !isGridDimmed && (
              <div 
                className="absolute pointer-events-none cell-highlight-pulse"
                style={{
                  left: `${(highlightedCell.col / 9) * 100}%`,
                  top: `${(highlightedCell.row / 9) * 100}%`,
                  width: `${100 / 9}%`,
                  height: `${100 / 9}%`,
                  border: '3px solid #00FFFF',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                }}
              />
            )}
          </div>
        </div>

        {/* Number pad */}
        <div 
          className={`px-3 pt-1 pb-1 transition-all duration-300 ${
            showNumberPad ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="grid grid-cols-9 w-full">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
              const isHighlighted = num === highlightedNumber;
              const isErrorHighlight = phase === 'force-mistake' && num === TUTORIAL_CELLS.mistakeCell.wrongAnswer;
              
              return (
                <button
                  key={num}
                  onClick={() => handleNumberClick(num)}
                  disabled={isGridDimmed}
                  className={`py-3 touch-manipulation font-heading font-bold flex items-center justify-center transition-none active:scale-95 active:text-player ${
                    isHighlighted ? 'number-highlight-pulse' : ''
                  } ${
                    isErrorHighlight ? 'number-error-pulse' : ''
                  }`}
                  style={{
                    fontSize: 'clamp(1.5rem, 7vw, 2.25rem)',
                    color: isHighlighted 
                      ? '#00FFFF' 
                      : isErrorHighlight 
                        ? '#FF3366'
                        : 'rgba(255, 255, 255, 0.95)',
                    WebkitTapHighlightColor: 'transparent',
                    outline: 'none',
                  }}
                >
                  {num}
                </button>
              );
            })}
          </div>
        </div>

        {/* Toolbar area (placeholder for spacing) */}
        <div className="px-3 py-2 pb-safe">
          <div className="h-12" />
        </div>
      </div>

      {/* Phase-specific content overlay */}
      {renderPhaseContent()}

      {/* Skip confirmation modal */}
      {showSkipConfirm && (
        <div 
          className="fixed inset-0 z-[2530] flex items-center justify-center p-4"
          onClick={() => setShowSkipConfirm(false)}
        >
          <div className="absolute inset-0 bg-void/80" />
          <div 
            className="relative bg-surface border border-grid-line rounded-xl p-6 max-w-xs w-full animate-scale-in"
            style={{ boxShadow: '0 0 30px rgba(139, 0, 255, 0.3)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-heading font-bold text-lg text-primary text-center mb-2">
              Skip tutorial?
            </h3>
            <p className="text-secondary font-body text-sm text-center mb-6">
              You can replay it anytime from Settings
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleSkip}
                className="flex-1 py-3 rounded-lg font-body font-semibold transition-all"
                style={{
                  background: 'rgba(26, 6, 64, 0.8)',
                  border: '2px solid rgba(139, 0, 255, 0.4)',
                  color: 'rgba(255, 255, 255, 0.7)',
                }}
              >
                Skip
              </button>
              <button
                onClick={() => setShowSkipConfirm(false)}
                className="flex-1 py-3 rounded-lg font-body font-semibold transition-all"
                style={{
                  background: 'rgba(0, 255, 255, 0.1)',
                  border: '2px solid rgba(0, 255, 255, 0.5)',
                  color: '#00FFFF',
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

