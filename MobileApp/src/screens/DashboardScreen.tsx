import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, ActivityIndicator, Platform, Dimensions, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { LineChart } from 'react-native-chart-kit';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../theme';
import RiskGauge from '../components/RiskGauge';
import AQIPanel from '../components/AQIPanel';
import CityAlertsFeed from '../components/CityAlertsFeed';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { PremiumResponse, TriggerInfo, UserProfile } from '../services/api';
import { fetchUserProfile, simulatePayout, updateUserLocation, registerPushToken } from '../services/api';
import * as Location from 'expo-location';
import GigBotModal from '../components/GigBotModal';
import type { RootStackParamList, BottomTabParamList } from '../../App';

type Props = {
  route: RouteProp<BottomTabParamList, 'Home'>;
  navigation: NativeStackNavigationProp<BottomTabParamList, 'Home'>;
};

const DISRUPTION_LOTTIES: Record<string, string> = {
  heavy_rain: 'https://lottie.host/0d5e4c47-43b2-4700-8325-b3bd77ec70a5/SNcBwguIuy.lottie',
  extreme_heat: 'https://lottie.host/84088923-1edc-418f-bb85-bc5a73ada6ec/BqvaS6soSP.lottie',
  storm: 'https://lottie.host/a1472697-b52c-4de2-8b6d-50e174cfa393/9rIIiaF9vk.lottie',
  flood_zone: 'https://lottie.host/28c36fdc-b9d9-465e-b56d-dce04003c5bc/NdEmTWppUw.lottie',
  poor_visibility: 'https://lottie.host/cfbbb843-09e6-4207-aebb-4d120df152e2/YEIHwn6glE.lottie',
};

const PLAN_COLORS: Record<string, string> = {
  basic: colors.aqua,
  standard: colors.orange,
  premium: '#FFD700',
};

// Weather Lotties 
const WEATHER_LOTTIES = {
  clear: 'https://lottie.host/801a61b8-2510-4ed3-a00d-58fe8fe40639/0YqI4uT1G4.lottie', // Using a nice sun/cloud mix since clear ones often lack impact, or swap if user prefers
  cloudy: 'https://lottie.host/801a61b8-2510-4ed3-a00d-58fe8fe40639/0YqI4uT1G4.lottie',
  rain: 'https://lottie.host/fbc521af-4c3e-4364-b97c-8e4d2ff36d53/4I02t0fS26.lottie',
};

const getWeatherLottie = (code: number) => {
  if (code < 3) return WEATHER_LOTTIES.clear;
  if (code >= 3 && code <= 48) return WEATHER_LOTTIES.cloudy;
  return WEATHER_LOTTIES.rain;
};

