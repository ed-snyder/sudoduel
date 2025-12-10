import { Haptics, ImpactStyle } from '@capacitor/haptics';

export function useHaptics() {
  // Check if haptics are enabled (respect user preference)
  const isHapticsEnabled = () => {
    if (typeof window === 'undefined') return false;
    const hapticEnabled = localStorage.getItem('hapticEnabled');
    return hapticEnabled !== 'false'; // Default to enabled
  };

  const vibrate = (pattern: number | number[] = 10) => {
    if (!isHapticsEnabled()) return;
    
    // Fallback to web Vibration API
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  // Capacitor-specific haptics with intensity control
  const impact = async (style: 'light' | 'medium' | 'heavy' = 'medium') => {
    if (!isHapticsEnabled()) return;
    
    try {
      const impactStyle = style === 'heavy' 
        ? ImpactStyle.Heavy 
        : style === 'medium' 
          ? ImpactStyle.Medium 
          : ImpactStyle.Light;
      await Haptics.impact({ style: impactStyle });
    } catch {
      // Fallback to vibration API
      const duration = style === 'heavy' ? 25 : style === 'medium' ? 15 : 8;
      if ('vibrate' in navigator) {
        navigator.vibrate(duration);
      }
    }
  };

  const success = () => impact('medium');
  const successStreak = () => impact('heavy');
  const error = () => vibrate([50, 30, 50]);
  const tap = () => impact('light');
  const victory = () => vibrate([30, 20, 30, 20, 100]);
  const bigWin = () => vibrate([50, 50, 100]);

  return { vibrate, impact, success, successStreak, error, tap, victory, bigWin };
}
