import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av'; // 1. Import Audio
import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import React, { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Linking, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

// IMPORT from your central config
import { auth, db } from '../../firebaseConfig';

export default function KitchenScreen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 2. Ref to track previous order count to avoid dinging on delete/complete
  const prevOrderCount = useRef(0);

  const { width } = useWindowDimensions();
  const isTablet = width > 768;
  const numColumns = isTablet ? 2 : 1;

  // 3. Function to play the DING sound
  async function playDing() {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' } // A professional "Ding"
      );
      await sound.playAsync();
      
      // Unload from memory when done
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.log("Error playing sound", error);
    }
  }

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const activeStatuses = ["pending", "received", "paid", "preparing", "ready"];

    const qPos = query(
      collection(db, "orders"), 
      where("userId", "==", user.uid),
      where("status", "in", activeStatuses)
    );

    const qCustomer = query(
      collection(db, "orders"), 
      where("vendorId", "==", user.uid),
      where("status", "in", activeStatuses)
    );

    let posOrders: any[] = [];
    let customerOrders: any[] = [];

    const mergeAndSort = () => {
      const combined = [...posOrders, ...customerOrders];
      const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());

      unique.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || a.timestamp?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || b.timestamp?.toMillis?.() || 0;
        return timeA - timeB;
      });

      // 4. TRIGGER DING LOGIC
      // If the new count is higher than the previous count, a new order arrived!
      if (unique.length > prevOrderCount.current) {
        playDing();
      }
      
      // Update the ref for the next change
      prevOrderCount.current = unique.length;
      
      setOrders(unique);
      setLoading(false);
    };

    const unsubPos = onSnapshot(qPos, (snap) => {
      posOrders = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      mergeAndSort();
    }, (err) => console.error("POS Fetch Error:", err));

    const unsubCustomer = onSnapshot(qCustomer, (snap) => {
      customerOrders = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      mergeAndSort();
    }, (err) => console.error("Web Fetch Error:", err));

    return () => {
      unsubPos();
      unsubCustomer();
    };
  }, [auth.currentUser?.uid]); 

  const completeOrder = async (id: string) => {
    try {
      await updateDoc(doc(db, "orders", id), { status: "completed" });
    } catch (error) {
      Alert.alert("Error", "Could not complete order.");
    }
  };

  const markAsPaid = async (id: string) => {
    try {
      await updateDoc(doc(db, "orders", id), { 
        paymentStatus: "PAID",
        paid: true 
      });
    } catch (error) {
      Alert.alert("Error", "Could not update payment status.");
    }
  };

  const markAsReady = async (order: any) => {
    try {
      await updateDoc(doc(db, "orders", order.id), { status: "ready" });
      if (order.customerPhone) {
        const qNum = order.orderSequence || order.queueNumber || order.orderNumber || order.id.slice(-5);
        sendReadyNotification(order.customerPhone, order.table || "Takeaway", qNum);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to update order status.");
    }
  };

  const sendReadyNotification = (phone: string, table: string, queue?: any) => {
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) { cleanPhone = '6' + cleanPhone; }
    
    const location = (table === "Takeaway" || !table || table === "N/A") ? `Queue #${queue}` : `Table ${table}`;
    const message = `*MiniStall Notification*\n\nYour Order for *${location}* is now *READY*! ✅\nPlease come to the stall to collect your food. Thank you!`;
    
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => Alert.alert("Error", "Could not open WhatsApp."));
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={[styles.header, isTablet && styles.headerTablet]}>
        <View>
          <Text style={styles.headerSubtitle}>Live Updates</Text>
          <Text style={styles.headerTitle}>Kitchen Feed</Text>
        </View>
        <View style={styles.activeBadge}>
          <Text style={styles.activeBadgeText}>{orders.length} ACTIVE</Text>
        </View>
      </View>

      <FlatList
        key={isTablet ? 'tablet' : 'phone'} 
        numColumns={numColumns}
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, isTablet && styles.listContentTablet]}
        columnWrapperStyle={isTablet ? styles.columnWrapper : null}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isTakeaway = item.table === "Takeaway" || !item.table || item.table === "N/A";
          const isPaid = item.paid === true || item.paymentStatus === 'PAID';
          const orderSource = item.userId ? "🖥 POS" : "📱 WEB";
          const displayQueue = item.orderSequence || item.queueNumber || item.orderNumber || item.id.slice(-5);

          return (
            <View style={[styles.card, item.status === 'ready' && styles.readyCard, isTablet && styles.cardTablet]}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderNumber}>
                    {isTakeaway ? `Q-${displayQueue}` : `Table ${item.table}`}
                  </Text>
                  <Text style={styles.orderMeta}>
                    {orderSource} • {item.status.toUpperCase()}
                  </Text>
                  
                  <View style={[styles.payBadge, isPaid ? styles.payPaid : styles.payUnpaid]}>
                     <Text style={[styles.payBadgeText, isPaid ? {color: '#065F46'} : {color: '#991B1B'}]}>
                      {isPaid ? '✓ PAID' : 'UNPAID'}
                     </Text>
                  </View>

                  {item.customerPhone && (
                    <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.customerPhone}`)}>
                      <Text style={styles.phoneText}>📞 {item.customerPhone}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={[styles.statusTag, item.status === 'ready' ? styles.tagReady : styles.tagPrep]}>
                  <Text style={[styles.tagText, item.status === 'ready' && { color: '#FFF' }]}>
                    {item.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.itemsBox}>
                {(item.items || []).map((prod: any, idx: number) => (
                  <View key={idx} style={styles.itemLine}>
                    <View style={styles.qtyBubble}>
                      <Text style={styles.qtyText}>{prod.qty || prod.quantity}</Text>
                    </View>
                    <Text style={styles.itemName}>{prod.name}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.cardAction}>
                {!isPaid && (
                  <TouchableOpacity style={styles.payBtn} onPress={() => markAsPaid(item.id)}>
                    <Ionicons name="cash-outline" size={20} color="#6366F1" />
                    <Text style={styles.payBtnText}>Confirm Payment</Text>
                  </TouchableOpacity>
                )}

                {item.status !== 'ready' ? (
                  <TouchableOpacity style={styles.primaryBtn} onPress={() => markAsReady(item)}>
                    <Ionicons name="notifications" size={20} color="white" />
                    <Text style={styles.primaryBtnText}>Mark Ready</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.successBtn} onPress={() => completeOrder(item.id)}>
                    <Ionicons name="checkbox" size={20} color="white" />
                    <Text style={styles.successBtnText}>Mark Collected</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cafe-outline" size={64} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>Kitchen is Clear</Text>
            <Text style={styles.emptySubtitle}>Waiting for POS or Web orders...</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { 
    paddingHorizontal: 25, paddingVertical: 20, flexDirection: 'row', 
    justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9'
  },
  headerTablet: { paddingHorizontal: 40, paddingVertical: 30 },
  headerSubtitle: { fontSize: 12, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  activeBadge: { backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  activeBadgeText: { color: '#6366F1', fontWeight: '800', fontSize: 12 },
  listContent: { padding: 16 },
  listContentTablet: { padding: 30 },
  columnWrapper: { justifyContent: 'space-between' },
  card: { 
    backgroundColor: '#FFF', borderRadius: 24, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: '#F1F5F9', elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 10, flex: 1
  },
  cardTablet: { marginHorizontal: 8, marginBottom: 20 },
  readyCard: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  orderNumber: { fontSize: 28, fontWeight: '900', color: '#0F172A' },
  orderMeta: { color: '#64748B', fontWeight: '600', marginTop: 4, fontSize: 12 },
  phoneText: { fontSize: 12, color: '#6366F1', fontWeight: '700', marginTop: 8 },
  payBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 8 },
  payPaid: { backgroundColor: '#D1FAE5' },
  payUnpaid: { backgroundColor: '#FEE2E2' },
  payBadgeText: { fontSize: 10, fontWeight: '900' },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, marginBottom: 10, borderRadius: 12, borderWidth: 1, borderColor: '#6366F1', borderStyle: 'dashed', gap: 8 },
  payBtnText: { color: '#6366F1', fontWeight: '700', fontSize: 14 },
  statusTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  tagPrep: { backgroundColor: '#FEF3C7' },
  tagReady: { backgroundColor: '#10B981' },
  tagText: { color: '#92400E', fontWeight: '800', fontSize: 10 },
  itemsBox: { marginBottom: 20 },
  itemLine: { flexDirection: 'row', marginBottom: 10, alignItems: 'center' },
  qtyBubble: { backgroundColor: '#F1F5F9', width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  qtyText: { fontSize: 14, fontWeight: '800', color: '#6366F1' },
  itemName: { fontSize: 17, fontWeight: '600', color: '#1E293B' },
  cardAction: { marginTop: 5 },
  primaryBtn: { backgroundColor: '#6366F1', height: 55, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  primaryBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  successBtn: { backgroundColor: '#10B981', height: 55, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  successBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  emptyState: { alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B', marginTop: 20 },
  emptySubtitle: { color: '#94A3B8', fontSize: 15, textAlign: 'center', marginTop: 8, lineHeight: 22 }
});