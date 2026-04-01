import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import SplashScreen from './src/screens/SplashScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import LocationPermissionScreen from './src/screens/LocationPermissionScreen';
import PlanSelectionScreen from './src/screens/PlanSelectionScreen';
import DashboardScreen from './src/screens/DashboardScreen';

import { colors } from './src/theme';

import type { PremiumResponse } from './src/services/api';

export type RootStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  Location: undefined;
  PlanSelection: { premiumData: PremiumResponse };
  MainDashboard: { premiumData: PremiumResponse; activePlan: 'basic' | 'standard' | 'premium' };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const customTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bgElevated,
    text: colors.textPrimary,
    border: colors.border,
    primary: colors.orange,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer theme={customTheme}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.textPrimary,
            headerShadowVisible: false,
            animation: 'fade_from_bottom',
            headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          }}
          initialRouteName="Splash"
        >
          <Stack.Screen
            name="Splash"
            component={SplashScreen}
            options={{ headerShown: false, animation: 'fade' }}
          />
          <Stack.Screen
            name="Welcome"
            component={WelcomeScreen}
            options={{ headerShown: false, animation: 'fade' }}
          />
          <Stack.Screen
            name="Location"
            component={LocationPermissionScreen}
            options={{ headerShown: false, animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="PlanSelection"
            component={PlanSelectionScreen}
            options={{
              headerShown: false,
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="MainDashboard"
            component={DashboardScreen}
            options={{
              title: 'GigGuard',
              headerLeft: () => null,
              animation: 'fade',
              headerStyle: { backgroundColor: colors.bg },
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}