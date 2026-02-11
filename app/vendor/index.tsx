import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import { usePathname, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  addDoc, collection, doc,
  getFirestore,
  increment,
  initializeFirestore,
  limit,
  memoryLocalCache,
  onSnapshot,
  orderBy, query, serverTimestamp, setDoc, Timestamp, where
} from "firebase/firestore";
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard, KeyboardAvoidingView, Linking,
  Modal, Platform,
  SafeAreaView, ScrollView,
  SectionList,
  StatusBar, StyleSheet,
  Text, TextInput, TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';

import SubscriptionLock from '../../components/subscriptionlock';

// --- ANNOUNCEMENT BANNER COMPONENT ---
function AnnouncementBanner() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    // Listens to the global settings document we created
    return onSnapshot(doc(db, "settings", "announcement"), (snap) => {
      if (snap.exists() && snap.data().active) {
        setData(snap.data());
      } else {
        setData(null);
      }
    });
  }, []);

  if (!data) return null;

  const colors = {
    info: { bg: '#EFF6FF', text: '#1E40AF', icon: 'megaphone' as const },
    warning: { bg: '#FFFBEB', text: '#92400E', icon: 'alert-circle' as const },
    error: { bg: '#FEF2F2', text: '#991B1B', icon: 'nuclear' as const },
  };

  const theme = colors[data.type as keyof typeof colors] || colors.info;

  return (
    <View style={[styles.banner, { backgroundColor: theme.bg }]}>
      <Ionicons name={theme.icon} size={20} color={theme.text} />
      <Text style={[styles.bannerText, { color: theme.text }]}>{data.message}</Text>
    </View>
  );
}

// --- TYPES ---
interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  isAvailable?: boolean;
  userId?: string;
}

interface CartItem extends Product {
  qty: number;
}

interface Order {
  items: { name: string; qty: number; price: number }[];
  totalAmount: number;      
  method: 'CASH' | 'QR';
  cashReceived: number;
  changeGiven: number;
  queueNumber: number;
  customerPhone: string;
  status: 'preparing';
  paid: boolean;
  table: string;           
  displayTime: string;
  userId: string;
  stallName: string;       
  timestamp?: Timestamp;
}

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

let db: ReturnType<typeof initializeFirestore>;
try {
  db = initializeFirestore(app, {
    localCache: memoryLocalCache()
  });
} catch (e) {
  db = getFirestore(app);
}

const auth = getAuth(app);
const CATEGORIES = ["All", "Food", "Drink", "Snack", "Dessert"];

// --- PRODUCT CARD ---
const ProductItem = memo(({ item, isTablet, onUpdateCart }: any) => (
  <TouchableOpacity 
    activeOpacity={0.6}
    style={[styles.productCard, { width: isTablet ? '31%' : '48%' }]} 
    onPress={() => onUpdateCart(item, 1)}
  >
    <View style={styles.pCircle}><Text style={styles.pLetter}>{item.name[0]}</Text></View>
    <Text style={styles.pName} numberOfLines={1}>{item.name}</Text>
    <Text style={styles.pPrice}>RM {item.price.toFixed(2)}</Text>
  </TouchableOpacity>
));

