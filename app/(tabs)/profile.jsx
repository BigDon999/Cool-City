import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Switch,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Linking,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../../context/AuthContext';
import { useWeather } from '../../hooks/useWeather';
import AuthScreen from '../../components/AuthScreen';
import VerifyEmailScreen from '../../components/VerifyEmailScreen';
import { theme } from '../../constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from '../../hooks/use-color-scheme';
import { requestNotificationPermission } from '../../utils/notifications';

const PRIMARY = '#2ecc70';

export default function ProfileScreen() {
  const {
    session,
    user,
    profile,
    logout,
    updateProfile,
    deleteAccount,
    isVerified,
    authLoading,
    uploadAvatar,
    updatePassword,
  } = useAuth();
  const { isVulnerable, setIsVulnerable } = useWeather();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // ─── Edit state ─────────────────────────────────────────────
  const [editUsername, setEditUsername] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(true);

  // ─── Password Change State ──────────────────────────────────
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');

  // ─── Load Preferences ───────────────────────────────────────
  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const [notif, loc] = await Promise.all([
          SecureStore.getItemAsync('notificationsEnabled'),
          SecureStore.getItemAsync('locationEnabled')
        ]);
        
        if (notif !== null) setNotificationsEnabled(notif === 'true');
        if (loc !== null) setLocationEnabled(loc === 'true');
      } catch (e) {
        console.warn('Failed to load prefs');
      }
    };
    loadPrefs();
  }, []);

  // ─── Notification toggle handler ─────────────────────────────
  const handleNotificationToggle = useCallback(async (value) => {
    if (value) {
      // User wants to ENABLE notifications → request permission
      const granted = await requestNotificationPermission();
      if (granted) {
        setNotificationsEnabled(true);
        await SecureStore.setItemAsync('notificationsEnabled', 'true');
      } else {
        // Permission denied — guide user to Settings
        Alert.alert(
          'Notifications Blocked',
          'To receive heat safety alerts, please enable notifications in your device Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
    } else {
      setNotificationsEnabled(false);
      await SecureStore.setItemAsync('notificationsEnabled', 'false');
    }
  }, []);

  const toggleLocation = useCallback(async (val) => {
    setLocationEnabled(val);
    await SecureStore.setItemAsync('locationEnabled', val.toString());
  }, []);

  const handleChangePassword = useCallback(async () => {
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
  }, [newPassword, confirmPassword, updatePassword]);

  // ─── Auth gating ────────────────────────────────────────────
  if (!session) return <AuthScreen />;
  if (!isVerified) return <VerifyEmailScreen />;

  // ─── Derived values ─────────────────────────────────────────
  const displayName = profile?.username || user?.email?.split('@')[0] || 'User';
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const userEmail = user?.email || '';
  const joinDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : '';

  // ─── Colors ─────────────────────────────────────────────────
  const bg = isDark ? '#131f18' : '#f6f8f7';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subtextColor = isDark ? '#94a3b8' : '#64748b';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const inputBg = isDark ? '#1e293b' : '#ffffff';
  const inputBgReadonly = isDark ? '#0f172a' : '#f8fafc';
  const borderColor = isDark ? '#1e293b' : '#e2e8f0';
  const headerBg = isDark ? 'rgba(19, 31, 24, 0.8)' : 'rgba(246, 248, 247, 0.8)';

  // ─── Start editing ──────────────────────────────────────────
  const startEditing = useCallback(() => {
    setEditUsername(profile?.username || displayName);
    setEditError('');
    setEditSuccess('');
    setIsEditing(true);
  }, [profile, displayName]);

  // ─── Save profile ──────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setEditError('');
    setEditSuccess('');

    if (!editUsername.trim()) {
      setEditError('Username cannot be empty');
      return;
    }

    const result = await updateProfile({ username: editUsername.trim() });
    if (result.error) {
      setEditError(result.error);
    } else {
      setEditSuccess('Saved!');
      setIsEditing(false);
      setTimeout(() => setEditSuccess(''), 2000);
    }
  }, [editUsername, updateProfile]);

  // ─── Logout ─────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    const result = await logout();
    if (result.error) {
      Alert.alert('Error', result.error);
    }
  }, [logout]);

  // ─── Pick Image ──────────────────────────────────────────
  const pickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uploadResult = await uploadAvatar(result.assets[0].uri);
        if (uploadResult.error) {
          setEditError(uploadResult.error);
        } else {
          setEditSuccess('Avatar updated!');
          setTimeout(() => setEditSuccess(''), 2000);
        }
      }
    } catch (error) {
      setEditError('Failed to pick image');
    }
  }, [uploadAvatar]);

  // ─── Delete account ─────────────────────────────────────────
  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'This action is permanent. All your data will be deleted. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteAccount();
            if (result.error) {
              Alert.alert('Error', result.error);
            }
          },
        },
      ]
    );
  }, [deleteAccount]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top']}>
      {/* ─── Sticky Header ──────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: borderColor }]}>
        <View style={{ width: 60 }} />
        <Text style={[styles.headerTitle, { color: textColor }]}>Profile Settings</Text>
        {isEditing ? (
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={authLoading}
          >
            {authLoading ? (
              <ActivityIndicator size="small" color={PRIMARY} />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.saveButton} onPress={startEditing}>
            <Text style={styles.saveButtonText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ─── Avatar Section ─────────────────────────────── */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarOuter}>
              <View style={styles.avatarInner}>
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>{avatarLetter}</Text>
                )}
              </View>

              {/* Camera button */}
              <TouchableOpacity
                style={[styles.cameraButton, { borderColor: bg }]}
                onPress={pickImage}
                activeOpacity={0.8}
                disabled={authLoading}
              >
                {authLoading ? (
                  <ActivityIndicator size="small" color="#131f18" />
                ) : (
                  <MaterialIcons name="photo-camera" size={18} color="#131f18" />
                )}
              </TouchableOpacity>
            </View>

            <Text style={[styles.profileName, { color: textColor }]}>{displayName}</Text>
            {joinDate ? (
              <Text style={[styles.profileJoined, { color: subtextColor }]}>
                Joined {joinDate}
              </Text>
            ) : null}
          </View>

          {/* ─── Success/Error Feedback ─────────────────────── */}
          {editSuccess ? (
            <View style={styles.successBanner}>
              <MaterialIcons name="check-circle" size={16} color={PRIMARY} />
              <Text style={styles.successBannerText}>{editSuccess}</Text>
            </View>
          ) : null}
          {editError ? (
            <View style={styles.errorBanner}>
              <MaterialIcons name="error-outline" size={16} color="#ef4444" />
              <Text style={styles.errorBannerText}>{editError}</Text>
            </View>
          ) : null}

          {/* ─── Personal Details ───────────────────────────── */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: isDark ? '#475569' : '#94a3b8' }]}>
              Personal Details
            </Text>

            {/* Username input */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: isDark ? '#94a3b8' : '#475569' }]}>
                Username
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: inputBg,
                    borderColor: isEditing ? PRIMARY : borderColor,
                  },
                ]}
              >
                <MaterialIcons name="person" size={22} color="#94a3b8" style={styles.inputIcon} />
                {isEditing ? (
                  <TextInput
                    style={[styles.input, { color: textColor }]}
                    value={editUsername}
                    onChangeText={(t) => {
                      setEditUsername(t);
                      setEditError('');
                    }}
                    placeholder="Enter username"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="none"
                  />
                ) : (
                  <Text style={[styles.inputValue, { color: textColor }]}>{displayName}</Text>
                )}
              </View>
            </View>

            {/* Email input (read-only) */}
            <View style={[styles.fieldGroup, { opacity: 0.7 }]}>
              <Text style={[styles.fieldLabel, { color: isDark ? '#94a3b8' : '#475569' }]}>
                Email Address
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: inputBgReadonly,
                    borderColor,
                  },
                ]}
              >
                <MaterialIcons name="mail" size={22} color="#94a3b8" style={styles.inputIcon} />
                <Text
                  style={[styles.inputValue, { color: subtextColor, flex: 1 }]}
                  numberOfLines={1}
                >
                  {userEmail}
                </Text>
                <MaterialIcons name="lock" size={16} color="#94a3b8" style={{ marginLeft: 8 }} />
              </View>
            </View>
          </View>

          {/* ─── Divider ────────────────────────────────────── */}
          <View style={[styles.divider, { backgroundColor: borderColor }]} />

          {/* ─── Preferences Section ───────────────────────── */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: isDark ? '#475569' : '#94a3b8' }]}>
              Preferences
            </Text>

            <View
              style={[
                styles.toggleCard,
                { backgroundColor: cardBg, borderColor },
              ]}
            >
            {/* Notifications toggle */}
            <View style={[styles.toggleRow, { borderBottomColor: borderColor }]}>
              <View style={styles.toggleLeft}>
                <View style={[styles.toggleIconBg, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#dbeafe' }]}>
                  <MaterialIcons name="notifications" size={22} color={isDark ? '#60a5fa' : '#2563eb'} />
                </View>
                <View>
                  <Text style={[styles.toggleTitle, { color: textColor }]}>Notifications</Text>
                  <Text style={[styles.toggleDesc, { color: subtextColor }]}>
                    Push & Email alerts
                  </Text>
                </View>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={handleNotificationToggle}
                trackColor={{ false: isDark ? '#334155' : '#cbd5e1', true: PRIMARY }}
                thumbColor="#fff"
              />
            </View>

              {/* Vulnerable Mode toggle */}
              <View style={styles.toggleRow}>
                <View style={styles.toggleLeft}>
                  <View style={[styles.toggleIconBg, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fee2e2' }]}>
                    <MaterialIcons name="escalator-warning" size={22} color={isDark ? '#f87171' : '#dc2626'} />
                  </View>
                  <View>
                    <Text style={[styles.toggleTitle, { color: textColor }]}>Vulnerable Mode</Text>
                    <Text style={[styles.toggleDesc, { color: subtextColor }]}>
                      Extra heat warnings
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isVulnerable}
                  onValueChange={setIsVulnerable}
                  trackColor={{ false: isDark ? '#334155' : '#cbd5e1', true: '#ef4444' }}
                  thumbColor="#fff"
                />
              </View>

              {/* Location toggle */}
              <View style={[styles.toggleRow, { borderTopColor: borderColor, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <View style={styles.toggleLeft}>
                  <View style={[styles.toggleIconBg, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#dcfce7' }]}>
                    <MaterialIcons name="location-on" size={22} color={isDark ? '#4ade80' : '#16a34a'} />
                  </View>
                  <View>
                    <Text style={[styles.toggleTitle, { color: textColor }]}>Location Services</Text>
                    <Text style={[styles.toggleDesc, { color: subtextColor }]}>
                      Better local alerts
                    </Text>
                  </View>
                </View>
                <Switch
                  value={locationEnabled}
                  onValueChange={toggleLocation}
                  trackColor={{ false: isDark ? '#334155' : '#cbd5e1', true: PRIMARY }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          </View>

          {/* ─── Security Section ───────────────────────────── */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: isDark ? '#475569' : '#94a3b8' }]}>
              Security
            </Text>
            <TouchableOpacity 
              style={[styles.fieldGroup, styles.actionCard, { backgroundColor: cardBg, borderColor }]}
              onPress={() => setShowPasswordModal(true)}
            >
              <View style={styles.inputContainer}>
                <MaterialIcons name="lock" size={22} color="#94a3b8" style={styles.inputIcon} />
                <Text style={[styles.inputValue, { color: textColor }]}>Change Password</Text>
                <MaterialIcons name="chevron-right" size={22} color="#94a3b8" style={{marginLeft: 'auto'}} />
              </View>
            </TouchableOpacity>
          </View>

          {/* ─── Danger Zone ────────────────────────────────── */}
          <View style={styles.dangerSection}>
            {/* Logout Button */}
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              activeOpacity={0.85}
            >
              <MaterialIcons name="logout" size={22} color="#131f18" />
              <Text style={styles.logoutButtonText}>Log Out</Text>
            </TouchableOpacity>

            {/* Delete Account */}
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDeleteAccount}
              activeOpacity={0.7}
            >
              <Text style={styles.deleteButtonText}>Delete Account</Text>
            </TouchableOpacity>

            {/* Version */}
            <Text style={[styles.versionText, { color: isDark ? '#334155' : '#94a3b8' }]}>
              VERSION {profile?.version || '1.0.0'}
            </Text>
          </View>
        </ScrollView>

        {/* ─── Change Password Modal ───────────────────────── */}
        <Modal
          visible={showPasswordModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowPasswordModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
              <View style={styles.modalHeaderModal}>
                <Text style={[styles.modalTitle, { color: textColor }]}>Change Password</Text>
                <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                  <MaterialIcons name="close" size={24} color={subtextColor} />
                </TouchableOpacity>
              </View>
              
              <Text style={[styles.modalSub, { color: subtextColor }]}>
                Password must be at least 8 characters with 1 uppercase letter and 1 number.
              </Text>

              <View style={styles.inputContainerModal}>
                <Text style={[styles.inputLabelModal, { color: subtextColor }]}>NEW PASSWORD</Text>
                <View style={[styles.inputWrapperModal, { borderColor: borderColor, backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
                  <MaterialIcons name="lock-outline" size={20} color={PRIMARY} style={styles.inputIconModal} />
                  <TextInput
                    style={[styles.inputModal, { color: textColor }]}
                    placeholder="••••••••"
                    placeholderTextColor={subtextColor}
                    secureTextEntry
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                </View>
              </View>

              <View style={styles.inputContainerModal}>
                <Text style={[styles.inputLabelModal, { color: subtextColor }]}>CONFIRM NEW PASSWORD</Text>
                <View style={[styles.inputWrapperModal, { borderColor: borderColor, backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
                  <MaterialIcons name="lock-clock" size={20} color={PRIMARY} style={styles.inputIconModal} />
                  <TextInput
                    style={[styles.inputModal, { color: textColor }]}
                    placeholder="••••••••"
                    placeholderTextColor={subtextColor}
                    secureTextEntry
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                </View>
              </View>

              {pwError ? <Text style={styles.errorTextModal}>{pwError}</Text> : null}

              <TouchableOpacity 
                style={[styles.primaryButtonModal, { backgroundColor: PRIMARY }]}
                onPress={handleChangePassword}
                disabled={authLoading}
              >
                {authLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonTextModal}>SAVE PASSWORD</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ── Header ────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  saveButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonText: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: '700',
  },

  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 120,
  },

  // ── Avatar Section ────────────────────────────────────────
  avatarSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  avatarOuter: {
    position: 'relative',
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 4,
    borderColor: 'rgba(46, 204, 112, 0.2)',
    padding: 4,
    marginBottom: 16,
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarText: {
    fontSize: 48,
    color: '#fff',
    fontWeight: '800',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    ...(Platform.OS === 'android'
      ? { elevation: 4 }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
        }),
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  profileJoined: {
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
  },

  // ── Feedback banners ──────────────────────────────────────
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(46, 204, 112, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 112, 0.2)',
    marginBottom: 20,
  },
  successBannerText: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: '600',
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
  errorBannerText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Section ───────────────────────────────────────────────
  section: {
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 16,
    marginLeft: 4,
  },
  divider: {
    height: 1,
    marginVertical: 28,
  },

  // ── Input fields ──────────────────────────────────────────
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    height: '100%',
  },
  inputValue: {
    fontSize: 16,
    fontWeight: '500',
  },

  // ── Toggle card ───────────────────────────────────────────
  toggleCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  toggleIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  toggleDesc: {
    fontSize: 12,
    marginTop: 2,
  },

  // ── Danger Zone ───────────────────────────────────────────
  dangerSection: {
    marginTop: 40,
    alignItems: 'center',
  },
  logoutButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    backgroundColor: PRIMARY,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...(Platform.OS === 'android'
      ? { elevation: 6 }
      : {
          shadowColor: PRIMARY,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.2,
          shadowRadius: 12,
        }),
  },
  logoutButtonText: {
    color: '#131f18',
    fontSize: 17,
    fontWeight: '800',
  },
  deleteButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  deleteButtonText: {
    color: 'rgba(239, 68, 68, 0.8)',
    fontSize: 14,
    fontWeight: '600',
  },
  versionText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 12,
  },

  // ── Modal Styles ──────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    borderRadius: 28,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeaderModal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  modalSub: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 24,
    fontWeight: '500',
  },
  inputContainerModal: {
    marginBottom: 16,
  },
  inputLabelModal: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapperModal: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  inputIconModal: {
    marginRight: 12,
  },
  inputModal: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    fontWeight: '600',
  },
  errorTextModal: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  primaryButtonModal: {
    height: 60,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryButtonTextModal: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  actionCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
