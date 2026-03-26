import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { recognitionAPI, collectionAPI } from '../src/utils/api';
import { Paint } from '../src/types';
import { PaintCard } from '../src/components/PaintCard';

export default function Scanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<'camera' | 'gallery' | 'result'>('camera');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<{
    recognized: any;
    matches: Paint[];
  } | null>(null);
  const [cameraRef, setCameraRef] = useState<CameraView | null>(null);

  const takePicture = async () => {
    if (cameraRef) {
      try {
        const photo = await cameraRef.takePictureAsync({ base64: true, quality: 0.5 });
        if (photo?.base64) {
          setCapturedImage(photo.base64);
          analyzeImage(photo.base64);
        }
      } catch (error) {
        console.error('Error taking picture:', error);
        Alert.alert('Error', 'Failed to take picture');
      }
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0].base64) {
      setCapturedImage(result.assets[0].base64);
      analyzeImage(result.assets[0].base64);
    }
  };

  const analyzeImage = async (base64: string) => {
    setAnalyzing(true);
    setMode('result');
    try {
      const response = await recognitionAPI.recognize(base64);
      setResult(response.data);
    } catch (error: any) {
      console.error('Recognition error:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to analyze image');
      setMode('camera');
    } finally {
      setAnalyzing(false);
    }
  };

  const addToCollection = async (paint: Paint) => {
    try {
      await collectionAPI.add(paint.id, 'owned');
      Alert.alert('Success', `${paint.name} added to collection!`);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to add paint');
    }
  };

  const resetScanner = () => {
    setCapturedImage(null);
    setResult(null);
    setMode('camera');
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={64} color="#666" />
        <Text style={styles.permissionTitle}>Camera Permission Required</Text>
        <Text style={styles.permissionText}>
          We need camera access to scan your paints
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.galleryBtn} onPress={pickImage}>
          <Ionicons name="images" size={20} color="#6366F1" />
          <Text style={styles.galleryBtnText}>Choose from Gallery</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (mode === 'result') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.resultContent}>
        {capturedImage && (
          <Image
            source={{ uri: `data:image/jpeg;base64,${capturedImage}` }}
            style={styles.previewImage}
          />
        )}

        {analyzing ? (
          <View style={styles.analyzingContainer}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.analyzingText}>Analyzing paint...</Text>
            <Text style={styles.analyzingSubtext}>Using AI to identify brand and color</Text>
          </View>
        ) : result ? (
          <View style={styles.resultContainer}>
            {result.recognized && (
              <View style={styles.recognizedCard}>
                <Text style={styles.recognizedTitle}>AI Recognition Result</Text>
                <View style={styles.recognizedRow}>
                  <Text style={styles.recognizedLabel}>Brand:</Text>
                  <Text style={styles.recognizedValue}>{result.recognized.brand || 'Unknown'}</Text>
                </View>
                <View style={styles.recognizedRow}>
                  <Text style={styles.recognizedLabel}>Name:</Text>
                  <Text style={styles.recognizedValue}>{result.recognized.name || 'Unknown'}</Text>
                </View>
                <View style={styles.recognizedRow}>
                  <Text style={styles.recognizedLabel}>Type:</Text>
                  <Text style={styles.recognizedValue}>{result.recognized.paint_type || 'Unknown'}</Text>
                </View>
                <View style={styles.recognizedRow}>
                  <Text style={styles.recognizedLabel}>Color:</Text>
                  <View style={styles.colorRow}>
                    <View style={[styles.colorSwatch, { backgroundColor: result.recognized.hex_color || '#888' }]} />
                    <Text style={styles.recognizedValue}>{result.recognized.hex_color || 'Unknown'}</Text>
                  </View>
                </View>
                {result.recognized.confidence && (
                  <View style={styles.confidenceContainer}>
                    <Text style={styles.confidenceLabel}>Confidence:</Text>
                    <View style={styles.confidenceBar}>
                      <View
                        style={[
                          styles.confidenceFill,
                          { width: `${(result.recognized.confidence * 100)}%` }
                        ]}
                      />
                    </View>
                    <Text style={styles.confidenceValue}>
                      {Math.round(result.recognized.confidence * 100)}%
                    </Text>
                  </View>
                )}
              </View>
            )}

            {result.matches && result.matches.length > 0 && (
              <View style={styles.matchesSection}>
                <Text style={styles.matchesTitle}>Matching Paints in Database</Text>
                {result.matches.map((paint) => (
                  <PaintCard
                    key={paint.id}
                    paint={paint}
                    showActions
                    onAddToCollection={() => addToCollection(paint)}
                  />
                ))}
              </View>
            )}
          </View>
        ) : null}

        <TouchableOpacity style={styles.resetBtn} onPress={resetScanner}>
          <Ionicons name="camera" size={20} color="#FFF" />
          <Text style={styles.resetBtnText}>Scan Another</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={(ref) => setCameraRef(ref)}
        style={styles.camera}
        facing="back"
      >
        <View style={styles.overlay}>
          <View style={styles.scanFrame} />
          <Text style={styles.scanText}>Position paint bottle in frame</Text>
        </View>
      </CameraView>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlBtn} onPress={pickImage}>
          <Ionicons name="images" size={28} color="#FFF" />
          <Text style={styles.controlText}>Gallery</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.captureBtn} onPress={takePicture}>
          <View style={styles.captureBtnInner} />
        </TouchableOpacity>

        <View style={styles.controlBtn}>
          <Ionicons name="flash-off" size={28} color="#666" />
          <Text style={[styles.controlText, { color: '#666' }]}>Flash</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#0F0F0F',
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
  },
  permissionText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  permissionBtn: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  permissionBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  galleryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  galleryBtnText: {
    color: '#6366F1',
    fontSize: 16,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#6366F1',
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  scanText: {
    color: '#FFF',
    fontSize: 14,
    marginTop: 20,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: '#1A1A1A',
  },
  controlBtn: {
    alignItems: 'center',
    width: 70,
  },
  controlText: {
    color: '#FFF',
    fontSize: 12,
    marginTop: 4,
  },
  captureBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureBtnInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF',
  },
  resultContent: {
    padding: 20,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 20,
  },
  analyzingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  analyzingText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  analyzingSubtext: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
  },
  resultContainer: {
    gap: 20,
  },
  recognizedCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 20,
  },
  recognizedTitle: {
    color: '#6366F1',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
  },
  recognizedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recognizedLabel: {
    color: '#999',
    fontSize: 14,
  },
  recognizedValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorSwatch: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  confidenceLabel: {
    color: '#999',
    fontSize: 12,
  },
  confidenceBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  confidenceValue: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
  },
  matchesSection: {
    gap: 12,
  },
  matchesTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366F1',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  resetBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
