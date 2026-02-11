import { Ionicons } from '@expo/vector-icons';
import { DrawerContentScrollView, DrawerItem, DrawerItemList } from '@react-navigation/drawer';
import { useRouter } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { auth } from '../../firebaseConfig';

const { width } = Dimensions.get('window');
const isTablet = width > 768;

function CustomAdminDrawer(props: any) {
  const router = useRouter();
  const [isSystemOpen, setIsSystemOpen] = useState(false);
  const adminEmail = auth.currentUser?.email || "admin@system.com";

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to logout from Admin Panel?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Logout", 
        style: "destructive", 
        onPress: async () => {
          await signOut(auth);
          router.replace('/login');
        } 
      }
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <DrawerContentScrollView {...props}>
        <View style={styles.drawerHeader}>
          <View style={styles.adminIconCircle}>
            <Ionicons name="shield-checkmark" size={35} color="#FFF" />
          </View>
          <Text style={styles.adminTitle}>Super Admin</Text>
          <Text style={styles.adminEmail}>{adminEmail}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>CONTROL CENTER</Text>
          </View>
        </View>

        <View style={styles.divider} />
        
        {/* Main Navigation Items (Approvals, Revenue, etc.) */}
        <DrawerItemList {...props} />

        {/* --- SYSTEM TOOLS DROPDOWN --- */}
        <TouchableOpacity 
          style={styles.dropdownHeader} 
          onPress={() => setIsSystemOpen(!isSystemOpen)}
          activeOpacity={0.7}
        >
          <View style={styles.dropdownLabelRow}>
            <Ionicons name="settings-outline" size={22} color="#64748B" />
            <Text style={styles.dropdownLabel}>System Management</Text>
          </View>
          <Ionicons 
            name={isSystemOpen ? "chevron-up" : "chevron-down"} 
            size={18} 
            color="#64748B" 
          />
        </TouchableOpacity>

        {isSystemOpen && (
          <View style={styles.dropdownContent}>
            <DrawerItem
              label="Announcements"
              icon={({ size }) => <Ionicons name="megaphone-outline" size={size} color="#64748B" />}
              labelStyle={styles.subItemLabel}
              onPress={() => router.push('/admin/announcements')}
            />
            <DrawerItem
              label="Maintenance"
              icon={({ size }) => <Ionicons name="construct-outline" size={size} color="#64748B" />}
              labelStyle={styles.subItemLabel}
              onPress={() => router.push('/admin/maintenance')}
            />
            <DrawerItem
              label="Admin Security"
              icon={({ size }) => <Ionicons name="key-outline" size={size} color="#64748B" />}
              labelStyle={styles.subItemLabel}
              onPress={() => router.push('/admin/settings')}
            />
          </View>
        )}
      </DrawerContentScrollView>

      <View style={styles.logoutSection}>
        <DrawerItem 
          label="Logout" 
          icon={({ size }) => <Ionicons name="log-out-outline" size={size} color="#EF4444" />} 
          labelStyle={{ color: '#EF4444', fontWeight: '700' }} 
          onPress={handleLogout} 
        />
      </View>
    </View>
  );
}

export default function AdminLayout() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace('/login');
      } else {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        drawerContent={(props) => <CustomAdminDrawer {...props} />}
        screenOptions={{
          headerStyle: { backgroundColor: '#F8FAFC' },
          headerShadowVisible: false,
          headerTintColor: '#0F172A',
          headerTitleStyle: { fontWeight: '800' },
          drawerActiveTintColor: '#6366F1',
          drawerActiveBackgroundColor: '#EEF2FF',
          drawerInactiveTintColor: '#64748B',
          drawerLabelStyle: { fontWeight: '700', marginLeft: -10 },
          drawerStyle: { width: isTablet ? 320 : '80%' },
        }}
      >
        <Drawer.Screen 
          name="index" 
          options={{ 
            title: 'Approval Queue', 
            drawerLabel: 'Vendor Approvals',
            drawerIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} /> 
          }} 
        />
        
        <Drawer.Screen 
          name="revenue" 
          options={{ 
            title: 'Platform Revenue', 
            drawerLabel: 'Revenue Analytics',
            drawerIcon: ({ color, size }) => <Ionicons name="bar-chart-outline" size={size} color={color} /> 
          }} 
        />

        <Drawer.Screen 
          name="vendoragreement" 
          options={{ 
            title: 'Vendor Agreement', 
            drawerLabel: 'Vendor Agreement',
            drawerIcon: ({ color, size }) => <Ionicons name="document-text-outline" size={size} color={color} /> 
          }} 
        />

        <Drawer.Screen 
          name="contracts" 
          options={{ 
            title: 'Stall Management', 
            drawerLabel: 'Stall Manager',
            drawerIcon: ({ color, size }) => <Ionicons name="business-outline" size={size} color={color} /> 
          }} 
        />

        {/* Hidden from main list (Handled by Dropdown) */}
        <Drawer.Screen name="announcements" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="maintenance" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="settings" options={{ drawerItemStyle: { display: 'none' } }} />
      </Drawer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  drawerHeader: { padding: 20, paddingTop: 30, backgroundColor: '#FFF', alignItems: 'flex-start' },
  adminIconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  adminTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  adminEmail: { fontSize: 13, color: '#64748B', marginTop: 2 },
  badge: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  badgeText: { color: '#475569', fontSize: 10, fontWeight: '800' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 20, marginVertical: 10 },
  logoutSection: { borderTopWidth: 1, borderTopColor: '#F1F5F9', padding: 10, paddingBottom: 30 },
  
  // Dropdown Styles
  dropdownHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, paddingHorizontal: 20, marginTop: 5 },
  dropdownLabelRow: { flexDirection: 'row', alignItems: 'center' },
  dropdownLabel: { fontSize: 14, fontWeight: '700', color: '#64748B', marginLeft: 20 },
  dropdownContent: { backgroundColor: '#F8FAFC', paddingBottom: 10 },
  subItemLabel: { fontSize: 13, fontWeight: '600', color: '#64748B', marginLeft: -10 }
});