import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useColorScheme } from '../hooks/use-color-scheme';
import { requestNotificationPermission } from '../utils/notifications';

const { width, height } = Dimensions.get('window');
const PRIMARY = '#2ecc70';

/**
 * PERMISSION PROMPT CARD
 * 
 * A reusable, beautiful overlay card that explains WHY a permission
 * is needed before actually requesting it. This follows Google's
 * best practice of showing a "pre-permission" rationale screen.
 * 
 * Usage:
 *   <PermissionPrompt
 *     type="location"        // 'location' | 'notification'
 *     visible={showPrompt}
 *     onGranted={() => { ... }}
 *     onDismiss={() => setShowPrompt(false)}
 *   />
 */
export default function PermissionPrompt({ type = 'location', visible, onGranted, onDismiss }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible]);

  const config = type === 'location' ? {
    icon: 'my-location',
    iconColor: '#3b82f6',
    iconBg: isDark ? 'rgba(59, 130, 246, 0.15)' : '#dbeafe',
    title: 'Enable Location',
    subtitle: 'Get accurate heat risk data for your area',
    description: 'CoolCity needs your location to show real-time temperature, heat index, and nearby cooling centers specific to where you are.',
    features: [
      { icon: 'device-thermostat', text: 'Live heat risk for your neighborhood' },
      { icon: 'map', text: 'Find cooling centers near you' },
      { icon: 'notifications-active', text: 'Area-specific heat alerts' },
    ],
    buttonText: 'Enable Location',
    privacyNote: 'Your location is never shared or stored on our servers.',
  } : {
    icon: 'notifications-active',
    iconColor: '#8b5cf6',
    iconBg: isDark ? 'rgba(139, 92, 246, 0.15)' : '#ede9fe',
    title: 'Stay Protected',
    subtitle: 'Get critical heat alerts when it matters',
    description: 'CoolCity sends push notifications when dangerous heat conditions are detected in your area so you can take action before it\'s too late.',
    features: [
      { icon: 'warning', text: 'Extreme heat warnings' },
      { icon: 'schedule', text: 'Timely safety reminders' },
      { icon: 'health-and-safety', text: 'Protection for vulnerable groups' },
    ],
    buttonText: 'Enable Notifications',
    privacyNote: 'You can disable notifications anytime from Settings.',
  };

  const handleGrant = useCallback(async () => {
    try {
      if (type === 'location') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          onGranted?.();
        } else {
          // User denied — show instructions to enable from settings
          Alert.alert(
            'Permission Required',
            'Location access was denied. You can enable it from your device Settings.',
            [
              { text: 'Cancel', style: 'cancel', onPress: onDismiss },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
        }
      } else if (type === 'notification') {
        const granted = await requestNotificationPermission();
        if (granted) {
          onGranted?.();
        } else {
          Alert.alert(
            'Notifications Disabled',
            'You can enable notifications later from your device Settings.',
            [
              { text: 'OK', onPress: onDismiss },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
        }
      }
    } catch (err) {
      console.error('Permission request failed:', err);
      onDismiss?.();
    }
  }, [type, onGranted, onDismiss]);

  if (!visible) return null;

  const bg = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subtextColor = isDark ? '#94a3b8' : '#64748b';
  const featureBg = isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0';

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: bg,
            borderColor,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Close button */}
        <TouchableOpacity style={styles.closeButton} onPress={onDismiss} activeOpacity={0.7}>
          <MaterialIcons name="close" size={20} color={subtextColor} />
        </TouchableOpacity>

        {/* Icon */}
        <View style={[styles.iconCircle, { backgroundColor: config.iconBg }]}>
          <MaterialIcons name={config.icon} size={32} color={config.iconColor} />
        </View>

        {/* Titles */}
        <Text style={[styles.title, { color: textColor }]}>{config.title}</Text>
        <Text style={[styles.subtitle, { color: config.iconColor }]}>{config.subtitle}</Text>
        <Text style={[styles.description, { color: subtextColor }]}>{config.description}</Text>

        {/* Feature List */}
        <View style={[styles.featureList, { backgroundColor: featureBg, borderColor }]}>
          {config.features.map((feature, i) => (
            <View key={i} style={[styles.featureRow, i < config.features.length - 1 && { borderBottomWidth: 1, borderBottomColor: borderColor }]}>
              <View style={[styles.featureIconBg, { backgroundColor: config.iconBg }]}>
                <MaterialIcons name={feature.icon} size={16} color={config.iconColor} />
              </View>
              <Text style={[styles.featureText, { color: textColor }]}>{feature.text}</Text>
            </View>
          ))}
        </View>

        {/* Privacy Note */}
        <View style={styles.privacyRow}>
          <MaterialIcons name="privacy-tip" size={14} color={subtextColor} />
          <Text style={[styles.privacyText, { color: subtextColor }]}>{config.privacyNote}</Text>
        </View>

        {/* Buttons */}
        <TouchableOpacity
          style={[styles.grantButton, { backgroundColor: config.iconColor }]}
          onPress={handleGrant}
          activeOpacity={0.85}
        >
          <MaterialIcons name={config.icon} size={20} color="#fff" />
          <Text style={styles.grantButtonText}>{config.buttonText}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={onDismiss}
          activeOpacity={0.7}
        >
          <Text style={[styles.skipText, { color: subtextColor }]}>Maybe Later</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    ...Platform.select({
      android: { elevation: 24 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
    }),
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  featureList: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  featureIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  privacyText: {
    fontSize: 11,
    fontWeight: '500',
  },
  grantButton: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
    ...Platform.select({
      android: { elevation: 4 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
    }),
  },
  grantButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  skipButton: {
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
