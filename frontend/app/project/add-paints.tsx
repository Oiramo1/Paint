import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { paintAPI, projectAPI, collectionAPI } from '../../src/utils/api';
import { Paint, UserPaint } from '../../src/types';

export default function AddPaintsToProject() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const [paints, setPaints] = useState<Paint[]>([]);
  const [collection, setCollection] = useState<UserPaint[]>([]);
  const [selectedPaints, setSelectedPaints] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [showCollection, setShowCollection] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [paintsRes, collectionRes] = await Promise.all([
        paintAPI.getAll(search ? { search } : {}),
        collectionAPI.getAll('owned'),
      ]);
      setPaints(paintsRes.data);
      setCollection(collectionRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePaint = (paintId: string) => {
    const newSelected = new Set(selectedPaints);
    if (newSelected.has(paintId)) {
      newSelected.delete(paintId);
    } else {
      newSelected.add(paintId);
    }
    setSelectedPaints(newSelected);
  };

  const handleAddPaints = async () => {
    if (selectedPaints.size === 0) {
      Alert.alert('Error', 'Please select at least one paint');
      return;
    }

    setAdding(true);
    try {
      const promises = Array.from(selectedPaints).map((paintId) =>
        projectAPI.addPaint(projectId, paintId)
      );
      await Promise.all(promises);
      Alert.alert('Success', `Added ${selectedPaints.size} paints to project`);
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to add paints');
    } finally {
      setAdding(false);
    }
  };

  const displayPaints = showCollection
    ? collection.map((c) => c.paint).filter(Boolean) as Paint[]
    : paints;

  const filteredPaints = search
    ? displayPaints.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.brand.toLowerCase().includes(search.toLowerCase())
      )
    : displayPaints;

  const getPaintTypeColor = (type: string) => {
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
    return colors[type.toLowerCase()] || '#757575';
  };

  if (loading) {
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
          />
        </View>
      </View>

      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleBtn, showCollection && styles.toggleBtnActive]}
          onPress={() => setShowCollection(true)}
        >
          <Text style={[styles.toggleText, showCollection && styles.toggleTextActive]}>
            My Collection
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, !showCollection && styles.toggleBtnActive]}
          onPress={() => setShowCollection(false)}
        >
          <Text style={[styles.toggleText, !showCollection && styles.toggleTextActive]}>
            All Paints
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.selectedCount}>
        {selectedPaints.size} paints selected
      </Text>

      <FlashList
        data={filteredPaints}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isSelected = selectedPaints.has(item.id);
          return (
            <TouchableOpacity
              style={[styles.paintItem, isSelected && styles.paintItemSelected]}
              onPress={() => togglePaint(item.id)}
            >
              <View style={[styles.colorSwatch, { backgroundColor: item.hex_color }]} />
              <View style={styles.paintInfo}>
                <Text style={styles.paintName}>{item.name}</Text>
                <Text style={styles.paintBrand}>{item.brand}</Text>
                <View style={[styles.typeBadge, { backgroundColor: getPaintTypeColor(item.paint_type) }]}>
                  <Text style={styles.typeText}>{item.paint_type}</Text>
                </View>
              </View>
              <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                {isSelected && <Ionicons name="checkmark" size={16} color="#FFF" />}
              </View>
            </TouchableOpacity>
          );
        }}
        estimatedItemSize={80}
        contentContainerStyle={styles.listContent}
      />

      {selectedPaints.size > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.addBtn, adding && styles.addBtnDisabled]}
            onPress={handleAddPaints}
            disabled={adding}
          >
            {adding ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="add" size={20} color="#FFF" />
                <Text style={styles.addBtnText}>Add {selectedPaints.size} Paints</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
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
  toggleContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 8,
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1E1E1E',
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#6366F1',
  },
  toggleText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  selectedCount: {
    color: '#666',
    fontSize: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  listContent: {
    padding: 16,
  },
  paintItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  paintItemSelected: {
    backgroundColor: '#2A2A4A',
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  colorSwatch: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
  },
  paintInfo: {
    flex: 1,
  },
  paintName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  paintBrand: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
  },
  typeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#666',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E1E1E',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366F1',
    padding: 16,
    borderRadius: 12,
  },
  addBtnDisabled: {
    opacity: 0.6,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
