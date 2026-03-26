import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Paint } from '../types';

interface PaintCardProps {
  paint: Paint;
  onPress?: () => void;
  showActions?: boolean;
  isOwned?: boolean;
  isInWishlist?: boolean;
  onAddToCollection?: () => void;
  onAddToWishlist?: () => void;
  onViewEquivalents?: () => void;
  quantity?: number;
}

export const PaintCard: React.FC<PaintCardProps> = ({
  paint,
  onPress,
  showActions = false,
  isOwned = false,
  isInWishlist = false,
  onAddToCollection,
  onAddToWishlist,
  onViewEquivalents,
  quantity,
}) => {
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

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.colorSwatch, { backgroundColor: paint.hex_color }]}>
        {paint.hex_color.toLowerCase() === '#ffffff' && (
          <View style={styles.whiteSwatchBorder} />
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{paint.name}</Text>
        <Text style={styles.brand}>{paint.brand}</Text>
        <View style={styles.badges}>
          <View style={[styles.typeBadge, { backgroundColor: getPaintTypeColor(paint.paint_type) }]}>
            <Text style={styles.typeText}>{paint.paint_type}</Text>
          </View>
          {isOwned && (
            <View style={styles.ownedBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
              {quantity !== undefined && quantity > 1 && (
                <Text style={styles.quantityText}>x{quantity}</Text>
              )}
            </View>
          )}
          {isInWishlist && (
            <View style={styles.wishlistBadge}>
              <Ionicons name="heart" size={14} color="#E91E63" />
            </View>
          )}
        </View>
      </View>
      {showActions && (
        <View style={styles.actions}>
          {onViewEquivalents && (
            <TouchableOpacity onPress={onViewEquivalents} style={styles.actionBtn}>
              <Ionicons name="swap-horizontal" size={24} color="#6366F1" />
            </TouchableOpacity>
          )}
          {!isOwned && onAddToCollection && (
            <TouchableOpacity onPress={onAddToCollection} style={styles.actionBtn}>
              <Ionicons name="add-circle" size={24} color="#4CAF50" />
            </TouchableOpacity>
          )}
          {!isInWishlist && !isOwned && onAddToWishlist && (
            <TouchableOpacity onPress={onAddToWishlist} style={styles.actionBtn}>
              <Ionicons name="heart-outline" size={24} color="#E91E63" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  colorSwatch: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
    position: 'relative',
    overflow: 'hidden',
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
  info: {
    flex: 1,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  brand: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  typeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  ownedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  wishlistBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    padding: 4,
  },
});
