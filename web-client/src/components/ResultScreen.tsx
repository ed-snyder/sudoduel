import { useState, useEffect } from 'react';

interface PlayerResult {
  playerId: number;
  displayName?: string;
  score: number;
  cellsCompleted: number;
  mistakes: number;
  timeRemaining: number;
  rating_before: number;
  rating_after: number;
  rating_change: number;
}

interface ResultScreenProps {
  didWin: boolean;
  isDraw: boolean;
  reason: 'PUZZLE_SOLVED' | 'TIMEOUT_SCORE' | 'DRAW' | 'FORFEIT';
  myResult: PlayerResult;
  opponentResult: PlayerResult;
  onRematch: () => void;
  onBackToLobby: () => void;
  rematchState: 'idle' | 'requested' | 'waiting';
  rematchCountdown?: number;
}

export default function ResultScreen({
  didWin,
  isDraw,
  myResult,
  opponentResult,
  onRematch,
  onBackToLobby,
  rematchState,
  rematchCountdown = 0,
}: ResultScreenProps) {
  const [displayedRating, setDisplayedRating] = useState(myResult.rating_before);
  const [showContent, setShowContent] = useState(false);

  const ratingChange = myResult.rating_change || 0;

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Animated rating counter
  useEffect(() => {
    if (!showContent) return;
    
    const startRating = myResult.rating_before;
    const endRating = myResult.rating_after;
    const duration = 1200;
    const steps = 25;
    const stepDuration = duration / steps;
    const ratingDiff = endRating - startRating;
    
    let currentStep = 0;
    
    const interval = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayedRating(Math.round(startRating + ratingDiff * easeOut));
      
      if (currentStep >= steps) {
        clearInterval(interval);
        setDisplayedRating(endRating);
      }
    }, stepDuration);
    
    return () => clearInterval(interval);
  }, [showContent, myResult.rating_before, myResult.rating_after]);

  return (
    <div className="fixed inset-0 bg-void flex flex-col items-center justify-center p-6 z-50">
      {/* Background grid */}
      <div 
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(139,0,255,0.4) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139,0,255,0.4) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Victory/Defeat glow */}
      {didWin && !isDraw && (
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at center 30%, rgba(0,255,255,0.15) 0%, transparent 50%)',
          }}
        />
      )}

      {/* Content */}
      <div 
        className={`relative flex flex-col items-center transition-all duration-500 ${
          showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        {/* Result Title */}
        <h1 
          className={`text-5xl sm:text-6xl font-heading font-bold uppercase tracking-wider mb-2 ${
            isDraw 
              ? 'text-secondary' 
              : didWin 
              ? 'text-player' 
              : 'text-primary'
          }`}
          style={didWin && !isDraw ? {
            textShadow: '0 0 20px rgba(0,255,255,0.8), 0 0 40px rgba(0,255,255,0.4)',
          } : {}}
        >
          {isDraw ? 'DRAW' : didWin ? 'VICTORY' : 'DEFEAT'}
        </h1>

        {/* Score - Simple and clean */}
        <div className="flex items-baseline gap-3 mb-6">
          <span className={`text-4xl font-mono font-bold ${didWin ? 'text-player' : 'text-primary'}`}>
            {myResult.cellsCompleted}
          </span>
          <span className="text-xl text-muted font-body">-</span>
          <span className={`text-4xl font-mono font-bold ${!didWin && !isDraw ? 'text-opponent' : 'text-primary'}`}>
            {opponentResult.cellsCompleted}
          </span>
        </div>

        {/* Rating Change - The key info */}
        <div className="flex items-center gap-2 mb-10">
          <span 
            className="text-3xl font-mono font-bold text-primary"
          >
            {Math.round(displayedRating)}
          </span>
          <span 
            className={`text-2xl font-mono font-bold ${
              ratingChange > 0 ? 'text-success' : ratingChange < 0 ? 'text-error' : 'text-muted'
            }`}
          >
            ({ratingChange > 0 ? '+' : ''}{Math.round(ratingChange)})
          </span>
        </div>

        {/* Buttons - Big and prominent */}
        <div className="w-full max-w-xs space-y-3">
          {/* Rematch - Primary action */}
          <button
            onClick={onRematch}
            disabled={rematchState === 'requested'}
            className={`w-full py-4 text-lg font-body font-bold uppercase tracking-widest rounded-xl transition-all ${
              rematchState === 'waiting'
                ? 'bg-success/20 border-2 border-success text-success animate-pulse'
                : rematchState === 'requested'
                ? 'bg-elevated border border-grid-line text-muted cursor-not-allowed'
                : 'bg-player/20 border-2 border-player text-player hover:bg-player/30 active:scale-[0.98]'
            }`}
            style={rematchState === 'idle' ? {
              boxShadow: '0 0 20px rgba(0,255,255,0.3), inset 0 0 20px rgba(0,255,255,0.1)',
            } : {}}
          >
            {rematchState === 'idle' && 'Rematch'}
            {rematchState === 'requested' && `Waiting... ${rematchCountdown}s`}
            {rematchState === 'waiting' && 'Accept Rematch'}
          </button>

          {/* New Match */}
          <button
            onClick={onBackToLobby}
            className="w-full py-4 text-lg bg-transparent border border-grid-line text-secondary font-body font-semibold uppercase tracking-wider rounded-xl hover:border-player/50 hover:text-player transition-all active:scale-[0.98]"
          >
            New Match
          </button>
        </div>
      </div>
    </div>
  );
}
