import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { StyleSheet } from 'react-native';

export default function NativeMap({ location, riskColor }) {
  if (!location || !location.coords) return null;
  
  return (
    <MapView
      provider={PROVIDER_GOOGLE}
      style={StyleSheet.absoluteFillObject}
      region={{
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }}
      scrollEnabled={false}
      zoomEnabled={false}
    >
      <Marker coordinate={location.coords} pinColor={riskColor} />
    </MapView>
  );
}