// --- CHECKOUT SECTION ---
const CheckoutSection = memo(({ 
  isTablet, cart, updateCart, setViewState, total, hasPhone, 
  customerPhone, setCustomerPhone, cashReceived, setCashReceived, 
  changeAmount, isQrDisabled, isCashDisabled, handleFinalize 
}: any) => (
  <View style={{ flex: 1 }}>
    <View style={styles.modalHeader}>
      <Text style={styles.modalTitle}>Order Summary</Text>
      {!isTablet && (
        <TouchableOpacity onPress={() => { Keyboard.dismiss(); setViewState('MENU'); }}>
          <Ionicons name="close-circle" size={32} color="#CBD5E1" />
        </TouchableOpacity>
      )}
    </View>
    
    <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
    >
        {cart.map((item: any) => (
        <View key={item.id} style={styles.cartItem}>
            <View style={styles.cartItemLeft}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPriceUnit}>RM {item.price.toFixed(2)}</Text>
            </View>
            <View style={styles.qtyControls}>
                <TouchableOpacity onPress={() => updateCart(item, -1)}>
                    <Ionicons name="remove-circle-outline" size={30} color="#6366F1" />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{item.qty}</Text>
                <TouchableOpacity onPress={() => updateCart(item, 1)}>
                    <Ionicons name="add-circle-outline" size={30} color="#6366F1" />
                </TouchableOpacity>
            </View>
        </View>
        ))}
        
        <View style={styles.calcContainer}>
            <Text style={styles.calcLabel}>GRAND TOTAL</Text>
            <Text style={styles.calcTotal}>RM {total.toFixed(2)}</Text>

            <View style={styles.inputWrapper}>
                <Text style={[styles.inputLabel, {color: hasPhone ? '#6366F1' : '#EF4444'}]}>
                    CUSTOMER WHATSAPP *
                </Text>
                <TextInput 
                  style={[styles.phoneInput, !hasPhone && {borderColor: '#EF4444'}]} 
                  placeholder="0123456789" 
                  keyboardType="phone-pad" 
                  value={customerPhone} 
                  onChangeText={setCustomerPhone} 
                  placeholderTextColor="#94A3B8"
                />
            </View>

            <View style={styles.inputWrapper}>
                <Text style={[styles.inputLabel, {marginTop: 15}]}>CASH RECEIVED</Text>
                <TextInput 
                  style={styles.cashInput} 
                  placeholder="0.00" 
                  keyboardType="numeric" 
                  value={cashReceived} 
                  onChangeText={setCashReceived} 
                  placeholderTextColor="#94A3B8"
                />
            </View>
            {parseFloat(cashReceived) >= total && (
                <View style={styles.changeBox}>
                    <Text style={styles.changeLabel}>CHANGE DUE</Text>
                    <Text style={styles.changeValue}>RM {changeAmount.toFixed(2)}</Text>
                </View>
            )}
        </View>
        
        <View style={[styles.btnRow, { marginTop: 20 }]}>
            <TouchableOpacity 
                activeOpacity={0.7}
                style={[styles.qrBtn, isQrDisabled && styles.btnDisabled]} 
                onPress={() => handleFinalize('QR')}
                disabled={isQrDisabled}
            >
                <Ionicons name="qr-code-outline" size={20} color={isQrDisabled ? "#94A3B8" : "#6366F1"} />
                <Text style={[styles.qrBtnText, isQrDisabled && {color: "#94A3B8"}]}>QR Pay</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                activeOpacity={0.7}
                style={[styles.cashBtn, isCashDisabled && styles.btnDisabled]} 
                onPress={() => handleFinalize('CASH')}
                disabled={isCashDisabled}
            >
                <Text style={styles.cashBtnText}>Confirm Cash</Text>
            </TouchableOpacity>
        </View>
    </ScrollView>
  </View>
));

