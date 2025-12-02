// Hook to detect mobile vs desktop for conditional rendering

import { useState, useEffect } from 'react';

interface MobileDetect {
  isMobile: boolean;
  isTouch: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isCapacitor: boolean;
}

export function useMobileDetect(): MobileDetect {
  const [state, setState] = useState<MobileDetect>({
    isMobile: false,
    isTouch: false,
    isIOS: false,
    isAndroid: false,
    isCapacitor: false,
  });

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    
    setState({
      isMobile: /android|iphone|ipad|ipod|windows phone/i.test(userAgent),
      isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      isIOS: /iphone|ipad|ipod/i.test(userAgent),
      isAndroid: /android/i.test(userAgent),
      isCapacitor: !!(window as any).Capacitor,
    });
  }, []);

  return state;
}

