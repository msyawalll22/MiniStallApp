import { Ionicons } from '@expo/vector-icons';
import {
    EmailAuthProvider,
    getAuth,
    reauthenticateWithCredential,
    updateEmail,
    updatePassword
} from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import React, { useState } from 'react';
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

export default function AdminSettings() {
  const auth = getAuth();
  const user = auth.currentUser;

  const [email, setEmail] = useState(user?.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState(''); // Needed for re-auth
  const [loading, setLoading] = useState(false);
  const [showReAuth, setShowReAuth] = useState(false);

  const handleUpdateProfile = async () => {
    if (!email) return Alert.alert("Error", "Email cannot be empty");
    
    setLoading(true);
    try {
      // 1. Update Email in Auth
      if (email !== user?.email) {
        await updateEmail(user!, email);
        // 2. Update Email in Firestore user doc
        await updateDoc(doc(db, "users", user!.uid), { email: email });
      }

      // 3. Update Password if provided
      if (newPassword.length > 0) {
        if (newPassword.length < 6) {
          throw new Error("Password must be at least 6 characters");
        }
        await updatePassword(user!, newPassword);
      }

      Alert.alert("Success", "Account updated successfully!");
      setNewPassword('');
      setCurrentPassword('');
      setShowReAuth(false);
    } catch (error: any) {
      // If Firebase requires a fresh login
      if (error.code === 'auth/requires-recent-login') {
        setShowReAuth(true);
        Alert.alert("Verification Needed", "Please enter your CURRENT password to authorize these changes.");
      } else {
        Alert.alert("Update Failed", error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReAuthAndRetry = async () => {
    if (!currentPassword) return Alert.alert("Error", "Current password required");
    
    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user!.email!, currentPassword);
      await reauthenticateWithCredential(user!, credential);
      // After re-auth, try the update again
      await handleUpdateProfile();
    } catch (error: any) {
      Alert.alert("Verification Failed", "Incorrect current password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.content}>
          <Text style={styles.header}>Account Security</Text>
          <Text style={styles.subHeader}>Update your admin credentials below.</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Admin Email</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color="#64748B" />
              <TextInput 
                style={styles.input} 
                value={email} 
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>New Password (Leave blank to keep current)</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#64748B" />
              <TextInput 
                style={styles.input} 
                placeholder="Minimum 6 characters" 
                secureTextEntry 
                value={newPassword} 
                onChangeText={setNewPassword}
              />
            </View>
          </View>

          {showReAuth && (
            <View style={styles.reAuthBox}>
              <Text style={styles.reAuthTitle}>Confirm Current Password</Text>
              <TextInput 
                style={[styles.input, styles.reAuthInput]} 
                placeholder="Enter current password" 
                secureTextEntry 
                value={currentPassword} 
                onChangeText={setCurrentPassword}
              />
              <TouchableOpacity 
                style={styles.verifyBtn} 
                onPress={handleReAuthAndRetry}
                disabled={loading}
              >
                <Text style={styles.verifyBtnText}>Verify & Save Changes</Text>
              </TouchableOpacity>
            </View>
          )}

          {!showReAuth && (
            <TouchableOpacity 
              style={[styles.saveBtn, loading && { opacity: 0.7 }]} 
              onPress={handleUpdateProfile}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 25 },
  header: { fontSize: 24, fontWeight: '900', color: '#0F172A' },
  subHeader: { color: '#64748B', marginBottom: 30 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8 },
  inputWrapper: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFF', 
    borderWidth: 1, 
    borderColor: '#E2E8F0', 
    borderRadius: 12, 
    paddingHorizontal: 15 
  },
  input: { flex: 1, height: 50, marginLeft: 10, fontSize: 16, color: '#0F172A' },
  saveBtn: { 
    backgroundColor: '#6366F1', 
    height: 55, 
    borderRadius: 15, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginTop: 20,
    elevation: 2 
  },
  saveBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  reAuthBox: { 
    marginTop: 10, 
    padding: 20, 
    backgroundColor: '#FEF2F2', 
    borderRadius: 15, 
    borderWidth: 1, 
    borderColor: '#FECACA' 
  },
  reAuthTitle: { fontWeight: '800', color: '#991B1B', marginBottom: 10 },
  reAuthInput: { backgroundColor: '#FFF', borderRadius: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: '#FECACA' },
  verifyBtn: { backgroundColor: '#EF4444', height: 45, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 15 },
  verifyBtnText: { color: '#FFF', fontWeight: '700' }
});