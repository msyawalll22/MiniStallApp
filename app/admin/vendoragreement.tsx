import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { auth, db } from '../../firebaseConfig';

interface Vendor {
    id: string;
    ownerName: string; 
    stallName: string;
    contractStatus?: string;
    role: string;
}

export default function VendorAgreement() {
    const [loading, setLoading] = useState<boolean>(true);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [filteredVendors, setFilteredVendors] = useState<Vendor[]>([]);
    const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
    const [activeContract, setActiveContract] = useState<any>(null);
    const [isModalVisible, setModalVisible] = useState<boolean>(false);
    const [search, setSearch] = useState<string>('');
    const [sending, setSending] = useState<boolean>(false);

    const liveSelectedVendor = vendors.find(v => v.id === selectedVendorId) || null;

    useEffect(() => {
        const q = query(collection(db, "users"), where("role", "==", "vendor"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vendor));
            setVendors(list);
            setFilteredVendors(list);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!selectedVendorId) {
            setActiveContract(null);
            return;
        }
        const q = query(
            collection(db, "contracts"), 
            where("vendorId", "==", selectedVendorId),
            orderBy("createdAt", "desc"),
            limit(1)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                setActiveContract({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
            } else {
                setActiveContract(null);
            }
        });
        return () => unsubscribe();
    }, [selectedVendorId]);

    const handleSearch = (text: string) => {
        setSearch(text);
        const filtered = vendors.filter(v =>
            v.ownerName?.toLowerCase().includes(text.toLowerCase()) || 
            v.stallName?.toLowerCase().includes(text.toLowerCase())
        );
        setFilteredVendors(filtered);
    };

    const handleExportPDF = async () => {
        if (!activeContract) return;

        const html = `
            <html>
                <body style="font-family: Helvetica; padding: 50px;">
                    <h1 style="color: #6366F1;">DIGITAL COMPLIANCE AUDIT</h1>
                    <hr/>
                    <p><strong>Stall Name:</strong> ${activeContract.stallName}</p>
                    <p><strong>Owner Name:</strong> ${activeContract.ownerName || activeContract.vendorName}</p>
                    <p><strong>IC Number:</strong> ${activeContract.vendorIc || 'N/A'}</p>
                    <p><strong>Contract ID:</strong> ${activeContract.id}</p>
                    <p><strong>Signed Date:</strong> ${activeContract.signedAt?.toDate().toLocaleString()}</p>
                    <br/>
                    <h3>Legal Terms</h3>
                    <p>${activeContract.terms}</p>
                    <br/><br/>
                    <div style="border-top: 1px solid #000; width: 200px;">
                        <p>Digital Audit Trail Verified</p>
                    </div>
                </body>
            </html>
        `;

        try {
            const { uri } = await Print.printToFileAsync({ html });
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        } catch (error) {
            Alert.alert("Error", "Could not generate PDF");
        }
    };

    const handleSendAgreement = async () => {
        if (!liveSelectedVendor) return;
        setSending(true);
        try {
            await addDoc(collection(db, "contracts"), {
                vendorId: liveSelectedVendor.id,
                ownerName: liveSelectedVendor.ownerName,
                stallName: liveSelectedVendor.stallName,
                adminId: auth.currentUser?.uid,
                status: 'pending',
                createdAt: serverTimestamp(),
                terms: "Standard RM 40/month subscription agreement. Digital Signature via MyKad verification."
            });
            Alert.alert("Success", "Legal document issued.");
        } catch (e) {
            Alert.alert("Error", "Failed to issue document.");
        } finally {
            setSending(false);
        }
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#6366F1" /></View>;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.headerArea}>
                <Text style={styles.label}>LEGAL ENTITY SELECTION</Text>
                <TouchableOpacity style={styles.selector} onPress={() => setModalVisible(true)}>
                    <View style={styles.selectorInfo}>
                        <Ionicons name="business" size={20} color="#6366F1" />
                        <Text style={styles.selectorText}>
                            {liveSelectedVendor ? liveSelectedVendor.stallName : "Select Vendor for Audit..."}
                        </Text>
                    </View>
                    <Ionicons name="chevron-down" size={20} color="#94A3B8" />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.contentArea}>
                {liveSelectedVendor ? (
                    <View style={styles.mainCard}>
                        <View style={styles.statusRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.cardTitle}>{liveSelectedVendor.stallName}</Text>
                                <Text style={styles.cardSubTitle}>Owner: {liveSelectedVendor.ownerName}</Text>
                                <Text style={styles.uidText}>UID: {liveSelectedVendor.id.substring(0, 12)}...</Text>
                            </View>
                            <View style={[styles.badge, { backgroundColor: liveSelectedVendor.contractStatus === 'signed' ? '#DCFCE7' : '#FEF3C7' }]}>
                                <Text style={[styles.badgeText, { color: liveSelectedVendor.contractStatus === 'signed' ? '#166534' : '#92400E' }]}>
                                    {liveSelectedVendor.contractStatus?.toUpperCase() || 'UNLICENSED'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        {activeContract?.status === 'signed' ? (
                            <View style={styles.auditContainer}>
                                <View style={styles.auditHeader}>
                                    <Ionicons name="shield-checkmark" size={24} color="#22C55E" />
                                    <Text style={styles.auditHeaderText}>DIGITAL AUDIT TRAIL</Text>
                                </View>
                                
                                <View style={styles.auditRow}>
                                    <AuditItem label="Signatory Name" value={activeContract.ownerName || activeContract.vendorName} />
                                    <AuditItem label="MyKad / IC" value={activeContract.vendorIc} />
                                </View>
                                
                                <View style={styles.auditRow}>
                                    <AuditItem label="Timestamp" value={activeContract.signedAt?.toDate().toLocaleString()} />
                                    <AuditItem label="Contract ID" value={activeContract.id.toUpperCase()} />
                                </View>

                                <View style={styles.termsBox}>
                                    <Text style={styles.termsLabel}>Accepted Terms:</Text>
                                    <Text style={styles.termsText}>{activeContract.terms}</Text>
                                </View>

                                <TouchableOpacity style={styles.downloadBtn} onPress={handleExportPDF}>
                                    <Ionicons name="cloud-download-outline" size={20} color="#6366F1" />
                                    <Text style={styles.downloadBtnText}>Export Compliance PDF</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.pendingContainer}>
                                <Text style={styles.detailLabel}>LEGAL OWNER</Text>
                                <Text style={styles.detailValue}>{liveSelectedVendor.ownerName}</Text>
                                
                                <View style={styles.infoBox}>
                                    <Ionicons name="information-circle" size={22} color="#6366F1" />
                                    <Text style={styles.infoText}>
                                        No active agreement found. Vendor must sign the terms via their dashboard before they can process sales.
                                    </Text>
                                </View>

                                <TouchableOpacity
                                    style={[styles.primaryBtn, (sending || activeContract) && { opacity: 0.5 }]}
                                    onPress={handleSendAgreement}
                                    disabled={sending || !!activeContract}
                                >
                                    {sending ? <ActivityIndicator color="#FFF" /> : (
                                        <>
                                            <Ionicons name="document-text" size={18} color="#FFF" />
                                            <Text style={styles.primaryBtnText}>
                                                {activeContract ? "Agreement Sent" : "Issue Digital Agreement"}
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <Ionicons name="document-lock-outline" size={80} color="#CBD5E1" />
                        <Text style={styles.emptyText}>Select a vendor to view legal status or issue new contracts.</Text>
                    </View>
                )}
            </ScrollView>

            <Modal visible={isModalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Vendor Directory</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close-circle" size={32} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            placeholder="Search by stall or owner..."
                            placeholderTextColor="#94A3B8"
                            style={styles.searchInput}
                            value={search}
                            onChangeText={handleSearch}
                        />
                        <FlatList
                            data={filteredVendors}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.listItem}
                                    onPress={() => { setSelectedVendorId(item.id); setModalVisible(false); }}
                                >
                                    {/* Company Icon Avatar */}
                                    <View style={styles.listAvatar}>
                                        <Ionicons name="business" size={26} color="#FFFFFF" />
                                    </View>
                                    
                                    <View style={{ flex: 1, justifyContent: 'center' }}>
                                        <Text style={styles.listName}>{item.ownerName || 'Unknown'}</Text>
                                        <Text style={styles.listStall}>{item.stallName || 'No Stall Name'}</Text>
                                    </View>
                                    
                                    <View style={styles.statusIndicator}>
                                        {item.contractStatus === 'signed' ? (
                                            <Ionicons name="checkmark-circle" size={26} color="#22C55E" />
                                        ) : (
                                            <Ionicons name="alert-circle-outline" size={26} color="#CBD5E1" />
                                        )}
                                    </View>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const AuditItem = ({ label, value }: { label: string, value: string }) => (
    <View style={styles.auditItem}>
        <Text style={styles.auditLabel}>{label}</Text>
        <Text style={styles.auditValue} numberOfLines={1}>{value || 'N/A'}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F1F5F9' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerArea: { padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    label: { fontSize: 11, fontWeight: '900', color: '#64748B', letterSpacing: 1.5, marginBottom: 10 },
    selector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
    selectorInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    selectorText: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
    contentArea: { flex: 1, padding: 15 },
    mainCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 15, elevation: 5 },
    statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    cardTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A' },
    cardSubTitle: { fontSize: 14, color: '#6366F1', fontWeight: '700', marginTop: 2 },
    uidText: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
    badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
    badgeText: { fontSize: 11, fontWeight: '900' },
    divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 20 },
    auditContainer: { backgroundColor: '#F8FAFC', borderRadius: 20, padding: 20, borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1' },
    auditHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
    auditHeaderText: { fontSize: 14, fontWeight: '900', color: '#1E293B', letterSpacing: 1 },
    auditRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, gap: 10 },
    auditItem: { flex: 1 },
    auditLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '800', marginBottom: 4 },
    auditValue: { fontSize: 13, fontWeight: '700', color: '#334155' },
    termsBox: { marginTop: 10, padding: 12, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
    termsLabel: { fontSize: 10, fontWeight: '800', color: '#6366F1', marginBottom: 5 },
    termsText: { fontSize: 12, color: '#64748B', lineHeight: 18 },
    downloadBtn: { marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12 },
    downloadBtnText: { color: '#6366F1', fontWeight: '700', fontSize: 14 },
    pendingContainer: { padding: 5 },
    detailLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '800' },
    detailValue: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 20 },
    infoBox: { flexDirection: 'row', backgroundColor: '#EEF2FF', padding: 15, borderRadius: 16, gap: 12, marginBottom: 25 },
    infoText: { flex: 1, fontSize: 13, color: '#4338CA', lineHeight: 20, fontWeight: '500' },
    primaryBtn: { backgroundColor: '#0F172A', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, borderRadius: 18, gap: 12 },
    primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
    emptyState: { flex: 1, marginTop: 100, alignItems: 'center', padding: 40 },
    emptyText: { textAlign: 'center', marginTop: 20, color: '#94A3B8', fontSize: 15, lineHeight: 24 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '85%', padding: 25, paddingTop: 15 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A' },
    searchInput: { backgroundColor: '#F1F5F9', padding: 15, borderRadius: 16, marginBottom: 20, fontSize: 16, color: '#0F172A' },
    listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    listAvatar: { 
        width: 52, 
        height: 52, 
        borderRadius: 14, 
        backgroundColor: '#6366F1', 
        justifyContent: 'center', 
        alignItems: 'center', 
        marginRight: 15,
        // Added shadow for a "brand logo" feel
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4
    },
    listName: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 2 },
    listStall: { fontSize: 13, color: '#64748B', fontWeight: '500' },
    statusIndicator: { marginLeft: 10 }
});