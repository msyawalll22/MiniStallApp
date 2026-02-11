import { Ionicons } from '@expo/vector-icons';
import {
  Timestamp,
  collection,
  getDocs,
  query,
  where,
  writeBatch
} from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// Use your central config
import { auth, db } from '../../firebaseConfig';

const { width, height } = Dimensions.get('window');

const BackgroundTrail = () => {
  const moveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(moveAnim, {
        toValue: 1,
        duration: 25000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const translateX = moveAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, width - 100, 0]
  });

  const translateY = moveAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, height / 3, 0]
  });

  return (
    <Animated.View style={[styles.bgCircle, { transform: [{ translateX }, { translateY }] }]} />
  );
};

export default function AccountMaintenance() {
  const user = auth.currentUser;
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCleanup = async (months: number) => {
    const cutoffDate = new Date();
    if (months > 0) {
      cutoffDate.setMonth(cutoffDate.getMonth() - months);
    }

    const message = months === 0 
      ? "This will delete ALL order receipts history. Your total earnings reports will remain safe. Continue?"
      : `Delete all order receipts older than ${months} month(s)?`;

    Alert.alert("Confirm Cleanup", message, [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Delete Data", 
        style: "destructive", 
        onPress: () => processCleanup(cutoffDate, months === 0) 
      }
    ]);
  };

  const processCleanup = async (cutoff: Date, clearAll: boolean) => {
    if (!user) return;
    setIsDeleting(true);

    try {
      const ordersRef = collection(db, "orders");
      const timestampField = "timestamp"; // Matching your DB structure

      // We need to check both userId (POS) and vendorId (Web)
      const queries = [];

      if (clearAll) {
        queries.push(query(ordersRef, where("userId", "==", user.uid)));
        queries.push(query(ordersRef, where("vendorId", "==", user.uid)));
      } else {
        const firestoreCutoff = Timestamp.fromDate(cutoff);
        queries.push(query(ordersRef, where("userId", "==", user.uid), where(timestampField, "<", firestoreCutoff)));
        queries.push(query(ordersRef, where("vendorId", "==", user.uid), where(timestampField, "<", firestoreCutoff)));
      }

      // Execute both queries
      const snapshots = await Promise.all(queries.map(q => getDocs(q)));
      
      const batch = writeBatch(db);
      let count = 0;

      snapshots.forEach(snap => {
        snap.docs.forEach((doc) => {
          batch.delete(doc.ref);
          count++;
        });
      });

      if (count === 0) {
        Alert.alert("All Clean", "No records found to delete.");
        setIsDeleting(false);
        return;
      }

      await batch.commit();
      Alert.alert("Success", `Successfully cleared ${count} records.`);
    } catch (error) {
      console.error("Cleanup Error:", error);
      Alert.alert("Error", "Failed to delete records. Check your internet connection.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <BackgroundTrail />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.responsiveWrapper}>
          
          <View style={styles.headerBox}>
             <Ionicons name="construct-outline" size={40} color="#6366F1" />
             <Text style={styles.headerTitle}>Maintenance</Text>
             <Text style={styles.headerSub}>Manage your local database storage</Text>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={24} color="#6366F1" />
            <Text style={styles.infoText}>
              Cleaning receipts keeps the app fast. This <Text style={{fontWeight: '800'}}>only</Text> removes individual receipts. Your daily/monthly Sales Reports are safe.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>Tools</Text>

          <TouchableOpacity 
            style={styles.actionCard} 
            onPress={() => handleCleanup(1)}
            disabled={isDeleting}
            activeOpacity={0.7}
          >
            <View style={styles.iconCircle}>
                <Ionicons name="calendar-outline" size={22} color="#6366F1" />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.actionTitle}>Clear &gt; 1 Month</Text>
              <Text style={styles.actionSub}>Keep only last 30 days.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard} 
            onPress={() => handleCleanup(3)}
            disabled={isDeleting}
            activeOpacity={0.7}
          >
            <View style={styles.iconCircle}>
                <Ionicons name="archive-outline" size={22} color="#6366F1" />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.actionTitle}>Clear &gt; 3 Months</Text>
              <Text style={styles.actionSub}>Keep last 90 days.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>

          <View style={styles.dangerDivider} />

          <TouchableOpacity 
            style={[styles.actionCard, styles.dangerCard]} 
            onPress={() => handleCleanup(0)}
            disabled={isDeleting}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="trash-outline" size={22} color="#EF4444" />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.dangerTitle}>Wipe All History</Text>
              <Text style={styles.dangerSub}>Complete receipt reset.</Text>
            </View>
            <Ionicons name="alert-circle-outline" size={20} color="#FCA5A5" />
          </TouchableOpacity>

          {isDeleting && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#6366F1" />
              <Text style={styles.loadingText}>Cleaning database...</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  bgCircle: { 
    position: 'absolute', 
    width: 200, 
    height: 200, 
    borderRadius: 100, 
    backgroundColor: '#6366F1', 
    opacity: 0.04 
  },
  scrollContent: { padding: 20, paddingBottom: 50 },
  responsiveWrapper: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  headerBox: { alignItems: 'center', marginBottom: 30, marginTop: 10 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#0F172A', marginTop: 10 },
  headerSub: { fontSize: 14, color: '#64748B' },
  infoCard: { 
    flexDirection: 'row', 
    backgroundColor: '#EEF2FF', 
    padding: 20, 
    borderRadius: 20, 
    gap: 12,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#E0E7FF'
  },
  infoText: { flex: 1, fontSize: 14, color: '#4338CA', lineHeight: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 15, letterSpacing: 1 },
  actionCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFF', 
    padding: 16, 
    borderRadius: 20, 
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8
  },
  iconCircle: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F5F3FF', justifyContent: 'center', alignItems: 'center' },
  cardText: { flex: 1, marginLeft: 15 },
  actionTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  actionSub: { fontSize: 13, color: '#64748B', marginTop: 2 },
  dangerDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 25 },
  dangerCard: { backgroundColor: '#FFF', borderColor: '#FEE2E2', borderWidth: 1 },
  dangerTitle: { fontSize: 16, fontWeight: '700', color: '#EF4444' },
  dangerSub: { fontSize: 13, color: '#F87171', marginTop: 2 },
  loadingOverlay: { marginTop: 30, alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#6366F1', fontWeight: '700' }
});