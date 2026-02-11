import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react'; // Added useRef
import {
  ActivityIndicator,
  Alert,
  Animated, // Added Animated
  Easing // Added Easing
  ,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { auth, db } from '../firebaseConfig';

export default function RejectedScreen() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- ANIMATION VALUES ---
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start looping animations
    Animated.loop(
      Animated.parallel([
        // Pulse Effect
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.1,
            duration: 1500,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ]),
        // Continuous Rotation for the background squares
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 10000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    ).start();

    const user = auth.currentUser;
    if (!user) {
      router.replace('/login');
      return;
    }

    const unsubscribe = onSnapshot(doc(db, "users", user.uid), (snapshot) => {
      if (snapshot.exists()) {
        setUserData(snapshot.data());
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleReappeal = async () => {
    if (!auth.currentUser) return;
    setIsSubmitting(true);
    try {
      const userRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(userRef, {
        status: 'pending',
        isApproved: false,
        reappealedAt: serverTimestamp(),
      });
      Alert.alert("Appeal Submitted", "Your application is back in the queue for review.");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    router.replace('/login');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.content}>
        {/* --- ANIMATED ICON SECTION --- */}
        <View style={styles.iconContainer}>
          {/* Rotating Square 1 */}
          <Animated.View style={[
            styles.animatedSquare, 
            { transform: [{ rotate: spin }, { scale: scaleAnim }], opacity: 0.1 }
          ]} />
          {/* Rotating Square 2 (Offset) */}
          <Animated.View style={[
            styles.animatedSquare, 
            { transform: [{ rotate: '45deg' }, { rotate: spin }, { scale: scaleAnim }], opacity: 0.05 }
          ]} />
          
          <Animated.View style={[styles.iconCircle, { transform: [{ scale: scaleAnim }] }]}>
            <Ionicons name="alert-circle" size={60} color="#EF4444" />
          </Animated.View>
        </View>

        <View style={styles.textSection}>
          <Text style={styles.title}>Application Rejected</Text>
          <Text style={styles.subtitle}>
            We've reviewed your request, but unfortunately, it was not approved at this time.
          </Text>
        </View>

        <View style={styles.reasonCard}>
          <View style={styles.reasonHeader}>
            <Ionicons name="chatbox-ellipses-outline" size={16} color="#64748B" />
            <Text style={styles.reasonHeaderText}>FEEDBACK FROM ADMIN</Text>
          </View>
          <Text style={styles.reasonText}>
            {userData?.rejectionReason || "No specific reason provided. Please ensure your stall details are accurate."}
          </Text>
        </View>

        <View style={styles.buttonSection}>
          <TouchableOpacity 
            style={[styles.primaryBtn, isSubmitting && { opacity: 0.7 }]} 
            onPress={handleReappeal}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.primaryBtnText}>Re-submit Application</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={handleLogout}>
            <Text style={styles.secondaryBtnText}>Sign out and use another account</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Need help? Contact support@yourplatform.com</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, paddingHorizontal: 30, justifyContent: 'center' },
  iconContainer: { alignItems: 'center', marginBottom: 40, justifyContent: 'center' },
  // The Rotating Square background
  animatedSquare: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 30,
    backgroundColor: '#EF4444',
  },
  iconCircle: { 
    width: 110, 
    height: 110, 
    borderRadius: 55, 
    backgroundColor: '#FEF2F2', 
    justifyContent: 'center', 
    alignItems: 'center',
    zIndex: 2,
    // Add a slight shadow to make it pop from the background animation
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10
  },
  textSection: { alignItems: 'center', marginBottom: 30 },
  title: { fontSize: 26, fontWeight: '900', color: '#1E293B', marginBottom: 12 },
  subtitle: { 
    fontSize: 15, 
    color: '#64748B', 
    textAlign: 'center', 
    lineHeight: 22,
    paddingHorizontal: 10 
  },
  reasonCard: { 
    backgroundColor: '#F8FAFC', 
    borderRadius: 20, 
    padding: 20, 
    borderWidth: 1, 
    borderColor: '#E2E8F0',
    marginBottom: 30 
  },
  reasonHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    marginBottom: 10 
  },
  reasonHeaderText: { 
    fontSize: 11, 
    fontWeight: '800', 
    color: '#64748B', 
    letterSpacing: 1 
  },
  reasonText: { fontSize: 15, color: '#334155', lineHeight: 24, fontWeight: '500' },
  buttonSection: { gap: 12 },
  primaryBtn: { 
    backgroundColor: '#6366F1', 
    height: 58, 
    borderRadius: 18, 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    gap: 10,
    elevation: 4,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8
  },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  secondaryBtn: { 
    height: 50, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  secondaryBtnText: { color: '#94A3B8', fontSize: 14, fontWeight: '600' },
  footer: { paddingBottom: 20, alignItems: 'center' },
  footerText: { color: '#CBD5E1', fontSize: 12, fontWeight: '500' }
});