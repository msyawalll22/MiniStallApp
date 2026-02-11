import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import { addDoc, collection, doc, onSnapshot, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Linking, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../../firebaseConfig';

export default function ContractsScreen() {
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const [vendors, setVendors] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "vendor"));
    return onSnapshot(q, (snap) => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((v: any) => v.isApproved === true || v.isFrozen === true || v.status === 'frozen');
      setVendors(list);
    });
  }, []);

  // Updated Filtered Logic to search both Stall and Owner Name
  const filteredVendors = vendors.filter(vendor => 
    vendor.stallName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vendor.ownerName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getDaysRemaining = (expiryTs: any) => {
    if (!expiryTs) return 0;
    const diff = expiryTs.toDate().getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 86400));
    return days;
  };

  const forceWarning = async (vendor: any) => {
    Alert.alert(
      "Test: 3 Days Remaining", 
      `Set ${vendor.stallName} to expire in 3 days?`, 
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Set Warning", 
          onPress: async () => {
            try {
              const threeDaysFromNow = new Date();
              threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3); 
              await updateDoc(doc(db, "users", vendor.id), {
                expiryDate: Timestamp.fromDate(threeDaysFromNow),
                status: 'active', 
                isFrozen: false
              });
            } catch (e) {
              Alert.alert("Error", "Failed to set warning.");
            }
          }
        }
      ]
    );
  };

  const forceExpire = async (vendor: any) => {
    Alert.alert(
      "Test: Force Expire", 
      `Set ${vendor.stallName} to expired? (24h ago)`, 
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Expire Now", 
          style: "destructive",
          onPress: async () => {
            try {
              const yesterday = new Date();
              yesterday.setDate(yesterday.getDate() - 1); 
              await updateDoc(doc(db, "users", vendor.id), {
                expiryDate: Timestamp.fromDate(yesterday),
                status: 'active', 
                isFrozen: false
              });
            } catch (e) {
              Alert.alert("Error", "Failed to force expiry.");
            }
          }
        }
      ]
    );
  };

  const extendSubscription = async (vendor: any) => {
    const daysLeft = getDaysRemaining(vendor.expiryDate);
    const baseDate = daysLeft > 0 ? vendor.expiryDate.toDate() : new Date();
    const newExpiry = new Date(baseDate);
    newExpiry.setDate(newExpiry.getDate() + 30); 

    Alert.alert("Confirm Payment", `Confirm RM 40 received for ${vendor.stallName}?`, [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Confirm RM 40", 
        onPress: async () => {
          try {
            await updateDoc(doc(db, "users", vendor.id), {
              expiryDate: Timestamp.fromDate(newExpiry),
              isApproved: true,
              isFrozen: false, 
              status: 'active', 
              deactivatedAt: null
            });
            await addDoc(collection(db, "subscriptions"), {
                vendorId: vendor.id,
                stallName: vendor.stallName,
                ownerName: vendor.ownerName || "N/A", // Added ownerName to history
                amount: 40,
                paidAt: Timestamp.now(),
                newExpiry: Timestamp.fromDate(newExpiry)
            });
          } catch (error) {
            Alert.alert("Error", "Failed to update subscription.");
          }
        }
      }
    ]);
  };

  const toggleStatus = async (vendor: any) => {
    const currentlyFrozen = vendor.isFrozen === true;
    const daysLeft = getDaysRemaining(vendor.expiryDate);
    const isMovingToActive = currentlyFrozen;

    if (isMovingToActive && daysLeft <= 0) {
      Alert.alert("Expired Stall", "Cannot unfreeze. Please click '+30 Days' first.");
      return;
    }

    try {
      await updateDoc(doc(db, "users", vendor.id), {
        isFrozen: !isMovingToActive, 
        isApproved: isMovingToActive ? true : vendor.isApproved,
        status: isMovingToActive ? 'active' : 'frozen',
        deactivatedAt: !isMovingToActive ? Timestamp.now() : null
      });
    } catch (e) {
      Alert.alert("Update Error", "Could not update status.");
    }
  };

  const sendReminder = (vendor: any) => {
    const phone = vendor.phoneNumber || "";
    // Updated reminder to address the Owner Name
    const msg = `Salam Boss ${vendor.ownerName || vendor.stallName}, your POS subscription for ${vendor.stallName} is ending/expired. Please pay RM 40 to maintain access. Thank you!`;
    Linking.openURL(`whatsapp://send?text=${msg}&phone=${phone}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 10 }}>
        
        <View style={styles.summaryCard}>
          <View style={styles.summaryContent}>
            <View>
              <Text style={styles.summaryLabel}>POTENTIAL REVENUE (EST)</Text>
              <Text style={styles.summaryCount}>RM {vendors.length * 40}</Text>
            </View>
            <View style={styles.badge}>
                <Text style={styles.badgeText}>{vendors.length} STALLS</Text>
            </View>
          </View>
        </View>

        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={20} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search stall or owner..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#CBD5E1" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.listTitleRow}>
          <Text style={styles.sectionLabel}>Subscription Manager</Text>
          <View style={styles.liveDot} />
        </View>

        <FlatList
          data={filteredVendors}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 30 }}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color="#E2E8F0" />
              <Text style={styles.emptyText}>No vendors match "{searchQuery}"</Text>
            </View>
          }
          renderItem={({ item }) => {
            const daysLeft = getDaysRemaining(item.expiryDate);
            const isExpired = daysLeft <= 0;
            const isNearExpiry = daysLeft <= 3 && daysLeft > 0;
            const isFrozen = item.isFrozen === true;
            const isActive = !isFrozen && !isExpired;

            return (
              <View style={[
                styles.card, 
                !isActive && styles.deactivatedCard, 
                isNearExpiry && { borderLeftWidth: 5, borderLeftColor: '#F59E0B' },
                isFrozen && { borderLeftColor: '#3B82F6' } 
              ]}>
                <View style={styles.cardTop}>
                  <View style={[styles.iconCircle, { backgroundColor: isNearExpiry ? '#FFFBEB' : (isActive ? '#EEF2FF' : (isFrozen ? '#DBEAFE' : '#FFF1F2')) }]}>
                    <Ionicons 
                      name={isNearExpiry ? "notifications-outline" : (isActive ? "shield-checkmark" : (isFrozen ? "snow-outline" : "alert-circle-outline"))} 
                      size={22} 
                      color={isNearExpiry ? "#F59E0B" : (isActive ? "#6366F1" : (isFrozen ? "#3B82F6" : "#EF4444"))} 
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.name} numberOfLines={1}>{item.stallName}</Text>
                    <Text style={styles.ownerSubtext}>{item.ownerName}</Text>
                    <Text style={[styles.daysText, { color: isNearExpiry ? '#F59E0B' : (isFrozen ? '#3B82F6' : (isExpired ? '#EF4444' : '#64748B')) }]}>
                      {isFrozen ? 'Account Frozen' : (isNearExpiry ? `${daysLeft} days - RENEW SOON` : (isExpired ? 'Subscription Expired' : `${daysLeft} days remaining`))}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => extendSubscription(item)} style={styles.topUpBtn}>
                      <Text style={styles.topUpText}>+30 Days</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.divider} />

                <View style={styles.cardActions}>
                  <TouchableOpacity 
                    style={[
                        styles.actionBtn, 
                        { backgroundColor: isActive ? '#FFF' : '#3B82F6', borderColor: isActive ? '#E2E8F0' : '#3B82F6', borderWidth: 1 }
                    ]} 
                    onPress={() => toggleStatus(item)}
                  >
                    <Ionicons name={isActive ? "pause-outline" : "play-outline"} size={16} color={isActive ? "#64748B" : "#FFF"} />
                    <Text style={[styles.btnText, { color: isActive ? "#1E293B" : "#FFF" }]}>{isActive ? 'Freeze' : 'Activate'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' }]} 
                    onPress={() => sendReminder(item)}
                  >
                    <Ionicons name="logo-whatsapp" size={16} color="#22C55E" />
                    <Text style={[styles.btnText, { color: '#1E293B' }]}>Remind</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => forceWarning(item)} style={[styles.miniDelete, { backgroundColor: '#FFFBEB', marginRight: 4 }]}>
                      <Ionicons name="notifications-outline" size={18} color="#F59E0B" />
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => forceExpire(item)} style={styles.miniDelete}>
                    <Ionicons name="hourglass-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  summaryCard: { backgroundColor: '#0F172A', borderRadius: 28, padding: 24, marginBottom: 20, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 15 },
  summaryContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  summaryCount: { color: '#FFF', fontSize: 28, fontWeight: '900', marginTop: 4 },
  badge: { backgroundColor: 'rgba(99, 102, 241, 0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  badgeText: { color: '#818CF8', fontSize: 10, fontWeight: '800' },
  searchSection: { marginBottom: 20 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 15, paddingVertical: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, fontWeight: '600', color: '#1E293B' },
  listTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, marginLeft: 5 },
  sectionLabel: { fontSize: 18, fontWeight: '900', color: '#1E293B' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6366F1', marginLeft: 8 },
  card: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  deactivatedCard: { borderLeftWidth: 5, borderLeftColor: '#EF4444' },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: 17, fontWeight: '800', color: '#1E293B' },
  ownerSubtext: { fontSize: 13, color: '#64748B', fontWeight: '500' }, // Added style for owner name
  daysText: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  topUpBtn: { backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  topUpText: { fontSize: 11, fontWeight: '800', color: '#6366F1' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 18 },
  cardActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 15, gap: 6 },
  btnText: { fontSize: 13, fontWeight: '800' },
  miniDelete: { padding: 10, backgroundColor: '#FFF1F2', borderRadius: 12 },
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#94A3B8', marginTop: 10, fontWeight: '600' }
});