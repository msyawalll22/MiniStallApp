import { Ionicons } from '@expo/vector-icons';
import * as Font from 'expo-font';
import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, View } from 'react-native';

export default function CustomerLayout() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  // --- FIX: Load the Icon fonts for Web ---
  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync({
          ...Ionicons.font,
        });
      } catch (e) {
        console.warn("Error loading fonts", e);
      } finally {
        setFontsLoaded(true);
      }
    }
    loadFonts();
  }, []);

  // While fonts are loading, show a spinner so icons don't turn into "X"
  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade', 
          contentStyle: { backgroundColor: '#F8FAFC' }
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{ title: 'Menu' }} 
        />
        
        <Stack.Screen 
          name="display" 
          options={{
            title: 'Order Status',
            gestureEnabled: false, 
          }} 
        />

        <Stack.Screen 
          name="success" 
          options={{ title: 'Order Confirmed' }} 
        />
      </Stack>
    </View>
  );
}