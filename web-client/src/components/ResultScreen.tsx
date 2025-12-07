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
  reason,
  myResult,
  opponentResult,
  onRematch,
  onBackToLobby,
  rematchState,
  rematchCountdown = 0,
}: ResultScreenProps) {
  const [displayedRating, setDisplayedRating] = useState(myResult.rating_before);
  const [showContent, setShowContent] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showButtons, setShowButtons] = useState(false);

  const ratingChange = myResult.rating_change || 0;
  const cellDifference = opponentResult.cellsCompleted - myResult.cellsCompleted;
  const wasClose = !didWin && !isDraw && cellDifference <= 5;

  // Staggered reveal animation
  useEffect(() => {
    const timer1 = setTimeout(() => setShowContent(true), 100);
    const timer2 = setTimeout(() => setShowStats(true), 400);
    const timer3 = setTimeout(() => setShowButtons(true), 700);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  // Animated rating counter
  useEffect(() => {
    if (!showStats) return;
    
    const startRating = myResult.rating_before;
    const endRating = myResult.rating_after;
    const duration = 1500;
    const steps = 30;
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
  }, [showStats, myResult.rating_before, myResult.rating_after]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getReasonText = () => {
    if (reason === 'FORFEIT') return didWin ? 'Opponent forfeited' : 'You forfeited';
    if (reason === 'PUZZLE_SOLVED') return didWin ? 'Puzzle completed!' : 'Opponent solved it';
    if (reason === 'TIMEOUT_SCORE') return didWin ? 'Higher score at timeout' : 'Lower score at timeout';
    if (reason === 'DRAW') return 'Equal scores';
    return '';
  };

  return (
    <div className="fixed inset-0 bg-void flex items-center justify-center p-4 z-50">
      {/* Background effects */}
      {didWin && !isDraw && (
        <>
          {/* Victory glow burst */}
          <div 
            className="absolute inset-0 animate-victory-burst pointer-events-none"
            style={{
              background: 'radial-gradient(circle at center, rgba(0,255,255,0.15) 0%, transparent 60%)',
            }}
          />
          {/* Scanlines */}
          <div 
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.1) 2px, rgba(0,255,255,0.1) 4px)',
              backgroundSize: '100% 4px',
            }}
          />
        </>
      )}
      
      {!didWin && !isDraw && (
        // Defeat dim overlay
        <div className="absolute inset-0 bg-void/50 pointer-events-none" />
      )}

      {/* Main card */}
      <div 
        className={`bg-surface border rounded-xl p-6 max-w-md w-full shadow-2xl relative transition-all duration-500 ${
          showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        } ${
          didWin && !isDraw 
            ? 'border-player shadow-glow-player' 
            : isDraw 
            ? 'border-grid-line' 
            : 'border-error/30'
        }`}
      >
        {/* Result Header */}
        <div className="text-center mb-6">
          <h1 
            className={`text-4xl sm:text-5xl font-heading font-bold mb-2 tracking-wider ${
              isDraw 
                ? 'text-secondary' 
                : didWin 
                ? 'text-player animate-glitch-text' 
                : 'text-primary'
            }`}
            style={didWin && !isDraw ? {
              textShadow: '0 0 10px rgba(0,255,255,0.8), 0 0 20px rgba(0,255,255,0.5), 0 0 40px rgba(255,0,255,0.3)',
            } : {}}
          >
            {isDraw ? 'DRAW' : didWin ? 'VICTORY' : 'DEFEAT'}
          </h1>
          
          <p className="text-secondary font-body text-sm">
            {getReasonText()}
          </p>
          
          {wasClose && (
            <p className="text-player text-sm font-body mt-2 animate-pulse">
              So close! {cellDifference} more cell{cellDifference !== 1 ? 's' : ''} would've won.
            </p>
          )}
        </div>

        {/* Score Comparison */}
        <div 
          className={`flex justify-center items-center gap-6 mb-6 transition-all duration-500 ${
            showStats ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <div className="text-center">
            <div className="text-xs text-muted font-body uppercase tracking-wider mb-1">You</div>
            <div 
              className={`text-3xl font-mono font-bold ${didWin ? 'text-player' : 'text-primary'}`}
              style={didWin ? { textShadow: '0 0 10px rgba(0,255,255,0.5)' } : {}}
            >
              {myResult.cellsCompleted}
            </div>
            <div className="text-xs text-muted font-mono">/81</div>
          </div>
          
          <div className="text-2xl text-muted">—</div>
          
          <div className="text-center">
            <div className="text-xs text-muted font-body uppercase tracking-wider mb-1">Opponent</div>
            <div 
              className={`text-3xl font-mono font-bold ${!didWin && !isDraw ? 'text-opponent' : 'text-primary'}`}
              style={!didWin && !isDraw ? { textShadow: '0 0 10px rgba(255,0,255,0.5)' } : {}}
            >
              {opponentResult.cellsCompleted}
            </div>
            <div className="text-xs text-muted font-mono">/81</div>
          </div>
        </div>

        {/* Stats Grid */}
        <div 
          className={`grid grid-cols-2 gap-3 mb-6 transition-all duration-500 delay-100 ${
            showStats ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {/* Your Stats */}
          <div className={`bg-elevated/50 rounded-lg p-3 border ${
            didWin ? 'border-player/30' : 'border-grid-line/50'
          }`}>
            <p className={`font-body font-semibold mb-2 text-sm ${didWin ? 'text-player' : 'text-secondary'}`}>
              You
            </p>
            <div className="space-y-1 text-xs font-body text-muted">
              <div className="flex justify-between">
                <span>Mistakes</span>
                <span className="font-mono text-primary">{myResult.mistakes}</span>
              </div>
              <div className="flex justify-between">
                <span>Time Left</span>
                <span className="font-mono text-primary">{formatTime(myResult.timeRemaining)}</span>
              </div>
            </div>
          </div>
          
          {/* Opponent Stats */}
          <div className={`bg-elevated/50 rounded-lg p-3 border ${
            !didWin && !isDraw ? 'border-opponent/30' : 'border-grid-line/50'
          }`}>
            <p className={`font-body font-semibold mb-2 text-sm ${!didWin && !isDraw ? 'text-opponent' : 'text-secondary'}`}>
              Opponent
            </p>
            <div className="space-y-1 text-xs font-body text-muted">
              <div className="flex justify-between">
                <span>Mistakes</span>
                <span className="font-mono text-primary">{opponentResult.mistakes}</span>
              </div>
              <div className="flex justify-between">
                <span>Time Left</span>
                <span className="font-mono text-primary">{formatTime(opponentResult.timeRemaining)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Rating Change */}
        <div 
          className={`bg-elevated/30 rounded-xl p-4 mb-6 border transition-all duration-500 delay-200 ${
            showStats ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          } ${
            ratingChange > 0 
              ? 'border-success/30' 
              : ratingChange < 0 
              ? 'border-error/30' 
              : 'border-grid-line/50'
          }`}
        >
          <div className="text-center">
            <div className="text-xs text-muted font-body uppercase tracking-wider mb-2">Rating</div>
            <div className="flex items-center justify-center gap-3">
              <span 
                className="text-3xl font-mono font-bold text-primary"
                style={{ textShadow: '0 0 10px rgba(0,255,255,0.3)' }}
              >
                {Math.round(displayedRating)}
              </span>
              <span 
                className={`text-xl font-mono font-bold ${
                  ratingChange > 0 ? 'text-success' : ratingChange < 0 ? 'text-error' : 'text-muted'
                }`}
              >
                {ratingChange > 0 ? '+' : ''}{Math.round(ratingChange)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div 
          className={`space-y-3 transition-all duration-500 delay-300 ${
            showButtons ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {/* Rematch Button */}
          <button
            onClick={onRematch}
            disabled={rematchState === 'requested'}
            className={`w-full py-3 font-body font-semibold rounded-lg transition-all ${
              rematchState === 'waiting'
                ? 'bg-success/20 border-2 border-success text-success hover:bg-success/30 animate-pulse'
                : rematchState === 'requested'
                ? 'bg-elevated border border-grid-line text-muted cursor-not-allowed'
                : 'bg-transparent border-2 border-player text-player hover:bg-player/20 hover:shadow-glow-player'
            }`}
          >
            {rematchState === 'idle' && 'Rematch'}
            {rematchState === 'requested' && `Waiting for opponent... (${rematchCountdown}s)`}
            {rematchState === 'waiting' && '⚔️ Accept Rematch!'}
          </button>

          {/* Back to Lobby */}
          <button
            onClick={onBackToLobby}
            className="w-full py-3 bg-surface border border-grid-line text-secondary font-body font-semibold rounded-lg hover:border-player/50 hover:text-player transition-all"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    </div>
  );
}
