import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Project } from '../types';

interface ProjectCardProps {
  project: Project;
  onPress: () => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onPress }) => {
  const ownedCount = project.paints.filter(p => p.is_owned).length;
  const totalCount = project.paints.length;
  const missingCount = project.paints.filter(p => p.is_required && !p.is_owned).length;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.imageContainer}>
        {project.image_base64 ? (
          <Image
            source={{ uri: `data:image/jpeg;base64,${project.image_base64}` }}
            style={styles.image}
          />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="color-palette" size={32} color="#666" />
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{project.name}</Text>
        {project.description && (
          <Text style={styles.description} numberOfLines={2}>{project.description}</Text>
        )}
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Ionicons name="color-fill" size={14} color="#4CAF50" />
            <Text style={styles.statText}>{ownedCount}/{totalCount} paints</Text>
          </View>
          {missingCount > 0 && (
            <View style={styles.stat}>
              <Ionicons name="alert-circle" size={14} color="#FF9800" />
              <Text style={[styles.statText, { color: '#FF9800' }]}>{missingCount} missing</Text>
            </View>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#666" />
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
    marginBottom: 12,
  },
  imageContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  description: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  stats: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: '#999',
    fontSize: 12,
  },
});
