import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { theme } from '../constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from '../hooks/use-color-scheme';

import AuthButton from './auth/AuthButton';
import BubblesBackground from './auth/BubblesBackground';

export default function VerifyEmailScreen() {
  const { user, logout, resendVerification, authLoading } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [feedback, setFeedback] = useState({ type: null, message: '' });

  const handleResend = useCallback(async () => {
    setFeedback({ type: null, message: '' });

    const result = await resendVerification();

    if (result.error) {
      setFeedback({ type: 'error', message: result.error });
    } else {
      setFeedback({ type: 'success', message: 'Verification email resent! Please check your inbox.' });
    }
  }, [resendVerification]);

  const handleBack = useCallback(async () => {
    await logout();
  }, [logout]);

  const backgroundColor = isDark ? theme.backgroundDark : theme.backgroundLight;
  const cardBackgroundColor = isDark ? theme.cardBgDark : theme.cardBgLight;
  const textColor = isDark ? theme.textLight : theme.textDark;
  const subtextColor = isDark ? theme.subtextLight : theme.subtextDark;
  const borderColor = isDark ? theme.borderColorDark : theme.borderColorLight;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <BubblesBackground color={theme.primary} />
      <View style={[styles.card, { backgroundColor: cardBackgroundColor, borderColor }]}>
        <View style={styles.iconContainer}>
          <MaterialIcons name="mark-email-read" size={48} color={theme.primary} />
        </View>

        <Text style={[styles.title, { color: textColor }]}>Verify Your Email</Text>

        <Text style={[styles.explanation, { color: subtextColor }]}>
          Please check your inbox{' '}
          <Text style={{ fontWeight: '700', color: textColor }}>
            {user?.email || 'your email'}
          </Text>{' '}
          and click the link to verify your account.
        </Text>

        {feedback.message !== '' && (
          <View
            style={[
              styles.feedbackBox,
              feedback.type === 'error' ? styles.errorBox : styles.successBox,
            ]}
          >
            <MaterialIcons
              name={feedback.type === 'error' ? 'error-outline' : 'check-circle-outline'}
              size={18}
              color={feedback.type === 'error' ? '#ef4444' : theme.primary}
            />
            <Text
              style={[
                styles.feedbackText,
                feedback.type === 'error' ? styles.errorText : styles.successText,
              ]}
            >
              {feedback.message}
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          <AuthButton
            title="Resend Verification Email"
            onPress={handleResend}
            loading={authLoading}
          />

          <AuthButton
            title="Back to Login"
            variant="secondary"
            onPress={handleBack}
          />
        </View>
      </View>

      <Text style={[styles.footerText, { color: subtextColor }]}>
        CoolCity Climate Intelligence
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
      },
    }),
  },
  iconContainer: {
    marginBottom: 24,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(46, 204, 112, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  explanation: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
  },
  feedbackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    width: '100%',
    gap: 8,
  },
  successBox: {
    backgroundColor: 'rgba(46, 204, 112, 0.1)',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  successText: {
    color: '#166534',
  },
  errorText: {
    color: '#991b1b',
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  footerText: {
    marginTop: 32,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    opacity: 0.6,
  },
});
