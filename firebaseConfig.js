import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth
} from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// 1. Initialize App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// 2. Initialize Auth
export const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  } catch (error) {
    return getAuth(app);
  }
})();

// 3. Initialize Firestore (Optimized for Connectivity & Speed)
export const db = (() => {
  try {
    return initializeFirestore(app, {
      localCache: memoryLocalCache(),
      // ⚡️ ADDED: Forces long polling to bypass network connection errors
      experimentalForceLongPolling: true, 
    });
  } catch (error) {
    return getFirestore(app);
  }
})();