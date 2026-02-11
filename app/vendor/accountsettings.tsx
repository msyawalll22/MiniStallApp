import { Ionicons } from '@expo/vector-icons';
import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  updateEmail,
  updatePassword
} from 'firebase/auth';
import { deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// Use your central config
import { auth, db } from '../../firebaseConfig';

const { width, height } = Dimensions.get('window');
const isTablet = width > 768;

const BackgroundTrail = () => {
  const moveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(moveAnim, {
        toValue: 1,
        duration: 25000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const translateX = moveAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, width - 150, 0]
  });

  const translateY = moveAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, height / 3, 0]
  });

  return (
    <Animated.View style={[styles.bgCircle, { transform: [{ translateX }, { translateY }] }]} />
  );
};

export default function SettingsScreen() {
  const user = auth.currentUser;

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  
  // Updated state names
  const [ownerName, setOwnerName] = useState('');
  const [stallName, setStallName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(''); // Added Phone State
  const [email, setEmail] = useState(user?.email || '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [showReauth, setShowReauth] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthAction, setReauthAction] = useState<'update_email' | 'delete' | null>(null);

  useEffect(() => {
    async function loadProfile() {
      if (!user) return;
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setOwnerName(data.ownerName || ''); // Changed from managerName
          setStallName(data.stallName || '');
          setPhoneNumber(data.phoneNumber || ''); // Fetching Phone Number
        }
      } catch (error) {
        console.error("Profile Load Error:", error);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [user?.uid]);

  const processSensitiveTask = async () => {
    if (!user || !user.email) return;
    setUpdating(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, reauthPassword);
      await reauthenticateWithCredential(user, credential);

      if (reauthAction === 'update_email') {
        await updateEmail(user, email.trim());
        await updateDoc(doc(db, "users", user.uid), {
          ownerName: ownerName.trim(), // Changed from managerName
          stallName: stallName.trim(),
          phoneNumber: phoneNumber.trim(), // Updating Phone
          email: email.trim(),
        });
        Alert.alert("Success", "Account updated!");
      } 
      else if (reauthAction === 'delete') {
        await deleteDoc(doc(db, "users", user.uid));
        await deleteUser(user);
      }

      setShowReauth(false);
      setReauthPassword('');
    } catch (error: any) {
      Alert.alert("Error", "Security check failed. Please check your password.");
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdate = async () => {
    if (!user) return;
    if (!ownerName.trim() || !stallName.trim()) {
      Alert.alert("Error", "Owner and Stall names are required.");
      return;
    }

    if (currentPassword || newPassword || confirmNewPassword) {
      if (!currentPassword || !newPassword || !confirmNewPassword) {
        Alert.alert("Error", "Fill all password fields to change password.");
        return;
      }
      if (newPassword !== confirmNewPassword) {
        Alert.alert("Error", "New passwords do not match.");
        return;
      }
      setUpdating(true);
      try {
        const credential = EmailAuthProvider.credential(user.email!, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
        setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('');
        Alert.alert("Success", "Password updated successfully.");
      } catch (error) {
        Alert.alert("Error", "Current password incorrect.");
        setUpdating(false);
        return;
      }
    }

    if (email.trim() !== user.email) {
      setReauthAction('update_email');
      setShowReauth(true);
      return;
    }

    setUpdating(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        ownerName: ownerName.trim(), // Changed from managerName
        stallName: stallName.trim(),
        phoneNumber: phoneNumber.trim(), // Updating Phone
      });
      Alert.alert("Success", "Profile updated.");
    } catch (error: any) {
      Alert.alert("Error", "Update failed.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#6366F1" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <BackgroundTrail />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Modal visible={showReauth} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Confirm Password</Text>
                <Text style={styles.modalSub}>Enter your current password to continue.</Text>
                <TextInput 
                  style={styles.modalInput} 
                  secureTextEntry 
                  placeholder="Password" 
                  value={reauthPassword}
                  onChangeText={setReauthPassword}
                />
                <View style={styles.modalRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowReauth(false)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmBtn} onPress={processSensitiveTask}>
                    {updating ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.confirmBtnText}>Confirm</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          <View style={styles.responsiveContainer}>
            <div style={styles.headerSection}>
              <View style={styles.avatarCircle}>
                <Ionicons name="person" size={isTablet ? 60 : 40} color="#6366F1" />
              </View>
              <Text style={styles.displayEmail}>{user?.email}</Text>
            </div>

            <View style={styles.form}>
              <Text style={styles.sectionTitle}>Account Details</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Owner Name</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={20} color="#94A3B8" />
                  <TextInput 
                    style={styles.input} 
                    value={ownerName} 
                    onChangeText={setOwnerName} 
                    placeholder="Enter owner name"
                    placeholderTextColor="#CBD5E1" 
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Stall Name</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="storefront-outline" size={20} color="#94A3B8" />
                  <TextInput style={styles.input} value={stallName} onChangeText={setStallName} placeholderTextColor="#CBD5E1" />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Phone Number</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="call-outline" size={20} color="#94A3B8" />
                  <TextInput 
                    style={styles.input} 
                    value={phoneNumber} 
                    onChangeText={setPhoneNumber} 
                    placeholder="Enter phone number"
                    keyboardType="phone-pad"
                    placeholderTextColor="#CBD5E1" 
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color="#94A3B8" />
                  <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
                </View>
              </View>

              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Security</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Current Password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="key-outline" size={20} color="#94A3B8" />
                  <TextInput 
                    style={styles.input} 
                    value={currentPassword} 
                    onChangeText={setCurrentPassword} 
                    secureTextEntry={!showCurrent} 
                    placeholder="Verify for changes" 
                  />
                  <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)}>
                    <Ionicons name={showCurrent ? "eye-off-outline" : "eye-outline"} size={20} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>New Password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" />
                  <TextInput 
                    style={styles.input} 
                    value={newPassword} 
                    onChangeText={setNewPassword} 
                    secureTextEntry={!showNew} 
                    placeholder="Min 6 characters" 
                  />
                  <TouchableOpacity onPress={() => setShowNew(!showNew)}>
                    <Ionicons name={showNew ? "eye-off-outline" : "eye-outline"} size={20} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm New Password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="checkmark-done-outline" size={20} color="#94A3B8" />
                  <TextInput 
                    style={styles.input} 
                    value={confirmNewPassword} 
                    onChangeText={setConfirmNewPassword} 
                    secureTextEntry={!showConfirm} 
                  />
                  <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                    <Ionicons name={showConfirm ? "eye-off-outline" : "eye-outline"} size={20} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={styles.updateBtn} onPress={handleUpdate} disabled={updating} activeOpacity={0.7}>
                {updating ? <ActivityIndicator color="#FFF" /> : <Text style={styles.updateBtnText}>Save All Changes</Text>}
              </TouchableOpacity>
            </View>

            <View style={styles.dangerZone}>
              <Text style={styles.dangerTitle}>Danger Zone</Text>
              <TouchableOpacity style={styles.deleteBtn} activeOpacity={0.6} onPress={() => {
                Alert.alert("Delete Account", "This action is permanent and will delete all stall data.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => { setReauthAction('delete'); setShowReauth(true); }}
                ]);
              }}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
                <Text style={styles.deleteBtnText}>Delete Account Permanently</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  bgCircle: { 
    position: 'absolute', 
    width: 250, 
    height: 250, 
    borderRadius: 125, 
    backgroundColor: '#6366F1', 
    opacity: 0.04 
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, paddingBottom: 60 },
  responsiveContainer: {
    width: '100%',
    maxWidth: isTablet ? 650 : '100%',
    alignSelf: 'center',
  },
  headerSection: { alignItems: 'center', marginVertical: isTablet ? 40 : 30 },
  avatarCircle: { 
    width: isTablet ? 120 : 80, 
    height: isTablet ? 120 : 80, 
    borderRadius: isTablet ? 60 : 40, 
    backgroundColor: '#EEF2FF', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 10 
  },
  displayEmail: { fontSize: 16, color: '#64748B', fontWeight: '500' },
  form: { 
    backgroundColor: '#FFF', 
    borderRadius: 24, 
    padding: isTablet ? 35 : 20, 
    elevation: 3, 
    shadowColor: '#000', 
    shadowOpacity: 0.05,
    shadowRadius: 10
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 20 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 11, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 15 },
  input: { flex: 1, paddingVertical: 14, marginLeft: 10, fontSize: 16, color: '#0F172A' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 30 },
  updateBtn: { backgroundColor: '#6366F1', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  updateBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  dangerZone: { marginTop: 30, padding: 20, backgroundColor: '#FFF', borderRadius: 24, borderWidth: 1, borderColor: '#FEE2E2' },
  dangerTitle: { color: '#991B1B', fontWeight: '800', marginBottom: 15, fontSize: 12, textTransform: 'uppercase' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, borderRadius: 14, backgroundColor: '#FEF2F2' },
  deleteBtnText: { color: '#EF4444', fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.75)', justifyContent: 'center', padding: 25 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 28, padding: 30, maxWidth: 450, alignSelf: 'center', width: '100%' },
  modalTitle: { fontSize: 20, fontWeight: '900', marginBottom: 8, color: '#0F172A' },
  modalSub: { color: '#64748B', marginBottom: 25, fontSize: 14 },
  modalInput: { backgroundColor: '#F8FAFC', padding: 18, borderRadius: 16, marginBottom: 20, fontSize: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  modalRow: { flexDirection: 'row', gap: 15 },
  cancelBtn: { flex: 1, padding: 16, alignItems: 'center' },
  cancelBtnText: { color: '#64748B', fontWeight: '800' },
  confirmBtn: { flex: 1, backgroundColor: '#6366F1', padding: 16, borderRadius: 14, alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontWeight: '800' }
});