/// <reference types="vite/client" />

// Type declarations for cordova-plugin-purchase
declare global {
  interface Window {
    store?: {
      register: (products: any[]) => void;
      when: () => any;
      initialize: (platforms: any[]) => Promise<void>;
      get: (productId: string) => any;
      order: (product: any) => void;
      restorePurchases: () => void;
      ProductType?: {
        PAID_SUBSCRIPTION: string;
      };
      Platform?: {
        APPLE_APPSTORE: string;
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

