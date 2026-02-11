import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { useEffect } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebaseConfig';

export default function FreezeScreen() {
  const router = useRouter();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, "users", user.uid), 
      (snapshot) => {
        // Safety check: if user logged out while this was running, stop here
        if (!auth.currentUser) return;

        if (snapshot.exists()) {
          const data = snapshot.data();
          const isFrozen = data.isFrozen === true || data.status === 'frozen';
          const isApproved = data.isApproved === true && data.status !== 'pending';

          if (!isFrozen && isApproved) {
            console.log("🔓 Account unfrozen. Redirecting to POS...");
            router.replace('/vendor' as any);
          }
        }
      }, 
      (error) => {
        // 🟢 THE FIX: Catch the permission error that happens on logout
        if (error.code === 'permission-denied') {
          console.log("Freeze listener closed peacefully.");
        } else {
          console.error("Freeze Listener Error:", error);
        }
      }
    );

    return () => unsubscribe(); 
  }, []);

  const handleContactAdmin = () => {
    Linking.openURL(`whatsapp://send?phone=+60123456789&text=My account is frozen, I need assistance.`);
  };

  return (
    <View style={styles.container}>
      <Ionicons name="lock-closed" size={80} color="#EF4444" />
      <Text style={styles.title}>Account Frozen</Text>
      <Text style={styles.message}>
        Your account has been frozen by admin. Please contact support for activation.
      </Text>

      <TouchableOpacity style={styles.button} onPress={handleContactAdmin}>
        <Ionicons name="logo-whatsapp" size={20} color="#FFF" />
        <Text style={styles.buttonText}>Contact Admin</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutText} onPress={() => signOut(auth)}>
        <Text style={{ color: '#64748B', fontWeight: '600' }}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, backgroundColor: '#F8FAFC' },
  title: { fontSize: 24, fontWeight: '900', color: '#1E293B', marginTop: 20 },
  message: { fontSize: 16, color: '#64748B', textAlign: 'center', marginTop: 10, lineHeight: 24 },
  button: { flexDirection: 'row', backgroundColor: '#25D366', paddingVertical: 15, paddingHorizontal: 25, borderRadius: 12, marginTop: 30, alignItems: 'center', gap: 10 },
  buttonText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  logoutText: { marginTop: 40 }
});