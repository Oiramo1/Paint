import React, { useState, useCallback } from 'react';
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
import { UserPaint } from '../../src/types';
import { PaintCard } from '../../src/components/PaintCard';

export default function CollectionTab() {
  const [collection, setCollection] = useState<UserPaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'owned' | 'wishlist'>('all');

  const fetchCollection = async () => {
    try {
      const status = filter === 'all' ? undefined : filter;
      const res = await collectionAPI.getAll(status);
      setCollection(res.data);
    } catch (error) {
      console.error('Error fetching collection:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchCollection();
    }, [filter])
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
            try {
              await collectionAPI.remove(item.id);
              fetchCollection();
            } catch (error) {
              Alert.alert('Error', 'Failed to remove paint');
            }
          },
        },
      ]
    );
  };

  const handleToggleStatus = async (item: UserPaint) => {
    try {
      const newStatus = item.status === 'owned' ? 'wishlist' : 'owned';
      await collectionAPI.update(item.id, { status: newStatus });
      fetchCollection();
    } catch (error) {
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

  if (loading) {
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
      </View>

      {collection.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="color-fill-outline" size={64} color="#333" />
          <Text style={styles.emptyTitle}>No paints yet</Text>
          <Text style={styles.emptyText}>
            Browse the paint database to add paints to your collection
          </Text>
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
});
