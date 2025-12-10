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

    let attempts = 0;
    while (typeof (window as any).CdvPurchase === 'undefined' && attempts < 10) {
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

      console.log('[PurchaseService] Initializing...');

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

      // Track products and ownership changes
      this.store.when().productUpdated((product: any) => {
        console.log('[PurchaseService] Product updated:', product.id, 'owned:', product.owned, 'state:', product.state);
        this.rawProducts.set(product.id, product);
        if (product.pricing) {
          this.products.set(product.id, {
            id: product.id,
            title: product.title || product.id,
            description: product.description || '',
            price: product.pricing.price || '$?.??',
            priceAsDecimal: (product.pricing.priceMicros || 0) / 1000000,
            currency: product.pricing.currency || 'USD',
          });
        }
      });
      
      // Also listen for when products become owned
      this.store.when().owned((product: any) => {
        console.log('[PurchaseService] Product owned:', product.id);
        this.rawProducts.set(product.id, product);
      });

      // Auto-finish transactions
      this.store.when().approved((transaction: any) => {
        console.log('[PurchaseService] Approved');
        transaction.verify();
      });

      this.store.when().verified((receipt: any) => {
        console.log('[PurchaseService] Verified');
        receipt.finish();
      });

      this.store.when().finished(() => {
        console.log('[PurchaseService] Finished');
      });

      await this.store.initialize([this.CdvPurchase.Platform.APPLE_APPSTORE]);
      await this.store.update();
      await new Promise(resolve => setTimeout(resolve, 1000));

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
    console.log('[PurchaseService] Purchase:', productId);

    if (!this.initialized) {
      await this.initialize();
    }

    // Mock for web
    if (!Capacitor.isNativePlatform() || !this.store) {
      console.log('[PurchaseService] Mock purchase');
      return { success: true, productId, transactionId: `mock_${Date.now()}` };
    }

    const product = this.rawProducts.get(productId);
    if (!product) {
      return { success: false, error: 'Product not available. Please restart the app.' };
    }

    const offer = product.getOffer?.();
    if (!offer) {
      return { success: false, error: 'Product not available for purchase.' };
    }

    // Start the purchase
    console.log('[PurchaseService] Starting order...');
    
    try {
      // Fire and forget - don't await, just start it
      this.store.order(offer);
    } catch (e) {
      console.error('[PurchaseService] Order start error:', e);
    }

    // Poll for ownership - this is the reliable way to detect completion
    console.log('[PurchaseService] Polling for ownership...');
    
    for (let i = 0; i < 120; i++) { // 60 seconds max
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Refresh store to get latest product state (every few polls)
      if (i % 5 === 0 && i > 0) {
        try {
          if (typeof this.store.update === 'function') {
            await this.store.update();
          }
        } catch (e) {
          // Ignore update errors
        }
      }
      
      // Refresh product state from store (don't rely on cached version)
      let updatedProduct = this.rawProducts.get(productId);
      
      // Try to get fresh product from store
      if (typeof this.store.get === 'function') {
        try {
          const freshProduct = this.store.get(productId);
          if (freshProduct) {
            // Update cache with fresh product
            this.rawProducts.set(productId, freshProduct);
            updatedProduct = freshProduct;
            console.log('[PurchaseService] Poll', i, '- refreshed from store, owned:', freshProduct?.owned);
          }
        } catch (e) {
          // Ignore - store.get might fail
        }
      }
      
      if (!updatedProduct) {
        updatedProduct = this.rawProducts.get(productId);
      }
      
      // Check multiple ways ownership might be indicated
      const isOwned = updatedProduct?.owned === true || 
                      updatedProduct?.state === 'owned' ||
                      updatedProduct?.canPurchase === false && updatedProduct?.state === 'valid';
      
      console.log('[PurchaseService] Poll', i, '- owned:', updatedProduct?.owned, 'state:', updatedProduct?.state, 'canPurchase:', updatedProduct?.canPurchase, 'isOwned:', isOwned);
      
      if (isOwned) {
        console.log('[PurchaseService] Purchase successful!');
        return { success: true, productId, transactionId: 'completed' };
      }
    }

    return { success: false, error: 'Purchase timed out. If charged, restart the app.' };
  }

  async restorePurchases(): Promise<PurchaseResult> {
    console.log('[PurchaseService] Restoring...');

    if (!Capacitor.isNativePlatform() || !this.store) {
      return { success: false, error: 'No purchases to restore.' };
    }

    try {
      await this.store.restorePurchases();
      await new Promise(resolve => setTimeout(resolve, 2000));

      const monthly = this.rawProducts.get(PRODUCT_IDS.MONTHLY);
      const yearly = this.rawProducts.get(PRODUCT_IDS.YEARLY);

      if (monthly?.owned || yearly?.owned) {
        return { success: true, productId: monthly?.owned ? PRODUCT_IDS.MONTHLY : PRODUCT_IDS.YEARLY };
      }

      return { success: false, error: 'No active subscription found.' };
    } catch (error) {
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
