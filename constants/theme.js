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