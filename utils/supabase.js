import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Professional Secure Storage Adapter for Supabase
// SecureStore is hardware-encrypted, unlike AsyncStorage which is plain-text.
// We check if we are in a native environment where SecureStore is available.
const isNative = Platform.OS !== 'web';

const ExpoSecureStoreAdapter = {
  getItem: (key) => {
    if (!isNative) return null;
    return SecureStore.getItemAsync(key);
  },
  setItem: (key, value) => {
    if (!isNative) return null;
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key) => {
    if (!isNative) return null;
    return SecureStore.deleteItemAsync(key);
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  console.error("🚨🚨🚨 CRITICAL ERROR: SUPABASE ENV VARIABLES MISSING 🚨🚨🚨");
  console.error("-> CHECK EAS SECRETS: You must run `eas secret:create` for production builds.");
  console.error("-> CHECK .ENV: Ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set.");
  console.error("App functionality (Auth, Data) will FAIL until fixed.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
