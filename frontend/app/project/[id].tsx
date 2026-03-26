import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { projectAPI, paintAPI } from '../../src/utils/api';
import { Project, Paint } from '../../src/types';
import { PaintCard } from '../../src/components/PaintCard';

export default function ProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [projectPaints, setProjectPaints] = useState<Paint[]>([]);
  const [missingPaints, setMissingPaints] = useState<Paint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProject = async () => {
    try {
      const [projectRes, missingRes] = await Promise.all([
        projectAPI.getById(id),
        projectAPI.getMissingPaints(id),
      ]);
      
      setProject(projectRes.data);
      setMissingPaints(missingRes.data.missing_paints?.map((m: any) => m.paint) || []);

      // Fetch paint details for project paints
      const paintPromises = projectRes.data.paints.map(async (p: any) => {
        try {
          const paintRes = await paintAPI.getById(p.paint_id);
          return { ...paintRes.data, is_owned: p.is_owned, is_required: p.is_required };
        } catch {
          return null;
        }
      });
      
      const paints = await Promise.all(paintPromises);
      setProjectPaints(paints.filter(Boolean));
    } catch (error) {
      console.error('Error fetching project:', error);
      Alert.alert('Error', 'Failed to load project');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProject();
    }, [id])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchProject();
  };

  const handleRemovePaint = async (paintId: string) => {
    Alert.alert(
      'Remove Paint',
      'Remove this paint from the project?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await projectAPI.removePaint(id, paintId);
              fetchProject();
            } catch (error) {
              Alert.alert('Error', 'Failed to remove paint');
            }
          },
        },
      ]
    );
  };

  const handleDeleteProject = () => {
    Alert.alert(
      'Delete Project',
      'Are you sure you want to delete this project? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await projectAPI.delete(id);
              router.back();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete project');
            }
          },
        },
      ]
    );
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await projectAPI.update(id, { status: newStatus });
      fetchProject();
    } catch (error) {
      Alert.alert('Error', 'Failed to update project status');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (!project) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Project not found</Text>
      </View>
    );
  }

  const ownedCount = projectPaints.filter((p: any) => p.is_owned).length;
  const totalCount = projectPaints.length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
      }
    >
      {project.image_base64 && (
        <Image
          source={{ uri: `data:image/jpeg;base64,${project.image_base64}` }}
          style={styles.projectImage}
        />
      )}

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.projectName}>{project.name}</Text>
          {project.description && (
            <Text style={styles.projectDesc}>{project.description}</Text>
          )}
        </View>
        <TouchableOpacity onPress={handleDeleteProject}>
          <Ionicons name="trash-outline" size={24} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <View style={styles.statusSection}>
        <Text style={styles.sectionTitle}>Status</Text>
        <View style={styles.statusButtons}>
          {['active', 'completed', 'archived'].map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.statusBtn,
                project.status === status && styles.statusBtnActive,
              ]}
              onPress={() => handleStatusChange(status)}
            >
              <Text
                style={[
                  styles.statusBtnText,
                  project.status === status && styles.statusBtnTextActive,
                ]}
              >
                {status}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalCount}</Text>
          <Text style={styles.statLabel}>Total Paints</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#4CAF50' }]}>{ownedCount}</Text>
          <Text style={styles.statLabel}>Owned</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#FF9800' }]}>{missingPaints.length}</Text>
          <Text style={styles.statLabel}>Missing</Text>
        </View>
      </View>

      {missingPaints.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="alert-circle" size={20} color="#FF9800" />
            <Text style={[styles.sectionTitle, { color: '#FF9800' }]}>Missing Paints</Text>
          </View>
          {missingPaints.map((paint: Paint) => (
            <PaintCard key={paint.id} paint={paint} />
          ))}
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="color-fill" size={20} color="#6366F1" />
          <Text style={styles.sectionTitle}>Project Paints ({totalCount})</Text>
        </View>
        
        {projectPaints.length === 0 ? (
          <View style={styles.emptyPaints}>
            <Ionicons name="color-palette-outline" size={48} color="#333" />
            <Text style={styles.emptyPaintsText}>No paints added yet</Text>
          </View>
        ) : (
          projectPaints.map((paint: any) => (
            <TouchableOpacity
              key={paint.id}
              onLongPress={() => handleRemovePaint(paint.id)}
            >
              <PaintCard
                paint={paint}
                isOwned={paint.is_owned}
              />
            </TouchableOpacity>
          ))
        )}
      </View>

      <TouchableOpacity
        style={styles.addPaintsBtn}
        onPress={() => router.push({ pathname: '/project/add-paints', params: { projectId: id } })}
      >
        <Ionicons name="add" size={20} color="#FFF" />
        <Text style={styles.addPaintsBtnText}>Add Paints to Project</Text>
      </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0F0F',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0F0F',
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
  },
  projectImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerLeft: {
    flex: 1,
    marginRight: 16,
  },
  projectName: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  projectDesc: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
  },
  statusSection: {
    marginBottom: 20,
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E1E1E',
  },
  statusBtnActive: {
    backgroundColor: '#6366F1',
  },
  statusBtnText: {
    color: '#999',
    fontSize: 13,
    textTransform: 'capitalize',
  },
  statusBtnTextActive: {
    color: '#FFFFFF',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#333',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  emptyPaints: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
  },
  emptyPaintsText: {
    color: '#666',
    fontSize: 14,
    marginTop: 12,
  },
  addPaintsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366F1',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  addPaintsBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
