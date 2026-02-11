import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { db } from '../../firebaseConfig';

/** ✅ FIX: explicit Order type */
type OrderStatus = 'pending' | 'preparing' | 'ready';

interface Order {
  id: string;
  status: OrderStatus;
  table?: string;
  orderSequence?: number;
}

export default function CustomerDisplay() {
  const { vendorId, table } = useLocalSearchParams();
  const router = useRouter();

  const [activeTableOrders, setActiveTableOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  /** ✅ FIX: typed Set */
  const notifiedOrders = useRef<Set<string>>(new Set());

  async function triggerReadyNotification() {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' }
      );
      await sound.playAsync();

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.log("Error triggering notification", error);
    }
  }

  useEffect(() => {
    if (!vendorId || !table) return;

    const qActive = query(
      collection(db, "orders"),
      where("vendorId", "==", vendorId),
      where("table", "==", table),
      where("status", "in", ["pending", "preparing", "ready"]),
      orderBy("createdAt", "desc")
    );

    const unsubActive = onSnapshot(qActive, (snap) => {
      /** ✅ FIX: cast snapshot data to Order */
      const items: Order[] = snap.docs.map(d => ({
        ...(d.data() as Omit<Order, 'id'>),
        id: d.id,
      }));

      items.forEach(order => {
        /** ✅ FIXED LINE (now fully type-safe) */
        if (
          order.status === 'ready' &&
          !notifiedOrders.current.has(order.id)
        ) {
          triggerReadyNotification();
          notifiedOrders.current.add(order.id);
        }
      });

      // cleanup removed orders
      const currentIds = new Set(items.map(i => i.id));
      notifiedOrders.current.forEach(id => {
        if (!currentIds.has(id)) {
          notifiedOrders.current.delete(id);
        }
      });

      setActiveTableOrders(items);
      setLoading(false);
    });

    return () => unsubActive();
  }, [vendorId, table]);

  const handleGoBack = () => {
    router.replace({ pathname: '/customer', params: { vendorId, table } } as any);
  };

  const getOrderDisplayId = (item: Order) => {
    const tableNum = item.table || '0';
    if (item.orderSequence !== undefined) {
      return `TBL-${tableNum}-${String(item.orderSequence).padStart(5, '0')}`;
    }
    return `TBL-${tableNum}-${item.id.slice(-4).toUpperCase()}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>Status Tracker</Text>
          <Text style={styles.headerTitle}>Table {table || 'N/A'}</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={handleGoBack}>
          <Ionicons name="cart" size={24} color="#6366F1" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Current Orders</Text>
          {activeTableOrders.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeTableOrders.length}</Text>
            </View>
          )}
        </View>

        {activeTableOrders.length > 0 ? (
          activeTableOrders.map((order) => (
            <View
              key={order.id}
              style={[
                styles.orderCard,
                order.status === 'ready' && styles.orderCardReady
              ]}
            >
              <View style={styles.cardTop}>
                <View>
                  <Text style={[styles.orderIdLabel, order.status === 'ready' && { color: '#FFF' }]}>
                    ORDER ID
                  </Text>
                  <Text style={[styles.orderId, order.status === 'ready' && { color: '#FFF' }]}>
                    {getOrderDisplayId(order)}
                  </Text>
                </View>
                <View style={[
                  styles.statusTag,
                  order.status === 'ready' ? styles.tagReady : styles.tagPrep
                ]}>
                  <Text style={[styles.tagText, order.status === 'ready' && { color: '#FFF' }]}>
                    {order.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                {order.status === 'ready' ? (
                  <View style={styles.readyContent}>
                    <Ionicons name="notifications" size={32} color="#FFF" />
                    <Text style={styles.readyMsg}>Collect at Counter Now!</Text>
                  </View>
                ) : (
                  <View style={styles.prepContent}>
                    <ActivityIndicator size="small" color="#6366F1" />
                    <Text style={styles.prepMsg}>We are preparing your order...</Text>
                  </View>
                )}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            {loading ? (
              <ActivityIndicator color="#6366F1" />
            ) : (
              <>
                <Ionicons name="receipt-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyText}>No active orders</Text>
                <TouchableOpacity onPress={handleGoBack}>
                  <Text style={styles.orderLink}>Tap to order something →</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    backgroundColor: '#FFF',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  headerSubtitle: { fontSize: 13, color: '#6366F1', fontWeight: '800', letterSpacing: 1 },
  headerTitle: { fontSize: 32, fontWeight: '900', color: '#0F172A' },
  iconBtn: { padding: 10, backgroundColor: '#EEF2FF', borderRadius: 12 },

  scrollContent: { padding: 20, paddingBottom: 50 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginRight: 10 },
  badge: { backgroundColor: '#6366F1', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { color: '#FFF', fontSize: 12, fontWeight: '900' },

  orderCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2
  },
  orderCardReady: { backgroundColor: '#6366F1', borderColor: '#4F46E5' },

  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  orderIdLabel: { fontSize: 10, fontWeight: '800', color: '#94A3B8' },
  orderId: { fontSize: 20, fontWeight: '900', color: '#0F172A' },

  statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagPrep: { backgroundColor: '#F1F5F9' },
  tagReady: { backgroundColor: 'rgba(255,255,255,0.2)' },
  tagText: { fontSize: 10, fontWeight: '900', color: '#6366F1' },

  cardBody: { paddingVertical: 10 },
  prepContent: { flexDirection: 'row', alignItems: 'center' },
  prepMsg: { marginLeft: 10, color: '#64748B', fontWeight: '600' },

  readyContent: { alignItems: 'center' },
  readyMsg: { color: '#FFF', fontWeight: '900', fontSize: 18, marginTop: 10 },

  emptyState: { alignItems: 'center', paddingVertical: 100 },
  emptyText: { color: '#94A3B8', fontSize: 16, fontWeight: '600', marginTop: 10 },
  orderLink: { color: '#6366F1', fontWeight: '800', marginTop: 10 },
});
