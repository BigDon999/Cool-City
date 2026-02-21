import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import Constants, { ExecutionEnvironment } from 'expo-constants';

import { fetchWeather, calculateHeatRisk } from './openWeatherService';

const TASK_NAME = 'BACKGROUND_WEATHER_TASK';

// 1. Define Task globally once. This is the only way to avoid re-definition crashes.
TaskManager.defineTask(TASK_NAME, async () => {
  try {
    if (__DEV__) console.log("Background Task: Executing...");
    
    // Check if notifications are disabled in settings
    const notificationsEnabled = await SecureStore.getItemAsync('notificationsEnabled');
    if (notificationsEnabled === 'false') return BackgroundFetch.BackgroundFetchResult.NoData;

    // Get last known location
    const jsonLocation = await SecureStore.getItemAsync('lastLocation');
    const location = jsonLocation ? JSON.parse(jsonLocation) : null;
    if (!location) return BackgroundFetch.BackgroundFetchResult.NoData;

    const { lat, lon } = location;
    
    // Fetch fresh weather
    const data = await fetchWeather(lat, lon);
    if (!data || data.error) return BackgroundFetch.BackgroundFetchResult.Failed;
    
    // Sophisticated Heat Risk Calculation
    const { heatIndex, risk } = calculateHeatRisk(data.temperature, data.humidity, data.uvi || 0);

    // Only notify if risk is not SAFE
    if (risk !== 'SAFE') {
      let color = "#2ecc71"; // Safe
      let priority = Notifications.AndroidImportance.DEFAULT;
      
      switch (risk) {
        case 'EXTREME': color = "#8e44ad"; priority = Notifications.AndroidImportance.MAX; break;
        case 'DANGER': color = "#ef4444"; priority = Notifications.AndroidImportance.HIGH; break;
        case 'CAUTION': color = "#f39c12"; break;
        case 'MODERATE': color = "#f1c40f"; break;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `⚠️ ${risk} Heat Warning`,
          body: `Temperature is ${data.temperature}°C (Feels like ${heatIndex}°C). Protective action recommended.`,
          sound: 'default',
          color: color,
          data: { risk, heatIndex },
        },
        trigger: null,
      });
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    if (__DEV__) console.error("Background Task logic failed:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// 2. Safe registration function
export async function registerBackgroundWeatherTask() {
  try {
    // a. Check Environment
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
      if (__DEV__) console.log("Background Task: Blocked (Expo Go does not support background tasks).");
      return { success: false, reason: 'EXPO_GO' };
    }

    // b. Check Foreground Permission First (Required for registration)
    const { status: foreStatus } = await Location.getForegroundPermissionsAsync();
    if (foreStatus !== 'granted') {
      if (__DEV__) console.log("Background Task: Registration failed (Missing foreground permission).");
      return { success: false, reason: 'NO_FOREGROUND' };
    }

    // c. Register (registerTaskAsync handles re-registration safely)
    await BackgroundFetch.registerTaskAsync(TASK_NAME, {
      minimumInterval: 60 * 5, // 5 mins
      stopOnTerminate: false,
      startOnBoot: true,
    });

    if (__DEV__) console.log("Background Task: Successfully registered (5 min interval).");
    return { success: true };
  } catch (err) {
    if (__DEV__) console.error("Background Task Registration Error:", err);
    return { success: false, reason: 'CRASH_PREVENTED' };
  }
}

export async function unregisterBackgroundWeatherTask() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (isRegistered) {
        await BackgroundFetch.unregisterTaskAsync(TASK_NAME);
        console.log("Background Task: Unregistered.");
    }
  } catch (e) {
    console.error("Unregister Error:", e);
  }
}
