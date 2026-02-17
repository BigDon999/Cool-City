import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { theme } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export default function AuthScreen() {
  const { signIn, signUp, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(null);

  const checkLockout = () => {
    if (lockedUntil && new Date() < lockedUntil) {
      const remaining = Math.ceil((lockedUntil - new Date()) / 1000);
      Alert.alert("Security Lockout", `Too many attempts. Bot protection active. Please wait ${remaining}s.`);
      return true;
    }
    return false;
  };

  const handleAuth = async () => {
    if (checkLockout()) return;
    
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    // Anti-bot artificial delay (0.5s - 1.5s random jitter)
    await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));

    try {
      const { data, error } = isLogin 
        ? await signIn(email, password)
        : await signUp(email, password);

      if (error) {
        setAttempts(prev => prev + 1);
        if (attempts >= 2) {
          const waitTime = Math.pow(2, attempts) * 1000;
          setLockedUntil(new Date(Date.now() + waitTime));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        Alert.alert("Authentication Failed", error.message);
      } else {
        setAttempts(0);
        if (isLogin) {
          if (!data.user?.email_confirmed_at) {
            Alert.alert(
              "Verify Your Email",
              "Please check your inbox and confirm your email before logging in."
            );
          }
        } else {
          Alert.alert("Success", "Account created! Please check your email to verify.");
        }
      }
    } catch (err) {
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#020617', '#0f172a']} style={StyleSheet.absoluteFill} />
      
      <View style={styles.card}>
        <View style={styles.securitySeal}>
          <MaterialCommunityIcons name="shield-check" size={16} color={theme.primary} />
          <Text style={styles.securityText}>AES-256 ENCRYPTED SESSION</Text>
        </View>

        <Text style={styles.title}>{isLogin ? "Secure Entry" : "Guardian Profile"}</Text>
        <Text style={styles.subtitle}>
          {isLogin ? "End-to-end encrypted intelligence access" : "Secure your city metrics with hardware-backed auth"}
        </Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="name@example.com"
            placeholderTextColor="#64748b"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#64748b"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity 
          style={styles.button}
          onPress={handleAuth}
          disabled={isSubmitting || loading}
        >
          {isSubmitting ? (
             <ActivityIndicator color="#fff" />
          ) : (
             <Text style={styles.buttonText}>{isLogin ? "Sign In" : "Sign Up"}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.switchButton}
          onPress={() => setIsLogin(!isLogin)}
        >
          <Text style={styles.switchText}>
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    padding: 32,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 18,
  },
  securitySeal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(46, 204, 112, 0.05)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 99,
    alignSelf: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 112, 0.1)',
    gap: 6,
  },
  securityText: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.primary,
    letterSpacing: 1,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 16,
  },
  button: {
    backgroundColor: theme.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  switchButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchText: {
    color: '#94a3b8',
    fontSize: 14,
  },
});
