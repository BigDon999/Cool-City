import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { WeatherProvider } from '@/hooks/useWeather';
import { AuthProvider } from '@/context/AuthContext';
import ErrorBoundary from '@/components/ErrorBoundary';

// 1. Configure Notification Handler (Required for foreground notifications)
// Guarded for Expo Go SDK 53+
if (Constants.executionEnvironment !== ExecutionEnvironment.StoreClient) {
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
}

export const unstable_settings = {
  anchor: '(tabs)'
};

/**
 * GLOBAL NOTIFICATION SETUP
 * This function is exported so it can be manually called from a Settings screen
 * rather than automatically on mount, adhering to Android 13/14 best practices.
 */
export async function requestNotificationPermission() {
  // 0. Guard for Expo Go (Remote push is removed in SDK 53)
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
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
    
    if (finalStatus !== 'granted') {
      console.log("Notification: Permission not granted.");
      return false;
    }
    
    console.log("Notification: Permission granted.");
    return true;
  } catch (error) {
    console.error("Notification Setup Error:", error);
    return false;
  }
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // 2. Setup Notification Listeners (Passive)
    // Guarded for Expo Go SDK 53+
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
       return;
    }

    let isMounted = true;
    let responseListener;
    let notificationListener;

    const setupListeners = async () => {
      try {
        responseListener = Notifications.addNotificationResponseReceivedListener(response => {
          try {
            if (!isMounted) return;
            if (response && response.notification) {
                console.log("Notification Tapped:", response.notification.request.content.title);
            }
          } catch (e) { console.error("Notification Response Inner Error:", e); }
        });

        notificationListener = Notifications.addNotificationReceivedListener(notification => {
            if (!isMounted) return;
            console.log("Notification Received while app open");
        });
      } catch (e) {
         console.warn("Notification Listeners failed to attach:", e.message);
      }
    };

    setupListeners();

    return () => {
      isMounted = false;
      if (responseListener) {
          try { Notifications.removeNotificationSubscription(responseListener); } catch (e) {}
      }
      if (notificationListener) {
          try { Notifications.removeNotificationSubscription(notificationListener); } catch (e) {}
      }
    };
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