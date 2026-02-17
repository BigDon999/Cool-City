import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Image, Platform, StatusBar, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import NativeMap from './NativeMap';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useWeather } from '@/hooks/useWeather';
import { theme } from '@/constants/theme';
import ExtremeHeatModal from '@/components/ExtremeHeatModal';

export default function AdviceScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { heatIndex, risk, advice, locationName, refresh, location, tips, isVulnerable, setIsVulnerable } = useWeather();
  const [refreshing, setRefreshing] = useState(false);
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    if (risk === "EXTREME") {
      setShowAlert(true);
    }
  }, [risk]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh().finally(() => {
      // Simulate network delay for better UX
      setTimeout(() => setRefreshing(false), 500);
    });
  }, [refresh]);

  const backgroundColor = isDark ? theme.backgroundDark : theme.backgroundLight;
  const textColor = isDark ? theme.textLight : theme.textDark;
  const subtextColor = isDark ? theme.subtextLight : theme.subtextDark;
  const cardBg = isDark ? theme.cardBgDark : theme.cardBgLight;

  const getRiskColor = () => {
    switch (risk) {
      case "SAFE": return theme.riskLow;
      case "CAUTION": return theme.riskMedium;
      case "DANGER": return theme.riskHigh;
      case "EXTREME": return theme.riskExtreme;
      default: return theme.riskLow;
    }
  };

  const riskColor = getRiskColor();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
       <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.mainContainer}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.alertContainer}>
            <View style={[styles.pulseDot, { backgroundColor: riskColor }]} />
            <Text style={[styles.alertText, { color: riskColor }]}>{risk} HEAT LEVEL</Text>
          </View>
          <Text style={[styles.title, { color: textColor }]}>Stay Cool & Safe</Text>
          <Text style={[styles.subtitle, { color: subtextColor }]}>
            The heat index is currently <Text style={[styles.highlight, { color: riskColor }]}>{heatIndex}°</Text>. Follow these guidelines to stay safe.
          </Text>
          
          <TouchableOpacity 
             style={[styles.modeToggle, { 
                backgroundColor: isVulnerable ? theme.riskHigh : (isDark ? '#1e293b' : '#ffffff'), 
                borderColor: isVulnerable ? theme.riskHigh : (isDark ? '#334155' : '#e2e8f0') 
             }]}
             onPress={() => setIsVulnerable(!isVulnerable)}
             activeOpacity={0.8}
          >
             <View style={styles.modeContent}>
                <View style={[styles.iconBox, { backgroundColor: isVulnerable ? 'rgba(255,255,255,0.2)' : (isDark ? '#334155' : '#f1f5f9') }]}>
                    <MaterialIcons name={isVulnerable ? "escalator-warning" : "person-outline"} size={22} color={isVulnerable ? "#fff" : textColor} />
                </View>
                <View>
                    <Text style={[styles.modeTitle, { color: isVulnerable ? "#fff" : textColor }]}>
                        {isVulnerable ? "Vulnerable Mode" : "Standard Mode"}
                    </Text>
                    <Text style={[styles.modeSubtitle, { color: isVulnerable ? 'rgba(255,255,255,0.8)' : subtextColor }]}>
                        {isVulnerable ? "Protection for elderly & children" : "Standard heat sensitivity"}
                    </Text>
                </View>
             </View>
             
             <View style={[styles.toggleTrack, { backgroundColor: isVulnerable ? 'rgba(255,255,255,0.4)' : (isDark ? '#475569' : '#cbd5e1') }]}>
                <View style={[styles.toggleKnob, { 
                    transform: [{ translateX: isVulnerable ? 18 : 2 }], 
                    backgroundColor: '#fff' 
                }]} />
             </View>
          </TouchableOpacity>
        </View>

        {/* Advice Section */}
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isDark ? "#fff" : "#000"} />
          }
        >
          <View style={styles.cardsContainer}>
            {tips.map((tip, index) => (
              <View key={index} style={[styles.card, { backgroundColor: cardBg, borderColor: theme.primary + '1A' }]}>
                <View style={[styles.iconContainer, { backgroundColor: theme.primary + '1A' }]}>
                  <MaterialIcons name={tip.icon} size={24} color={theme.primary} />
                </View>
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTitle, { color: textColor }]}>{tip.title}</Text>
                  <Text style={[styles.cardText, { color: subtextColor }]}>{tip.text}</Text>
                </View>
              </View>
            ))}

            {/* Local Status Card with Map */}
            <View style={[styles.statusCard, { height: 350 }]}>
              {location ? (
                <NativeMap location={location} riskColor={riskColor} />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{color: '#64748b'}}>Locating...</Text>
                </View>
              )}
              
              <LinearGradient
                colors={['rgba(19, 31, 24, 0.9)', 'transparent']}
                start={{ x: 0, y: 1 }} // Gradient from bottom up to text visibility
                end={{ x: 0, y: 0.4 }}
                style={[StyleSheet.absoluteFillObject, { pointerEvents: "none" }]}
              >
                <View style={{ position: 'absolute', bottom: 20, left: 20, right: 20 }}>
                  <Text style={[styles.statusLabel, { color: riskColor }]}>LIVE CONTEXT</Text>
                  <Text style={styles.statusText}>
                    {locationName}: current status is {risk}. Check the guidelines below.
                  </Text>
                </View>
              </LinearGradient>
            </View>
          </View>
        </ScrollView>

        {/* Sticky Bottom CTA */}
        <View style={styles.stickyFooter}>
          <LinearGradient
            colors={[isDark ? theme.backgroundDark : theme.backgroundLight, 'transparent']}
            start={{ x: 0, y: 1 }}
            end={{ x: 0, y: 0 }}
            style={[StyleSheet.absoluteFillObject, { pointerEvents: "none" }]}
          />
           <View style={[styles.footerContent, {backgroundColor: isDark ? theme.backgroundDark : theme.backgroundLight}]}>
                <TouchableOpacity 
                  style={[styles.actionButton, { backgroundColor: riskColor }]}
                  onPress={() => alert("Routing functionality coming soon!")}
                >
                    <MaterialIcons name="alt-route" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.actionButtonText}>See Cool Routes</Text>
                </TouchableOpacity>
           </View>
        </View>
        <ExtremeHeatModal 
            visible={showAlert} 
            onClose={() => setShowAlert(false)} 
            heatIndex={heatIndex} 
            advice={advice} 
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 40 : 0,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 4,
    marginTop: 20,
  },
  alertContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2ecc70',
  },
  alertText: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(46, 204, 112, 0.8)',
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    lineHeight: 36,
  },
  modeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 16,
    marginTop: 20,
    borderWidth: 1,
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
    elevation: 2,
  },
  modeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  modeSubtitle: {
    fontSize: 12,
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderRadius: 10,
    boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
    elevation: 2,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
  highlight: {
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 140, // Increased space to clear tab bar and sticky footer
  },
  cardsContainer: {
    gap: 16,
  },
  card: {
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    borderWidth: 1,
    // iOS shadow
    borderWidth: 1,
    // iOS/Web shadow
    boxShadow: '0 4px 20px rgba(46, 204, 112, 0.12)',
    elevation: 2, // Android shadow
  },
  iconContainer: {
    padding: 12,
    borderRadius: 8,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardText: {
    fontSize: 13,
    lineHeight: 18,
  },
  statusCard: {
    marginTop: 16,
    height: 128,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  statusImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  statusOverlay: {
    position: 'absolute',
    inset: 0,
    justifyContent: 'center',
    padding: 24,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#2ecc70',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  footerContent:{
      padding: 24,
      paddingTop: 12,
      paddingBottom: 90, // Match tab bar clearance
  },
  actionButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: "0 4px 8px rgba(46, 204, 112, 0.3)",
    elevation: 4,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
