import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  FlatList,
  Modal,
  TextInput,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collectionAPI } from '../../src/utils/api';
import { useOfflineStore } from '../../src/store/offlineStore';
import { UserPaint } from '../../src/types';

export default function CollectionTab() {
  const { 
    isOnline, 
    cachedCollection, 
    syncData,
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
  
  // Quantity modal state
  const [quantityModalVisible, setQuantityModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<UserPaint | null>(null);
  const [quantityInput, setQuantityInput] = useState('1');

  const fetchCollection = async () => {
    console.log('Fetching collection, isOnline:', isOnline);
    try {
      if (isOnline) {
        const status = filter === 'all' ? undefined : filter;
        console.log('Making API call with status:', status);
        const res = await collectionAPI.getAll(status);
        console.log('Collection API returned:', res.data?.length, 'items');
        console.log('Collection data:', JSON.stringify(res.data, null, 2));
        const data = res.data || [];
        setCollection(data);
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
      if (pendingActions > 0) {
        const result = await processOfflineQueue();
        if (result.failed > 0) {
          setLastSyncMessage(`Synced ${result.success} items, ${result.failed} failed`);
        }
      }

      const res = await collectionAPI.getAll();
      const data = res.data || [];
      setCollection(data);
      await syncData();
      
      setLastSyncMessage(`Synced! ${data.length} paint${data.length !== 1 ? 's' : ''} in collection`);
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

  const handleDelete = async (item: UserPaint) => {
    const paintName = item.paint?.name || 'this paint';
    console.log('Delete button pressed for item:', item.id, paintName);
    
    // Direct delete without confirmation for better UX
    try {
      console.log('Calling collectionAPI.remove with id:', item.id);
      const response = await collectionAPI.remove(item.id);
      console.log('Delete response:', response);
      setCollection(prev => prev.filter(c => c.id !== item.id));
      setLastSyncMessage('Paint removed!');
      setTimeout(() => setLastSyncMessage(null), 2000);
    } catch (error: any) {
      console.error('Delete error:', error?.response?.data || error?.message || error);
      setLastSyncMessage('Failed to remove paint');
      setTimeout(() => setLastSyncMessage(null), 3000);
    }
  };

  const handleToggleStatus = async (item: UserPaint, newStatus: 'owned' | 'wishlist') => {
    if (item.status === newStatus) return;
    
    try {
      await collectionAPI.update(item.id, { status: newStatus });
      setCollection(prev => prev.map(c => 
        c.id === item.id ? { ...c, status: newStatus } : c
      ));
      setLastSyncMessage(`Moved to ${newStatus}`);
      setTimeout(() => setLastSyncMessage(null), 2000);
    } catch (error) {
      console.error('Toggle error:', error);
      setLastSyncMessage('Failed to update paint status');
      setTimeout(() => setLastSyncMessage(null), 2000);
    }
  };

  const openQuantityModal = (item: UserPaint) => {
    setSelectedItem(item);
    setQuantityInput(String(item.quantity || 1));
    setQuantityModalVisible(true);
  };

  const handleUpdateQuantity = async () => {
    if (!selectedItem) return;
    
    const quantity = parseInt(quantityInput, 10);
    if (isNaN(quantity) || quantity < 1) {
      setLastSyncMessage('Please enter a number greater than 0');
      setTimeout(() => setLastSyncMessage(null), 2000);
      return;
    }

    try {
      await collectionAPI.update(selectedItem.id, { quantity });
      setCollection(prev => prev.map(c => 
        c.id === selectedItem.id ? { ...c, quantity } : c
      ));
      setQuantityModalVisible(false);
      setLastSyncMessage(`Quantity updated to ${quantity}`);
      setTimeout(() => setLastSyncMessage(null), 2000);
    } catch (error) {
      console.error('Quantity update error:', error);
      setLastSyncMessage('Failed to update quantity');
      setTimeout(() => setLastSyncMessage(null), 2000);
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

  const renderItem = ({ item }: { item: UserPaint }) => {
    const paint = item.paint;
    
    // If no paint data, show placeholder
    if (!paint) {
      return (
        <View style={styles.paintCard}>
          <View style={styles.paintInfo}>
            <View style={[styles.colorSwatch, { backgroundColor: '#333' }]} />
            <View style={styles.paintDetails}>
              <Text style={styles.paintName}>Unknown Paint</Text>
              <Text style={styles.paintBrand}>Paint data unavailable</Text>
            </View>
          </View>
          <View style={styles.quickActions}>
            <TouchableOpacity 
              style={styles.deleteBtn}
              onPress={() => handleDelete(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="trash" size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.paintCard}>
        {/* Paint Info Row */}
        <TouchableOpacity 
          style={styles.paintInfo}
          onPress={() => openQuantityModal(item)}
          activeOpacity={0.7}
        >
          <View style={[styles.colorSwatch, { backgroundColor: paint.hex_color || '#808080' }]}>
            {paint.hex_color?.toLowerCase() === '#ffffff' && (
              <View style={styles.whiteSwatchBorder} />
            )}
          </View>
          <View style={styles.paintDetails}>
            <Text style={styles.paintName} numberOfLines={1}>{paint.name}</Text>
            <Text style={styles.paintBrand}>{paint.brand}</Text>
            <View style={styles.badges}>
              <View style={[styles.typeBadge, { backgroundColor: getTypeColor(paint.paint_type) }]}>
                <Text style={styles.typeText}>{paint.paint_type}</Text>
              </View>
              {item.status === 'owned' && (
                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              )}
              {item.status === 'wishlist' && (
                <Ionicons name="heart" size={16} color="#E91E63" />
              )}
            </View>
          </View>
          
          {/* Quantity Badge */}
          <TouchableOpacity 
            style={styles.quantityBadge}
            onPress={() => openQuantityModal(item)}
            activeOpacity={0.7}
          >
            <Text style={styles.quantityText}>x{item.quantity || 1}</Text>
            <Ionicons name="pencil" size={12} color="#999" />
          </TouchableOpacity>
        </TouchableOpacity>
        
        {/* Action Buttons Row */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={[styles.actionBtn, item.status === 'owned' && styles.actionBtnActive]}
            onPress={() => handleToggleStatus(item, 'owned')}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={item.status === 'owned' ? 'checkmark-circle' : 'checkmark-circle-outline'} 
              size={22} 
              color={item.status === 'owned' ? '#4CAF50' : '#666'} 
            />
            <Text style={[styles.actionLabel, item.status === 'owned' && styles.actionLabelActive]}>
              Owned
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionBtn, item.status === 'wishlist' && styles.actionBtnActive]}
            onPress={() => handleToggleStatus(item, 'wishlist')}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={item.status === 'wishlist' ? 'heart' : 'heart-outline'} 
              size={22} 
              color={item.status === 'wishlist' ? '#E91E63' : '#666'} 
            />
            <Text style={[styles.actionLabel, item.status === 'wishlist' && { color: '#E91E63' }]}>
              Wishlist
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.deleteBtn}
            onPress={() => handleDelete(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash" size={22} color="#EF4444" />
            <Text style={styles.deleteBtnLabel}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      base: '#4CAF50',
      layer: '#2196F3',
      shade: '#9C27B0',
      wash: '#9C27B0',
      contrast: '#FF9800',
      dry: '#795548',
      technical: '#607D8B',
      air: '#00BCD4',
      metallic: '#FFD700',
      speedpaint: '#E91E63',
    };
    return colors[type?.toLowerCase()] || '#757575';
  };

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
      {/* Header */}
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

      {/* Quantity Modal */}
      <Modal
        visible={quantityModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQuantityModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Quantity</Text>
            <Text style={styles.modalSubtitle}>
              {selectedItem?.paint?.name || 'Paint'}
            </Text>
            
            <View style={styles.quantityInputRow}>
              <TouchableOpacity 
                style={styles.quantityBtn}
                onPress={() => setQuantityInput(String(Math.max(1, parseInt(quantityInput) - 1)))}
              >
                <Ionicons name="remove" size={24} color="#FFF" />
              </TouchableOpacity>
              
              <TextInput
                style={styles.quantityInputField}
                value={quantityInput}
                onChangeText={setQuantityInput}
                keyboardType="number-pad"
                selectTextOnFocus
              />
              
              <TouchableOpacity 
                style={styles.quantityBtn}
                onPress={() => setQuantityInput(String(parseInt(quantityInput) + 1))}
              >
                <Ionicons name="add" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalCancelBtn}
                onPress={() => setQuantityModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalSaveBtn}
                onPress={handleUpdateQuantity}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  paintCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    overflow: 'hidden',
  },
  paintInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  colorSwatch: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  whiteSwatchBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
  },
  paintDetails: {
    flex: 1,
  },
  paintName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  paintBrand: {
    color: '#999',
    fontSize: 13,
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  typeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  quantityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  quantityText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  actionBtnActive: {
    backgroundColor: '#2A2A2A',
  },
  actionLabel: {
    color: '#666',
    fontSize: 13,
    fontWeight: '500',
  },
  actionLabelActive: {
    color: '#4CAF50',
  },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderLeftWidth: 1,
    borderLeftColor: '#2A2A2A',
  },
  deleteBtnLabel: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '500',
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalSubtitle: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  quantityInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  quantityBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityInputField: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 24,
    fontWeight: '600',
    color: '#FFF',
    textAlign: 'center',
    minWidth: 80,
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#999',
    fontSize: 16,
    fontWeight: '600',
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
