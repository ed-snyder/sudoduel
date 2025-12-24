import admin from 'firebase-admin';
import { GoogleAuth } from 'google-auth-library';
import { query } from '../config/database';

// Initialize Firebase Admin SDK (call once at server startup)
let initialized = false;

export function initFirebase() {
  if (initialized) return;
  
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccount) {
    console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT not set - push notifications disabled');
    return;
  }

  try {
    const parsed = JSON.parse(serviceAccount);
    
    // Fix private key if newlines are escaped as literal \n
    if (parsed.private_key && !parsed.private_key.includes('\n')) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      console.log('🔑 Fixed escaped newlines in private key');
    }
    
    console.log('🔑 Service account project:', parsed.project_id);
    console.log('🔑 Service account email:', parsed.client_email);
    console.log('🔑 Private key starts with:', parsed.private_key?.substring(0, 30));
    console.log('🔑 Private key ends with:', parsed.private_key?.substring(parsed.private_key.length - 30));
    console.log('🔑 Private key length:', parsed.private_key?.length);
    console.log('🔑 Private key has real newlines:', parsed.private_key?.includes('\n'));
    
    // Store credentials for HTTP API
    serviceAccountCredentials = parsed;
    
    admin.initializeApp({
      credential: admin.credential.cert(parsed),
      projectId: parsed.project_id,
    });
    initialized = true;
    console.log('✅ Firebase Admin initialized');
    console.log('✅ Using FCM HTTP v1 API directly');
  } catch (error) {
    console.error('❌ Firebase init failed:', error);
  }
}

export function isFirebaseInitialized(): boolean {
  return initialized;
}

// Store parsed credentials for HTTP API
let serviceAccountCredentials: any = null;

export async function sendPushToUser(
  userId: number,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  if (!initialized || !serviceAccountCredentials) {
    console.log('Push skipped - Firebase not initialized');
    return;
  }

  try {
    const result = await query(
      'SELECT token, platform FROM device_tokens WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      console.log(`No device tokens for user ${userId}`);
      return;
    }

    // Get OAuth token using google-auth-library
    const auth = new GoogleAuth({
      credentials: serviceAccountCredentials,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    
    if (!accessToken.token) {
      console.error('❌ Failed to get access token');
      return;
    }
    
    console.log('🔑 Got access token for push, starts with:', accessToken.token.substring(0, 20));

    const projectId = serviceAccountCredentials.project_id;
    console.log('📤 Sending to FCM project:', projectId);
    let successCount = 0;
    let failureCount = 0;

    for (const row of result.rows) {
      const token = row.token;
      
      const message = {
        message: {
          token: token,
          notification: {
            title,
            body,
          },
          data: data || {},
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
              },
            },
          },
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              channel_id: 'sudoduel_default',
            },
          },
        },
      };

      try {
        const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
        console.log('📤 FCM URL:', url);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken.token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
          }
        );

        if (response.ok) {
          successCount++;
          console.log(`✅ Push sent to token ${token.substring(0, 20)}...`);
        } else {
          failureCount++;
          const errorBody = await response.text();
          console.error(`❌ Push failed for token ${token.substring(0, 20)}...: ${response.status} - ${errorBody}`);
          
          // Clean up invalid tokens
          if (response.status === 404 || errorBody.includes('UNREGISTERED')) {
            await query('DELETE FROM device_tokens WHERE token = $1', [token]);
            console.log(`🧹 Cleaned up invalid token`);
          }
        }
      } catch (fetchError: any) {
        failureCount++;
        console.error(`❌ Fetch error for token ${token.substring(0, 20)}...: ${fetchError.message}`);
      }
    }

    console.log(`📱 Push sent to user ${userId}: ${successCount} success, ${failureCount} failed`);
  } catch (error) {
    console.error('Push notification error:', error);
  }
}

export async function sendPushToPlayer(
  playerId: number,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  try {
    const result = await query(
      'SELECT user_id FROM player_profiles WHERE id = $1',
      [playerId]
    );
    if (result.rows.length > 0) {
      await sendPushToUser(result.rows[0].user_id, title, body, data);
    }
  } catch (error) {
    console.error('sendPushToPlayer error:', error);
  }
}

