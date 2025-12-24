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
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccount)),
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

    const tokens = result.rows.map(r => r.token);

    const message: admin.messaging.MulticastMessage = {
      tokens,
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

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`📱 Push sent to user ${userId}: ${response.successCount} success, ${response.failureCount} failed`);

    // Clean up invalid tokens
    if (response.failureCount > 0) {
      const tokensToRemove: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
          tokensToRemove.push(tokens[idx]);
        }
      });
      if (tokensToRemove.length > 0) {
        await query(
          'DELETE FROM device_tokens WHERE token = ANY($1)',
          [tokensToRemove]
        );
        console.log(`🧹 Cleaned up ${tokensToRemove.length} invalid tokens`);
      }
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

