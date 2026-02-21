import { useEffect } from 'react';
import { Alert } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Updates from 'expo-updates';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useColorScheme } from '../hooks/use-color-scheme';
import { WeatherProvider } from '../hooks/useWeather';
import { AuthProvider } from '../context/AuthContext';
import ErrorBoundary from '../components/ErrorBoundary';
import { 
  setupNotificationHandler, 
  setupNotificationListeners 
} from '../utils/notifications';
import { registerBackgroundWeatherTask } from '../services/backgroundWeatherTask';

// 1. Configure Notification Handler (Safe for Expo Go)
setupNotificationHandler();

export const unstable_settings = {
  anchor: '(tabs)'
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  // 🔄 Check for OTA updates on app launch
  useEffect(() => {
    async function checkForUpdates() {
      try {
        if (__DEV__) return;
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          Alert.alert(
            "Update Available",
            "A new version of Cool City has been downloaded. Restart now?",
            [
              { text: "Later", style: "cancel" },
              { text: "Restart Now", onPress: async () => Updates.reloadAsync && await Updates.reloadAsync() },
            ]
          );
        }
      } catch (e) {
        console.warn("Update check failed:", e.message);
      }
    }
    checkForUpdates();
  }, []);

  // 2. Setup Notification Listeners (Safe for Expo Go)
  useEffect(() => {
    const cleanup = setupNotificationListeners(
      (response) => {
        if (response?.notification) {
          console.log("Notification Tapped:", response.notification.request.content.title);
        }
      },
      (notification) => {
        console.log("Notification Received while app open");
      }
    );

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  // 4. Register Background Weather Engine (5-min alerts)
  useEffect(() => {
    registerBackgroundWeatherTask();
  }, []);

  // 3. Deep Link Handler for auth/reset/verification (Warm & Cold Start Handling)
  useEffect(() => {
    const handleDeepLink = (event) => {
      const url = event.url;
      if (!url) return;

      if (url.includes('access_token') || url.includes('type=')) {
        // Route to our auth handler screen which will process the tokens
        router.push({
          pathname: '/auth',
          params: { url }
        });
      }
    };

    // Listen for incoming URLs (Warm start)
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check for initial URL (Cold start)
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    return () => subscription?.remove();
  }, [router]);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <WeatherProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              <Stack.Screen 
                name="auth" 
                options={{ 
                  headerShown: false,
                  gestureEnabled: false,
                }} 
              />
              <Stack.Screen 
                name="reset-password" 
                options={{ 
                  headerShown: false,
                  gestureEnabled: false,
                }} 
              />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </WeatherProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}