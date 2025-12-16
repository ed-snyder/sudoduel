import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sudoduel.app',
  appName: 'Sudoduel',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 0, // Don't auto-hide, we'll hide manually
      launchAutoHide: false,
      backgroundColor: '#0a0a0f', // Match app background
      showSpinner: false,
    },
  },
};

export default config;
