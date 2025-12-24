import admin from 'firebase-admin';
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
    }
    
    admin.initializeApp({
      credential: admin.credential.cert(parsed),
      projectId: parsed.project_id,
    });
    initialized = true;
    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.error('❌ Firebase init failed:', error);
  }
}

export function isFirebaseInitialized(): boolean {
  return initialized;
}

export async function sendPushToUser(
  userId: number,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  if (!initialized) {
    return;
  }

  try {
    const result = await query(
      'SELECT token, platform FROM device_tokens WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return;
    }

    let successCount = 0;
    let failureCount = 0;

    for (const row of result.rows) {
      const token = row.token;
      
      const message: admin.messaging.Message = {
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
            channelId: 'sudoduel_default',
          },
        },
      };

      try {
        await admin.messaging().send(message);
        successCount++;
      } catch (sendError: any) {
        failureCount++;
        console.error(`Push failed: ${sendError.code} - ${sendError.message}`);
        
        // Clean up invalid tokens
        if (sendError.code === 'messaging/registration-token-not-registered' ||
            sendError.code === 'messaging/invalid-registration-token') {
          await query('DELETE FROM device_tokens WHERE token = $1', [token]);
        }
      }
    }

    if (failureCount > 0) {
      console.log(`📱 Push to user ${userId}: ${successCount} success, ${failureCount} failed`);
    }
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
