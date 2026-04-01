import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Splash'>;
};

export default function SplashScreen({ navigation }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.7)).current; // Start smaller

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

    // Fade out smoothly before navigating
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400, // Smooth fade out
        useNativeDriver: true,
      }).start(() => {
        navigation.replace('Welcome');
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigation]);

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
