/// <reference types="vite/client" />

// Type declarations for cordova-plugin-purchase
declare global {
  interface Window {
    CdvPurchase?: {
      store: {
        register: (products: any[]) => void;
        when: () => any;
        initialize: (platforms: any[]) => Promise<void>;
        update: () => Promise<void>;
        get: (productId: string, platform?: any) => any;
        order: (offer: any) => Promise<any>;
        restorePurchases: () => Promise<void>;
        verbosity: any;
        error: (callback: (error: any) => void) => void;
      };
      ProductType: {
        PAID_SUBSCRIPTION: string;
      };
      Platform: {
        APPLE_APPSTORE: string;
      };
      LogLevel: {
        DEBUG: number;
      };
    };
  }
}

export {};

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

