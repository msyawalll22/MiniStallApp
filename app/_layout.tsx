import { AntDesign, Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Font from 'expo-font';
import { Slot, useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { auth, db } from '../firebaseConfig';

export default function RootLayout() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const router = useRouter();
  const segments = useSegments();

 

  // 1. Font Loading
  useEffect(() => {
    async function loadWebIcons() {
      try {
        if (Platform.OS === 'web') {
          await Font.loadAsync({
            ...Ionicons.font,
            ...AntDesign.font,
            ...MaterialIcons.font,
          });
        }
      } catch (e) {
        console.warn("Font loading error:", e);
      } finally {
        setFontsLoaded(true);
      }
    }
    loadWebIcons();
  }, []);

  // 2. ⚡️ LIVE DATA LISTENER
  useEffect(() => {
    let unsubscribeSnapshot: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      
      if (u) {
        const userDocRef = doc(db, "users", u.uid);
        
        unsubscribeSnapshot = onSnapshot(userDocRef, (snapshot) => {
          if (snapshot.exists()) {
            setUserData(snapshot.data());
          }
          if (initializing) setInitializing(false);
        }, (error) => {
          if (error.code === 'permission-denied') {
            if (initializing) setInitializing(false);
          } else {
            console.error("Firestore error:", error);
          }
        });
      } else {
        setUserData(null);
        if (initializing) setInitializing(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []); 

  // 3. 🛡️ Routing Logic
  useEffect(() => {
    if (initializing || !fontsLoaded) return;

    const rootSegment = (segments[0] as string) || ''; 
    
    const authRoutes = ['login', 'register', '', 'index'];
    const inAuthGroup = authRoutes.includes(rootSegment);
    const inCustomerGroup = rootSegment === 'customer';

    // Case 1: No User Logged In
    if (!user) {
      if (!inCustomerGroup && !inAuthGroup) {
        router.replace('/login');
      }
      return;
    }

    // Case 2: Logged In
    const isBoss = user.uid === BOSS_UID;
    const isApproved = userData?.isApproved === true;
    const isRejected = userData?.status === 'rejected'; // Added rejection check

    if (isBoss) {
      if (rootSegment !== 'admin') {
        router.replace('/admin');
      }
    } else {
      // --- VENDOR LOGIC ---
      if (isApproved) {
        // If approved, clear them out of restricted screens
        if (rootSegment !== 'vendor' && (inAuthGroup || rootSegment === 'pending' || rootSegment === 'rejected')) {
          router.replace('/vendor');
        }
      } 
      else if (isRejected) {
        // NEW: If the status is explicitly 'rejected', force them to the rejected screen
        if (rootSegment !== 'rejected') {
          router.replace('/rejected');
        }
      } 
      else {
        // If NOT approved and NOT rejected, they are pending
        if (rootSegment !== 'pending' && !inAuthGroup && !inCustomerGroup) {
          router.replace('/pending');
        }
      }
    }
  }, [user, userData, segments, initializing, fontsLoaded]);

  if (initializing || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <Slot />
    </SafeAreaProvider>
  );
}