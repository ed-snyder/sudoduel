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
      {/* Background grid */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(139,0,255,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139,0,255,0.3) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Victory effects */}
      {didWin && !isDraw && (
        <>
          <div 
            className="absolute inset-0 animate-victory-burst pointer-events-none"
            style={{
              background: 'radial-gradient(circle at center, rgba(0,255,255,0.2) 0%, transparent 60%)',
            }}
          />
          <div 
            className="absolute inset-0 pointer-events-none opacity-30"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.1) 2px, rgba(0,255,255,0.1) 4px)',
              backgroundSize: '100% 4px',
            }}
          />
        </>
      )}
      
      {/* Defeat dim overlay */}
      {!didWin && !isDraw && (
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'rgba(10,0,20,0.5)' }}
        />
      )}

      {/* Main card */}
      <div 
        className={`relative bg-surface border rounded-xl p-6 max-w-md w-full transition-all duration-500 ${
          showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        } ${
          didWin && !isDraw 
            ? 'border-player' 
            : isDraw 
            ? 'border-grid-line' 
            : 'border-opponent/50'
        }`}
        style={{
          boxShadow: didWin && !isDraw 
            ? '0 0 30px rgba(0,255,255,0.3), 0 0 60px rgba(0,255,255,0.1)' 
            : !didWin && !isDraw
            ? '0 0 30px rgba(255,0,255,0.2)'
            : '0 0 20px rgba(139,0,255,0.2)',
        }}
      >
        {/* Result Header */}
        <div className="text-center mb-6">
          <h1 
            className={`text-4xl sm:text-5xl font-display font-black mb-2 uppercase tracking-widest ${
              isDraw 
                ? 'text-secondary' 
                : didWin 
                ? 'text-player animate-glitch-text' 
                : 'text-primary'
            }`}
            style={didWin && !isDraw ? {
              textShadow: '0 0 10px rgba(0,255,255,0.8), 0 0 20px rgba(0,255,255,0.5), 0 0 40px rgba(255,0,255,0.3)',
            } : !didWin && !isDraw ? {
              textShadow: '0 0 10px rgba(255,0,255,0.3)',
            } : {}}
          >
            {isDraw ? 'DRAW' : didWin ? 'VICTORY' : 'DEFEAT'}
          </h1>
          
          <p className="text-secondary font-display text-sm uppercase tracking-wider">
            {getReasonText()}
          </p>
          
          {wasClose && (
            <p className="text-player text-sm font-display mt-2 animate-pulse uppercase tracking-wider">
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
            <div className="text-xs text-muted font-display uppercase tracking-widest mb-1 font-black">You</div>
            <div 
              className={`text-3xl font-mono font-black ${didWin ? 'text-player' : 'text-primary'}`}
              style={didWin ? { textShadow: '0 0 10px rgba(0,255,255,0.5)' } : {}}
            >
              {myResult.cellsCompleted}
            </div>
            <div className="text-xs text-muted font-mono">/81</div>
          </div>
          
          <div className="text-2xl text-muted font-display font-black uppercase tracking-widest">vs</div>
          
          <div className="text-center">
            <div className="text-xs text-muted font-display uppercase tracking-widest mb-1 font-black">Opponent</div>
            <div 
              className={`text-3xl font-mono font-black ${!didWin && !isDraw ? 'text-opponent' : 'text-primary'}`}
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
          <div className={`bg-elevated rounded-lg p-3 border ${
            didWin ? 'border-player/30' : 'border-grid-line'
          }`}>
            <p className={`font-display font-black mb-2 text-sm uppercase tracking-widest ${
              didWin ? 'text-player' : 'text-secondary'
            }`}>
              You
            </p>
            <div className="space-y-1 text-xs font-display">
              <div className="flex justify-between">
                <span className="text-muted uppercase tracking-wider">Mistakes</span>
                <span className="font-mono font-black text-primary">{myResult.mistakes}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted uppercase tracking-wider">Time Left</span>
                <span className="font-mono font-black text-primary">{formatTime(myResult.timeRemaining)}</span>
              </div>
            </div>
          </div>
          
          {/* Opponent Stats */}
          <div className={`bg-elevated rounded-lg p-3 border ${
            !didWin && !isDraw ? 'border-opponent/30' : 'border-grid-line'
          }`}>
            <p className={`font-display font-black mb-2 text-sm uppercase tracking-widest ${
              !didWin && !isDraw ? 'text-opponent' : 'text-secondary'
            }`}>
              Opponent
            </p>
            <div className="space-y-1 text-xs font-display">
              <div className="flex justify-between">
                <span className="text-muted uppercase tracking-wider">Mistakes</span>
                <span className="font-mono font-black text-primary">{opponentResult.mistakes}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted uppercase tracking-wider">Time Left</span>
                <span className="font-mono font-black text-primary">{formatTime(opponentResult.timeRemaining)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Rating Change */}
        <div 
          className={`bg-elevated rounded-xl p-4 mb-6 border transition-all duration-500 delay-200 ${
            showStats ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          } ${
            ratingChange > 0 
              ? 'border-success/50' 
              : ratingChange < 0 
              ? 'border-error/50' 
              : 'border-grid-line'
          }`}
          style={{
            boxShadow: ratingChange > 0 
              ? '0 0 15px rgba(0,255,136,0.15)' 
              : ratingChange < 0 
              ? '0 0 15px rgba(255,51,102,0.15)' 
              : 'none',
          }}
        >
          <div className="text-center">
            <div className="text-xs text-muted font-display uppercase tracking-widest mb-2 font-black">Rating</div>
            <div className="flex items-center justify-center gap-3">
              <span 
                className="text-3xl font-mono font-black text-player"
                style={{ textShadow: '0 0 10px rgba(0,255,255,0.3)' }}
              >
                {Math.round(displayedRating)}
              </span>
              <span 
                className={`text-xl font-mono font-black ${
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
            className={`w-full py-3 font-display font-black uppercase tracking-widest rounded-lg transition-all ${
              rematchState === 'waiting'
                ? 'bg-success/20 border-2 border-success text-success hover:bg-success/30 animate-pulse'
                : rematchState === 'requested'
                ? 'bg-elevated border border-grid-line text-muted cursor-not-allowed'
                : 'bg-transparent border-2 border-player text-player hover:bg-player/20 hover:shadow-glow-player active:scale-[0.98]'
            }`}
            style={rematchState === 'idle' ? {
              boxShadow: '0 0 10px rgba(0,255,255,0.2)',
            } : {}}
          >
            {rematchState === 'idle' && 'Rematch'}
            {rematchState === 'requested' && `Waiting... (${rematchCountdown}s)`}
            {rematchState === 'waiting' && '⚔️ Accept Rematch!'}
          </button>

          {/* Back to Lobby */}
          <button
            onClick={onBackToLobby}
            className="w-full py-3 bg-surface border border-grid-line text-secondary font-display font-black uppercase tracking-widest rounded-lg hover:border-player/50 hover:text-player transition-all"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    </div>
  );
}
