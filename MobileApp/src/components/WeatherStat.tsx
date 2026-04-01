import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../theme';

interface WeatherStatProps {
  icon: string;
  label: string;
  value: number;
  unit: string;
  accent?: boolean;
}

export default function WeatherStat({ icon, label, value, unit, accent }: WeatherStatProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.value, accent && { color: colors.aqua }]}>
        {Math.round(value)}{unit}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 4,
  },
  icon: {
    fontSize: 24,
    marginBottom: spacing.sm,
  },
  value: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.heavy,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  label: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
});
