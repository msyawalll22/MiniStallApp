import { Ionicons } from '@expo/vector-icons';
import { DrawerContentScrollView, DrawerItem, DrawerItemList } from '@react-navigation/drawer';
import { usePathname, useRouter } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import SubscriptionLock from '../../components/subscriptionlock';
import { auth, db } from '../../firebaseConfig';

const { width } = Dimensions.get('window');
const isTablet = width > 768;

function CustomDrawerContent({ 
    vendorData, isDarkMode, setIsDarkMode, theme, 
    isSettingsOpen, setIsSettingsOpen, 
    isLegalOpen, setIsLegalOpen, ...props 
}: any) {
    const router = useRouter();
    const userEmail = auth.currentUser?.email || vendorData?.email || "Account Active";

    const expiryDate = vendorData?.expiryDate?.toDate();
    const now = new Date();
    const diffTime = expiryDate ? expiryDate.getTime() - now.getTime() : 0;
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const isNearExpiry = daysRemaining <= 7 && daysRemaining > 0;
    const isExpired = daysRemaining <= 0;
    const isGracePeriod = daysRemaining <= 0 && daysRemaining >= -3;
    const showUrgentWarning = daysRemaining <= 3;

    const isBlocked = (isExpired && !isGracePeriod) || vendorData?.isFrozen;

    const expiryString = expiryDate 
        ? expiryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) 
        : 'N/A';

    const handleLogout = () => {
        Alert.alert("Sign Out", "Are you sure you want to logout?", [
            { text: "Cancel", style: "cancel" },
            { text: "Logout", style: "destructive", onPress: () => signOut(auth) }
        ]);
    };

    return (
        <View style={{ flex: 1, backgroundColor: theme.card }}>
            <DrawerContentScrollView {...props}>
                <View style={styles.drawerHeader}>
                    <View style={[styles.iconCircle, { backgroundColor: isDarkMode ? '#2D3748' : '#EEF2FF' }]}>
                        <Ionicons name="person-circle" size={isTablet ? 50 : 40} color="#6366F1" />
                    </View> 
                    {/* Updated: managerName changed to ownerName */}
                    <Text style={[styles.ownerNameText, { color: theme.text }]}>
                        {vendorData?.ownerName || "Owner"}
                    </Text>
                    <View style={styles.vendorRow}>
                        <Ionicons name="storefront-outline" size={14} color={theme.subText} />
                        <Text style={[styles.vendorLabelText, { color: theme.subText }]}>{vendorData?.stallName || "Vendor"}</Text>
                    </View>
                    <Text style={[styles.vendorEmail, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>{userEmail}</Text>

                    <View style={[
                        styles.expiryBadge, 
                        { backgroundColor: isGracePeriod || isNearExpiry ? '#FEF2F2' : (isDarkMode ? '#2D3748' : '#F1F5F9') }
                    ]}>
                        <Ionicons 
                            name={isGracePeriod ? "warning-outline" : "time-outline"} 
                            size={12} 
                            color={isGracePeriod || isNearExpiry ? '#EF4444' : theme.subText} 
                        />
                        <Text style={[styles.expiryText, { color: isGracePeriod || isNearExpiry ? '#EF4444' : theme.subText }]}>
                            {isGracePeriod ? 'Grace Period Active' : `Active until: ${expiryString}`}
                        </Text>
                    </View>

                    <View style={[styles.divider, { backgroundColor: theme.border, marginTop: 15 }]} />
                    
                    {showUrgentWarning && (
                        <TouchableOpacity 
                            style={styles.urgentBanner}
                            onPress={() => router.push('/vendor/subscription')}
                        >
                            <View style={styles.urgentIconCircle}>
                                <Ionicons name="alert-circle" size={18} color="#FFF" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.urgentTitle}>Action Required</Text>
                                <Text style={styles.urgentText}>Please renew your subscription soon.</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color="#FCA5A5" />
                        </TouchableOpacity>
                    )}
                </View>
                
                <DrawerItem 
                    label="Notice Board" 
                    onPress={() => router.push('/vendor/announcements')} 
                    icon={({ size, color }) => <Ionicons name="megaphone-outline" size={size} color={color} />}
                    inactiveTintColor={theme.subText}
                    labelStyle={{ fontWeight: '700' }}
                />

                {!isBlocked ? (
                    <>
                        <DrawerItemList {...props} />
                        <View style={styles.accordionContainer}>
                            <TouchableOpacity 
                                style={[styles.accordionHeader, isLegalOpen && { backgroundColor: isDarkMode ? '#2D3748' : '#F0F9FF' }]} 
                                onPress={() => { setIsLegalOpen(!isLegalOpen); setIsSettingsOpen(false); }}
                            >
                                <View style={styles.headerLeft}>
                                    <Ionicons name="card-outline" size={22} color={isLegalOpen ? "#0EA5E9" : theme.subText} />
                                    <Text style={[styles.accordionLabel, { color: isLegalOpen ? '#0EA5E9' : theme.subText }]}>Billing & Legal</Text>
                                </View>
                                <Ionicons name={isLegalOpen ? "chevron-up" : "chevron-down"} size={18} color={theme.subText} />
                            </TouchableOpacity>
                            {isLegalOpen && (
                                <View style={styles.subItemsContainer}>
                                    <DrawerItem 
                                        label={isGracePeriod ? "URGENT: Renew Now" : (isNearExpiry ? "Renew Subscription" : "Subscription Status")} 
                                        onPress={() => router.push('/vendor/subscription')} 
                                        icon={({ size }) => <Ionicons name="flash-outline" size={size} color={isGracePeriod || isNearExpiry ? "#EF4444" : theme.subText} />} 
                                        style={styles.subItem} 
                                        labelStyle={{ color: isGracePeriod || isNearExpiry ? '#EF4444' : theme.subText, fontWeight: '700' }} 
                                    />
                                    <DrawerItem label="Service Agreement" onPress={() => router.push('/vendor/myagreement')} icon={({ size }) => <Ionicons name="document-text-outline" size={size} color={theme.subText} />} style={styles.subItem} labelStyle={{ color: theme.subText, fontWeight: '600' }} />
                                </View>
                            )}
                        </View>

                        <View style={styles.accordionContainer}>
                            <TouchableOpacity 
                                style={[styles.accordionHeader, isSettingsOpen && { backgroundColor: isDarkMode ? '#2D3748' : '#EEF2FF' }]} 
                                onPress={() => { setIsSettingsOpen(!isSettingsOpen); setIsLegalOpen(false); }}
                            >
                                <View style={styles.headerLeft}>
                                    <Ionicons name="settings-outline" size={22} color={isSettingsOpen ? "#6366F1" : theme.subText} />
                                    <Text style={[styles.accordionLabel, { color: isSettingsOpen ? '#6366F1' : theme.subText }]}>Settings</Text>
                                </View>
                                <Ionicons name={isSettingsOpen ? "chevron-up" : "chevron-down"} size={18} color={theme.subText} />
                            </TouchableOpacity>
                            {isSettingsOpen && (
                                <View style={styles.subItemsContainer}>
                                    <View style={styles.toggleRow}>
                                        <View style={styles.toggleLabelGroup}>
                                            <Ionicons name={isDarkMode ? "moon" : "sunny"} size={18} color={theme.subText} />
                                            <Text style={[styles.subItemLabel, { color: theme.subText, marginLeft: 10 }]}>Dark Mode</Text>
                                        </View>
                                        <Switch value={isDarkMode} onValueChange={setIsDarkMode} trackColor={{ false: "#CBD5E1", true: "#6366F1" }} thumbColor="#FFF" />
                                    </View>
                                    <DrawerItem label="Account Profile" onPress={() => router.push('/vendor/accountsettings')} icon={({ size }) => <Ionicons name="person-outline" size={size} color={theme.subText} />} style={styles.subItem} labelStyle={{ color: theme.subText, fontWeight: '600' }} />
                                    <DrawerItem label="Maintenance" onPress={() => router.push('/vendor/accountmaintenance')} icon={({ size }) => <Ionicons name="construct-outline" size={size} color={theme.subText} />} style={styles.subItem} labelStyle={{ color: theme.subText, fontWeight: '600' }} />
                                </View>
                            )}
                        </View>
                    </>
                ) : (
                    <View style={{ marginTop: 10 }}>
                        <DrawerItem 
                            label="Renew Subscription" 
                            onPress={() => router.push('/vendor/subscription')} 
                            icon={({ size }) => <Ionicons name="flash" size={size} color="#6366F1" />} 
                            labelStyle={{ color: '#6366F1', fontWeight: '800' }} 
                        />
                    </View>
                )}
            </DrawerContentScrollView>

            <View style={[styles.logoutSection, { borderTopColor: theme.border }]}>
                <DrawerItem label="Logout" icon={({ size }) => <Ionicons name="log-out-outline" size={size} color="#EF4444" />} labelStyle={{ color: '#EF4444', fontWeight: '700' }} onPress={handleLogout} />
            </View>
        </View>
    );
}

