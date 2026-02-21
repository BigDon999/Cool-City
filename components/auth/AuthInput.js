import React, { useState } from 'react';
import { StyleSheet, View, TextInput, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from '../../hooks/use-color-scheme';

const PRIMARY = '#2ecc70';

/**
 * Auth text input with two visual variants:
 *   - 'card'  → Label inside, rectangular card (login style)
 *   - 'pill'  → Label above, pill-shaped with right icon (signup style)
 */
export default function AuthInput({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  editable = true,
  rightAction,
  inputRef,
  returnKeyType,
  onSubmitEditing,
  variant = 'card',  // 'card' | 'pill'
  icon,              // right-side icon name (pill variant)
}) {
  const [isSecure, setIsSecure] = useState(secureTextEntry);
  const [isFocused, setIsFocused] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const colors = {
    inputBg: isDark ? 'rgba(15, 23, 42, 1)' : '#ffffff',
    border: error
      ? '#ef4444'
      : isFocused
        ? PRIMARY
        : variant === 'pill'
          ? 'transparent'
          : (isDark ? 'rgba(255,255,255,0.08)' : '#d4e8da'),
    labelColor: isFocused ? PRIMARY : (isDark ? '#cbd5e1' : '#475569'),
    textColor: isDark ? '#f1f5f9' : '#0f172a',
    placeholderColor: isDark ? '#475569' : '#94a3b8',
    iconColor: isFocused ? PRIMARY : '#94a3b8',
  };

  // ═══════════════════════════════════════════════════════════════
  //  PILL VARIANT (Signup style)
  // ═══════════════════════════════════════════════════════════════
  if (variant === 'pill') {
    return (
      <View style={pillStyles.container}>
        {/* Label row (above input) */}
        <View style={pillStyles.labelRow}>
          <Text style={[pillStyles.label, { color: colors.labelColor }]}>{label}</Text>
          {rightAction}
        </View>

        {/* Pill input */}
        <View
          style={[
            pillStyles.inputPill,
            {
              backgroundColor: colors.inputBg,
              borderColor: colors.border,
              ...(isDark ? {} : {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 4,
                elevation: 1,
              }),
            },
          ]}
        >
          <TextInput
            ref={inputRef}
            style={[pillStyles.input, { color: colors.textColor }]}
            placeholder={placeholder}
            placeholderTextColor={colors.placeholderColor}
            value={value}
            onChangeText={onChangeText}
            secureTextEntry={isSecure}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            autoCorrect={false}
            editable={editable}
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />

          {/* Eye toggle or static icon */}
          {secureTextEntry ? (
            <TouchableOpacity
              style={pillStyles.iconButton}
              onPress={() => setIsSecure(!isSecure)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons
                name={isSecure ? 'visibility-off' : 'visibility'}
                size={22}
                color={colors.iconColor}
              />
            </TouchableOpacity>
          ) : icon ? (
            <View style={pillStyles.iconButton}>
              <MaterialIcons name={icon} size={22} color={colors.iconColor} />
            </View>
          ) : null}
        </View>

        {/* Inline error */}
        {error ? (
          <View style={pillStyles.errorRow}>
            <MaterialIcons name="error-outline" size={14} color="#ef4444" />
            <Text style={pillStyles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  CARD VARIANT (Login style)
  // ═══════════════════════════════════════════════════════════════
  return (
    <View style={cardStyles.container}>
      <View
        style={[
          cardStyles.inputCard,
          {
            backgroundColor: colors.inputBg,
            borderColor: colors.border,
            ...(isDark ? {} : {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 3,
              elevation: 1,
            }),
          },
        ]}
      >
        {/* Label + optional right action */}
        <View style={cardStyles.labelRow}>
          <Text style={[cardStyles.label, { color: colors.labelColor }]}>{label}</Text>
          {rightAction}
        </View>

        {/* Input + eye toggle */}
        <View style={cardStyles.inputRow}>
          <TextInput
            ref={inputRef}
            style={[cardStyles.input, { color: colors.textColor }]}
            placeholder={placeholder}
            placeholderTextColor={colors.placeholderColor}
            value={value}
            onChangeText={onChangeText}
            secureTextEntry={isSecure}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            autoCorrect={false}
            editable={editable}
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />

          {secureTextEntry && (
            <TouchableOpacity
              style={cardStyles.eyeButton}
              onPress={() => setIsSecure(!isSecure)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons
                name={isSecure ? 'visibility-off' : 'visibility'}
                size={22}
                color={colors.iconColor}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {error ? (
        <View style={cardStyles.errorRow}>
          <MaterialIcons name="error-outline" size={14} color="#ef4444" />
          <Text style={cardStyles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Card variant styles (Login) ────────────────────────────────
const cardStyles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  inputCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
    fontWeight: '500',
  },
  eyeButton: {
    padding: 4,
    marginLeft: 4,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingLeft: 4,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '500',
  },
});

// ─── Pill variant styles (Signup) ───────────────────────────────
const pillStyles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginLeft: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  inputPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 9999,
    borderWidth: 2,
    paddingHorizontal: 24,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    height: '100%',
  },
  iconButton: {
    padding: 4,
    marginLeft: 8,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingLeft: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '500',
  },
});
