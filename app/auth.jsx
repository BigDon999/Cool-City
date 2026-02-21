import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../utils/supabase';
import { useColorScheme } from '../hooks/use-color-scheme';

const PRIMARY = '#2ecc70';

/**
 * AUTH SCREEN
 * 
 * Intercepts deep links from Supabase (password reset, email verification).
 * Processes tokens from URL hash or query params and routes user.
 */
export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [status, setStatus] = useState('Verifying...');
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function processLink(url) {
      if (!url || !isMounted) return;

      try {
        // Parse Hash Fragments (Supabase default)
        const parsed = Linking.parse(url);
        // Supabase often puts tokens in the fragment/hash part which Linking.parse might put in 'queryParams' or we might need to extract manually
        
        let hashParams = {};
        const fragmentIndex = url.indexOf('#');
        if (fragmentIndex !== -1) {
          const fragment = url.substring(fragmentIndex + 1);
          fragment.split('&').forEach(pair => {
            const [key, value] = pair.split('=');
            if (key && value) hashParams[key] = decodeURIComponent(value);
          });
        }

        // Merge with query params just in case
        const allParams = { ...parsed.queryParams, ...hashParams };
        
        const accessToken = allParams['access_token'];
        const refreshToken = allParams['refresh_token'];
        const type = allParams['type']; // 'recovery', 'signup', etc.

        if (accessToken && refreshToken) {
          setStatus('Authenticating...');
          
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) throw sessionError;

          if (type === 'recovery') {
            setStatus('Resetting password...');
            router.replace('/reset-password');
          } else {
            setStatus('Success! Redirecting...');
            router.replace('/(tabs)');
          }
        } else {
          // If navigated here without tokens, check if we're already authed
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            router.replace('/(tabs)');
          } else {
            throw new Error('Invalid or expired auth link.');
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setTimeout(() => { if (isMounted) router.replace('/(tabs)'); }, 3000);
        }
      }
    }

    // Handle URL from props (passed by _layout.jsx) or internal Linking
    const targetUrl = params.url || null;
    if (targetUrl) {
      processLink(targetUrl);
    } else {
      Linking.getInitialURL().then(url => {
        if (url) processLink(url);
        else router.replace('/(tabs)');
      });
    }

    return () => { isMounted = false; };
  }, [params.url]);

  const bg = isDark ? '#131f18' : '#f6f8f7';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.content}>
        {error ? (
          <>
            <Text style={styles.errorEmoji}>⚠️</Text>
            <Text style={[styles.title, { color: '#ef4444' }]}>Link Error</Text>
            <Text style={styles.subtitle}>{error}</Text>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={[styles.title, { color: textColor, marginTop: 20 }]}>{status}</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center', padding: 40 },
  errorEmoji: { fontSize: 48, marginBottom: 10 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 8 },
});
