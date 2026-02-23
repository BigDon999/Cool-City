import React from 'react';
import { View, Text, StyleSheet, Platform, SafeAreaView } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useWeather } from '../hooks/useWeather';

const OfflineNotice = () => {
  const netInfo = useNetInfo();
  const { lastUpdated } = useWeather();

  // Show only if we explicitly know we are offline
  const isOffline = netInfo.isConnected === false;

  if (isOffline) {
    return (
      <Animated.View 
        entering={FadeInUp}
        exiting={FadeOutUp}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.content}>
            <MaterialCommunityIcons name="wifi-off" size={20} color="white" />
            <View style={styles.textContainer}>
              <Text style={styles.offlineText}>
                No Internet Connection.
              </Text>
              {lastUpdated && lastUpdated !== 'Cached' && (
                <Text style={styles.lastUpdatedText}>
                  Last synced: {lastUpdated}
                </Text>
              )}
            </View>
          </View>
        </SafeAreaView>
      </Animated.View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ef4444', // colors.danger from design
    width: '100%',
    position: 'absolute',
    top: 0,
    zIndex: 10000,
    elevation: 10,
  },
  safeArea: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 12, // Adjust for status bar on Android
  },
  textContainer: {
    flexDirection: 'column',
    marginLeft: 10,
  },
  offlineText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
  },
  lastUpdatedText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    fontWeight: '400',
    marginTop: 1,
  },
});

export default OfflineNotice;
