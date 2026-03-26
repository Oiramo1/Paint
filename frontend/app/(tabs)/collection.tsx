import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
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
    console.log('Fetching collection, isOnline:', isOnline);
    try {
      if (isOnline) {
        const status = filter === 'all' ? undefined : filter;
        console.log('Making API call with status:', status);
        const res = await collectionAPI.getAll(status);
        console.log('Collection API returned:', res.data?.length, 'items');
        const data = res.data || [];
        setCollection(data);
        // Update cache
        if (data.length > 0) {
          await syncData();
        }
      } else {
        console.log('Offline, using cached:', cachedCollection.length, 'items');
        let filtered = cachedCollection;
        if (filter !== 'all') {
          filtered = cachedCollection.filter(c => c.status === filter);
        }
        setCollection(filtered);
      }
    } catch (error: any) {
      console.error('Error fetching collection:', error?.response?.status, error?.message);
      if (error.response?.status === 403) {
        setLastSyncMessage('Session expired - please log out and back in');
      }
      // Fall back to cache
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
    if (!isOnline) {
      let filtered = cachedCollection;
      if (filter !== 'all') {
        filtered = cachedCollection.filter(c => c.status === filter);
      }
      setCollection(filtered);
    }
  }, [cachedCollection, filter, isOnline]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
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
      const data = res.data || [];
      setCollection(data);
      await syncData();
      
      setLastSyncMessage(`Synced! ${data.length} paint${data.length !== 1 ? 's' : ''} in collection`);
      
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

  const handleRemove = (item: UserPaint) => {
    Alert.alert(
      'Remove Paint',
      `Remove ${item.paint?.name || 'this paint'} from your collection?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await removeFromCollection(item.id);
              if (success) {
                // Remove from local state immediately
                setCollection(prev => prev.filter(c => c.id !== item.id));
                setLastSyncMessage('Paint removed');
                setTimeout(() => setLastSyncMessage(null), 2000);
              } else {
                Alert.alert('Error', 'Failed to remove paint');
              }
            } catch (error) {
              console.error('Remove error:', error);
              Alert.alert('Error', 'Failed to remove paint');
            }
          },
        },
      ]
    );
  };

  const handleToggleStatus = async (item: UserPaint) => {
    const newStatus = item.status === 'owned' ? 'wishlist' : 'owned';
    try {
      const success = await updateCollectionItem(item.id, { status: newStatus });
      if (success) {
        // Update local state immediately
        setCollection(prev => prev.map(c => 
          c.id === item.id ? { ...c, status: newStatus } : c
        ));
        setLastSyncMessage(`Moved to ${newStatus}`);
        setTimeout(() => setLastSyncMessage(null), 2000);
      } else {
        Alert.alert('Error', 'Failed to update paint status');
      }
    } catch (error) {
      console.error('Toggle error:', error);
      Alert.alert('Error', 'Failed to update paint status');
    }
  };

  const FilterButton = ({ value, label }: { value: typeof filter; label: string }) => (
    <TouchableOpacity
      style={[styles.filterBtn, filter === value && styles.filterBtnActive]}
      onPress={() => setFilter(value)}
      activeOpacity={0.7}
    >
      <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item }: { item: UserPaint }) => (
    <View style={styles.paintItemContainer}>
      <TouchableOpacity
        style={styles.paintItem}
        onPress={() => handleToggleStatus(item)}
        onLongPress={() => handleRemove(item)}
        activeOpacity={0.7}
        delayLongPress={500}
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
      
      {/* Quick action buttons */}
      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={[styles.actionBtn, item.status === 'owned' ? styles.actionBtnActive : null]}
          onPress={() => item.status !== 'owned' && handleToggleStatus(item)}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={item.status === 'owned' ? 'checkmark-circle' : 'checkmark-circle-outline'} 
            size={20} 
            color={item.status === 'owned' ? '#4CAF50' : '#666'} 
          />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionBtn, item.status === 'wishlist' ? styles.actionBtnActive : null]}
          onPress={() => item.status !== 'wishlist' && handleToggleStatus(item)}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={item.status === 'wishlist' ? 'heart' : 'heart-outline'} 
            size={20} 
            color={item.status === 'wishlist' ? '#E91E63' : '#666'} 
          />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionBtn}
          onPress={() => handleRemove(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading && collection.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading collection...</Text>
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
            activeOpacity={0.7}
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
          
          <Text style={styles.countText}>{collection.length} paints</Text>
          
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
            activeOpacity={0.7}
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
        <FlatList
          data={collection}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
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
  loadingText: {
    color: '#666',
    marginTop: 12,
    fontSize: 14,
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
  countText: {
    color: '#666',
    fontSize: 13,
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
    marginLeft: 'auto',
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
  separator: {
    height: 12,
  },
  paintItemContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    overflow: 'hidden',
  },
  paintItem: {
    // Let PaintCard handle its own styling
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnActive: {
    backgroundColor: '#3A3A3A',
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
