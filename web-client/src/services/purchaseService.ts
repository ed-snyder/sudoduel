import { Capacitor } from '@capacitor/core';

const DEBUG = import.meta.env.DEV;

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
  receipt?: string;  // Base64 encoded receipt for server validation
  error?: string;
}

// Global resolver - this is the key to avoiding callback issues
let globalPurchaseResolver: ((result: PurchaseResult) => void) | null = null;
let pendingProductId: string | null = null;
let pendingReceipt: string | null = null;

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
      if (DEBUG) console.log('[PurchaseService] Web platform - mock mode');
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
      if (DEBUG) console.log('[PurchaseService] CdvPurchase not found - mock mode');
      this.setupMockProducts();
      this.initialized = true;
      return;
    }

    try {
      this.CdvPurchase = (window as any).CdvPurchase;
      this.store = this.CdvPurchase.store;

      if (DEBUG) console.log('[PurchaseService] Initializing with CdvPurchase...');

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
        if (DEBUG) console.log('[PurchaseService] Product updated:', product.id);
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
        if (DEBUG) console.log('[PurchaseService] >>> APPROVED');
        try {
          transaction.verify();
        } catch (e) {
          if (DEBUG) console.log('[PurchaseService] verify() error (ignoring):', e);
        }
      });

      this.store.when().verified((receipt: any) => {
        console.log('[PurchaseService] >>> VERIFIED');
        try {
          // Try multiple ways to get the receipt data
          let receiptData: string | null = null;
          
          // Method 1: Application receipt from store (most reliable for iOS)
          if (this.store.applicationReceipt) {
            receiptData = this.store.applicationReceipt;
            console.log('[PurchaseService] Got receipt from store.applicationReceipt, length:', receiptData?.length);
          }
          
          // Method 2: latestReceipt - could be string or object
          if (!receiptData && receipt.latestReceipt) {
            const lr = receipt.latestReceipt;
            console.log('[PurchaseService] latestReceipt type:', typeof lr);
            if (typeof lr === 'string') {
              receiptData = lr;
              console.log('[PurchaseService] Got receipt from receipt.latestReceipt (string), length:', receiptData.length);
            } else if (typeof lr === 'object') {
              // Try common properties on the latestReceipt object
              receiptData = lr.appStoreReceipt || lr.receipt || lr.rawReceipt || lr.base64 || lr.data;
              if (receiptData) {
                console.log('[PurchaseService] Got receipt from receipt.latestReceipt object, length:', receiptData.length);
              } else {
                console.log('[PurchaseService] latestReceipt is object with keys:', Object.keys(lr));
              }
            }
          }
          
          // Method 3: From sourceReceipt.nativeData (this is where the receipt actually is!)
          if (!receiptData && receipt.sourceReceipt?.nativeData) {
            const nd = receipt.sourceReceipt.nativeData;
            receiptData = nd.appStoreReceipt || nd.receipt || nd.rawReceipt;
            if (receiptData && typeof receiptData === 'string') {
              console.log('[PurchaseService] Got receipt from sourceReceipt.nativeData, length:', receiptData.length);
            } else {
              console.log('[PurchaseService] sourceReceipt.nativeData keys:', Object.keys(nd));
              receiptData = null;
            }
          }
          
          // Method 4: From sourceReceipt directly
          if (!receiptData && receipt.sourceReceipt?.appStoreReceipt) {
            receiptData = receipt.sourceReceipt.appStoreReceipt;
            console.log('[PurchaseService] Got receipt from receipt.sourceReceipt.appStoreReceipt, length:', receiptData?.length);
          }
          
          // Method 5: From the receipt's native data  
          if (!receiptData && receipt.nativeData?.appStoreReceipt) {
            receiptData = receipt.nativeData.appStoreReceipt;
            console.log('[PurchaseService] Got receipt from receipt.nativeData.appStoreReceipt, length:', receiptData?.length);
          }
          
          // Method 6: From raw
          if (!receiptData && receipt.raw?.appStoreReceipt) {
            receiptData = receipt.raw.appStoreReceipt;
            console.log('[PurchaseService] Got receipt from receipt.raw.appStoreReceipt, length:', receiptData?.length);
          }
          
          // Method 7: Direct property
          if (!receiptData && receipt.appStoreReceipt) {
            receiptData = receipt.appStoreReceipt;
            console.log('[PurchaseService] Got receipt from receipt.appStoreReceipt, length:', receiptData?.length);
          }
          
          // Method 8: Try nativeTransactions
          if (!receiptData && receipt.nativeTransactions?.length > 0) {
            const firstTx = receipt.nativeTransactions[0];
            receiptData = firstTx?.appStoreReceipt || firstTx?.receipt;
            if (receiptData && typeof receiptData === 'string') {
              console.log('[PurchaseService] Got receipt from nativeTransactions, length:', receiptData.length);
            } else {
              console.log('[PurchaseService] nativeTransactions[0] keys:', Object.keys(firstTx || {}));
              receiptData = null;
            }
          }
          
          // Method 9: Try to get from localReceipts immediately
          if (!receiptData && this.store.localReceipts?.length > 0) {
            for (const lr of this.store.localReceipts) {
              const nd = lr.sourceReceipt?.nativeData || lr.nativeData;
              if (nd?.appStoreReceipt && typeof nd.appStoreReceipt === 'string') {
                receiptData = nd.appStoreReceipt;
                console.log('[PurchaseService] Got receipt from localReceipts in verified, length:', nd.appStoreReceipt.length);
                break;
              }
            }
          }
          
          // Validate that receiptData is actually a string
          if (receiptData && typeof receiptData === 'string' && receiptData.length > 100) {
            pendingReceipt = receiptData;
            console.log('[PurchaseService] Receipt captured! Length:', receiptData.length);
          } else {
            console.log('[PurchaseService] No valid receipt found.');
            console.log('[PurchaseService] Receipt object keys:', Object.keys(receipt || {}));
            console.log('[PurchaseService] store.applicationReceipt:', this.store.applicationReceipt ? `present (${typeof this.store.applicationReceipt})` : 'missing');
            console.log('[PurchaseService] receipt.latestReceipt:', receipt.latestReceipt ? `present (${typeof receipt.latestReceipt})` : 'missing');
            // Deep log latestReceipt if it's an object
            if (receipt.latestReceipt && typeof receipt.latestReceipt === 'object') {
              console.log('[PurchaseService] latestReceipt keys:', Object.keys(receipt.latestReceipt));
            }
            // Deep log sourceReceipt
            if (receipt.sourceReceipt) {
              console.log('[PurchaseService] sourceReceipt keys:', Object.keys(receipt.sourceReceipt));
            }
          }
          
          receipt.finish();
        } catch (e) {
          console.log('[PurchaseService] Error in verified handler:', e);
        }
      });

      this.store.when().finished(() => {
        console.log('[PurchaseService] >>> FINISHED - resolving purchase');
        
        // Resolve the global promise if one is waiting
        if (globalPurchaseResolver && pendingProductId) {
          const resolver = globalPurchaseResolver;
          const productId = pendingProductId;
          
          // Try to get receipt one more time if not captured in verified
          let receipt = pendingReceipt;
          if (!receipt && this.store.applicationReceipt) {
            receipt = this.store.applicationReceipt;
            console.log('[PurchaseService] Got receipt from applicationReceipt in finished handler');
          }
          
          // Clear before calling to prevent double-resolve
          globalPurchaseResolver = null;
          pendingProductId = null;
          pendingReceipt = null;
          
          console.log('[PurchaseService] Calling resolver for:', productId, 'receipt:', receipt ? `present (${receipt.length} chars)` : 'missing');
          resolver({ success: true, productId, transactionId: 'completed', receipt: receipt || undefined });
        }
      });

      // Initialize store
      await this.store.initialize([this.CdvPurchase.Platform.APPLE_APPSTORE]);
      await this.store.update();
      await new Promise(resolve => setTimeout(resolve, 1500));

      this.initialized = true;
      if (DEBUG) console.log('[PurchaseService] Ready. Products:', Array.from(this.products.keys()));

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
    if (DEBUG) console.log('[PurchaseService] ====== PURCHASE START ======');
    if (DEBUG) console.log('[PurchaseService] Product:', productId);

    if (!this.initialized) {
      await this.initialize();
    }

    // Mock for web
    if (!Capacitor.isNativePlatform() || !this.store) {
      if (DEBUG) console.log('[PurchaseService] Mock purchase (web)');
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
      
      if (DEBUG) console.log('[PurchaseService] Global resolver set, starting order...');

      // Set timeout
      const timeoutId = setTimeout(() => {
        if (globalPurchaseResolver === resolve) {
          if (DEBUG) console.log('[PurchaseService] Purchase timed out');
          globalPurchaseResolver = null;
          pendingProductId = null;
          resolve({ success: false, error: 'Purchase timed out. If charged, use Restore Purchases.' });
        }
      }, 120000);

      // Start the order
      try {
        this.store.order(offer)
          .then(() => {
            if (DEBUG) console.log('[PurchaseService] order() resolved');
          })
          .catch((err: any) => {
            if (DEBUG) console.log('[PurchaseService] order() rejected:', err);
            
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
    if (DEBUG) console.log('[PurchaseService] ====== RESTORE START ======');

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

      if (DEBUG) console.log('[PurchaseService] Restore check - monthly owned:', monthly?.owned);
      if (DEBUG) console.log('[PurchaseService] Restore check - yearly owned:', yearly?.owned);

      if (monthly?.owned || yearly?.owned) {
        // Get the app receipt for server validation
        const receipt = await this.getAppReceipt();
        return { 
          success: true, 
          productId: monthly?.owned ? PRODUCT_IDS.MONTHLY : PRODUCT_IDS.YEARLY,
          receipt: receipt || undefined,
        };
      }

      return { success: false, error: 'No active subscription found.' };
    } catch (error: any) {
      console.error('[PurchaseService] Restore error:', error);
      return { success: false, error: 'Failed to restore purchases.' };
    }
  }

  // Get the current app store receipt (for restore/validation)
  async getAppReceipt(): Promise<string | null> {
    if (!this.store || !this.CdvPurchase) return null;
    
    try {
      // Method 1: Direct applicationReceipt (most reliable)
      if (this.store.applicationReceipt && typeof this.store.applicationReceipt === 'string') {
        console.log('[PurchaseService] Found applicationReceipt');
        return this.store.applicationReceipt;
      }
      
      // Method 2: Try to get receipt from the local receipts
      const receipts = this.store.localReceipts || [];
      for (const receipt of receipts) {
        // Check sourceReceipt.nativeData first (this is where it actually is!)
        const nativeData = receipt.sourceReceipt?.nativeData || receipt.nativeData;
        if (nativeData?.appStoreReceipt && typeof nativeData.appStoreReceipt === 'string') {
          console.log('[PurchaseService] Found receipt in localReceipts.sourceReceipt.nativeData');
          return nativeData.appStoreReceipt;
        }
        
        // Fallback to other properties
        const receiptData = receipt.sourceReceipt?.appStoreReceipt || 
                            receipt.raw?.appStoreReceipt ||
                            receipt.appStoreReceipt;
        if (receiptData && typeof receiptData === 'string') {
          console.log('[PurchaseService] Found receipt in localReceipts');
          return receiptData;
        }
      }
      
      // Method 3: Check verified receipts
      const verifiedReceipts = this.store.verifiedReceipts || [];
      for (const receipt of verifiedReceipts) {
        // Check sourceReceipt.nativeData first
        const nativeData = receipt.sourceReceipt?.nativeData || receipt.nativeData;
        if (nativeData?.appStoreReceipt && typeof nativeData.appStoreReceipt === 'string') {
          console.log('[PurchaseService] Found receipt in verifiedReceipts.sourceReceipt.nativeData');
          return nativeData.appStoreReceipt;
        }
        
        const receiptData = receipt.sourceReceipt?.appStoreReceipt || 
                            receipt.raw?.appStoreReceipt ||
                            receipt.appStoreReceipt;
        if (receiptData && typeof receiptData === 'string') {
          console.log('[PurchaseService] Found receipt in verifiedReceipts');
          return receiptData;
        }
      }
      
      console.log('[PurchaseService] No receipt found in getAppReceipt');
      return null;
    } catch (e) {
      console.log('[PurchaseService] Error getting receipt:', e);
      return null;
    }
  }

  isSubscriptionActive(): boolean {
    const monthly = this.rawProducts.get(PRODUCT_IDS.MONTHLY);
    const yearly = this.rawProducts.get(PRODUCT_IDS.YEARLY);
    return monthly?.owned === true || yearly?.owned === true;
  }

  resetPurchaseState(): void {
    if (DEBUG) console.log('[PurchaseService] Resetting purchase state');
    globalPurchaseResolver = null;
    pendingProductId = null;
  }
}

export const purchaseService = new PurchaseServiceImpl();
