import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { PASSWORD_RULES, getPasswordStrength } from '../../utils/validators';
import { useColorScheme } from '../../hooks/use-color-scheme';

const PRIMARY = '#2ecc70';

/**
 * Password strength indicator with progress bar + percentage (signup style).
 * Shows a smooth animated bar, strength label, and helpful hint text.
 */
export default function PasswordStrengthIndicator({ password }) {
  const colorScheme = useColorScheme();
  if (!password) return null;

  const isDark = colorScheme === 'dark';
  const { score, label, color } = getPasswordStrength(password);

  // Convert score (0-4) to percentage
  const percentage = Math.round((score / 4) * 100);

  // Hint text based on score
  const getHint = () => {
    if (score <= 1) return 'Use 8+ characters with a mix of letters, numbers and symbols.';
    if (score === 2) return 'Getting there! Add uppercase letters or symbols for extra security.';
    if (score === 3) return 'Great choice! Add a special character to make it even stronger.';
    return 'Excellent! Your password is strong and secure.';
  };

  return (
    <View style={[styles.container, { marginTop: -4, marginBottom: 12 }]}>
      {/* Label + percentage row */}
      <View style={styles.headerRow}>
        <Text style={[styles.strengthLabel, { color }]}>{label || 'Too Short'}</Text>
        <Text style={[styles.percentage, { color: isDark ? '#64748b' : '#94a3b8' }]}>
          {percentage}%
        </Text>
      </View>

      {/* Progress bar */}
      <View style={[styles.barTrack, {
        backgroundColor: isDark ? '#1e293b' : '#e2e8f0',
      }]}>
        <View
          style={[
            styles.barFill,
            {
              backgroundColor: color,
              width: `${percentage}%`,
            },
          ]}
        />
      </View>

      {/* Hint text */}
      <Text style={[styles.hint, {
        color: isDark ? '#64748b' : '#94a3b8',
      }]}>
        {getHint()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  percentage: {
    fontSize: 12,
    fontWeight: '600',
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  hint: {
    fontSize: 11,
    marginTop: 6,
    lineHeight: 16,
    fontWeight: '500',
  },
});
