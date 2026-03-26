import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { paintAPI, collectionAPI } from '../src/utils/api';
import { Paint, UserPaint } from '../src/types';
import { PaintCard } from '../src/components/PaintCard';

export default function PaintBrowser() {
  const [paints, setPaints] = useState<Paint[]>([]);
  const [collection, setCollection] = useState<UserPaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [brands, setBrands] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  
  // Modal states
  const [brandModalVisible, setBrandModalVisible] = useState(false);
  const [typeModalVisible, setTypeModalVisible] = useState(false);

  const fetchData = async () => {
    try {
      const params: any = {};
      if (search) params.search = search;
      if (selectedBrand) params.brand = selectedBrand;
      if (selectedType) params.paint_type = selectedType;

      const [paintsRes, collectionRes, brandsRes, typesRes] = await Promise.all([
        paintAPI.getAll(params),
        collectionAPI.getAll().catch(() => ({ data: [] })),
        paintAPI.getBrands(),
        paintAPI.getTypes(),
      ]);

      setPaints(paintsRes.data);
      setCollection(collectionRes.data || []);
      setBrands(brandsRes.data.brands || []);
      setTypes(typesRes.data.types || []);
    } catch (error) {
      console.error('Error fetching paints:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedBrand, selectedType]);

  const handleSearch = useCallback(() => {
    setLoading(true);
    fetchData();
  }, [search, selectedBrand, selectedType]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const isPaintOwned = (paintId: string) => {
    return collection.some(c => c.paint_id === paintId && c.status === 'owned');
  };

  const isPaintInWishlist = (paintId: string) => {
    return collection.some(c => c.paint_id === paintId && c.status === 'wishlist');
  };

  const addToCollection = async (paint: Paint, status: 'owned' | 'wishlist') => {
    try {
      await collectionAPI.add(paint.id, status);
      Alert.alert('Success', `${paint.name} added to ${status === 'owned' ? 'collection' : 'wishlist'}`);
      fetchData();
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to add paint';
      Alert.alert('Error', message);
    }
  };

  const clearFilters = () => {
    setSelectedBrand(null);
    setSelectedType(null);
    setSearch('');
  };

  // Selection Modal Component
  const SelectionModal = ({ 
    visible, 
    onClose, 
    title, 
    options, 
    selected, 
    onSelect 
  }: {
    visible: boolean;
    onClose: () => void;
    title: string;
    options: string[];
    selected: string | null;
    onSelect: (value: string | null) => void;
  }) => (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.modalOption, !selected && styles.modalOptionSelected]}
              onPress={() => { onSelect(null); onClose(); }}
            >
              <Text style={[styles.modalOptionText, !selected && styles.modalOptionTextSelected]}>
                All {title}
              </Text>
              {!selected && <Ionicons name="checkmark" size={20} color="#6366F1" />}
            </TouchableOpacity>
            
            {options.map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.modalOption, selected === option && styles.modalOptionSelected]}
                onPress={() => { onSelect(option); onClose(); }}
              >
                <Text style={[styles.modalOptionText, selected === option && styles.modalOptionTextSelected]}>
                  {option}
                </Text>
                {selected === option && <Ionicons name="checkmark" size={20} color="#6366F1" />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  if (loading && paints.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading {brands.length > 0 ? `${brands.length} brands` : 'paints'}...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search paints..."
            placeholderTextColor="#666"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); handleSearch(); }}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Dropdowns */}
      <View style={styles.filterRow}>
        <TouchableOpacity 
          style={[styles.filterDropdown, selectedBrand && styles.filterDropdownActive]}
          onPress={() => setBrandModalVisible(true)}
        >
          <Ionicons name="color-palette" size={16} color={selectedBrand ? "#6366F1" : "#999"} />
          <Text style={[styles.filterDropdownText, selectedBrand && styles.filterDropdownTextActive]} numberOfLines={1}>
            {selectedBrand || 'All Brands'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={selectedBrand ? "#6366F1" : "#666"} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.filterDropdown, selectedType && styles.filterDropdownActive]}
          onPress={() => setTypeModalVisible(true)}
        >
          <Ionicons name="brush" size={16} color={selectedType ? "#6366F1" : "#999"} />
          <Text style={[styles.filterDropdownText, selectedType && styles.filterDropdownTextActive]} numberOfLines={1}>
            {selectedType || 'All Types'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={selectedType ? "#6366F1" : "#666"} />
        </TouchableOpacity>

        {(selectedBrand || selectedType || search) && (
          <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
            <Ionicons name="close" size={18} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>

      {/* Results Count & Active Filters */}
      <View style={styles.resultsRow}>
        <Text style={styles.resultCount}>{paints.length} paints found</Text>
        {brands.length > 0 && (
          <Text style={styles.brandCount}>{brands.length} brands available</Text>
        )}
      </View>

      {/* Paint List */}
      <FlashList
        data={paints}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PaintCard
            paint={item}
            showActions
            isOwned={isPaintOwned(item.id)}
            isInWishlist={isPaintInWishlist(item.id)}
            onAddToCollection={() => addToCollection(item, 'owned')}
            onAddToWishlist={() => addToCollection(item, 'wishlist')}
          />
        )}
        estimatedItemSize={80}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="color-palette-outline" size={48} color="#333" />
            <Text style={styles.emptyText}>No paints found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your filters or seed the database</Text>
          </View>
        }
      />

      {/* Brand Selection Modal */}
      <SelectionModal
        visible={brandModalVisible}
        onClose={() => setBrandModalVisible(false)}
        title="Brands"
        options={brands}
        selected={selectedBrand}
        onSelect={setSelectedBrand}
      />

      {/* Type Selection Modal */}
      <SelectionModal
        visible={typeModalVisible}
        onClose={() => setTypeModalVisible(false)}
        title="Types"
        options={types}
        selected={selectedType}
        onSelect={setSelectedType}
      />
    </SafeAreaView>
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
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 8,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
    alignItems: 'center',
  },
  filterDropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#2E2E2E',
  },
  filterDropdownActive: {
    borderColor: '#6366F1',
    backgroundColor: '#6366F115',
  },
  filterDropdownText: {
    flex: 1,
    color: '#999',
    fontSize: 13,
  },
  filterDropdownTextActive: {
    color: '#6366F1',
    fontWeight: '500',
  },
  clearBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EF444420',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resultCount: {
    color: '#999',
    fontSize: 13,
    fontWeight: '500',
  },
  brandCount: {
    color: '#6366F1',
    fontSize: 12,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2E2E2E',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  modalScroll: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2E2E2E',
  },
  modalOptionSelected: {
    backgroundColor: '#6366F115',
    marginHorizontal: -8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderBottomWidth: 0,
  },
  modalOptionText: {
    color: '#CCC',
    fontSize: 15,
  },
  modalOptionTextSelected: {
    color: '#6366F1',
    fontWeight: '600',
  },
});
