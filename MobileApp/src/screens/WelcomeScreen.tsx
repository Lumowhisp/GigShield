import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Image } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type SetupStackParamList = {
  Welcome: undefined;
  Login: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<SetupStackParamList, 'Welcome'>;
};

export default function WelcomeScreen({ navigation }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View 
        style={[
          styles.content, 
          { 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <Image 
          source={require('../../assets/logo Background Removed 2.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
        
        <Text style={styles.title}>GigGuard</Text>
        <Text style={styles.subtitle}>
          AI-Powered Weather Protection for Delivery Partners
        </Text>
        
        <View style={styles.featuresList}>
          <FeatureItem icon="🌧️" text="Automatic payouts on severe weather" />
          <FeatureItem icon="⚡" text="Instant UPI transfer, zero paperwork" />
          <FeatureItem icon="🧠" text="Fair pricing based on precise zone risk" />
        </View>
      </Animated.View>

      <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
        <TouchableOpacity 
          style={styles.primaryButton}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </TouchableOpacity>
        <Text style={styles.termsText}>
          By continuing, you agree to our Terms of Service & Privacy Policy
        </Text>
      </Animated.View>
    </View>
  );
}

function FeatureItem({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131323', // Dark Navy Background
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 140,
    height: 140,
    marginBottom: 20,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: '#00E5FF', // Aqua accent for the main title
    marginBottom: 8,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    color: '#B0B0C0', // Soft gray
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  featuresList: {
    width: '100%',
    backgroundColor: '#1E1E32', // Slightly lighter navy for cards
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.3)', // Subtle burnt orange border
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureIcon: {
    fontSize: 20,
    marginRight: 16,
  },
  featureText: {
    fontSize: 16,
    color: '#FFFFFF', // White text for features
    flex: 1,
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
  },
  primaryButton: {
    backgroundColor: '#FF6B35', // Burnt orange for the CTA button
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#FF6B35',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  termsText: {
    fontSize: 12,
    color: '#B0B0C0',
    textAlign: 'center',
  },
});
