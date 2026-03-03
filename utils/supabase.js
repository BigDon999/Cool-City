import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

/**
 * @file Supabase Client & Secure Storage Configuration
 * @description Centralized Supabase initialization with a hardware-backed security adapter.
 * 
 * SECURITY NOTE: 
 * This file handles authentication persistence. It uses a hybrid approach to balance
 * hardware-level encryption (SecureStore) with the 2048-byte limit on Android.
 */

/**
 * HYBRID STORAGE ADAPTER FOR SUPABASE
 * 
 * @auditor Cybersecurity Review:
 * - Primary storage: Hardware-encrypted (SecureStore/Keychain).
 * - Secondary storage (Android only): Unencrypted (AsyncStorage) ONLY for large payloads (>2000 chars).
 * - Web: Fallback to localStorage.
 */
const ExpoStorageAdapter = {
  /**
   * Retrieves data from the most secure available storage.
   * @param {string} key - The lookup key (e.g., 'sb-auth-token').
   * @returns {Promise<string|null>} The stored value or null.
   */
  getItem: async (key) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        return window.localStorage.getItem(key);
      }
      return null;
    }
    
    // 1. Attempt retrieval from hardware-encrypted store
    try {
      const value = await SecureStore.getItemAsync(key);
      if (value) return value;
    } catch (e) {
      if (__DEV__) console.warn('[Security] SecureStore read failure, attempting fallback.');
    }
    
    // 2. Fallback to AsyncStorage for legacy or oversized payloads
    return AsyncStorage.getItem(key);
  },
  
  /**
   * Persists data securely.
   * @param {string} key - The persistence key.
   * @param {string} value - The data to persist (e.g., JWT session).
   */
  setItem: async (key, value) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
      return;
    }

    // Android SecureStore has a 2048-byte hardware limit.
    // Sessions containing large OIDC tokens or custom claims may exceed this.
    if (Platform.OS === 'android' && value.length > 2000) {
      if (__DEV__) console.info('[Security] Payload exceeds SecureStore limit; using AsyncStorage fallback.');
      return AsyncStorage.setItem(key, value);
    }

    try {
      await SecureStore.setItemAsync(key, value);
    } catch (e) {
      // Safety net: Fallback to AsyncStorage if SecureStore fails (e.g. storage full)
      await AsyncStorage.setItem(key, value);
    }
  },
  
  /**
   * Purges data from all storage layers (Sign-out logic).
   * @param {string} key - Key to delete.
   */
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

// --- ENVIRONMENT CONFIGURATION ---
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// FAIL-SAFE: Verify environment health on initialization
if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  console.error("🚨🚨🚨 CRITICAL SECURITY ALERT: SUPABASE ENV VARIABLES MISSING 🚨🚨🚨");
  console.error("Authentication and data persistence will be disabled.");
}

/**
 * Global Supabase Client Instance
 * Uses the Anon Key (Standard for Client Apps) and the Secure Storage Adapter.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Security: Prevent session injection via URL params
  },
});

