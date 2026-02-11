import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { db } from '../../firebaseConfig';

export default function AnnouncementHistory() {
    const [loading, setLoading] = useState(true);
    const [announcements, setAnnouncements] = useState<any[]>([]);

    useEffect(() => {
        // 1. Setup the 90-day cutoff
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const cutoffTimestamp = Timestamp.fromDate(ninetyDaysAgo);

        // 2. Filter query (Needs an Index!)
        const q = query(
            collection(db, "announcements"), 
            where("createdAt", ">=", cutoffTimestamp),
            orderBy("createdAt", "desc")
        );
        
        const unsubscribe = onSnapshot(q, (snap) => {
            const list = snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setAnnouncements(list);
            setLoading(false);
        }, (err) => {
            console.error("Firestore Permission or Index Error:", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const renderItem = ({ item }: { item: any }) => {
        const getTheme = () => {
            switch (item.type) {
                case 'warning': 
                    return { color: '#B45309', bg: '#FFFBEB', icon: 'alert-circle', label: 'Important' };
                case 'error': 
                    return { color: '#B91C1C', bg: '#FEF2F2', icon: 'nuclear', label: 'Urgent' };
                default: 
                    return { color: '#6366F1', bg: '#EEF2FF', icon: 'megaphone', label: 'Update' };
            }
        };

        const theme = getTheme();
        const date = item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) : 'Recent';

        return (
            <View style={styles.announcementCard}>
                <View style={styles.cardHeader}>
                    <View style={[styles.iconBox, { backgroundColor: theme.bg }]}>
                        <Ionicons name={theme.icon as any} size={20} color={theme.color} />
                    </View>
                    <View style={styles.headerText}>
                        <View style={styles.row}>
                            <Text style={styles.dateText}>{date}</Text>
                            <View style={[styles.typeBadge, { backgroundColor: theme.bg }]}>
                                <Text style={[styles.typeBadgeText, { color: theme.color }]}>{theme.label}</Text>
                            </View>
                        </View>
                        <Text style={styles.titleText}>{item.title || "System Notification"}</Text>
                    </View>
                </View>
                
                <Text style={styles.messageText}>{item.message}</Text>
                
                <View style={styles.footer}>
                    <View style={styles.authorBadge}>
                        <Ionicons name="shield-checkmark" size={12} color="#64748B" style={{ marginRight: 4 }} />
                        <Text style={styles.authorText}>OFFICIAL BROADCAST</Text>
                    </View>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#6366F1" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.headerPane}>
                <Text style={styles.mainTitle}>Notice Board</Text>
                <Text style={styles.subTitle}>Latest updates from the last 90 days</Text>
            </View>

            <FlatList
                data={announcements}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="mail-open-outline" size={60} color="#CBD5E1" />
                        <Text style={styles.emptyText}>No recent messages.</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerPane: { paddingHorizontal: 25, paddingVertical: 20 },
    mainTitle: { fontSize: 28, fontWeight: '900', color: '#0F172A' },
    subTitle: { fontSize: 14, color: '#64748B', marginTop: 4, fontWeight: '500' },
    listContent: { paddingHorizontal: 20, paddingBottom: 40 },
    announcementCard: {
        backgroundColor: '#FFF',
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15
    },
    headerText: { flex: 1 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    dateText: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
    typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    typeBadgeText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
    titleText: { fontSize: 17, fontWeight: '800', color: '#1E293B', marginTop: 2 },
    messageText: { fontSize: 15, color: '#475569', lineHeight: 22 },
    footer: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    authorBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6
    },
    authorText: { fontSize: 10, fontWeight: '800', color: '#64748B' },
    emptyState: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#94A3B8', marginTop: 15, fontWeight: '600', fontSize: 16 }
});