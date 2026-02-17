import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { BlurView } from 'expo-blur';
import { StyleSheet, ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import AuthScreen from '@/components/AuthScreen';
import VerifyEmailScreen from '@/components/VerifyEmailScreen';
import { theme as globalTheme } from '@/constants/theme';

export default function TabLayout() {
  const { session, isVerified, loading } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#0f172a' : '#f8fafc' }}>
        <ActivityIndicator size="large" color={globalTheme.primary} />
      </View>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (!isVerified) {
    return <VerifyEmailScreen />;
  }

  const theme = {
    primary: '#2ecc70',
    inactive: '#94a3b8',
    bgLight: 'rgba(255, 255, 255, 0.8)',
    bgDark: 'rgba(15, 23, 42, 0.8)',
    borderLight: '#e2e8f0',
    borderDark: '#1e293b',
  };

  const backgroundColor = isDark ? theme.bgDark : theme.bgLight;
  const borderColor = isDark ? theme.borderDark : theme.borderLight;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.inactive,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 0,
          height: 80, // h-20
          backgroundColor: 'transparent',
          borderTopWidth: 0,
        },
        tabBarBackground: () => (
          <BlurView
            intensity={20}
            style={[
              StyleSheet.absoluteFill,
              { 
                backgroundColor: backgroundColor,
                borderTopWidth: 1,
                borderTopColor: borderColor,
              },
            ]}
          />
        ),
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: 'bold',
          textTransform: 'uppercase',
          marginTop: -5,
          marginBottom: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <MaterialIcons name="home" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color }) => <MaterialIcons name="map" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color }) => <MaterialIcons name="warning" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <MaterialIcons name="settings" size={24} color={color} />,
        }}
      />
      {/* Hide explore if user doesn't want it anymore, or repurpose */}
      <Tabs.Screen
        name="explore"
        options={{
          href: null, // This hides the tab button
        }}
      />
    </Tabs>
  );
}