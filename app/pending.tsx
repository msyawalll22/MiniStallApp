import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebaseConfig';

export default function PendingScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // 🛡️ ADMIN CONFIG
  const ADMIN_PHONE = "60123456789"; // 👈 REPLACE with your actual WhatsApp number

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return router.replace('/login');

      // Force reload auth state and check Firestore
      await user.reload(); 
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const isApproved = userDoc.data()?.isApproved === true;

      if (isApproved) {
        Alert.alert("Success", "Account activated!", [
          { text: "Open Dashboard", onPress: () => router.replace('/vendor') }
        ]);
      } else {
        // Updated Alert Message
        Alert.alert("Status", "Your account is still pending. Please wait until admin approves your account.");
      }
    } catch (error) {
      Alert.alert("Error", "Could not refresh status.");
    } finally {
      setLoading(false);
    }
  };

  const contactAdmin = () => {
    const message = `Hello Admin, I have registered on MiniStall POS.\n\nPlease approve my account.\n\nEmail: ${auth.currentUser?.email}`;
    const url = `https://wa.me/${ADMIN_PHONE}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => Alert.alert("Error", "WhatsApp is not installed."));
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerArea}>
        <View style={styles.mainIcon}>
          <Ionicons name="time-outline" size={60} color="#6366F1" />
        </View>
        <Text style={styles.title}>Account Pending</Text>
        <Text style={styles.subtitle}>
          Please wait until admin approve your account. To activate faster you can try contact admin by click the whatsapp link below.
        </Text>
        <Text style={[styles.subtitle, { marginTop: 10, fontSize: 14, fontStyle: 'italic' }]}>
          You can also click refresh button to make sure your account has been activate or not.
        </Text>
      </View>

      <View style={styles.buttonGroup}>
        <TouchableOpacity style={styles.whatsappBtn} onPress={contactAdmin}>
          <Ionicons name="logo-whatsapp" size={20} color="#FFF" />
          <Text style={styles.whatsappBtnText}>Contact Admin</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFF" /> : (
            <>
              <Ionicons name="reload" size={20} color="#FFF" />
              <Text style={styles.refreshBtnText}>Refresh Status</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={styles.logoutLink} 
        onPress={async () => {
          await auth.signOut();
          router.replace('/login');
        }}
      >
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', padding: 40, justifyContent: 'center' },
  headerArea: { alignItems: 'center', marginBottom: 40 },
  mainIcon: { 
    width: 120, height: 120, backgroundColor: '#EEF2FF', 
    borderRadius: 60, justifyContent: 'center', alignItems: 'center', marginBottom: 20 
  },
  title: { fontSize: 26, fontWeight: '900', color: '#0F172A', marginBottom: 12 },
  subtitle: { textAlign: 'center', color: '#64748B', fontSize: 16, lineHeight: 24 },
  buttonGroup: { width: '100%', gap: 15 },
  whatsappBtn: { 
    backgroundColor: '#25D366', flexDirection: 'row', height: 64, 
    borderRadius: 18, justifyContent: 'center', alignItems: 'center', gap: 10,
    elevation: 4, shadowColor: '#25D366', shadowOpacity: 0.3, shadowRadius: 10
  },
  whatsappBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  refreshBtn: { 
    backgroundColor: '#6366F1', flexDirection: 'row', height: 60, 
    borderRadius: 18, justifyContent: 'center', alignItems: 'center', gap: 10 
  },
  refreshBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  logoutLink: { marginTop: 30, alignItems: 'center' },
  logoutText: { color: '#94A3B8', fontWeight: '700', fontSize: 14 }
});