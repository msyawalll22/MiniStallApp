import { Ionicons } from '@expo/vector-icons';
import {
    collection,
    doc,
    getDocs, writeBatch
} from 'firebase/firestore';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text, TouchableOpacity,
    View
} from 'react-native';
import { db } from '../../firebaseConfig'; // Adjust path

export default function AdminMaintenance() {
  const [loading, setLoading] = useState(false);

  const nukeEverythingExceptAdmins = async () => {
    // Safety check 1
    Alert.alert(
      "☢️ SYSTEM WIPE",
      "This will delete ALL vendors, products, orders, and stats. Admin accounts will be saved. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "DELETE EVERYTHING", 
          style: "destructive", 
          onPress: () => finalConfirmation() 
        }
      ]
    );
  };

  const finalConfirmation = () => {
    // Safety check 2
    Alert.alert(
      "FINAL WARNING",
      "This action cannot be undone. All dummy data will be gone forever.",
      [
        { text: "STOP", style: "cancel" },
        { text: "I AM SURE", style: "destructive", onPress: startNuke }
      ]
    );
  };

  const startNuke = async () => {
    setLoading(true);
    try {
      const collectionsToClear = ['users', 'products', 'orders', 'dailyStats', 'subscriptions', 'contracts'];
      let totalDeleted = 0;

      for (const colName of collectionsToClear) {
        const batch = writeBatch(db);
        const q = collection(db, colName);
        const snapshot = await getDocs(q);
        
        let batchCount = 0;

        snapshot.forEach((document) => {
          const data = document.data();
          
          // CRITICAL: Skip Admins
          const isYourUid = document.id === "QnHWLDfCdbfemBTKfHxpoRtQxal1";
          const isAdminRole = data.role === 'admin';

          if (colName === 'users' && (isYourUid || isAdminRole)) {
            // Do nothing, save the admin
            console.log(`Skipping admin: ${document.id}`);
          } else {
            batch.delete(doc(db, colName, document.id));
            batchCount++;
            totalDeleted++;
          }
        });

        if (batchCount > 0) {
          await batch.commit();
        }
      }

      Alert.alert("Cleanup Complete", `Successfully removed ${totalDeleted} dummy entries.`);
    } catch (error: any) {
      console.error(error);
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Ionicons name="construct" size={32} color="#0F172A" />
          <Text style={styles.title}>System Maintenance</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Database Cleanup</Text>
          <Text style={styles.cardDesc}>
            Use this to wipe all dummy test data. The system will look for all documents 
            and delete them while preserving accounts with the 'admin' role.
          </Text>

          <TouchableOpacity 
            style={[styles.nukeBtn, loading && styles.disabled]} 
            onPress={nukeEverythingExceptAdmins}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={20} color="#FFF" />
                <Text style={styles.nukeText}>Wipe All Dummy Data</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="shield-checkmark" size={20} color="#10B981" />
          <Text style={styles.infoText}>Admin protection is ACTIVE. Your account is safe.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 30 },
  title: { fontSize: 24, fontWeight: '900', color: '#0F172A' },
  card: { backgroundColor: '#FFF', padding: 20, borderRadius: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#EF4444', marginBottom: 10 },
  cardDesc: { color: '#64748B', lineHeight: 20, marginBottom: 25 },
  nukeBtn: { backgroundColor: '#EF4444', height: 55, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  nukeText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  disabled: { opacity: 0.6 },
  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, padding: 15, backgroundColor: '#ECFDF5', borderRadius: 12 },
  infoText: { color: '#065F46', fontSize: 13, fontWeight: '600' }
});