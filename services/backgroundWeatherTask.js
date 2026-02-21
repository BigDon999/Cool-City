import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { fetchWeather, calculateHeatRisk } from './openWeatherService';

const BACKGROUND_WEATHER_TASK = 'background-weather-check';

// 1. Define the Background Task
TaskManager.defineTask(BACKGROUND_WEATHER_TASK, async () => {
  try {
    const now = new Date().toLocaleTimeString();
    if (__DEV__) console.log(`[BackgroundFetch] [${now}] Task triggered`);

    // 1. Get current location
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_WEATHER_TASK);
    // Note: BackgroundFetch usually doesn't need Location started, 
    // but we need current coords.
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    if (!position) return BackgroundFetch.BackgroundFetchResult.NoData;

    const { latitude, longitude } = position.coords;

    // 2. Fetch fresh weather
    const weather = await fetchWeather(latitude, longitude);
    if (!weather || weather.error) {
       if (__DEV__) console.log('[BackgroundFetch] Weather sync failed, skipping cycle.');
       return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    // 3. Calculate Risk & Advice
    const { heatIndex, risk } = calculateHeatRisk(weather.temperature, weather.humidity, weather.uvi);
    
    // 4. Logic for notification content
    let title = `${risk} Heat Risk Alert`;
    let body = `Current Heat Index: ${heatIndex}°C. `;
    
    if (risk === 'SAFE') {
      body += 'Conditions are safe. Stay hydrated!';
    } else if (risk === 'MODERATE' || risk === 'CAUTION') {
      body += 'Heat is rising. Seek shade and drink more water.';
    } else {
      body += 'EXTREME HEAT. Stay indoors and check on your neighbors.';
    }

    // 5. Send Notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { risk, heatIndex },
        sound: true,
        priority: 'high',
      },
      trigger: null, // send immediately
    });

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    if (__DEV__) console.error('[BackgroundFetch] Task failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// 2. Export Registration Helper
export const registerBackgroundWeatherTask = async () => {
  try {
    // Check permissions
    const { status: locStatus } = await Location.requestBackgroundPermissionsAsync();
    const { status: notifStatus } = await Notifications.requestPermissionsAsync();

    if (locStatus !== 'granted' || notifStatus !== 'granted') {
      if (__DEV__) console.warn('[BackgroundFetch] Permissions not granted');
      return;
    }

    // Check if task exists
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_WEATHER_TASK);
    
    if (!isRegistered) {
      // Register Background Fetch
      // set to 5 minutes (300 seconds)
      await BackgroundFetch.registerTaskAsync(BACKGROUND_WEATHER_TASK, {
        minimumInterval: 5 * 60, 
        stopOnTerminate: false,
        startOnBoot: true,
      });
      
      if (__DEV__) console.log('[BackgroundFetch] Task registered with 5-min interval');
    }
  } catch (err) {
    if (__DEV__) console.error('[BackgroundFetch] Registration failed:', err);
  }
};

export const unregisterBackgroundWeatherTask = async () => {
  if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_WEATHER_TASK)) {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_WEATHER_TASK);
  }
};
