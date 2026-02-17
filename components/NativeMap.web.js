import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function NativeMap({ location, riskColor }) {
  if (!location || !location.coords) return null;
  
  const { latitude, longitude } = location.coords;
  // Use a static OpenStreetMap embed for the mini-map
  const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${longitude-0.01}%2C${latitude-0.01}%2C${longitude+0.01}%2C${latitude+0.01}&layer=mapnik&marker=${latitude}%2C${longitude}`;

  return (
    <View style={StyleSheet.absoluteFill}>
        <iframe
          width="100%"
          height="100%"
          frameBorder="0"
          scrolling="no"
          marginHeight="0"
          marginWidth="0"
          src={osmUrl}
          style={{ border: 0 }}
        />
    </View>
  );
}
