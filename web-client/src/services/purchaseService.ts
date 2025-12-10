import { Capacitor } from '@capacitor/core';

// Product IDs - must match App Store Connect exactly
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
  private registeredProducts: any[] = [];

  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!Capacitor.isNativePlatform()) {
      console.log('[PurchaseService] Web platform - using mock products');
      this.setupMockProducts();
      this.initialized = true;
      return;
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

      console.log('[PurchaseService] Initializing with CdvPurchase...');
      console.log('[PurchaseService] Store object:', this.store);

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

      // Set up event handlers
      this.store.when()
        .productUpdated((product: any) => {
          console.log('[PurchaseService] Product updated:', product.id);
          this.registeredProducts.push(product);
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
        })
        .approved((transaction: any) => {
          console.log('[PurchaseService] Transaction approved');
          return transaction.verify();
        })
        .verified((receipt: any) => {
          console.log('[PurchaseService] Receipt verified');
          return receipt.finish();
        })
        .finished(() => {
          console.log('[PurchaseService] Transaction finished');
        });

      this.store.error((error: any) => {
        console.error('[PurchaseService] Store error:', error);
      });

      await this.store.initialize([this.CdvPurchase.Platform.APPLE_APPSTORE]);
      await this.store.update();

      this.initialized = true;
      console.log('[PurchaseService] Initialized successfully');

    } catch (error) {
      console.error('[PurchaseService] Failed to initialize:', error);
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

  // Find a product from the registered products array
  private findProduct(productId: string): any {
    return this.registeredProducts.find(p => p.id === productId);
  }

  getProduct(productId: string): Product | undefined {
    return this.products.get(productId);
  }

  getProducts(): Product[] {
    return Array.from(this.products.values());
  }

  async purchase(productId: string): Promise<PurchaseResult> {
    console.log('[PurchaseService] Starting purchase for:', productId);

    if (!this.initialized) {
      await this.initialize();
    }

    // Mock purchase for web/development
    if (!Capacitor.isNativePlatform() || !this.store) {
      console.log('[PurchaseService] Using mock purchase');
      return {
        success: true,
        productId,
        transactionId: `mock_${Date.now()}`,
      };
    }

    return new Promise((resolve) => {
      try {
        // Find product from our tracked array
        const product = this.findProduct(productId);

        if (!product) {
          console.error('[PurchaseService] Product not found:', productId);
          console.log('[PurchaseService] Available products:', this.registeredProducts.map(p => p.id));
          resolve({
            success: false,
            error: 'Product not found. Please try again later.',
          });
          return;
        }

        console.log('[PurchaseService] Found product:', product.id);

        // Get the offer
        const offer = product.getOffer ? product.getOffer() : null;
        if (!offer) {
          console.error('[PurchaseService] No offer available');
          resolve({
            success: false,
            error: 'Product not available for purchase.',
          });
          return;
        }

        // Listen for completion
        const finishedListener = this.store.when().finished((transaction: any) => {
          const hasProduct = transaction.products?.some((p: any) => p.id === productId);
          if (hasProduct) {
            console.log('[PurchaseService] Purchase completed');
            finishedListener.unsubscribe();
            resolve({
              success: true,
              productId,
              transactionId: transaction.transactionId,
            });
          }
        });

        // Timeout
        setTimeout(() => {
          finishedListener.unsubscribe();
          resolve({
            success: false,
            error: 'Purchase timed out. Please try again.',
          });
        }, 120000);

        // Order
        console.log('[PurchaseService] Ordering...');
        this.store.order(offer).then((error: any) => {
          if (error) {
            console.error('[PurchaseService] Order error:', error);
            finishedListener.unsubscribe();
            resolve({
              success: false,
              error: error.message || 'Purchase failed.',
            });
          }
        });

      } catch (error: any) {
        console.error('[PurchaseService] Purchase error:', error);
        resolve({
          success: false,
          error: error.message || 'An error occurred.',
        });
      }
    });
  }

  async restorePurchases(): Promise<PurchaseResult> {
    console.log('[PurchaseService] Restoring purchases...');

    if (!Capacitor.isNativePlatform() || !this.store) {
      return { success: false, error: 'No purchases to restore.' };
    }

    return new Promise((resolve) => {
      try {
        this.store.restorePurchases().then(() => {
          // Check ownership
          const monthly = this.findProduct(PRODUCT_IDS.MONTHLY);
          const yearly = this.findProduct(PRODUCT_IDS.YEARLY);

          if (monthly?.owned || yearly?.owned) {
            resolve({
              success: true,
              productId: monthly?.owned ? PRODUCT_IDS.MONTHLY : PRODUCT_IDS.YEARLY,
            });
          } else {
            resolve({
              success: false,
              error: 'No active subscription found.',
            });
          }
        }).catch((error: any) => {
          resolve({
            success: false,
            error: error.message || 'Failed to restore purchases.',
          });
        });
      } catch (error: any) {
        resolve({
          success: false,
          error: 'Failed to restore purchases.',
        });
      }
    });
  }

  isSubscriptionActive(): boolean {
    if (!Capacitor.isNativePlatform() || !this.store) {
      return false;
    }
    const monthly = this.findProduct(PRODUCT_IDS.MONTHLY);
    const yearly = this.findProduct(PRODUCT_IDS.YEARLY);
    return monthly?.owned || yearly?.owned;
  }
}

export const purchaseService = new PurchaseServiceImpl();
