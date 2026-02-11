import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import React from 'react';
import { Linking, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../firebaseConfig';

export default function SubscriptionLock({ 
  vendorData, 
  theme, 
  isSubscriptionPage = false 
}: { 
  vendorData: any; 
  theme: any; 
  isSubscriptionPage?: boolean 
}) {
  const router = useRouter(); 
  
  if (!vendorData || !auth.currentUser) return null;

  const expiryDate = vendorData.expiryDate?.toDate ? vendorData.expiryDate.toDate() : null;
  const now = new Date();
  const isApproved = vendorData.isApproved === true; 
  const isTrial = vendorData.subscriptionType === 'trial';
  const isExpired = expiryDate ? expiryDate < now : false;
  const diffTime = expiryDate ? expiryDate.getTime() - now.getTime() : 0;
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const handleContactAdmin = () => {
    const msg = `Salam Admin, I'm ${vendorData?.managerName} from ${vendorData?.stallName || 'my stall'}. I want to check my status/renew my subscription.`;
    Linking.openURL(`whatsapp://send?text=${msg}&phone=+60123456789`); 
  };

  const handleGoToSubscription = () => {
    try {
      console.log("Navigating to /vendor/subscription...");
      router.push('/vendor/subscription');
    } catch (e) {
      console.error("Navigation Error:", e);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.log("Logout cleanup handled.");
    }
  };

  const formattedExpiry = expiryDate ? expiryDate.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  }) : null;

  // --- 1. PENDING APPROVAL STATE ---
  if (!isApproved && !expiryDate) {
    return (
      <View style={[styles.lockOverlay, { backgroundColor: theme.bg }]}>
        <View style={[styles.lockCard, { backgroundColor: theme.card }]}>
          <View style={[styles.lockIconCircle, { backgroundColor: '#EEF2FF' }]}>
            <Ionicons name="time-outline" size={60} color="#6366F1" />
          </View>
          <Text style={[styles.lockTitle, { color: theme.text }]}>Pending Approval</Text>
          <Text style={[styles.lockMessage, { color: theme.subText }]}>
            Welcome! Your registration is being reviewed. Once approved, you will receive a 7-day free trial automatically.
          </Text>
          <TouchableOpacity style={[styles.payButton, { backgroundColor: '#6366F1' }]} onPress={handleContactAdmin}>
            <Ionicons name="logo-whatsapp" size={20} color="#FFF" />
            <Text style={styles.payButtonText}>Check Status with Admin</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtnSmall} onPress={handleLogout}>
            <Text style={{ color: '#EF4444', fontWeight: 'bold' }}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // --- 2. EXPIRED STATE ---
  if ((!isApproved || isExpired) && !isSubscriptionPage) {
    return (
      <View style={[styles.lockOverlay, { backgroundColor: theme.bg }]}>
        <View style={[styles.lockCard, { backgroundColor: theme.card }]}>
          <View style={styles.lockIconCircle}>
            <Ionicons name="lock-closed" size={60} color="#EF4444" />
          </View>
          <Text style={[styles.lockTitle, { color: theme.text }]}>
            {isTrial && isExpired ? "Trial Ended" : "Access Locked"}
          </Text>
          
          {formattedExpiry && (
            <View style={styles.expiryInfoTag}>
              <Text style={styles.expiryInfoText}>
                {isTrial ? "Trial expired on: " : "Expired on: "} {formattedExpiry}
              </Text>
            </View>
          )}

          <Text style={[styles.lockMessage, { color: theme.subText }]}>
            {isExpired 
              ? `Your ${isTrial ? 'trial' : 'subscription'} ended ${Math.abs(daysRemaining)} day(s) ago. Please renew to continue using the POS.` 
              : "Your account is currently deactivated by the administrator."}
          </Text>
          
          <TouchableOpacity 
            activeOpacity={0.7}
            style={[styles.payButton, { backgroundColor: '#6366F1', marginBottom: 12 }]} 
            onPress={handleGoToSubscription}
          >
            <Ionicons name="card-outline" size={22} color="#FFF" />
            <Text style={styles.payButtonText}>Renew Account Now</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            activeOpacity={0.7}
            style={[styles.payButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#22C55E' }]} 
            onPress={handleContactAdmin}
          >
            <Ionicons name="logo-whatsapp" size={20} color="#22C55E" />
            <Text style={[styles.payButtonText, { color: '#22C55E' }]}>Help / Manual Renewal</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutBtnSmall} onPress={handleLogout}>
            <Text style={{ color: '#EF4444', fontWeight: 'bold' }}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // --- 3. WARNING BANNER ---
  if (isApproved && !isExpired && daysRemaining <= 2 && !isSubscriptionPage) {
    return (
      <View style={styles.bannerWrapper}>
        <SafeAreaView style={[styles.warningBanner, isTrial && { backgroundColor: '#6366F1' }]}>
          <View style={styles.bannerContent}>
            <Ionicons name={isTrial ? "gift-outline" : "warning"} size={20} color="#FFF" />
            <View style={styles.bannerTextColumn}>
              <Text style={styles.warningText}>
                {isTrial ? "Free Trial" : "Subscription"} ends in {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
              </Text>
              <Text style={styles.warningSubText}>Valid until: {formattedExpiry}</Text>
            </View>
            <TouchableOpacity style={styles.renewBadge} onPress={handleGoToSubscription}>
              <Text style={styles.renewActionText}>RENEW NOW</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 25,
  },
  lockCard: {
    width: '100%',
    padding: 30,
    borderRadius: 35,
    alignItems: 'center',
    elevation: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 15,
  },
  lockIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  lockTitle: { fontSize: 22, fontWeight: '900', marginBottom: 8 },
  expiryInfoTag: { backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, marginBottom: 15 },
  expiryInfoText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  lockMessage: { textAlign: 'center', fontSize: 15, lineHeight: 22, marginBottom: 30 },
  payButton: { width: '100%', flexDirection: 'row', paddingVertical: 15, paddingHorizontal: 25, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 10 },
  payButtonText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  logoutBtnSmall: { marginTop: 25, padding: 10 },
  bannerWrapper: { zIndex: 1000, width: '100%' },
  warningBanner: { backgroundColor: '#F59E0B', paddingTop: Platform.OS === 'android' ? 10 : 0 },
  bannerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 20 },
  bannerTextColumn: { flex: 1, marginLeft: 12 },
  warningText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  warningSubText: { color: '#FEF3C7', fontSize: 11, fontWeight: '600' },
  renewBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#FFF' },
  renewActionText: { color: '#FFF', fontWeight: '900', fontSize: 12 },
});