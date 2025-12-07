/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      /* =========================================
         COLORS
         ========================================= */
      colors: {
        // Primary Identity
        player: {
          DEFAULT: '#00FFFF',
          bright: '#7FFFFF',
          dim: '#00B3B3',
        },
        opponent: {
          DEFAULT: '#FF00FF',
          bright: '#FF7FFF',
          dim: '#B300B3',
        },
        accent: {
          DEFAULT: '#8B00FF',
          bright: '#B366FF',
          dim: '#5C00A6',
        },
        
        // Semantic
        success: {
          DEFAULT: '#00FF88',
          dim: '#00B35F',
        },
        error: {
          DEFAULT: '#FF3366',
          dim: '#B32447',
        },
        warning: {
          DEFAULT: '#FFB800',
          dim: '#B38200',
        },
        
        // Backgrounds
        void: '#0D0221',
        deep: '#120330',
        surface: '#1A0640',
        elevated: '#240850',
        
        // Neutrals (overriding defaults)
        neutral: {
          50: '#F0E6FF',
          100: '#E0D4F5',
          200: '#B8A8D4',
          300: '#9A8AC0',
          400: '#7A6B99',
          500: '#5A4D7A',
          600: '#4A3D66',
          700: '#2D1B69',
          800: '#1F1045',
          900: '#120330',
          950: '#0D0221',
        },
        
        // Monetization
        gold: {
          DEFAULT: '#FFD700',
          bright: '#FFEC80',
          dim: '#B39700',
        },
        sale: '#FF4466',
        
        // Rarity
        common: '#9090A0',
        uncommon: '#00FF88',
        rare: '#00FFFF',
        epic: '#FF00FF',
        legendary: '#FFD700',
        
        // League
        bronze: '#CD7F32',
        silver: '#C0C0C0',
        platinum: '#E5E4E2',
        diamond: '#B9F2FF',
        master: '#FF00FF',
        
        // Grid
        'grid-line': '#2D1B69',
        'grid-line-strong': '#3D2580',
        
        // Semantic text colors
        'primary': '#F0E6FF',
        'secondary': '#B8A8D4',
        'muted': '#7A6B99',
        'disabled': '#4A3D66',
      },
      
      /* =========================================
         TYPOGRAPHY
         ========================================= */
      fontFamily: {
        display: ['Industry', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['Industry', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Industry', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['Industry', 'ui-monospace', 'monospace'],
      },
      
      fontSize: {
        'timer': ['clamp(1.5rem, 5vw, 2rem)', { lineHeight: '1' }],
        'cell': ['clamp(1.25rem, 5vw, 2rem)', { lineHeight: '1' }],
        'cell-notes': ['clamp(0.5rem, 1.5vw, 0.6875rem)', { lineHeight: '1' }],
      },
      
      /* =========================================
         SPACING
         ========================================= */
      spacing: {
        '0.5': '2px',
        '1.5': '6px',
        '2.5': '10px',
        '18': '72px',
        '22': '88px',
      },
      
      /* =========================================
         BORDER RADIUS
         ========================================= */
      borderRadius: {
        'DEFAULT': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
      },
      
      /* =========================================
         BOX SHADOW (Glows)
         ========================================= */
      boxShadow: {
        // Player glows
        'glow-player-subtle': '0 0 8px rgba(0, 255, 255, 0.4)',
        'glow-player': '0 0 10px rgba(0, 255, 255, 0.5), 0 0 20px rgba(0, 255, 255, 0.3)',
        'glow-player-intense': '0 0 10px rgba(0, 255, 255, 0.6), 0 0 20px rgba(0, 255, 255, 0.4), 0 0 40px rgba(0, 255, 255, 0.2)',
        'glow-player-mega': '0 0 10px rgba(0, 255, 255, 0.7), 0 0 20px rgba(0, 255, 255, 0.5), 0 0 40px rgba(0, 255, 255, 0.3), 0 0 80px rgba(0, 255, 255, 0.2)',
        
        // Opponent glows
        'glow-opponent-subtle': '0 0 8px rgba(255, 0, 255, 0.4)',
        'glow-opponent': '0 0 10px rgba(255, 0, 255, 0.5), 0 0 20px rgba(255, 0, 255, 0.3)',
        'glow-opponent-intense': '0 0 10px rgba(255, 0, 255, 0.6), 0 0 20px rgba(255, 0, 255, 0.4), 0 0 40px rgba(255, 0, 255, 0.2)',
        
        // Semantic glows
        'glow-success': '0 0 10px rgba(0, 255, 136, 0.5), 0 0 20px rgba(0, 255, 136, 0.3)',
        'glow-error': '0 0 10px rgba(255, 51, 102, 0.5), 0 0 20px rgba(255, 51, 102, 0.3)',
        'glow-warning': '0 0 10px rgba(255, 184, 0, 0.5), 0 0 20px rgba(255, 184, 0, 0.3)',
        'glow-gold': '0 0 10px rgba(255, 215, 0, 0.5), 0 0 20px rgba(255, 215, 0, 0.3)',
        
        // Elevation shadows
        'elevation-sm': '0 2px 4px rgba(0, 0, 0, 0.3)',
        'elevation-md': '0 4px 8px rgba(0, 0, 0, 0.4)',
        'elevation-lg': '0 8px 16px rgba(0, 0, 0, 0.5)',
        'elevation-xl': '0 16px 32px rgba(0, 0, 0, 0.6)',
        
        // Inset glows
        'inset-player': 'inset 0 0 10px rgba(0, 255, 255, 0.3)',
        'inset-opponent': 'inset 0 0 10px rgba(255, 0, 255, 0.3)',
        'inset-success': 'inset 0 0 10px rgba(0, 255, 136, 0.3)',
        'inset-error': 'inset 0 0 10px rgba(255, 51, 102, 0.3)',
      },
      
      /* =========================================
         ANIMATIONS
         ========================================= */
      animation: {
        // Glows
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'glow-pulse-intense': 'glow-pulse-intense 1.5s ease-in-out infinite',
        'text-glow-pulse': 'text-glow-pulse 2s ease-in-out infinite',
        
        // Cells
        'cell-pop': 'cell-pop 200ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'shake': 'shake 150ms ease-out',
        'micro-shake': 'micro-shake 100ms ease-out',
        'completion-flash': 'completion-flash 400ms ease-out forwards',
        'almost-complete': 'almost-complete-pulse 1.5s ease-in-out infinite',
        
        // Feedback
        'float-up': 'float-up 800ms ease-out forwards',
        'float-up-centered': 'float-up-centered 800ms ease-out forwards',
        'score-pulse': 'score-pulse 250ms ease-out forwards',
        'score-pulse-intense': 'score-pulse-intense 300ms ease-out forwards',
        
        // Effects
        'screen-shake': 'screen-shake 400ms ease-out',
        'glitch-text': 'glitch-text 600ms ease-out forwards',
        'glitch-flicker': 'glitch-flicker 2s ease-in-out infinite',
        
        // Transitions
        'fade-in': 'fade-in 200ms ease-out forwards',
        'fade-out': 'fade-out 200ms ease-out forwards',
        'fade-in-up': 'fade-in-up 300ms ease-out forwards',
        'slide-in-up': 'slide-in-up 300ms ease-out forwards',
        'slide-in-down': 'slide-in-down 300ms ease-out forwards',
        'slide-in-left': 'slide-in-left 300ms ease-out forwards',
        'slide-in-right': 'slide-in-right 300ms ease-out forwards',
        'scale-in': 'scale-in 250ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'scale-in-bounce': 'scale-in-bounce 400ms ease-out forwards',
        
        // Countdown
        'countdown-pop': 'countdown-pop 800ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'countdown-exit': 'countdown-exit 200ms ease-out forwards',
        
        // Store
        'unlock-burst': 'unlock-burst 500ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'rank-up': 'rank-up 800ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'new-pulse': 'new-pulse 1.5s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        
        // Timer
        'timer-warning': 'timer-warning-pulse 1.5s ease-in-out infinite',
        'timer-critical': 'timer-critical-pulse 0.75s ease-in-out infinite',
        
        // Logo
        'logo-shimmer': 'logo-shimmer 3s ease-in-out infinite',
        'float': 'float 4s ease-in-out infinite',
        
        // Matrix
        'matrix-fall': 'matrix-fall 15s linear infinite',
        
        // Background effects
        'comet-streak': 'comet-streak 2s linear forwards',
        'grid-flash': 'grid-flash 0.6s ease-out forwards',
        'pulse-slow': 'pulse-slow 8s ease-in-out infinite',
        
        // Victory/Result screen
        'victory-burst': 'victory-burst 0.8s ease-out forwards',
        'glitch-text': 'glitch-text 0.6s ease-out forwards',
        
        // Result screen animations
        'slam-in': 'slam-in 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'particle-burst': 'particle-burst 2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
        'particle-fall': 'particle-fall 4s linear forwards',
        'sparkle': 'sparkle 1.5s ease-in-out infinite',
        'shake': 'shake 0.3s ease-out',
        'shake-big': 'shake-big 0.5s ease-out',
        'rating-land': 'rating-land 0.3s ease-out',
        'button-glow': 'button-glow 2s ease-in-out infinite',
        'drift-1': 'drift-1 25s ease-in-out infinite',
        'drift-2': 'drift-2 30s ease-in-out infinite',
        'drift-3': 'drift-3 20s ease-in-out infinite',
      },
      
      keyframes: {
        'glow-pulse': {
          '0%, 100%': {
            boxShadow: '0 0 10px rgba(0, 255, 255, 0.5), 0 0 20px rgba(0, 255, 255, 0.3)',
          },
          '50%': {
            boxShadow: '0 0 15px rgba(0, 255, 255, 0.6), 0 0 30px rgba(0, 255, 255, 0.4), 0 0 45px rgba(0, 255, 255, 0.2)',
          },
        },
        'glow-pulse-intense': {
          '0%, 100%': {
            boxShadow: '0 0 15px rgba(0, 255, 255, 0.6), 0 0 30px rgba(0, 255, 255, 0.4)',
          },
          '50%': {
            boxShadow: '0 0 20px rgba(0, 255, 255, 0.8), 0 0 40px rgba(0, 255, 255, 0.6), 0 0 60px rgba(0, 255, 255, 0.3)',
          },
        },
        'cell-pop': {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '50%': { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-4px)' },
          '40%, 80%': { transform: 'translateX(4px)' },
        },
        'float-up': {
          '0%': { transform: 'translateY(0) scale(1)', opacity: '1' },
          '50%': { transform: 'translateY(-20px) scale(1.2)', opacity: '1' },
          '100%': { transform: 'translateY(-40px) scale(0.8)', opacity: '0' },
        },
        'glitch-text': {
          '0%': { transform: 'translate(0)', textShadow: '-2px 0 #FF00FF, 2px 0 #00FFFF', opacity: '0' },
          '20%': { transform: 'translate(-3px, 2px)', textShadow: '2px 0 #FF00FF, -2px 0 #00FFFF', opacity: '1' },
          '40%': { transform: 'translate(3px, -1px)', textShadow: '-2px 0 #FF00FF, 2px 0 #00FFFF' },
          '60%': { transform: 'translate(-2px, 1px)', textShadow: '2px 0 #FF00FF, -2px 0 #00FFFF' },
          '80%, 100%': { transform: 'translate(0)', textShadow: '0 0 20px #00FFFF, 0 0 40px #00FFFF, 0 0 60px #FF00FF', opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-in-up': {
          from: { transform: 'translateY(20px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'scale-in': {
          from: { transform: 'scale(0.9)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
        'countdown-pop': {
          '0%': { transform: 'scale(2)', opacity: '0' },
          '30%': { transform: 'scale(0.9)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'logo-shimmer': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'matrix-fall': {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '10%': { opacity: '0.3' },
          '90%': { opacity: '0.3' },
          '100%': { transform: 'translateY(100vh)', opacity: '0' },
        },
        'comet-streak': {
          '0%': { transform: 'translateX(0) translateY(0)', opacity: '0' },
          '5%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { transform: 'translateX(120vw) translateY(30vh)', opacity: '0' },
        },
        'grid-flash': {
          '0%': { opacity: '0' },
          '30%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '0.3', transform: 'scale(1)' },
          '50%': { opacity: '0.6', transform: 'scale(1.15)' },
        },
        'victory-burst': {
          '0%': { opacity: '0', transform: 'scale(0.8)' },
          '50%': { opacity: '1', transform: 'scale(1.1)' },
          '100%': { opacity: '0.6', transform: 'scale(1)' },
        },
        'glitch-text': {
          '0%': { transform: 'translate(0)', textShadow: '-2px 0 #FF00FF, 2px 0 #00FFFF' },
          '20%': { transform: 'translate(-3px, 2px)', textShadow: '2px 0 #FF00FF, -2px 0 #00FFFF' },
          '40%': { transform: 'translate(3px, -1px)', textShadow: '-2px 0 #FF00FF, 2px 0 #00FFFF' },
          '60%': { transform: 'translate(-2px, 1px)', textShadow: '2px 0 #FF00FF, -2px 0 #00FFFF' },
          '80%, 100%': { transform: 'translate(0)', textShadow: '0 0 10px #00FFFF, 0 0 20px #00FFFF, 0 0 40px #FF00FF' },
        },
      },
      
      /* =========================================
         TRANSITIONS
         ========================================= */
      transitionTimingFunction: {
        'out-back': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'spring': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'glow': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      
      transitionDuration: {
        'instant': '75ms',
        'fast': '150ms',
        'normal': '250ms',
        'slow': '400ms',
        'slower': '600ms',
        'dramatic': '800ms',
      },
      
      /* =========================================
         BACKGROUNDS
         ========================================= */
      backgroundImage: {
        'gradient-sunset': 'linear-gradient(to bottom, #0D0221 0%, #1A0640 20%, #3D1580 40%, #8B00FF 55%, #FF00FF 70%, #FF6B9D 85%, #FFB86C 100%)',
        'gradient-chrome': 'linear-gradient(to bottom, #FFFFFF 0%, #E0F0FF 20%, #80C0E0 40%, #00FFFF 60%, #406080 80%, #203040 100%)',
        'gradient-holographic': 'linear-gradient(135deg, #00FFFF 0%, #00FF88 25%, #FFD700 50%, #FF00FF 75%, #00FFFF 100%)',
        'gradient-gm': 'linear-gradient(135deg, #00FFFF 0%, #FF00FF 100%)',
      },
      
      /* =========================================
         CONTAINER
         ========================================= */
      maxWidth: {
        'game': '500px',
        'modal-sm': '400px',
        'modal-md': '500px',
        'modal-lg': '640px',
      },
    },
  },
  plugins: [],
}
