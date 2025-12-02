// Wrapper component for safe area insets (notches, home indicators)
// Ready for Capacitor deployment

import type { ReactNode } from 'react';

interface SafeAreaWrapperProps {
  children: ReactNode;
  className?: string;
}

export function SafeAreaWrapper({ children, className = '' }: SafeAreaWrapperProps) {
  return (
    <div 
      className={`
        min-h-screen
        pt-[env(safe-area-inset-top)]
        pb-[env(safe-area-inset-bottom)]
        pl-[env(safe-area-inset-left)]
        pr-[env(safe-area-inset-right)]
        ${className}
      `}
    >
      {children}
    </div>
  );
}

