import React, { useState } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, Switch, ScrollView, StatusBar, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWeather } from '@/hooks/useWeather';
import * as SecureStore from 'expo-secure-store';
import { theme } from '@/constants/theme';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const { isVulnerable, setIsVulnerable } = useWeather();
  const [notifications, setNotifications] = useState(true);
  const [location, setLocation] = useState(true);
  const [darkMode, setDarkMode] = useState(isDark);

  // Load Notification Preference
  React.useEffect(() => {
    SecureStore.getItemAsync('notificationsEnabled').then(val => {
      if (val !== null) setNotifications(val === 'true');
    });
  }, []);

  const toggleNotifications = async (val) => {
    setNotifications(val);
    await SecureStore.setItemAsync('notificationsEnabled', val.toString());
  };

  const backgroundColor = isDark ? theme.backgroundDark : theme.backgroundLight;
  const textColor = isDark ? theme.textLight : theme.textDark;
  const subtextColor = isDark ? theme.subtextLight : theme.subtextDark;
  const cardBg = isDark ? theme.cardBgDark : theme.cardBgLight;
  const borderColor = isDark ? theme.borderColorDark : theme.borderColorLight;

  const renderSettingItem = (icon, label, value, onValueChange, isSwitch = true) => (
    <View style={[styles.settingItem, { borderBottomColor: borderColor }]}>
      <View style={styles.settingLeft}>
        <View style={[styles.iconContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
          <MaterialIcons name={icon} size={20} color={theme.primary} />
        </View>
        <Text style={[styles.settingLabel, { color: textColor }]}>{label}</Text>
      </View>
      {isSwitch ? (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: '#767577', true: theme.primary + '80' }}
          thumbColor={value ? theme.primary : '#f4f3f4'}
        />
      ) : (
        <MaterialIcons name="chevron-right" size={24} color={subtextColor} />
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {/* Header Background */}
      <View style={styles.headerBgContainer}>
        <LinearGradient
          colors={[theme.primary, theme.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.headerBg, { height: 180 + insets.top }]}
        />
        <View style={[styles.headerCurve, { backgroundColor }]} />
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 60 }]}>
        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: cardBg, boxShadow: isDark ? '0 4px 12px #000' : '0 4px 12px #ccc' }]}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=crop&w=400&q=80' }}
            style={styles.avatar}
          />
          <Text style={[styles.userName, { color: textColor }]}>Citizen Jane</Text>
          <Text style={[styles.userBadge, { color: theme.primary }]}>Level 5 Heat Aware</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: textColor }]}>12</Text>
              <Text style={[styles.statLabel, { color: subtextColor }]}>Reports</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: borderColor }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: textColor }]}>350</Text>
              <Text style={[styles.statLabel, { color: subtextColor }]}>Points</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: borderColor }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: textColor }]}>4.9</Text>
              <Text style={[styles.statLabel, { color: subtextColor }]}>Rating</Text>
            </View>
          </View>
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: subtextColor }]}>PREFERENCES</Text>
          <View style={[styles.settingsCard, { backgroundColor: cardBg }]}>
            {renderSettingItem('notifications', 'Notifications', notifications, toggleNotifications)}
            {renderSettingItem('escalator-warning', 'Vulnerable Mode', isVulnerable, setIsVulnerable)}
            {renderSettingItem('location-on', 'Location Services', location, setLocation)}
            {renderSettingItem('dark-mode', 'Dark Mode', darkMode, setDarkMode)}
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: subtextColor }]}>ACCOUNT</Text>
          <View style={[styles.settingsCard, { backgroundColor: cardBg }]}>
            <TouchableOpacity onPress={() => {}}>
              {renderSettingItem('person', 'Edit Profile', null, null, false)}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {}}>
              {renderSettingItem('lock', 'Change Password', null, null, false)}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {}}>
              {renderSettingItem('help', 'Help & Support', null, null, false)}
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={[styles.logoutButton, { borderColor: theme.riskHigh }]}>
          <MaterialIcons name="logout" size={20} color={theme.riskHigh} />
          <Text style={[styles.logoutText, { color: theme.riskHigh }]}>Log Out</Text>
        </TouchableOpacity>
        
        <Text style={[styles.versionText, { color: subtextColor }]}>Version 1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBgContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
  },
  headerBg: {
    width: '100%',
  },
  headerCurve: {
    height: 30,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -30,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  profileCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    elevation: 4,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#fff',
    marginBottom: 16,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userBadge: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(46, 204, 112, 0.1)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    height: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    paddingHorizontal: 4,
    letterSpacing: 1,
  },
  settingsCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    marginBottom: 24,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
  },
});
