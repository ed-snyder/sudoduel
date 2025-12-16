/**
 * Apple App Store Receipt Validation Service
 * 
 * Validates in-app purchase receipts with Apple's servers to prevent
 * users from giving themselves premium status without paying.
 */

const APPLE_PRODUCTION_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';

// Valid product IDs for premium subscriptions
const VALID_PRODUCT_IDS = [
  'sudoduel_plus_monthly',
  'sudoduel_plus_yearly',
];

export interface AppleReceiptValidationResult {
  isValid: boolean;
  productId?: string;
  transactionId?: string;
  expiresDate?: Date;
  error?: string;
}

interface AppleVerifyResponse {
  status: number;
  receipt?: {
    in_app?: Array<{
      product_id: string;
      transaction_id: string;
      purchase_date_ms: string;
      expires_date_ms?: string;
    }>;
    latest_receipt_info?: Array<{
      product_id: string;
      transaction_id: string;
      purchase_date_ms: string;
      expires_date_ms?: string;
    }>;
  };
  latest_receipt_info?: Array<{
    product_id: string;
    transaction_id: string;
    purchase_date_ms: string;
    expires_date_ms?: string;
  }>;
}

/**
 * Validates an Apple App Store receipt
 * 
 * @param receiptData - Base64 encoded receipt data from the app
 * @returns Validation result with subscription details
 */
export async function validateAppleReceipt(receiptData: string): Promise<AppleReceiptValidationResult> {
  const sharedSecret = process.env.APP_STORE_SHARED_SECRET;
  
  if (!sharedSecret) {
    console.error('[AppleReceipt] APP_STORE_SHARED_SECRET not configured');
    return { isValid: false, error: 'Server configuration error' };
  }

  if (!receiptData || typeof receiptData !== 'string') {
    return { isValid: false, error: 'Invalid receipt data' };
  }

  const requestBody = JSON.stringify({
    'receipt-data': receiptData,
    'password': sharedSecret,
    'exclude-old-transactions': true,
  });

  try {
    // Try production first
    let response = await callAppleAPI(APPLE_PRODUCTION_URL, requestBody);
    
    // Status 21007 means this is a sandbox receipt - retry with sandbox URL
    if (response.status === 21007) {
      console.log('[AppleReceipt] Sandbox receipt detected, retrying with sandbox URL');
      response = await callAppleAPI(APPLE_SANDBOX_URL, requestBody);
    }

    return parseAppleResponse(response);
  } catch (error: any) {
    console.error('[AppleReceipt] Validation error:', error.message);
    return { isValid: false, error: 'Failed to validate receipt' };
  }
}

async function callAppleAPI(url: string, body: string): Promise<AppleVerifyResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Apple API returned ${response.status}`);
  }

  return response.json() as Promise<AppleVerifyResponse>;
}

function parseAppleResponse(response: AppleVerifyResponse): AppleReceiptValidationResult {
  // Status codes: https://developer.apple.com/documentation/appstorereceipts/status
  if (response.status !== 0) {
    const errorMessages: Record<number, string> = {
      21000: 'App Store could not read the receipt',
      21002: 'Receipt data was malformed',
      21003: 'Receipt could not be authenticated',
      21004: 'Shared secret does not match',
      21005: 'Receipt server is unavailable',
      21006: 'Receipt is valid but subscription has expired',
      21007: 'Sandbox receipt sent to production',
      21008: 'Production receipt sent to sandbox',
      21010: 'This receipt could not be authorized',
    };
    
    const error = errorMessages[response.status] || `Unknown error (${response.status})`;
    console.log(`[AppleReceipt] Validation failed: ${error}`);
    return { isValid: false, error };
  }

  // Get the latest transaction info (for subscriptions)
  const transactions = response.latest_receipt_info || 
                       response.receipt?.latest_receipt_info || 
                       response.receipt?.in_app || 
                       [];

  if (transactions.length === 0) {
    return { isValid: false, error: 'No transactions found in receipt' };
  }

  // Find the most recent valid subscription
  const now = Date.now();
  let latestValidTransaction: typeof transactions[0] | null = null;

  for (const transaction of transactions) {
    // Check if this is one of our valid product IDs
    if (!VALID_PRODUCT_IDS.includes(transaction.product_id)) {
      continue;
    }

    // For subscriptions, check expiry date
    if (transaction.expires_date_ms) {
      const expiresDate = parseInt(transaction.expires_date_ms, 10);
      if (expiresDate > now) {
        // This subscription is still active
        if (!latestValidTransaction || 
            parseInt(transaction.purchase_date_ms, 10) > parseInt(latestValidTransaction.purchase_date_ms, 10)) {
          latestValidTransaction = transaction;
        }
      }
    } else {
      // Non-subscription purchase (lifetime?) - consider valid
      latestValidTransaction = transaction;
    }
  }

  if (!latestValidTransaction) {
    return { isValid: false, error: 'No active subscription found' };
  }

  const result: AppleReceiptValidationResult = {
    isValid: true,
    productId: latestValidTransaction.product_id,
    transactionId: latestValidTransaction.transaction_id,
  };

  if (latestValidTransaction.expires_date_ms) {
    result.expiresDate = new Date(parseInt(latestValidTransaction.expires_date_ms, 10));
  }

  console.log(`[AppleReceipt] Valid subscription: ${result.productId}, expires: ${result.expiresDate}`);
  return result;
}
