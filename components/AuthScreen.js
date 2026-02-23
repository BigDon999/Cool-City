import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useColorScheme } from '../hooks/use-color-scheme';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import AuthInput from './auth/AuthInput';
import AuthButton from './auth/AuthButton';
import PasswordStrengthIndicator from './auth/PasswordStrengthIndicator';
import OnboardingScreen from './OnboardingScreen';
import BubblesBackground from './auth/BubblesBackground';

const PRIMARY = '#2ecc70';
const ONBOARDING_KEY = '@coolcity_onboarding_complete';

export default function AuthScreen() {
  const { login, signup, resetPassword, authLoading } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  // ─── State ──────────────────────────────────────────────────────
  const [showOnboarding, setShowOnboarding] = useState(null); // null = loading
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'reset'
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [signupSuccess, setSignupSuccess] = useState(false);

  // ─── Refs ───────────────────────────────────────────────────────
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  // ─── Initial Load ───────────────────────────────────────────────
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const value = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (value === 'true') {
          setShowOnboarding(false);
        } else {
          setShowOnboarding(true);
        }
      } catch (e) {
        setShowOnboarding(true);
      }
    };
    checkOnboarding();
  }, []);

  const completeOnboarding = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      setShowOnboarding(false);
    } catch (e) {
      setShowOnboarding(false);
    }
  }, []);

  // ─── Clear errors on input ────────────────────────────────────
  const handleEmailChange = useCallback((text) => {
    setEmail(text);
    setError('');
    setFieldErrors((prev) => ({ ...prev, email: '' }));
  }, []);

  const handlePasswordChange = useCallback((text) => {
    setPassword(text);
    setError('');
    setFieldErrors((prev) => ({ ...prev, password: '' }));
  }, []);

  const handleConfirmChange = useCallback((text) => {
    setConfirmPassword(text);
    setError('');
    setFieldErrors((prev) => ({ ...prev, confirmPassword: '' }));
  }, []);

  // ─── Mode switching ───────────────────────────────────────────
  const switchMode = useCallback((newMode) => {
    setMode(newMode);
    setError('');
    setFieldErrors({});
    setPassword('');
    setConfirmPassword('');
    setSignupSuccess(false);
  }, []);

  // ─── HANDLE LOGIN ─────────────────────────────────────────────
  const handleLogin = useCallback(async () => {
    setError('');
    setFieldErrors({});
    const result = await login(email, password);
    if (result.error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(result.error);
    }
  }, [email, password, login]);

  // ─── HANDLE SIGNUP ────────────────────────────────────────────
  const handleSignup = useCallback(async () => {
    setError('');
    setFieldErrors({});
    const result = await signup(email, password, confirmPassword);
    if (result.error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(result.error);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSignupSuccess(true);
    }
  }, [email, password, confirmPassword, signup]);

  // ─── HANDLE RESET ─────────────────────────────────────────────
  const handleReset = useCallback(async () => {
    setError('');
    setFieldErrors({});
    const result = await resetPassword(email);
    if (result.error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(result.error);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      switchMode('login');
      setTimeout(() => setError('✓ Reset link sent! Check your email inbox.'), 100);
    }
  }, [email, resetPassword, switchMode]);

  // ─── Colors ─────────────────────────────────────────────────────
  const bg = isDark ? '#131f18' : '#f6f8f7';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subtextColor = isDark ? '#94a3b8' : '#64748b';
  const dividerColor = isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0';

  // ─── Render Error Banner ──────────────────────────────────────
  const renderError = () => {
    if (!error) return null;
    const isSuccess = error.startsWith('✓');
    return (
      <View
        style={[
          styles.errorBanner,
          {
            backgroundColor: isSuccess ? 'rgba(46,204,112,0.1)' : 'rgba(239,68,68,0.08)',
            borderColor: isSuccess ? 'rgba(46,204,112,0.2)' : 'rgba(239,68,68,0.15)',
          },
        ]}
      >
        <MaterialIcons
          name={isSuccess ? 'check-circle-outline' : 'error-outline'}
          size={18}
          color={isSuccess ? PRIMARY : '#ef4444'}
        />
        <Text style={[styles.errorBannerText, { color: isSuccess ? PRIMARY : '#ef4444' }]}>
          {error}
        </Text>
      </View>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  //  MODAL RENDERING (Loading / Onboarding)
  // ═══════════════════════════════════════════════════════════════
  if (showOnboarding === null) {
    return (
      <View style={[styles.container, { backgroundColor: bg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  if (showOnboarding) {
    return (
      <View style={{ flex: 1 }}>
        <OnboardingScreen onFinish={completeOnboarding} />
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  MAIN RENDERING
  // ═══════════════════════════════════════════════════════════════
  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <BubblesBackground color={PRIMARY} />

      {signupSuccess ? (
        <View style={[styles.successContent, { paddingTop: insets.top + 80 }]}>
          <View style={styles.successIcon}>
            <MaterialCommunityIcons name="email-check-outline" size={52} color={PRIMARY} />
          </View>

          <Text style={[styles.successTitle, { color: textColor }]}>Check Your Email ✉️</Text>
          <Text style={[styles.successSubtitle, { color: subtextColor }]}>
            We sent a verification link to
          </Text>
          <Text style={[styles.emailHighlight, { color: textColor }]}>{email}</Text>
          <Text style={[styles.successSubtitle, { color: subtextColor, marginTop: 8 }]}>
            Please verify your email to continue.
          </Text>

          <View style={{ marginTop: 40, width: '100%' }}>
            <AuthButton title="Back to Login" icon="login" onPress={() => switchMode('login')} />
          </View>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Nav Row */}
            {(mode === 'reset' || mode === 'signup') && (
              <View style={styles.navRow}>
                <TouchableOpacity
                  style={[styles.backButton, {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                  }]}
                  onPress={() => switchMode('login')}
                >
                  <MaterialIcons name="arrow-back-ios" size={18} color={textColor} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              </View>
            )}

            {/* Header */}
            <View style={styles.headerSection}>
              <Text style={[styles.title, { color: textColor }]}>
                {mode === 'login' && 'Welcome back 👋'}
                {mode === 'signup' && 'Create your account ✨'}
                {mode === 'reset' && 'Reset Password 🔐'}
              </Text>
              <Text style={[styles.subtitle, { color: subtextColor }]}>
                {mode === 'login' && "We're so glad to see you again."}
                {mode === 'signup' && "Join our community in just a few steps."}
                {mode === 'reset' && "Enter your email to receive recovery instructions."}
              </Text>
            </View>

            {renderError()}

            {/* Form */}
            <View style={styles.formSection}>
              <AuthInput
                variant={mode === 'signup' ? 'pill' : 'card'}
                label="Email Address"
                value={email}
                onChangeText={handleEmailChange}
                placeholder={mode === 'signup' ? 'hello@example.com' : 'yourname@example.com'}
                keyboardType="email-address"
                icon={mode === 'signup' ? 'mail' : undefined}
                error={fieldErrors.email}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />

              {mode !== 'reset' && (
                <>
                  <AuthInput
                    variant={mode === 'signup' ? 'pill' : 'card'}
                    label={mode === 'signup' ? 'Create Password' : 'Password'}
                    value={password}
                    onChangeText={handlePasswordChange}
                    placeholder="••••••••"
                    secureTextEntry
                    error={fieldErrors.password}
                    inputRef={passwordRef}
                    returnKeyType={mode === 'signup' ? 'next' : 'done'}
                    onSubmitEditing={() => mode === 'signup' ? confirmRef.current?.focus() : handleLogin()}
                    rightAction={mode === 'login' ? (
                      <TouchableOpacity onPress={() => switchMode('reset')}>
                        <Text style={styles.forgotLink}>Forgot password?</Text>
                      </TouchableOpacity>
                    ) : null}
                  />

                  {mode === 'signup' && (
                    <>
                      <PasswordStrengthIndicator password={password} />
                      <AuthInput
                        variant="pill"
                        label="Confirm Password"
                        value={confirmPassword}
                        onChangeText={handleConfirmChange}
                        placeholder="••••••••"
                        secureTextEntry
                        error={fieldErrors.confirmPassword}
                        inputRef={confirmRef}
                        returnKeyType="done"
                        onSubmitEditing={handleSignup}
                      />
                    </>
                  )}
                </>
              )}

              <View style={{ marginTop: 12 }}>
                <AuthButton
                  title={mode === 'login' ? 'Log In' : mode === 'signup' ? 'Sign Up' : 'Send Reset Link'}
                  icon={mode === 'login' ? 'login' : mode === 'signup' ? 'arrow-forward' : 'send'}
                  loading={authLoading}
                  onPress={mode === 'login' ? handleLogin : mode === 'signup' ? handleSignup : handleReset}
                />
              </View>
            </View>

            {/* Footer / Extras */}
            <View style={styles.dividerSection}>
              <View style={[styles.dividerLine, { backgroundColor: dividerColor }]} />
              <Text style={[styles.dividerText, { color: subtextColor }]}>
                {mode === 'signup' ? 'or continue with' : 'Climate Intelligence'}
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: dividerColor }]} />
            </View>

            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: subtextColor }]}>
                {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
              </Text>
              <TouchableOpacity onPress={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
                <Text style={styles.footerLink}>
                  {mode === 'login' ? 'Sign up' : 'Log in'}
                </Text>
              </TouchableOpacity>
            </View>

            {mode === 'signup' && (
              <Text style={[styles.termsText, { color: isDark ? '#475569' : '#94a3b8' }]}>
                By signing up, you agree to our Terms of Service and Privacy Policy.
              </Text>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  SHARED STYLES
// ═══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
  },

  // ── Decorative blurs ──────────────────────────────────────
  decorBlur1: {
    position: 'absolute',
    bottom: -96,
    right: -96,
    width: 256,
    height: 256,
    borderRadius: 128,
    zIndex: -1,
  },
  decorBlur2: {
    position: 'absolute',
    top: -96,
    left: -96,
    width: 256,
    height: 256,
    borderRadius: 128,
    zIndex: -1,
  },

  // ── Navigation ────────────────────────────────────────────
  navRow: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Header ────────────────────────────────────────────────
  headerSection: {
    marginBottom: 28,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 8,
    lineHeight: 24,
  },

  // ── Error banner ──────────────────────────────────────────
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
  },
  errorBannerText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    lineHeight: 20,
  },

  // ── Form ──────────────────────────────────────────────────
  formSection: {
    flex: 1,
  },
  forgotLink: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Divider ───────────────────────────────────────────────
  dividerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 32,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // ── Footer ────────────────────────────────────────────────
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
    gap: 6,
  },
  footerText: {
    fontSize: 15,
    fontWeight: '500',
  },
  footerLink: {
    color: PRIMARY,
    fontSize: 15,
    fontWeight: '800',
  },

  // ── Terms (signup only) ───────────────────────────────────
  termsText: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 32,
    lineHeight: 16,
    fontWeight: '500',
  },

  // ── Signup success ────────────────────────────────────────
  successContent: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(46, 204, 112, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 10,
    textAlign: 'center',
  },
  emailHighlight: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
  },
});
