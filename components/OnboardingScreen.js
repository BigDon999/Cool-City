import React, { useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  FlatList,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../constants/theme';
import { useColorScheme } from '../hooks/use-color-scheme';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: 'Precision Climate Intel',
    description: 'Hyper-local weather metrics and heat risk analysis powered by our proprietary AI engine.',
    icon: 'wb-sunny',
    color: '#FF9500',
    gradient: ['#FF9500', '#FF5E00'],
  },
  {
    id: '2',
    title: 'Hydration Discovery',
    description: 'Instantly find verified water stations and shaded corridors near your current location.',
    icon: 'opacity',
    color: '#007AFF',
    gradient: ['#007AFF', '#00C6FF'],
  },
  {
    id: '3',
    title: 'Smart Cooling Routes',
    description: 'Navigate the city safely. We calculate the most protected paths to keep you out of the sun.',
    icon: 'alt-route',
    color: '#2ecc70',
    gradient: ['#2ecc70', '#27ae60'],
  },
  {
    id: '4',
    title: 'Community Safety',
    description: 'Join a network of climate-aware citizens making cities cooler and safer for everyone.',
    icon: 'verified-user',
    color: '#8E44AD',
    gradient: ['#8E44AD', '#BB8FCE'],
  },
];

export default function OnboardingScreen({ onFinish }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const viewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems[0]) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleNext = useCallback(() => {
    if (currentIndex < SLIDES.length - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onFinish();
    }
  }, [currentIndex, onFinish]);

  const renderItem = ({ item }) => {
    return (
      <View style={styles.slide}>
        <View style={styles.iconContainer}>
          <LinearGradient
            colors={item.gradient}
            style={styles.iconCircle}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <MaterialIcons name={item.icon} size={64} color="#fff" />
          </LinearGradient>
        </View>

        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>{item.title}</Text>
          <Text style={[styles.description, { color: isDark ? '#94a3b8' : '#64748b' }]}>
            {item.description}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#131f18' : '#f6f8f7' }]}>
      <FlatList
        data={SLIDES}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        keyExtractor={(item) => item.id}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false,
        })}
        onViewableItemsChanged={viewableItemsChanged}
        viewabilityConfig={viewConfig}
        ref={flatListRef}
      />

      <View style={styles.footer}>
        {/* Pagination */}
        <View style={styles.pagination}>
          {SLIDES.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [10, 24, 10],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  {
                    width: dotWidth,
                    opacity,
                    backgroundColor: SLIDES[currentIndex].color,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Next Button */}
        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: SLIDES[currentIndex].color }]}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>
            {currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          </Text>
          <MaterialIcons 
            name={currentIndex === SLIDES.length - 1 ? 'check' : 'arrow-forward'} 
            size={20} 
            color="#fff" 
            style={{ marginLeft: 8 }}
          />
        </TouchableOpacity>

        {/* Skip Button */}
        {currentIndex < SLIDES.length - 1 && (
          <TouchableOpacity 
            style={styles.skipButton} 
            onPress={onFinish}
          >
            <Text style={[styles.skipText, { color: isDark ? '#94a3b8' : '#64748b' }]}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slide: {
    width,
    alignItems: 'center',
    paddingTop: height * 0.15,
  },
  iconContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  textContainer: {
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  footer: {
    height: height * 0.25,
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  pagination: {
    flexDirection: 'row',
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    height: 10,
    borderRadius: 5,
    marginHorizontal: 4,
  },
  nextButton: {
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  skipButton: {
    marginTop: 20,
    alignSelf: 'center',
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
