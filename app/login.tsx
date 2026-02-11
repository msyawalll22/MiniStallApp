import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import React, { memo, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet, Text, TextInput, TouchableOpacity,
  View,
  useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../firebaseConfig';

// --- BACKGROUND BLOBS ---
const StaticBackground = memo(() => {
  const { width, height } = useWindowDimensions();
  const blob1 = useRef(new Animated.Value(0)).current;
  const blob2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createLoop = (anim: Animated.Value, duration: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ).start();
    };
    createLoop(blob1, 10000);
    createLoop(blob2, 15000);
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.blob, {
        width: 300, height: 300, backgroundColor: '#EEF2FF',
        transform: [
          { translateX: blob1.interpolate({ inputRange: [0, 1], outputRange: [-100, width - 100] }) },
          { translateY: blob1.interpolate({ inputRange: [0, 1], outputRange: [50, height - 200] }) }
        ]
      }]} />
      <Animated.View style={[styles.blob, {
        width: 250, height: 250, backgroundColor: '#F5F3FF',
        transform: [
          { translateX: blob2.interpolate({ inputRange: [0, 1], outputRange: [width - 50, -150] }) },
          { translateY: blob2.interpolate({ inputRange: [0, 1], outputRange: [height - 150, 0] }) }
        ]
      }]} />
    </View>
  );
});

export default function LoginScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { width } = useWindowDimensions();
  const isTablet = width > 768;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [stallName, setStallName] = useState('');
  const [ownerName, setOwnerName] = useState(''); // Renamed from managerName
  const [phone, setPhone] = useState(''); // Added Phone field
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isFocused) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }
  }, [isFocused]);

  const handleAuth = async () => {
    // Basic validation
    if (!email || !password || (isRegistering && (!stallName || !ownerName || !phone))) {
      return Alert.alert("Missing Info", "Please fill in all fields.");
    }

    setLoading(true);
    try {
      if (isRegistering) {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        
        // Update Firebase Auth profile
        await updateProfile(userCred.user, { displayName: ownerName });

        // Save only the essentials to Firestore
        await setDoc(doc(db, "users", userCred.user.uid), {
          uid: userCred.user.uid,
          ownerName,
          stallName,
          phone,
          email,
          role: 'vendor',
          isApproved: false,
          createdAt: new Date()
        });

        Alert.alert("Success", "Application submitted! Waiting for admin approval.");
        router.replace('/pending' as any); 
      } else {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, "users", userCred.user.uid));
        const userData = userDoc.data();

        if (userData?.role === 'admin') {
          return router.replace('/admin' as any);
        }

        if (userData?.role === 'vendor') {
          if (!userData?.isApproved) {
            return router.replace('/pending' as any);
          }
          router.replace('/vendor' as any); 
        }
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <StaticBackground />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={[styles.responsiveFormContainer, isTablet && styles.tabletFormWidth]}>
                <View style={styles.headerArea}>
                  <View style={styles.logoIcon}><Text style={styles.logoLetter}>M</Text></View>
                  <Text style={styles.title}>MiniStall <Text style={styles.titleAccent}>POS</Text></Text>
                  <Text style={styles.subtitle}>{isRegistering ? 'Vendor Registration' : 'Login to POS'}</Text>
                </View>

                {isRegistering && (
                  <View style={styles.trialBanner}>
                    <View style={styles.trialBadge}><Text style={styles.trialBadgeText}>OFFER</Text></View>
                    <Text style={styles.trialText}>Get a <Text style={{fontWeight: '900'}}>7-Day Free Trial</Text></Text>
                  </View>
                )}

                <View style={styles.form}>
                  {isRegistering && (
                    <>
                      <TextInput 
                        placeholder="Stall Name" 
                        placeholderTextColor="#94A3B8"
                        style={styles.input} 
                        value={stallName} 
                        onChangeText={setStallName} 
                      />
                      <TextInput 
                        placeholder="Owner Name" 
                        placeholderTextColor="#94A3B8"
                        style={[styles.input, { marginTop: 12 }]} 
                        value={ownerName} 
                        onChangeText={setOwnerName} 
                      />
                      <TextInput 
                        placeholder="Phone Number" 
                        placeholderTextColor="#94A3B8"
                        keyboardType="phone-pad"
                        style={[styles.input, { marginTop: 12 }]} 
                        value={phone} 
                        onChangeText={setPhone} 
                      />
                    </>
                  )}
                  <TextInput 
                    placeholder="Email Address" 
                    placeholderTextColor="#94A3B8"
                    style={[styles.input, { marginTop: 12 }]} 
                    value={email} 
                    onChangeText={setEmail} 
                    autoCapitalize="none" 
                  />
                  <TextInput 
                    placeholder="Password" 
                    placeholderTextColor="#94A3B8"
                    style={[styles.input, { marginTop: 12 }]} 
                    value={password} 
                    onChangeText={setPassword} 
                    secureTextEntry 
                  />
                  
                  <TouchableOpacity style={styles.mainBtn} onPress={handleAuth} disabled={loading}>
                    {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.mainBtnText}>{isRegistering ? 'Apply Now' : 'Login'}</Text>}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => setIsRegistering(!isRegistering)} style={styles.toggleBtn}>
                    <Text style={styles.toggleText}>{isRegistering ? 'Back to Login' : 'New Vendor? Start Here'}</Text>
                  </TouchableOpacity>
                </View>
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  blob: { position: 'absolute', borderRadius: 150, opacity: 0.6 },
  scrollContent: { padding: 30, justifyContent: 'center', alignItems: 'center', flexGrow: 1 },
  responsiveFormContainer: { width: '100%' },
  tabletFormWidth: { maxWidth: 400 },
  headerArea: { alignItems: 'center', marginBottom: 25 },
  logoIcon: { width: 70, height: 70, backgroundColor: '#0F172A', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  logoLetter: { color: '#FFF', fontSize: 36, fontWeight: '900' },
  title: { fontSize: 28, fontWeight: '900', color: '#0F172A' },
  titleAccent: { color: '#6366F1', fontWeight: '300' },
  subtitle: { color: '#64748B', marginTop: 10 },
  trialBanner: { 
    backgroundColor: '#6366F1', 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 14, 
    borderRadius: 14, 
    marginBottom: 20,
    elevation: 4
  },
  trialBadge: { backgroundColor: '#FFF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 10 },
  trialBadgeText: { color: '#6366F1', fontSize: 9, fontWeight: '900' },
  trialText: { color: '#FFF', fontSize: 14, fontWeight: '500' },
  form: { width: '100%' },
  input: { 
    backgroundColor: '#F8FAFC', 
    padding: 16, 
    borderRadius: 14, 
    borderWidth: 1, 
    borderColor: '#E2E8F0',
    color: '#000000',
    fontSize: 16
  },
  mainBtn: { backgroundColor: '#0F172A', padding: 18, borderRadius: 14, alignItems: 'center', marginTop: 20 },
  mainBtnText: { color: '#FFF', fontWeight: '700' },
  toggleBtn: { marginTop: 20, alignItems: 'center' },
  toggleText: { color: '#6366F1', fontWeight: '700' }
});