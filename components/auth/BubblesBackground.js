import React, { useEffect } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withDelay,
  Easing 
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

const Bubble = ({ size, x, y, delay, duration, color }) => {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0.1);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withTiming(-60, {
          duration: duration,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true
      )
    );
    
    opacity.value = withDelay(
      delay,
      withRepeat(
        withTiming(0.25, {
          duration: duration,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true
      )
    );

    scale.value = withDelay(
      delay,
      withRepeat(
        withTiming(1.2, {
          duration: duration,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true
      )
    );
  }, [delay, duration, opacity, scale, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value }
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          left: x,
          top: y,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
};

export default function BubblesBackground({ color = '#2ecc70' }) {
  // Use a softer version of the primary color for bubbles
  const bubbleColor = color + '20'; // 12% opacity base

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Bubble size={150} x={-50} y={height * 0.15} delay={0} duration={6000} color={bubbleColor} />
      <Bubble size={200} x={width * 0.55} y={height * 0.4} delay={1000} duration={8000} color={bubbleColor} />
      <Bubble size={120} x={width * 0.2} y={height * 0.75} delay={500} duration={7000} color={bubbleColor} />
      <Bubble size={180} x={width * 0.8} y={height * 0.05} delay={1500} duration={9000} color={bubbleColor} />
      <Bubble size={100} x={width * 0.05} y={height * 0.5} delay={2000} duration={7500} color={bubbleColor} />
      <Bubble size={140} x={width * 0.4} y={height * 0.9} delay={300} duration={6500} color={bubbleColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    opacity: 0.1,
  },
});