export default function VendorLayout() {
    const [user, setUser] = useState<User | null>(null);
    const [vendorData, setVendorData] = useState<any>(null);
    const [initializing, setInitializing] = useState(true);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isLegalOpen, setIsLegalOpen] = useState(false);
    
    const router = useRouter();
    const pathname = usePathname();
    const isSubscriptionPage = pathname.includes('subscription');
    const isRejectedPage = pathname.includes('rejected');

    const theme = {
        bg: isDarkMode ? '#0F172A' : '#F8FAFC',
        card: isDarkMode ? '#1E293B' : '#FFFFFF',
        text: isDarkMode ? '#F8FAFC' : '#0F172A',
        subText: isDarkMode ? '#94A3B8' : '#64748B',
        border: isDarkMode ? '#334155' : '#F1F5F9',
    };

    useEffect(() => {
        let unsubscribeFirestore: () => void;
        const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
            setUser(u);
            if (u) {
                unsubscribeFirestore = onSnapshot(doc(db, "users", u.uid), (snapshot) => {
                    if (snapshot.exists()) {
                        const data = snapshot.data();
                        setVendorData(data);
                        if (data.status === 'rejected' && !pathname.includes('rejected')) {
                            router.replace('/rejected');
                        } else if (data.status === 'pending' && pathname.includes('rejected')) {
                            router.replace('/');
                        }
                    }
                });
            }
            if (initializing) setInitializing(false);
        });
        return () => { unsubscribeAuth(); if (unsubscribeFirestore) unsubscribeFirestore(); };
    }, [pathname]);

    if (initializing) return <View style={[styles.loadingContainer, { backgroundColor: theme.bg }]}><ActivityIndicator size="large" color="#6366F1" /></View>;

    const expiryDate = vendorData?.expiryDate?.toDate();
    const daysRemaining = expiryDate ? Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const isGracePeriod = daysRemaining <= 0 && daysRemaining >= -3;
    const canUseDrawer = (vendorData?.status === 'active' && !vendorData?.isFrozen) || isGracePeriod || isSubscriptionPage;

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            {!isSubscriptionPage && !isRejectedPage && <SubscriptionLock vendorData={vendorData} theme={theme} />}
            
            <Drawer
                drawerContent={(props) => (
                    <CustomDrawerContent 
                        vendorData={vendorData} isDarkMode={isDarkMode} 
                        setIsDarkMode={setIsDarkMode} isSettingsOpen={isSettingsOpen}
                        setIsSettingsOpen={setIsSettingsOpen} 
                        isLegalOpen={isLegalOpen} setIsLegalOpen={setIsLegalOpen}
                        theme={theme} {...props} 
                    />
                )}
                screenOptions={{
                    headerStyle: { backgroundColor: theme.card },
                    headerShadowVisible: false,
                    headerTintColor: '#6366F1', 
                    drawerActiveTintColor: '#6366F1',
                    drawerActiveBackgroundColor: isDarkMode ? '#2D3748' : '#EEF2FF',
                    drawerInactiveTintColor: theme.subText,
                    drawerStyle: { width: isTablet ? 320 : '80%' },
                    swipeEnabled: canUseDrawer, 
                }}
            >
                <Drawer.Screen name="index" options={{ title: 'POS Terminal', drawerLabel: 'POS Terminal', drawerIcon: ({ color, size }) => <Ionicons name="card-outline" size={size} color={color} /> }} />
                <Drawer.Screen 
                    name="announcements" 
                    options={{ 
                        title: 'Notice Board', 
                        drawerItemStyle: { display: 'none' }
                    }} 
                />
                <Drawer.Screen name="kitchen" options={{ title: 'Kitchen Feed', drawerLabel: 'Kitchen Feed', drawerIcon: ({ color, size }) => <Ionicons name="restaurant-outline" size={size} color={color} /> }} />
                <Drawer.Screen name="inventory" options={{ title: 'Menu Management', drawerLabel: 'Inventory', drawerIcon: ({ color, size }) => <Ionicons name="cube-outline" size={size} color={color} /> }} />
                <Drawer.Screen name="history" options={{ title: 'Sales Report', drawerLabel: 'Analytics', drawerIcon: ({ color, size }) => <Ionicons name="bar-chart-outline" size={size} color={color} /> }} />
                <Drawer.Screen name="qrgenerator" options={{ title: 'Stall QR Code', drawerLabel: 'My QR Code', drawerIcon: ({ color, size }) => <Ionicons name="qr-code-outline" size={size} color={color} /> }} />
                <Drawer.Screen name="display" options={{ title: 'Customer Display', drawerLabel: 'Live Display', drawerIcon: ({ color, size }) => <Ionicons name="desktop-outline" size={size} color={color} /> }} />
                
                <Drawer.Screen name="myagreement" options={{ drawerItemStyle: { display: 'none' }, title: 'Service Agreement' }} />
                <Drawer.Screen name="subscription" options={{ drawerItemStyle: { display: 'none' }, title: 'Subscription' }} />
                <Drawer.Screen name="accountsettings" options={{ drawerItemStyle: { display: 'none' }, title: 'Account' }} />
                <Drawer.Screen name="accountmaintenance" options={{ drawerItemStyle: { display: 'none' }, title: 'Maintenance' }} />
                <Drawer.Screen name="rejected" options={{ drawerItemStyle: { display: 'none' }, headerShown: false, swipeEnabled: false }} />
            </Drawer>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    drawerHeader: { padding: 20, paddingTop: 40 },
    iconCircle: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
    ownerNameText: { fontSize: 20, fontWeight: '900' }, // Changed from managerNameText
    vendorRow: { flexDirection: 'row', alignItems: 'center' },
    vendorLabelText: { fontSize: 12, fontWeight: '700', marginLeft: 4 },
    vendorEmail: { fontSize: 13, marginTop: 2, marginBottom: 8 },
    expiryBadge: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 10, 
        paddingVertical: 5, 
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginTop: 5,
        gap: 6
    },
    expiryText: { fontSize: 11, fontWeight: '500' },
    divider: { height: 1, marginTop: 20, marginBottom: 10 },
    urgentBanner: {
        backgroundColor: '#7F1D1D', 
        borderRadius: 16,
        padding: 12,
        marginTop: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: '#B91C1C'
    },
    urgentIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    urgentTitle: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    urgentText: {
        color: '#FCA5A5',
        fontSize: 11,
        fontWeight: '600',
        lineHeight: 14,
        marginTop: 1
    },
    accordionContainer: { marginTop: 4 },
    accordionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderRadius: 12, marginHorizontal: 10 },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    accordionLabel: { fontWeight: '700', marginLeft: 15 },
    subItemsContainer: { paddingLeft: 10 },
    subItem: { marginVertical: -2 },
    subItemLabel: { fontSize: 14, fontWeight: '600' },
    toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 20, marginVertical: 10, paddingLeft: 18 },
    toggleLabelGroup: { flexDirection: 'row', alignItems: 'center' },
    logoutSection: { borderTopWidth: 1, padding: 10, paddingBottom: 20 }
});