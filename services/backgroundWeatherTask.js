import * as TaskManager from 'expo-task-manager';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Location from 'expo-location';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Safe imports for native-only modules
let Notifications = null;
let BackgroundFetch = null;

if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    BackgroundFetch = require('expo-background-fetch');
  } catch (e) {
    console.log('[BackgroundWeatherTask] Native modules not available');
  }
}

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

    if (!position || !BackgroundFetch) return BackgroundFetch?.BackgroundFetchResult?.NoData || 0;

    const { latitude, longitude } = position.coords;

    // 2. Fetch fresh weather
    const weather = await fetchWeather(latitude, longitude);
    if (!weather || weather.error) {
       if (__DEV__) console.log('[BackgroundFetch] Weather sync failed, skipping cycle.');
       return BackgroundFetch?.BackgroundFetchResult?.Failed || 0;
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

    // 5. Send Notification (Safe guard)
    if (Notifications) {
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
    }

    return BackgroundFetch?.BackgroundFetchResult?.NewData || 0;
  } catch (error) {
    if (__DEV__) console.error('[BackgroundFetch] Task failed:', error);
    return BackgroundFetch?.BackgroundFetchResult?.Failed || 0;
  }
});

// 2. Export Registration Helper
export const registerBackgroundWeatherTask = async () => {
  if (isExpoGo || !BackgroundFetch || !Notifications) {
    if (__DEV__) console.log('[BackgroundFetch] Skipping registration in Expo Go or missing modules');
    return;
  }

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
        minimumInterval: 300, 
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
  if (isExpoGo || !BackgroundFetch) return;
  
  if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_WEATHER_TASK)) {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_WEATHER_TASK);
  }
};
