import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Image } from 'react-native';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme';
import type { PlanDetail } from '../services/api';

interface PlanCardProps {
  planKey: 'basic' | 'standard' | 'premium';
  plan: PlanDetail;
  isSelected: boolean;
  isRecommended?: boolean;
  onSelect: () => void;
}

const PLAN_CONFIG: Record<string, { color: string; accentDim: string }> = {
  basic: { color: colors.aqua, accentDim: colors.aquaDim },
  standard: { color: colors.orange, accentDim: colors.orangeDim },
  premium: { color: '#FFD700', accentDim: 'rgba(255, 215, 0, 0.10)' },
};

// Local image assets for plan icons
const PLAN_ICONS: Record<string, any> = {
  standard: require('../../assets/Standard Background Removed.png'),
  premium: require('../../assets/Premium Background Removed.png'),
};

export default function PlanCard({ planKey, plan, isSelected, isRecommended, onSelect }: PlanCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: isSelected ? 1.015 : 1,
        tension: 100,
        friction: 10,
        useNativeDriver: false,
      }),
      Animated.timing(glowAnim, {
        toValue: isSelected ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
  }, [isSelected]);

  const config = PLAN_CONFIG[planKey];

  const borderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0.04)', config.color + '80'],
  });

  const bgColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.bgCard, config.accentDim],
  });

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onSelect}>
      <Animated.View
        style={[
          styles.card,
          {
            transform: [{ scale: scaleAnim }],
            borderColor,
            backgroundColor: bgColor,
          },
        ]}
      >
        {/* Recommended badge */}
        {isRecommended && (
          <View style={[styles.badge, { backgroundColor: colors.orangeDim }]}>
            <Text style={[styles.badgeText, { color: colors.orange }]}>★ RECOMMENDED</Text>
          </View>
        )}

        {/* Plan header row */}
        <View style={styles.headerRow}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            {planKey === 'basic' ? (
              <Text style={styles.shieldEmoji}>🛡️</Text>
            ) : (
              <Image source={PLAN_ICONS[planKey]} style={styles.planImage} resizeMode="contain" />
            )}
          </View>

          {/* Name + coverage */}
          <View style={styles.nameBlock}>
            <Text style={[styles.planName, isSelected && { color: config.color }]}>
              {plan.label}
            </Text>
            <Text style={styles.coverage}>
              {plan.coverage_pct}% income · {plan.coverage_hours_per_day}h/day
            </Text>
          </View>

          {/* Radio */}
          <View style={[styles.radio, isSelected && { borderColor: config.color }]}>
            {isSelected && <View style={[styles.radioDot, { backgroundColor: config.color }]} />}
          </View>
        </View>

        {/* Price row */}
        <View style={styles.priceRow}>
          <View style={styles.priceLeft}>
            <Text style={styles.currencySmall}>₹</Text>
            <Text style={[styles.priceValue, isSelected && { color: config.color }]}>
              {Math.round(plan.weekly_premium_inr)}
            </Text>
            <Text style={styles.pricePeriod}>/week</Text>
          </View>
          <Text style={styles.monthlyText}>₹{Math.round(plan.monthly_premium_inr)}/mo</Text>
        </View>

        {/* Adjustments - only when selected */}
        {isSelected && plan.adjustments && plan.adjustments.length > 0 && (
          <View style={styles.adjustRow}>
            {plan.adjustments.map((adj, i) => (
              <View
                key={i}
                style={[
                  styles.adjustChip,
                  { backgroundColor: adj.amount < 0 ? colors.successDim : colors.warningDim },
                ]}
              >
                <Text style={[
                  styles.adjustText,
                  { color: adj.amount < 0 ? colors.success : colors.warning },
                ]}>
                  {adj.amount < 0 ? '↓' : '↑'} ₹{Math.abs(adj.amount).toFixed(0)} {adj.type.replace(/_/g, ' ')}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer: Max payout */}
        <View style={styles.footerRow}>
          <Text style={styles.footerLabel}>Max payout</Text>
          <Text style={styles.footerValue}>₹{Math.round(plan.max_weekly_payout_inr)}/wk</Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.xl,
    marginBottom: 14,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shieldEmoji: {
    fontSize: 36,
  },
  planImage: {
    width: 46,
    height: 46,
  },
  nameBlock: {
    flex: 1,
    marginLeft: 14,
  },
  planName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  coverage: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  priceLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currencySmall: {
    fontSize: 18,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
  },
  priceValue: {
    fontSize: 32,
    fontWeight: fontWeight.heavy,
    color: colors.textPrimary,
    marginLeft: 2,
  },
  pricePeriod: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginLeft: 4,
  },
  monthlyText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  adjustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  adjustChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  adjustText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  footerLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  footerValue: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: fontWeight.bold,
  },
});
