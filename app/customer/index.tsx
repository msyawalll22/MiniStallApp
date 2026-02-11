import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Font from 'expo-font';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  collection,
  deleteDoc,
  doc, getDoc, getDocs, getFirestore, onSnapshot,
  query, serverTimestamp, setDoc, Timestamp, where
} from "firebase/firestore";
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform,
  SafeAreaView, ScrollView, SectionList, StatusBar, StyleSheet,
  Text, TextInput, TouchableOpacity, useWindowDimensions, View
} from 'react-native';
import { createToyyibBill } from '../../services/ToyyibPayService';

// --- FIREBASE SETUP ---
const firebaseConfig = {
  apiKey: "AIzaSyBq7znOq22tDQyHvl8WBfLSPthZw3-30oc",
  authDomain: "ministall-app.firebaseapp.com",
  projectId: "ministall-app",
  storageBucket: "ministall-app.firebasestorage.app",
  messagingSenderId: "997346919313",
  appId: "1:997346919313:web:6a9d0c930fd95bb0101030"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const CATEGORIES = ["All", "Food", "Drink", "Snack", "Dessert"];

// --- PRODUCT ITEM COMPONENT ---
const ProductItem = memo(({ item, cardWidth, onUpdateCart }: any) => (
  <TouchableOpacity 
    activeOpacity={0.8}
    style={[styles.productCard, { width: cardWidth }]} 
    onPress={() => onUpdateCart(item, 1)}
  >
    <View style={styles.pCircle}>
      <Text style={styles.pLetter}>{item.name ? item.name[0] : '?'}</Text>
      <View style={styles.addIconSmall}>
        <Ionicons name="add" size={14} color="#FFF" />
      </View>
    </View>
    {/* FIXED: Changed <div> to <View> - <div> crashes React Native apps */}
    <View style={styles.cardInfo}>
        <Text style={styles.pName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.pPrice}>RM {Number(item.price).toFixed(2)}</Text>
    </View>
  </TouchableOpacity>
));

// --- CART CONTENT COMPONENT ---
const CartContent = ({ 
  cart, updateCart, customerPhone, setCustomerPhone,
  customerName, setCustomerName, customerEmail, setCustomerEmail,
  hasPhone, loading, handleToyyibPayment, 
  total, router, vendorId, table 
}: any) => (
  <View style={{ flex: 1 }}>
    <ScrollView 
        style={{ paddingHorizontal: 20 }} 
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
    >
      {cart.length === 0 ? (
        <View style={styles.emptyCartBox}>
          <Ionicons name="cart-outline" size={64} color="#CBD5E1" />
          <Text style={styles.emptyCartText}>Your cart is empty</Text>
        </View>
      ) : (
        cart.map((item: any) => (
          <View key={item.id} style={styles.cartItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPriceSub}>RM {(item.qty * item.price).toFixed(2)}</Text>
            </View>
            <View style={styles.qtyControls}>
              <TouchableOpacity onPress={() => updateCart(item, -1)}>
                <Ionicons name="remove-circle" size={32} color="#F1F5F9" />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{item.qty}</Text>
              <TouchableOpacity onPress={() => updateCart(item, 1)}>
                <Ionicons name="add-circle" size={32} color="#6366F1" />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
      
      {cart.length > 0 && (
        <View style={styles.calcContainer}>
          <View style={styles.divider} />
          
          <Text style={styles.inputLabel}>FULL NAME</Text>
          <TextInput 
            style={styles.phoneInput} 
            placeholder="e.g. Ali Abu" 
            placeholderTextColor="#94A3B8"
            value={customerName} 
            onChangeText={setCustomerName} 
          />

          <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
          <TextInput 
            style={styles.phoneInput} 
            placeholder="customer@email.com" 
            placeholderTextColor="#94A3B8"
            keyboardType="email-address"
            value={customerEmail} 
            onChangeText={setCustomerEmail} 
          />

          <Text style={styles.inputLabel}>WHATSAPP FOR NOTIFICATION</Text>
          <TextInput 
            style={styles.phoneInput} 
            placeholder="0112345678" 
            placeholderTextColor="#94A3B8"
            keyboardType="phone-pad" 
            value={customerPhone} 
            onChangeText={setCustomerPhone} 
          />
          
          <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>RM {total.toFixed(2)}</Text>
          </View>

          <TouchableOpacity 
            style={[styles.payBtn, (!hasPhone || loading) && styles.btnDisabled]} 
            onPress={handleToyyibPayment}
            disabled={!hasPhone || loading}
          >
            {loading ? <ActivityIndicator color="#FFF" /> : <Ionicons name="card" size={20} color="#FFF" />}
            <Text style={styles.payBtnText}> {loading ? ' Connecting...' : 'Pay Online Now'}</Text>
          </TouchableOpacity>

          <View style={styles.paymentInfo}>
             <Ionicons name="lock-closed-outline" size={14} color="#94A3B8" />
             <Text style={styles.paymentInfoText}>Secure Online Payment via ToyyibPay</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.statusLink} 
            onPress={() => router.push({
              pathname: '/customer/display',
              params: { vendorId, table }
            } as any)}
          >
            <Text style={styles.statusLinkText}>Check Order Status Board →</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  </View>
);

export default function OrderPage() {
  const { table, vendorId, action, prevPhone } = useLocalSearchParams(); 
  const router = useRouter();
  const { width } = useWindowDimensions();
  
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [actualStallName, setActualStallName] = useState('Unknown Stall');

  const [viewState, setViewState] = useState<'MENU' | 'CHECKOUT'>('MENU');
  const [loading, setLoading] = useState(false);
  const [fetchingMenu, setFetchingMenu] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false); 

  const isTablet = width > 768;
  const numColumns = width > 768 ? 3 : 2; 
  const gap = 16;
  const padding = 20;
  const availableWidth = isTablet ? width * 0.65 : width;
  const cardWidth = (availableWidth - (padding * 2) - (gap * (numColumns - 1))) / numColumns;

  // --- FIX 1: LOAD ICONS & CDN BACKUP FOR WEB ---
  useEffect(() => {
    async function loadIcons() {
      try {
        if (Platform.OS === 'web') {
            // Force inject Ionicons script as backup for "X" boxes
            const s = document.createElement('script');
            s.src = 'https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.js';
            s.type = 'module';
            document.head.appendChild(s);
        }
        await Font.loadAsync(Ionicons.font);
      } catch (e) {
        console.warn("Icon load error", e);
      } finally {
        setFontsLoaded(true);
      }
    }
    loadIcons();
  }, []);

  // --- 1. FETCH STALL DATA ---
  useEffect(() => {
    if (!vendorId) return;
    const fetchVendorData = async () => {
      const vRef = doc(db, "users", vendorId as string);
      const vSnap = await getDoc(vRef);
      if (vSnap.exists()) {
        setActualStallName(vSnap.data().stallName || vSnap.data().managerName || 'sycafe');
      }
    };
    fetchVendorData();
  }, [vendorId]);

  // --- PERSISTENCE ---
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const savedName = await AsyncStorage.getItem('@cust_name');
        const savedEmail = await AsyncStorage.getItem('@cust_email');
        const savedPhone = await AsyncStorage.getItem('@cust_phone');
        if (savedName) setCustomerName(savedName);
        if (savedEmail) setCustomerEmail(savedEmail);
        if (savedPhone) setCustomerPhone(savedPhone);
      } catch (e) { console.log("Memory error", e); }
    };
    loadUserData();
  }, []);

  useEffect(() => {
    if (action === 'clear') {
      setCart([]);
      router.setParams({ action: undefined }); 
    } else if (prevPhone && !customerPhone) {
      setCustomerPhone(prevPhone as string);
    }
  }, [action, prevPhone]);

  // --- PRODUCT STREAM ---
  useEffect(() => {
    if (!vendorId) { setFetchingMenu(false); return; }
    const q = query(collection(db, "products"), where("userId", "==", vendorId));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({
        ...d.data(),
        id: d.id,
        price: Number(d.data().price) || 0 
      }));
      setProducts(items.filter((p: any) => p.isAvailable !== false));
      setFetchingMenu(false);
    }, (error) => {
      setFetchingMenu(false);
    });
    return () => unsub();
  }, [vendorId]);

  const filteredProducts = useMemo(() => {
    if (selectedCategory === "All") return products;
    return products.filter(p => p.category === selectedCategory);
  }, [products, selectedCategory]);

  const sections = useMemo(() => {
    const activeCats = selectedCategory === "All" ? CATEGORIES.filter(c => c !== 'All') : [selectedCategory];
    return activeCats.map(cat => ({
      title: cat,
      data: [filteredProducts.filter(p => p.category === cat)]
    })).filter(group => group.data[0].length > 0);
  }, [filteredProducts, selectedCategory]);

  const total = useMemo(() => cart.reduce((s, i) => s + (i.price * i.qty), 0), [cart]);
  const hasPhone = useMemo(() => customerPhone.trim().length >= 10, [customerPhone]);

  const updateCart = useCallback((product: any, delta: number) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        const newQty = existing.qty + delta;
        if (newQty <= 0) return prev.filter(i => i.id !== product.id);
        return prev.map(i => i.id === product.id ? { ...i, qty: newQty } : i);
      }
      return delta > 0 ? [...prev, { ...product, qty: 1 }] : prev;
    });
  }, []);

  const saveOrderToFirebase = async (initialStatus: string = 'hidden') => {
    await AsyncStorage.setItem('@cust_name', customerName);
    await AsyncStorage.setItem('@cust_email', customerEmail);
    await AsyncStorage.setItem('@cust_phone', customerPhone);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayTimestamp = Timestamp.fromDate(startOfToday);

    const qCount = query(
      collection(db, "orders"),
      where("vendorId", "==", vendorId),
      where("createdAt", ">=", todayTimestamp)
    );
    
    const snapshot = await getDocs(qCount);
    const nextNumber = snapshot.size + 1;
    const sequence = String(nextNumber).padStart(5, '0');
    const cleanOrderId = `WEB-${table || '0'}-${sequence}`;

    await setDoc(doc(db, "orders", cleanOrderId), {
      orderId: cleanOrderId,
      orderSequence: nextNumber,
      vendorId, 
      stallName: actualStallName, 
      table: table || 'N/A',
      totalAmount: total, 
      status: initialStatus,
      paymentStatus: 'PENDING_ONLINE',
      paymentMethod: 'TOYYIBPAY', 
      customerPhone,
      customerName,
      customerEmail,
      createdAt: serverTimestamp(),
      items: cart.map(i => ({ name: i.name, quantity: i.qty, price: i.price }))
    });
    return cleanOrderId;
  };

  // --- FIX 2: WEB-PROOF PAYMENT ---
  const handleToyyibPayment = async () => {
    setLoading(true);
    try {
      const orderId = await saveOrderToFirebase('hidden');
      const url = await createToyyibBill(total, orderId, customerPhone, customerName, customerEmail);

      if (url) {
        if (Platform.OS === 'web') {
          // window.location.assign is more robust for normal browsers than .href
          window.location.assign(url);
        } else {
          setViewState('MENU'); 
          setIsVerifying(true); 
          await WebBrowser.openBrowserAsync(url);
          
          // Verify (Mobile only)
          await new Promise(resolve => setTimeout(resolve, 3000));
          const orderRef = doc(db, "orders", orderId);
          const orderSnap = await getDoc(orderRef);

          if (orderSnap.exists()) {
            if (orderSnap.data().status === 'hidden') {
              await deleteDoc(orderRef); 
              setIsVerifying(false);
              setLoading(false);
              router.push({ pathname: "/customer/failed", params: { vendorId, table, phone: customerPhone } } as any);
            } else {
              setCart([]); 
              setIsVerifying(false);
              setLoading(false);
              router.push({ pathname: "/customer/success", params: { orderId, vendorId, table } } as any);
            }
          }
        }
      }
    } catch (e) { 
      console.error(e);
      Alert.alert("Error", "Payment could not start."); 
    } finally { 
      setLoading(false); 
      setIsVerifying(false); 
    }
  };

  if (fetchingMenu || !fontsLoaded) return <View style={styles.centered}><ActivityIndicator size="large" color="#6366F1" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      
      {isVerifying && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.overlayText}>Verifying Payment Status...</Text>
          <TouchableOpacity style={{marginTop: 30}} onPress={() => { setIsVerifying(false); setLoading(false); }}>
            <Text style={{color: '#6366F1', fontWeight: 'bold'}}>Return to Menu</Text>
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.mainLayout}>
          <View style={{ flex: isTablet ? 0.65 : 1 }}>
            <View style={styles.header}>
              <View>
                <Text style={styles.headerSubtitle}>WELCOME TO TABLE {table}</Text>
                <Text style={styles.headerTitle}>Order <Text style={{color: '#6366F1'}}>Menu</Text></Text>
              </View>
              <TouchableOpacity style={styles.iconBtn} onPress={() => router.push({ pathname: '/customer/display', params: { vendorId, table } } as any)}>
                <Ionicons name="tv" size={22} color="#6366F1" />
              </TouchableOpacity>
            </View>

            <View style={styles.filterContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity 
                    key={cat} 
                    style={[styles.filterChip, selectedCategory === cat && styles.filterChipActive]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Text style={[styles.filterText, selectedCategory === cat && styles.filterTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <SectionList
              sections={sections}
              keyExtractor={(item, index) => index.toString()}
              stickySectionHeadersEnabled={false}
              renderSectionHeader={({ section: { title } }) => (
                <View style={styles.sectionHeader}>
                    <View style={styles.sectionLine} />
                    <Text style={styles.categoryTitle}>{title}</Text>
                    <View style={styles.sectionLine} />
                </View>
              )}
              renderItem={({ item }) => (
                <View style={[styles.gridContainer, { gap }]}>
                  {item.map((p: any) => <ProductItem key={p.id} item={p} cardWidth={cardWidth} onUpdateCart={updateCart} />)}
                </View>
              )}
              contentContainerStyle={styles.list}
            />
          </View>

          {isTablet && (
            <View style={styles.sidebar}>
              <View style={styles.sideHeader}><Text style={styles.modalTitle}>Order Summary</Text></View>
              <CartContent 
                cart={cart} updateCart={updateCart} total={total}
                customerPhone={customerPhone} setCustomerPhone={setCustomerPhone}
                customerName={customerName} setCustomerName={setCustomerName}
                customerEmail={customerEmail} setCustomerEmail={setCustomerEmail}
                hasPhone={hasPhone} loading={loading} handleToyyibPayment={handleToyyibPayment}
                router={router} vendorId={vendorId} table={table}
              />
            </View>
          )}
        </View>

        {!isTablet && cart.length > 0 && (
          <View style={styles.floatingContainer}>
            <TouchableOpacity style={styles.floatingCart} onPress={() => setViewState('CHECKOUT')}>
              <View style={styles.cartInfoRow}>
                <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cart.length}</Text></View>
                <Text style={styles.cartText}>Review Order</Text>
              </View>
              <Text style={styles.cartTextPrice}>RM {total.toFixed(2)}</Text>
            </TouchableOpacity>
          </View>
        )}

        <Modal visible={!isTablet && viewState === 'CHECKOUT'} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.halfModalContainer}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHandle} />
                <View style={styles.modalTopRow}>
                  <Text style={styles.modalTitle}>Your Order</Text>
                  <TouchableOpacity onPress={() => setViewState('MENU')} style={styles.closeBtn}>
                    <Ionicons name="close-circle" size={28} color="#CBD5E1" />
                  </TouchableOpacity>
                </View>
              </View>
              <CartContent 
                cart={cart} updateCart={updateCart} total={total}
                customerPhone={customerPhone} setCustomerPhone={setCustomerPhone}
                customerName={customerName} setCustomerName={setCustomerName}
                customerEmail={customerEmail} setCustomerEmail={setCustomerEmail}
                hasPhone={hasPhone} loading={loading} handleToyyibPayment={handleToyyibPayment}
                router={router} vendorId={vendorId} table={table}
              />
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.95)', zIndex: 2000, justifyContent: 'center', alignItems: 'center' },
  overlayText: { marginTop: 15, fontSize: 16, fontWeight: '700', color: '#6366F1' },
  mainLayout: { flex: 1, flexDirection: 'row' },
  sidebar: { flex: 0.35, backgroundColor: '#FFF', borderLeftWidth: 1, borderLeftColor: '#F1F5F9' },
  sideHeader: { padding: 25, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  header: { paddingHorizontal: 20, paddingTop: 15, paddingBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerSubtitle: { fontSize: 11, color: '#94A3B8', fontWeight: '800', letterSpacing: 1.5 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#0F172A' },
  iconBtn: { width: 45, height: 45, backgroundColor: '#F5F7FF', borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  filterContainer: { marginBottom: 10 },
  filterScroll: { paddingHorizontal: 15, paddingVertical: 5 },
  filterChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, backgroundColor: '#F8FAFC', marginRight: 10, borderWidth: 1, borderColor: '#F1F5F9' },
  filterChipActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  filterText: { color: '#64748B', fontWeight: '700', fontSize: 14 },
  filterTextActive: { color: '#FFF' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginTop: 20, marginBottom: 15 },
  sectionLine: { flex: 1, height: 1, backgroundColor: '#F1F5F9' },
  categoryTitle: { fontSize: 14, fontWeight: '800', color: '#94A3B8', marginHorizontal: 15, textTransform: 'uppercase', letterSpacing: 1 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20 },
  productCard: { backgroundColor: '#FFF', borderRadius: 22, padding: 10, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 5, elevation: 2 },
  pCircle: { height: 70, width: '100%', backgroundColor: '#F8FAFC', borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  pLetter: { fontSize: 28, fontWeight: 'bold', color: '#6366F1', opacity: 0.8 },
  addIconSmall: { position: 'absolute', bottom: -5, right: -5, backgroundColor: '#6366F1', width: 24, height: 24, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  cardInfo: { width: '100%', paddingHorizontal: 4 },
  pName: { fontWeight: '700', fontSize: 14, color: '#1E293B', marginBottom: 4, height: 36 },
  pPrice: { color: '#6366F1', fontWeight: '900', fontSize: 15 },
  list: { paddingBottom: 120 },
  floatingContainer: { position: 'absolute', bottom: 25, left: 0, right: 0, alignItems: 'center' },
  floatingCart: { width: '90%', backgroundColor: '#0F172A', height: 68, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, elevation: 8 },
  cartInfoRow: { flexDirection: 'row', alignItems: 'center' },
  cartBadge: { backgroundColor: '#6366F1', width: 28, height: 28, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cartBadgeText: { color: '#FFF', fontWeight: '900', fontSize: 14 },
  cartText: { color: '#FFF', fontWeight: '700', fontSize: 16, marginLeft: 12 },
  cartTextPrice: { color: '#FFF', fontWeight: '900', fontSize: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
  halfModalContainer: { height: '85%', backgroundColor: '#FFF', borderTopLeftRadius: 40, borderTopRightRadius: 40, overflow: 'hidden' },
  modalHandle: { width: 40, height: 5, backgroundColor: '#E2E8F0', borderRadius: 10, alignSelf: 'center', marginTop: 12 },
  modalHeader: { paddingHorizontal: 25, paddingBottom: 15 },
  modalTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#0F172A' },
  closeBtn: { padding: 4 },
  cartItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  itemName: { fontWeight: '700', fontSize: 17, color: '#1E293B' },
  itemPriceSub: { color: '#6366F1', fontWeight: '800', fontSize: 15, marginTop: 2 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyText: { fontSize: 18, fontWeight: '900', color: '#0F172A', minWidth: 24, textAlign: 'center' },
  calcContainer: { marginTop: 10, gap: 15, paddingBottom: 50 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 10 },
  inputLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 1, marginTop: 5 },
  phoneInput: { backgroundColor: '#F8FAFC', height: 60, borderRadius: 20, paddingHorizontal: 20, fontSize: 18, fontWeight: '700', color: '#0F172A', borderWidth: 1, borderColor: '#E2E8F0' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10 },
  totalLabel: { fontSize: 16, color: '#64748B', fontWeight: '700' },
  totalValue: { fontSize: 32, fontWeight: '900', color: '#0F172A' },
  payBtn: { backgroundColor: '#6366F1', height: 65, borderRadius: 22, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  payBtnText: { color: '#FFF', fontWeight: '800', fontSize: 18 },
  paymentInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 5 },
  paymentInfoText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  statusLink: { padding: 15, alignItems: 'center', marginTop: 10 },
  statusLinkText: { color: '#94A3B8', fontWeight: '700', fontSize: 13 },
  emptyCartBox: { alignItems: 'center', marginTop: 60 },
  emptyCartText: { color: '#94A3B8', fontSize: 16, fontWeight: '600', marginTop: 15 },
  btnDisabled: { opacity: 0.5 },
});