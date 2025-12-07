import { useState, useEffect, useRef } from 'react';
import { matchmakingAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

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
  onFindNewMatch: (matchId: number) => void;
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
  onFindNewMatch,
  rematchState,
  rematchCountdown = 0,
}: ResultScreenProps) {
  const { user } = useAuth();
  const [displayedRating, setDisplayedRating] = useState(myResult.rating_before);
  const [showContent, setShowContent] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);

  const ratingChange = myResult.rating_change || 0;
  const cellDifference = opponentResult.cellsCompleted - myResult.cellsCompleted;
  const wasClose = !didWin && !isDraw && cellDifference <= 5 && cellDifference > 0;

  // Get display names - use actual user names, fallback to displayName from results, then generic fallback
  const myDisplayName = myResult.displayName || user?.display_name || 'Player';
  const opponentDisplayName = opponentResult.displayName || 'Opponent';

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 100);
    return () => {
      clearTimeout(timer);
      stopPolling();
    };
  }, []);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
    attemptsRef.current = 0;
  };

  const handleFindNewMatch = async () => {
    setSearchError('');
    setSearching(true);
    attemptsRef.current = 0;

    try {
      const response = await matchmakingAPI.join() as { status: string; match_id?: number };
      
      if (response.status === 'matched') {
        stopPolling();
        onFindNewMatch(response.match_id!);
      } else {
        pollForMatch();
      }
    } catch (err: any) {
      setSearchError(err.message);
      setSearching(false);
    }
  };

  const pollForMatch = () => {
    pollingRef.current = setTimeout(async () => {
      attemptsRef.current++;
      
      if (attemptsRef.current >= 30) {
        try {
          await matchmakingAPI.leave();
        } catch (e) {}
        setSearching(false);
        setSearchError('No opponent found. Try again!');
        stopPolling();
        return;
      }

      try {
        const response = await matchmakingAPI.status() as { status: string; match_id?: number };
        
        if (response.status === 'matched') {
          stopPolling();
          onFindNewMatch(response.match_id!);
        } else if (response.status === 'queued') {
          pollForMatch();
        } else {
          setSearching(false);
          stopPolling();
        }
      } catch (err) {
        setSearching(false);
        stopPolling();
      }
    }, 1000);
  };

  const handleCancelSearch = async () => {
    stopPolling();
    try {
      await matchmakingAPI.leave();
    } catch (err) {}
    setSearching(false);
  };

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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getReasonText = () => {
    if (reason === 'FORFEIT') return didWin ? `${opponentDisplayName} forfeited` : `${myDisplayName} forfeited`;
    if (reason === 'PUZZLE_SOLVED') return didWin ? 'Puzzle completed!' : `${opponentDisplayName} solved it`;
    if (reason === 'TIMEOUT_SCORE') return didWin ? 'Higher score' : 'Lower score';
    if (reason === 'DRAW') return 'Equal scores';
    return '';
  };

  // Colors based on win/loss
  const fillColor = didWin ? '#00FFFF' : '#FF00FF';
  const fillColorLight = didWin ? '#7FFFFF' : '#FF7FFF';
  const fillColorDark = didWin ? '#00B3B3' : '#B300B3';
  const glowColor = didWin ? '#FF00FF' : '#00FFFF';
  const glowColorRgba = didWin ? 'rgba(255,0,255,' : 'rgba(0,255,255,';

  const titleStyle = {
    fontFamily: "'Industry', 'Orbitron', sans-serif",
    fontWeight: 900,
    fontStyle: 'italic',
    letterSpacing: '-0.02em',
  };

  return (
    <div className="fixed inset-0 bg-void flex flex-col z-50">
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

      {/* Ambient glow */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: didWin 
            ? 'radial-gradient(circle at center 30%, rgba(0,255,255,0.1) 0%, transparent 50%)'
            : 'radial-gradient(circle at center 30%, rgba(255,0,255,0.08) 0%, transparent 50%)',
        }}
      />

      {/* Back Button - Top Left */}
      <div className="relative z-10 pt-16 px-4">
        <button
          onClick={onBackToLobby}
          className="flex items-center gap-2 text-muted hover:text-player transition-colors group"
        >
          <svg 
            className="w-6 h-6 group-hover:scale-110 transition-transform" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-body text-sm uppercase tracking-wider">Lobby</span>
        </button>
      </div>

      {/* Main Content */}
      <div 
        className={`flex-1 flex flex-col items-center justify-center px-6 pb-8 transition-all duration-500 ${
          showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        {/* Result Title - Logo style effect */}
        <div className="relative mb-2">
          {/* Outer glow layer */}
          <span
            className="absolute inset-0 text-7xl sm:text-8xl select-none pointer-events-none"
            style={{
              ...titleStyle,
              color: 'transparent',
              WebkitTextStroke: `6px ${glowColor}`,
              filter: 'blur(8px)',
              opacity: 0.6,
            }}
            aria-hidden="true"
          >
            {isDraw ? 'DRAW' : didWin ? 'VICTORY' : 'DEFEAT'}
          </span>

          {/* Inner glow layer */}
          <span
            className="absolute inset-0 text-7xl sm:text-8xl select-none pointer-events-none"
            style={{
              ...titleStyle,
              color: 'transparent',
              WebkitTextStroke: `4px ${glowColor}`,
              filter: 'blur(3px)',
              opacity: 0.8,
            }}
            aria-hidden="true"
          >
            {isDraw ? 'DRAW' : didWin ? 'VICTORY' : 'DEFEAT'}
          </span>

          {/* White stroke layer */}
          <span
            className="absolute inset-0 text-7xl sm:text-8xl select-none pointer-events-none"
            style={{
              ...titleStyle,
              color: 'transparent',
              WebkitTextStroke: '2px rgba(255,255,255,0.9)',
            }}
            aria-hidden="true"
          >
            {isDraw ? 'DRAW' : didWin ? 'VICTORY' : 'DEFEAT'}
          </span>

          {/* Fill gradient - main visible text */}
          <span
            className="relative text-7xl sm:text-8xl select-none"
            style={{
              ...titleStyle,
              background: isDraw 
                ? 'linear-gradient(135deg, #8B8B8B 0%, #FFFFFF 50%, #8B8B8B 100%)'
                : `linear-gradient(135deg, ${fillColor} 0%, ${fillColorLight} 25%, ${fillColor} 50%, ${fillColorDark} 75%, ${fillColor} 100%)`,
              backgroundSize: '200% 200%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: 'logo-shimmer 3s ease-in-out infinite',
            }}
          >
            {isDraw ? 'DRAW' : didWin ? 'VICTORY' : 'DEFEAT'}
          </span>
        </div>

        {/* Reason subtitle */}
        <p className="text-secondary font-body text-sm mb-6 uppercase tracking-wider">
          {getReasonText()}
        </p>

        {/* Score comparison */}
        <div className="flex items-center gap-4 mb-4">
          <div className="text-center">
            <span className="text-xs text-muted font-body uppercase tracking-wider block mb-1">{myDisplayName}</span>
            <span 
              className={`text-4xl font-mono font-bold ${didWin ? 'text-player' : 'text-primary'}`}
              style={didWin ? { textShadow: `0 0 15px ${glowColorRgba}0.5)` } : {}}
            >
              {myResult.cellsCompleted}
            </span>
          </div>
          <span className="text-2xl text-muted font-mono">—</span>
          <div className="text-center">
            <span className="text-xs text-muted font-body uppercase tracking-wider block mb-1">{opponentDisplayName}</span>
            <span 
              className={`text-4xl font-mono font-bold ${!didWin && !isDraw ? 'text-opponent' : 'text-primary'}`}
              style={!didWin && !isDraw ? { textShadow: `0 0 15px ${glowColorRgba}0.5)` } : {}}
            >
              {opponentResult.cellsCompleted}
            </span>
          </div>
        </div>

        {/* Close loss message */}
        {wasClose && (
          <p className="text-player text-sm font-body mb-4 animate-pulse">
            {cellDifference} more cell{cellDifference !== 1 ? 's' : ''} would've won!
          </p>
        )}

        {/* Stats row */}
        <div className="flex gap-6 mb-6 text-center">
          <div>
            <span className="text-xs text-muted font-body uppercase tracking-wider block">Time Left</span>
            <span className="text-lg font-mono text-primary">{formatTime(myResult.timeRemaining)}</span>
          </div>
          <div>
            <span className="text-xs text-muted font-body uppercase tracking-wider block">Mistakes</span>
            <span className="text-lg font-mono text-primary">{myResult.mistakes}</span>
          </div>
        </div>

        {/* Rating */}
        <div 
          className="bg-elevated/50 rounded-xl px-8 py-4 mb-8 border"
          style={{
            borderColor: ratingChange > 0 
              ? 'rgba(0,255,136,0.4)' 
              : ratingChange < 0 
              ? 'rgba(255,51,102,0.4)' 
              : 'rgba(139,0,255,0.3)',
            boxShadow: ratingChange > 0 
              ? '0 0 20px rgba(0,255,136,0.15)' 
              : ratingChange < 0 
              ? '0 0 20px rgba(255,51,102,0.15)' 
              : 'none',
          }}
        >
          <div className="flex items-center justify-center gap-3">
            <span className="text-3xl font-mono font-bold text-primary">
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

        {/* Action Buttons / Search UI */}
        <div className="w-full max-w-xs">
          {searching ? (
            <div className="text-center">
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-surface" />
                <div 
                  className="absolute inset-0 rounded-full border-4 border-transparent border-t-player animate-spin"
                  style={{ 
                    boxShadow: '0 0 20px rgba(0,255,255,0.5)',
                    filter: 'drop-shadow(0 0 10px rgba(0,255,255,0.8))'
                  }}
                />
              </div>
              
              <h2 className="text-xl font-display font-black text-primary mb-2 tracking-wide">SEARCHING...</h2>
              <p className="text-secondary font-display mb-1">Looking for an opponent</p>
              <p className="text-player text-lg font-display mb-6">
                0:{String(30 - attemptsRef.current).padStart(2, '0')}
              </p>
              
              {searchError && (
                <div 
                  className="w-full mb-4 px-4 py-3 bg-void bg-error/10 border border-error/50 rounded-lg"
                  style={{ boxShadow: '0 0 15px rgba(255,51,102,0.2)' }}
                >
                  <p className="text-error text-sm font-display">{searchError}</p>
                </div>
              )}
              
              <button
                onClick={handleCancelSearch}
                className="w-full py-3 bg-surface border border-grid-line text-secondary font-display font-black rounded-lg hover:border-error/50 hover:text-error transition-all"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Rematch */}
              <button
                onClick={onRematch}
                disabled={rematchState === 'requested'}
                className={`w-full py-4 text-lg font-body font-bold uppercase tracking-widest rounded-xl transition-all active:scale-[0.98] ${
                  rematchState === 'waiting'
                    ? 'bg-success/20 border-2 border-success text-success animate-pulse'
                    : rematchState === 'requested'
                    ? 'bg-elevated border border-grid-line text-muted cursor-not-allowed'
                    : 'bg-player/10 border-2 border-player text-player hover:bg-player/20'
                }`}
                style={rematchState === 'idle' ? {
                  boxShadow: '0 0 20px rgba(0,255,255,0.25)',
                } : {}}
              >
                {rematchState === 'idle' && 'Rematch'}
                {rematchState === 'requested' && `Waiting... ${rematchCountdown}s`}
                {rematchState === 'waiting' && '⚔️ Accept Rematch'}
              </button>

              {/* Find New Match */}
              <button
                onClick={handleFindNewMatch}
                className="w-full py-4 text-lg bg-void border-2 border-player text-player font-display font-black uppercase tracking-widest rounded-xl hover:bg-player/20 hover:shadow-glow-player-intense active:scale-[0.98] transition-all animate-glow-pulse"
              >
                Find New Match
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
