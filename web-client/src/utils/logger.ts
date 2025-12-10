// Development-only logger utility
// In production, all logs are disabled to prevent performance issues

const isDev = (() => {
  // Explicit production mode check
  if (import.meta.env.PROD) return false;
  if (import.meta.env.MODE === 'production') return false;
  
  // Check if running in Capacitor production build
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    // Capacitor apps use capacitor:// or file:// protocols in production
    if (protocol === 'capacitor:' || protocol === 'file:') {
      return false;
    }
  }
  
  // Default to checking DEV flag
  return import.meta.env.DEV === true;
})();

export const log = {
  perf: (...args: any[]) => {
    if (isDev) console.log('[PERF]', ...args);
  },
  feedback: (...args: any[]) => {
    if (isDev) console.log('[FEEDBACK]', ...args);
  },
  countdown: (...args: any[]) => {
    if (isDev) console.log('[COUNTDOWN]', ...args);
  },
  rematch: (...args: any[]) => {
    if (isDev) console.log('[REMATCH]', ...args);
  },
  timer: (...args: any[]) => {
    if (isDev) console.log('[TIMER]', ...args);
  },
  grid: (...args: any[]) => {
    if (isDev) console.log('[GRID ANIM]', ...args);
  },
  game: (...args: any[]) => {
    if (isDev) console.log('[GamePage]', ...args);
  },
  debug: (...args: any[]) => {
    if (isDev) console.log(...args);
  },
};
