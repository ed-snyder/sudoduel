import { PushNotifications } from '@capacitor/push-notifications';
import type { Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
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
    // Check current permission status
    let permStatus = await PushNotifications.checkPermissions();
    
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.log('Push notification permission denied');
      isRegistering = false;
      return;
    }

    // Register listeners before calling register()
    await PushNotifications.addListener('registration', async (token: Token) => {
      console.log('📱 Push registration success:', token.value.substring(0, 20) + '...');
      currentToken = token.value;
      
      try {
        await api.post('/api/notifications/register', {
          token: token.value,
          platform: Capacitor.getPlatform(),
        });
        console.log('✅ Device token sent to backend');
      } catch (error) {
        console.error('Failed to register token with backend:', error);
      }
    });

    await PushNotifications.addListener('registrationError', (error) => {
      console.error('Push registration error:', error);
    });

    await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('Push received in foreground:', notification);
      // Could show an in-app toast/notification here
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      console.log('Push notification tapped:', action);
      const data = action.notification.data;
      
      // Handle navigation based on notification type
      if (data?.type === 'friend_request' || data?.type === 'friend_accepted') {
        window.dispatchEvent(new CustomEvent('pushNavigate', { detail: { screen: 'friends' } }));
      } else if (data?.type === 'match_request' || data?.type === 'match_accepted') {
        window.dispatchEvent(new CustomEvent('pushNavigate', { 
          detail: { screen: 'lobby', matchId: data.matchId } 
        }));
      }
    });

    // Register with APNs/FCM
    await PushNotifications.register();
    console.log('📱 Push notification registration initiated');
    
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

