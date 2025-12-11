import { useState, useCallback, useMemo, useEffect, useRef, memo, startTransition } from 'react';
import { playerAPI } from '../services/api';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import SudokuGrid from './SudokuGrid';
import './TutorialFlow.css';

// Tutorial grid with some pre-filled cells for demonstration
const TUTORIAL_GRID: number[][] = [
  [5, 3, 0, 6, 7, 8, 9, 1, 2],
  [6, 0, 9, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

// Empty grid constant to avoid recreating on every render
const EMPTY_GRID: number[][] = Array(9).fill(null).map(() => Array(9).fill(0));

type TutorialStep = 
  | 'sudoku-basics-1'
  | 'sudoku-basics-2'
  | 'sudoku-basics-3'
  | 'duel-timer'
  | 'duel-correct'
  | 'duel-wrong'
  | 'duel-opponent'
  | 'duel-win-condition'
  | 'skill-selection'
  | 'ready';

interface TutorialFlowProps {
  onComplete: () => void;
  onSkip: () => void;
  onSkillSelect?: (level: 'beginner' | 'experienced') => Promise<void>;
  gameMode?: 'duel' | 'solo';
}

const NEW_TO_SUDOKU_STEPS: TutorialStep[] = [
  'sudoku-basics-1',
  'sudoku-basics-2',
  'sudoku-basics-3',
  'duel-timer',
  'duel-correct',
  'duel-wrong',
  'duel-opponent',
  'duel-win-condition',
  'skill-selection',
  'ready',
];

const SOLO_MODE_STEPS: TutorialStep[] = [
  'duel-timer',
  'duel-correct',
  'duel-wrong',
  'duel-win-condition',
  'skill-selection',
  'ready',
];

export default function TutorialFlow({ onComplete, onSkip, onSkillSelect: onSkillSelectProp, gameMode = 'duel' }: TutorialFlowProps) {
  // Always assume new to sudoku - skip the experience question
  const [step, setStep] = useState<TutorialStep>(() => {
    // Start directly with the first tutorial step
    const steps = gameMode === 'solo' ? SOLO_MODE_STEPS : NEW_TO_SUDOKU_STEPS;
    return steps[0];
  });

  const handleComplete = useCallback(async () => {
    try {
      await playerAPI.markTutorialComplete();
      localStorage.setItem('sudoduel_tutorial_completed', 'true');
      onComplete();
    } catch (error) {
      console.error('Failed to mark tutorial complete:', error);
      // Still complete locally
      localStorage.setItem('sudoduel_tutorial_completed', 'true');
      onComplete();
    }
  }, [onComplete]);
  
  const handleSkillSelect = useCallback(async (level: 'beginner' | 'experienced') => {
    // Call the API immediately when user selects skill level
    if (onSkillSelectProp) {
      try {
        await onSkillSelectProp(level);
      } catch (error) {
        console.error('Failed to set skill level:', error);
        // Continue anyway
      }
    }
    
    // Advance to next step
    const steps = gameMode === 'solo' ? SOLO_MODE_STEPS : NEW_TO_SUDOKU_STEPS;
    const currentIndex = steps.indexOf('skill-selection');
    if (currentIndex < steps.length - 1) {
      startTransition(() => {
        setStep(steps[currentIndex + 1]);
      });
    }
  }, [gameMode, onSkillSelectProp]);

  const handleNext = useCallback(() => {
    console.time('Step transition');
    
    const steps = gameMode === 'solo' 
      ? SOLO_MODE_STEPS 
      : NEW_TO_SUDOKU_STEPS;

    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      // Use startTransition to mark this as non-urgent, allowing React to batch updates
      startTransition(() => {
        setStep(steps[currentIndex + 1]);
        requestAnimationFrame(() => {
          console.timeEnd('Step transition');
        });
      });
    } else {
      handleComplete();
    }
  }, [step, gameMode, handleComplete]);

  const handleSkip = useCallback(async () => {
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

  const handleInteractionComplete = useCallback(() => {
    // No-op - steps manage completion internally with refs
  }, []);

  const getCurrentStepIndex = useMemo(() => {
    const steps = gameMode === 'solo' 
      ? SOLO_MODE_STEPS 
      : NEW_TO_SUDOKU_STEPS;
    return steps.indexOf(step) + 1;
  }, [step, gameMode]);

  const getTotalSteps = useMemo(() => {
    const steps = gameMode === 'solo' 
      ? SOLO_MODE_STEPS 
      : NEW_TO_SUDOKU_STEPS;
    return steps.length;
  }, [gameMode]);

  const stepProps = useMemo(() => ({
    onNext: handleNext,
    onSkip: handleSkip,
    onInteractionComplete: handleInteractionComplete,
    gameMode,
  }), [handleNext, handleSkip, handleInteractionComplete, gameMode]);

  // Memoized step components for better performance
  const MemoizedDuelCorrectStep = memo(DuelCorrectStep);
  const MemoizedSudokuBasics3Step = memo(SudokuBasics3Step);
  const MemoizedDuelTimerStep = memo(DuelTimerStep);
  const MemoizedDuelWrongStep = memo(DuelWrongStep);
  const MemoizedDuelOpponentStep = memo(DuelOpponentStep);
  const MemoizedDuelWinConditionStep = memo(DuelWinConditionStep);
  const MemoizedSkillSelectionStep = memo(SkillSelectionStep);
  const MemoizedReadyStep = memo(ReadyStep);
  const MemoizedSudokuBasics1Step = memo(SudokuBasics1Step);
  const MemoizedSudokuBasics2Step = memo(SudokuBasics2Step);

  const renderStep = useMemo(() => {
    console.time('TutorialFlow render');
    let result;
    
    switch (step) {
      case 'sudoku-basics-1':
        result = <MemoizedSudokuBasics1Step {...stepProps} />;
        break;
      case 'sudoku-basics-2':
        result = <MemoizedSudokuBasics2Step {...stepProps} />;
        break;
      case 'sudoku-basics-3':
        result = <MemoizedSudokuBasics3Step {...stepProps} />;
        break;
      case 'duel-timer':
        result = <MemoizedDuelTimerStep {...stepProps} />;
        break;
      case 'duel-correct':
        result = <MemoizedDuelCorrectStep {...stepProps} />;
        break;
      case 'duel-wrong':
        result = <MemoizedDuelWrongStep {...stepProps} />;
        break;
      case 'duel-opponent':
        result = gameMode === 'solo' ? <MemoizedDuelWinConditionStep {...stepProps} /> : <MemoizedDuelOpponentStep {...stepProps} />;
        break;
      case 'duel-win-condition':
        result = <MemoizedDuelWinConditionStep {...stepProps} />;
        break;
      case 'skill-selection':
        result = <MemoizedSkillSelectionStep {...stepProps} onSkillSelect={handleSkillSelect} />;
        break;
      case 'ready':
        result = <MemoizedReadyStep {...stepProps} onComplete={handleComplete} />;
        break;
      default:
        result = null;
    }
    
    requestAnimationFrame(() => {
      console.timeEnd('TutorialFlow render');
    });
    
    return result;
  }, [step, stepProps, handleComplete, handleSkillSelect, gameMode]);

  return (
    <div className="tutorial-flow fixed inset-0 z-[2500]">
      {renderStep}
      
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-surface/50">
        <div 
          className="h-full bg-player transition-all duration-300"
          style={{ width: `${(getCurrentStepIndex / getTotalSteps) * 100}%`, willChange: 'width' }}
        />
      </div>

      {/* Skip button */}
      <button
        onClick={handleSkip}
        className="absolute top-4 right-4 px-4 py-2 rounded-lg font-body text-sm text-muted hover:text-secondary transition-colors"
        style={{
          background: 'rgba(26, 6, 64, 0.6)',
          border: '1px solid rgba(139, 0, 255, 0.3)',
        }}
      >
        Skip
      </button>
    </div>
  );
}

// Tutorial Overlay Component
const TutorialOverlayComponent = memo(function TutorialOverlayComponent({ 
  children, 
  onTap, 
  highlightBox,
  showTapPrompt = false
}: { 
  children: React.ReactNode; 
  onTap?: () => void;
  highlightBox?: { top: number; left: number; width: number; height: number };
  showTapPrompt?: boolean;
}) {
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div 
      className="tutorial-overlay fixed inset-0 flex items-center justify-center p-4"
      onClick={onTap}
    >
      {/* Dimmed backdrop */}
      <div className="absolute inset-0 bg-void/95 backdrop-blur-sm" style={{ willChange: 'opacity' }} />
      
      {/* Highlight box (if provided) */}
      {highlightBox && (
        <div
          className="absolute border-2 border-player pointer-events-none"
          style={{
            top: `${highlightBox.top}px`,
            left: `${highlightBox.left}px`,
            width: `${highlightBox.width}px`,
            height: `${highlightBox.height}px`,
            boxShadow: '0 0 30px rgba(0, 255, 255, 0.6), inset 0 0 30px rgba(0, 255, 255, 0.3)',
            borderRadius: '8px',
            zIndex: 2501,
            willChange: 'transform, opacity',
          }}
        />
      )}

      {/* Content */}
      <div 
        className="relative z-[2502] max-w-lg w-full"
        onClick={handleClick}
      >
        {children}
        {showTapPrompt && onTap && (
          <div className="text-center mt-4">
            <p className="text-muted text-sm font-body">Tap anywhere to continue</p>
          </div>
        )}
      </div>
    </div>
  );
});

// NumberPad component for tutorial - EXACTLY matches GamePage inline number pad
const NumberPad = memo(function NumberPad({ 
  onNumberSelect, 
  highlightNumber, 
  disabled 
}: { 
  onNumberSelect: (num: number) => void; 
  highlightNumber?: number | null; 
  disabled?: boolean;
}) {
  const numbers = useMemo(() => [1, 2, 3, 4, 5, 6, 7, 8, 9], []);

  return (
    <div className="grid grid-cols-9 w-full">
      {numbers.map((num) => {
        const isHighlighted = num === highlightNumber;
        return (
          <button
            key={num}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!disabled) {
                // Haptic feedback
                try {
                  Haptics.impact({ style: ImpactStyle.Medium });
                } catch {}
                onNumberSelect(num);
              }
            }}
            disabled={disabled}
            className="py-3 touch-manipulation font-heading font-bold flex items-center justify-center transition-none active:scale-95 active:text-player active:ring-2 active:ring-player active:ring-offset-0"
            style={{
              fontSize: 'clamp(1.5rem, 7vw, 2.25rem)',
              color: disabled 
                ? 'rgba(255, 255, 255, 0.2)' 
                : isHighlighted 
                  ? '#00FFFF' 
                  : 'rgba(255, 255, 255, 0.95)',
              textShadow: isHighlighted ? '0 0 15px rgba(0, 255, 255, 0.7)' : 'none',
              WebkitTapHighlightColor: 'transparent',
              outline: 'none',
            }}
          >
            {num}
          </button>
        );
      })}
    </div>
  );
});

