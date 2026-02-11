import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { addDoc, collection, doc, onSnapshot, Timestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { auth, db } from '../../firebaseConfig';

// Ensure the path back to components is correct
import SubscriptionLock from '../../components/subscriptionlock';

const DEVELOPMENT_MODE = true; 

const PLANS = [
  { id: '30days', label: '30 Days', price: 40, days: 30, color: '#6366F1' },
  { id: '60days', label: '60 Days', price: 75, days: 60, color: '#8B5CF6' },
  { id: '120days', label: '120 Days', price: 140, days: 120, color: '#EC4899' },
];

export default function SubscriptionScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [vendorData, setVendorData] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState(PLANS[0]);
  
  const [showWebView, setShowWebView] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Theme helper for the Lock component
  const theme = {
    bg: '#FFFFFF',
    card: '#F8FAFC',
    text: '#0F172A',
    subText: '#64748B'
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Fixed Listener with Error Handling
    const unsub = onSnapshot(
      doc(db, "users", user.uid), 
      (docSnap) => {
        if (docSnap.exists()) {
          setVendorData(docSnap.data());
        }
        setLoading(false);
      },
      (error) => {
        // ✅ SILENCE THE LOGOUT ERROR
        if (error.code === 'permission-denied' && !auth.currentUser) {
          console.log("Subscription listener closed safely.");
        } else {
          console.error("Subscription Error:", error);
        }
      }
    );

    return () => unsub();
  }, []);

  const activateSubscriptionLocally = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    const user = auth.currentUser;
    if (!user) {
      setIsProcessing(false);
      return;
    }

    try {
      const now = new Date();
      let currentExpiry = vendorData?.expiryDate ? vendorData.expiryDate.toDate() : new Date();
      
      const baseDate = currentExpiry > now ? currentExpiry : now;
      const newExpiry = new Date(baseDate);
      newExpiry.setDate(newExpiry.getDate() + selectedPlan.days);

      // 1. UPDATE USER COLLECTION
      await updateDoc(doc(db, "users", user.uid), {
        status: 'active',
        isApproved: true,
        expiryDate: Timestamp.fromDate(newExpiry),
        subscriptionType: 'premium',
        lastPaymentType: 'mock_test',
        updatedAt: Timestamp.fromDate(now)
      });

      // 2. RECORD IN SUBSCRIPTIONS COLLECTION
      await addDoc(collection(db, "subscriptions"), {
        vendorId: user.uid,
        stallName: vendorData?.stallName || vendorData?.businessName || 'Unknown Stall',
        amount: selectedPlan.price,
        daysAdded: selectedPlan.days,
        paidAt: Timestamp.fromDate(now),
        planId: selectedPlan.id,
        status: 'SUCCESS'
      });
      
      Alert.alert("Success", `Account extended by ${selectedPlan.days} days!`, [
        { text: "OK", onPress: () => router.replace('/vendor') }
      ]);
    } catch (error) {
      console.error("Subscription Error:", error);
      Alert.alert("Error", "Failed to update database.");
    } finally {
      setTimeout(() => setIsProcessing(false), 2000);
    }
  };

  const handleStartPayment = async () => {
    setIsProcessing(false);
    setLoading(true);
    try {
      if (DEVELOPMENT_MODE) {
        setPaymentUrl('https://google.com'); 
        setShowWebView(true);
        setLoading(false);
        return;
      }
    } catch (error) {
      Alert.alert("Error", "Connection failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleNavigationStateChange = (navState: any) => {
    const isSuccess = DEVELOPMENT_MODE 
        ? navState.url.includes('google.com') 
        : navState.url.includes('payment-success');

    if (isSuccess && !isProcessing) {
      setShowWebView(false);
      activateSubscriptionLocally();
    }
  };

  if (loading && !showWebView) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color="#6366F1" />
    </View>
  );

  const daysLeft = vendorData?.expiryDate 
    ? Math.ceil((vendorData.expiryDate.toDate().getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) 
    : 0;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ 
          headerShown: true, 
          headerTitle: "Subscription",
          headerStyle: { backgroundColor: '#F8FAFC' },
          headerShadowVisible: false 
        }} 
      />
      
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.premiumHeader}>
            <View>
              <Text style={styles.headerSubtitle}>VENDOR PORTAL</Text>
              <Text style={styles.headerTitle}>Premium Plan</Text>
            </View>
            <TouchableOpacity onPress={() => router.back()} style={styles.backIcon}>
                <Ionicons name="close-circle-outline" size={32} color="#64748B" />
            </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          <View style={[styles.statusBanner, { backgroundColor: daysLeft > 0 ? '#10B981' : '#EF4444' }]}>
            <Ionicons name={daysLeft > 0 ? "checkmark-circle" : "alert-circle"} size={20} color="white" />
            <Text style={styles.statusBannerText}>
              {daysLeft > 0 ? `${daysLeft} Days Remaining` : 'Expired - Please Renew'}
            </Text>
          </View>

          {DEVELOPMENT_MODE && (
            <View style={styles.devBadge}>
              <Text style={styles.devBadgeText}>🛠 TEST MODE ACTIVE</Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>Select Plan</Text>
          
          {PLANS.map((plan) => (
            <TouchableOpacity 
              key={plan.id} 
              style={[
                styles.planCard, 
                selectedPlan.id === plan.id && { borderColor: plan.color, backgroundColor: plan.color + '05' }
              ]}
              onPress={() => setSelectedPlan(plan)}
            >
              <View style={[styles.planIcon, { backgroundColor: plan.color }]}>
                <Ionicons name="flash" size={20} color="white" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.planLabel}>{plan.label}</Text>
                <Text style={styles.planSub}>Full system access</Text>
              </View>
              <View style={styles.priceTag}>
                  <Text style={styles.planPrice}>RM{plan.price}</Text>
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.payBtn} onPress={handleStartPayment}>
            <Text style={styles.payBtnText}>Pay RM{selectedPlan.price}</Text>
            <Ionicons name="chevron-forward" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <SubscriptionLock 
        vendorData={vendorData} 
        theme={theme} 
        isSubscriptionPage={true} 
      />

      <Modal visible={showWebView} animationType="slide">
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Gateway Connection</Text>
            <TouchableOpacity onPress={() => setShowWebView(false)}>
              <Ionicons name="close" size={28} color="black" />
            </TouchableOpacity>
          </View>
          <WebView 
            source={{ uri: paymentUrl }} 
            onNavigationStateChange={handleNavigationStateChange}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  premiumHeader: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingHorizontal: 25, 
    paddingTop: 10,
    paddingBottom: 35, 
    backgroundColor: '#F8FAFC',
    borderBottomLeftRadius: 30, 
    borderBottomRightRadius: 30, 
    marginBottom: 20,
  },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#0F172A' },
  headerSubtitle: { fontSize: 11, fontWeight: '800', color: '#6366F1', letterSpacing: 1 },
  backIcon: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  statusBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 15, borderRadius: 18, marginBottom: 20, gap: 8
  },
  statusBannerText: { color: 'white', fontWeight: '800', fontSize: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 15, marginLeft: 5 },
  planCard: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', 
    padding: 20, borderRadius: 22, marginBottom: 12, borderWidth: 2, borderColor: '#F1F5F9' 
  },
  planIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  planLabel: { fontSize: 17, fontWeight: '700', color: '#1E293B' },
  planSub: { fontSize: 12, color: '#94A3B8' },
  priceTag: { backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  planPrice: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  payBtn: { 
    flexDirection: 'row', backgroundColor: '#0F172A', padding: 22, 
    borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginTop: 15 
  },
  payBtnText: { color: 'white', fontWeight: '800', fontSize: 16, marginRight: 10 },
  devBadge: { backgroundColor: '#FFEDD5', padding: 10, borderRadius: 12, marginBottom: 15 },
  devBadgeText: { color: '#9A3412', fontWeight: 'bold', textAlign: 'center', fontSize: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  modalTitle: { fontSize: 16, fontWeight: '700' },
});