export default function DashboardScreen({ route, navigation }: Props) {
  const { premiumData, activePlan } = route.params;
  const planDetails = premiumData.plans[activePlan];
  const planColor = PLAN_COLORS[activePlan] || colors.orange;
  const [isSimulating, setIsSimulating] = useState(false);
  const [weather, setWeather] = useState<{ temperature: number; weathercode: number } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [showAllTriggers, setShowAllTriggers] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const noteAnim = useRef(new Animated.Value(-100)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();

    // Extract weather directly from premiumData to avoid redundant Open-Meteo fetch and network errors
    if (premiumData?.today_weather) {
      setWeather({
        temperature: premiumData.today_weather.temp_max_c,
        weathercode: premiumData.today_weather.precipitation_mm > 0 ? 61 : 0 // 61=rain, 0=clear fallback
      });
    }

    // Fetch profile for policy info
    fetchUserProfile()
      .then(setProfile)
      .catch((err: any) => console.error("Profile fetch failed", err));

    // Sync user GPS location to backend for autopay scheduler
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          await updateUserLocation(loc.coords.latitude, loc.coords.longitude, loc.coords.altitude || 0);
          console.log('📍 Location synced for autopay:', loc.coords.latitude.toFixed(4), loc.coords.longitude.toFixed(4));
        }
      } catch (e) {
        console.warn('Location sync failed:', e);
      }
    })();

    // Register Expo push token for autopay notifications (Skip in Expo Go for SDK 53+)
    (async () => {
      try {
        const { default: Constants } = await import('expo-constants');
        
        // Expo Go SDK 53+ no longer supports remote push notifications
        if (Constants.appOwnership === 'expo') {
          console.log('🔔 Running in Expo Go: Skipping push token registration (not supported in SDK 53+)');
          return;
        }

        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (projectId) {
          const { getExpoPushTokenAsync } = await import('expo-notifications');
          const tokenData = await getExpoPushTokenAsync({ projectId });
          await registerPushToken(tokenData.data);
          console.log('🔔 Push token registered:', tokenData.data.slice(0, 30) + '...');
        }
      } catch (e) {
        console.warn('Push token registration skipped:', e);
      }
    })();

    // Start hero glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const fr = premiumData.forecast_risk;
  const triggers = premiumData.all_triggers_today || [];
  const lossRatio = premiumData.forecast_loss_ratio_7d;
  const screenWidth = Dimensions.get("window").width;

  const getNext7DaysLabels = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date().getDay();
    return Array.from({ length: 7 }).map((_, i) => days[(today + i) % 7]);
  };

  const getDaysRemaining = () => {
    if (!profile?.active_policy?.expires_at) return null;
    const expiry = new Date(profile.active_policy.expires_at);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const daysRemaining = getDaysRemaining();
  const isExpired = daysRemaining !== null && daysRemaining === 0;

  const getGreetingData = () => {
    const name = profile?.name?.split(' ')[0] || 'Rider';
    if (isExpired) {
      return { name, msg: '⚠️ Your coverage has expired. Renew to stay protected.' };
    }
    return { name, msg: 'You\'re protected. Let\'s keep earning.' };
  };

  const greeting = getGreetingData();

  const handleSimulate = async () => {
    setIsSimulating(true);

    const payoutAmt = Math.round(planDetails.expected_weekly_payout_inr);
    const demoTriggers = ["Severe AQI (> 300)", "Heavy Rain (> 15mm/hr)", "Extreme Heat (> 43°C)", "Storm conditions"];
    const randomDemoTrigger = demoTriggers[Math.floor(Math.random() * demoTriggers.length)];
    const triggerLabel = premiumData.all_triggers_today.find(t => t.active)?.trigger_name || randomDemoTrigger;

    try {
      await simulatePayout(payoutAmt, triggerLabel);

      // Artificial delay for premium feel
      setTimeout(() => {
        setIsSimulating(false);
        triggerNotification();

        // Refresh profile to get the new payout record
        fetchUserProfile()
          .then(setProfile)
          .catch(err => console.error("Profile refresh failed", err));
      }, 1500);
    } catch (error) {
      console.error("Payout simulation failed:", error);
      setIsSimulating(false);
      alert('❌ Simulation failed. Please ensure the server is running.');
    }
  };

  const triggerNotification = () => {
    setShowNotification(true);
    Animated.sequence([
      Animated.spring(noteAnim, { toValue: 50, useNativeDriver: true, tension: 50, friction: 8 }),
      Animated.delay(4000),
      Animated.timing(noteAnim, { toValue: -120, duration: 500, useNativeDriver: true })
    ]).start(() => {
      setShowNotification(false);
    });
  };

  return (
    <View style={styles.container}>
      {/* ── Top App Header ── */}
      <View style={styles.topNav}>
        <View style={styles.leftNavItems}>
          <TouchableOpacity style={styles.profileIcon} activeOpacity={0.7} onPress={() => navigation.navigate('Profile')}>
            <Ionicons name="person-circle-outline" size={40} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.brandTitle}>GigGuard</Text>
        </View>

        <View style={styles.weatherBadge}>
          {!weather ? (
            <ActivityIndicator color={colors.aqua} size="small" />
          ) : (
            <>
              <LottieView
                source={{ uri: getWeatherLottie(weather.weathercode) }}
                autoPlay
                loop
                style={styles.weatherLottie}
              />
              <Text style={styles.weatherText}>{Math.round(weather.temperature)}°C</Text>
            </>
          )}
        </View>
      </View>

      {/* ── Simulated Push Notification ── */}
      <Animated.View style={[styles.notificationContainer, { transform: [{ translateY: noteAnim }] }]}>
        <View style={styles.notificationInner}>
          <Image source={require('../../assets/logo.png')} style={styles.noteAppIcon} />
          <View style={{ flex: 1 }}>
            <View style={styles.noteHeader}>
              <Text style={styles.noteAppName}>GIGGUARD</Text>
              <Text style={styles.noteTime}>now</Text>
            </View>
            <Text style={styles.noteTitle}>Money Received! 💰</Text>
            <Text style={styles.noteBody}>
              ₹{Math.round(planDetails.expected_weekly_payout_inr)} sent via UPI for weather breach.
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* ── Confetti Celebration Animation ── */}
      {showNotification && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <LottieView
            source={{ uri: 'https://lottie.host/813eb98a-7d4a-4467-8736-22a36b328a3f/Z4l5yX5hV5.lottie' }}
            autoPlay
            loop={false}
            style={styles.confetti}
          />
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>

          <View style={styles.greetingHeader}>
            <Text style={styles.greetingText}>
              Hey <Text style={{ color: isExpired ? colors.danger : colors.aqua }}>{greeting.name}</Text>,
            </Text>
            <Text style={[styles.greetingMsg, isExpired && { color: colors.danger }]}>{greeting.msg}</Text>
          </View>

          {/* ── Expiry Alert Banner ── */}
          {isExpired && (
            <TouchableOpacity
              style={styles.expiryBanner}
              activeOpacity={0.85}
              onPress={() => (navigation as any).navigate('PlanSelection', { premiumData })}
            >
              <View style={styles.expiryBannerContent}>
                <View style={styles.expiryIconCircle}>
                  <Ionicons name="alert-circle" size={28} color={colors.danger} />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.expiryBannerTitle}>Coverage Expired</Text>
                  <Text style={styles.expiryBannerDesc}>
                    Your {activePlan} plan has ended. You are no longer protected against weather disruptions.
                  </Text>
                </View>
                <View style={styles.renewBadge}>
                  <Text style={styles.renewBadgeText}>RENEW</Text>
                  <Ionicons name="arrow-forward" size={14} color="#FFF" />
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* ── Unverified Profile Alert Banner ── */}
          {profile && profile.gig_verified !== true && (
            <TouchableOpacity
              style={[styles.expiryBanner, { backgroundColor: 'rgba(255, 140, 0, 0.1)', borderColor: 'rgba(255, 140, 0, 0.3)' }]}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Profile')}
            >
              <View style={styles.expiryBannerContent}>
                <View style={[styles.expiryIconCircle, { backgroundColor: 'rgba(255, 140, 0, 0.2)' }]}>
                  <Ionicons name="id-card-outline" size={24} color={colors.orange} />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={[styles.expiryBannerTitle, { color: colors.orange }]}>Verify Your ID</Text>
                  <Text style={styles.expiryBannerDesc}>
                    Link your delivery partner ID to unlock full trust score benefits and faster payouts.
                  </Text>
                </View>
                <View style={[styles.renewBadge, { backgroundColor: colors.orange }]}>
                  <Text style={styles.renewBadgeText}>VERIFY</Text>
                  <Ionicons name="arrow-forward" size={14} color="#FFF" />
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* ── Hero: Active plan banner ── */}
          <Animated.View style={[
            styles.heroBanner,
            {
              borderWidth: 1,
              borderColor: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [planColor + '20', planColor + '60']
              }),
              shadowColor: planColor,
              shadowOpacity: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.1, 0.4]
              }),
              shadowRadius: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 20]
              }),
              elevation: 4
            }
          ]}>
            <View style={styles.heroTop}>
              <View>
                <Text style={styles.heroLabel}>ACTIVE COVERAGE</Text>
                <Text style={[styles.heroPlan, { color: planColor }]}>
                  {planDetails.label.toUpperCase()} PLAN
                </Text>
              </View>
              <View style={[styles.activeBadge, { backgroundColor: isExpired ? colors.danger : planColor }]}>
                <Text style={styles.activeBadgeText}>
                  {isExpired ? 'EXPIRED' : daysRemaining !== null ? `EXP. IN ${daysRemaining} DAYS` : '● LIVE'}
                </Text>
              </View>
            </View>
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Weekly Premium</Text>
                <Text style={styles.heroStatValue}>₹{Math.round(planDetails.weekly_premium_inr)}</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Coverage</Text>
                <Text style={styles.heroStatValue}>{planDetails.coverage_pct}%</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Hours/Day</Text>
                <Text style={styles.heroStatValue}>{planDetails.coverage_hours_per_day}h</Text>
              </View>
            </View>
          </Animated.View>

          {/* ── Risk Gauge & Chart ── */}
          <View style={styles.gaugeSection}>
            <Text style={styles.sectionLabel}>7-DAY DISRUPTION FORECAST</Text>
            <View style={styles.gaugeContainer}>
              <RiskGauge
                value={lossRatio}
                riskLevel={premiumData.disruption_risk}
                size={180}
              />
            </View>
            <Text style={styles.forecastSummary}>{fr.forecast_summary}</Text>

            {/* ── Line Chart ── */}
            {fr.daily_risks && fr.daily_risks.length > 0 && (
              <View style={styles.chartWrapper}>
                <LineChart
                  data={{
                    labels: getNext7DaysLabels(),
                    datasets: [{
                      data: fr.daily_risks.map(r => r * 100), // convert to percentage
                    }]
                  }}
                  width={screenWidth - spacing.xl * 2}
                  height={200}
                  fromZero={true}
                  yAxisLabel=""
                  yAxisSuffix=""
                  formatYLabel={(yValue) => `${Math.round(parseFloat(yValue))}%`}
                  chartConfig={{
                    backgroundColor: 'transparent',
                    backgroundGradientFrom: colors.bgCard,
                    backgroundGradientTo: colors.bgCard,
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(0, 229, 255, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity * 0.7})`,
                    style: { borderRadius: borderRadius.lg },
                    propsForDots: {
                      r: "5",
                      strokeWidth: "2",
                      stroke: colors.orange
                    }
                  }}
                  bezier
                  style={styles.lineChart}
                />
              </View>
            )}
          </View>

          {/* ── Active Triggers with Real-Time Metrics ── */}
          <Text style={styles.sectionLabel}>REAL-TIME DISRUPTION TRIGGERS</Text>
          
          <View style={styles.triggersContainer}>
            {(showAllTriggers ? triggers : triggers.slice(0, 2)).map((t: TriggerInfo, i: number) => {
              const severityPct = Math.round(t.severity * 100);
              const barColor = t.severity > 0.5 ? colors.danger : t.severity > 0.25 ? colors.warning : colors.aqua;
              return (
                <View
                  key={i}
                  style={[
                    styles.triggerCard,
                    t.active && { borderColor: barColor + '40' },
                    !t.active && { opacity: 0.6, borderColor: 'rgba(255,255,255,0.02)' }
                  ]}
                >
                  <View style={styles.triggerHeader}>
                    {DISRUPTION_LOTTIES[t.trigger_id] ? (
                      <View style={[styles.triggerGif, !t.active && { opacity: 0.5 }]}>
                        <LottieView
                          source={{ uri: DISRUPTION_LOTTIES[t.trigger_id] }}
                          autoPlay
                          loop
                          style={{ width: '100%', height: '100%' }}
                        />
                      </View>
                    ) : (
                      <Text style={[styles.triggerIcon, !t.active && { opacity: 0.5 }]}>{t.icon}</Text>
                    )}
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.triggerName}>{t.trigger_name}</Text>
                      <Text style={[styles.triggerDesc, !t.active && { color: colors.success }]}>
                        {t.active ? t.description : "All clear — safe conditions"}
                      </Text>
                    </View>
                    <View style={[styles.severityBadge, { backgroundColor: t.active ? barColor + '20' : 'transparent' }]}>
                      <Text style={[styles.severityText, { color: t.active ? barColor : colors.success }]}>
                        {t.active ? `${severityPct}%` : "SAFE"}
                      </Text>
                    </View>
                  </View>

                  {/* Real-time metrics row */}
                  {t.active && (
                    <View style={styles.triggerMetrics}>
                      <View style={styles.metricItem}>
                        <Text style={styles.metricLabel}>Severity</Text>
                        <Text style={[styles.metricValue, { color: barColor }]}>{severityPct}%</Text>
                      </View>
                      <View style={styles.metricDivider} />
                      <View style={styles.metricItem}>
                        <Text style={styles.metricLabel}>Loss Factor</Text>
                        <Text style={styles.metricValue}>{t.loss_multiplier.toFixed(2)}x</Text>
                      </View>
                      <View style={styles.metricDivider} />
                      <View style={styles.metricItem}>
                        <Text style={styles.metricLabel}>Status</Text>
                        <Text style={[styles.metricValue, { color: colors.danger }]}>ACTIVE</Text>
                      </View>
                    </View>
                  )}

                  {/* Severity bar */}
                  <View style={styles.severityBarBg}>
                    <View style={[
                      styles.severityBarFill,
                      {
                        width: t.active ? `${Math.min(severityPct, 100)}%` : '0%',
                        backgroundColor: barColor,
                      },
                    ]} />
                  </View>
                </View>
              );
            })}
            
            {triggers.length > 2 && (
              <TouchableOpacity 
                style={{ alignItems: 'center', marginTop: 10, paddingVertical: 8 }}
                onPress={() => setShowAllTriggers(!showAllTriggers)}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: 'bold' }}>
                  {showAllTriggers ? 'View Less' : `+ ${triggers.length - 2} More Disruption Factors`}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Live Air Quality Monitor ── */}
          <Text style={styles.sectionLabel}>LIVE AIR QUALITY</Text>
          <AQIPanel latitude={premiumData.latitude} longitude={premiumData.longitude} />

          {/* ── City Disruption Feed ── */}
          <Text style={styles.sectionLabel}>CITY DISRUPTION FEED</Text>
          <CityAlertsFeed latitude={premiumData.latitude} longitude={premiumData.longitude} />

          {/* ── Judge/Dev Testing Tool ── */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, paddingHorizontal: spacing.sm }}>
            <Ionicons name="code-working-outline" size={18} color={colors.textMuted} />
            <Text style={[styles.sectionLabel, { marginBottom: 0, marginLeft: 8 }]}>JUDGE / DEV TESTING TOOL</Text>
          </View>
          
          <View style={[styles.claimCard, { backgroundColor: '#121418', borderColor: '#2D3139', borderStyle: 'dashed', borderWidth: 2 }]}>
            <View style={{ backgroundColor: 'rgba(0, 229, 255, 0.05)', padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.1)', marginBottom: spacing.lg }}>
              <Text style={{ color: colors.aqua, fontSize: fontSize.xs, fontWeight: 'bold', marginBottom: 4, letterSpacing: 1 }}>
                [ DEV_SANDBOX_ACTIVE ]
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 16 }}>
                Production uses <Text style={{fontWeight: 'bold', color: '#FFF'}}>Zero-Touch Parametric Autopay</Text> scanning every 30s. This terminal bypasses the scheduler for immediate testing.
              </Text>
            </View>

            {lossRatio > 0.15 ? (
              <View style={styles.claimWarningRow}>
                <Text style={styles.claimWarningIcon}>⚠️</Text>
                <Text style={[styles.claimWarningText, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12 }]}>
                  {'>'} THRESHOLD_BREACHED: TRUE
                </Text>
              </View>
            ) : (
              <View style={styles.claimWarningRow}>
                <Text style={styles.claimSafeIcon}>🟢</Text>
                <Text style={[styles.claimSafeText, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12 }]}>
                  {'>'} SYSTEM_STATUS: NORMAL
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.claimButton, isSimulating && { opacity: 0.6 }, lossRatio <= 0.15 && { backgroundColor: 'rgba(255, 152, 0, 0.15)', borderColor: colors.orange, marginTop: spacing.md }]}
              onPress={handleSimulate}
              disabled={isSimulating}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="terminal-outline" size={16} color={lossRatio <= 0.15 ? colors.orange : '#FFF'} style={{ marginRight: 8 }} />
                <Text style={[styles.claimButtonText, lossRatio <= 0.15 && { color: colors.orange }, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>
                  {isSimulating ? 'EXECUTING_PAYOUT...' : 'EXECUTE_FORCE_TRIGGER'}
                </Text>
              </View>
            </TouchableOpacity>
            
            <Text style={[styles.claimSubtext, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 9, opacity: 0.7 }]}>
              POST /policy/payout/simulate
            </Text>
          </View>

          {/* ── Model Info ── */}
          <View style={styles.modelInfo}>
            <Text style={styles.modelInfoText}>
              Model {premiumData.model_version} • R² {premiumData.model_r2.toFixed(4)} • {premiumData.date}
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </Animated.View>
      </ScrollView>

      {/* Floating Action Button for AI Chatbot */}
      <TouchableOpacity 
        style={styles.fab} 
        activeOpacity={0.8}
        onPress={() => setIsChatVisible(true)}
      >
        <LinearGradient 
          colors={['#5eead4', '#2dd4bf']} 
          style={styles.fabGradient}
        >
          <Image 
            source={require('../../assets/icons8-chatbot-100.png')} 
            style={{ width: 42, height: 42 }} 
            resizeMode="contain" 
          />
        </LinearGradient>
      </TouchableOpacity>

      <GigBotModal 
        visible={isChatVisible} 
        onClose={() => setIsChatVisible(false)} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: spacing.xl, paddingBottom: spacing.huge },

  // Top Nav
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: spacing.md,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  leftNavItems: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileIcon: {
    marginRight: spacing.sm,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: fontWeight.heavy,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  weatherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    paddingRight: spacing.md,
    paddingLeft: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  weatherLottie: {
    width: 28,
    height: 28,
    marginRight: 4,
  },
  weatherText: {
    color: colors.aqua,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.md,
  },

  // Hero
  heroBanner: {
    backgroundColor: colors.bgCard, borderRadius: borderRadius.xl,
    padding: spacing.xl, marginBottom: spacing.xxl,
    borderWidth: 1,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xl },
  heroLabel: { fontSize: fontSize.xs, color: colors.textMuted, letterSpacing: 1.5, marginBottom: 4 },
  heroPlan: { fontSize: 22, fontWeight: fontWeight.heavy },
  activeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full },
  activeBadgeText: { color: '#FFF', fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 1 },
  heroStats: { flexDirection: 'row', alignItems: 'center' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatLabel: { fontSize: 10, color: colors.textMuted, marginBottom: 4, textTransform: 'uppercase' },
  heroStatValue: { fontSize: fontSize.xl, fontWeight: fontWeight.heavy, color: colors.textPrimary },
  heroStatDivider: { width: 1, height: 30, backgroundColor: colors.border },

  // Gauge & Chart
  gaugeSection: { alignItems: 'center', marginBottom: spacing.xxxl },
  gaugeContainer: { marginVertical: spacing.lg },
  forecastSummary: {
    fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center',
    paddingHorizontal: spacing.xl, marginBottom: spacing.xl,
  },
  chartWrapper: {
    marginTop: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  lineChart: {
    borderRadius: borderRadius.lg,
    paddingRight: 20,
    paddingLeft: 10,  // Prevents Y-axis text from clipping on Android
  },

  // Section labels
  sectionLabel: {
    fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.aqua,
    letterSpacing: 2, marginBottom: spacing.lg,
  },

  // Coverage hours
  coverageHoursBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.15)',
  },
  coverageHoursText: {
    fontSize: fontSize.xs,
    color: colors.aqua,
    fontWeight: fontWeight.semibold,
    flex: 1,
  },

  // Triggers
  triggersContainer: { marginBottom: spacing.xxl },
  triggerCard: {
    backgroundColor: colors.bgCard, borderRadius: borderRadius.lg,
    padding: spacing.lg, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  triggerHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  triggerIcon: { fontSize: 32 },
  triggerGif: { width: 36, height: 36, borderRadius: 6 },
  triggerName: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary, marginBottom: 2 },
  triggerDesc: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  severityBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  severityText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textPrimary },
  severityBarBg: {
    height: 4, backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2, marginTop: spacing.md, overflow: 'hidden',
  },
  severityBarFill: { height: 4, borderRadius: 2 },
  
  // Claims
  claimCard: {
    backgroundColor: colors.bgCard, borderRadius: borderRadius.lg,
    padding: spacing.xl, marginBottom: spacing.xxl,
    borderWidth: 1, borderColor: colors.border,
  },
  claimWarningRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  claimWarningIcon: { fontSize: 24, marginRight: 10 },
  claimWarningText: { fontSize: fontSize.md, color: colors.danger, fontWeight: fontWeight.bold, flex: 1 },
  claimButton: {
    backgroundColor: colors.danger, paddingVertical: 16,
    borderRadius: borderRadius.lg, alignItems: 'center',
    ...shadows.card, shadowColor: colors.danger,
  },
  claimButtonText: { color: '#FFF', fontSize: fontSize.md, fontWeight: fontWeight.bold },
  claimSubtext: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md },
  claimSafeIcon: { fontSize: 32, marginBottom: spacing.sm },
  claimSafeText: { fontSize: fontSize.md, color: colors.success, fontWeight: fontWeight.semibold },

  // Model
  modelInfo: { alignItems: 'center', paddingVertical: spacing.lg },
  modelInfoText: { fontSize: 10, color: colors.textMuted, letterSpacing: 0.5 },

  // Trigger Metrics
  triggerMetrics: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 9,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.heavy,
    color: colors.textPrimary,
  },
  metricDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  // Greeting
  greetingHeader: {
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
  },
  greetingText: {
    fontSize: 28,
    fontWeight: fontWeight.heavy as any,
    color: colors.textPrimary,
    letterSpacing: -1.2,
    lineHeight: 34,
  },
  greetingMsg: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 22,
    letterSpacing: -0.2,
  },

  // Notification Banner
  notificationContainer: {
    position: 'absolute',
    top: 0, left: spacing.md, right: spacing.md,
    zIndex: 9999,
  },
  notificationInner: {
    backgroundColor: 'rgba(28, 28, 30, 0.95)',
    borderRadius: 24,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.elevated,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  noteAppIcon: {
    width: 38, height: 38,
    borderRadius: 8,
    marginRight: 12,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  noteAppName: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  noteTime: {
    fontSize: 10,
    color: colors.textMuted,
  },
  noteTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: 1,
  },
  noteBody: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  confetti: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    zIndex: 10000,
    pointerEvents: 'none',
  },
  
  // Chatbot FAB
  fab: {
    position: 'absolute',
    bottom: spacing.xxl,
    right: spacing.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    ...shadows.elevated,
    zIndex: 100,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.5)',
  },
  
  // Expiry Banner
  expiryBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: borderRadius.xl,
    padding: 2,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  expiryBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.xl - 2,
  },
  expiryIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  expiryBannerTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.danger,
    marginBottom: 4,
  },
  expiryBannerDesc: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 18,
    paddingRight: 10,
  },
  renewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  renewBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
});