export default function POSSystem() {
  const router = useRouter();
  const pathname = usePathname(); 
  const [user, setUser] = useState(auth.currentUser);
  const { width } = useWindowDimensions();
  const isTablet = width > 768;

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currentQueue, setCurrentQueue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cashReceived, setCashReceived] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [viewState, setViewState] = useState<'MENU' | 'CHECKOUT' | 'RECEIPT'>('MENU');
  const [activeReceipt, setActiveReceipt] = useState<Order | null>(null);
  const [vendorData, setVendorData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const theme = {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    text: '#0F172A',
    subText: '#64748B',
    border: '#F1F5F9',
  };

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        const unsubVendor = onSnapshot(doc(db, "users", u.uid), (snap) => {
          if (snap.exists()) {
            setVendorData(snap.data());
          }
          setLoading(false);
        }, (error) => {
          if (error.code === 'permission-denied' && !auth.currentUser) return;
          console.error("Vendor Snapshot Error:", error);
        });
        return () => unsubVendor();
      } else {
        setLoading(false);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const qProducts = query(collection(db, "products"), where("userId", "==", user.uid));
    const unsubProducts = onSnapshot(qProducts, 
      (snap) => {
        const items = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Product));
        setProducts(items.filter(p => p.isAvailable !== false));
      },
      (error) => {
        if (error.code === 'permission-denied' && !auth.currentUser) return;
        console.error("Products Snapshot Error:", error);
      }
    );

    const qQueue = query(collection(db, "orders"), where("userId", "==", user.uid), orderBy("timestamp", "desc"), limit(1));
    const unsubQueue = onSnapshot(qQueue, 
      (snap) => {
        if (!snap.empty) {
          const lastOrder = snap.docs[0].data();
          setCurrentQueue(lastOrder.queueNumber || 0);
        }
      },
      (error) => {
        if (error.code === 'permission-denied' && !auth.currentUser) return;
        console.error("Queue Snapshot Error:", error);
      }
    );

    return () => { unsubProducts(); unsubQueue(); };
  }, [user]);

  const total = useMemo(() => cart.reduce((s, i) => s + (i.price * i.qty), 0), [cart]);
  const hasPhone = useMemo(() => customerPhone.trim().length >= 10, [customerPhone]);
  const isQrDisabled = useMemo(() => !hasPhone, [hasPhone]);
  const isCashDisabled = useMemo(() => {
    const cash = parseFloat(cashReceived) || 0;
    return !hasPhone || cash < total || !cashReceived;
  }, [hasPhone, cashReceived, total]);

  const changeAmount = useMemo(() => {
    const cash = parseFloat(cashReceived) || 0;
    return cash > total ? cash - total : 0;
  }, [cashReceived, total]);

  const searchedProducts = useMemo(() => {
    return products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [products, searchQuery]);

  const sections = useMemo(() => {
    if (selectedCategory !== 'All') {
      const filtered = searchedProducts.filter(p => p.category === selectedCategory);
      return filtered.length > 0 ? [{ title: selectedCategory, data: [filtered] }] : [];
    }
    return CATEGORIES.filter(c => c !== 'All').map(cat => ({
      title: cat,
      data: [searchedProducts.filter(p => p.category === cat)]
    })).filter(group => group.data[0].length > 0);
  }, [searchedProducts, selectedCategory]);

  const updateCart = useCallback((product: Product, delta: number) => {
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

  const resetOrder = useCallback(() => {
    setCart([]);
    setCashReceived('');
    setCustomerPhone('');
    setActiveReceipt(null);
    setViewState('MENU');
    Keyboard.dismiss();
  }, []);

  const handleFinalize = async (method: 'CASH' | 'QR') => {
    if (!user || !vendorData) return;
    const now = new Date();
    const dateId = now.toISOString().split('T')[0];
    const orderData: Order = {
      items: cart.map(({ name, qty, price }) => ({ name, qty, price })),
      totalAmount: total, 
      method,
      cashReceived: method === 'CASH' ? parseFloat(cashReceived) : total,
      changeGiven: method === 'CASH' ? changeAmount : 0,
      queueNumber: currentQueue + 1,
      customerPhone,
      status: 'preparing',
      paid: true,
      table: "Takeaway",
      displayTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      userId: user.uid,
      stallName: vendorData.stallName || 'stall' 
    };

    try {
      await addDoc(collection(db, "orders"), { ...orderData, timestamp: serverTimestamp() });

      try {
        await setDoc(doc(db, "dailyStats", `${user.uid}_${dateId}`), {
          userId: user.uid, 
          stallName: vendorData.stallName || 'stall',
          date: dateId,
          totalRevenue: increment(total), 
          totalOrders: increment(1),
          qrRevenue: method === 'QR' ? increment(total) : increment(0),
          cashRevenue: method === 'CASH' ? increment(total) : increment(0),
          lastUpdated: serverTimestamp()
        }, { merge: true });
      } catch (statsError) {
        console.warn("Stats update failed, order preserved:", statsError);
      }

      setActiveReceipt(orderData);
      setViewState('RECEIPT');
      Keyboard.dismiss();
    } catch (e) { 
      console.error("Critical order failure:", e);
      Alert.alert("Error", "Order could not be sent. Check your internet connection."); 
    }
  };

  const sendWhatsAppReceipt = async () => {
    if (!activeReceipt || !vendorData) return;
    let message = `*E-RECEIPT - ${vendorData.stallName}*\nQueue No: *#${activeReceipt.queueNumber}*\nTime: ${activeReceipt.displayTime}\n\n*Items:*\n`;
    activeReceipt.items.forEach(item => { message += `- ${item.qty}x ${item.name} (RM ${(item.qty * item.price).toFixed(2)})\n`; });
    message += `\n*TOTAL: RM ${activeReceipt.totalAmount.toFixed(2)}*\n\n_Thank you for your visit!_`;
    let cleanPhone = activeReceipt.customerPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '60' + cleanPhone.substring(1);
    const url = `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
    try {
        await Linking.openURL(url).catch(() => Linking.openURL(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`));
    } catch (err) { Alert.alert("Error", "WhatsApp not found."); }
  };

  const generatePDF = async () => {
    if (!activeReceipt || !vendorData) return;
    const htmlContent = `<html><body style="font-family:monospace; padding:30px;">
      <h1 style="text-align:center;">${(vendorData.stallName || 'stall').toUpperCase()}</h1>
      <h2 style="text-align:center;">QUEUE: #${activeReceipt.queueNumber}</h2>
      <p style="text-align:center;">${activeReceipt.displayTime}</p><hr/>
      ${activeReceipt.items.map(i => `<p>${i.qty}x ${i.name} <span style="float:right;">RM ${(i.qty * i.price).toFixed(2)}</span></p>`).join('')}
      <hr/><h3>TOTAL <span style="float:right;">RM ${activeReceipt.totalAmount.toFixed(2)}</span></h3>
      </body></html>`;
    try {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri);
    } catch (e) { Alert.alert("Error", "PDF failed."); }
  };

  const renderSectionHeader = ({ section: { title } }: any) => (<Text style={styles.categoryTitle}>{title}</Text>);
  const renderSectionContent = ({ item }: { item: Product[] }) => (
    <View style={styles.gridContainer}>
      {item.map((product) => (<ProductItem key={product.id} item={product} isTablet={isTablet} onUpdateCart={updateCart} />))}
    </View>
  );

  if (loading) {
    return <View style={styles.loadingBox}><ActivityIndicator size="large" color="#6366F1" /></View>;
  }

  const isApproved = vendorData?.isApproved === true;
  const hasExpiry = vendorData?.expiryDate != null;
  const isExpired = hasExpiry && vendorData.expiryDate.toDate() < new Date();
  const isOnSubscriptionPage = pathname.includes('subscription');
  const shouldShowLock = (!isApproved || isExpired) && !isOnSubscriptionPage;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {shouldShowLock && (
        <SubscriptionLock 
            vendorData={vendorData} 
            theme={theme} 
            isSubscriptionPage={false} 
        />
      )}

      <View style={isTablet ? styles.tabletLayout : { flex: 1 }}>
        <View style={{ flex: isTablet ? 1.6 : 1 }}>
          <View style={styles.header}>
            {/* Added Announcement Banner Here */}
            <AnnouncementBanner />
            
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color="#94A3B8" />
              <TextInput placeholder="Search menu..." style={styles.searchInput} value={searchQuery} onChangeText={setSearchQuery} placeholderTextColor="#94A3B8"/>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity key={cat} onPress={() => setSelectedCategory(cat)} style={[styles.catBtn, selectedCategory === cat && styles.catBtnActive]}>
                  <Text style={[styles.catText, selectedCategory === cat && styles.catTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <SectionList sections={sections} keyExtractor={(item, index) => index.toString()} renderItem={renderSectionContent} renderSectionHeader={renderSectionHeader} contentContainerStyle={styles.list} stickySectionHeadersEnabled={false} />
          
          {cart.length > 0 && !isTablet && (
            <TouchableOpacity activeOpacity={0.8} style={styles.floatingCart} onPress={() => setViewState('CHECKOUT')}>
              <View style={styles.cartBadge}><Text style={styles.badgeText}>{cart.length}</Text></View>
              <Text style={styles.cartText}>Checkout • RM {total.toFixed(2)}</Text>
            </TouchableOpacity>
          )}
        </View>

        {isTablet && (
          <View style={styles.tabletRightSide}>
            {cart.length > 0 ? (
              <CheckoutSection 
                isTablet={isTablet} cart={cart} updateCart={updateCart} total={total} hasPhone={hasPhone} 
                customerPhone={customerPhone} setCustomerPhone={setCustomerPhone} cashReceived={cashReceived} 
                setCashReceived={setCashReceived} changeAmount={changeAmount} isQrDisabled={isQrDisabled} 
                isCashDisabled={isCashDisabled} handleFinalize={handleFinalize} setViewState={setViewState}
              />
            ) : (
              <View style={styles.tabletEmptyCart}><Ionicons name="cart-outline" size={80} color="#E2E8F0" /><Text style={styles.tabletEmptyCartText}>Cart is empty</Text></View>
            )}
          </View>
        )}
      </View>

      {!isTablet && (
        <Modal visible={viewState === 'CHECKOUT'} animationType="slide" transparent={true} onRequestClose={() => setViewState('MENU')}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
                <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => { Keyboard.dismiss(); setViewState('MENU'); }} />
                <View style={styles.halfModalContainer}>
                  <View style={styles.modalHandle} />
                  <CheckoutSection 
                      isTablet={false} cart={cart} updateCart={updateCart} total={total} hasPhone={hasPhone} 
                      customerPhone={customerPhone} setCustomerPhone={setCustomerPhone} cashReceived={cashReceived} 
                      setCashReceived={setCashReceived} changeAmount={changeAmount} isQrDisabled={isQrDisabled} 
                      isCashDisabled={isCashDisabled} handleFinalize={handleFinalize} setViewState={setViewState} 
                  />
                </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      )}

      <Modal visible={viewState === 'RECEIPT'} animationType="slide" transparent={false}>
          <View style={styles.receiptOverlay}>
              <SafeAreaView style={styles.receiptContent}>
                  <View style={styles.receiptCard}>
                      <View style={styles.successIconBadge}><Ionicons name="checkmark" size={40} color="#FFF" /></View>
                      <Text style={styles.receiptHeaderTitle}>Order Success</Text>
                      <Text style={styles.receiptTime}>{activeReceipt?.displayTime}</Text>
                      <View style={styles.receiptDivider} />
                      <View style={styles.queueContainer}>
                          <Text style={styles.queueLabel}>QUEUE NUMBER</Text>
                          <Text style={styles.queueLargeText}>#{activeReceipt?.queueNumber}</Text>
                      </View>
                      <View style={styles.receiptDivider} />
                      <ScrollView style={{width:'100%', maxHeight: 150}} showsVerticalScrollIndicator={false}>
                          {activeReceipt?.items.map((item, idx) => (
                              <View key={idx} style={styles.receiptItemRow}><Text style={styles.receiptItemName}>{item.qty}x {item.name}</Text><Text style={styles.receiptItemPrice}>{(item.qty * item.price).toFixed(2)}</Text></View>
                          ))}
                      </ScrollView>
                      <View style={styles.receiptTotalContainer}>
                          <View style={styles.receiptTotalRow}><Text style={styles.receiptTotalLabel}>Paid</Text><Text style={styles.receiptTotalValue}>RM {activeReceipt?.totalAmount.toFixed(2)}</Text></View>
                      </View>
                  </View>
                  <View style={styles.receiptActions}>
                    <View style={styles.actionRow}>
                        <TouchableOpacity activeOpacity={0.7} style={styles.pdfButton} onPress={generatePDF}>
                            <Ionicons name="document-text" size={24} color="#6366F1" /><Text style={styles.pdfButtonText}>PDF</Text>
                        </TouchableOpacity>
                        <TouchableOpacity activeOpacity={0.7} style={styles.whatsappButtonSmall} onPress={sendWhatsAppReceipt}>
                            <Ionicons name="logo-whatsapp" size={32} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity activeOpacity={0.8} style={styles.doneButton} onPress={resetOrder}>
                        <Text style={styles.doneButtonText}>New Order</Text>
                    </TouchableOpacity>
                  </View>
              </SafeAreaView>
          </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  tabletLayout: { flex: 1, flexDirection: 'row' },
  tabletRightSide: { width: 380, backgroundColor: '#FFF', borderLeftWidth: 1, borderLeftColor: '#E2E8F0' },
  header: { backgroundColor: '#FFF', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 10, paddingTop: Platform.OS === 'android' ? 40 : 20 },
  
  // Announcement Styles
  banner: { flexDirection: 'row', padding: 12, borderRadius: 12, alignItems: 'center', gap: 10, marginBottom: 10, elevation: 1 },
  bannerText: { fontWeight: '700', fontSize: 13, flex: 1 },

  searchBar: { flexDirection: 'row', backgroundColor: '#F1F5F9', padding: 12, borderRadius: 15, alignItems: 'center' },
  searchInput: { marginLeft: 10, flex: 1, fontSize: 16, color: '#000' },
  categoryScroll: { flexDirection: 'row', marginTop: 10 },
  catBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: '#F1F5F9' },
  catBtnActive: { backgroundColor: '#6366F1' },
  catText: { fontWeight: '600', color: '#64748B' },
  catTextActive: { color: '#FFF' },
  list: { padding: 15, paddingBottom: 100 },
  categoryTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginVertical: 10 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  productCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 20, elevation: 1 },
  pCircle: { height: 50, width: 50, backgroundColor: '#EEF2FF', borderRadius: 25, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 10 },
  pLetter: { fontSize: 20, fontWeight: 'bold', color: '#6366F1' },
  pName: { fontWeight: '700', textAlign: 'center', fontSize: 14, color: '#1E293B' },
  pPrice: { color: '#6366F1', textAlign: 'center', marginTop: 4, fontWeight: '800' },
  floatingCart: { position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: '#0F172A', height: 60, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  cartBadge: { backgroundColor: '#6366F1', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  cartText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  halfModalContainer: { height: '85%', backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden', elevation: 20 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 10, alignSelf: 'center', marginTop: 10, marginBottom: 5 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '900' },
  cartItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 15 },
  cartItemLeft: { flex: 1 },
  itemName: { fontWeight: '700', fontSize: 15 },
  itemPriceUnit: { color: '#64748B', fontSize: 13 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyText: { fontSize: 16, fontWeight: '800', minWidth: 20, textAlign: 'center' },
  calcContainer: { marginTop: 10, alignItems: 'center', backgroundColor: '#F1F5F9', padding: 20, borderRadius: 20 },
  calcLabel: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  calcTotal: { fontSize: 32, fontWeight: '900', color: '#0F172A', marginVertical: 10 },
  inputWrapper: { width: '100%' },
  inputLabel: { fontSize: 11, fontWeight: '800', marginBottom: 5, textAlign: 'center' },
  phoneInput: { backgroundColor: '#FFF', height: 45, borderRadius: 10, textAlign: 'center', fontSize: 16, fontWeight: '700', borderWidth: 1, borderColor: '#E2E8F0', color: '#000' },
  cashInput: { backgroundColor: '#FFF', height: 50, borderRadius: 10, textAlign: 'center', fontSize: 22, fontWeight: '800', borderWidth: 1, borderColor: '#E2E8F0', color: '#000' },
  changeBox: { marginTop: 10, alignItems: 'center' },
  changeLabel: { fontSize: 11, fontWeight: '800', color: '#10B981' },
  changeValue: { fontSize: 24, fontWeight: '900', color: '#10B981' },
  btnRow: { flexDirection: 'row', gap: 10 },
  qrBtn: { flex: 1, backgroundColor: '#EEF2FF', height: 55, borderRadius: 15, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 5 },
  qrBtnText: { color: '#6366F1', fontWeight: '800' },
  cashBtn: { flex: 2, backgroundColor: '#6366F1', height: 55, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  btnDisabled: { backgroundColor: '#CBD5E1' },
  cashBtnText: { color: '#FFF', fontWeight: '800' },
  receiptOverlay: { flex: 1, backgroundColor: '#6366F1', justifyContent: 'center' },
  receiptContent: { padding: 20, alignItems: 'center' },
  receiptCard: { width: '100%', backgroundColor: '#FFF', borderRadius: 25, padding: 20, alignItems: 'center' },
  successIconBadge: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', marginTop: -50, borderWidth: 4, borderColor: '#6366F1' },
  receiptHeaderTitle: { fontSize: 18, fontWeight: '900', marginTop: 10 },
  receiptTime: { fontSize: 12, color: '#64748B' },
  receiptDivider: { height: 1, width: '100%', backgroundColor: '#F1F5F9', marginVertical: 15 },
  queueContainer: { alignItems: 'center' },
  queueLabel: { fontSize: 11, fontWeight: '800', color: '#64748B' },
  queueLargeText: { fontSize: 50, fontWeight: '900', color: '#6366F1' },
  receiptItemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5, width: '100%' },
  receiptItemName: { fontSize: 14 },
  receiptItemPrice: { fontSize: 14, fontWeight: '700' },
  receiptTotalContainer: { width: '100%', backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, marginTop: 10 },
  receiptTotalRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  receiptTotalLabel: { fontSize: 14, fontWeight: '800' },
  receiptTotalValue: { fontSize: 16, fontWeight: '900', color: '#6366F1' },
  receiptActions: { width: '100%', marginTop: 20, gap: 10 },
  actionRow: { flexDirection: 'row', gap: 10 },
  pdfButton: { flex: 1, backgroundColor: '#FFF', height: 55, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  pdfButtonText: { color: '#6366F1', fontWeight: '800' },
  whatsappButtonSmall: { backgroundColor: '#25D366', width: 60, height: 55, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  doneButton: { backgroundColor: '#0F172A', height: 55, borderRadius: 15, justifyContent: 'center', alignItems: 'center', width: '100%' },
  doneButtonText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  tabletEmptyCart: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabletEmptyCartText: { fontSize: 20, fontWeight: '800', color: '#94A3B8' },
});