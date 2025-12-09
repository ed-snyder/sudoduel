import { useState, useCallback, useMemo } from 'react';
import { playerAPI } from '../services/api';
import SudokuGrid from './SudokuGrid';
import './TutorialFlow.css';

type TutorialPath = 'undecided' | 'knows-sudoku' | 'new-to-sudoku';
type TutorialStep = 
  | 'ask-experience'
  | 'sudoku-basics-1'
  | 'sudoku-basics-2'
  | 'sudoku-basics-3'
  | 'duel-timer'
  | 'duel-correct'
  | 'duel-wrong'
  | 'duel-opponent'
  | 'duel-win-condition'
  | 'ready';

interface TutorialFlowProps {
  onComplete: () => void;
  onSkip: () => void;
  gameMode?: 'duel' | 'solo';
}

const KNOWS_SUDOKU_STEPS: TutorialStep[] = [
  'duel-timer',
  'duel-correct',
  'duel-wrong',
  'duel-opponent',
  'duel-win-condition',
  'ready',
];

const NEW_TO_SUDOKU_STEPS: TutorialStep[] = [
  'sudoku-basics-1',
  'sudoku-basics-2',
  'sudoku-basics-3',
  'duel-timer',
  'duel-correct',
  'duel-wrong',
  'duel-opponent',
  'duel-win-condition',
  'ready',
];

const SOLO_MODE_STEPS: TutorialStep[] = [
  'duel-timer',
  'duel-correct',
  'duel-wrong',
  'duel-win-condition',
  'ready',
];

export default function TutorialFlow({ onComplete, onSkip, gameMode = 'duel' }: TutorialFlowProps) {
  const [path, setPath] = useState<TutorialPath>('undecided');
  const [step, setStep] = useState<TutorialStep>('ask-experience');
  const [interactionComplete, setInteractionComplete] = useState(false);

  const handlePathSelect = useCallback((selectedPath: 'knows-sudoku' | 'new-to-sudoku') => {
    setPath(selectedPath);
    const steps = selectedPath === 'knows-sudoku' ? KNOWS_SUDOKU_STEPS : NEW_TO_SUDOKU_STEPS;
    setStep(steps[0]);
  }, []);

  const handleNext = useCallback(() => {
    if (path === 'undecided') return;

    const steps = gameMode === 'solo' 
      ? SOLO_MODE_STEPS 
      : path === 'knows-sudoku' 
        ? KNOWS_SUDOKU_STEPS 
        : NEW_TO_SUDOKU_STEPS;

    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
      setInteractionComplete(false);
    } else {
      handleComplete();
    }
  }, [path, step, gameMode]);

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
    setInteractionComplete(true);
  }, []);

  const getCurrentStepIndex = () => {
    if (path === 'undecided') return 0;
    const steps = gameMode === 'solo' 
      ? SOLO_MODE_STEPS 
      : path === 'knows-sudoku' 
        ? KNOWS_SUDOKU_STEPS 
        : NEW_TO_SUDOKU_STEPS;
    return steps.indexOf(step) + 1;
  };

  const getTotalSteps = () => {
    if (path === 'undecided') return 1;
    const steps = gameMode === 'solo' 
      ? SOLO_MODE_STEPS 
      : path === 'knows-sudoku' 
        ? KNOWS_SUDOKU_STEPS 
        : NEW_TO_SUDOKU_STEPS;
    return steps.length + 1; // +1 for ask-experience step
  };

  const renderStep = () => {
    const stepProps = {
      onNext: handleNext,
      onSkip: handleSkip,
      onInteractionComplete: handleInteractionComplete,
      interactionComplete,
      gameMode,
    };

    switch (step) {
      case 'ask-experience':
        return <AskExperienceStep {...stepProps} onPathSelect={handlePathSelect} />;
      case 'sudoku-basics-1':
        return <SudokuBasics1Step {...stepProps} />;
      case 'sudoku-basics-2':
        return <SudokuBasics2Step {...stepProps} />;
      case 'sudoku-basics-3':
        return <SudokuBasics3Step {...stepProps} />;
      case 'duel-timer':
        return <DuelTimerStep {...stepProps} />;
      case 'duel-correct':
        return <DuelCorrectStep {...stepProps} />;
      case 'duel-wrong':
        return <DuelWrongStep {...stepProps} />;
      case 'duel-opponent':
        return gameMode === 'solo' ? <DuelWinConditionStep {...stepProps} /> : <DuelOpponentStep {...stepProps} />;
      case 'duel-win-condition':
        return <DuelWinConditionStep {...stepProps} />;
      case 'ready':
        return <ReadyStep {...stepProps} onComplete={handleComplete} />;
      default:
        return null;
    }
  };

  return (
    <div className="tutorial-flow fixed inset-0 z-[2500]">
      {renderStep()}
      
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-surface/50">
        <div 
          className="h-full bg-player transition-all duration-300"
          style={{ width: `${(getCurrentStepIndex() / getTotalSteps()) * 100}%` }}
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
function TutorialOverlayComponent({ 
  children, 
  onTap, 
  highlightBox 
}: { 
  children: React.ReactNode; 
  onTap?: () => void;
  highlightBox?: { top: number; left: number; width: number; height: number };
}) {
  return (
    <div 
      className="tutorial-overlay fixed inset-0 flex items-center justify-center p-4"
      onClick={onTap}
    >
      {/* Dimmed backdrop */}
      <div className="absolute inset-0 bg-void/95 backdrop-blur-sm" />
      
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
          }}
        />
      )}

      {/* Content */}
      <div 
        className="relative z-[2502] max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}


