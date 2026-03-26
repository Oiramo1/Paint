import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '../src/store/authStore';
import { useOfflineStore } from '../src/store/offlineStore';
import { offlineService } from '../src/utils/offlineService';
import { OfflineBanner } from '../src/components/OfflineBanner';

export default function RootLayout() {
  const { loadAuth, isLoading, isAuthenticated } = useAuthStore();
  const { setOnline, loadCachedData, syncData, processOfflineQueue } = useOfflineStore();

  useEffect(() => {
    loadAuth();
    loadCachedData();

    // Listen for network changes
    const unsubscribe = offlineService.addNetworkListener(async (online) => {
      setOnline(online);
      if (online) {
        // Process any pending offline actions first
        await processOfflineQueue();
        // Then sync fresh data
        await syncData();
      }
    });

    // Initial online check
    offlineService.checkOnline().then(setOnline);

    return () => unsubscribe();
  }, []);

  // Sync data when user logs in
  useEffect(() => {
    if (isAuthenticated) {
      syncData();
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <OfflineBanner />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0F0F0F' },
          headerTintColor: '#FFFFFF',
          contentStyle: { backgroundColor: '#0F0F0F' },
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="paint-browser" options={{ title: 'Paint Database' }} />
        <Stack.Screen name="scanner" options={{ title: 'Scan Paint' }} />
        <Stack.Screen name="add-paint" options={{ title: 'Add Custom Paint' }} />
        <Stack.Screen name="project/[id]" options={{ title: 'Project Details' }} />
        <Stack.Screen name="project/add-paints" options={{ title: 'Add Paints to Project' }} />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0F0F',
  },
});
