import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop, G } from 'react-native-svg';
import { colors, fontSize, fontWeight, spacing } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

interface RiskGaugeProps {
  value: number;        // 0-1 loss ratio
  riskLevel: string;    // low | moderate | high | extreme
  size?: number;
}

const RISK_STYLES: Record<string, { color: string; label: string }> = {
  low: { color: colors.success, label: 'LOW' },
  moderate: { color: colors.warning, label: 'MODERATE' },
  high: { color: colors.orange, label: 'HIGH' },
  extreme: { color: colors.danger, label: 'EXTREME' },
};

export default function RiskGauge({ value, riskLevel, size = 180 }: RiskGaugeProps) {
  const risk = RISK_STYLES[riskLevel] || RISK_STYLES.low;
  const strokeWidth = 8;
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedValue = Math.min(Math.max(value, 0), 1);
  
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: clampedValue,
      duration: 2000,
      useNativeDriver: true,
    }).start();
  }, [clampedValue]);

  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  const tipRotation = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 360],
  });

  const percentage = Math.round(clampedValue * 100);

  const ticks = Array.from({ length: 60 }).map((_, i) => (
    <Circle
      key={i}
      cx={size / 2}
      cy={size / 2 - radius - 8}
      r={1}
      fill={i / 60 < clampedValue ? risk.color : 'rgba(255,255,255,0.1)'}
      transform={`rotate(${i * 6}, ${size / 2}, ${size / 2})`}
    />
  ));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="grad" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={risk.color} stopOpacity="0.05" />
            <Stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Circle cx={size/2} cy={size/2} r={radius} fill="url(#grad)" />

        {ticks}

        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={risk.color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90, ${size / 2}, ${size / 2})`}
        />

        {/* Tip Indicator - Fixed pivot for perfect tracking */}
        <G transform={`rotate(-90, ${size / 2}, ${size / 2})`}>
          <AnimatedG
            transform={tipRotation.interpolate({
              inputRange: [0, 360],
              outputRange: [`rotate(0, ${size/2}, ${size/2})`, `rotate(360, ${size/2}, ${size/2})`]
            })}
          >
            <Circle cx={size / 2 + radius} cy={size / 2} r={4} fill="#FFF" />
            <Circle
              cx={size / 2 + radius}
              cy={size / 2}
              r={7}
              fill={risk.color}
              opacity={0.4}
            />
          </AnimatedG>
        </G>
      </Svg>
      <View style={styles.centerContent}>
        <Text style={[styles.gaugeValue, { color: risk.color }]}>
          {percentage}%
        </Text>
        <Text style={[styles.gaugeLabel, { color: risk.color }]}>
          {risk.label}
        </Text>
        <Text style={styles.subtext}>AI DISRUPTION SCORE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContent: {
    position: 'absolute',
    alignItems: 'center',
  },
  gaugeValue: {
    fontSize: 36,
    fontWeight: fontWeight.heavy,
  },
  gaugeLabel: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 2,
    marginTop: 4,
  },
  subtext: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
    marginTop: 2,
  }
});
