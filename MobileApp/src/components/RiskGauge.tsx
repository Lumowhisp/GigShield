import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, fontSize, fontWeight } from '../theme';

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
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedValue = Math.min(Math.max(value, 0), 1);
  const strokeDashoffset = circumference * (1 - clampedValue);
  const percentage = Math.round(clampedValue * 100);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Value arc */}
        <Circle
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
          opacity={0.9}
        />
      </Svg>
      <View style={styles.centerContent}>
        <Text style={[styles.gaugeValue, { color: risk.color }]}>
          {percentage}%
        </Text>
        <Text style={[styles.gaugeLabel, { color: risk.color }]}>
          {risk.label}
        </Text>
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
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 2,
    marginTop: 4,
  },
});
