import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
// import * as Notifications from 'expo-notifications';
// import { registerBackgroundFetchAsync } from '../services/backgroundWeather';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { WeatherProvider } from '@/hooks/useWeather';
import { AuthProvider } from '@/context/AuthContext';
import ErrorBoundary from '@/components/ErrorBoundary';

export const unstable_settings = {
  anchor: '(tabs)'
};
export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    async function configureBackground() {
      // 1. Skip logic in Expo Go (StoreClient)
      if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
        console.log("Background Task: Disabled in Expo Go (Requires Development Build)");
        return;
      }

      try {
        // 2. Dynamic Imports to avoid crashes
        const Notifications = await import('expo-notifications');
        const Location = await import('expo-location');
        const { registerBackgroundFetchAsync } = await import('../services/backgroundWeather');

        // 3. Request Notifications Permission (Safe)
        try {
          const { status: notifStatus } = await Notifications.requestPermissionsAsync();
          if (notifStatus !== 'granted') {
              console.log("Notification permission denied");
          }
        } catch (e) {
          console.log("Notification Permission Error:", e);
        }

        // Listener for Notification Tapping
        const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
          console.log("Notification Tapped:", response);
          // Future: Navigate to specific screen based on data
        });

        // 4. Request Foreground Location Permission FIRST
        let { status: foreStatus } = await Location.requestForegroundPermissionsAsync();
        if (foreStatus !== 'granted') {
           console.log("Foreground Location permission denied - Skipping Background Task");
           return;
        }

        // 5. Request Background Location Permission (Only if Foreground Granted)
        // Note: On Android 11+, this must be a separate request or user flow.
        try {
           const { status: backStatus } = await Location.requestBackgroundPermissionsAsync();
           if (backStatus !== 'granted') {
             console.log("Background Location denied - Task will rely on last known location or periodic fetch");
           }
        } catch (e) {
           console.log("Background Location Request Error (Optional):", e);
        }

        // 6. Register Task Safely
        await registerBackgroundFetchAsync();
        console.log("Background Weather Task Registered Successfully");
        
        return () => {
          if (responseListener) Notifications.removeNotificationSubscription(responseListener);
        };

      } catch (err) {
        console.log("Global Background Configuration Error:", err);
      }
    }

    configureBackground();
  }, []);
  return (
    <ErrorBoundary>
      <AuthProvider>
        <WeatherProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </WeatherProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}