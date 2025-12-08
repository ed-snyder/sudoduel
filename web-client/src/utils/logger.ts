// Development-only logger utility
// In production, all logs are disabled to prevent performance issues

const isDev = import.meta.env.DEV;

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
  // Generic log for other cases
  debug: (...args: any[]) => {
    if (isDev) console.log(...args);
  },
};
