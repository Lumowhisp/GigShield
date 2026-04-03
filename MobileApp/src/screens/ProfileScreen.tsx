import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../theme';
import { fetchUserProfile, updateUserProfile, clearToken } from '../services/api';
import { auth } from '../config/firebaseConfig';
import { signOut } from 'firebase/auth';
import { CommonActions } from '@react-navigation/native';
import { Alert } from 'react-native';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function ProfileScreen({ navigation }: any) {
  // ── Form State ──
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [riderId, setRiderId] = useState('GG-2024-8842'); // Fallback default
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // ── Verification State ──
  const [gigId, setGigId] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [gigVerified, setGigVerified] = useState(false);

  // ── Address State ──
  const [pincode, setPincode] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [isLoadingPin, setIsLoadingPin] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── Animation States ──
  const progressAnim = new Animated.Value(0);

  // ── Derived State ──
  const fields = [name, dob, mobile, otpVerified, gigId, gigVerified, address, city, stateName];
  const filledFields = fields.filter((f) => f === true || (typeof f === 'string' && f.length > 0)).length;
  const completionPercent = Math.round((filledFields / fields.length) * 100);
  const trustScore = gigVerified ? 100 : 0;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: completionPercent,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [completionPercent]);

  // ── Fetch Profile Data ──
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setIsVerifying(true); // Reuse as loading
      const data = await fetchUserProfile();
      if (data) {
        if (data.name) setName(data.name);
        if (data.dob) {
          setDob(data.dob);
          // Try to parse DOB (DD/MM/YYYY) into Date object for picker
          const parts = data.dob.split('/');
          if (parts.length === 3) {
            const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            if (!isNaN(d.getTime())) setSelectedDate(d);
          }
        }
        if (data.mobile) setMobile(data.mobile);
        if (data.pincode) setPincode(data.pincode);
        if (data.address) setAddress(data.address);
        if (data.city) setCity(data.city);
        if (data.state) setStateName(data.state);
        if (data.gig_id) setGigId(data.gig_id);
        if (data.gig_verified) setGigVerified(data.gig_verified);
        if (data.gig_rider_id) setRiderId(data.gig_rider_id);
        if (data.mobile) setOtpVerified(true);
      }
    } catch (error) {
      console.error('Failed to load profile', error);
      Alert.alert('Error', 'Could not load profile data');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const updateData = {
        name,
        dob,
        mobile,
        pincode,
        address,
        city,
        state: stateName,
        gig_id: gigId,
        gig_verified: gigVerified
      };
      
      await updateUserProfile(updateData);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error: any) {
      console.error('Update profile error', error);
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  // ── Handlers ──
  const handleVerifyGig = () => {
    if (!gigId) return;
    setIsVerifying(true);
    setTimeout(async () => {
      try {
        await updateUserProfile({ gig_verified: true, gig_id: gigId });
        setGigVerified(true);
      } catch (error) {
        console.error("Verification sync failed", error);
        Alert.alert("Sync Error", "Verification succeeded locally but failed to sync to the server.");
      } finally {
        setIsVerifying(false);
      }
    }, 2000); // 2-second mock verification
  };

  const handleSendOtp = () => {
    if (mobile.length < 10) return;
    setShowOtp(true);
  };

  const handleVerifyOtp = () => {
    if (otp.length > 0) {
      setOtpVerified(true);
      setShowOtp(false);
    }
  };

  const handlePincodeChange = async (val: string) => {
    setPincode(val);
    if (val.length === 6) {
      setIsLoadingPin(true);
      try {
        const response = await fetch(`https://api.postalpincode.in/pincode/${val}`);
        const data = await response.json();
        if (data[0].Status === 'Success') {
          const postOffice = data[0].PostOffice[0];
          setCity(postOffice.District);
          setStateName(postOffice.State);
        }
      } catch (error) {
        console.error('PIN fetch error', error);
      } finally {
        setIsLoadingPin(false);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await clearToken();           // Clear JWT from SecureStore
      await signOut(auth);          // Sign out Firebase session
    } catch (e) {
      console.error('Logout cleanup error:', e);
    }
    // Reset entire navigation stack to Login
    navigation.getParent()?.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      })
    );
  };

  const onDateChange = (event: any, selected?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selected) {
      setSelectedDate(selected);
      // Format as DD/MM/YYYY
      const day = String(selected.getDate()).padStart(2, '0');
      const month = String(selected.getMonth() + 1).padStart(2, '0');
      const year = selected.getFullYear();
      setDob(`${day}/${month}/${year}`);
    }
  };

  // ── SVG Calculation ──
  const size = 100;
  const strokeWidth = 6;
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* ── Header Area ── */}
        <View style={styles.header}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarInner}>
              <Ionicons name="person" size={50} color={colors.textSecondary} />
              {gigVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={24} color={colors.aqua} />
                </View>
              )}
            </View>
            <Svg width={size} height={size} style={styles.progressRing}>
              <Circle
                cx={center}
                cy={center}
                r={radius}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth={strokeWidth}
                fill="none"
              />
              <AnimatedCircle
                cx={center}
                cy={center}
                r={radius}
                stroke={completionPercent === 100 ? colors.success : colors.orange}
                strokeWidth={strokeWidth}
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={strokeDashoffset as any}
                strokeLinecap="round"
                fill="none"
                transform={`rotate(-90 ${center} ${center})`}
              />
            </Svg>
          </View>
          
          <Text style={styles.profileName}>{name || 'Rider Persona'}</Text>
          <Text style={styles.riderId}>{riderId}</Text>
          
          <View style={styles.trustScoreContainer}>
            <Text style={styles.trustLabel}>TRUST SCORE</Text>
            <Text style={[styles.trustValue, { color: gigVerified ? colors.success : colors.danger }]}>
              {trustScore}%
            </Text>
          </View>

          {/* ── Save Button ── */}
          <TouchableOpacity 
            style={styles.saveHeaderButton} 
            onPress={handleSaveProfile}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.orange} size="small" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color={colors.orange} />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Profile Completion Bar ── */}
        <View style={styles.completionBarWrapper}>
          <View style={styles.completionHeader}>
            <Text style={styles.completionText}>Profile Completion</Text>
            <Text style={styles.completionText}>{completionPercent}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <Animated.View 
              style={[
                styles.progressBarFill, 
                { width: `${completionPercent}%`, backgroundColor: completionPercent === 100 ? colors.success : colors.orange }
              ]} 
            />
          </View>
        </View>

        {/* ── Verification Card ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.orange} />
            <Text style={styles.cardTitle}>Gig Worker Verification</Text>
          </View>
          <Text style={styles.cardSub}>Enter your platform ID (Swiggy, Uber, etc.)</Text>
          
          <TextInput
            style={styles.input}
            placeholder="Gig Platform ID"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={gigId}
            onChangeText={setGigId}
            editable={!gigVerified}
          />
          
          <TouchableOpacity 
            style={[styles.verifyButton, gigVerified && styles.buttonSuccess]} 
            onPress={handleVerifyGig}
            disabled={isVerifying || gigVerified || !gigId}
          >
            {isVerifying ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.buttonText}>
                {gigVerified ? '✅ VERIFIED STATUS' : 'VERIFY NOW'}
              </Text>
            )}
          </TouchableOpacity>

          {/* ── Hackathon Notice ── */}
          <View style={styles.noticeContainer}>
            <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
            <Text style={styles.noticeText}>
              HACKATHON DEMO: Automated verification active. Real-world builds will authenticate via Swiggy/Zomato/Uber partner APIs.
            </Text>
          </View>
        </View>

        {/* ── Personal Information ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Personal Details</Text>
          
          <View style={styles.fieldLabelRow}>
            <Text style={styles.fieldLabel}>Full Name</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Enter your name"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={name}
            onChangeText={setName}
          />

          <View style={styles.fieldLabelRow}>
            <Text style={styles.fieldLabel}>Date of Birth</Text>
          </View>
          <TouchableOpacity 
            style={styles.dateSelector} 
            activeOpacity={0.7}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={[styles.dateText, !dob && { color: 'rgba(255,255,255,0.3)' }]}>
              {dob || 'Select Date (DD/MM/YYYY)'}
            </Text>
            <Ionicons name="calendar-outline" size={20} color={colors.orange} />
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onDateChange}
              maximumDate={new Date()} // Can't be born in the future
            />
          )}
        </View>

        {/* ── Mobile & OTP ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Mobile Verification</Text>
          <View style={styles.phoneInputRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Mobile Number"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="phone-pad"
              value={mobile}
              onChangeText={setMobile}
              editable={!otpVerified}
            />
            {!otpVerified && !showOtp && (
              <TouchableOpacity style={styles.sendButton} onPress={handleSendOtp}>
                <Text style={styles.sendText}>SEND OTP</Text>
              </TouchableOpacity>
            )}
          </View>

          {showOtp && (
            <View style={styles.otpRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Enter 6-digit OTP"
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="number-pad"
                value={otp}
                onChangeText={setOtp}
              />
              <TouchableOpacity style={styles.verifyOtpButton} onPress={handleVerifyOtp}>
                <Text style={styles.verifyOtpText}>VERIFY</Text>
              </TouchableOpacity>
            </View>
          )}

          {otpVerified && (
            <View style={styles.verifiedRow}>
              <Ionicons name="checkmark-done-circle" size={18} color={colors.success} />
              <Text style={styles.verifiedText}>Mobile number linked successfully</Text>
            </View>
          )}
        </View>

        {/* ── Address & PIN Auto-fill ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Work Address</Text>
          
          <View style={styles.pinRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>PIN Code</Text>
              <TextInput
                style={styles.input}
                placeholder="600001"
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="number-pad"
                maxLength={6}
                value={pincode}
                onChangeText={handlePincodeChange}
              />
            </View>
            {isLoadingPin && <ActivityIndicator style={{ marginLeft: 10, marginTop: 15 }} color={colors.orange} />}
          </View>

          <View style={styles.addressGrid}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.fieldLabel}>City</Text>
              <TextInput
                style={[styles.input, { backgroundColor: 'rgba(255,255,255,0.02)' }]}
                placeholder="City Name"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={city}
                editable={false}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>State</Text>
              <TextInput
                style={[styles.input, { backgroundColor: 'rgba(255,255,255,0.02)' }]}
                placeholder="State"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={stateName}
                editable={false}
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Area / Street / House No.</Text>
          <TextInput
            style={styles.input}
            placeholder="Building, Street, Sector"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={address}
            onChangeText={setAddress}
          />
        </View>

        {/* ── Action List ── */}
        <View style={styles.actionList}>
          <TouchableOpacity 
            style={styles.actionItem} 
            onPress={() => Linking.openURL('mailto:kumaraditya12981006@gmail.com?subject=Help and Support')}
          >
            <Ionicons name="help-buoy-outline" size={22} color={colors.textSecondary} />
            <Text style={styles.actionText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.2)" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionItem} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color={colors.danger} />
            <Text style={[styles.actionText, { color: colors.danger }]}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    paddingHorizontal: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 30,
  },
  avatarWrapper: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  progressRing: {
    position: 'absolute',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    backgroundColor: colors.bg,
    borderRadius: 12,
  },
  profileName: {
    fontSize: 22,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginTop: 15,
  },
  riderId: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
    letterSpacing: 1,
  },
  trustScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  trustLabel: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    marginRight: 6,
    letterSpacing: 1,
  },
  trustValue: {
    fontSize: 14,
    fontWeight: fontWeight.heavy,
  },

  // Completion Bar
  completionBarWrapper: {
    marginBottom: 30,
  },
  completionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  completionText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },

  // Cards
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginLeft: 8,
  },
  cardSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: borderRadius.md,
    height: 50,
    paddingHorizontal: 16,
    color: colors.textPrimary,
    fontSize: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.02)',
  },
  verifyButton: {
    backgroundColor: colors.orange,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  buttonSuccess: {
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
    borderWidth: 1,
    borderColor: colors.success,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: fontWeight.heavy,
    color: '#000',
    letterSpacing: 1,
  },

  // Phone & OTP
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sendButton: {
    backgroundColor: 'rgba(255, 140, 0, 0.1)',
    height: 50,
    paddingHorizontal: 12,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 140, 0, 0.2)',
  },
  sendText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.orange,
  },
  otpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  verifyOtpButton: {
    backgroundColor: colors.orange,
    height: 50,
    paddingHorizontal: 16,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
  },
  verifyOtpText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: '#000',
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  verifiedText: {
    fontSize: 12,
    color: colors.success,
    marginLeft: 6,
  },

  // Address
  pinRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressGrid: {
    flexDirection: 'row',
    marginBottom: 0,
  },

  // Actions
  actionList: {
    marginTop: 10,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    gap: 14,
  },
  actionText: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
  },
  saveHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: 'rgba(255, 140, 0, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 140, 0, 0.2)',
    gap: 8,
  },
  saveButtonText: {
    color: colors.orange,
    fontSize: 13,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noticeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
    gap: 6,
    paddingHorizontal: 4,
  },
  noticeText: {
    fontSize: 10,
    color: colors.textMuted,
    lineHeight: 14,
    flex: 1,
    fontStyle: 'italic',
  },
  dateSelector: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: borderRadius.md,
    height: 50,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.02)',
  },
  dateText: {
    color: colors.textPrimary,
    fontSize: 14,
  },
});
