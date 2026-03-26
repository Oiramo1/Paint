import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { statsAPI, paintAPI } from '../../src/utils/api';
import { Stats } from '../../src/types';

export default function HomeTab() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [statsRes] = await Promise.all([
        statsAPI.get(),
      ]);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const seedDatabase = async () => {
    try {
      const res = await paintAPI.seedPaints();
      if (res.data.seeded) {
        alert('Paint database has been populated!');
      } else {
        alert(res.data.message);
      }
    } catch (error) {
      console.error('Error seeding:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
      }
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome back,</Text>
        <Text style={styles.userName}>{user?.display_name || 'Painter'}</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Ionicons name="color-fill" size={32} color="#4CAF50" />
          <Text style={styles.statValue}>{stats?.owned_paints || 0}</Text>
          <Text style={styles.statLabel}>Owned Paints</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="heart" size={32} color="#E91E63" />
          <Text style={styles.statValue}>{stats?.wishlist_paints || 0}</Text>
          <Text style={styles.statLabel}>Wishlist</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="folder" size={32} color="#FF9800" />
          <Text style={styles.statValue}>{stats?.active_projects || 0}</Text>
          <Text style={styles.statLabel}>Projects</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Quick Actions</Text>

      <View style={styles.actionsGrid}>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push('/scanner')}
        >
          <View style={[styles.actionIcon, { backgroundColor: '#6366F120' }]}>
            <Ionicons name="scan" size={28} color="#6366F1" />
          </View>
          <Text style={styles.actionTitle}>Scan Paint</Text>
          <Text style={styles.actionDesc}>AI-powered recognition</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push('/paint-browser')}
        >
          <View style={[styles.actionIcon, { backgroundColor: '#4CAF5020' }]}>
            <Ionicons name="search" size={28} color="#4CAF50" />
          </View>
          <Text style={styles.actionTitle}>Browse Paints</Text>
          <Text style={styles.actionDesc}>Explore database</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push('/add-paint')}
        >
          <View style={[styles.actionIcon, { backgroundColor: '#FF980020' }]}>
            <Ionicons name="add-circle" size={28} color="#FF9800" />
          </View>
          <Text style={styles.actionTitle}>Add Paint</Text>
          <Text style={styles.actionDesc}>Manual entry</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={seedDatabase}
        >
          <View style={[styles.actionIcon, { backgroundColor: '#E91E6320' }]}>
            <Ionicons name="download" size={28} color="#E91E63" />
          </View>
          <Text style={styles.actionTitle}>Seed Database</Text>
          <Text style={styles.actionDesc}>Load paint brands</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Paint Brands Included</Text>
      <View style={styles.brandsContainer}>
        {['Citadel', 'Vallejo', 'Army Painter', 'Scale75'].map((brand) => (
          <View key={brand} style={styles.brandChip}>
            <Text style={styles.brandText}>{brand}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  content: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0F0F',
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    color: '#999',
    fontSize: 16,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 32,
  },
  actionCard: {
    width: '50%',
    padding: 6,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  actionDesc: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  brandsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  brandChip: {
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  brandText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
});
