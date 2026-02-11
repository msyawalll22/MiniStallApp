import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../firebaseConfig';

export default function QRGenerator() {
  const vendorId = auth.currentUser?.uid;
  const [tableNumber, setTableNumber] = useState('1');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // FIXED: Explicit typing for the ref to remove the "red line" TypeScript error
  const qrRef = useRef<{ toDataURL: (callback: (data: string) => void) => void } | null>(null);

  const BASE_URL = 'https://ministall-app.web.app'; 
  const qrValue = `${BASE_URL}/customer?vendorId=${vendorId}&table=${tableNumber}`;
  const tables = Array.from({ length: 15 }, (_, i) => (i + 1).toString());

  const generatePDF = async () => {
    if (!qrRef.current) {
      Alert.alert("Error", "QR Code not ready yet.");
      return;
    }

    setIsGenerating(true);
    
    // 1. Get Base64 image from QR component using the ref
    qrRef.current.toDataURL(async (data: string) => {
      const qrImageData = `data:image/png;base64,${data}`;

      // 2. Define the PDF HTML (Professional Designer Version)
      const htmlContent = `
        <html>
          <head>
            <style>
              @page { margin: 0; }
              body { 
                margin: 0; padding: 0; 
                display: flex; justify-content: center; align-items: center; 
                height: 100vh; background-color: #F8FAFC; 
                font-family: 'Helvetica', Arial, sans-serif;
              }
              .stand-card {
                width: 80%; background-color: white; border-radius: 40px;
                padding: 60px 40px; text-align: center;
                border: 1px solid #E2E8F0;
                box-shadow: 0 10px 30px rgba(0,0,0,0.05);
              }
              .brand-name {
                font-size: 18px; font-weight: 800; color: #6366F1;
                text-transform: uppercase; letter-spacing: 3px; margin-bottom: 10px;
              }
              .main-title {
                font-size: 52px; font-weight: 900; color: #0F172A;
                margin: 0; line-height: 1.1;
              }
              .subtitle {
                font-size: 20px; color: #64748B; margin-top: 10px; margin-bottom: 40px;
              }
              .qr-frame {
                background-color: #F1F5F9; padding: 30px; border-radius: 30px;
                display: inline-block; margin-bottom: 30px;
              }
              .qr-image {
                width: 350px; height: 350px; display: block;
              }
              .table-pill {
                background-color: #0F172A; color: white;
                padding: 15px 50px; border-radius: 100px;
                display: inline-block; font-size: 32px; font-weight: 900;
                margin-top: 10px;
              }
              .footer-url {
                margin-top: 50px; font-size: 11px; color: #94A3B8;
                word-break: break-all; max-width: 80%; margin: 50px auto 0 auto;
              }
            </style>
          </head>
          <body>
            <div class="stand-card">
              <div class="brand-name">MiniStall</div>
              <h1 class="main-title">SCAN TO ORDER</h1>
              <p class="subtitle">Fast & Easy Contactless Ordering</p>
              
              <div class="qr-frame">
                <img src="${qrImageData}" class="qr-image" />
              </div>
              
              <div>
                <div class="table-pill">TABLE ${tableNumber}</div>
              </div>
              
              <p class="footer-url">${qrValue}</p>
            </div>
          </body>
        </html>
      `;

      try {
        // 3. Print to File and Share
        const { uri } = await Print.printToFileAsync({ html: htmlContent });
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      } catch (error) {
        Alert.alert("Error", "Could not generate print file.");
      } finally {
        setIsGenerating(false);
      }
    });
  };

  if (!vendorId) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={{marginTop: 10}}>Loading Vendor Profile...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.title}>Stall QR Code</Text>
          <Text style={styles.subtitle}>Select a table and download the PDF to print</Text>

          <View style={styles.qrWrapper}>
            <View style={styles.qrContainer}>
              <QRCode
                value={qrValue}
                size={220}
                color="#0F172A"
                backgroundColor="white"
                quietZone={10}
                getRef={(c) => (qrRef.current = c)}
              />
            </View>
            <View style={styles.tableBadge}>
              <Text style={styles.tableBadgeText}>TABLE {tableNumber}</Text>
            </View>
          </View>

          <View style={styles.selectorSection}>
            <Text style={styles.label}>Select Table Number</Text>
            <View style={styles.grid}>
              {tables.map((num) => (
                <TouchableOpacity 
                  key={num} 
                  style={[styles.numBtn, tableNumber === num && styles.numBtnActive]}
                  onPress={() => setTableNumber(num)}
                >
                  <Text style={[styles.numText, tableNumber === num && styles.numTextActive]}>
                    {num}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.printBtn, isGenerating && { opacity: 0.7 }]} 
            onPress={generatePDF}
            disabled={isGenerating}
          >
            {isGenerating ? (
                <ActivityIndicator color="#6366F1" />
            ) : (
                <>
                    <Ionicons name="print-outline" size={20} color="#6366F1" />
                    <Text style={styles.printBtnText}>Save as PDF for Printing</Text>
                </>
            )}
          </TouchableOpacity>
          
          <Text style={styles.debugLink}>{qrValue}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, alignItems: 'center' },
  card: { 
    backgroundColor: '#FFF', padding: 25, borderRadius: 28, width: '100%', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 
  },
  title: { fontSize: 24, fontWeight: '900', color: '#0F172A' },
  subtitle: { color: '#64748B', fontSize: 14, marginTop: 5, textAlign: 'center', marginBottom: 20 },
  qrWrapper: { alignItems: 'center', marginBottom: 20 },
  qrContainer: { padding: 15, backgroundColor: '#FFF', borderRadius: 24, borderWidth: 1, borderColor: '#E2E8F0' },
  tableBadge: { backgroundColor: '#6366F1', paddingHorizontal: 15, paddingVertical: 6, borderRadius: 20, marginTop: -15 },
  tableBadgeText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  selectorSection: { width: '100%', marginVertical: 10 },
  label: { fontWeight: '800', color: '#1E293B', marginBottom: 15, fontSize: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  numBtn: { width: '17.5%', aspectRatio: 1, borderRadius: 12, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  numBtnActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  numText: { fontWeight: '700', color: '#475569', fontSize: 16 },
  numTextActive: { color: '#FFF' },
  printBtn: { 
    flexDirection: 'row', backgroundColor: '#EEF2FF', padding: 18, borderRadius: 16, width: '100%', 
    justifyContent: 'center', alignItems: 'center', marginTop: 20, borderWidth: 1, borderColor: '#6366F1' 
  },
  printBtnText: { color: '#6366F1', fontWeight: '700', marginLeft: 10, fontSize: 16 },
  debugLink: { fontSize: 10, color: '#CBD5E1', marginTop: 15, textAlign: 'center' }
});