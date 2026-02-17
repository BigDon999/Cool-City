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
export const unstable_settings = {
  anchor: '(tabs)'
};
export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    async function configureBackground() {
      // Skip logic in Expo Go (StoreClient)
      if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
        console.log("Background Task: Disabled in Expo Go (Requires Development Build)");
        return;
      }

      try {
        // Dynamic imports to avoid crashing Expo Go
        const Notifications = await import('expo-notifications');
        const { registerBackgroundFetchAsync } = await import('../services/backgroundWeather');

        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
            console.log("Notification permission denied");
            return;
        }
        await registerBackgroundFetchAsync();
        console.log("Background Weather Task Registered");
      } catch (err) {
        console.log("Background Task Error:", err);
      }
    }
    configureBackground();
  }, []);
  return (
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
  );
}