import { create } from 'zustand';
import { offlineService, OfflineAction } from '../utils/offlineService';
import { paintAPI, collectionAPI, projectAPI } from '../utils/api';
import { Paint, UserPaint, Project } from '../types';

interface OfflineState {
  isOnline: boolean;
  pendingActions: number;
  lastSyncTime: number | null;
  isSyncing: boolean;
  
  // Cached data
  cachedPaints: Paint[];
  cachedCollection: UserPaint[];
  cachedProjects: Project[];
  
  // Actions
  setOnline: (online: boolean) => void;
  loadCachedData: () => Promise<void>;
  syncData: () => Promise<void>;
  processOfflineQueue: () => Promise<{ success: number; failed: number }>;
  
  // Offline-aware operations
  addToCollection: (paint: Paint, status: 'owned' | 'wishlist') => Promise<UserPaint | null>;
  removeFromCollection: (itemId: string) => Promise<boolean>;
  updateCollectionItem: (itemId: string, updates: { status?: string; quantity?: number }) => Promise<boolean>;
  createProject: (name: string, description?: string) => Promise<Project | null>;
  deleteProject: (projectId: string) => Promise<boolean>;
}

export const useOfflineStore = create<OfflineState>((set, get) => ({
  isOnline: true,
  pendingActions: 0,
  lastSyncTime: null,
  isSyncing: false,
  cachedPaints: [],
  cachedCollection: [],
  cachedProjects: [],

  setOnline: (online: boolean) => set({ isOnline: online }),

  loadCachedData: async () => {
    const [paints, collection, projects, lastSync, queue] = await Promise.all([
      offlineService.getCachedPaints(),
      offlineService.getCachedCollection(),
      offlineService.getCachedProjects(),
      offlineService.getLastSyncTime(),
      offlineService.getOfflineQueue(),
    ]);
    
    set({
      cachedPaints: paints,
      cachedCollection: collection,
      cachedProjects: projects,
      lastSyncTime: lastSync,
      pendingActions: queue.length,
    });
  },

  syncData: async () => {
    const { isOnline } = get();
    if (!isOnline) return;

    set({ isSyncing: true });
    
    try {
      // Fetch fresh data from server
      const [paintsRes, collectionRes, projectsRes] = await Promise.all([
        paintAPI.getAll().catch(() => null),
        collectionAPI.getAll().catch(() => null),
        projectAPI.getAll().catch(() => null),
      ]);

      if (paintsRes?.data) {
        await offlineService.cachePaints(paintsRes.data);
        set({ cachedPaints: paintsRes.data });
      }

      if (collectionRes?.data) {
        await offlineService.cacheCollection(collectionRes.data);
        set({ cachedCollection: collectionRes.data });
      }

      if (projectsRes?.data) {
        await offlineService.cacheProjects(projectsRes.data);
        set({ cachedProjects: projectsRes.data });
      }

      await offlineService.setLastSyncTime();
      set({ lastSyncTime: Date.now() });
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      set({ isSyncing: false });
    }
  },

  processOfflineQueue: async () => {
    const { isOnline } = get();
    if (!isOnline) return { success: 0, failed: 0 };

    set({ isSyncing: true });
    const queue = await offlineService.getOfflineQueue();
    let success = 0;
    let failed = 0;

    for (const action of queue) {
      try {
        switch (action.type) {
          case 'add_to_collection':
            await collectionAPI.add(
              action.payload.paint_id,
              action.payload.status,
              action.payload.quantity || 1
            );
            break;
          case 'remove_from_collection':
            await collectionAPI.remove(action.payload.itemId);
            break;
          case 'update_collection':
            await collectionAPI.update(action.payload.itemId, action.payload.updates);
            break;
          case 'create_project':
            await projectAPI.create(action.payload);
            break;
          case 'delete_project':
            await projectAPI.delete(action.payload.projectId);
            break;
          case 'add_paint_to_project':
            await projectAPI.addPaint(
              action.payload.projectId,
              action.payload.paintId,
              action.payload.isRequired
            );
            break;
          case 'remove_paint_from_project':
            await projectAPI.removePaint(
              action.payload.projectId,
              action.payload.paintId
            );
            break;
        }
        await offlineService.removeFromQueue(action.id);
        success++;
      } catch (error) {
        console.error('Failed to process action:', action.type, error);
        failed++;
      }
    }

    // Refresh data after processing queue
    await get().syncData();
    
    const newQueue = await offlineService.getOfflineQueue();
    set({ pendingActions: newQueue.length, isSyncing: false });

    return { success, failed };
  },

  addToCollection: async (paint: Paint, status: 'owned' | 'wishlist') => {
    const { isOnline, cachedCollection } = get();

    if (isOnline) {
      try {
        const response = await collectionAPI.add(paint.id, status);
        const newItem = response.data;
        
        // Update cache
        const updated = [...cachedCollection, newItem];
        await offlineService.cacheCollection(updated);
        set({ cachedCollection: updated });
        
        return newItem;
      } catch (error) {
        console.error('Failed to add to collection:', error);
        return null;
      }
    } else {
      // Offline: add locally and queue
      const localItem = await offlineService.addToCollectionLocally(paint, status);
      await offlineService.addToOfflineQueue({
        type: 'add_to_collection',
        payload: { paint_id: paint.id, status, quantity: 1 },
      });
      
      const queue = await offlineService.getOfflineQueue();
      set({ 
        cachedCollection: [...cachedCollection, localItem],
        pendingActions: queue.length 
      });
      
      return localItem;
    }
  },

  removeFromCollection: async (itemId: string) => {
    const { isOnline, cachedCollection } = get();

    // Update local cache immediately
    const updated = cachedCollection.filter(c => c.id !== itemId);
    await offlineService.cacheCollection(updated);
    set({ cachedCollection: updated });

    if (isOnline) {
      try {
        await collectionAPI.remove(itemId);
        return true;
      } catch (error) {
        console.error('Failed to remove from collection:', error);
        // Revert local change on failure
        await offlineService.cacheCollection(cachedCollection);
        set({ cachedCollection });
        return false;
      }
    } else {
      // Queue for later sync
      await offlineService.addToOfflineQueue({
        type: 'remove_from_collection',
        payload: { itemId },
      });
      const queue = await offlineService.getOfflineQueue();
      set({ pendingActions: queue.length });
      return true;
    }
  },

  updateCollectionItem: async (itemId: string, updates: { status?: string; quantity?: number }) => {
    const { isOnline, cachedCollection } = get();

    // Update local cache immediately
    const updated = cachedCollection.map(c => 
      c.id === itemId ? { 
        ...c, 
        ...(updates.status && { status: updates.status as 'owned' | 'wishlist' }),
        ...(updates.quantity !== undefined && { quantity: updates.quantity }),
        updated_at: new Date().toISOString() 
      } : c
    );
    await offlineService.cacheCollection(updated);
    set({ cachedCollection: updated });

    if (isOnline) {
      try {
        await collectionAPI.update(itemId, updates);
        return true;
      } catch (error) {
        console.error('Failed to update collection:', error);
        return false;
      }
    } else {
      await offlineService.addToOfflineQueue({
        type: 'update_collection',
        payload: { itemId, updates },
      });
      const queue = await offlineService.getOfflineQueue();
      set({ pendingActions: queue.length });
      return true;
    }
  },

  createProject: async (name: string, description?: string) => {
    const { isOnline, cachedProjects } = get();

    if (isOnline) {
      try {
        const response = await projectAPI.create({ name, description });
        const newProject = response.data;
        
        const updated = [...cachedProjects, newProject];
        await offlineService.cacheProjects(updated);
        set({ cachedProjects: updated });
        
        return newProject;
      } catch (error) {
        console.error('Failed to create project:', error);
        return null;
      }
    } else {
      const localProject = await offlineService.addProjectLocally(name, description);
      await offlineService.addToOfflineQueue({
        type: 'create_project',
        payload: { name, description },
      });
      
      const queue = await offlineService.getOfflineQueue();
      set({ 
        cachedProjects: [...cachedProjects, localProject],
        pendingActions: queue.length 
      });
      
      return localProject;
    }
  },

  deleteProject: async (projectId: string) => {
    const { isOnline, cachedProjects } = get();

    const updated = cachedProjects.filter(p => p.id !== projectId);
    await offlineService.cacheProjects(updated);
    set({ cachedProjects: updated });

    if (isOnline) {
      try {
        await projectAPI.delete(projectId);
        return true;
      } catch (error) {
        console.error('Failed to delete project:', error);
        await offlineService.cacheProjects(cachedProjects);
        set({ cachedProjects });
        return false;
      }
    } else {
      await offlineService.addToOfflineQueue({
        type: 'delete_project',
        payload: { projectId },
      });
      const queue = await offlineService.getOfflineQueue();
      set({ pendingActions: queue.length });
      return true;
    }
  },
}));
