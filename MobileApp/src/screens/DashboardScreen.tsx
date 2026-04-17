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
import { fetchUserProfile, simulatePayout, updateUserLocation, registerPushToken, fetchSimulatedPremium } from '../services/api';
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
  const { premiumData: routePremiumData, activePlan } = route.params;
  const [premiumData, setPremiumData] = useState<PremiumResponse>(routePremiumData);
  const planDetails = premiumData.plans[activePlan];
  const planColor = PLAN_COLORS[activePlan] || colors.orange;
  const [isSimulating, setIsSimulating] = useState(false);
  const [weather, setWeather] = useState<{ temperature: number; weathercode: number } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [showAllTriggers, setShowAllTriggers] = useState(false);

  // ── Simulator State ──
  const [simulatorMode, setSimulatorMode] = useState(false);
  const [simRain, setSimRain] = useState(0);
  const [simTemp, setSimTemp] = useState(30);
  const [simWind, setSimWind] = useState(15);
  const [isSimLoading, setIsSimLoading] = useState(false);
  const [pipelineLog, setPipelineLog] = useState<{step: string; status: 'pass'|'fail'|'warn'|'pending'}[]>([]);
  const [isAutopaying, setIsAutopaying] = useState(false);
  const [autopayResult, setAutopayResult] = useState<any>(null);

  // ── Simulator Effect ──
  useEffect(() => {
    if (!simulatorMode) return;
    const delayDebounceFn = setTimeout(async () => {
      setIsSimLoading(true);
      try {
        const newData = await fetchSimulatedPremium(
          premiumData.latitude, 
          premiumData.longitude, 
          (premiumData as any).daily_income || (premiumData as any).daily_income_inr || 800, 
          { rain: simRain, temp: simTemp, wind: simWind }
        );
        setPremiumData(newData);
      } catch (e) {
        console.error("Simulator API Error", e);
      } finally {
        setIsSimLoading(false);
      }
    }, 400); // 400ms debounce
    return () => clearTimeout(delayDebounceFn);
  }, [simRain, simTemp, simWind, simulatorMode, premiumData.latitude, premiumData.longitude]);

  const handleToggleSimulator = () => {
    if (simulatorMode) {
      setSimulatorMode(false);
      setPremiumData(routePremiumData); // Revert to real weather
      setSimRain(0);
      setSimTemp(30);
      setSimWind(15);
    } else {
      setSimulatorMode(true);
      // Initialize with current parsed weather to avoid jolts
      setSimRain(premiumData.today_weather?.precipitation_mm || 0);
      setSimTemp(premiumData.today_weather?.temp_max_c || 30);
      setSimWind(premiumData.today_weather?.wind_speed_max_kmh || 15);
      setPipelineLog([]);
      setAutopayResult(null);
    }
  };

  const PIPELINE_STEPS = [
    '1. JWT Auth Verification',
    '2. Active Policy + Expiry Check',
    '3. Trust-Tier Vesting Enforcement',
    '4. SUSPICIOUS Tier Gate',
    '5. Duplicate Claim Anti-Farm Check',
    '6. Composite Fraud Engine (GPS, IP, Behavioral)',
    '7. Global Velocity Circuit Breaker (₹50k/5min)',
    '8. Settlement Transfer + Trust Reward (+3)',
  ];

  const handleForceAutopay = async () => {
    setIsAutopaying(true);
    setAutopayResult(null);
    setPipelineLog([]);

    // Animate steps one by one
    for (let i = 0; i < PIPELINE_STEPS.length; i++) {
      setPipelineLog(prev => [...prev, { step: PIPELINE_STEPS[i], status: 'pending' }]);
      await new Promise(r => setTimeout(r, 350));
    }

    // Now actually fire the real backend
    const payoutAmt = Math.round(planDetails.expected_weekly_payout_inr);
    const triggerLabel = premiumData.all_triggers_today?.find((t: any) => t.active)?.trigger_name || 'Heavy Rain (>15mm/hr)';

    try {
      const res = await simulatePayout(payoutAmt, triggerLabel);
      // All steps passed
      setPipelineLog(PIPELINE_STEPS.map(s => ({ step: s, status: 'pass' as const })));
      setAutopayResult({ success: true, data: res });
      // Trigger the notification popup + refresh profile for passbook
      triggerNotification();
      fetchUserProfile().then(setProfile).catch(() => {});
    } catch (err: any) {
      const msg = err.message || 'Unknown error';
      // Figure out which step failed based on error message
      let failIdx = PIPELINE_STEPS.length - 1;
      if (msg.includes('token') || msg.includes('auth')) failIdx = 0;
      else if (msg.includes('No active policy') || msg.includes('expired')) failIdx = 1;
      else if (msg.includes('activating') || msg.includes('vesting') || msg.includes('activation')) failIdx = 2;
      else if (msg.includes('SUSPICIOUS') || msg.includes('blocked') && msg.includes('trust')) failIdx = 3;
      else if (msg.includes('Duplicate')) failIdx = 4;
      else if (msg.includes('Fraud') || msg.includes('teleportation') || msg.includes('Location')) failIdx = 5;
      else if (msg.includes('Circuit') || msg.includes('velocity') || msg.includes('freeze')) failIdx = 6;

      setPipelineLog(PIPELINE_STEPS.map((s, i) => ({
        step: s,
        status: i < failIdx ? 'pass' as const : i === failIdx ? 'fail' as const : 'pending' as const,
      })));
      setAutopayResult({ success: false, error: msg });
    } finally {
      setIsAutopaying(false);
    }
  };
  const [vestingSeconds, setVestingSeconds] = useState<number>(0);
  const [vestingTotal, setVestingTotal] = useState<number>(0);
  const [isFirstPolicy, setIsFirstPolicy] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const noteAnim = useRef(new Animated.Value(-100)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();

    // Extract weather directly from premiumData to avoid redundant Open-Meteo fetch and network errors
    if (premiumData?.today_weather) {
      setWeather({
        temperature: premiumData.today_weather.temp_max_c,
        weathercode: premiumData.today_weather.precipitation_mm > 0 ? 61 : 0 // 61=rain, 0=clear fallback
      });
    }

    // Fetch profile for policy info + vesting status
    fetchUserProfile()
      .then((data) => {
        setProfile(data);
        // Initialize vesting countdown from server data
        if (data?.vesting_status?.vesting_active) {
          setVestingSeconds(data.vesting_status.seconds_remaining || 0);
          setVestingTotal(data.vesting_status.hours_total || 2);
          setIsFirstPolicy(data.vesting_status.is_first_policy || false);
        }
      })
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

    // Pulse animation for vesting timer
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Vesting countdown timer — ticks every second
  useEffect(() => {
    if (vestingSeconds <= 0) return;
    const interval = setInterval(() => {
      setVestingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [vestingSeconds > 0]);

  const formatCountdown = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const vestingProgress = vestingTotal > 0 ? Math.max(0, 1 - (vestingSeconds / (vestingTotal * 3600))) : 1;

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

          {/* ── Vesting Activation Timer ── */}
          {vestingSeconds > 0 && (
            <View style={styles.vestingBanner}>
              <View style={styles.vestingContent}>
                <View style={styles.vestingIconRow}>
                  <Animated.View style={[styles.vestingPulse, { opacity: pulseAnim }]} />
                  <Ionicons name="hourglass-outline" size={22} color={colors.aqua} />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.vestingTitle}>
                    {isFirstPolicy ? '🎉 Welcome! Plan Activating...' : '🛡️ Plan Activating...'}
                  </Text>
                  <Text style={styles.vestingSubtitle}>
                    {isFirstPolicy
                      ? 'Your first coverage! Fast 2h activation period.'
                      : `${vestingTotal}h activation period for your trust tier.`}
                  </Text>
                  {/* Timer Display */}
                  <View style={styles.vestingTimerRow}>
                    <Text style={styles.vestingTimer}>{formatCountdown(vestingSeconds)}</Text>
                    <Text style={styles.vestingTimerLabel}>remaining</Text>
                  </View>
                  {/* Progress Bar */}
                  <View style={styles.vestingBarBg}>
                    <View style={[styles.vestingBarFill, { width: `${Math.round(vestingProgress * 100)}%` }]} />
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* ── Judge Sandbox Simulator Panel ── */}
          <TouchableOpacity 
            style={[styles.sandboxToggle, simulatorMode && styles.sandboxToggleActive]} 
            onPress={handleToggleSimulator}
            activeOpacity={0.8}
          >
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Text style={{fontSize: 20, marginRight: 8}}>🧠</Text>
              <Text style={[styles.sandboxToggleText, simulatorMode && {color: colors.aqua}]}>
                {simulatorMode ? 'EXIT JUDGE SANDBOX' : 'ENTER JUDGE SANDBOX'}
              </Text>
            </View>
            {isSimLoading && <ActivityIndicator color={colors.aqua} size="small" />}
          </TouchableOpacity>

          {simulatorMode && (
            <View style={styles.sandboxPanel}>
              <Text style={styles.sandboxHeader}>ML Override Parameters</Text>
              
              {/* Rain Control */}
              <View style={styles.sandboxControlRow}>
                <View style={styles.sandboxLabelCol}>
                  <Text style={styles.sandboxLabel}>🌧️ Rain (mm)</Text>
                  <Text style={styles.sandboxValue}>{simRain.toFixed(1)} mm</Text>
                </View>
                <View style={styles.sandboxStepper}>
                  <TouchableOpacity style={styles.stepperBtn} onPress={() => setSimRain(Math.max(0, simRain - 5))}><Text style={styles.stepperBtnText}>-</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.stepperBtn} onPress={() => setSimRain(simRain + 5)}><Text style={styles.stepperBtnText}>+</Text></TouchableOpacity>
                </View>
              </View>

              {/* Temp Control */}
              <View style={styles.sandboxControlRow}>
                <View style={styles.sandboxLabelCol}>
                  <Text style={styles.sandboxLabel}>🌡️ Temp (°C)</Text>
                  <Text style={styles.sandboxValue}>{simTemp.toFixed(1)} °C</Text>
                </View>
                <View style={styles.sandboxStepper}>
                  <TouchableOpacity style={styles.stepperBtn} onPress={() => setSimTemp(Math.max(0, simTemp - 2))}><Text style={styles.stepperBtnText}>-</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.stepperBtn} onPress={() => setSimTemp(simTemp + 2)}><Text style={styles.stepperBtnText}>+</Text></TouchableOpacity>
                </View>
              </View>

              {/* Wind Control */}
              <View style={styles.sandboxControlRow}>
                <View style={styles.sandboxLabelCol}>
                  <Text style={styles.sandboxLabel}>💨 Wind (km/h)</Text>
                  <Text style={styles.sandboxValue}>{simWind.toFixed(1)} km/h</Text>
                </View>
                <View style={styles.sandboxStepper}>
                  <TouchableOpacity style={styles.stepperBtn} onPress={() => setSimWind(Math.max(0, simWind - 10))}><Text style={styles.stepperBtnText}>-</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.stepperBtn} onPress={() => setSimWind(simWind + 10)}><Text style={styles.stepperBtnText}>+</Text></TouchableOpacity>
                </View>
              </View>
              
              <Text style={styles.sandboxWarning}>
                Values instantly sent to backend xgb.DMatrix bypassing Open-Meteo. Prediction dynamically alters gauges below.
              </Text>

              {/* ── ML Output Panel ── */}
              <View style={[styles.sandboxPanel, {marginTop: spacing.lg, backgroundColor: 'rgba(0,229,255,0.03)', borderColor: 'rgba(0,229,255,0.15)'}]}>
                <Text style={[styles.sandboxHeader, {marginBottom: spacing.md}]}>ML Prediction Output</Text>
                <View style={{flexDirection:'row', flexWrap:'wrap', gap: 10}}>
                  {[
                    {label: 'Loss Ratio', value: (premiumData.forecast_loss_ratio_7d * 100).toFixed(2) + '%', color: premiumData.forecast_loss_ratio_7d > 0.3 ? '#FF5252' : colors.success},
                    {label: 'Risk Level', value: premiumData.disruption_risk?.toUpperCase(), color: premiumData.disruption_risk === 'extreme' ? '#FF5252' : premiumData.disruption_risk === 'high' ? '#FF9800' : colors.aqua},
                    {label: 'Model', value: premiumData.model_version, color: colors.textSecondary},
                    {label: 'R²', value: premiumData.model_r2?.toFixed(4), color: colors.textSecondary},
                    {label: 'Suspended', value: premiumData.is_suspended ? '⛔ YES' : '✅ NO', color: premiumData.is_suspended ? '#FF5252' : colors.success},
                  ].map((item, i) => (
                    <View key={i} style={{minWidth: '45%', marginBottom: 8}}>
                      <Text style={{color: colors.textMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5}}>{item.label}</Text>
                      <Text style={{color: item.color, fontSize: 16, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'}}>{item.value}</Text>
                    </View>
                  ))}
                </View>
                {/* Active Triggers */}
                <Text style={{color: colors.textMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 6}}>Active Triggers Today</Text>
                {premiumData.all_triggers_today?.filter((t: any) => t.active).length === 0 ? (
                  <Text style={{color: colors.textMuted, fontSize: 12, fontStyle: 'italic'}}>No triggers active for current parameters</Text>
                ) : (
                  premiumData.all_triggers_today?.filter((t: any) => t.active).map((t: any, i: number) => (
                    <View key={i} style={{flexDirection:'row', alignItems:'center', marginBottom: 4}}>
                      <Text style={{fontSize: 14, marginRight: 6}}>{t.icon}</Text>
                      <Text style={{color: '#FF9800', fontSize: 12, fontWeight: '600'}}>{t.trigger_name}</Text>
                      <Text style={{color: colors.textMuted, fontSize: 10, marginLeft: 8}}>sev: {(t.severity * 100).toFixed(0)}%</Text>
                    </View>
                  ))
                )}
              </View>

              {/* ── Force Autopay Button ── */}
              <TouchableOpacity
                style={[styles.sandboxToggle, {marginTop: spacing.lg, backgroundColor: 'rgba(255, 152, 0, 0.1)', borderColor: 'rgba(255, 152, 0, 0.4)'}]}
                onPress={handleForceAutopay}
                disabled={isAutopaying}
                activeOpacity={0.7}
              >
                <View style={{flexDirection:'row', alignItems:'center'}}>
                  <Text style={{fontSize: 18, marginRight: 8}}>⚡</Text>
                  <Text style={{color: colors.orange, fontWeight: 'bold', fontSize: 12, letterSpacing: 1}}>
                    {isAutopaying ? 'PROCESSING PIPELINE...' : 'FORCE AUTOPAY TRIGGER'}
                  </Text>
                </View>
                {isAutopaying && <ActivityIndicator color={colors.orange} size="small" />}
              </TouchableOpacity>

              {/* ── Security Pipeline Log ── */}
              {pipelineLog.length > 0 && (
                <View style={[styles.sandboxPanel, {marginTop: spacing.md, backgroundColor: 'rgba(0,0,0,0.5)', borderColor: 'rgba(255,255,255,0.08)'}]}>
                  <Text style={[styles.sandboxHeader, {color: colors.orange}]}>8-Step Fraud Firewall Pipeline</Text>
                  {pipelineLog.map((entry, i) => (
                    <View key={i} style={{flexDirection:'row', alignItems:'center', marginBottom: 8}}>
                      <Text style={{fontSize: 14, width: 22}}>
                        {entry.status === 'pass' ? '✅' : entry.status === 'fail' ? '🚫' : entry.status === 'warn' ? '⚠️' : '⏳'}
                      </Text>
                      <Text style={{
                        color: entry.status === 'pass' ? colors.success : entry.status === 'fail' ? '#FF5252' : entry.status === 'warn' ? colors.orange : colors.textMuted,
                        fontSize: 11,
                        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                        flex: 1,
                      }}>{entry.step}</Text>
                    </View>
                  ))}
                  {/* Result Banner */}
                  {autopayResult && (
                    <View style={{
                      marginTop: 12,
                      padding: 12,
                      borderRadius: 8,
                      backgroundColor: autopayResult.success ? 'rgba(76,175,80,0.15)' : 'rgba(255,82,82,0.15)',
                      borderWidth: 1,
                      borderColor: autopayResult.success ? 'rgba(76,175,80,0.4)' : 'rgba(255,82,82,0.4)',
                    }}>
                      <Text style={{color: autopayResult.success ? colors.success : '#FF5252', fontWeight: 'bold', fontSize: 13, marginBottom: 4}}>
                        {autopayResult.success ? '✅ PAYOUT SETTLED' : '🚫 PAYOUT BLOCKED'}
                      </Text>
                      <Text style={{color: colors.textSecondary, fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'}}>
                        {autopayResult.success
                          ? `₹${autopayResult.data?.payout?.amount} settled | Trust: ${autopayResult.data?.trust_score} | Tier: ${autopayResult.data?.trust_tier}`
                          : autopayResult.error}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
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

          {/* Old testing tool removed — now in Judge Sandbox above */}

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

  // Sandbox Sandbox
  sandboxToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: spacing.md,
  },
  sandboxToggleActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.05)',
    borderColor: colors.aqua,
  },
  sandboxToggleText: {
    color: colors.textSecondary,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
    fontSize: 12,
  },
  sandboxPanel: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
    marginBottom: spacing.xl,
  },
  sandboxHeader: {
    color: colors.aqua,
    fontSize: 12,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.lg,
  },
  sandboxControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sandboxLabelCol: {
    flex: 1,
  },
  sandboxLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 4,
  },
  sandboxValue: {
    color: '#FFF',
    fontSize: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: 'bold',
  },
  sandboxStepper: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '300',
  },
  sandboxWarning: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: spacing.sm,
    fontStyle: 'italic',
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

  // Vesting Activation Timer
  vestingBanner: {
    backgroundColor: 'rgba(94, 234, 212, 0.06)',
    borderRadius: borderRadius.xl,
    marginBottom: spacing.xxl,
    borderWidth: 1.5,
    borderColor: 'rgba(94, 234, 212, 0.25)',
    overflow: 'hidden',
  },
  vestingContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.lg,
  },
  vestingIconRow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(94, 234, 212, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  vestingPulse: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(94, 234, 212, 0.5)',
  },
  vestingTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.aqua,
    marginBottom: 4,
  },
  vestingSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 17,
  },
  vestingTimerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  vestingTimer: {
    fontSize: 28,
    fontWeight: fontWeight.heavy as any,
    color: colors.aqua,
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  vestingTimerLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginLeft: 8,
  },
  vestingBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  vestingBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.aqua,
  },
});
