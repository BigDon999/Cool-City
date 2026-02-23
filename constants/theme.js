import { Platform } from 'react-native';

export const theme = {
  // Brand Colors
  primary: '#2ecc70',
  secondary: '#3498db',
  
  // Backgrounds
  backgroundLight: '#f6f8f7',
  backgroundDark: '#131f18',
  
  // Text
  textDark: '#0f172a',
  textLight: '#f1f5f9',
  subtextDark: '#64748b',
  subtextLight: '#94a3b8',
  
  // Cards & Surfaces
  cardBgLight: '#ffffff',
  cardBgDark: '#1e293b',
  borderColorLight: 'rgba(0,0,0,0.05)',
  borderColorDark: 'rgba(255,255,255,0.1)',
  
  // Status & Risks
  riskLow: '#2ecc70',
  riskMedium: '#f1c40f',
  riskHigh: '#e74c3c',
  riskExtreme: '#8e44ad',
  
  // Map Overlays
  mapOverlayRed: 'rgba(231, 76, 60, 0.5)',
  mapOverlayOrange: 'rgba(243, 156, 18, 0.45)',
  mapOverlayGreen: 'rgba(46, 204, 112, 0.35)',
};

export const Colors = {
  light: {
    text: '#0f172a',
    background: '#f6f8f7',
    icon: '#64748b',
    tabIconDefault: '#64748b',
    tabIconSelected: '#2ecc70',
  },
  dark: {
    text: '#f1f5f9',
    background: '#131f18',
    icon: '#94a3b8',
    tabIconDefault: '#94a3b8',
    tabIconSelected: '#2ecc70',
  },
};

export const Fonts = {
  rounded: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  mono: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
};

export const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#121b14" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#8ec3b9" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#121b14" }] },
  { "featureBy": "administrative", "elementType": "geometry", "stylers": [{ "color": "#2c4033" }] },
  { "featureType": "administrative.country", "elementType": "geometry.stroke", "stylers": [{ "color": "#3c5c48" }] },
  { "featureType": "administrative.land_parcel", "stylers": [{ "visibility": "off" }] },
  { "featureType": "administrative.province", "elementType": "geometry.stroke", "stylers": [{ "color": "#3c5c48" }] },
  { "featureType": "landscape.man_made", "elementType": "geometry.stroke", "stylers": [{ "color": "#233328" }] },
  { "featureType": "landscape.natural", "elementType": "geometry", "stylers": [{ "color": "#1a261d" }] },
  { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#1a261d" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#6f9b84" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#16251c" }] },
  { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#6b9a76" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#233328" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#8a9a8d" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#2c4033" }] },
  { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#1e2e25" }] },
  { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#c1cfc5" }] },
  { "featureType": "transit", "elementType": "geometry", "stylers": [{ "color": "#233328" }] },
  { "featureType": "transit.station", "elementType": "labels.text.fill", "stylers": [{ "color": "#6f9b84" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#0d130f" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#3c5c48" }] }
];