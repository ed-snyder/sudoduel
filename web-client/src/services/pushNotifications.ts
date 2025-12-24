import { PushNotifications } from '@capacitor/push-notifications';
import type { PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { FCM } from '@capacitor-community/fcm';
import { Capacitor } from '@capacitor/core';
import { api } from '../config';

let currentToken: string | null = null;
let isRegistering = false;

export async function initPushNotifications(): Promise<void> {
  console.log('🔔 initPushNotifications called');
  
  if (!Capacitor.isNativePlatform()) {
    console.log('Push notifications only available on native platforms');
    return;
  }

  if (isRegistering) {
    console.log('Push registration already in progress');
    return;
  }

  isRegistering = true;

  try {
    let permStatus = await PushNotifications.checkPermissions();
    
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.log('Push notification permission denied');
      isRegistering = false;
      return;
    }

    // Register with APNs first
    await PushNotifications.register();
    
    // Get the FCM token (this is what Firebase needs!)
    const fcmToken = await FCM.getToken();
    console.log('📱 FCM Token:', fcmToken.token.substring(0, 30) + '...');
    currentToken = fcmToken.token;
    
    try {
      await api.post('/api/notifications/register', {
        token: fcmToken.token,
        platform: Capacitor.getPlatform(),
      });
      console.log('✅ FCM token sent to backend');
    } catch (error) {
      console.error('Failed to register token with backend:', error);
    }

    // Set up listeners for foreground notifications
    await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('Push received in foreground:', notification);
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      console.log('Push notification tapped:', action);
      const data = action.notification.data;
      
      if (data?.type === 'friend_request' || data?.type === 'friend_accepted') {
        window.dispatchEvent(new CustomEvent('pushNavigate', { detail: { screen: 'friends' } }));
      } else if (data?.type === 'match_request' || data?.type === 'match_accepted') {
        window.dispatchEvent(new CustomEvent('pushNavigate', { 
          detail: { screen: 'lobby', matchId: data.matchId } 
        }));
      }
    });

    console.log('📱 Push notification setup complete');
    
  } catch (error) {
    console.error('Push notification init error:', error);
  } finally {
    isRegistering = false;
  }
}

export async function unregisterPushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !currentToken) return;
  
  try {
    await api.post('/api/notifications/unregister', { token: currentToken });
    await PushNotifications.removeAllListeners();
    currentToken = null;
    console.log('📱 Push notifications unregistered');
  } catch (error) {
    console.error('Failed to unregister push:', error);
  }
}

export function getCurrentToken(): string | null {
  return currentToken;
}
