import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Timestamp, collection, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

import { auth, db } from '../../firebaseConfig';

const { width } = Dimensions.get('window');
const isTablet = width > 768;

type FilterType = 'today' | 'yesterday' | 'month' | 'last 2 Months';
type PaymentMethodFilter = 'all' | 'QR' | 'Cash';

export default function OrderHistory() {
  const [orders, setOrders] = useState<any[]>([]);
  const [totalSales, setTotalSales] = useState(0);
  const [topItems, setTopItems] = useState<any[]>([]);
  const [hourlyStats, setHourlyStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeFilter, setActiveFilter] = useState<FilterType>('today');
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethodFilter>('all');
  
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);

    const start = new Date();
    const end = new Date();

    if (activeFilter === 'today') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (activeFilter === 'yesterday') {
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (activeFilter === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (activeFilter === 'last 2 Months') {
      start.setMonth(start.getMonth() - 1);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    const startTS = Timestamp.fromDate(start);
    const endTS = Timestamp.fromDate(end);

    const qPos = query(collection(db, "orders"), where("userId", "==", user.uid), where("timestamp", ">=", startTS), where("timestamp", "<=", endTS));
    const qWeb = query(collection(db, "orders"), where("vendorId", "==", user.uid), where("timestamp", ">=", startTS), where("timestamp", "<=", endTS));
    const qPosFb = query(collection(db, "orders"), where("userId", "==", user.uid), where("createdAt", ">=", startTS), where("createdAt", "<=", endTS));
    const qWebFb = query(collection(db, "orders"), where("vendorId", "==", user.uid), where("createdAt", ">=", startTS), where("createdAt", "<=", endTS));

    let results: { pos: any[], web: any[], posFb: any[], webFb: any[] } = { pos: [], web: [], posFb: [], webFb: [] };

    const processData = () => {
      const combined = [...results.pos, ...results.web, ...results.posFb, ...results.webFb];
      const uniqueMap = new Map<string, any>();
      
      combined.forEach(item => {
        if (item && item.id) uniqueMap.set(item.id, item);
      });
      
      const unique = Array.from(uniqueMap.values());

      const filtered = unique.filter((item: any) => {
        const pMethod = (item.method || item.paymentMethod || "").toUpperCase();
        if (paymentFilter === 'all') return true;
        return pMethod.includes(paymentFilter.toUpperCase());
      });

      filtered.sort((a, b) => {
        const tA = (a.timestamp || a.createdAt)?.toMillis() || 0;
        const tB = (b.timestamp || b.createdAt)?.toMillis() || 0;
        return tB - tA;
      });

      let revenue = 0;
      const itemCounts: Record<string, number> = {};
      const hourCounts: Record<number, number> = {};
      for (let i = 0; i < 24; i++) hourCounts[i] = 0;

      filtered.forEach((item: any) => {
        let orderTotal = parseFloat(item.total || item.totalPrice || 0);
        
        if (orderTotal === 0 && item.items) {
           orderTotal = item.items.reduce((sum: number, it: any) => {
              const price = parseFloat(it.price || 0);
              const qty = parseInt(it.qty || it.quantity || 0);
              return sum + (price * qty);
           }, 0);
        }
        
        revenue += orderTotal;
        item.computedTotal = orderTotal; 

        const date = (item.timestamp || item.createdAt)?.toDate();
        if (date) {
          const hour = date.getHours();
          hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        }

        item.items?.forEach((it: any) => {
          const qty = parseInt(it.qty || it.quantity || 0);
          itemCounts[it.name] = (itemCounts[it.name] || 0) + qty;
        });
      });

      setTopItems(Object.keys(itemCounts)
        .map(name => ({ name, count: itemCounts[name] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5));

      setHourlyStats(Object.keys(hourCounts).map(h => ({
        hour: parseInt(h, 10),
        count: hourCounts[parseInt(h, 10)]
      })));

      setOrders(filtered);
      setTotalSales(revenue);
      setLoading(false);
    };

    const unsubPos = onSnapshot(qPos, (s) => { results.pos = s.docs.map(d => ({...d.data(), id: d.id})); processData(); });
    const unsubWeb = onSnapshot(qWeb, (s) => { results.web = s.docs.map(d => ({...d.data(), id: d.id})); processData(); });
    const unsubPosFb = onSnapshot(qPosFb, (s) => { results.posFb = s.docs.map(d => ({...d.data(), id: d.id})); processData(); });
    const unsubWebFb = onSnapshot(qWebFb, (s) => { results.webFb = s.docs.map(d => ({...d.data(), id: d.id})); processData(); });

    return () => { unsubPos(); unsubWeb(); unsubPosFb(); unsubWebFb(); };
  }, [activeFilter, paymentFilter]);

  const generatePDF = async (order: any) => {
    const isTakeaway = order.table === "Takeaway" || !order.table;
    const displayId = isTakeaway ? `Q-${order.queueNumber || order.orderSequence || '?'}` : `Table ${order.table}`;
    const orderDate = (order.timestamp || order.createdAt)?.toDate().toLocaleString();

    const html = `
      <html>
        <body style="font-family: sans-serif; padding: 20px;">
          <h1 style="text-align: center;">RECEIPT</h1>
          <p style="text-align: center;">${displayId} | ${orderDate}</p>
          <hr/>
          ${order.items.map((it: any) => `
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span>${it.qty || it.quantity}x ${it.name}</span>
              <span>RM ${(parseFloat(it.price) * parseInt(it.qty || it.quantity)).toFixed(2)}</span>
            </div>
          `).join('')}
          <hr/>
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 18px;">
            <span>TOTAL</span>
            <span>RM ${(order.computedTotal || 0).toFixed(2)}</span>
          </div>
        </body>
      </html>
    `;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    } catch (e) {
      Alert.alert("Error", "Could not generate receipt");
    }
  };

  const renderHeader = () => (
    <View>
      <View style={isTablet ? styles.tabletRow : null}>
        <View style={[styles.dashboardCard, isTablet && { flex: 1, marginRight: 10 }]}>
          <Text style={styles.dashLabel}>{activeFilter.toUpperCase()} REVENUE</Text>
          <Text style={styles.dashValue}>RM {totalSales.toFixed(2)}</Text>
          <View style={styles.statsRow}>
            <Text style={styles.statText}>{orders.length} Orders</Text>
            <View style={styles.dot} />
            <Text style={styles.statText}>Avg RM {(totalSales / (orders.length || 1)).toFixed(2)}</Text>
          </View>
        </View>

        <View style={[styles.sectionContainer, isTablet && { flex: 1, marginLeft: 10 }]}>
          <Text style={styles.sectionTitleChart}>🏆 TOP SELLERS</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={topItems}
            keyExtractor={(item) => item.name}
            renderItem={({ item, index }) => (
              <View style={styles.topBadge}>
                <Text style={styles.topRank}>{index + 1}</Text>
                <Text style={styles.topName}>{item.name}</Text>
                <Text style={styles.topQty}>{item.count}</Text>
              </View>
            )}
            contentContainerStyle={{ gap: 12 }}
          />
        </View>
      </View>

      <View style={styles.filterBar}>
        {['today', 'yesterday', 'month', 'last 2 Months'].map((f) => (
          <TouchableOpacity key={f} style={[styles.filterBtn, activeFilter === f && styles.filterBtnActive]} onPress={() => setActiveFilter(f as FilterType)}>
            <Text style={[styles.filterBtnText, activeFilter === f && styles.filterBtnTextActive]}>{f.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.payFilterBar}>
        {['all', 'QR', 'Cash'].map((m) => (
          <TouchableOpacity key={m} style={[styles.payFilterBtn, paymentFilter === m && styles.payFilterBtnActive]} onPress={() => setPaymentFilter(m as PaymentMethodFilter)}>
            <Text style={[styles.payFilterText, paymentFilter === m && styles.payFilterTextActive]}>{m.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" color="#6366F1" /></View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          renderItem={({ item }) => {
            const displayLabel = (item.table === "Takeaway" || !item.table) ? `Q-${item.queueNumber || item.orderSequence || '?'}` : `Table ${item.table}`;
            const payMethod = (item.method || item.paymentMethod || "").toLowerCase();
            const orderTime = (item.timestamp || item.createdAt)?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <TouchableOpacity style={styles.orderRow} onPress={() => { setSelectedOrder(item); setModalVisible(true); }}>
                <View style={[styles.orderIcon, { backgroundColor: payMethod.includes('qr') ? '#EEF2FF' : '#ECFDF5' }]}>
                  <Text style={{ fontSize: 18 }}>{payMethod.includes('qr') ? '📱' : '💵'}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 15 }}>
                  <Text style={styles.orderTitle}>{displayLabel}</Text>
                  <Text style={styles.orderTime}>{item.userId ? 'POS' : 'WEB'} • {orderTime}</Text>
                </View>
                <Text style={styles.orderAmount}>RM {(item.computedTotal || 0).toFixed(2)}</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isTablet && { width: 500, alignSelf: 'center' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Details</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseCircle}><Text>✕</Text></TouchableOpacity>
            </View>
            {selectedOrder && (
              <View>
                <View style={styles.receiptHeader}>
                  <Text style={styles.receiptQueue}>
                    {(selectedOrder.table === "Takeaway" || !selectedOrder.table) ? `Q-${selectedOrder.queueNumber || selectedOrder.orderSequence || '?'}` : `Table ${selectedOrder.table}`}
                  </Text>
                  <Text style={styles.receiptStatus}>PAID via {(selectedOrder.method || selectedOrder.paymentMethod || 'N/A').toUpperCase()}</Text>
                </View>
                {selectedOrder.items?.map((it: any, i: number) => (
                  <View key={i} style={styles.itemLine}>
                    <Text style={styles.itemQty}>{it.qty || it.quantity}x</Text>
                    <Text style={styles.itemName}>{it.name}</Text>
                    <Text style={styles.itemPrice}>RM {(parseFloat(it.price) * parseInt(it.qty || it.quantity)).toFixed(2)}</Text>
                  </View>
                ))}
                <View style={styles.finalTotalRow}>
                  <Text style={styles.totalLabel}>Total Revenue</Text>
                  <Text style={styles.totalVal}>RM {(selectedOrder.computedTotal || 0).toFixed(2)}</Text>
                </View>
                <TouchableOpacity style={styles.printButton} onPress={() => generatePDF(selectedOrder)}>
                  <Text style={styles.printButtonText}>🖨️ Share Receipt (PDF)</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  tabletRow: { flexDirection: 'row', paddingHorizontal: 20 },
  dashboardCard: { margin: 20, backgroundColor: '#111827', borderRadius: 28, padding: 25 },
  dashLabel: { color: '#9CA3AF', fontSize: 11, fontWeight: '700' },
  dashValue: { color: '#FFF', fontSize: 36, fontWeight: '900' },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  statText: { color: '#D1D5DB', fontSize: 13 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#4B5563', marginHorizontal: 10 },
  sectionContainer: { marginBottom: 25, paddingHorizontal: 20 },
  sectionTitleChart: { fontSize: 11, fontWeight: '800', color: '#6B7280', marginBottom: 15 },
  topBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 100, borderWidth: 1, borderColor: '#F3F4F6' },
  topRank: { backgroundColor: '#6366F1', color: '#FFF', fontSize: 10, fontWeight: '900', width: 18, height: 18, borderRadius: 9, textAlign: 'center', lineHeight: 18, marginRight: 8 },
  topName: { fontSize: 13, fontWeight: '700' },
  topQty: { fontSize: 13, fontWeight: '800', color: '#6366F1', marginLeft: 8 },
  filterBar: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 12 },
  filterBtn: { flex: 1, height: 44, borderRadius: 12, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  filterBtnActive: { backgroundColor: '#111827' },
  filterBtnText: { color: '#6B7280', fontWeight: '700', fontSize: 10 },
  filterBtnTextActive: { color: '#FFF' },
  payFilterBar: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 25 },
  payFilterBtn: { flex: 1, height: 40, borderRadius: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  payFilterBtnActive: { backgroundColor: '#EEF2FF', borderColor: '#6366F1' },
  payFilterText: { color: '#6B7280', fontWeight: '600', fontSize: 11 },
  payFilterTextActive: { color: '#6366F1' },
  orderRow: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  orderIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  orderTitle: { fontSize: 15, fontWeight: '700' },
  orderTime: { fontSize: 11, color: '#9CA3AF' },
  orderAmount: { fontSize: 16, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 25, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  modalCloseCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  receiptHeader: { alignItems: 'center', marginBottom: 20 },
  receiptQueue: { fontSize: 40, fontWeight: '900' },
  receiptStatus: { fontSize: 11, fontWeight: '800', color: '#10B981' },
  itemLine: { flexDirection: 'row', marginBottom: 10 },
  itemQty: { width: 30, fontWeight: '700', color: '#6366F1' },
  itemName: { flex: 1 },
  itemPrice: { fontWeight: '600' },
  finalTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  totalLabel: { fontSize: 14, color: '#6B7280' },
  totalVal: { fontSize: 22, fontWeight: '900' },
  printButton: { backgroundColor: '#6366F1', marginTop: 20, padding: 15, borderRadius: 12, alignItems: 'center' },
  printButtonText: { color: '#FFF', fontWeight: '800' }
});