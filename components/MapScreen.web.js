import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Map is not available on web preview.</Text>
      <Text style={styles.subtext}>Please run on Android/iOS simulator or device.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  text: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#334155',
  },
  subtext: {
    marginTop: 8,
    color: '#64748b',
  },
});
