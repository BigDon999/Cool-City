import React from 'react';
import MapView, { Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from 'react-native-maps';
import { StyleSheet, View, Text, Platform } from 'react-native';

export default function NativeMap({ location, riskColor }) {
  if (!location || !location.coords) {
    return (
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#888' }}>Map Unavailable</Text>
      </View>
    );
  }

  return (
    <MapView
      style={StyleSheet.absoluteFillObject}
      initialRegion={{
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }}
      region={{
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }}
      scrollEnabled={false}
      zoomEnabled={false}
      pitchEnabled={false}
      rotateEnabled={false}
      liteMode={true} // Valid for Android - renders static bitmap for lists/cards
    >
      <Marker coordinate={location.coords} pinColor={riskColor} />
    </MapView>
  );
}
