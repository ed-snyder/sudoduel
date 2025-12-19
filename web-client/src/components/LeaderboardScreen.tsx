import { useState, useEffect, useRef, forwardRef, useMemo, useCallback } from 'react';
import { leaderboardAPI } from '../services/api';
import type { LeaderboardEntry } from '../services/api';

interface LeaderboardScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROW_HEIGHT = 60; // Height of each row in pixels

export default function LeaderboardScreen({ isOpen, onClose }: LeaderboardScreenProps) {
  const [allPlayers, setAllPlayers] = useState<LeaderboardEntry[]>([]);
  const [yourRank, setYourRank] = useState<number>(0);
  const [totalPlayers, setTotalPlayers] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const yourRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadLeaderboard();
      setScrollTop(0); // Reset scroll position when opening
    } else {
      // Reset state when closed
      setAllPlayers([]);
      setYourRank(0);
      setTotalPlayers(0);
      setError('');
      setScrollTop(0);
    }
  }, [isOpen]);

  // Auto-scroll to user's rank when leaderboard loads
  useEffect(() => {
    if (!loading && allPlayers.length > 0 && yourRank > 0 && scrollContainerRef.current) {
      // Calculate scroll position for user's rank
      const targetScrollTop = (yourRank - 1) * ROW_HEIGHT - (scrollContainerRef.current.clientHeight / 2) + ROW_HEIGHT;
      scrollContainerRef.current.scrollTop = Math.max(0, targetScrollTop);
      setScrollTop(Math.max(0, targetScrollTop));
    }
  }, [loading, allPlayers.length, yourRank]);

  const loadLeaderboard = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await leaderboardAPI.getLeaderboard();
      setAllPlayers(data.top100); // Now contains all players
      setYourRank(data.your_rank || 0);
      setTotalPlayers(data.total_players);
    } catch (err: any) {
      console.error('[LeaderboardScreen] Error loading leaderboard:', err);
      setError(err.message || 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  // Calculate visible range for virtualization
  const virtualizedData = useMemo(() => {
    const containerHeight = scrollContainerRef.current?.clientHeight || 600; // Default height if not measured yet
    const startIdx = Math.floor(scrollTop / ROW_HEIGHT);
    const endIdx = Math.min(
      startIdx + Math.ceil(containerHeight / ROW_HEIGHT) + 2, // +2 for buffer
      allPlayers.length
    );
    const actualStartIdx = Math.max(0, startIdx - 1); // -1 for buffer
    
    return {
      startIndex: actualStartIdx,
      endIndex: endIdx,
      visiblePlayers: allPlayers.slice(actualStartIdx, endIdx),
    };
  }, [scrollTop, allPlayers]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const scrollToYourRank = () => {
    yourRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40 bg-void/95"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className="fixed z-50 flex flex-col bg-void rounded-xl overflow-hidden"
        style={{ 
          top: '2.5%',
          left: '2.5%',
          right: '2.5%',
          bottom: '2.5%',
          paddingTop: 'env(safe-area-inset-top)', 
          paddingBottom: 'env(safe-area-inset-bottom)',
          border: '2px solid rgba(255, 0, 255, 0.6)',
          boxShadow: '0 0 30px rgba(255, 0, 255, 0.3), inset 0 0 30px rgba(255, 0, 255, 0.1)',
        }}
      >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-grid-line bg-surface">
        <button
          onClick={onClose}
          className="text-muted hover:text-player transition-colors p-1"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-heading font-bold text-lg text-primary">Leaderboard</h1>
        <div className="w-8" /> {/* Spacer for centering */}
      </div>

      {/* Content */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div 
              className="w-10 h-10 border-4 border-surface border-t-player rounded-full animate-spin mb-4"
              style={{ boxShadow: '0 0 15px rgba(0,255,255,0.3)' }} 
            />
            <p className="text-muted font-display text-sm">Loading leaderboard...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-error font-display">{error}</p>
            <button 
              onClick={loadLeaderboard}
              className="mt-4 px-4 py-2 text-player border border-player rounded-lg hover:bg-player/10"
            >
              Retry
            </button>
          </div>
        ) : allPlayers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted font-display">No players found</p>
          </div>
        ) : (
          <div 
            className="relative pb-24"
            style={{ height: allPlayers.length * ROW_HEIGHT }}
          >
            {/* Spacer for items before visible range */}
            <div style={{ height: virtualizedData.startIndex * ROW_HEIGHT }} />
            
            {/* Visible rows */}
            <div className="px-4 py-2">
              {virtualizedData.visiblePlayers.map((entry) => (
                <div
                  key={entry.player_id}
                  style={{ height: ROW_HEIGHT }}
                >
                  <LeaderboardRow 
                    entry={entry} 
                    ref={entry.is_you ? yourRowRef : undefined}
                  />
                </div>
              ))}
            </div>
            
            {/* Spacer for items after visible range */}
            <div style={{ height: (allPlayers.length - virtualizedData.endIndex) * ROW_HEIGHT }} />
          </div>
        )}
      </div>

      {/* Sticky Footer - Your Rank */}
      {!loading && !error && (
        <div 
          className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-surface border-t"
          style={{ 
            paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)',
            borderColor: 'rgba(255, 0, 255, 0.5)',
            boxShadow: '0 -4px 20px rgba(255, 0, 255, 0.3), 0 -8px 40px rgba(255, 0, 255, 0.15)'
          }}
        >
          <button
            onClick={scrollToYourRank}
            className="w-full flex items-center justify-between hover:bg-player/5 rounded-lg p-2 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-player font-mono font-bold text-lg">
                #{yourRank != null ? yourRank.toLocaleString() : '--'}
              </span>
              <span className="text-primary font-display font-bold">You</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted font-mono">
                of {totalPlayers != null ? totalPlayers.toLocaleString() : '--'}
              </span>
              <svg className="w-4 h-4 text-player" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </div>
          </button>
        </div>
      )}
      </div>
    </>
  );
}

// Leaderboard Row Component
interface LeaderboardRowProps {
  entry: LeaderboardEntry;
}

const LeaderboardRow = forwardRef<HTMLDivElement, LeaderboardRowProps>(
  ({ entry }, ref) => {
    const isTopThree = entry.rank <= 3;
    const rankColors: Record<number, string> = {
      1: 'text-yellow-400', // Gold
      2: 'text-gray-300',   // Silver
      3: 'text-amber-600',  // Bronze
    };

    return (
      <div
        ref={ref}
        className={`flex items-center justify-between px-2 rounded-lg transition-colors ${
          entry.is_you 
            ? 'bg-player/20 border border-player/50' 
            : 'hover:bg-elevated/30'
        }`}
        style={{ minHeight: ROW_HEIGHT }}
      >
        <div className="flex items-center gap-3">
          {/* Rank */}
          <span 
            className={`font-mono font-bold text-sm w-12 ${
              isTopThree ? rankColors[entry.rank] : 'text-muted'
            }`}
          >
            #{entry.rank}
          </span>
          
          {/* Name */}
          <span className={`font-display font-semibold ${
            entry.is_you ? 'text-player' : 'text-primary'
          }`}>
            {entry.display_name}
            {entry.is_you && (
              <span className="ml-2 text-xs text-player/70 font-normal">← YOU</span>
            )}
          </span>
        </div>

        {/* Rating */}
        <span className={`font-mono font-bold ${
          entry.is_you ? 'text-player' : 'text-secondary'
        }`}>
          {entry.rating.toLocaleString()}
        </span>
      </div>
    );
  }
);

LeaderboardRow.displayName = 'LeaderboardRow';