// TimerDisplay component for tutorial
const TimerDisplay = memo(function TimerDisplay({ 
  time, 
  delta, 
  showDelta, 
  color = 'cyan' 
}: { 
  time: number; 
  delta?: number; 
  showDelta?: boolean; 
  color?: 'cyan' | 'magenta';
}) {
  const formattedTime = useMemo(() => {
    const mins = Math.floor(time / 60);
    const secs = time % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, [time]);

  const colorClass = useMemo(() => color === 'cyan' ? 'text-player' : 'text-opponent', [color]);
  const borderColor = useMemo(() => color === 'cyan' ? 'border-player bg-player/20' : 'border-opponent bg-opponent/20', [color]);

  return (
    <div className="flex items-center gap-3">
      <div className={`px-4 py-2 rounded-lg border-2 ${borderColor}`}>
        <div className={`text-2xl font-mono font-bold ${colorClass}`}>
          {formattedTime}
        </div>
      </div>
      {showDelta && delta && (
        <div 
          className={`text-xl font-bold ${delta > 0 ? 'text-success' : 'text-error'}`}
          style={{ willChange: 'transform, opacity' }}
        >
          {delta > 0 ? '+' : ''}{delta}s
        </div>
      )}
    </div>
  );
});

// HighlightBox component for tutorial
const HighlightBox = memo(function HighlightBox({ 
  children, 
  color = 'cyan' 
}: { 
  children: React.ReactNode; 
  color?: 'cyan' | 'magenta' | 'gold';
}) {
  const colorStyles = useMemo(() => ({
    cyan: 'border-player bg-player/10',
    magenta: 'border-opponent bg-opponent/10',
    gold: 'border-warning bg-warning/10',
  }), []);

  return (
    <div className={`px-4 py-3 rounded-lg border-2 ${colorStyles[color]}`}>
      {children}
    </div>
  );
});


// Step Components
interface StepProps {
  onNext: () => void;
  onSkip: () => void;
  onInteractionComplete?: () => void;
  interactionComplete?: boolean;
  gameMode?: 'duel' | 'solo';
}

function SudokuBasics1Step({ onNext }: StepProps) {
  const handleCellClick = useCallback(() => {}, []);
  
  return (
    <TutorialOverlayComponent>
      <div className="bg-surface border border-grid-line rounded-xl p-6 space-y-4 text-center">
        <h2 className="font-heading font-bold text-2xl text-player">The 9x9 Grid</h2>
        <p className="font-body text-secondary">
          A Sudoku puzzle is a 9×9 grid divided into 9 smaller 3×3 boxes.
        </p>
        <div className="flex justify-center">
          <SudokuGrid
            grid={EMPTY_GRID}
            initialGrid={EMPTY_GRID}
            selectedCell={null}
            onCellClick={handleCellClick}
            animateIn={false}
            countdownPhase="complete"
          />
        </div>
        <button
          onClick={onNext}
          className="w-full py-3 px-6 rounded-xl font-body font-semibold transition-all active:scale-[0.98]"
          style={{
            background: 'rgba(0, 255, 255, 0.1)',
            border: '2px solid rgba(0, 255, 255, 0.5)',
            color: '#00FFFF',
            willChange: 'transform',
          }}
        >
          Next
        </button>
      </div>
    </TutorialOverlayComponent>
  );
}

function SudokuBasics2Step({ onNext }: StepProps) {
  return (
    <TutorialOverlayComponent>
      <div className="bg-surface border border-grid-line rounded-xl p-6 space-y-4 text-center">
        <h2 className="font-heading font-bold text-2xl text-player">The Golden Rule</h2>
        <p className="font-body text-secondary">
          Each row, column, and 3×3 box must contain the digits 1-9 exactly once.
        </p>
        <button
          onClick={onNext}
          className="w-full py-3 px-6 rounded-xl font-body font-semibold transition-all active:scale-[0.98]"
          style={{
            background: 'rgba(0, 255, 255, 0.1)',
            border: '2px solid rgba(0, 255, 255, 0.5)',
            color: '#00FFFF',
          }}
        >
          Next
        </button>
      </div>
    </TutorialOverlayComponent>
  );
}

function SudokuBasics3Step({ onNext, onInteractionComplete }: StepProps) {
  // Target cell: row 0, col 2 - the answer is 4
  const [grid, setGrid] = useState(() => TUTORIAL_GRID.map(row => [...row]));
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [placed, setPlaced] = useState(false);
  const [showError, setShowError] = useState(false);
  const isProcessingRef = useRef(false);
  const placedRef = useRef(false);
  const lastProcessedTimeRef = useRef<number>(0);
  
  const targetRow = 0;
  const targetCol = 2;
  const correctValue = 4;

  // Auto-select the target cell immediately on mount
  useEffect(() => {
    setSelectedCell({ row: targetRow, col: targetCol });
  }, []);

  const handleCellClick = useCallback((row: number, col: number) => {
    if (placedRef.current || isProcessingRef.current) return;
    if (TUTORIAL_GRID[row][col] !== 0) return;
    setSelectedCell({ row, col });
    setShowError(false);
  }, []);

  const handleNumberSelect = useCallback((num: number) => {
    // CRITICAL: Prevent double-tap - check ref FIRST before any other logic
    if (isProcessingRef.current || placedRef.current) {
      return;
    }
    
    // Debounce: prevent processing the same number within 300ms
    const now = Date.now();
    if (now - lastProcessedTimeRef.current < 300) {
      return;
    }
    lastProcessedTimeRef.current = now;
    
    // Block IMMEDIATELY - this must happen synchronously before any async operations
    isProcessingRef.current = true;
    
    // Ensure cell is selected
    setSelectedCell({ row: targetRow, col: targetCol });
    
    if (num === correctValue) {
      // Correct! Place the number and mark as complete immediately
      // Use functional updates to ensure we're working with latest state
      setGrid(prevGrid => {
        const newGrid = prevGrid.map(r => [...r]);
        newGrid[targetRow][targetCol] = num;
        return newGrid;
      });
      
      // Set placed state and call completion immediately
      placedRef.current = true;
      setPlaced(true);
      onInteractionComplete?.();
    } else {
      // Wrong number - show error and allow retry by resetting ref
      isProcessingRef.current = false;
      setShowError(true);
      setTimeout(() => setShowError(false), 600);
    }
  }, [correctValue, targetRow, targetCol, onInteractionComplete]);

  return (
    <TutorialOverlayComponent showTapPrompt={false}>
      <div className="bg-surface border border-grid-line rounded-xl p-6 space-y-4 text-center">
        <h2 
          className="font-heading font-bold text-2xl text-player"
          style={{ textShadow: '0 0 15px rgba(0, 255, 255, 0.5)' }}
        >
          TRY IT!
        </h2>
        
        <p className="font-body text-secondary text-sm px-2">
          {placed 
            ? ''
            : selectedCell 
              ? <>Select <strong className="text-player">4</strong> to place it</>
              : <>Tap the <strong className="text-player">highlighted cell</strong>, then select <strong className="text-player">4</strong></>
          }
        </p>
        
        {/* Grid - always show with numbers */}
        <div className="flex justify-center">
          <SudokuGrid 
            grid={grid}
            initialGrid={TUTORIAL_GRID}
            selectedCell={selectedCell}
            onCellClick={handleCellClick}
            animateIn={false}
            countdownPhase="complete"
          />
        </div>
        
        {/* Reserve space for both numberpad and success message to prevent grid resize */}
        <div className="relative min-h-[120px]">
          {/* Number pad - ALWAYS visible - matches GamePage container styling */}
          <div className={`px-3 pt-1 pb-1 transition-opacity duration-200 ${placed ? 'opacity-0 pointer-events-none absolute inset-0' : 'opacity-100'}`}>
            <NumberPad 
              onNumberSelect={handleNumberSelect}
              highlightNumber={correctValue}
              disabled={false}
            />
          </div>
          
          {/* Success message - positioned in same space */}
          <div className={`pt-2 space-y-4 transition-opacity duration-200 ${placed ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'}`}>
            <p 
              className="font-heading font-bold text-xl text-success"
              style={{ textShadow: '0 0 15px rgba(0, 255, 136, 0.6)' }}
            >
              Perfect! ✓
            </p>
            
            <button
              onClick={onNext}
              className="w-full py-3 px-6 rounded-xl font-body font-semibold transition-all active:scale-[0.98]"
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
        
        {showError && (
          <p className="font-body text-error text-sm">
            Not quite - try 4!
          </p>
        )}
      </div>
    </TutorialOverlayComponent>
  );
}

function DuelTimerStep({ onNext }: StepProps) {
  return (
    <TutorialOverlayComponent>
      <div className="bg-surface border border-grid-line rounded-xl p-6 space-y-4 text-center">
        <h2 className="font-heading font-bold text-2xl text-player">Time Management is key</h2>
        <p className="font-body text-secondary">
          You will start with a few minutes to complete the board. You get a time boost for every correct cell you complete.
        </p>
        <div className="flex justify-center items-center gap-4">
          <div className="px-4 py-2 rounded-lg border-2 border-player bg-player/20">
            <div className="text-3xl font-mono font-bold text-player">3:30</div>
          </div>
          <div className="text-success text-xl font-bold">+Time</div>
        </div>
        <button
          onClick={onNext}
          className="w-full py-3 px-6 rounded-xl font-body font-semibold transition-all active:scale-[0.98]"
          style={{
            background: 'rgba(0, 255, 255, 0.1)',
            border: '2px solid rgba(0, 255, 255, 0.5)',
            color: '#00FFFF',
          }}
        >
          Next
        </button>
      </div>
    </TutorialOverlayComponent>
  );
}

function DuelCorrectStep({ onNext, onInteractionComplete }: StepProps) {
  const [grid, setGrid] = useState(() => TUTORIAL_GRID.map(row => [...row]));
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [placed, setPlaced] = useState(false);
  const [time, setTime] = useState(195);
  const [showDelta, setShowDelta] = useState(false);
  const isProcessingRef = useRef(false);
  const placedRef = useRef(false);
  const lastProcessedTimeRef = useRef<number>(0);
  
  // Target: row 1, col 1 - answer is 7
  const targetRow = 1;
  const targetCol = 1;
  const correctValue = 7;

  // Auto-select the target cell immediately on mount
  useEffect(() => {
    setSelectedCell({ row: targetRow, col: targetCol });
  }, []);

  const handleCellClick = useCallback((row: number, col: number) => {
    if (placedRef.current || isProcessingRef.current) return;
    if (TUTORIAL_GRID[row][col] !== 0) return;
    setSelectedCell({ row, col });
  }, []);

  const handleNumberSelect = useCallback((num: number) => {
    // CRITICAL: Prevent double-tap - check ref FIRST before any other logic
    if (isProcessingRef.current || placedRef.current) {
      return;
    }
    
    // Debounce: prevent processing the same number within 300ms
    const now = Date.now();
    if (now - lastProcessedTimeRef.current < 300) {
      return;
    }
    lastProcessedTimeRef.current = now;
    
    // Block IMMEDIATELY - this must happen synchronously before any async operations
    isProcessingRef.current = true;
    
    // Ensure cell is selected
    setSelectedCell({ row: targetRow, col: targetCol });
    
    // If correct number is selected, place it immediately
    if (num === correctValue) {
      // Correct! Place the number and mark as complete immediately
      // Use functional updates to ensure we're working with latest state
      setGrid(prevGrid => {
        const newGrid = prevGrid.map(r => [...r]);
        newGrid[targetRow][targetCol] = num;
        return newGrid;
      });
      
      // Set placed state and call completion immediately
      placedRef.current = true;
      setPlaced(true);
      setTime(200);
      setShowDelta(false);
      onInteractionComplete?.();
    } else {
      // Wrong number - allow retry by resetting ref
      isProcessingRef.current = false;
    }
  }, [correctValue, targetRow, targetCol, onInteractionComplete]);

  return (
    <TutorialOverlayComponent showTapPrompt={false}>
      <div className="bg-surface border border-grid-line rounded-xl p-6 space-y-4 text-center">
        <h2 
          className="font-heading font-bold text-2xl text-success"
          style={{ textShadow: '0 0 15px rgba(0, 255, 136, 0.5)' }}
        >
          CORRECT = TIME BOOST
        </h2>
        
        {/* Timer */}
        <div className="flex justify-center">
          <TimerDisplay 
            time={time} 
            delta={showDelta ? undefined : undefined}
            showDelta={false}
            color="cyan" 
          />
        </div>
        
        <p className="font-body text-secondary text-sm">
          {placed 
            ? 'Every correct answer rewards you with time!'
            : selectedCell 
              ? <>Select <strong className="text-player">7</strong> to place it</>
              : <>Tap the <strong className="text-player">highlighted cell</strong>, then select <strong className="text-player">7</strong></>
          }
        </p>
        
        {/* Grid - always show with numbers */}
        <div className="flex justify-center">
          <SudokuGrid 
            grid={grid}
            initialGrid={TUTORIAL_GRID}
            selectedCell={selectedCell}
            onCellClick={handleCellClick}
            animateIn={false}
            countdownPhase="complete"
          />
        </div>
        
        {/* Reserve space for both numberpad and success message to prevent grid resize */}
        <div className="relative min-h-[120px]">
          {/* Number pad - ALWAYS visible - matches GamePage container styling */}
          <div className={`px-3 pt-1 pb-1 transition-opacity duration-200 ${placed ? 'opacity-0 pointer-events-none absolute inset-0' : 'opacity-100'}`}>
            <NumberPad 
              onNumberSelect={handleNumberSelect}
              highlightNumber={correctValue}
              disabled={false}
            />
          </div>
          
          {/* Success message - positioned in same space */}
          <div className={`pt-2 space-y-4 transition-opacity duration-200 ${placed ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'}`}>
            <HighlightBox color="cyan">
              <p className="font-body text-primary text-sm">
                Keep solving correctly to <strong className="text-success">build up time</strong>!
              </p>
            </HighlightBox>
            
            <button
              onClick={onNext}
              className="w-full py-3 px-6 rounded-xl font-body font-semibold transition-all active:scale-[0.98] mt-4"
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
      </div>
    </TutorialOverlayComponent>
  );
}

function DuelWrongStep({ onNext }: StepProps) {
  return (
    <TutorialOverlayComponent>
      <div className="bg-surface border border-grid-line rounded-xl p-6 space-y-4 text-center">
        <h2 className="font-heading font-bold text-2xl text-error">Wrong = Lose Time!</h2>
        <p className="font-body text-secondary">
          Mistakes are costly. Be careful!
        </p>
        <div className="flex justify-center items-center gap-4">
          <div className="px-4 py-2 rounded-lg border-2 border-error bg-error/20">
            <div className="text-3xl font-mono font-bold text-error">2:00</div>
          </div>
          <div className="text-error text-xl font-bold animate-pulse">-Time</div>
        </div>
        <button
          onClick={onNext}
          className="w-full py-3 px-6 rounded-xl font-body font-semibold transition-all active:scale-[0.98]"
          style={{
            background: 'rgba(0, 255, 255, 0.1)',
            border: '2px solid rgba(0, 255, 255, 0.5)',
            color: '#00FFFF',
          }}
        >
          Next
        </button>
      </div>
    </TutorialOverlayComponent>
  );
}

function DuelOpponentStep({ onNext }: StepProps) {
  const [grid] = useState(() => EMPTY_GRID);
  const opponentCells = useMemo(() => {
    const set = new Set<string>();
    set.add('0-0');
    set.add('0-1');
    set.add('1-0');
    return set;
  }, []);

  const handleCellClick = useCallback(() => {}, []);

  return (
    <TutorialOverlayComponent>
      <div className="bg-surface border border-grid-line rounded-xl p-6 space-y-4 text-center">
        <h2 className="font-heading font-bold text-2xl text-opponent">The Fog of War</h2>
        <p className="font-body text-secondary">
          Magenta cells show where your opponent has already scored. You can still score here and might help you catch up!
        </p>
        <div className="flex justify-center">
          <SudokuGrid
            grid={grid}
            initialGrid={EMPTY_GRID}
            selectedCell={null}
            onCellClick={handleCellClick}
            opponentScoredCells={opponentCells}
            animateIn={false}
            countdownPhase="complete"
          />
        </div>
        <button
          onClick={onNext}
          className="w-full py-3 px-6 rounded-xl font-body font-semibold transition-all active:scale-[0.98]"
          style={{
            background: 'rgba(0, 255, 255, 0.1)',
            border: '2px solid rgba(0, 255, 255, 0.5)',
            color: '#00FFFF',
            willChange: 'transform',
          }}
        >
          Next
        </button>
      </div>
    </TutorialOverlayComponent>
  );
}

function DuelWinConditionStep({ onNext, gameMode }: StepProps) {
  return (
    <TutorialOverlayComponent>
      <div className="bg-surface border border-grid-line rounded-xl p-6 space-y-4 text-center">
        <h2 className="font-heading font-bold text-2xl text-player">Win Conditions</h2>
        <p className="font-body text-secondary">
          {gameMode === 'solo' 
            ? 'Complete the puzzle before time runs out!'
            : 'Complete the grid before your opponent, or have a higher score when time runs out'}
        </p>
        <button
          onClick={onNext}
          className="w-full py-3 px-6 rounded-xl font-body font-semibold transition-all active:scale-[0.98]"
          style={{
            background: 'rgba(0, 255, 255, 0.1)',
            border: '2px solid rgba(0, 255, 255, 0.5)',
            color: '#00FFFF',
          }}
        >
          Next
        </button>
      </div>
    </TutorialOverlayComponent>
  );
}

interface SkillSelectionStepProps extends StepProps {
  onSkillSelect: (level: 'beginner' | 'experienced') => void;
}

function SkillSelectionStep({ onSkillSelect }: SkillSelectionStepProps) {
  return (
    <TutorialOverlayComponent>
      <div className="bg-surface border border-grid-line rounded-xl p-6 space-y-4 text-center">
        <h2 className="font-heading font-bold text-2xl text-player">One last thing...</h2>
        
        <p className="font-body text-secondary text-lg">
          Sudoduel matches you with players of similar skill.
        </p>
        
        <p className="font-body text-primary text-xl font-heading">
          How experienced are you with Sudoku?
        </p>
        
        <div className="flex flex-col w-full gap-4 mt-4">
          <button
            onClick={() => onSkillSelect('beginner')}
            className="w-full py-4 px-6 rounded-xl transition-all active:scale-[0.98]"
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
            onClick={() => onSkillSelect('experienced')}
            className="w-full py-4 px-6 rounded-xl transition-all active:scale-[0.98]"
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
    </TutorialOverlayComponent>
  );
}

function ReadyStep({ onComplete }: StepProps & { onComplete: () => void }) {
  return (
    <TutorialOverlayComponent>
      <div className="bg-surface border border-grid-line rounded-xl p-6 space-y-6 text-center">
        <h2 className="font-heading font-bold text-3xl text-player">You're Ready!</h2>
        <p className="font-body text-secondary text-lg">
          Time to play. Good luck!
        </p>
        <button
          onClick={onComplete}
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
    </TutorialOverlayComponent>
  );
}

// Export hook for checking tutorial status
export function useTutorial(user: { tutorial_completed?: boolean } | null) {
  const needsTutorial = user ? !user.tutorial_completed : false;
  const [showTutorial, setShowTutorial] = useState(false);

  const startTutorial = useCallback(() => {
    if (needsTutorial) {
      setShowTutorial(true);
    }
  }, [needsTutorial]);

  const completeTutorial = useCallback(async () => {
    try {
      await playerAPI.markTutorialComplete();
      localStorage.setItem('sudoduel_tutorial_completed', 'true');
      setShowTutorial(false);
    } catch (error) {
      console.error('Failed to mark tutorial complete:', error);
      localStorage.setItem('sudoduel_tutorial_completed', 'true');
      setShowTutorial(false);
    }
  }, []);

  return {
    needsTutorial,
    showTutorial,
    startTutorial,
    completeTutorial,
  };
}

// Helper to check if tutorial is completed (fast check)
export function hasTutorialCompleted(user: { tutorial_completed?: boolean } | null): boolean {
  if (localStorage.getItem('sudoduel_tutorial_completed') === 'true') {
    return true;
  }
  return user?.tutorial_completed ?? false;
}
