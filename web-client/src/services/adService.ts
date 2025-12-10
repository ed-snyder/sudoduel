import { Capacitor } from '@capacitor/core';

// AdMob configuration
const AD_CONFIG = {
  android: {
    appId: 'ca-app-pub-5779063303434926~2658336355',
    interstitial: 'ca-app-pub-5779063303434926/6244844688',
    testInterstitial: 'ca-app-pub-3940256099942544/1033173712',
  },
  ios: {
    appId: 'ca-app-pub-5779063303434926~4681864469',
    interstitial: 'ca-app-pub-5779063303434926/5801991550',
    testInterstitial: 'ca-app-pub-3940256099942544/4411468910',
  },
};

// TODO: Revert after AdMob account is approved (24-48 hours)
// const USE_TEST_ADS = import.meta.env.DEV || import.meta.env.MODE === 'development';
const USE_TEST_ADS = true;

interface AdService {
  initialize: () => Promise<void>;
  loadInterstitial: () => Promise<void>;
  showInterstitial: () => Promise<boolean>;
  isReady: () => boolean;
}

class AdServiceImpl implements AdService {
  private initialized = false;
  private interstitialLoaded = false;
  private AdMob: any = null;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Only initialize on native platforms
    if (!Capacitor.isNativePlatform()) {
      console.log('[AdService] Not a native platform, skipping ad initialization');
      return;
    }

    try {
      // Dynamically import AdMob plugin
      const { AdMob } = await import('@capacitor-community/admob');
      this.AdMob = AdMob;

      await AdMob.initialize({
        initializeForTesting: USE_TEST_ADS,
      });

      this.initialized = true;
      console.log('[AdService] Initialized successfully');

      // Pre-load first interstitial
      await this.loadInterstitial();
    } catch (error) {
      console.error('[AdService] Failed to initialize:', error);
    }
  }

  async loadInterstitial(): Promise<void> {
    if (!this.initialized || !this.AdMob) return;

    try {
      const platform = Capacitor.getPlatform();
      const config = platform === 'ios' ? AD_CONFIG.ios : AD_CONFIG.android;
      const adId = USE_TEST_ADS ? config.testInterstitial : config.interstitial;

      await this.AdMob.prepareInterstitial({
        adId,
        isTesting: USE_TEST_ADS,
      });

      this.interstitialLoaded = true;
      console.log('[AdService] Interstitial loaded');
    } catch (error) {
      console.error('[AdService] Failed to load interstitial:', error);
      this.interstitialLoaded = false;
    }
  }

  async showInterstitial(): Promise<boolean> {
    if (!this.initialized || !this.AdMob || !this.interstitialLoaded) {
      console.log('[AdService] Interstitial not ready');
      return false;
    }

    try {
      await this.AdMob.showInterstitial();
      console.log('[AdService] Interstitial shown');
      
      // Reset and load next ad
      this.interstitialLoaded = false;
      this.loadInterstitial();
      
      return true;
    } catch (error) {
      console.error('[AdService] Failed to show interstitial:', error);
      this.interstitialLoaded = false;
      this.loadInterstitial();
      return false;
    }
  }

  isReady(): boolean {
    return this.interstitialLoaded;
  }
}

export const adService = new AdServiceImpl();
