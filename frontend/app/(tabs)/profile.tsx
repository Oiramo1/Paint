import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { useOfflineStore } from '../../src/store/offlineStore';
import { offlineService } from '../../src/utils/offlineService';

export default function ProfileTab() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { 
    isOnline, 
    pendingActions, 
    lastSyncTime, 
    isSyncing,
    syncData,
    processOfflineQueue 
  } = useOfflineStore();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login');
          },
        },
      ]
    );
  };

  const handleSyncNow = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Connect to internet to sync your data');
      return;
    }
    
    if (pendingActions > 0) {
      const result = await processOfflineQueue();
      Alert.alert('Sync Complete', `${result.success} changes synced, ${result.failed} failed`);
    } else {
      await syncData();
      Alert.alert('Sync Complete', 'Your data is up to date');
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear locally stored data. Your data on the server will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await offlineService.clearAllCache();
            Alert.alert('Cache Cleared', 'Local data has been cleared');
          },
        },
      ]
    );
  };

  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never';
    const date = new Date(lastSyncTime);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return date.toLocaleDateString();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          <Ionicons name="person" size={48} color="#6366F1" />
        </View>
        <Text style={styles.userName}>{user?.display_name}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
      </View>

      {/* Sync Status Card */}
      <View style={styles.syncCard}>
        <View style={styles.syncHeader}>
          <View style={styles.syncStatus}>
            <View style={[
              styles.statusDot,
              { backgroundColor: isOnline ? '#4CAF50' : '#EF4444' }
            ]} />
            <Text style={styles.syncStatusText}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
          {isSyncing && (
            <Text style={styles.syncingText}>Syncing...</Text>
          )}
        </View>
        
        <View style={styles.syncDetails}>
          <View style={styles.syncRow}>
            <Ionicons name="time-outline" size={16} color="#666" />
            <Text style={styles.syncLabel}>Last synced:</Text>
            <Text style={styles.syncValue}>{formatLastSync()}</Text>
          </View>
          
          {pendingActions > 0 && (
            <View style={styles.syncRow}>
              <Ionicons name="cloud-upload-outline" size={16} color="#F59E0B" />
              <Text style={styles.syncLabel}>Pending:</Text>
              <Text style={[styles.syncValue, { color: '#F59E0B' }]}>
                {pendingActions} change{pendingActions > 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity 
          style={[styles.syncBtn, !isOnline && styles.syncBtnDisabled]}
          onPress={handleSyncNow}
          disabled={!isOnline || isSyncing}
        >
          <Ionicons name="sync" size={18} color="#FFF" />
          <Text style={styles.syncBtnText}>
            {pendingActions > 0 ? 'Sync Pending Changes' : 'Sync Now'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        
        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuLeft}>
            <Ionicons name="person-outline" size={22} color="#6366F1" />
            <Text style={styles.menuText}>Edit Profile</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuLeft}>
            <Ionicons name="notifications-outline" size={22} color="#6366F1" />
            <Text style={styles.menuText}>Notifications</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data & Storage</Text>
        
        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuLeft}>
            <Ionicons name="cloud-upload-outline" size={22} color="#4CAF50" />
            <Text style={styles.menuText}>Export Data</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuLeft}>
            <Ionicons name="cloud-download-outline" size={22} color="#FF9800" />
            <Text style={styles.menuText}>Import Data</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleClearCache}>
          <View style={styles.menuLeft}>
            <Ionicons name="trash-outline" size={22} color="#EF4444" />
            <Text style={styles.menuText}>Clear Cache</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        
        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuLeft}>
            <Ionicons name="information-circle-outline" size={22} color="#2196F3" />
            <Text style={styles.menuText}>App Version</Text>
          </View>
          <Text style={styles.menuValue}>1.0.0</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuLeft}>
            <Ionicons name="help-circle-outline" size={22} color="#2196F3" />
            <Text style={styles.menuText}>Help & Support</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={22} color="#EF4444" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <Text style={styles.syncInfo}>
        {isOnline 
          ? 'Your data syncs automatically across all your devices'
          : 'Changes will sync when you reconnect to internet'
        }
      </Text>
    </ScrollView>
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
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1E1E1E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  userEmail: {
    color: '#999',
    fontSize: 14,
    marginTop: 4,
  },
  syncCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  syncHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  syncStatusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  syncingText: {
    color: '#6366F1',
    fontSize: 12,
  },
  syncDetails: {
    gap: 8,
    marginBottom: 16,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncLabel: {
    color: '#666',
    fontSize: 13,
  },
  syncValue: {
    color: '#999',
    fontSize: 13,
    marginLeft: 'auto',
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366F1',
    padding: 12,
    borderRadius: 8,
  },
  syncBtnDisabled: {
    backgroundColor: '#333',
  },
  syncBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
    marginLeft: 4,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  menuValue: {
    color: '#666',
    fontSize: 14,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },
  syncInfo: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
  },
});
