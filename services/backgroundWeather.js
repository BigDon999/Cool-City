import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const TASK_NAME = 'BACKGROUND_WEATHER_TASK';

// 1. Define Task globally once. This is the only way to avoid re-definition crashes.
TaskManager.defineTask(TASK_NAME, async () => {
  try {
    console.log("Background Task: Executing...");
    const notificationsEnabled = await SecureStore.getItemAsync('notificationsEnabled');
    if (notificationsEnabled === 'false') return BackgroundFetch.BackgroundFetchResult.NoData;

    const jsonLocation = await SecureStore.getItemAsync('lastLocation');
    const location = jsonLocation ? JSON.parse(jsonLocation) : null;
    if (!location) return BackgroundFetch.BackgroundFetchResult.NoData;

    const { lat, lon } = location;
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m`);
    const data = await response.json();
    
    if (!data.current) return BackgroundFetch.BackgroundFetchResult.Failed;
    
    // Simple Heat Calculation
    const temp = data.current.temperature_2m;
    if (temp >= 32) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "⚠️ High Heat Alert (Background)",
          body: `Temperature is ${temp}°C. Avoid prolonged exposure.`,
          sound: 'default',
        },
        trigger: null,
      });
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error("Background Task logic failed:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// 2. Safe registration function
export async function registerBackgroundWeatherTask() {
  try {
    // a. Check Environment
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
      console.log("Background Task: Blocked (Expo Go does not support background tasks).");
      return { success: false, reason: 'EXPO_GO' };
    }

    // b. Check Foreground Permission First (Required for registration)
    const { status: foreStatus } = await Location.getForegroundPermissionsAsync();
    if (foreStatus !== 'granted') {
      console.log("Background Task: Registration failed (Missing foreground permission).");
      return { success: false, reason: 'NO_FOREGROUND' };
    }

    // c. Check if already registered to prevent duplicates
    const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (isRegistered) {
      console.log("Background Task: Already active.");
      return { success: true, reason: 'ALREADY_REGISTERED' };
    }

    // d. Register
    await BackgroundFetch.registerTaskAsync(TASK_NAME, {
      minimumInterval: 60 * 15, // 15 mins
      stopOnTerminate: false,
      startOnBoot: true,
    });

    console.log("Background Task: Successfully registered.");
    return { success: true };
  } catch (err) {
    console.error("Background Task Registration Error:", err);
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
