import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

const TASK_NAME = 'BACKGROUND_WEATHER_TASK';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Calculate Heat Index (simplified)
const calculateHeatIndex = (T, R) => {
    return Math.round(
      -8.784695 +
        1.61139411 * T +
        2.338549 * R -
        0.14611605 * T * R -
        0.012308094 * T * T -
        0.016424828 * R * R +
        0.002211732 * T * T * R +
        0.00072546 * T * R * R -
        0.000003582 * T * T * R * R
    );
};

// Define Background Task
TaskManager.defineTask(TASK_NAME, async () => {
  try {
    const notificationsEnabled = await SecureStore.getItemAsync('notificationsEnabled');
    if (notificationsEnabled === 'false') {
        return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const jsonLocation = await SecureStore.getItemAsync('lastLocation');
    // Default to last known or Chicago if none
    const location = jsonLocation ? JSON.parse(jsonLocation) : { lat: 41.8781, lon: -87.6298 };

    // Fetch Weather
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current=temperature_2m,relative_humidity_2m`
    );
    const data = await response.json();
    const temp = data.current.temperature_2m;
    const hum = data.current.relative_humidity_2m;
    const heatIndex = calculateHeatIndex(temp, hum);
    
    // Check Risk Threshold (e.g., Caution/Danger/Extreme)
    // Values: <27 Safe, 27-32 Caution, 32-41 Danger, >41 Extreme
    if (heatIndex >= 32) { 
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "⚠️ High Heat Alert!",
          body: `Temperature feels like ${heatIndex}°C. Stay cool and find shelter if needed.`,
          sound: 'default',
        },
        trigger: null, // immediate
      });
      console.log(`Background Task: Alert sent for heat index ${heatIndex}`);
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }
    
    console.log(`Background Task: Heat index ${heatIndex} is safe. No alert.`);
    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.log("Background Task Error:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Helper to register task
export async function registerBackgroundFetchAsync() {
  return BackgroundFetch.registerTaskAsync(TASK_NAME, {
    minimumInterval: 60 * 15, // 15 minutes
    stopOnTerminate: false, // Keep running even if app closed (Android)
    startOnBoot: true, // Start on device boot (Android)
  });
}

// Helper to unregister task
export async function unregisterBackgroundFetchAsync() {
  return BackgroundFetch.unregisterTaskAsync(TASK_NAME);
}
