import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Provides a safe way to interact with expo-notifications
 * while avoiding crashes in the Expo Go environment (SDK 53+).
 */

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Legacy expo-notifications can crash Expo Go on load on Android.
// We only require it if we are NOT in Expo Go.
let Notifications;
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
  } catch (e) {
    console.warn("Notifications module could not be loaded.");
  }
}

export const setupNotificationHandler = () => {
  if (isExpoGo || !Notifications) return;

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (e) {
    console.warn("Notification Handler Setup failed:", e.message);
  }
};

export async function requestNotificationPermission() {
  if (isExpoGo || !Notifications) {
    console.log("Notification: Remote Push omitted in Expo Go.");
    return false;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    return finalStatus === 'granted';
  } catch (error) {
    console.error("Notification Setup Error:", error);
    return false;
  }
}

export const setupNotificationListeners = (onResponse, onReceived) => {
  if (isExpoGo || !Notifications) return null;

  try {
    const responseListener = Notifications.addNotificationResponseReceivedListener(onResponse);
    const notificationListener = Notifications.addNotificationReceivedListener(onReceived);

    return () => {
      if (responseListener) Notifications.removeNotificationSubscription(responseListener);
      if (notificationListener) Notifications.removeNotificationSubscription(notificationListener);
    };
  } catch (e) {
    console.warn("Notification Listeners failed to attach:", e.message);
    return null;
  }
};
