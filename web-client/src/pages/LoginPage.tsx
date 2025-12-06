import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import SudoDuelLogo from '../components/SudoDuelLogo';

export default function LoginPage() {
  const { login, signup } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(email, password, displayName);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-void flex flex-col">
      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 safe-top safe-bottom">
        {/* Logo */}
        <div className="mb-4">
          <SudoDuelLogo size="xl" />
        </div>
        
        {/* Tagline */}
        <p className="text-secondary mb-10 font-body text-lg tracking-wide">
          Competitive 1v1 Sudoku
        </p>
        
        {/* Tab Switcher */}
        <div className="w-full max-w-sm mb-6">
          <div className="flex bg-surface rounded-lg p-1 border border-grid-line">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2.5 text-center rounded-md font-body font-semibold uppercase tracking-wider text-sm transition-all duration-200 ${
                isLogin
                  ? 'bg-player/20 text-player border border-player/50 shadow-glow-player-subtle'
                  : 'text-muted hover:text-secondary'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2.5 text-center rounded-md font-body font-semibold uppercase tracking-wider text-sm transition-all duration-200 ${
                !isLogin
                  ? 'bg-player/20 text-player border border-player/50 shadow-glow-player-subtle'
                  : 'text-muted hover:text-secondary'
              }`}
            >
              Sign Up
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="w-full max-w-sm space-y-4">
          {error && (
            <div 
              className="px-4 py-3 bg-error/10 border border-error/50 rounded-lg animate-shake"
              style={{ boxShadow: '0 0 15px rgba(255,51,102,0.2)' }}
            >
              <p className="text-error text-sm font-body">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display Name"
                className="w-full px-4 py-3.5 bg-surface border border-grid-line rounded-lg text-primary font-body placeholder-muted focus:outline-none focus:border-player focus:shadow-glow-player-subtle transition-all duration-200"
                required={!isLogin}
              />
            )}

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full px-4 py-3.5 bg-surface border border-grid-line rounded-lg text-primary font-body placeholder-muted focus:outline-none focus:border-player focus:shadow-glow-player-subtle transition-all duration-200"
              required
            />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-3.5 bg-surface border border-grid-line rounded-lg text-primary font-body placeholder-muted focus:outline-none focus:border-player focus:shadow-glow-player-subtle transition-all duration-200"
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-transparent border-2 border-player text-player font-body font-bold uppercase tracking-widest rounded-lg hover:bg-player/20 hover:shadow-glow-player active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Please wait...
                </span>
              ) : isLogin ? 'Log In' : 'Create Account'}
            </button>
          </form>
        </div>
        
        {isLogin && (
          <p className="mt-8 text-muted font-body">
            Don't have an account?{' '}
            <button 
              onClick={() => setIsLogin(false)}
              className="text-player font-semibold hover:text-player-bright transition-colors"
            >
              Sign Up
            </button>
          </p>
        )}
        
        <p className="absolute bottom-4 text-xs text-muted/50 font-mono">v1.0.0</p>
      </div>
    </div>
  );
}
