import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { paintAPI, collectionAPI } from '../src/utils/api';

const PAINT_TYPES = ['base', 'layer', 'shade', 'wash', 'contrast', 'dry', 'technical', 'air', 'metallic', 'speedpaint'];
const CATEGORIES = ['Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Purple', 'Pink', 'Brown', 'Grey', 'Black', 'White', 'Metallic', 'Flesh', 'Bone'];

export default function AddPaint() {
  const router = useRouter();
  const [brand, setBrand] = useState('');
  const [name, setName] = useState('');
  const [paintType, setPaintType] = useState('base');
  const [hexColor, setHexColor] = useState('#888888');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!brand.trim() || !name.trim()) {
      Alert.alert('Error', 'Please fill in brand and name');
      return;
    }

    if (!hexColor.match(/^#[0-9A-Fa-f]{6}$/)) {
      Alert.alert('Error', 'Please enter a valid hex color (e.g., #FF0000)');
      return;
    }

    setLoading(true);
    try {
      const response = await paintAPI.createCustom({
        brand: brand.trim(),
        name: name.trim(),
        paint_type: paintType,
        hex_color: hexColor.toUpperCase(),
        category: category || null,
      });

      // Add to collection automatically
      await collectionAPI.add(response.data.id, 'owned');

      Alert.alert(
        'Success',
        `${name} has been added to your collection!`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to add paint');
    } finally {
      setLoading(false);
    }
  };

  const ColorPreview = () => (
    <View style={styles.colorPreviewContainer}>
      <View style={[styles.colorPreview, { backgroundColor: hexColor }]} />
      <Text style={styles.colorPreviewText}>{hexColor}</Text>
    </View>
  );

  const TypeChip = ({ type }: { type: string }) => (
    <TouchableOpacity
      style={[styles.chip, paintType === type && styles.chipSelected]}
      onPress={() => setPaintType(type)}
    >
      <Text style={[styles.chipText, paintType === type && styles.chipTextSelected]}>
        {type}
      </Text>
    </TouchableOpacity>
  );

  const CategoryChip = ({ cat }: { cat: string }) => (
    <TouchableOpacity
      style={[styles.chip, category === cat && styles.chipSelected]}
      onPress={() => setCategory(category === cat ? '' : cat)}
    >
      <Text style={[styles.chipText, category === cat && styles.chipTextSelected]}>
        {cat}
      </Text>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Brand *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Citadel, Vallejo, Army Painter"
            placeholderTextColor="#666"
            value={brand}
            onChangeText={setBrand}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Paint Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Mephiston Red"
            placeholderTextColor="#666"
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Paint Type</Text>
          <View style={styles.chipsContainer}>
            {PAINT_TYPES.map((type) => (
              <TypeChip key={type} type={type} />
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Hex Color</Text>
          <View style={styles.colorInputRow}>
            <TextInput
              style={[styles.input, styles.colorInput]}
              placeholder="#FF0000"
              placeholderTextColor="#666"
              value={hexColor}
              onChangeText={setHexColor}
              maxLength={7}
              autoCapitalize="characters"
            />
            <ColorPreview />
          </View>
          <View style={styles.colorPalette}>
            {['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFD700', '#C0C0C0', '#000000', '#FFFFFF'].map((color) => (
              <TouchableOpacity
                key={color}
                style={[styles.paletteColor, { backgroundColor: color }]}
                onPress={() => setHexColor(color)}
              />
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Category (optional)</Text>
          <View style={styles.chipsContainer}>
            {CATEGORIES.map((cat) => (
              <CategoryChip key={cat} cat={cat} />
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="add-circle" size={20} color="#FFF" />
              <Text style={styles.submitBtnText}>Add to Collection</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
  },
  colorInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  colorInput: {
    flex: 1,
  },
  colorPreviewContainer: {
    alignItems: 'center',
    gap: 4,
  },
  colorPreview: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  colorPreviewText: {
    color: '#666',
    fontSize: 10,
  },
  colorPalette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  paletteColor: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E1E1E',
  },
  chipSelected: {
    backgroundColor: '#6366F1',
  },
  chipText: {
    color: '#999',
    fontSize: 13,
    textTransform: 'capitalize',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366F1',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
