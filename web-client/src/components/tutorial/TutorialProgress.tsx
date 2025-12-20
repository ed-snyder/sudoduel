import { memo } from 'react';
import type { TutorialPhase } from './tutorialData';
import { TUTORIAL_PHASES } from './tutorialData';

interface TutorialProgressProps {
  currentPhase: TutorialPhase;
}

function TutorialProgress({ currentPhase }: TutorialProgressProps) {
  const currentIndex = TUTORIAL_PHASES.indexOf(currentPhase);

  return (
    <div className="flex items-center justify-center gap-1.5 py-2">
      {TUTORIAL_PHASES.map((phase, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        
        return (
          <div
            key={phase}
            className={`
              w-2 h-2 rounded-full transition-all duration-300
              ${isCurrent 
                ? 'bg-player scale-125' 
                : isCompleted 
                  ? 'bg-white' 
                  : 'bg-transparent border border-grid-line'
              }
            `}
            style={{
              boxShadow: isCurrent ? '0 0 8px rgba(0, 255, 255, 0.6)' : 'none',
            }}
          />
        );
      })}
    </div>
  );
}

export default memo(TutorialProgress);

