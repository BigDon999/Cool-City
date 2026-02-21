import React from 'react';
import { StyleSheet, TouchableOpacity, Text, ActivityIndicator, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const PRIMARY = '#2ecc70';

/**
 * Pill-shaped auth button with shadow, matching the friendly login design.
 * Primary variant has full green background with green glow shadow.
 */
export default function AuthButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  icon,
  style,
}) {
  const isDisabled = disabled || loading;

  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          bg: 'transparent',
          border: '#d4e8da',
          text: '#64748b',
          borderWidth: 1,
          shadow: false,
        };
      case 'danger':
        return {
          bg: 'transparent',
          border: '#ef4444',
          text: '#ef4444',
          borderWidth: 1,
          shadow: false,
        };
      case 'primary':
      default:
        return {
          bg: PRIMARY,
          border: PRIMARY,
          text: '#fff',
          borderWidth: 0,
          shadow: true,
        };
    }
  };

  const v = getVariantStyles();

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          borderWidth: v.borderWidth,
          opacity: isDisabled ? 0.6 : 1,
          ...(v.shadow && Platform.OS !== 'web'
            ? {
                shadowColor: PRIMARY,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 8,
              }
            : {}),
          ...(v.shadow && Platform.OS === 'web'
            ? { boxShadow: `0 6px 20px rgba(46, 204, 112, 0.3)` }
            : {}),
        },
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <>
          <Text style={[styles.buttonText, { color: v.text }]}>{title}</Text>
          {icon && (
            <MaterialIcons name={icon} size={20} color={v.text} style={{ marginLeft: 6 }} />
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: 9999, // pill shape
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonText: {
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: 0.2,
  },
});
