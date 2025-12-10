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
  raw?: any;
}

export interface PurchaseResult {
  success: boolean;
  productId?: string;
  transactionId?: string;
  error?: string;
}

class PurchaseServiceImpl {
  private CdvPurchase: any = null;
  private store: any = null;
  private initialized = false;
  private products: Map<string, Product> = new Map();
  private rawProducts: Map<string, any> = new Map();
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    // Return existing promise if already initializing
    if (this.initPromise) return this.initPromise;
    if (this.initialized) return;

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.log('[PurchaseService] Web platform - using mock products');
      this.setupMockProducts();
      this.initialized = true;
      return;
    }

    // Wait for CdvPurchase to be available
    let attempts = 0;
    while (typeof (window as any).CdvPurchase === 'undefined' && attempts < 10) {
      console.log('[PurchaseService] Waiting for CdvPurchase...', attempts);
      await new Promise(resolve => setTimeout(resolve, 200));
      attempts++;
    }

    if (typeof (window as any).CdvPurchase === 'undefined') {
      console.log('[PurchaseService] CdvPurchase not available - using mock');
      this.setupMockProducts();
      this.initialized = true;
      return;
    }

    try {
      this.CdvPurchase = (window as any).CdvPurchase;
      this.store = this.CdvPurchase.store;

      console.log('[PurchaseService] Initializing...');

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

      // Track products when they update
      this.store.when().productUpdated((product: any) => {
        console.log('[PurchaseService] Product updated:', product.id, product);
        
        // Store the raw product object
        this.rawProducts.set(product.id, product);
        
        // Store formatted product info
        this.products.set(product.id, {
          id: product.id,
          title: product.title || product.id,
          description: product.description || '',
          price: product.pricing?.price || '$?.??',
          priceAsDecimal: (product.pricing?.priceMicros || 0) / 1000000,
          currency: product.pricing?.currency || 'USD',
          raw: product,
        });
      });

      // Handle purchase flow
      this.store.when()
        .approved((transaction: any) => {
          console.log('[PurchaseService] Approved');
          return transaction.verify();
        })
        .verified((receipt: any) => {
          console.log('[PurchaseService] Verified');
          return receipt.finish();
        })
        .finished(() => {
          console.log('[PurchaseService] Finished');
        });

      this.store.error((error: any) => {
        console.error('[PurchaseService] Store error:', error);
      });

      // Initialize
      await this.store.initialize([this.CdvPurchase.Platform.APPLE_APPSTORE]);
      
      // Fetch products
      await this.store.update();
      
      // Wait a moment for products to populate
      await new Promise(resolve => setTimeout(resolve, 500));

      this.initialized = true;
      console.log('[PurchaseService] Ready. Products:', Array.from(this.products.keys()));

    } catch (error) {
      console.error('[PurchaseService] Init failed:', error);
      this.setupMockProducts();
      this.initialized = true;
    }
  }

  private setupMockProducts(): void {
    this.products.set(PRODUCT_IDS.MONTHLY, {
      id: PRODUCT_IDS.MONTHLY,
      title: 'Sudoduel+ Monthly',
      description: 'Monthly subscription',
      price: '$3.99',
      priceAsDecimal: 3.99,
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
    console.log('[PurchaseService] Purchase:', productId);

    if (!this.initialized) {
      await this.initialize();
    }

    // Mock for web
    if (!Capacitor.isNativePlatform() || !this.store) {
      console.log('[PurchaseService] Mock purchase');
      return { success: true, productId, transactionId: `mock_${Date.now()}` };
    }

    // Get the raw product
    const product = this.rawProducts.get(productId);
    
    if (!product) {
      console.error('[PurchaseService] Product not in rawProducts:', productId);
      console.log('[PurchaseService] Available:', Array.from(this.rawProducts.keys()));
      
      // Try to get directly from store
      const allProducts = this.store.products;
      console.log('[PurchaseService] Store products:', allProducts);
      
      return { success: false, error: 'Product not available. Please restart the app and try again.' };
    }

    return new Promise((resolve) => {
      try {
        const offer = product.getOffer?.();
        
        if (!offer) {
          console.error('[PurchaseService] No offer for product');
          resolve({ success: false, error: 'Product not available for purchase.' });
          return;
        }

        // Listen for completion
        const listener = this.store.when().finished((transaction: any) => {
          if (transaction.products?.some((p: any) => p.id === productId)) {
            listener.unsubscribe();
            resolve({ success: true, productId, transactionId: transaction.transactionId });
          }
        });

        // Timeout
        setTimeout(() => {
          listener.unsubscribe();
          resolve({ success: false, error: 'Purchase timed out.' });
        }, 120000);

        // Start purchase
        this.store.order(offer).then((error: any) => {
          if (error) {
            listener.unsubscribe();
            resolve({ success: false, error: error.message || 'Purchase failed.' });
          }
        });

      } catch (error: any) {
        resolve({ success: false, error: error.message || 'An error occurred.' });
      }
    });
  }

  async restorePurchases(): Promise<PurchaseResult> {
    if (!Capacitor.isNativePlatform() || !this.store) {
      return { success: false, error: 'No purchases to restore.' };
    }

    try {
      await this.store.restorePurchases();
      
      const monthly = this.rawProducts.get(PRODUCT_IDS.MONTHLY);
      const yearly = this.rawProducts.get(PRODUCT_IDS.YEARLY);

      if (monthly?.owned || yearly?.owned) {
        return { success: true, productId: monthly?.owned ? PRODUCT_IDS.MONTHLY : PRODUCT_IDS.YEARLY };
      }
      
      return { success: false, error: 'No active subscription found.' };
    } catch (error: any) {
      return { success: false, error: 'Failed to restore purchases.' };
    }
  }

  isSubscriptionActive(): boolean {
    const monthly = this.rawProducts.get(PRODUCT_IDS.MONTHLY);
    const yearly = this.rawProducts.get(PRODUCT_IDS.YEARLY);
    return monthly?.owned || yearly?.owned;
  }
}

export const purchaseService = new PurchaseServiceImpl();
