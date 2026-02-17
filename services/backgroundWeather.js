import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

const TASK_NAME = 'BACKGROUND_WEATHER_TASK';

// 1. Configure notification behavior safely
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch (error) {
  console.log("Notification Handler Error:", error);
}

// 2. Define Task Safely (Do NOT swallow errors silently, but prevent duplicates)
try {
  // Check if task is already defined to avoid "Task '...' is already defined" error
  // Note: TaskManager doesn't export a `isTaskDefined` method directly in all versions, 
  // but `defineTask` internally handles re-definition by overwriting. 
  // However, wrapping in try/catch is the safest boundary for native crashes.
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
      
      // Check Risk Threshold
      if (heatIndex >= 32) { 
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "⚠️ High Heat Alert!",
            body: `Temperature feels like ${heatIndex}°C. Stay cool and find shelter if needed.`,
            sound: 'default',
          },
          // FIX: Use specific trigger object instead of null for stability
          trigger: { seconds: 1 }, 
        });
        console.log(`Background Task: Alert sent for heat index ${heatIndex}`);
        return BackgroundFetch.BackgroundFetchResult.NewData;
      }
      
      return BackgroundFetch.BackgroundFetchResult.NoData;
    } catch (error) {
      console.log("Background Task Error:", error);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
} catch (e) {
  console.log("TaskManager Definition Error:", e.message);
}

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

// 3. Helper to register task safely (Idempotent & Status Checked)
export async function registerBackgroundFetchAsync() {
  try {
    // Check if background fetch is available on this device
    const status = await BackgroundFetch.getStatusAsync();
    if (status === BackgroundFetch.BackgroundFetchStatus.Restricted || status === BackgroundFetch.BackgroundFetchStatus.Denied) {
        console.log("Background Fetch Restricted or Denied");
        return;
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (isRegistered) {
      console.log("Background Task already registered:", TASK_NAME);
      return;
    }

    console.log("Registering Background Task:", TASK_NAME);
    // FIX: Optimized Android options - minimal config first to prevent permissions crash
    return BackgroundFetch.registerTaskAsync(TASK_NAME, {
      minimumInterval: 60 * 15, // 15 minutes
      stopOnTerminate: false,
      startOnBoot: false, // Set false temporarily for stability testing
    });
  } catch (err) {
    console.log("Task Registration Error:", err);
  }
}

// Helper to unregister task
export async function unregisterBackgroundFetchAsync() {
  return BackgroundFetch.unregisterTaskAsync(TASK_NAME);
}
