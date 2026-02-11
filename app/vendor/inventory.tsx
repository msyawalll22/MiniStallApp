import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from 'firebase/auth';
import {
  addDoc, collection, deleteDoc, doc, getFirestore,
  onSnapshot, query,
  serverTimestamp,
  updateDoc, where
} from "firebase/firestore";
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView, ScrollView,
  SectionList, StyleSheet, Switch, Text, TextInput,
  TouchableOpacity, View, useWindowDimensions
} from 'react-native';

// --- FIREBASE INITIALIZATION ---
const firebaseConfig = {
  apiKey: "AIzaSyBq7znOq22tDQyHvl8WBfLSPthZw3-30oc",
  authDomain: "ministall-app.firebaseapp.com",
  projectId: "ministall-app",
  storageBucket: "ministall-app.appspot.com",
  messagingSenderId: "997346919313",
  appId: "1:997346919313:web:6a9d0c930fd95bb0101030"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

const CATEGORIES = ["Food", "Drink", "Snack", "Dessert", "Others"];

// --- PRODUCT CARD ---
const ProductCard = memo(({ item, onEdit, onToggle }: any) => (
  <Pressable 
    style={[styles.productRow, !item.isAvailable && { opacity: 0.5 }]}
    onPress={() => onEdit(item)}
  >
    <View style={styles.productMain}>
      <View style={[styles.colorIndicator, {backgroundColor: item.category === 'Drink' ? '#0EA5E9' : '#6366F1'}]} />
      <View style={{ flexShrink: 1 }}>
        <Text style={styles.productNameText} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.productPriceText}>RM {(Number(item.price) || 0).toFixed(2)}</Text>
      </View>
    </View>
    <View style={styles.productActions}>
      <Switch 
        trackColor={{ false: "#E2E8F0", true: "#6366F1" }}
        onValueChange={() => onToggle(item.id, item.isAvailable)}
        value={item.isAvailable}
      />
    </View>
  </Pressable>
));

