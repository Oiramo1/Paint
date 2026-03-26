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
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
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

  const fetchData = async () => {
    try {
      const params: any = {};
      if (search) params.search = search;
      if (selectedBrand) params.brand = selectedBrand;
      if (selectedType) params.paint_type = selectedType;

      const [paintsRes, collectionRes, brandsRes, typesRes] = await Promise.all([
        paintAPI.getAll(params),
        collectionAPI.getAll(),
        paintAPI.getBrands(),
        paintAPI.getTypes(),
      ]);

      setPaints(paintsRes.data);
      setCollection(collectionRes.data);
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

  const FilterChip = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );

  if (loading && paints.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
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

      <View style={styles.filtersContainer}>
        <Text style={styles.filterLabel}>Brand:</Text>
        <View style={styles.chipsRow}>
          <FilterChip
            label="All"
            selected={!selectedBrand}
            onPress={() => setSelectedBrand(null)}
          />
          {brands.slice(0, 5).map((brand) => (
            <FilterChip
              key={brand}
              label={brand}
              selected={selectedBrand === brand}
              onPress={() => setSelectedBrand(brand)}
            />
          ))}
        </View>
      </View>

      <View style={styles.filtersContainer}>
        <Text style={styles.filterLabel}>Type:</Text>
        <View style={styles.chipsRow}>
          <FilterChip
            label="All"
            selected={!selectedType}
            onPress={() => setSelectedType(null)}
          />
          {types.slice(0, 6).map((type) => (
            <FilterChip
              key={type}
              label={type}
              selected={selectedType === type}
              onPress={() => setSelectedType(type)}
            />
          ))}
        </View>
      </View>

      <Text style={styles.resultCount}>{paints.length} paints found</Text>

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
  filtersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  filterLabel: {
    color: '#666',
    fontSize: 12,
    marginBottom: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#1E1E1E',
  },
  chipSelected: {
    backgroundColor: '#6366F1',
  },
  chipText: {
    color: '#999',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  resultCount: {
    color: '#666',
    fontSize: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  listContent: {
    padding: 16,
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
});
