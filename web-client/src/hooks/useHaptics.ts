// Haptic feedback hook - works on web (vibration API) and Capacitor

export function useHaptics() {
  const vibrate = (pattern: number | number[] = 10) => {
    // Check for Capacitor Haptics plugin first (when you add it later)
    if ((window as any).Capacitor?.Plugins?.Haptics) {
      (window as any).Capacitor.Plugins.Haptics.impact({ style: 'light' });
      return;
    }
    
    // Fallback to web Vibration API
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  const success = () => vibrate(10);
  const error = () => vibrate([50, 30, 50]);
  const tap = () => vibrate(5);
  const victory = () => vibrate([30, 20, 30, 20, 100]); // Staccato then strong
  const bigWin = () => vibrate([50, 50, 100]); // For +30 rating gains

  return { vibrate, success, error, tap, victory, bigWin };
}