// --- INVENTORY FORM ---
const InventoryForm = ({ editingId, name, setName, price, setPrice, selectedCategory, setSelectedCategory, saveItem, deleteItem, isTablet, resetForm }: any) => (
  <ScrollView 
    bounces={false} 
    keyboardShouldPersistTaps="handled"
    showsVerticalScrollIndicator={false}
    contentContainerStyle={{ flexGrow: 1 }}
  >
    <View style={styles.modalInternal}>
      <View style={styles.modalHeader}>
        {!isTablet && <View style={styles.modalHandle} />}
        <Text style={styles.modalTitle}>{editingId ? 'Edit Product' : 'Add New Product'}</Text>
      </View>

      <Text style={styles.label}>Category</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.catScroll}
        keyboardShouldPersistTaps="always"
      >
        {CATEGORIES.map(cat => (
          <TouchableOpacity 
            key={cat} 
            activeOpacity={0.7}
            onPress={() => setSelectedCategory(cat)}
            style={[styles.catPill, selectedCategory === cat && styles.catPillActive]}
          >
            <Text style={[styles.catPillText, selectedCategory === cat && styles.catPillTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.formField}>
        <Text style={styles.label}>Product Name</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Name" 
          value={name} 
          onChangeText={setName} 
          placeholderTextColor="#94A3B8"
        />
      </View>

      <View style={styles.formField}>
        <Text style={styles.label}>Price (RM)</Text>
        <TextInput 
          style={styles.input} 
          placeholder="0.00" 
          value={price} 
          keyboardType="numeric" 
          onChangeText={setPrice} 
          placeholderTextColor="#94A3B8"
        />
      </View>

      <View style={styles.buttonRow}>
        {editingId && (
          <TouchableOpacity 
            style={[styles.saveBtn, { backgroundColor: '#FEE2E2', marginRight: 10, flex: 1 }]} 
            onPress={() => deleteItem(editingId)}
          >
            <Text style={[styles.saveBtnText, { color: '#EF4444' }]}>Delete</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.saveBtn, { flex: 2 }]} onPress={saveItem}>
          <Text style={styles.saveBtnText}>{editingId ? 'Update' : 'Add Item'}</Text>
        </TouchableOpacity>
      </View>
      
      {!isTablet && (
          <TouchableOpacity style={{ marginTop: 20, alignSelf: 'center', paddingBottom: 10 }} onPress={resetForm}>
              <Text style={{ color: '#64748B', fontWeight: '700' }}>Cancel</Text>
          </TouchableOpacity>
      )}
    </View>
  </ScrollView>
);

export default function InventoryScreen() {
  const [user, setUser] = useState(auth.currentUser);
  const { width } = useWindowDimensions();
  const isTablet = width > 950; 
  
  const [products, setProducts] = useState<any[]>([]);
  const [isModalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Food');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((u) => {
      setUser(u);
    });
    return unsubscribeAuth;
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "products"), where("userId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const items: any[] = [];
      snap.forEach((d) => items.push({ ...d.data(), id: d.id }));
      setProducts(items);
    });
    return unsub;
  }, [user]);

  const sections = useMemo(() => {
    const filtered = products.filter(p => 
      p.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const groups = filtered.reduce((acc: any, item) => {
      const cat = item.category || "Others";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});

    return Object.keys(groups).sort().map(cat => ({
      title: cat,
      data: groups[cat].sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""))
    }));
  }, [products, searchQuery]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setName('');
    setPrice('');
    setSelectedCategory('Food');
    setModalVisible(false);
    Keyboard.dismiss();
  }, []);

  const handleOpenEdit = useCallback((item: any) => {
    setEditingId(item.id);
    setName(item.name);
    setPrice(item.price.toString());
    setSelectedCategory(item.category || 'Others');
    if (!isTablet) setModalVisible(true);
  }, [isTablet]);

  const toggleAvailability = useCallback(async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, "products", id), { isAvailable: !currentStatus });
    } catch (e) {
      console.error(e);
    }
  }, []);

  const saveItem = async () => {
    if (!user) return Alert.alert("Error", "User not authenticated");
    if (!name || !price) return Alert.alert("Required", "Enter name and price");
    
    // Data object used for both new items and updates
    const productData = {
      name,
      price: parseFloat(price),
      category: selectedCategory,
      updatedAt: serverTimestamp(),
      userId: user.uid // Always ensure the current user's ID is attached
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, "products", editingId), productData);
      } else {
        await addDoc(collection(db, "products"), {
          ...productData,
          isAvailable: true,
          createdAt: serverTimestamp()
        });
      }
      resetForm();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const deleteItem = (id: string) => {
    Alert.alert("Delete Item", "Remove this item?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await deleteDoc(doc(db, "products", id));
        resetForm();
      }}
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={isTablet ? styles.tabletContainer : { flex: 1 }}>
        <View style={{ flex: 1 }}>
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput 
                style={styles.searchInput}
                placeholder="Search products..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            stickySectionHeadersEnabled={true}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listPadding}
            renderSectionHeader={({ section: { title } }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{title}</Text>
              </View>
            )}
            renderItem={({ item }) => (
              <ProductCard 
                item={item} 
                onEdit={handleOpenEdit} 
                onToggle={toggleAvailability} 
              />
            )}
          />

          {!isTablet && (
            <TouchableOpacity style={styles.fab} onPress={() => { resetForm(); setModalVisible(true); }}>
              <Text style={styles.fabText}>+ Add Item</Text>
            </TouchableOpacity>
          )}
        </View>

        {isTablet && (
          <View style={styles.sidePanel}>
             <InventoryForm 
             {...{editingId, name, setName, price, setPrice, selectedCategory, setSelectedCategory, saveItem, deleteItem, isTablet, resetForm}} 
            />
          </View>
        )}
      </View>

      {!isTablet && (
        <Modal 
          animationType="slide" 
          transparent={true} 
          visible={isModalVisible} 
          onRequestClose={resetForm}
          statusBarTranslucent={true}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <View style={styles.modalOverlay}>
              <Pressable style={styles.dismissArea} onPress={resetForm} />
              <View style={styles.formContainer}>
                <InventoryForm 
                  {...{editingId, name, setName, price, setPrice, selectedCategory, setSelectedCategory, saveItem, deleteItem, isTablet, resetForm}} 
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  tabletContainer: { flex: 1, flexDirection: 'row' },
  sidePanel: { width: 400, backgroundColor: '#FFF', borderLeftWidth: 1, borderLeftColor: '#E2E8F0', paddingTop: 20 },
  searchContainer: { padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 15, borderRadius: 12, height: 50 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, color: '#0F172A' },
  listPadding: { paddingHorizontal: 16, paddingBottom: 100 },
  sectionHeader: { backgroundColor: '#F8FAFC', paddingVertical: 16, width: '100%' },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#6366F1', letterSpacing: 1.5, textTransform: 'uppercase' },
  productRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFF', borderRadius: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05 },
  productMain: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  colorIndicator: { width: 4, height: 32, borderRadius: 2, marginRight: 12 },
  productNameText: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  productPriceText: { fontSize: 14, color: '#64748B', marginTop: 2 },
  productActions: { flexDirection: 'row', alignItems: 'center' },
  fab: { position: 'absolute', bottom: 30, right: 20, backgroundColor: '#0F172A', paddingHorizontal: 28, paddingVertical: 18, borderRadius: 35, elevation: 8 },
  fabText: { color: '#FFF', fontWeight: '800', fontSize: 16 },

  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end'
  },
  dismissArea: { flex: 1 },
  formContainer: { 
    backgroundColor: '#FFF', 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32,
    maxHeight: '90%',
    width: '100%',
  },
  modalInternal: { 
    padding: 25, 
    paddingBottom: Platform.OS === 'android' ? 30 : 50 
  },
  modalHeader: { alignItems: 'center', marginBottom: 20 },
  modalHandle: { width: 40, height: 5, backgroundColor: '#E2E8F0', borderRadius: 10, marginBottom: 15 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  formField: { marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8 },
  catScroll: { marginBottom: 20 },
  catPill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F1F5F9', marginRight: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  catPillActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  catPillText: { color: '#64748B', fontWeight: '700' },
  catPillTextActive: { color: '#FFF' },
  input: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 14, fontSize: 16, borderWidth: 1, borderColor: '#E2E8F0', color: '#0F172A' },
  buttonRow: { flexDirection: 'row', marginTop: 10 },
  saveBtn: { backgroundColor: '#6366F1', padding: 18, borderRadius: 16, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
});