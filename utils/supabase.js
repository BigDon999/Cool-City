import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

/**
 * HYBRID STORAGE ADAPTER FOR SUPABASE
 * 
 * PROBLEM: SecureStore on Android has a strict 2048-byte limit. 
 * Supabase sessions/JWTs can occasionally exceed this, causing persistence to fail.
 * 
 * SOLUTION: This adapter attempts to use SecureStore for its hardware encryption,
 * but falls back to AsyncStorage for larger payloads or if SecureStore is unavailable/fails.
 */
const ExpoStorageAdapter = {
  getItem: async (key) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        return window.localStorage.getItem(key);
      }
      return null;
    }
    
    // 1. Try SecureStore first
    try {
      const value = await SecureStore.getItemAsync(key);
      if (value) return value;
    } catch (e) {
      // Silent fail, move to fallback
    }
    
    // 2. Fallback to AsyncStorage
    return AsyncStorage.getItem(key);
  },
  
  setItem: async (key, value) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
      return;
    }

    // SecureStore has a 2048-byte limit on Android. 
    // If the value is large, we MUST use AsyncStorage.
    if (Platform.OS === 'android' && value.length > 2000) {
      return AsyncStorage.setItem(key, value);
    }

    try {
      await SecureStore.setItemAsync(key, value);
    } catch (e) {
      // If SecureStore fails (e.g. limit overflow unexpected on other platforms), 
      // use AsyncStorage as safety net.
      await AsyncStorage.setItem(key, value);
    }
  },
  
  removeItem: async (key) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
      return;
    }
    await SecureStore.deleteItemAsync(key).catch(() => {});
    await AsyncStorage.removeItem(key).catch(() => {});
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  console.error("🚨🚨🚨 CRITICAL ERROR: SUPABASE ENV VARIABLES MISSING 🚨🚨🚨");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