// Step Components
interface StepProps {
  onNext: () => void;
  onSkip: () => void;
  onInteractionComplete?: () => void;
  interactionComplete?: boolean;
  gameMode?: 'duel' | 'solo';
}

function AskExperienceStep({ onPathSelect }: StepProps & { onPathSelect: (path: 'knows-sudoku' | 'new-to-sudoku') => void }) {
  return (
    <TutorialOverlayComponent>
      <div className="bg-surface border border-grid-line rounded-xl p-6 space-y-6 text-center">
        <h2 className="font-heading font-bold text-2xl text-player">Welcome to SudoDuel!</h2>
        <p className="font-body text-secondary text-lg">Have you played Sudoku before?</p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => onPathSelect('knows-sudoku')}
            className="w-full py-4 px-6 rounded-xl font-body font-semibold text-lg transition-all active:scale-[0.98]"
            style={{
              background: 'rgba(0, 255, 255, 0.1)',
              border: '2px solid rgba(0, 255, 255, 0.5)',
              color: '#00FFFF',
            }}
          >
            Yes, I know Sudoku
          </button>
          <button
            onClick={() => onPathSelect('new-to-sudoku')}
            className="w-full py-4 px-6 rounded-xl font-body font-semibold text-lg transition-all active:scale-[0.98]"
            style={{
              background: 'rgba(139, 0, 255, 0.1)',
              border: '2px solid rgba(139, 0, 255, 0.5)',
              color: '#8B00FF',
            }}
          >
            No / Refresh Me
          </button>
        </div>
      </div>
    </TutorialOverlayComponent>
  );
}

