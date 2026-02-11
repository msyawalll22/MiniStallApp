import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import {
  collection,
  doc,
  onSnapshot,
  query,
  Timestamp,
  where,
  writeBatch
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { db } from '../../firebaseConfig';

export default function ApprovalQueue() {
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const [pending, setPending] = useState<any[]>([]);
  const [approved, setApproved] = useState<any[]>([]);
  const [rejected, setRejected] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');

  const [isRejectModalVisible, setRejectModalVisible] = useState(false);
  const [isInfoModalVisible, setInfoModalVisible] = useState(false); // New Info Modal State
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<any>(null);

  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "vendor"));
    const unsubscribe = onSnapshot(q, (snap) => {
      const allVendors = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPending(allVendors.filter((v: any) => v.isApproved === false && v.status !== 'rejected'));
      setApproved(allVendors.filter((v: any) => v.isApproved === true));
      setRejected(allVendors.filter((v: any) => v.status === 'rejected'));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const openInfo = (vendor: any) => {
    setSelectedVendor(vendor);
    setInfoModalVisible(true);
  };

  const approve = async (id: string, name: string) => {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7);

    Alert.alert("Confirm Approval", `Grant ${name} a 7-day free trial?`, [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Approve", 
        onPress: async () => {
          try {
            const batch = writeBatch(db);
            const userRef = doc(db, "users", id);
            batch.update(userRef, { 
              isApproved: true,
              subscriptionType: 'trial',
              expiryDate: Timestamp.fromDate(expiryDate), 
              status: 'active',
              rejectionReason: null 
            });
            await batch.commit();
            setInfoModalVisible(false); // Close modal if open
            Alert.alert("Success", "Vendor approved!");
          } catch (e: any) { Alert.alert("Error", e.message); }
        } 
      }
    ]);
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) return Alert.alert("Required", "Please state a reason.");

    try {
      const userRef = doc(db, "users", selectedVendor.id);
      const batch = writeBatch(db);
      batch.update(userRef, { 
        isApproved: false,
        status: 'rejected',
        rejectionReason: rejectionReason 
      });
      await batch.commit();
      setRejectModalVisible(false);
      setRejectionReason('');
      Alert.alert("Rejected", "Vendor has been notified.");
    } catch (e: any) { Alert.alert("Error", e.message); }
  };

  const getData = () => {
    switch(activeTab) {
        case 'pending': return pending;
        case 'approved': return approved;
        case 'rejected': return rejected;
        default: return [];
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#6366F1" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 10 }}>
        
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>MANAGEMENT</Text>
          <Text style={styles.summaryCount}>{pending.length} New Requests</Text>
        </View>

        <View style={styles.tabBar}>
          {['pending', 'approved', 'rejected'].map((tab) => (
            <TouchableOpacity 
                key={tab}
                style={[styles.tab, activeTab === tab && styles.activeTab]} 
                onPress={() => setActiveTab(tab as any)}
            >
                <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={getData()}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={[styles.card, activeTab === 'rejected' && { borderLeftColor: '#EF4444' }]}>
              <View style={styles.cardHeader}>
                <View style={styles.vendorInfo}>
                  <Text style={styles.name}>{item.stallName || "New Vendor"}</Text>
                  <Text style={styles.emailText}>{item.email}</Text>
                  {activeTab === 'rejected' && (
                      <Text style={styles.rejectionSnippet}>Reason: {item.rejectionReason}</Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => openInfo(item)}>
                    <Ionicons name="information-circle-outline" size={28} color="#6366F1" />
                </TouchableOpacity>
              </View>

              {(activeTab === 'pending' || activeTab === 'rejected') && (
                <View style={styles.actionRow}>
                  {activeTab === 'pending' && (
                    <TouchableOpacity 
                        style={[styles.actionBtn, styles.rejectBtn]} 
                        onPress={() => { setSelectedVendor(item); setRejectModalVisible(true); }}
                    >
                        <Text style={styles.rejectText}>Reject</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity 
                    style={[styles.actionBtn, styles.approveBtn]} 
                    onPress={() => approve(item.id, item.stallName)}
                  >
                    <Text style={styles.btnText}>Approve</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        />
      </View>

      {/* --- INFO MODAL (Custom Popup) --- */}
      <Modal visible={isInfoModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { borderTopLeftRadius: 30, borderTopRightRadius: 30 }]}>
                <View style={styles.modalHeaderIndicator} />
                <Text style={styles.modalTitle}>Stall Details</Text>
                
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Stall Name</Text>
                    <Text style={styles.infoValue}>{selectedVendor?.stallName || 'N/A'}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Owner Name</Text>
                    <Text style={styles.infoValue}>{selectedVendor?.ownerName || 'N/A'}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Phone Number</Text>
                    <Text style={styles.infoValue}>{selectedVendor?.phone || 'N/A'}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Email</Text>
                    <Text style={styles.infoValue}>{selectedVendor?.email}</Text>
                </View>

                <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.closeBtn} onPress={() => setInfoModalVisible(false)}>
                        <Text style={styles.cancelLink}>Close</Text>
                    </TouchableOpacity>
                    {activeTab === 'pending' && (
                        <TouchableOpacity 
                            style={[styles.confirmReject, { backgroundColor: '#6366F1' }]} 
                            onPress={() => approve(selectedVendor.id, selectedVendor.stallName)}
                        >
                            <Text style={styles.btnText}>Approve Now</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
      </Modal>

      {/* --- REJECT MODAL --- */}
      <Modal visible={isRejectModalVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeaderIndicator} />
                <Text style={styles.modalTitle}>Reject Application</Text>
                <Text style={styles.modalSub}>Reason for {selectedVendor?.stallName}:</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="e.g. Incomplete information..." 
                  multiline
                  autoFocus
                  value={rejectionReason}
                  onChangeText={setRejectionReason}
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity onPress={() => setRejectModalVisible(false)}><Text style={styles.cancelLink}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.confirmReject} onPress={handleReject}><Text style={styles.btnText}>Confirm Reject</Text></TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  summaryCard: { backgroundColor: '#0F172A', borderRadius: 20, padding: 20, marginBottom: 15 },
  summaryLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '800' },
  summaryCount: { color: '#FFF', fontSize: 22, fontWeight: '900' },
  tabBar: { flexDirection: 'row', backgroundColor: '#E2E8F0', padding: 4, borderRadius: 12, marginBottom: 15 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  activeTab: { backgroundColor: '#FFF' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  activeTabText: { color: '#1E293B' },
  card: { backgroundColor: '#FFF', borderRadius: 15, padding: 15, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: '#6366F1' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  vendorInfo: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  emailText: { color: '#94A3B8', fontSize: 12 },
  rejectionSnippet: { color: '#EF4444', fontSize: 11, marginTop: 4, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 5 },
  actionBtn: { flex: 1, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  approveBtn: { backgroundColor: '#6366F1' },
  rejectBtn: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FECACA' },
  btnText: { color: '#FFF', fontWeight: '700' },
  rejectText: { color: '#DC2626', fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', padding: 25, paddingBottom: Platform.OS === 'ios' ? 40 : 25, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalHeaderIndicator: { width: 40, height: 5, backgroundColor: '#E2E8F0', borderRadius: 3, alignSelf: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 22, fontWeight: '800', marginBottom: 15, color: '#0F172A' },
  modalSub: { color: '#64748B', marginBottom: 15 },
  infoRow: { marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 8 },
  infoLabel: { fontSize: 12, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase' },
  infoValue: { fontSize: 16, color: '#1E293B', fontWeight: '700', marginTop: 2 },
  input: { backgroundColor: '#F1F5F9', borderRadius: 12, padding: 15, height: 100, textAlignVertical: 'top', fontSize: 16, color: '#1E293B' },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  cancelLink: { color: '#94A3B8', fontWeight: '600', padding: 10 },
  confirmReject: { backgroundColor: '#DC2626', paddingHorizontal: 25, paddingVertical: 15, borderRadius: 12 },
  closeBtn: { padding: 10 }
});