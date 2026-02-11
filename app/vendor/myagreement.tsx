import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { auth, db } from '../../firebaseConfig';

export default function MyAgreement() {
    const [loading, setLoading] = useState(true);
    const [contract, setContract] = useState<any>(null);
    const [icNumber, setIcNumber] = useState('');
    const [hasAgreed, setHasAgreed] = useState(false);
    const [isSigning, setIsSigning] = useState(false);

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        const q = query(
            collection(db, "contracts"),
            where("vendorId", "==", user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                const latest = docs.sort((a: any, b: any) => {
                    const timeA = a.createdAt?.seconds || 0;
                    const timeB = b.createdAt?.seconds || 0;
                    return timeB - timeA;
                })[0];
                setContract(latest);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const generatePDF = async () => {
        const signedDate = contract.signedAt?.toDate().toLocaleString() || new Date().toLocaleString();
        
        const htmlContent = `
            <html>
                <body style="font-family: Helvetica; padding: 40px; color: #333;">
                    <h1 style="text-align: center; color: #6366F1;">SERVICE AGREEMENT</h1>
                    <p style="text-align: center; font-size: 12px; color: #666;">Ref ID: ${contract.id?.toUpperCase()}</p>
                    <hr />
                    <div style="margin-top: 20px;">
                        <h3>1. Parties</h3>
                        <p><strong>Platform:</strong> Admin System</p>
                        <p><strong>Stall Name:</strong> ${contract.stallName}</p>
                        <p><strong>Owner Name:</strong> ${contract.ownerName}</p>
                    </div>
                    <div style="margin-top: 20px;">
                        <h3>2. Terms & Conditions</h3>
                        <ul>
                            <li>Subscription Fee: RM 40.00 / month</li>
                            <li>Service: Cloud POS & Inventory Management</li>
                            <li>Data Ownership: Vendor owns all sales records</li>
                        </ul>
                    </div>
                    <div style="margin-top: 40px; padding: 20px; border: 1px solid #6366F1; border-radius: 10px; background-color: #f9f9ff;">
                        <h3>Digital Signature Certificate</h3>
                        <p><strong>Signatory:</strong> ${contract.ownerName}</p>
                        <p><strong>IC Number:</strong> ${contract.vendorIc || icNumber}</p>
                        <p><strong>Timestamp:</strong> ${signedDate}</p>
                        <p style="color: #22C55E; font-weight: bold;">Verified Digital Signature</p>
                    </div>
                    <p style="margin-top: 50px; font-size: 10px; text-align: center; color: #999;">
                        This is a computer-generated document. No physical signature is required.
                    </p>
                </body>
            </html>
        `;

        try {
            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        } catch (error) {
            Alert.alert("Error", "Failed to generate PDF");
        }
    };

    const handleSignContract = async () => {
        if (icNumber.length < 12) {
            Alert.alert("Invalid IC", "Please enter a valid 12-digit MyKad number.");
            return;
        }
        if (!hasAgreed) {
            Alert.alert("Consent Required", "You must agree to the terms and conditions.");
            return;
        }

        setIsSigning(true);
        try {
            const contractRef = doc(db, "contracts", contract.id);
            const userRef = doc(db, "users", auth.currentUser!.uid);

            await updateDoc(contractRef, {
                status: 'signed',
                vendorIc: icNumber,
                signedAt: serverTimestamp(),
            });

            await updateDoc(userRef, {
                contractStatus: 'signed'
            });

            Alert.alert("Success", "Agreement signed successfully.");
        } catch (error) {
            Alert.alert("Error", "Could not complete signing.");
        } finally {
            setIsSigning(false);
        }
    };

    if (loading) return <View style={styles.center}><ActivityIndicator color="#6366F1" /></View>;

    if (!contract) return (
        <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={80} color="#CBD5E1" />
            <Text style={styles.emptyText}>No pending agreements at this time.</Text>
        </View>
    );

    const isAlreadySigned = contract.status === 'signed';

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={{ flex: 1 }}
        >
            <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
                <View style={[styles.statusBanner, { backgroundColor: isAlreadySigned ? '#DCFCE7' : '#FEE2E2' }]}>
                    <Ionicons 
                        name={isAlreadySigned ? "checkmark-circle" : "alert-circle"} 
                        size={20} 
                        color={isAlreadySigned ? "#166534" : "#991B1B"} 
                    />
                    <Text style={[styles.statusText, { color: isAlreadySigned ? "#166534" : "#991B1B" }]}>
                        {isAlreadySigned ? "Agreement Signed & Active" : "Action Required: Signature Pending"}
                    </Text>
                </View>

                <View style={styles.card}>
                    <View style={styles.headerRow}>
                        <View style={{flex: 1}}>
                            <Text style={styles.title}>Vendor Service Agreement</Text>
                            <Text style={styles.date}>Issued on: {contract.createdAt?.toDate().toLocaleDateString('en-GB')}</Text>
                        </View>
                        {isAlreadySigned && (
                            <TouchableOpacity onPress={generatePDF} style={styles.pdfButton}>
                                <Ionicons name="download-outline" size={20} color="#6366F1" />
                                <Text style={styles.pdfButtonText}>PDF</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    
                    <Text style={styles.contractIdText}>ID: {contract.id?.toUpperCase()}</Text>
                    
                    <View style={styles.divider} />

                    <Text style={styles.sectionTitle}>1. TERMS & CONDITIONS</Text>
                    <Text style={styles.termsContent}>
                        This agreement is between the Platform Administrator and {contract.stallName} (Owned by {contract.ownerName}). 
                        {"\n\n"}
                        • Subscription Fee: RM 40.00 / month.{"\n"}
                        • Service: Cloud-based POS & Inventory Management.{"\n"}
                        • Termination: 30 days notice required.{"\n"}
                        • Data: Vendor owns all sales data.
                    </Text>

                    {isAlreadySigned ? (
                        <View style={styles.signedBox}>
                            <Text style={styles.signedLabel}>Digitally Signed By:</Text>
                            <Text style={styles.signedValue}>{contract.ownerName}</Text>
                            
                            <Text style={styles.signedLabel}>IC Number:</Text>
                            <Text style={styles.signedValue}>{contract.vendorIc}</Text>
                            
                            <Text style={styles.signedLabel}>Reference ID:</Text>
                            <Text style={styles.signedValue}>{contract.id}</Text>
                            
                            <Text style={styles.signedDate}>Date: {contract.signedAt?.toDate().toLocaleString()}</Text>
                        </View>
                    ) : (
                        <View style={styles.signArea}>
                            <Text style={styles.inputLabel}>Enter MyKad / IC Number</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. 900101105522"
                                keyboardType="number-pad"
                                maxLength={12}
                                value={icNumber}
                                onChangeText={setIcNumber}
                            />

                            <TouchableOpacity 
                                style={styles.checkboxRow} 
                                onPress={() => setHasAgreed(!hasAgreed)}
                            >
                                <Ionicons 
                                    name={hasAgreed ? "checkbox" : "square-outline"} 
                                    size={24} 
                                    color={hasAgreed ? "#6366F1" : "#94A3B8"} 
                                />
                                <Text style={styles.checkboxText}>
                                    I confirm that I, {contract.ownerName}, have read and agree to the terms listed above.
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={[styles.signBtn, isSigning && { opacity: 0.7 }]}
                                onPress={handleSignContract}
                                disabled={isSigning}
                            >
                                {isSigning ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <>
                                        <Ionicons name="create-outline" size={20} color="#FFF" />
                                        <Text style={styles.signBtnText}>Sign Agreement Digitally</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    statusBanner: { flexDirection: 'row', alignItems: 'center', padding: 15, gap: 10 },
    statusText: { fontSize: 13, fontWeight: '800' },
    card: { backgroundColor: '#FFF', margin: 20, borderRadius: 24, padding: 25, elevation: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    pdfButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 4 },
    pdfButtonText: { color: '#6366F1', fontWeight: '800', fontSize: 12 },
    title: { fontSize: 20, fontWeight: '900', color: '#1E293B' },
    date: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
    contractIdText: { fontSize: 10, color: '#94A3B8', fontWeight: '700', marginTop: 2, letterSpacing: 0.5 },
    divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 20 },
    sectionTitle: { fontSize: 14, fontWeight: '800', color: '#6366F1', marginBottom: 10 },
    termsContent: { fontSize: 14, color: '#475569', lineHeight: 22 },
    signArea: { marginTop: 30 },
    inputLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 8 },
    input: { backgroundColor: '#F8FAFC', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 16, fontWeight: '600' },
    checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
    checkboxText: { flex: 1, fontSize: 13, color: '#64748B', lineHeight: 18 },
    signBtn: { backgroundColor: '#0F172A', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, borderRadius: 16, gap: 10, marginTop: 30 },
    signBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
    signedBox: { marginTop: 30, backgroundColor: '#F8FAFC', padding: 20, borderRadius: 15, borderLeftWidth: 4, borderLeftColor: '#22C55E' },
    signedLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '700' },
    signedValue: { fontSize: 15, fontWeight: '800', color: '#1E293B', marginBottom: 10 },
    signedDate: { fontSize: 11, color: '#64748B', fontStyle: 'italic' },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyText: { textAlign: 'center', marginTop: 20, color: '#94A3B8', fontSize: 16 }
});