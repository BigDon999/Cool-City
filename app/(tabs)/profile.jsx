import React, { useState } from 'react';
import { StyleSheet, View, Text, Switch, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useWeather } from '@/hooks/useWeather';
import AuthScreen from '@/components/AuthScreen';
import VerifyEmailScreen from '@/components/VerifyEmailScreen';
import { theme } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function ProfileScreen() {
  const { session, user, signOut, isVerified } = useAuth();
  const { isVulnerable, setIsVulnerable, activeCenters } = useWeather();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (!session) {
    return <AuthScreen />;
  }

  if (!isVerified) {
    return <VerifyEmailScreen />;
  }

  // Handle Logout
  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) Alert.alert("Error", error.message);
  };

  const bgColor = isDark ? theme.backgroundDark : theme.backgroundLight;
  const textColor = isDark ? theme.textLight : theme.textDark;
  const cardBg = isDark ? theme.cardBgDark : theme.cardBgLight;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Profile Header */}
        <View style={styles.header}>
            <TouchableOpacity 
              style={styles.topLogoutButton} 
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <MaterialIcons name="logout" size={22} color="#ef4444" />
              <Text style={styles.topLogoutText}>Sign Out</Text>
            </TouchableOpacity>

            <View style={styles.avatar}>
                <Text style={styles.avatarText}>{user?.email?.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={[styles.userName, { color: textColor }]}>{user?.email}</Text>
            <Text style={styles.userRole}>Cool City Resident</Text>
        </View>

        {/* Stats Card */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
            <Text style={[styles.cardTitle, { color: textColor }]}>My Impact</Text>
            <View style={styles.statsRow}>
                <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: theme.primary }]}>{activeCenters}</Text>
                    <Text style={styles.statLabel}>Centers Active</Text>
                </View>
                <View style={[styles.divider, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]} />
                <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: theme.secondary }]}>0</Text>
                    <Text style={styles.statLabel}>Hazards Reported</Text>
                </View>
            </View>
        </View>

        {/* Settings */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preferences</Text>
            
            <View style={[styles.settingRow, { backgroundColor: cardBg }]}>
                <View style={styles.settingInfo}>
                    <MaterialIcons name="escalator-warning" size={24} color={isVulnerable ? "#ef4444" : "#94a3b8"} />
                    <Text style={[styles.settingText, { color: textColor }]}>Vulnerable Mode</Text>
                </View>
                <Switch 
                    value={isVulnerable} 
                    onValueChange={setIsVulnerable}
                    trackColor={{ false: '#767577', true: '#ef4444' }}
                    thumbColor={isVulnerable ? '#fff' : '#f4f3f4'}
                />
            </View>
            
            <View style={[styles.settingRow, { backgroundColor: cardBg }]}>
                <View style={styles.settingInfo}>
                    <MaterialIcons name="notifications-active" size={24} color={theme.primary} />
                    <Text style={[styles.settingText, { color: textColor }]}>Heat Alerts</Text>
                </View>
                <Switch 
                    value={true} 
                    onValueChange={() => {}}
                    trackColor={{ false: '#767577', true: theme.primary }}
                    thumbColor={'#fff'}
                />
            </View>
        </View>

        {/* Actions */}
        <TouchableOpacity 
            style={[styles.actionButton, { borderColor: isDark ? '#334155' : '#e2e8f0' }]}
            onPress={() => Alert.alert("Coming Soon", "Community reporting feature in development.")}
        >
            <MaterialIcons name="report-problem" size={20} color="#e67e22" />
            <Text style={[styles.actionText, { color: textColor }]}>Report Heat Hazard</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 120, // Ensure content isn't hidden by tab bar
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    marginBottom: 16,
    boxShadow: `0 4px 10px ${theme.primary}4D`, // 4D is ~30% opacity
    elevation: 5,
  },
  avatarText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 14,
    color: '#94a3b8',
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  divider: {
    width: 1,
    height: 40,
    marginHorizontal: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  topLogoutButton: {
    position: 'absolute',
    top: -10,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 4,
  },
  topLogoutText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
});
