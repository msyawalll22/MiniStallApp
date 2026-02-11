import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function SuccessPage() {
  // Extract vendorId and table so we can pass them back to the menu later
  const { orderId, vendorId, table } = useLocalSearchParams();
  const router = useRouter();

  const handleBackToMenu = () => {
    router.replace({
      pathname: '/customer',
      params: { vendorId, table }
    } as any);
  };

  const handleTrackOrder = () => {
    router.push({
      pathname: '/customer/display',
      params: { orderId, vendorId, table }
    } as any);
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="checkmark-sharp" size={60} color="#10B981" />
        </View>
        
        <Text style={styles.title}>Order Placed!</Text>
        <Text style={styles.subtitle}>
          Your order has been sent to the kitchen. Please proceed to the counter to pay if you chose cash.
        </Text>

        <View style={styles.orderIdBox}>
          <Text style={styles.orderLabel}>ORDER ID</Text>
          <Text style={styles.orderValue}>{orderId}</Text>
          <Text style={[styles.orderLabel, { marginTop: 10 }]}>TABLE</Text>
          <Text style={styles.orderValue}>{table || 'N/A'}</Text>
        </View>

        {/* PRIMARY ACTION: Track Order */}
        <TouchableOpacity 
          style={styles.trackButton} 
          onPress={handleTrackOrder}
        >
          <Ionicons name="time-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
          <Text style={styles.buttonText}>Track Order Status</Text>
        </TouchableOpacity>

        {/* SECONDARY ACTION: Back to Menu */}
        <TouchableOpacity 
          style={styles.button} 
          onPress={handleBackToMenu}
        >
          <Text style={styles.secondaryButtonText}>Back to Menu</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#FFF', padding: 30, borderRadius: 32, alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  iconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '900', color: '#0F172A', marginBottom: 10 },
  subtitle: { textAlign: 'center', color: '#64748B', lineHeight: 22, marginBottom: 30 },
  orderIdBox: { backgroundColor: '#F1F5F9', width: '100%', padding: 15, borderRadius: 16, alignItems: 'center', marginBottom: 30 },
  orderLabel: { fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 1 },
  orderValue: { fontSize: 16, fontWeight: '700', color: '#334155', marginTop: 2 },
  trackButton: { 
    backgroundColor: '#6366F1', 
    width: '100%', 
    padding: 18, 
    borderRadius: 16, 
    alignItems: 'center', 
    flexDirection: 'row', 
    justifyContent: 'center',
    marginBottom: 12 
  },
  button: { 
    backgroundColor: '#FFF', 
    width: '100%', 
    padding: 18, 
    borderRadius: 16, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  buttonText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  secondaryButtonText: { color: '#64748B', fontWeight: '700', fontSize: 16 }
});