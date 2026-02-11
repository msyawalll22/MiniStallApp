import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text, // Fixed the import here
  View
} from 'react-native';
import { auth, db } from '../../firebaseConfig';

const { width } = Dimensions.get('window');

export default function AdminRevenue() {
  const [loading, setLoading] = useState<boolean>(true);
  const [subscriptionLogs, setSubscriptionLogs] = useState<any[]>([]);
  const [totalRevenue, setTotalRevenue] = useState<number>(0);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, "subscriptions"), orderBy("paidAt", "desc"));

    const unsubscribe = onSnapshot(q, (snap) => {
      if (!auth.currentUser) return;

      let income = 0;
      const list: any[] = [];

      snap.forEach((doc) => {
        const data = doc.data();
        const amount = Number(data.amount) || 0;
        income += amount;
        list.push({ id: doc.id, ...data });
      });

      setSubscriptionLogs(list);
      setTotalRevenue(income);
      setLoading(false);
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.error("Revenue Fetch Error: ", error);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#6366F1" />
    </View>
  );

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.paymentCard}>
      <View style={styles.cardLeft}>
        <View style={styles.iconContainer}>
          <Ionicons name="business" size={20} color="#6366F1" />
        </View>
        <View>
          <Text style={styles.stallNameText} numberOfLines={1}>
            {item.stallName || 'System Admin'}
          </Text>
          {/* Added Owner Name Subtext */}
          <Text style={styles.ownerText}>
            {item.ownerName || 'Unknown Owner'}
          </Text>
          <Text style={styles.timestampText}>
            {item.paidAt?.toDate ? item.paidAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Processing...'}
          </Text>
        </View>
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.itemAmount}>+RM{Number(item.amount).toFixed(2)}</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>COMPLETED</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.headerContainer}>
        <Text style={styles.dateToday}>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
      </View>

      <View style={styles.mainBalanceContainer}>
        <View style={styles.balanceGradientCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>TOTAL BALANCE</Text>
            <Ionicons name="wallet-outline" size={24} color="rgba(255,255,255,0.8)" />
          </View>
          <Text style={styles.balanceAmount}>RM {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{subscriptionLogs.length}</Text>
              <Text style={styles.statLabel}>Transactions</Text>
            </View>
            <View style={[styles.statItem, styles.statBorder]}>
              <Text style={styles.statValue}>RM {(totalRevenue / (subscriptionLogs.length || 1)).toFixed(0)}</Text>
              <Text style={styles.statLabel}>Avg / Sub</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.historySection}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>Recent Activity</Text>
          <View>
             <Text style={styles.viewAllText}>Live Sync</Text>
          </View>
        </View>

        <FlatList
          data={subscriptionLogs}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listPadding}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={60} color="#CBD5E1" />
              <Text style={styles.emptyText}>No payments recorded yet.</Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerContainer: { paddingHorizontal: 25, paddingTop: 20, marginBottom: 15 },
  dateToday: { fontSize: 14, color: '#64748B', fontWeight: '600', marginTop: 4 },
  mainBalanceContainer: { paddingHorizontal: 20, marginBottom: 25 },
  balanceGradientCard: {
    backgroundColor: '#1E293B',
    borderRadius: 30,
    padding: 25,
    elevation: 8,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  balanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  balanceAmount: { color: '#FFF', fontSize: 38, fontWeight: '900', marginVertical: 15 },
  statsRow: { 
    flexDirection: 'row', 
    backgroundColor: 'rgba(255,255,255,0.08)', 
    borderRadius: 20, 
    padding: 15,
    marginTop: 5 
  },
  statItem: { flex: 1, alignItems: 'center' },
  statBorder: { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)' },
  statValue: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginTop: 2 },
  historySection: { flex: 1, backgroundColor: '#FFF', borderTopLeftRadius: 35, borderTopRightRadius: 35, paddingHorizontal: 25, paddingTop: 30 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  historyTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  viewAllText: { color: '#6366F1', fontWeight: '700', fontSize: 13 },
  listPadding: { paddingBottom: 30 },
  paymentCard: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  iconContainer: { 
    width: 48, 
    height: 48, 
    backgroundColor: '#EEF2FF', 
    borderRadius: 16, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  stallNameText: { fontSize: 15, fontWeight: '700', color: '#1E293B', maxWidth: width * 0.4 },
  ownerText: { fontSize: 12, color: '#6366F1', fontWeight: '600' }, // Added style for Owner Name
  timestampText: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  itemAmount: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
  statusBadge: { 
    backgroundColor: '#DCFCE7', 
    paddingHorizontal: 8, 
    paddingVertical: 2, 
    borderRadius: 6, 
    marginTop: 5 
  },
  statusText: { color: '#166534', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#94A3B8', marginTop: 15, fontWeight: '600' }
});