function SudokuBasics1Step({ onNext }: StepProps) {
  return (
    <TutorialOverlayComponent>
      <div className="bg-surface border border-grid-line rounded-xl p-6 space-y-4 text-center">
        <h2 className="font-heading font-bold text-2xl text-player">The 9x9 Grid</h2>
        <p className="font-body text-secondary">
          A Sudoku puzzle is a 9×9 grid divided into 9 smaller 3×3 boxes.
        </p>
        <div className="flex justify-center">
          <SudokuGrid
            grid={Array(9).fill(null).map(() => Array(9).fill(0))}
            initialGrid={Array(9).fill(null).map(() => Array(9).fill(0))}
            selectedCell={null}
            onCellClick={() => {}}
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
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [grid, setGrid] = useState<number[][]>(
    Array(9).fill(null).map(() => Array(9).fill(0))
  );
  const [highlightedNumber, setHighlightedNumber] = useState<number | null>(5);

  const handleCellClick = useCallback((row: number, col: number) => {
    setSelectedCell({ row, col });
  }, []);

  const handleNumberClick = useCallback((num: number) => {
    if (selectedCell && highlightedNumber === num) {
      const newGrid = grid.map(r => [...r]);
      newGrid[selectedCell.row][selectedCell.col] = num;
      setGrid(newGrid);
      onInteractionComplete?.();
      setTimeout(() => {
        setHighlightedNumber(null);
        setTimeout(onNext, 500);
      }, 300);
    }
  }, [selectedCell, highlightedNumber, grid, onInteractionComplete, onNext]);

  return (
    <TutorialOverlayComponent>
      <div className="bg-surface border border-grid-line rounded-xl p-6 space-y-4 text-center">
        <h2 className="font-heading font-bold text-2xl text-player">Try It!</h2>
        <p className="font-body text-secondary">
          Tap the highlighted cell, then tap <span className="text-player font-bold">5</span> on the number pad.
        </p>
        <div className="flex justify-center">
          <SudokuGrid
            grid={grid}
            initialGrid={Array(9).fill(null).map(() => Array(9).fill(0))}
            selectedCell={selectedCell}
            onCellClick={handleCellClick}
            animateIn={false}
            countdownPhase="complete"
          />
        </div>
        {selectedCell && (
          <div className="grid grid-cols-9 gap-1.5 max-w-md mx-auto">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberClick(num)}
                className="aspect-square rounded-lg transition-all touch-manipulation font-heading font-bold flex items-center justify-center"
                style={{
                  fontSize: 'clamp(1rem, 4vw, 1.5rem)',
                  background: num === highlightedNumber 
                    ? 'rgba(0, 255, 255, 0.3)' 
                    : 'transparent',
                  border: num === highlightedNumber
                    ? '2px solid #00FFFF'
                    : '2px solid rgba(139, 0, 255, 0.6)',
                  color: num === highlightedNumber ? '#00FFFF' : 'rgba(255, 255, 255, 0.95)',
                  boxShadow: num === highlightedNumber
                    ? '0 0 15px rgba(0, 255, 255, 0.5)'
                    : '0 0 10px rgba(139, 0, 255, 0.2)',
                  minHeight: '44px',
                }}
              >
                {num}
              </button>
            ))}
          </div>
        )}
      </div>
    </TutorialOverlayComponent>
  );
}

