import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../utils/supabase';
import { useColorScheme } from '../hooks/use-color-scheme';
import { MaterialIcons } from '@expo/vector-icons';
import AuthInput from '../components/auth/AuthInput';
import BubblesBackground from '../components/auth/BubblesBackground';

const PRIMARY = '#2ecc70';

/**
 * RESET PASSWORD SCREEN
 * 
 * This screen is shown AFTER the user taps the password reset link
 * and the AuthCallbackScreen has already exchanged the tokens for
 * a valid session.
 * 
 * Since the user is now authenticated (via the recovery token),
 * we can call supabase.auth.updateUser({ password }) directly.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const bg = isDark ? '#131f18' : '#f6f8f7';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subtextColor = isDark ? '#94a3b8' : '#64748b';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const borderColor = isDark ? '#1e293b' : '#e2e8f0';

  const handleResetPassword = useCallback(async () => {
    setError('');

    // Validation
    if (!newPassword.trim()) {
      setError('Please enter a new password');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      setError('Password must contain at least one uppercase letter');
      return;
    }

    if (!/[0-9]/.test(newPassword)) {
      setError('Password must contain at least one number');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setLoading(true);

      const { data, error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess(true);

      // Navigate to main app after 2 seconds
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  }, [newPassword, confirmPassword, router]);

  if (success) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
        <BubblesBackground color={PRIMARY} />
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <MaterialIcons name="check-circle" size={72} color={PRIMARY} />
          </View>
          <Text style={[styles.successTitle, { color: textColor }]}>
            Password Updated!
          </Text>
          <Text style={[styles.successSubtitle, { color: subtextColor }]}>
            Your password has been changed successfully.{'\n'}Redirecting you to the app...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <BubblesBackground color={PRIMARY} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <MaterialIcons name="lock-reset" size={36} color={PRIMARY} />
            </View>
            <Text style={[styles.title, { color: textColor }]}>
              Set New Password
            </Text>
            <Text style={[styles.subtitle, { color: subtextColor }]}>
              Enter your new password below. It must be at least 8 characters
              with one uppercase letter and one number.
            </Text>
          </View>

          {/* Error Banner */}
          {error ? (
            <View style={styles.errorBanner}>
              <MaterialIcons name="error-outline" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* New Password */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: subtextColor }]}>
              New Password
            </Text>
            <AuthInput
              variant="card"
              placeholder="Enter new password"
              value={newPassword}
              onChangeText={(t) => {
                setNewPassword(t);
                setError('');
              }}
              secureTextEntry
              icon="lock"
            />
          </View>

          {/* Confirm Password */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: subtextColor }]}>
              Confirm Password
            </Text>
            <AuthInput
              variant="card"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChangeText={(t) => {
                setConfirmPassword(t);
                setError('');
              }}
              secureTextEntry
              icon="lock"
              onSubmitEditing={handleResetPassword}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleResetPassword}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#131f18" />
            ) : (
              <>
                <MaterialIcons name="check" size={22} color="#131f18" />
                <Text style={styles.submitButtonText}>Update Password</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Cancel */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.replace('/(tabs)')}
            activeOpacity={0.7}
          >
            <Text style={[styles.cancelText, { color: subtextColor }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(46, 204, 112, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
    marginBottom: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  submitButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: PRIMARY,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    ...Platform.select({
      android: { elevation: 6 },
      ios: {
        shadowColor: PRIMARY,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
    }),
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#131f18',
    fontSize: 17,
    fontWeight: '800',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  successIcon: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
});
