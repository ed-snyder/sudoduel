import { Capacitor } from '@capacitor/core';

// Product IDs - must match App Store Connect
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
  private store: any = null;
  private initialized = false;
  private products: Map<string, Product> = new Map();
  private purchaseCallbacks: Map<string, (result: PurchaseResult) => void> = new Map();

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    if (!Capacitor.isNativePlatform()) {
      console.log('[PurchaseService] Not a native platform, using mock purchases');
      this.setupMockProducts();
      this.initialized = true;
      return;
    }

    try {
      // Access the plugin via global window (Cordova plugin pattern)
      // @ts-ignore - cordova-plugin-purchase is a global plugin
      const store = (window as any).store;
      // @ts-ignore
      const ProductType = (window as any).store?.ProductType;
      // @ts-ignore
      const Platform = (window as any).store?.Platform;
      
      if (!store) {
        throw new Error('Store plugin not available');
      }
      
      this.store = store;

      // Register products
      store.register([
        {
          id: PRODUCT_IDS.MONTHLY,
          type: ProductType.PAID_SUBSCRIPTION,
          platform: Platform.APPLE_APPSTORE,
        },
        {
          id: PRODUCT_IDS.YEARLY,
          type: ProductType.PAID_SUBSCRIPTION,
          platform: Platform.APPLE_APPSTORE,
        },
      ]);

      // Handle product updates
      store.when()
        .productUpdated((product: any) => {
          console.log('[PurchaseService] Product updated:', product.id, product.state);
          this.products.set(product.id, {
            id: product.id,
            title: product.title,
            description: product.description,
            price: product.price,
            priceAsDecimal: product.priceMicros / 1000000,
            currency: product.currency,
          });
        })
        .approved((transaction: any) => {
          console.log('[PurchaseService] Purchase approved:', transaction.id);
          transaction.verify();
        })
        .verified((receipt: any) => {
          console.log('[PurchaseService] Purchase verified:', receipt.id);
          receipt.finish();
          
          // Notify callback
          const callback = this.purchaseCallbacks.get(receipt.products[0]?.id);
          if (callback) {
            callback({
              success: true,
              productId: receipt.products[0]?.id,
              transactionId: receipt.id,
            });
            this.purchaseCallbacks.delete(receipt.products[0]?.id);
          }
        })
        .unverified((receipt: any) => {
          console.error('[PurchaseService] Purchase unverified:', receipt);
          const callback = this.purchaseCallbacks.get(receipt.products[0]?.id);
          if (callback) {
            callback({
              success: false,
              error: 'Purchase verification failed',
            });
            this.purchaseCallbacks.delete(receipt.products[0]?.id);
          }
        })
        .error((error: any) => {
          console.error('[PurchaseService] Store error:', error);
        });

      // Initialize the store
      await store.initialize([Platform?.APPLE_APPSTORE || 'apple']);
      
      this.initialized = true;
      console.log('[PurchaseService] Initialized successfully');
    } catch (error) {
      console.error('[PurchaseService] Failed to initialize:', error);
      // Fall back to mock for development
      this.setupMockProducts();
      this.initialized = true;
    }
  }

  private setupMockProducts(): void {
    this.products.set(PRODUCT_IDS.MONTHLY, {
      id: PRODUCT_IDS.MONTHLY,
      title: 'Sudoduel+ Monthly',
      description: 'Unlock premium features',
      price: '$3.99',
      priceAsDecimal: 3.99,
      currency: 'USD',
    });
    this.products.set(PRODUCT_IDS.YEARLY, {
      id: PRODUCT_IDS.YEARLY,
      title: 'Sudoduel+ Annual',
      description: 'Save 37%! Unlock premium features',
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

  async purchase(productId: string): Promise<PurchaseResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Mock purchase for web/development
    if (!Capacitor.isNativePlatform() || !this.store) {
      console.log('[PurchaseService] Mock purchase:', productId);
      return {
        success: true,
        productId,
        transactionId: `mock_${Date.now()}`,
      };
    }

    return new Promise((resolve) => {
      // Store callback for when purchase completes
      this.purchaseCallbacks.set(productId, resolve);

      // Set timeout for purchase
      setTimeout(() => {
        if (this.purchaseCallbacks.has(productId)) {
          this.purchaseCallbacks.delete(productId);
          resolve({
            success: false,
            error: 'Purchase timed out',
          });
        }
      }, 120000); // 2 minute timeout

      // Initiate purchase
      const product = this.store.get(productId);
      if (product) {
        this.store.order(product);
      } else {
        this.purchaseCallbacks.delete(productId);
        resolve({
          success: false,
          error: 'Product not found',
        });
      }
    });
  }

  async restorePurchases(): Promise<PurchaseResult> {
    if (!Capacitor.isNativePlatform() || !this.store) {
      console.log('[PurchaseService] Mock restore');
      return { success: false, error: 'No purchases to restore' };
    }

    return new Promise((resolve) => {
      this.store.restorePurchases();
      
      // Check after a delay if any subscriptions are active
      setTimeout(() => {
        const monthly = this.store.get(PRODUCT_IDS.MONTHLY);
        const yearly = this.store.get(PRODUCT_IDS.YEARLY);
        
        if (monthly?.owned || yearly?.owned) {
          resolve({
            success: true,
            productId: monthly?.owned ? PRODUCT_IDS.MONTHLY : PRODUCT_IDS.YEARLY,
          });
        } else {
          resolve({
            success: false,
            error: 'No active subscription found',
          });
        }
      }, 3000);
    });
  }

  isSubscriptionActive(): boolean {
    if (!Capacitor.isNativePlatform() || !this.store) {
      return false;
    }
    
    const monthly = this.store.get(PRODUCT_IDS.MONTHLY);
    const yearly = this.store.get(PRODUCT_IDS.YEARLY);
    
    return monthly?.owned || yearly?.owned;
  }
}

export const purchaseService = new PurchaseServiceImpl();