function DuelTimerStep({ onNext }: StepProps) {
  return (
    <TutorialOverlayComponent>
      <div className="bg-surface border border-grid-line rounded-xl p-6 space-y-4 text-center">
        <h2 className="font-heading font-bold text-2xl text-player">Time is Your Resource</h2>
        <p className="font-body text-secondary">
          You start with 3:30. Correct moves add +5s. Wrong moves cost -30s. Run out of time and you're locked out!
        </p>
        <div className="flex justify-center items-center gap-4">
          <div className="px-4 py-2 rounded-lg border-2 border-player bg-player/20">
            <div className="text-3xl font-mono font-bold text-player">3:30</div>
          </div>
          <div className="text-success text-xl font-bold">+5s</div>
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
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [grid, setGrid] = useState<number[][]>(
    Array(9).fill(null).map(() => Array(9).fill(0))
  );
  const [highlightedNumber, setHighlightedNumber] = useState<number | null>(3);
  const [showBonus, setShowBonus] = useState(false);

  const handleCellClick = useCallback((row: number, col: number) => {
    setSelectedCell({ row, col });
  }, []);

  const handleNumberClick = useCallback((num: number) => {
    if (selectedCell && highlightedNumber === num) {
      const newGrid = grid.map(r => [...r]);
      newGrid[selectedCell.row][selectedCell.col] = num;
      setGrid(newGrid);
      setShowBonus(true);
      onInteractionComplete?.();
      setTimeout(() => {
        setShowBonus(false);
        setHighlightedNumber(null);
        setTimeout(onNext, 800);
      }, 1000);
    }
  }, [selectedCell, highlightedNumber, grid, onInteractionComplete, onNext]);

  return (
    <TutorialOverlayComponent>
      <div className="bg-surface border border-grid-line rounded-xl p-6 space-y-4 text-center">
        <h2 className="font-heading font-bold text-2xl text-player">Correct = +5s!</h2>
        <p className="font-body text-secondary">
          Place the correct number to earn time bonus.
        </p>
        <div className="flex justify-center">
          <SudokuGrid
            grid={grid}
            initialGrid={Array(9).fill(null).map(() => Array(9).fill(0))}
            selectedCell={selectedCell}
            onCellClick={handleCellClick}
            animateIn={false}
            countdownPhase="complete"
          />
        </div>
        {showBonus && (
          <div className="text-success text-2xl font-bold animate-pulse">+5s!</div>
        )}
        {selectedCell && !showBonus && (
          <div className="grid grid-cols-9 gap-1.5 max-w-md mx-auto">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberClick(num)}
                className="aspect-square rounded-lg transition-all touch-manipulation font-heading font-bold flex items-center justify-center"
                style={{
                  fontSize: 'clamp(1rem, 4vw, 1.5rem)',
                  background: num === highlightedNumber 
                    ? 'rgba(0, 255, 255, 0.3)' 
                    : 'transparent',
                  border: num === highlightedNumber
                    ? '2px solid #00FFFF'
                    : '2px solid rgba(139, 0, 255, 0.6)',
                  color: num === highlightedNumber ? '#00FFFF' : 'rgba(255, 255, 255, 0.95)',
                  boxShadow: num === highlightedNumber
                    ? '0 0 15px rgba(0, 255, 255, 0.5)'
                    : '0 0 10px rgba(139, 0, 255, 0.2)',
                  minHeight: '44px',
                }}
              >
                {num}
              </button>
            ))}
          </div>
        )}
      </div>
    </TutorialOverlayComponent>
  );
}

function DuelWrongStep({ onNext }: StepProps) {
  return (
    <TutorialOverlayComponent>
      <div className="bg-surface border border-grid-line rounded-xl p-6 space-y-4 text-center">
        <h2 className="font-heading font-bold text-2xl text-error">Wrong = -30s!</h2>
        <p className="font-body text-secondary">
          Mistakes are costly. Be careful!
        </p>
        <div className="flex justify-center items-center gap-4">
          <div className="px-4 py-2 rounded-lg border-2 border-error bg-error/20">
            <div className="text-3xl font-mono font-bold text-error">2:00</div>
          </div>
          <div className="text-error text-xl font-bold animate-pulse">-30s</div>
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
  const [grid] = useState<number[][]>(
    Array(9).fill(null).map(() => Array(9).fill(0))
  );
  const opponentCells = useMemo(() => {
    const set = new Set<string>();
    set.add('0-0');
    set.add('0-1');
    set.add('1-0');
    return set;
  }, []);

  return (
    <TutorialOverlayComponent>
      <div className="bg-surface border border-grid-line rounded-xl p-6 space-y-4 text-center">
        <h2 className="font-heading font-bold text-2xl text-opponent">Your Opponent</h2>
        <p className="font-body text-secondary">
          Magenta cells show where your opponent scored first. You can still fill any empty cell!
        </p>
        <div className="flex justify-center">
          <SudokuGrid
            grid={grid}
            initialGrid={Array(9).fill(null).map(() => Array(9).fill(0))}
            selectedCell={null}
            onCellClick={() => {}}
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
        <h2 className="font-heading font-bold text-2xl text-player">How to Win</h2>
        <p className="font-body text-secondary">
          {gameMode === 'solo' 
            ? 'Complete the puzzle before time runs out!'
            : 'Complete the puzzle first, or have more cells when your opponent locks out.'}
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

function ReadyStep({ onComplete }: StepProps & { onComplete: () => void }) {
  return (
    <TutorialOverlayComponent>
      <div className="bg-surface border border-grid-line rounded-xl p-6 space-y-6 text-center">
        <h2 className="font-heading font-bold text-3xl text-player">You're Ready!</h2>
        <p className="font-body text-secondary text-lg">
          Time to race. Good luck!
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
