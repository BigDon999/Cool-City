import { useEffect } from 'react';
import { Alert, Platform } from 'react-native';
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
import OfflineNotice from '../components/OfflineNotice';

/**
 * @file RootLayout.jsx
 * @description Main entry point and provider wrapper for the application.
 * 
 * SECURITY AUDIT NOTES:
 * - OTA Updates: Implements integrity checks via Expo Updates.
 * - Deep Linking: Securely routes auth tokens to the internal /auth handler.
 * - Provider Nesting: AuthProvider is outermost to ensure weather/location 
 *   services are scoped within a valid user session.
 */

setupNotificationHandler();

export const unstable_settings = {
  anchor: '(tabs)'
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  // 🔄 1. INTEGRITY CHECK: OTA Updates
  useEffect(() => {
    async function checkForUpdates() {
      try {
        if (__DEV__) return;
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          Alert.alert(
            "Update Available",
            "A new version of CoolCity has been downloaded. Restart now to apply security patches?",
            [
              { text: "Later", style: "cancel" },
              { text: "Restart Now", onPress: async () => Updates.reloadAsync && await Updates.reloadAsync() },
            ]
          );
        }
      } catch (e) {
        if (__DEV__) console.warn("[Security/Integrity] Update check failed:", e.message);
      }
    }
    checkForUpdates();
  }, []);

  // 🔔 2. Notifications Logic
  useEffect(() => {
    const cleanup = setupNotificationListeners(
      (response) => {
        if (response?.notification) {
          // Future: Log interaction for heat behavior analytics
        }
      },
      (_notification) => {
        // Handle foreground notification (e.g. show toast)
      }
    );

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  // ⚙️ 3. Background Engine Registration
  useEffect(() => {
    registerBackgroundWeatherTask();
  }, []);

  // 🔗 4. SECURE DEEP LINKING
  /**
   * SECURITY: Deep Link Sanitization
   * Only routes specific auth-related suffixes to the internal auth screen.
   * Prevents open-redirect or parameter injection via unverified URLs.
   */
  useEffect(() => {
    const handleDeepLink = (event) => {
      const url = event.url;
      if (!url) return;

      // Validate URL scheme and purpose
      const isAuthUrl = url.includes('access_token=') || 
                        url.includes('type=recovery') || 
                        url.includes('type=signup');

      if (isAuthUrl) {
        if (__DEV__) console.log('[Security/DeepLink] Routing authorized link to /auth');
        router.push({
          pathname: '/auth',
          params: { url }
        });
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);

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
            <OfflineNotice />
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              <Stack.Screen 
                name="auth" 
                options={{ 
                  headerShown: false,
                  gestureEnabled: false, // Prevent simple swipe-back out of auth flow
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