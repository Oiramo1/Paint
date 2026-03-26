import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { equivalentsAPI, collectionAPI, paintAPI } from '../src/utils/api';
import { Paint, PaintEquivalent, EquivalentsResponse } from '../src/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FilterMode = 'collection' | 'all';

export default function PaintEquivalents() {
  const { paintId } = useLocalSearchParams<{ paintId: string }>();
  const insets = useSafeAreaInsets();
  
  const [sourcePaint, setSourcePaint] = useState<Paint | null>(null);
  const [equivalents, setEquivalents] = useState<PaintEquivalent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<FilterMode>('collection');
  const [noCollectionPaints, setNoCollectionPaints] = useState(false);

  useEffect(() => {
    loadEquivalents();
  }, [paintId, filterMode]);

  const loadEquivalents = async () => {
    if (!paintId) return;
    
    setLoading(true);
    try {
      let response;
      if (filterMode === 'collection') {
        response = await equivalentsAPI.getFromCollection(paintId, 10);
        if (response.data.equivalents.length === 0) {
          setNoCollectionPaints(true);
        } else {
          setNoCollectionPaints(false);
        }
      } else {
        response = await equivalentsAPI.getEquivalents(paintId, 15);
        setNoCollectionPaints(false);
      }
      
      setSourcePaint(response.data.source_paint);
      setEquivalents(response.data.equivalents || []);
    } catch (error: any) {
      console.error('Error loading equivalents:', error);
      Alert.alert('Error', 'Failed to load paint equivalents');
    } finally {
      setLoading(false);
    }
  };

  const addToCollection = async (paint: Paint) => {
    try {
      await collectionAPI.add(paint.id, 'owned');
      Alert.alert('Success', `${paint.name} added to collection!`);
      loadEquivalents(); // Refresh to update is_owned status
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to add paint');
    }
  };

  const getMatchQualityColor = (quality: string) => {
    switch (quality) {
      case 'exact': return '#4CAF50';
      case 'very_close': return '#8BC34A';
      case 'close': return '#CDDC39';
      case 'similar': return '#FF9800';
      default: return '#F44336';
    }
  };

  const getMatchQualityLabel = (quality: string) => {
    switch (quality) {
      case 'exact': return 'Exact Match';
      case 'very_close': return 'Very Close';
      case 'close': return 'Close';
      case 'similar': return 'Similar';
      default: return 'Different';
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paint Equivalents</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Finding similar paints...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {/* Source Paint */}
          {sourcePaint && (
            <View style={styles.sourcePaintCard}>
              <Text style={styles.sectionLabel}>Finding equivalents for:</Text>
              <View style={styles.sourcePaintInfo}>
                <View style={[styles.colorSwatch, { backgroundColor: sourcePaint.hex_color }]} />
                <View style={styles.paintDetails}>
                  <Text style={styles.paintBrand}>{sourcePaint.brand}</Text>
                  <Text style={styles.paintName}>{sourcePaint.name}</Text>
                  <Text style={styles.paintType}>{sourcePaint.paint_type} • {sourcePaint.hex_color}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Filter Toggle */}
          <View style={styles.filterContainer}>
            <TouchableOpacity
              style={[styles.filterBtn, filterMode === 'collection' && styles.filterBtnActive]}
              onPress={() => setFilterMode('collection')}
            >
              <Ionicons 
                name="color-fill" 
                size={18} 
                color={filterMode === 'collection' ? '#FFF' : '#888'} 
              />
              <Text style={[styles.filterBtnText, filterMode === 'collection' && styles.filterBtnTextActive]}>
                From My Collection
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterBtn, filterMode === 'all' && styles.filterBtnActive]}
              onPress={() => setFilterMode('all')}
            >
              <Ionicons 
                name="globe" 
                size={18} 
                color={filterMode === 'all' ? '#FFF' : '#888'} 
              />
              <Text style={[styles.filterBtnText, filterMode === 'all' && styles.filterBtnTextActive]}>
                All Brands
              </Text>
            </TouchableOpacity>
          </View>

          {/* Results */}
          {noCollectionPaints && filterMode === 'collection' ? (
            <View style={styles.emptyState}>
              <Ionicons name="color-palette-outline" size={48} color="#666" />
              <Text style={styles.emptyTitle}>No Paints in Collection</Text>
              <Text style={styles.emptyText}>
                Add paints to your collection to find equivalents you already own.
              </Text>
              <TouchableOpacity 
                style={styles.switchBtn}
                onPress={() => setFilterMode('all')}
              >
                <Text style={styles.switchBtnText}>View All Brands Instead</Text>
              </TouchableOpacity>
            </View>
          ) : equivalents.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search" size={48} color="#666" />
              <Text style={styles.emptyTitle}>No Equivalents Found</Text>
              <Text style={styles.emptyText}>
                No similar paints were found in the database.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.resultsLabel}>
                {equivalents.length} equivalent{equivalents.length !== 1 ? 's' : ''} found
              </Text>
              
              {equivalents.map((eq, index) => (
                <View key={eq.paint.id} style={styles.equivalentCard}>
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankText}>#{index + 1}</Text>
                  </View>
                  
                  <View style={styles.equivalentContent}>
                    <View style={styles.equivalentHeader}>
                      <View style={[styles.colorSwatchSmall, { backgroundColor: eq.paint.hex_color }]} />
                      <View style={styles.equivalentInfo}>
                        <Text style={styles.eqBrand}>{eq.paint.brand}</Text>
                        <Text style={styles.eqName}>{eq.paint.name}</Text>
                      </View>
                      {eq.is_owned && (
                        <View style={styles.ownedBadge}>
                          <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                          <Text style={styles.ownedText}>Owned</Text>
                        </View>
                      )}
                    </View>
                    
                    <View style={styles.matchInfo}>
                      <View style={[styles.matchBadge, { backgroundColor: getMatchQualityColor(eq.match_quality) + '30' }]}>
                        <Text style={[styles.matchBadgeText, { color: getMatchQualityColor(eq.match_quality) }]}>
                          {getMatchQualityLabel(eq.match_quality)}
                        </Text>
                      </View>
                      <Text style={styles.deltaE}>ΔE: {eq.delta_e}</Text>
                      <Text style={styles.hexCode}>{eq.paint.hex_color}</Text>
                    </View>
                    
                    {/* Color comparison */}
                    <View style={styles.colorComparison}>
                      <View style={styles.colorCompareItem}>
                        <View style={[styles.colorCompareBox, { backgroundColor: sourcePaint?.hex_color }]} />
                        <Text style={styles.colorCompareLabel}>Original</Text>
                      </View>
                      <Ionicons name="arrow-forward" size={16} color="#666" />
                      <View style={styles.colorCompareItem}>
                        <View style={[styles.colorCompareBox, { backgroundColor: eq.paint.hex_color }]} />
                        <Text style={styles.colorCompareLabel}>Equivalent</Text>
                      </View>
                    </View>
                    
                    {!eq.is_owned && (
                      <TouchableOpacity 
                        style={styles.addBtn}
                        onPress={() => addToCollection(eq.paint)}
                      >
                        <Ionicons name="add" size={18} color="#FFF" />
                        <Text style={styles.addBtnText}>Add to Collection</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  backBtn: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    marginTop: 16,
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  sourcePaintCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 12,
  },
  sourcePaintInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  colorSwatch: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  paintDetails: {
    flex: 1,
  },
  paintBrand: {
    color: '#888',
    fontSize: 12,
  },
  paintName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  paintType: {
    color: '#6366F1',
    fontSize: 12,
    marginTop: 2,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  filterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E1E1E',
    paddingVertical: 12,
    borderRadius: 12,
  },
  filterBtnActive: {
    backgroundColor: '#6366F1',
  },
  filterBtnText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '500',
  },
  filterBtnTextActive: {
    color: '#FFF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 32,
  },
  switchBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#6366F1',
    borderRadius: 12,
  },
  switchBtnText: {
    color: '#FFF',
    fontWeight: '600',
  },
  resultsLabel: {
    color: '#888',
    fontSize: 14,
    marginBottom: 16,
  },
  equivalentCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  rankBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomRightRadius: 12,
  },
  rankText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  equivalentContent: {
    padding: 16,
    paddingTop: 40,
  },
  equivalentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorSwatchSmall: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  equivalentInfo: {
    flex: 1,
  },
  eqBrand: {
    color: '#888',
    fontSize: 12,
  },
  eqName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  ownedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  ownedText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
  },
  matchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  matchBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  matchBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  deltaE: {
    color: '#888',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  hexCode: {
    color: '#666',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  colorComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  colorCompareItem: {
    alignItems: 'center',
    gap: 6,
  },
  colorCompareBox: {
    width: 48,
    height: 32,
    borderRadius: 6,
  },
  colorCompareLabel: {
    color: '#888',
    fontSize: 10,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 16,
  },
  addBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
