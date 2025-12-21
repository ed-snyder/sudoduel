import { Capacitor } from '@capacitor/core';

// Config - adjust these values as needed
const REVIEW_CONFIG = {
  minWinsBeforePrompt: 3,       // Prompt after 3rd win
  minDaysBetweenPrompts: 14,    // Don't prompt more than every 2 weeks
  maxPromptsPerVersion: 1,      // Only once per app version
};

const STORAGE_KEYS = {
  totalWins: 'review_total_wins',
  lastPromptDate: 'review_last_prompt_date',
  lastPromptVersion: 'review_last_prompt_version',
  promptCount: 'review_prompt_count',
};

// Get app version from package.json or hardcode
const getAppVersion = (): string => {
  // Update this when releasing new versions
  return '1.0.0';
};

interface ReviewStats {
  totalWins: number;
  lastPromptDate: number | null;
  lastPromptVersion: string | null;
  promptCountThisVersion: number;
}

function getReviewStats(): ReviewStats {
  const currentVersion = getAppVersion();
  const storedVersion = localStorage.getItem(STORAGE_KEYS.lastPromptVersion);
  
  // Reset prompt count if version changed
  const promptCountThisVersion = storedVersion === currentVersion 
    ? parseInt(localStorage.getItem(STORAGE_KEYS.promptCount) || '0', 10)
    : 0;

  return {
    totalWins: parseInt(localStorage.getItem(STORAGE_KEYS.totalWins) || '0', 10),
    lastPromptDate: localStorage.getItem(STORAGE_KEYS.lastPromptDate) 
      ? parseInt(localStorage.getItem(STORAGE_KEYS.lastPromptDate)!, 10) 
      : null,
    lastPromptVersion: storedVersion,
    promptCountThisVersion,
  };
}

function incrementWinCount(): number {
  const stats = getReviewStats();
  const newCount = stats.totalWins + 1;
  localStorage.setItem(STORAGE_KEYS.totalWins, newCount.toString());
  return newCount;
}

function recordPromptAttempt(): void {
  const currentVersion = getAppVersion();
  const stats = getReviewStats();
  
  localStorage.setItem(STORAGE_KEYS.lastPromptDate, Date.now().toString());
  localStorage.setItem(STORAGE_KEYS.lastPromptVersion, currentVersion);
  localStorage.setItem(STORAGE_KEYS.promptCount, (stats.promptCountThisVersion + 1).toString());
}

/**
 * Call this after every victory to potentially show review prompt.
 * Handles all the logic for when to show/not show.
 */
export async function maybePromptReviewAfterWin(): Promise<void> {
  // Only on native platforms
  if (!Capacitor.isNativePlatform()) {
    console.log('[Review] Not native platform, skipping');
    return;
  }

  // Increment win count first
  const totalWins = incrementWinCount();
  console.log('[Review] Win recorded. Total wins:', totalWins);

  // Check minimum wins
  if (totalWins < REVIEW_CONFIG.minWinsBeforePrompt) {
    console.log(`[Review] Not enough wins yet (${totalWins}/${REVIEW_CONFIG.minWinsBeforePrompt})`);
    return;
  }

  const stats = getReviewStats();

  // Check prompts this version
  if (stats.promptCountThisVersion >= REVIEW_CONFIG.maxPromptsPerVersion) {
    console.log('[Review] Already prompted this version');
    return;
  }

  // Check time since last prompt
  if (stats.lastPromptDate) {
    const daysSinceLastPrompt = (Date.now() - stats.lastPromptDate) / (1000 * 60 * 60 * 24);
    if (daysSinceLastPrompt < REVIEW_CONFIG.minDaysBetweenPrompts) {
      console.log(`[Review] Too soon since last prompt (${daysSinceLastPrompt.toFixed(1)} days)`);
      return;
    }
  }

  // All conditions met - request review!
  console.log('[Review] All conditions met, requesting review...');
  await requestReview();
  recordPromptAttempt();
  console.log('[Review] Review requested and recorded');
}

/**
 * Force show the review prompt (for dev testing only).
 * In production, Apple may still not show it due to their limits.
 */
export async function forceRequestReview(): Promise<void> {
  console.log('[Review] Force requesting review (dev mode)');
  await requestReview();
}

/**
 * Internal function to actually request the review.
 */
async function requestReview(): Promise<void> {
  try {
    const { InAppReview } = await import('@capacitor-community/in-app-review');
    await InAppReview.requestReview();
  } catch (error) {
    console.error('[Review] Error requesting review:', error);
  }
}

/**
 * Get current stats for debugging/dev UI.
 */
export function getDebugReviewStats(): ReviewStats & { config: typeof REVIEW_CONFIG } {
  const stats = getReviewStats();
  return {
    ...stats,
    config: REVIEW_CONFIG,
  };
}

/**
 * Reset all review stats (for testing).
 */
export function resetReviewStats(): void {
  localStorage.removeItem(STORAGE_KEYS.totalWins);
  localStorage.removeItem(STORAGE_KEYS.lastPromptDate);
  localStorage.removeItem(STORAGE_KEYS.lastPromptVersion);
  localStorage.removeItem(STORAGE_KEYS.promptCount);
  console.log('[Review] Stats reset');
}

