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
    updateCollectionItem,
    processOfflineQueue,
    pendingActions,
    isSyncing,
  } = useOfflineStore();
  
  const [collection, setCollection] = useState<UserPaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'owned' | 'wishlist'>('all');
  const [syncing, setSyncing] = useState(false);
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null);

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
        setLastSyncMessage('Auth error - try logging out and back in');
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
    setLastSyncMessage(null);
    fetchCollection();
  };

  const handleForceSync = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Please connect to the internet to sync your collection.');
      return;
    }

    setSyncing(true);
    setLastSyncMessage(null);

    try {
      // First, process any pending offline actions
      if (pendingActions > 0) {
        const result = await processOfflineQueue();
        if (result.failed > 0) {
          setLastSyncMessage(`Synced ${result.success} items, ${result.failed} failed`);
        }
      }

      // Then force refresh from server
      const res = await collectionAPI.getAll();
      setCollection(res.data || []);
      await syncData();
      
      const count = res.data?.length || 0;
      setLastSyncMessage(`Synced! ${count} paint${count !== 1 ? 's' : ''} in collection`);
      
      // Clear message after 3 seconds
      setTimeout(() => setLastSyncMessage(null), 3000);
    } catch (error: any) {
      console.error('Sync error:', error);
      if (error.response?.status === 403) {
        setLastSyncMessage('Session expired - please log out and back in');
      } else {
        setLastSyncMessage('Sync failed - please try again');
      }
    } finally {
      setSyncing(false);
    }
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
      {/* Header with filters and sync button */}
      <View style={styles.headerContainer}>
        <View style={styles.filterContainer}>
          <FilterButton value="all" label="All" />
          <FilterButton value="owned" label="Owned" />
          <FilterButton value="wishlist" label="Wishlist" />
        </View>
        
        <View style={styles.syncRow}>
          <TouchableOpacity 
            style={[styles.syncBtn, (syncing || isSyncing) && styles.syncBtnDisabled]}
            onPress={handleForceSync}
            disabled={syncing || isSyncing}
          >
            {syncing || isSyncing ? (
              <ActivityIndicator size="small" color="#6366F1" />
            ) : (
              <Ionicons name="sync" size={18} color="#6366F1" />
            )}
            <Text style={styles.syncBtnText}>
              {syncing || isSyncing ? 'Syncing...' : 'Sync'}
            </Text>
            {pendingActions > 0 && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{pendingActions}</Text>
              </View>
            )}
          </TouchableOpacity>
          
          {!isOnline && (
            <View style={styles.offlineChip}>
              <Ionicons name="cloud-offline" size={14} color="#EF4444" />
              <Text style={styles.offlineChipText}>Offline</Text>
            </View>
          )}
        </View>
        
        {lastSyncMessage && (
          <View style={[
            styles.syncMessage,
            lastSyncMessage.includes('error') || lastSyncMessage.includes('failed') || lastSyncMessage.includes('expired')
              ? styles.syncMessageError 
              : styles.syncMessageSuccess
          ]}>
            <Text style={styles.syncMessageText}>{lastSyncMessage}</Text>
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
          
          <TouchableOpacity 
            style={styles.emptySyncBtn}
            onPress={handleForceSync}
            disabled={syncing || !isOnline}
          >
            <Ionicons name="sync" size={20} color="#FFF" />
            <Text style={styles.emptySyncBtnText}>
              {syncing ? 'Syncing...' : 'Sync Collection'}
            </Text>
          </TouchableOpacity>
          
          {!isOnline && (
            <Text style={styles.offlineNote}>
              Connect to internet to sync your collection
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
          ListFooterComponent={
            <Text style={styles.footerHint}>
              Tap to toggle owned/wishlist • Long press to remove
            </Text>
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
  headerContainer: {
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
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
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F115',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#6366F140',
    gap: 6,
  },
  syncBtnDisabled: {
    opacity: 0.6,
  },
  syncBtnText: {
    color: '#6366F1',
    fontSize: 13,
    fontWeight: '600',
  },
  pendingBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  pendingBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  offlineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF444420',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  offlineChipText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '500',
  },
  syncMessage: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  syncMessageSuccess: {
    backgroundColor: '#4CAF5020',
  },
  syncMessageError: {
    backgroundColor: '#EF444420',
  },
  syncMessageText: {
    fontSize: 13,
    color: '#CCC',
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  footerHint: {
    color: '#555',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 16,
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
  emptySyncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    marginTop: 24,
    gap: 8,
  },
  emptySyncBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  offlineNote: {
    color: '#EF4444',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
});
