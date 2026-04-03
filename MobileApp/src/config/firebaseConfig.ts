import { initializeApp } from "firebase/app";
// @ts-ignore: getReactNativePersistence is not part of the standard web types but is required for React Native. 
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCYhjFDwv_WdDBMqM1FeuJZ7kWcgINUnxA",
  authDomain: "gigguard-62058.firebaseapp.com",
  projectId: "gigguard-62058",
  storageBucket: "gigguard-62058.firebasestorage.app",
  messagingSenderId: "279360873235",
  appId: "1:279360873235:web:21adcca32b18bb9b65f0e6",
  measurementId: "G-MK080LBXCE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with Persistence
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

export default app;
