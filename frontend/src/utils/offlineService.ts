import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Paint, UserPaint, Project } from '../types';

const CACHE_KEYS = {
  PAINTS: 'cache_paints',
  COLLECTION: 'cache_collection',
  PROJECTS: 'cache_projects',
  OFFLINE_QUEUE: 'offline_queue',
  LAST_SYNC: 'last_sync',
};

export interface OfflineAction {
  id: string;
  type: 'add_to_collection' | 'remove_from_collection' | 'update_collection' | 
        'create_project' | 'update_project' | 'delete_project' | 
        'add_paint_to_project' | 'remove_paint_from_project' | 'create_custom_paint';
  payload: any;
  timestamp: number;
}

class OfflineService {
  private isOnline: boolean = true;
  private listeners: ((online: boolean) => void)[] = [];

  constructor() {
    this.initNetworkListener();
  }

  private initNetworkListener() {
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;
      
      // Notify listeners
      this.listeners.forEach(listener => listener(this.isOnline));
      
      // If we just came back online, process queue
      if (!wasOnline && this.isOnline) {
        console.log('Back online - processing offline queue');
        this.processOfflineQueue();
      }
    });
  }

  addNetworkListener(callback: (online: boolean) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  async checkOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    this.isOnline = state.isConnected ?? false;
    return this.isOnline;
  }

  getIsOnline(): boolean {
    return this.isOnline;
  }

  // ============== Cache Methods ==============

  async cachePaints(paints: Paint[]): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.PAINTS, JSON.stringify(paints));
      console.log(`Cached ${paints.length} paints`);
    } catch (error) {
      console.error('Error caching paints:', error);
    }
  }

  async getCachedPaints(): Promise<Paint[]> {
    try {
      const data = await AsyncStorage.getItem(CACHE_KEYS.PAINTS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting cached paints:', error);
      return [];
    }
  }

  async cacheCollection(collection: UserPaint[]): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.COLLECTION, JSON.stringify(collection));
      console.log(`Cached ${collection.length} collection items`);
    } catch (error) {
      console.error('Error caching collection:', error);
    }
  }

  async getCachedCollection(): Promise<UserPaint[]> {
    try {
      const data = await AsyncStorage.getItem(CACHE_KEYS.COLLECTION);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting cached collection:', error);
      return [];
    }
  }

  async cacheProjects(projects: Project[]): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.PROJECTS, JSON.stringify(projects));
      console.log(`Cached ${projects.length} projects`);
    } catch (error) {
      console.error('Error caching projects:', error);
    }
  }

  async getCachedProjects(): Promise<Project[]> {
    try {
      const data = await AsyncStorage.getItem(CACHE_KEYS.PROJECTS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting cached projects:', error);
      return [];
    }
  }

  // ============== Offline Queue Methods ==============

  async addToOfflineQueue(action: Omit<OfflineAction, 'id' | 'timestamp'>): Promise<void> {
    try {
      const queue = await this.getOfflineQueue();
      const newAction: OfflineAction = {
        ...action,
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
      };
      queue.push(newAction);
      await AsyncStorage.setItem(CACHE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
      console.log('Added to offline queue:', newAction.type);
    } catch (error) {
      console.error('Error adding to offline queue:', error);
    }
  }

  async getOfflineQueue(): Promise<OfflineAction[]> {
    try {
      const data = await AsyncStorage.getItem(CACHE_KEYS.OFFLINE_QUEUE);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting offline queue:', error);
      return [];
    }
  }

  async clearOfflineQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.OFFLINE_QUEUE, JSON.stringify([]));
    } catch (error) {
      console.error('Error clearing offline queue:', error);
    }
  }

  async removeFromQueue(actionId: string): Promise<void> {
    try {
      const queue = await this.getOfflineQueue();
      const filtered = queue.filter(a => a.id !== actionId);
      await AsyncStorage.setItem(CACHE_KEYS.OFFLINE_QUEUE, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error removing from queue:', error);
    }
  }

  async processOfflineQueue(): Promise<{ success: number; failed: number }> {
    // This will be called by the app when it detects it's back online
    // The actual processing is done in the useOfflineSync hook
    const queue = await this.getOfflineQueue();
    console.log(`Processing ${queue.length} offline actions`);
    return { success: 0, failed: 0 };
  }

  // ============== Optimistic Updates for Local Cache ==============

  async addToCollectionLocally(paint: Paint, status: 'owned' | 'wishlist'): Promise<UserPaint> {
    const collection = await this.getCachedCollection();
    const newItem: UserPaint = {
      id: `local_${Date.now()}`,
      user_id: 'local',
      paint_id: paint.id,
      paint: paint,
      status: status,
      quantity: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    collection.push(newItem);
    await this.cacheCollection(collection);
    return newItem;
  }

  async removeFromCollectionLocally(itemId: string): Promise<void> {
    const collection = await this.getCachedCollection();
    const filtered = collection.filter(c => c.id !== itemId);
    await this.cacheCollection(filtered);
  }

  async updateCollectionLocally(itemId: string, updates: Partial<UserPaint>): Promise<void> {
    const collection = await this.getCachedCollection();
    const index = collection.findIndex(c => c.id === itemId);
    if (index !== -1) {
      collection[index] = { ...collection[index], ...updates, updated_at: new Date().toISOString() };
      await this.cacheCollection(collection);
    }
  }

  async addProjectLocally(name: string, description?: string): Promise<Project> {
    const projects = await this.getCachedProjects();
    const newProject: Project = {
      id: `local_${Date.now()}`,
      user_id: 'local',
      name,
      description,
      status: 'active',
      paints: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    projects.push(newProject);
    await this.cacheProjects(projects);
    return newProject;
  }

  async deleteProjectLocally(projectId: string): Promise<void> {
    const projects = await this.getCachedProjects();
    const filtered = projects.filter(p => p.id !== projectId);
    await this.cacheProjects(filtered);
  }

  // ============== Sync Status ==============

  async getLastSyncTime(): Promise<number | null> {
    try {
      const data = await AsyncStorage.getItem(CACHE_KEYS.LAST_SYNC);
      return data ? parseInt(data) : null;
    } catch (error) {
      return null;
    }
  }

  async setLastSyncTime(): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.LAST_SYNC, Date.now().toString());
    } catch (error) {
      console.error('Error setting last sync time:', error);
    }
  }

  async clearAllCache(): Promise<void> {
    try {
      const keysToRemove = [
        CACHE_KEYS.PAINTS,
        CACHE_KEYS.COLLECTION,
        CACHE_KEYS.PROJECTS,
        CACHE_KEYS.OFFLINE_QUEUE,
        CACHE_KEYS.LAST_SYNC,
      ];
      await Promise.all(keysToRemove.map(key => AsyncStorage.removeItem(key)));
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }
}

export const offlineService = new OfflineService();
