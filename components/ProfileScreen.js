import React, { useState } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, Switch, ScrollView, StatusBar, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '../hooks/use-color-scheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWeather } from '../hooks/useWeather';
import * as SecureStore from 'expo-secure-store';
import { theme } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { Modal, TextInput, ActivityIndicator, Alert } from 'react-native';
import BubblesBackground from './auth/BubblesBackground';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  const { isVulnerable, setIsVulnerable } = useWeather();
  const { updatePassword, authLoading } = useAuth();
  
  const [notifications, setNotifications] = useState(true);
  const [location, setLocation] = useState(true);
  const [darkMode, setDarkMode] = useState(colorScheme === 'dark');

  // Compute local dark mode - defaults to system, but respects user override
  const isDark = darkMode;
  
  // Password Change State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');

  // Load Preferences on mount
  React.useEffect(() => {
    const loadPrefs = async () => {
      const [notif, loc, dark] = await Promise.all([
        SecureStore.getItemAsync('notificationsEnabled'),
        SecureStore.getItemAsync('locationEnabled'),
        SecureStore.getItemAsync('userDarkMode')
      ]);
      
      if (notif !== null) setNotifications(notif === 'true');
      if (loc !== null) setLocation(loc === 'true');
      if (dark !== null) setDarkMode(dark === 'true');
    };
    loadPrefs();
  }, []);

  const toggleNotifications = async (val) => {
    setNotifications(val);
    await SecureStore.setItemAsync('notificationsEnabled', val.toString());
  };

  const toggleLocation = async (val) => {
    setLocation(val);
    await SecureStore.setItemAsync('locationEnabled', val.toString());
  };

  const toggleDarkMode = async (val) => {
    setDarkMode(val);
    await SecureStore.setItemAsync('userDarkMode', val.toString());
  };

  const handleChangePassword = async () => {
    setPwError('');
    if (!newPassword || !confirmPassword) {
      setPwError('Please fill in all fields');
      return;
    }
    
    const result = await updatePassword(newPassword, confirmPassword);
    if (result?.error) {
      setPwError(result.error);
    } else {
      Alert.alert('Success', 'Your password has been updated.');
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
    }
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
            {renderSettingItem('brightness-6', 'Dark Mode', darkMode, toggleDarkMode)}
            {renderSettingItem('notifications', 'Notifications', notifications, toggleNotifications)}
            {renderSettingItem('escalator-warning', 'Vulnerable Mode', isVulnerable, setIsVulnerable)}
            {renderSettingItem('location-on', 'Location Services', location, toggleLocation)}
          </View>
        </View>

        {/* Change Password Modal */}
        <Modal
          visible={showPasswordModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowPasswordModal(false)}
        >
          <View style={styles.modalOverlay}>
             <BubblesBackground color={theme.primary} />
             <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: textColor }]}>Change Password</Text>
                <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                  <MaterialIcons name="close" size={24} color={subtextColor} />
                </TouchableOpacity>
              </View>
              
              <Text style={[styles.modalSub, { color: subtextColor }]}>
                Password must be at least 8 characters with 1 uppercase letter and 1 number.
              </Text>

              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, { color: subtextColor }]}>NEW PASSWORD</Text>
                <View style={[styles.inputWrapper, { borderColor: borderColor, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc' }]}>
                  <MaterialIcons name="lock-outline" size={20} color={theme.primary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: textColor }]}
                    placeholder="••••••••"
                    placeholderTextColor={subtextColor}
                    secureTextEntry
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, { color: subtextColor }]}>CONFIRM NEW PASSWORD</Text>
                <View style={[styles.inputWrapper, { borderColor: borderColor, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc' }]}>
                  <MaterialIcons name="lock-clock" size={20} color={theme.primary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: textColor }]}
                    placeholder="••••••••"
                    placeholderTextColor={subtextColor}
                    secureTextEntry
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                </View>
              </View>

              {pwError ? <Text style={styles.errorText}>{pwError}</Text> : null}

              <TouchableOpacity 
                style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                onPress={handleChangePassword}
                disabled={authLoading}
              >
                {authLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>SAVE PASSWORD</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: subtextColor }]}>ACCOUNT</Text>
          <View style={[styles.settingsCard, { backgroundColor: cardBg }]}>
            <TouchableOpacity onPress={() => {}}>
              {renderSettingItem('person', 'Edit Profile', null, null, false)}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowPasswordModal(true)}>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalSub: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    fontWeight: '500',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  primaryButton: {
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    boxShadow: '0 4px 12px rgba(46, 204, 112, 0.3)',
    elevation: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
