import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'; // Added collection and addDoc
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView, Platform,
  SafeAreaView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native';
import { db } from '../../firebaseConfig';

export default function AdminAnnouncement() {
    const [message, setMessage] = useState('');
    const [type, setType] = useState<'info' | 'warning' | 'error'>('info');
    const [loading, setLoading] = useState(false);
    const [isLive, setIsLive] = useState(false);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, "settings", "announcement"), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setIsLive(data.active);
                if (data.active) {
                    setMessage(data.message);
                    setType(data.type);
                }
            }
        });
        return unsub;
    }, []);

    const handlePublish = async (activate: boolean) => {
        if (activate && !message.trim()) {
            Alert.alert("Error", "Please enter a message first.");
            return;
        }

        setLoading(true);
        try {
            // 1. Update the LIVE banner status (Current single doc)
            await setDoc(doc(db, "settings", "announcement"), {
                message: activate ? message : "",
                type: type,
                active: activate,
                updatedAt: serverTimestamp(),
            });

            // 2. STORE IN DATABASE (Historical Collection)
            // We only add to history when 'activating' a new post
            if (activate) {
                await addDoc(collection(db, "announcements"), {
                    message: message,
                    type: type,
                    createdAt: serverTimestamp(),
                    status: 'published'
                });
            }

            Alert.alert(
                "Success", 
                activate ? "Announcement is LIVE and saved to History" : "Live banner cleared"
            );
            
            if (!activate) setMessage('');
        } catch (error: any) {
            Alert.alert("Database Error", error.message);
        } finally {
            setLoading(false);
        }
    };

    const getTheme = () => {
        switch (type) {
            case 'warning': return { bg: '#FFFBEB', border: '#FCD34D', text: '#92400E', icon: 'alert-circle' };
            case 'error': return { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', icon: 'nuclear' };
            default: return { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF', icon: 'megaphone' };
        }
    };

    const theme = getTheme();

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <View style={styles.content}>
                    <Text style={styles.header}>Global Broadcast</Text>
                    <Text style={styles.subHeader}>The message will appear as a live banner and be stored in the Notice Board.</Text>

                    <Text style={styles.sectionLabel}>LIVE PREVIEW</Text>
                    <View style={[styles.previewBanner, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                        <Ionicons name={theme.icon as any} size={20} color={theme.text} />
                        <Text style={[styles.previewText, { color: theme.text }]}>
                            {message || "Type a message below to see preview..."}
                        </Text>
                    </View>

                    <TextInput
                        style={styles.input}
                        placeholder="e.g. System maintenance at 12:00 PM..."
                        multiline
                        value={message}
                        onChangeText={setMessage}
                    />

                    <View style={styles.typeRow}>
                        {(['info', 'warning', 'error'] as const).map((t) => (
                            <TouchableOpacity 
                                key={t}
                                onPress={() => setType(t)}
                                style={[styles.typeBtn, type === t && styles.activeTypeBtn, type === t && { borderColor: '#6366F1' }]}
                            >
                                <Text style={[styles.typeBtnText, type === t && { color: '#6366F1' }]}>{t.toUpperCase()}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.actionArea}>
                        <TouchableOpacity 
                            style={[styles.mainBtn, { backgroundColor: '#6366F1' }]} 
                            onPress={() => handlePublish(true)}
                            disabled={loading}
                        >
                            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>Broadcast & Save</Text>}
                        </TouchableOpacity>

                        {isLive && (
                            <TouchableOpacity style={styles.clearBtn} onPress={() => handlePublish(false)}>
                                <Text style={styles.clearBtnText}>Remove Live Banner</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    content: { padding: 20 },
    header: { fontSize: 24, fontWeight: '900', color: '#0F172A' },
    subHeader: { color: '#64748B', marginBottom: 25 },
    sectionLabel: { fontSize: 12, fontWeight: '800', color: '#94A3B8', marginBottom: 10, letterSpacing: 1 },
    previewBanner: { flexDirection: 'row', padding: 15, borderRadius: 12, borderWidth: 1, alignItems: 'center', gap: 12, marginBottom: 25 },
    previewText: { fontWeight: '600', flex: 1 },
    input: { backgroundColor: '#FFF', borderRadius: 12, padding: 15, height: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: '#E2E8F0', fontSize: 16 },
    typeRow: { flexDirection: 'row', gap: 10, marginTop: 15, marginBottom: 30 },
    typeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' },
    activeTypeBtn: { backgroundColor: '#EEF2FF', borderWidth: 2 },
    typeBtnText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
    actionArea: { gap: 12 },
    mainBtn: { height: 55, borderRadius: 15, justifyContent: 'center', alignItems: 'center', elevation: 2 },
    btnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
    clearBtn: { height: 50, justifyContent: 'center', alignItems: 'center' },
    clearBtnText: { color: '#EF4444', fontWeight: '700' }
});