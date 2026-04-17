import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../theme';
import { fetchUserProfile, UserProfile } from '../services/api';

const { width } = Dimensions.get('window');

interface Transaction {
  id: string;
  type: 'payout' | 'withdrawal' | 'bonus' | 'purchase';
  title: string;
  description: string;
  amount: number;
  date: string;
  timestamp: number;
  status: 'settled' | 'pending' | 'success';
  triggerIcon: keyof typeof Ionicons.glyphMap;
}

export default function WalletScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormulaExpanded, setIsFormulaExpanded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchUserProfile()
        .then(setProfile)
        .catch(err => console.error("Wallet Profile Load Failed:", err))
        .finally(() => setIsLoading(false));
    }, [])
  );

  const getTransactions = (): Transaction[] => {
    const safePolicyHistory = profile?.policy_history || [];
    const safePayoutHistory = profile?.payout_history || [];

    const realTransactions: Transaction[] = safePolicyHistory.map((p, idx) => {
      const d = new Date(p.activated_at);
      return {
        id: `POL-${idx}`,
        type: 'purchase',
        title: `${p.tier.charAt(0).toUpperCase() + p.tier.slice(1)} Plan Purchase`,
        description: `Weekly coverage activated`,
        amount: -p.premium_paid,
        date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
        timestamp: d.getTime(),
        status: 'success',
        triggerIcon: 'cart-outline',
      };
    });

    console.log("Wallet profile payout_history length:", safePayoutHistory.length, "Contents:", JSON.stringify(safePayoutHistory));

    const realPayouts: Transaction[] = safePayoutHistory.map((p, idx) => {
      const d = new Date(p.paid_at);
      return {
        id: p.payout_id || `PAY-${idx}`,
        type: 'payout',
        title: p.trigger_name,
        description: `Automated parametric settlement`,
        amount: p.amount,
        date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
        timestamp: d.getTime(),
        status: 'settled',
        triggerIcon: 
          p.trigger_name.toLowerCase().includes('rain') ? 'rainy-outline' :
          p.trigger_name.toLowerCase().includes('heat') ? 'thermometer-outline' :
          p.trigger_name.toLowerCase().includes('visibility') ? 'eye-off-outline' :
          p.trigger_name.toLowerCase().includes('storm') ? 'thunderstorm-outline' :
          p.trigger_name.toLowerCase().includes('aqi') ? 'medical-outline' :
          'shield-checkmark-outline',
      };
    });

    return [...realTransactions, ...realPayouts].sort((a, b) => b.timestamp - a.timestamp);
  };

  const transactions = getTransactions();

  return (
    <View style={styles.container}>
      {/* ── Header Area ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>GigShield Passbook</Text>
        <Text style={styles.headerSubtitle}>Chronological parametric settlement ledger</Text>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Actuarial Health Panel ── */}
        <View style={styles.actuarialCard}>
          <View style={styles.actuarialHeader}>
            <Ionicons name="analytics-outline" size={16} color={colors.aqua} />
            <Text style={styles.actuarialTitle}>Portfolio Actuarial Health</Text>
            <View style={styles.healthBadge}>
              <View style={styles.healthDot} />
              <Text style={styles.healthText}>Healthy</Text>
            </View>
          </View>

          {/* BCR Bar */}
          <View style={styles.bcrSection}>
            <View style={styles.bcrLabelRow}>
              <Text style={styles.bcrLabel}>Burning Cost Ratio (BCR)</Text>
              <Text style={styles.bcrValue}>67.2%</Text>
            </View>
            <View style={styles.bcrBarBg}>
              <View style={[styles.bcrBarFill, { width: '67.2%' }]} />
              {/* Target zone markers */}
              <View style={[styles.bcrMarker, { left: '55%' }]} />
              <View style={[styles.bcrMarker, { left: '70%' }]} />
            </View>
            <View style={styles.bcrRangeRow}>
              <Text style={styles.bcrRangeText}>0%</Text>
              <Text style={[styles.bcrRangeText, { color: colors.success }]}>Target: 55–70%  ✅</Text>
              <Text style={styles.bcrRangeText}>100%</Text>
            </View>
          </View>

          {/* 4 actuarial stat blocks */}
          <View style={styles.actuarialGrid}>
            <View style={styles.actuarialStatBox}>
              <Text style={styles.actuarialStatValue}>0.8795</Text>
              <Text style={styles.actuarialStatLabel}>Model R²</Text>
            </View>
            <View style={styles.actuarialStatBox}>
              <Text style={styles.actuarialStatValue}>₹0.87</Text>
              <Text style={styles.actuarialStatLabel}>MAE / day</Text>
            </View>
            <View style={styles.actuarialStatBox}>
              <Text style={[styles.actuarialStatValue, { color: colors.success }]}>67.2%</Text>
              <Text style={styles.actuarialStatLabel}>Loss Ratio</Text>
            </View>
            <View style={styles.actuarialStatBox}>
              <Text style={styles.actuarialStatValue}>10 Yrs</Text>
              <Text style={styles.actuarialStatLabel}>Training Data</Text>
            </View>
          </View>

          <Text style={styles.actuarialNote}>
            📐 Based on walk-forward validated XGBoost model (2015–2025 IMD data). 65 paise per ₹1 goes to claims — sustainable parametric pool.
          </Text>

          {/* ── Pricing Formula Card ── */}
          <View style={styles.formulaCard}>
            <TouchableOpacity 
              style={[styles.formulaHeaderRow, { marginBottom: isFormulaExpanded ? spacing.lg : 0 }]}
              onPress={() => setIsFormulaExpanded(!isFormulaExpanded)}
              activeOpacity={0.7}
            >
              <Ionicons name="calculator-outline" size={14} color={colors.orange} />
              <Text style={styles.formulaTitle}>How Your Premium is Calculated</Text>
              <Ionicons 
                name={isFormulaExpanded ? "chevron-up" : "chevron-down"} 
                size={18} 
                color={colors.orange} 
                style={{ marginLeft: 'auto' }}
              />
            </TouchableOpacity>

            {isFormulaExpanded && (
              <View>
                {/* Step 1 */}
                <View style={styles.formulaStep}>
                  <View style={styles.formulaStepBadge}><Text style={styles.formulaStepNum}>1</Text></View>
                  <View style={styles.formulaStepBody}>
                    <Text style={styles.formulaStepLabel}>AI Predicts Your Risk</Text>
                    <View style={styles.formulaBox}>
                      <Text style={styles.formulaCode}>Loss Ratio = XGBoost(rain, wind, AQI, GPS zone, ...)</Text>
                    </View>
                    <Text style={styles.formulaHint}>Our model looks at 39 weather + location signals and outputs a number between 0–1. Example: 0.18 means 18% chance of earnings disruption today.</Text>
                  </View>
                </View>

                {/* Step 2 */}
                <View style={styles.formulaStep}>
                  <View style={styles.formulaStepBadge}><Text style={styles.formulaStepNum}>2</Text></View>
                  <View style={styles.formulaStepBody}>
                    <Text style={styles.formulaStepLabel}>Base Premium is Calculated</Text>
                    <View style={styles.formulaBox}>
                      <Text style={styles.formulaCode}>Base = (Loss Ratio × Daily Income × Coverage%) × 7 days</Text>
                    </View>
                    <Text style={styles.formulaHint}>Example: 0.18 × ₹800 × 70% × 7 = ₹705.6 expected weekly loss → your pure risk cost.</Text>
                  </View>
                </View>

                {/* Step 3 */}
                <View style={styles.formulaStep}>
                  <View style={styles.formulaStepBadge}><Text style={styles.formulaStepNum}>3</Text></View>
                  <View style={styles.formulaStepBody}>
                    <Text style={styles.formulaStepLabel}>Smart Adjustments Applied</Text>
                    <View style={styles.formulaBox}>
                      <Text style={styles.formulaCode}>Final = Base ± Zone Discount ± Surge ± Streak ± Season</Text>
                    </View>
                    <Text style={styles.formulaHint}>Safe GPS zone? Get ₹2–10 off. Monsoon week? +15%. No claim streak? Up to 15% loyalty reward. Multiple triggers? +8–15% surcharge.</Text>
                  </View>
                </View>

                {/* Step 4 */}
                <View style={[styles.formulaStep, { marginBottom: 0 }]}>
                  <View style={[styles.formulaStepBadge, { backgroundColor: 'rgba(0,255,136,0.15)' }]}><Text style={[styles.formulaStepNum, { color: colors.success }]}>✓</Text></View>
                  <View style={styles.formulaStepBody}>
                    <Text style={styles.formulaStepLabel}>Payout on Trigger</Text>
                    <View style={[styles.formulaBox, { borderColor: 'rgba(0,255,136,0.2)' }]}>
                      <Text style={[styles.formulaCode, { color: colors.success }]}>Payout = Daily Income × Coverage% × Disruption Days</Text>
                    </View>
                    <Text style={styles.formulaHint}>When AQI &gt; 300, rain &gt; 15mm/hr, or temp &gt; 42°C hits during your shift — money lands in this Passbook automatically. Zero paperwork. ≈3 seconds.</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* ── Transaction List ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Automated Activity</Text>
          <TouchableOpacity>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>


        {isLoading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.orange} />
          </View>
        ) : (
          transactions.map((tx) => (
            <View key={tx.id} style={styles.transactionCard}>
              <View style={[
                styles.iconCircle, 
                { backgroundColor: 
                    tx.type === 'payout' ? 'rgba(0, 255, 136, 0.1)' : 
                    tx.type === 'purchase' ? 'rgba(255, 152, 0, 0.1)' :
                    'rgba(255, 255, 255, 0.05)' 
                }
              ]}>
                <Ionicons 
                  name={tx.triggerIcon} 
                  size={20} 
                  color={
                    tx.type === 'payout' ? colors.success : 
                    tx.type === 'purchase' ? colors.orange :
                    colors.textSecondary
                  } 
                />
              </View>
              
              <View style={styles.txInfo}>
                <Text style={styles.txTitle}>{tx.title}</Text>
                <Text style={styles.txDesc}>{tx.description}</Text>
                <Text style={styles.txDate}>{tx.date}</Text>
              </View>
              
              <View style={styles.txAmountContainer}>
                <Text style={[
                  styles.txAmount, 
                  { color: tx.amount > 0 ? colors.success : colors.textPrimary }
                ]}>
                  {tx.amount > 0 ? '+' : ''}₹{Math.abs(tx.amount)}
                </Text>
                <View style={styles.statusBadge}>
                  <View style={[
                    styles.statusDot, 
                    { backgroundColor: tx.status === 'settled' || tx.status === 'success' ? colors.success : colors.warning }
                  ]} />
                  <Text style={styles.statusText}>{tx.status}</Text>
                </View>
              </View>
            </View>
          ))
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  header: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: fontWeight.heavy as any,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 4,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 40,
  },
  balanceCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    ...shadows.card,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  balanceLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginBottom: 4,
  },
  balanceAmount: {
    color: colors.textPrimary,
    fontSize: 36,
    fontWeight: fontWeight.bold,
  },
  shieldIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 140, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 140, 0, 0.2)',
  },
  withdrawButton: {
    backgroundColor: colors.orange,
    height: 48,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: spacing.xl,
  },
  withdrawButtonText: {
    color: '#000',
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  viewAllText: {
    color: colors.orange,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  txTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  txDesc: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  txDate: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 4,
  },
  txAmountContainer: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    color: colors.textMuted,
    fontSize: 10,
    textTransform: 'capitalize',
  },
  disclaimerBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 140, 0, 0.05)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.xl,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 140, 0, 0.2)',
  },
  disclaimerText: {
    flex: 1,
    color: colors.orange,
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  // ── Actuarial Health Panel ──
  actuarialCard: {
    marginBottom: spacing.xl,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    borderColor: 'rgba(94, 234, 212, 0.25)',
    padding: spacing.xl,
    shadowColor: colors.aqua || '#5EEAD4',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  actuarialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: spacing.lg,
  },
  actuarialTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    shadowColor: colors.success || '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  healthDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  healthText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // BCR Progress Bar
  bcrSection: {
    marginBottom: spacing.xl,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  bcrLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  bcrLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  bcrValue: {
    color: colors.aqua,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  bcrBarBg: {
    height: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  bcrBarFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 6,
  },
  bcrMarker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#fff',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  bcrRangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  bcrRangeText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: fontWeight.medium,
  },
  // Actuarial Stat Grid
  actuarialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: spacing.md,
  },
  actuarialStatBox: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: 'rgba(94, 234, 212, 0.05)',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(94, 234, 212, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  actuarialStatValue: {
    color: colors.aqua,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    marginBottom: 4,
    textShadowColor: 'rgba(94, 234, 212, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  actuarialStatLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    textAlign: 'center',
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actuarialNote: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 18,
    fontStyle: 'italic',
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: spacing.md,
    textAlign: 'center',
  },
  // ── Formula Card ──
  formulaCard: {
    marginTop: spacing.lg,
    backgroundColor: 'rgba(255,140,0,0.04)',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,140,0,0.12)',
    padding: spacing.lg,
  },
  formulaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.lg,
  },
  formulaTitle: {
    color: colors.orange,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  formulaStep: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: spacing.lg,
  },
  formulaStepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,140,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  formulaStepNum: {
    color: colors.orange,
    fontSize: 11,
    fontWeight: fontWeight.bold,
  },
  formulaStepBody: {
    flex: 1,
  },
  formulaStepLabel: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    marginBottom: 6,
  },
  formulaBox: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,140,0,0.15)',
  },
  formulaCode: {
    color: colors.aqua,
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 17,
  },
  formulaHint: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
});

