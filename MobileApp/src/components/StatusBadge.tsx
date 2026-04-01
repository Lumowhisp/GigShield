import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize, fontWeight, borderRadius } from '../theme';

interface StatusBadgeProps {
  risk: string;
}

const RISK_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  low: { color: colors.success, bg: colors.successDim, label: 'LOW' },
  moderate: { color: colors.warning, bg: colors.warningDim, label: 'MODERATE' },
  high: { color: colors.orange, bg: colors.orangeDim, label: 'HIGH' },
  extreme: { color: colors.danger, bg: colors.dangerDim, label: 'EXTREME' },
};

export default function StatusBadge({ risk }: StatusBadgeProps) {
  const config = RISK_CONFIG[risk] || RISK_CONFIG.low;

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={[styles.text, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  text: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
  },
});
