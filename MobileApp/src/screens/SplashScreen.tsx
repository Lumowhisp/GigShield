import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { getToken, fetchUserProfile, fetchPremium } from '../services/api';
import * as Location from 'expo-location';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Splash'>;
};

export default function SplashScreen({ navigation }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    // Zomato/Blinkit style smooth transition: Spring scale + Fade
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();

    // Check for existing session after splash animation
    const timer = setTimeout(() => {
      checkExistingSession();
    }, 1800);

    return () => clearTimeout(timer);
  }, [navigation]);

  const checkExistingSession = async () => {
    try {
      const token = await getToken();

      if (!token) {
        // No saved session — go to Welcome/Login
        fadeOutAndNavigate('Welcome');
        return;
      }

      // Token exists — validate it by fetching profile
      const profile = await fetchUserProfile();

      if (!profile || !profile.email) {
        // Token expired or invalid
        fadeOutAndNavigate('Welcome');
        return;
      }

      console.log('🔑 Session restored for:', profile.email);

      // User is authenticated — check if they have an active policy
      if (profile.active_policy && profile.active_policy.status === 'active') {
        // Active policy exists — get fresh premium data and go straight to dashboard
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const premiumData = await fetchPremium(loc.coords.latitude, loc.coords.longitude);
            const tier = profile.active_policy.tier.toLowerCase();

            fadeOutAndNavigate('MainTabs', { premiumData, activePlan: tier });
            return;
          }
        } catch (locErr) {
          console.warn('Location fetch failed during session restore:', locErr);
        }

        // Location failed — still send to Location screen with active policy context
        fadeOutAndNavigate('Location', { activePolicy: profile.active_policy });
      } else {
        // No active policy — send to Location screen to pick a plan
        fadeOutAndNavigate('Location');
      }
    } catch (err) {
      console.warn('Session restore failed:', err);
      // Any error → fall back to login
      fadeOutAndNavigate('Welcome');
    }
  };

  const fadeOutAndNavigate = (screen: string, params?: any) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => {
      navigation.replace(screen as any, params);
    });
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[
        styles.content, 
        { 
          opacity: fadeAnim, 
          transform: [{ scale: scaleAnim }] 
        }
      ]}>
        <Image 
          source={require('../../assets/logo Background Removed 2.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>GigGuard</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131323', // Dark Navy Background
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  logo: {
    width: 360,
    height: 360,
    marginBottom: 20,
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF', // White text
    letterSpacing: 2,
  },
});
