import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function FailedPage() {
  const { vendorId, table, phone } = useLocalSearchParams();
  const router = useRouter();

  // 1. TRY AGAIN: Just go back. 
  // This keeps the cart items exactly as they were on the previous screen.
  const handleTryAgain = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      // Fallback only if the user refreshed the page and history is lost
      router.replace({
        pathname: '/customer',
        params: { 
          id: vendorId, 
          table: table,
          prevPhone: phone 
        }
      } as any);
    }
  };

  // 2. BACK TO MENU: Explicitly tell the menu to wipe the cart
  const handleBackToMenu = () => {
    router.replace({
      pathname: '/customer',
      params: { 
        id: vendorId, 
        table: table,
        action: 'clear' 
      }
    } as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="close-circle" size={60} color="#EF4444" />
        </View>
        
        <Text style={styles.title}>Payment Cancelled</Text>
        <Text style={styles.subtitle}>
          Your items are still in the cart. You can try to pay again or go back to start over.
        </Text>

        <TouchableOpacity style={styles.retryButton} onPress={handleTryAgain}>
          <Ionicons name="card" size={20} color="#FFF" style={{ marginRight: 8 }} />
          <Text style={styles.buttonText}>Try Payment Again</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backButton} onPress={handleBackToMenu}>
          <Text style={styles.secondaryButtonText}>Wipe Cart & Start Over</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#FFF', padding: 30, borderRadius: 32, alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  iconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '900', color: '#0F172A', marginBottom: 10 },
  subtitle: { textAlign: 'center', color: '#64748B', lineHeight: 22, marginBottom: 20 },
  retryButton: { 
    backgroundColor: '#6366F1', 
    width: '100%', 
    padding: 18, 
    borderRadius: 16, 
    alignItems: 'center', 
    flexDirection: 'row', 
    justifyContent: 'center',
    marginBottom: 12 
  },
  backButton: { 
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