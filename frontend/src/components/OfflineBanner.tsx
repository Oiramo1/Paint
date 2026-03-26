import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOfflineStore } from '../store/offlineStore';

export const OfflineBanner: React.FC = () => {
  const { isOnline, pendingActions, isSyncing } = useOfflineStore();

  if (isOnline && pendingActions === 0 && !isSyncing) {
    return null;
  }

  return (
    <View style={[
      styles.container,
      !isOnline ? styles.offline : isSyncing ? styles.syncing : styles.pending
    ]}>
      <Ionicons 
        name={!isOnline ? 'cloud-offline' : isSyncing ? 'sync' : 'cloud-upload'} 
        size={16} 
        color="#FFF" 
      />
      <Text style={styles.text}>
        {!isOnline 
          ? 'Offline - Changes will sync when connected'
          : isSyncing 
            ? 'Syncing...'
            : `${pendingActions} pending change${pendingActions > 1 ? 's' : ''}`
        }
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  offline: {
    backgroundColor: '#EF4444',
  },
  syncing: {
    backgroundColor: '#3B82F6',
  },
  pending: {
    backgroundColor: '#F59E0B',
  },
  text: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '500',
  },
});
