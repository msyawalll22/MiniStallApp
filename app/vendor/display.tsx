import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useState } from 'react';
import { Dimensions, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { auth, db } from '../../firebaseConfig';

const { width } = Dimensions.get('window');
const isTablet = width > 768;

export default function CustomerDisplay() {
  const [preparing, setPreparing] = useState<any[]>([]);
  const [ready, setReady] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const user = auth.currentUser;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;

    const statusFilter = ["pending", "preparing", "ready"];

    const qPos = query(
      collection(db, "orders"),
      where("userId", "==", user.uid),
      where("status", "in", statusFilter)
    );

    const qWeb = query(
      collection(db, "orders"),
      where("vendorId", "==", user.uid),
      where("status", "in", statusFilter)
    );

    let posItems: any[] = [];
    let webItems: any[] = [];

    const processOrders = () => {
      const allOrders = [...posItems, ...webItems];
      const unique = Array.from(new Map(allOrders.map(item => [item.id, item])).values());

      setPreparing(unique.filter(o => o.status === "pending" || o.status === "preparing"));
      setReady(unique.filter(o => o.status === "ready"));
    };

    const unsubPos = onSnapshot(qPos, (snap) => {
      posItems = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      processOrders();
    });

    const unsubWeb = onSnapshot(qWeb, (snap) => {
      webItems = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      processOrders();
    });

    return () => {
      unsubPos();
      unsubWeb();
    };
  }, [user?.uid]);

  const getDisplayId = (order: any) => {
    if (order.table === "Takeaway" || !order.table) {
      return order.queueNumber ? `Q-${order.queueNumber}` : "TAKEAWAY";
    }
    return `TBL-${order.table}`;
  };

  if (!user) return <View style={styles.center}><Text>Please login as Vendor</Text></View>;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.mainWrapper}>
        {/* READY SECTION */}
        <View style={styles.readySection}>
          <Text style={styles.sectionLabelReady}>READY TO COLLECT</Text>
          
          <View style={styles.readyContentContainer}>
            {ready.length > 0 ? (
              <ScrollView contentContainerStyle={styles.readyGrid} showsVerticalScrollIndicator={false}>
                {ready.map((order, i) => (
                  <View key={i} style={styles.readyCard}>
                    <Text style={styles.readyNumber}>{getDisplayId(order)}</Text>
                    <View style={styles.collectBadge}>
                      <Text style={styles.collectText}>READY</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyBox}>
                <Ionicons name="restaurant-outline" size={120} color="#CBD5E1" />
                <Text style={styles.waitingText}>Waiting for orders...</Text>
              </View>
            )}
          </View>
        </View>

        {/* PREPARING SECTION */}
        <View style={styles.prepSection}>
          <Text style={styles.sectionLabelPrep}>STILL PREPARING</Text>
          <ScrollView contentContainerStyle={styles.prepGrid} showsVerticalScrollIndicator={false}>
            {preparing.map((order, i) => (
              <View key={i} style={styles.prepItem}>
                <Text style={styles.prepNumber}>{getDisplayId(order)}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerBrand}>MINISTALL <Text style={{color: '#6366F1'}}>PRO</Text></Text>
        <Text style={styles.footerClock}>
          {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mainWrapper: { flex: 1, flexDirection: isTablet ? 'row' : 'column' },
  
  readySection: { 
    flex: isTablet ? 0.65 : 0.6, 
    backgroundColor: '#FFF', 
    paddingTop: 30, 
    paddingHorizontal: 20,
    borderRightWidth: isTablet ? 2 : 0, 
    borderRightColor: '#F1F5F9'
  },
  sectionLabelReady: { color: '#10B981', fontSize: 32, fontWeight: '900', letterSpacing: 2, marginBottom: 30, textAlign: 'center' },
  
  readyContentContainer: { flex: 1 },
  readyGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 20, paddingBottom: 40 },
  
  readyCard: { 
    backgroundColor: '#F0FDF4', borderRadius: 24, padding: 25, 
    minWidth: isTablet ? 200 : 140, alignItems: 'center',
    borderWidth: 4, borderColor: '#10B981',
    shadowColor: '#10B981', shadowOpacity: 0.1, shadowRadius: 10, elevation: 3
  },
  readyNumber: { color: '#064E3B', fontSize: isTablet ? 60 : 38, fontWeight: '900' },
  collectBadge: { backgroundColor: '#10B981', paddingHorizontal: 15, paddingVertical: 6, borderRadius: 10, marginTop: 8 },
  collectText: { color: '#FFF', fontWeight: '900', fontSize: 16 },

  prepSection: { flex: isTablet ? 0.35 : 0.4, padding: 20, backgroundColor: '#F1F5F9' },
  sectionLabelPrep: { color: '#6366F1', fontSize: 20, fontWeight: '900', letterSpacing: 2, marginBottom: 20, textAlign: 'center' },
  prepGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, paddingBottom: 40 },
  prepItem: { backgroundColor: '#FFF', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 15, minWidth: 100, alignItems: 'center' },
  prepNumber: { color: '#64748B', fontSize: 22, fontWeight: '800' },
  
  emptyBox: { 
    flex: 0.8, // Takes up majority of the ready area to stay centered
    alignItems: 'center', 
    justifyContent: 'center'
  },
  waitingText: { color: '#94A3B8', fontSize: 24, fontWeight: '700', marginTop: 20 },

  footer: { height: 70, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 30, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  footerBrand: { color: '#0F172A', fontSize: 22, fontWeight: '900' },
  footerClock: { color: '#64748B', fontSize: 22, fontWeight: '700' }
});