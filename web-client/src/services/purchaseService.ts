import { Capacitor } from '@capacitor/core';

export const PRODUCT_IDS = {
  MONTHLY: 'sudoduel_plus_monthly',
  YEARLY: 'sudoduel_plus_yearly',
};

export interface Product {
  id: string;
  title: string;
  description: string;
  price: string;
  priceAsDecimal: number;
  currency: string;
}

export interface PurchaseResult {
  success: boolean;
  productId?: string;
  transactionId?: string;
  error?: string;
}

// Global resolver - this is the key to avoiding callback issues
let globalPurchaseResolver: ((result: PurchaseResult) => void) | null = null;
let pendingProductId: string | null = null;

class PurchaseServiceImpl {
  private CdvPurchase: any = null;
  private store: any = null;
  private initialized = false;
  private products: Map<string, Product> = new Map();
  private rawProducts: Map<string, any> = new Map();
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    if (this.initialized) return;
    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.log('[PurchaseService] Web platform - mock mode');
      this.setupMockProducts();
      this.initialized = true;
      return;
    }

    // Wait for CdvPurchase to be available
    let attempts = 0;
    while (typeof (window as any).CdvPurchase === 'undefined' && attempts < 20) {
      await new Promise(resolve => setTimeout(resolve, 200));
      attempts++;
    }

    if (typeof (window as any).CdvPurchase === 'undefined') {
      console.log('[PurchaseService] CdvPurchase not found - mock mode');
      this.setupMockProducts();
      this.initialized = true;
      return;
    }

    try {
      this.CdvPurchase = (window as any).CdvPurchase;
      this.store = this.CdvPurchase.store;

      console.log('[PurchaseService] Initializing with CdvPurchase...');

      // Register products
      this.store.register([
        {
          id: PRODUCT_IDS.MONTHLY,
          type: this.CdvPurchase.ProductType.PAID_SUBSCRIPTION,
          platform: this.CdvPurchase.Platform.APPLE_APPSTORE,
        },
        {
          id: PRODUCT_IDS.YEARLY,
          type: this.CdvPurchase.ProductType.PAID_SUBSCRIPTION,
          platform: this.CdvPurchase.Platform.APPLE_APPSTORE,
        },
      ]);

      // Track products when they load
      this.store.when().productUpdated((product: any) => {
        console.log('[PurchaseService] Product updated:', product.id);
        this.rawProducts.set(product.id, product);
        
        const offer = product.offers?.[0];
        const pricing = offer?.pricingPhases?.[0];
        
        if (pricing) {
          this.products.set(product.id, {
            id: product.id,
            title: product.title || product.id,
            description: product.description || '',
            price: pricing.price || '$?.??',
            priceAsDecimal: (pricing.priceMicros || 0) / 1000000,
            currency: pricing.currency || 'USD',
          });
        }
      });

      // Handle transaction flow
      this.store.when().approved((transaction: any) => {
        console.log('[PurchaseService] >>> APPROVED');
        try {
          transaction.verify();
        } catch (e) {
          console.log('[PurchaseService] verify() error (ignoring):', e);
        }
      });

      this.store.when().verified((receipt: any) => {
        console.log('[PurchaseService] >>> VERIFIED');
        try {
          receipt.finish();
        } catch (e) {
          console.log('[PurchaseService] finish() error (ignoring):', e);
        }
      });

      this.store.when().finished(() => {
        console.log('[PurchaseService] >>> FINISHED - resolving purchase');
        
        // Resolve the global promise if one is waiting
        if (globalPurchaseResolver && pendingProductId) {
          const resolver = globalPurchaseResolver;
          const productId = pendingProductId;
          
          // Clear before calling to prevent double-resolve
          globalPurchaseResolver = null;
          pendingProductId = null;
          
          console.log('[PurchaseService] Calling resolver for:', productId);
          resolver({ success: true, productId, transactionId: 'completed' });
        }
      });

      // Initialize store
      await this.store.initialize([this.CdvPurchase.Platform.APPLE_APPSTORE]);
      await this.store.update();
      await new Promise(resolve => setTimeout(resolve, 1500));

      this.initialized = true;
      console.log('[PurchaseService] Ready. Products:', Array.from(this.products.keys()));

    } catch (error) {
      console.error('[PurchaseService] Init error:', error);
      this.setupMockProducts();
      this.initialized = true;
    }
  }

  private setupMockProducts(): void {
    this.products.set(PRODUCT_IDS.MONTHLY, {
      id: PRODUCT_IDS.MONTHLY,
      title: 'Sudoduel+ Monthly',
      description: 'Monthly subscription',
      price: '$4.99',
      priceAsDecimal: 4.99,
      currency: 'USD',
    });
    this.products.set(PRODUCT_IDS.YEARLY, {
      id: PRODUCT_IDS.YEARLY,
      title: 'Sudoduel+ Annual',
      description: 'Annual subscription',
      price: '$29.99',
      priceAsDecimal: 29.99,
      currency: 'USD',
    });
  }

  getProduct(productId: string): Product | undefined {
    return this.products.get(productId);
  }

  getProducts(): Product[] {
    return Array.from(this.products.values());
  }

  isReady(): boolean {
    return this.initialized && this.products.size > 0;
  }

  async purchase(productId: string): Promise<PurchaseResult> {
    console.log('[PurchaseService] ====== PURCHASE START ======');
    console.log('[PurchaseService] Product:', productId);

    if (!this.initialized) {
      await this.initialize();
    }

    // Mock for web
    if (!Capacitor.isNativePlatform() || !this.store) {
      console.log('[PurchaseService] Mock purchase (web)');
      return { success: true, productId, transactionId: `mock_${Date.now()}` };
    }

    const product = this.rawProducts.get(productId);
    if (!product) {
      console.error('[PurchaseService] Product not in rawProducts:', productId);
      return { success: false, error: 'Product not available. Please restart the app.' };
    }

    const offer = product.getOffer?.();
    if (!offer) {
      console.error('[PurchaseService] No offer available');
      return { success: false, error: 'Product not available for purchase.' };
    }

    // Create a promise that will be resolved by the finished callback
    return new Promise<PurchaseResult>((resolve) => {
      // Set up the global resolver
      pendingProductId = productId;
      globalPurchaseResolver = resolve;
      
      console.log('[PurchaseService] Global resolver set, starting order...');

      // Set timeout
      const timeoutId = setTimeout(() => {
        if (globalPurchaseResolver === resolve) {
          console.log('[PurchaseService] Purchase timed out');
          globalPurchaseResolver = null;
          pendingProductId = null;
          resolve({ success: false, error: 'Purchase timed out. If charged, use Restore Purchases.' });
        }
      }, 120000);

      // Start the order
      try {
        this.store.order(offer)
          .then(() => {
            console.log('[PurchaseService] order() resolved');
          })
          .catch((err: any) => {
            console.log('[PurchaseService] order() rejected:', err);
            
            // FIXED: Always resolve on rejection, not just for "cancel"
            const errorMsg = err?.message || String(err) || '';
            
            clearTimeout(timeoutId);
            if (globalPurchaseResolver === resolve) {
              globalPurchaseResolver = null;
              pendingProductId = null;
              
              const lowerMsg = errorMsg.toLowerCase();
              if (lowerMsg.includes('cancel') || 
                  lowerMsg.includes('cancelled') ||
                  lowerMsg.includes('user')) {
                resolve({ success: false, error: 'Purchase cancelled.' });
              } else if (lowerMsg.includes('payment')) {
                resolve({ success: false, error: 'Payment failed. Please try again.' });
              } else {
                resolve({ success: false, error: errorMsg || 'Purchase failed. Please try again.' });
              }
            }
          });
      } catch (e) {
        console.error('[PurchaseService] order() threw:', e);
        clearTimeout(timeoutId);
        globalPurchaseResolver = null;
        pendingProductId = null;
        resolve({ success: false, error: 'Failed to start purchase.' });
      }
    });
  }

  async restorePurchases(): Promise<PurchaseResult> {
    console.log('[PurchaseService] ====== RESTORE START ======');

    if (!Capacitor.isNativePlatform() || !this.store) {
      return { success: false, error: 'Restore not available.' };
    }

    try {
      await this.store.restorePurchases();
      await new Promise(resolve => setTimeout(resolve, 2000));
      await this.store.update();
      await new Promise(resolve => setTimeout(resolve, 1000));

      const monthly = this.rawProducts.get(PRODUCT_IDS.MONTHLY);
      const yearly = this.rawProducts.get(PRODUCT_IDS.YEARLY);

      console.log('[PurchaseService] Restore check - monthly owned:', monthly?.owned);
      console.log('[PurchaseService] Restore check - yearly owned:', yearly?.owned);

      if (monthly?.owned || yearly?.owned) {
        return { success: true, productId: monthly?.owned ? PRODUCT_IDS.MONTHLY : PRODUCT_IDS.YEARLY };
      }

      return { success: false, error: 'No active subscription found.' };
    } catch (error: any) {
      console.error('[PurchaseService] Restore error:', error);
      return { success: false, error: 'Failed to restore purchases.' };
    }
  }

  isSubscriptionActive(): boolean {
    const monthly = this.rawProducts.get(PRODUCT_IDS.MONTHLY);
    const yearly = this.rawProducts.get(PRODUCT_IDS.YEARLY);
    return monthly?.owned === true || yearly?.owned === true;
  }

  resetPurchaseState(): void {
    console.log('[PurchaseService] Resetting purchase state');
    globalPurchaseResolver = null;
    pendingProductId = null;
  }
}

export const purchaseService = new PurchaseServiceImpl();
