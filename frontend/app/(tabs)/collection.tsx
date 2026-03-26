import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collectionAPI } from '../../src/utils/api';
import { useOfflineStore } from '../../src/store/offlineStore';
import { UserPaint } from '../../src/types';
import { PaintCard } from '../../src/components/PaintCard';

export default function CollectionTab() {
  const { 
    isOnline, 
    cachedCollection, 
    syncData,
    removeFromCollection,
    updateCollectionItem 
  } = useOfflineStore();
  
  const [collection, setCollection] = useState<UserPaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'owned' | 'wishlist'>('all');

  const fetchCollection = async () => {
    try {
      // Always try to fetch from API first when online
      if (isOnline) {
        const status = filter === 'all' ? undefined : filter;
        const res = await collectionAPI.getAll(status);
        setCollection(res.data || []);
        // Update cache
        if (res.data) {
          await syncData();
        }
      } else {
        // Use cached data when offline
        let filtered = cachedCollection;
        if (filter !== 'all') {
          filtered = cachedCollection.filter(c => c.status === filter);
        }
        setCollection(filtered);
      }
    } catch (error: any) {
      console.error('Error fetching collection:', error);
      // Fall back to cache on error, but show if it was an auth error
      if (error.response?.status === 403) {
        console.log('Auth error - user may need to re-login');
      }
      let filtered = cachedCollection;
      if (filter !== 'all') {
        filtered = cachedCollection.filter(c => c.status === filter);
      }
      setCollection(filtered);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Update collection when cached data changes
  useEffect(() => {
    let filtered = cachedCollection;
    if (filter !== 'all') {
      filtered = cachedCollection.filter(c => c.status === filter);
    }
    setCollection(filtered);
  }, [cachedCollection, filter]);

  useFocusEffect(
    useCallback(() => {
      fetchCollection();
    }, [filter, isOnline])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchCollection();
  };

  const handleRemove = async (item: UserPaint) => {
    Alert.alert(
      'Remove Paint',
      `Remove ${item.paint?.name} from your collection?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const success = await removeFromCollection(item.id);
            if (!success && isOnline) {
              Alert.alert('Error', 'Failed to remove paint');
            }
          },
        },
      ]
    );
  };

  const handleToggleStatus = async (item: UserPaint) => {
    const newStatus = item.status === 'owned' ? 'wishlist' : 'owned';
    const success = await updateCollectionItem(item.id, { status: newStatus });
    if (!success && isOnline) {
      Alert.alert('Error', 'Failed to update paint status');
    }
  };

  const FilterButton = ({ value, label }: { value: typeof filter; label: string }) => (
    <TouchableOpacity
      style={[styles.filterBtn, filter === value && styles.filterBtnActive]}
      onPress={() => setFilter(value)}
    >
      <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (loading && collection.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterContainer}>
        <FilterButton value="all" label="All" />
        <FilterButton value="owned" label="Owned" />
        <FilterButton value="wishlist" label="Wishlist" />
        {!isOnline && (
          <View style={styles.offlineIndicator}>
            <Ionicons name="cloud-offline" size={16} color="#EF4444" />
          </View>
        )}
      </View>

      {collection.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="color-fill-outline" size={64} color="#333" />
          <Text style={styles.emptyTitle}>No paints yet</Text>
          <Text style={styles.emptyText}>
            Browse the paint database to add paints to your collection
          </Text>
          {!isOnline && cachedCollection.length === 0 && (
            <Text style={styles.offlineNote}>
              Connect to internet to load your collection
            </Text>
          )}
        </View>
      ) : (
        <FlashList
          data={collection}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              onLongPress={() => handleRemove(item)}
              onPress={() => handleToggleStatus(item)}
            >
              {item.paint && (
                <PaintCard
                  paint={item.paint}
                  isOwned={item.status === 'owned'}
                  isInWishlist={item.status === 'wishlist'}
                  quantity={item.quantity}
                />
              )}
            </TouchableOpacity>
          )}
          estimatedItemSize={80}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0F0F',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    alignItems: 'center',
  },
  filterBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1E1E1E',
  },
  filterBtnActive: {
    backgroundColor: '#6366F1',
  },
  filterText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  offlineIndicator: {
    marginLeft: 'auto',
  },
  listContent: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  offlineNote: {
    color: '#EF4444',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
});
