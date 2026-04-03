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

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 'TX-1004',
    type: 'payout',
    title: 'Extreme Heat Protection',
    description: 'Active Zone trigger (Temp > 42°C)',
    amount: 150,
    date: 'Today, 2:45 PM',
    timestamp: Date.now() - 3600000 * 2,
    status: 'settled',
    triggerIcon: 'thermometer-outline',
  },
  {
    id: 'TX-1003',
    type: 'payout',
    title: 'Heavy Rain Interruption',
    description: 'Automated settlement (Precipitation > 15mm/hr)',
    amount: 220,
    date: 'Yesterday, 6:12 PM',
    timestamp: Date.now() - 3600000 * 26,
    status: 'settled',
    triggerIcon: 'rainy-outline',
  },
  {
    id: 'TX-1002',
    type: 'payout',
    title: 'Low Visibility Payout',
    description: 'Hazardous smog levels detected by AI',
    amount: 100,
    date: 'Mar 31, 2024, 9:20 AM',
    timestamp: new Date('2024-03-31T09:20:00Z').getTime(),
    status: 'settled',
    triggerIcon: 'eye-off-outline',
  },
  {
    id: 'TX-1001',
    type: 'withdrawal',
    title: 'Bank Transfer',
    description: 'To State Bank of India - ****4021',
    amount: -1200,
    date: 'Mar 28, 2024, 4:10 PM',
    timestamp: new Date('2024-03-28T16:10:00Z').getTime(),
    status: 'success',
    triggerIcon: 'business-outline',
  },
  {
    id: 'TX-1000',
    type: 'bonus',
    title: 'No-Claim Weekly Bonus',
    description: 'Reward for zero claims filed manually',
    amount: 50,
    date: 'Mar 25, 2024, 11:00 AM',
    timestamp: new Date('2024-03-25T11:00:00Z').getTime(),
    status: 'settled',
    triggerIcon: 'gift-outline',
  },
];

export default function WalletScreen() {
  const [balance, setBalance] = useState(2450);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
    // Start with real purchases from DB
    const realTransactions: Transaction[] = (profile?.policy_history || []).map((p, idx) => {
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

    console.log("Wallet profile payout_history length:", profile?.payout_history?.length, "Contents:", JSON.stringify(profile?.payout_history));

    const realPayouts: Transaction[] = (profile?.payout_history || []).map((p, idx) => {
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

    // Combine with mock payouts for the demo
    return [...realTransactions, ...realPayouts, ...MOCK_TRANSACTIONS].sort((a, b) => b.timestamp - a.timestamp);
  };

  const transactions = getTransactions();
  
  // Calculate dynamic balance based on starting + real purchases + real payouts
  const realPurchaseTotal = profile?.policy_history?.reduce((acc, p) => acc - p.premium_paid, 0) || 0;
  const realPayoutTotal = profile?.payout_history?.reduce((acc, p) => acc + p.amount, 0) || 0;
  const totalBalance = balance + realPurchaseTotal + realPayoutTotal;

  return (
    <View style={styles.container}>
      {/* ── Header Area ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>GigGuard Wallet</Text>
        <Text style={styles.headerSubtitle}>Real-time parametric payouts</Text>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Balance Card ── */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View>
              <Text style={styles.balanceLabel}>Protection Balance</Text>
              <Text style={styles.balanceAmount}>₹{totalBalance.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.shieldIconContainer}>
              <Ionicons name="shield-checkmark" size={32} color={colors.orange} />
            </View>
          </View>
          
          <TouchableOpacity style={styles.withdrawButton} activeOpacity={0.8}>
            <Text style={styles.withdrawButtonText}>Withdraw to Bank</Text>
            <Ionicons name="arrow-forward" size={16} color="#000" />
          </TouchableOpacity>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>12</Text>
              <Text style={styles.statLabel}>Claims Cleared</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>100%</Text>
              <Text style={styles.statLabel}>Automated</Text>
            </View>
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

        {/* ── Hackathon Disclaimer ── */}
        <View style={styles.disclaimerBox}>
          <Ionicons name="information-circle-outline" size={16} color={colors.orange} />
          <Text style={styles.disclaimerText}>
            This is a mock dashboard for hackathon demonstration. All payouts shown are simulated based on AI climate trigger logic.
          </Text>
        </View>
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
});
