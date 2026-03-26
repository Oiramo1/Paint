import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { recognitionAPI, collectionAPI, barcodeAPI, paintAPI } from '../src/utils/api';
import { Paint, BarcodeResult } from '../src/types';
import { PaintCard } from '../src/components/PaintCard';
import { router } from 'expo-router';

type ScanMode = 'ai' | 'barcode';
type ViewMode = 'camera' | 'result' | 'link-barcode';

export default function Scanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanMode, setScanMode] = useState<ScanMode>('barcode');
  const [viewMode, setViewMode] = useState<ViewMode>('camera');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<{
    recognized: any;
    matches: Paint[];
  } | null>(null);
  const [barcodeResult, setBarcodeResult] = useState<BarcodeResult | null>(null);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [cameraRef, setCameraRef] = useState<CameraView | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  
  // Link barcode state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Paint[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);

  const handleBarcodeScan = async (result: BarcodeScanningResult) => {
    if (!isScanning || viewMode !== 'camera') return;
    
    const barcode = result.data;
    console.log('Scanned barcode:', barcode);
    setIsScanning(false);
    setScannedBarcode(barcode);
    setAnalyzing(true);
    setViewMode('result');
    
    try {
      const response = await barcodeAPI.findByBarcode(barcode);
      setBarcodeResult(response.data);
    } catch (error: any) {
      console.error('Barcode lookup error:', error);
      setBarcodeResult({ found: false, message: 'Error looking up barcode' });
    } finally {
      setAnalyzing(false);
    }
  };

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
    setViewMode('result');
    try {
      const response = await recognitionAPI.recognize(base64);
      console.log('Recognition response:', response.data);
      setAiResult(response.data);
      
      // Check if we got any useful result
      if (!response.data?.recognized && !response.data?.matches?.length) {
        // Show error message but stay on result screen
        setAiResult({
          recognized: {
            brand: 'Unknown',
            name: 'Could not identify',
            paint_type: 'unknown',
            hex_color: '#888888',
            confidence: 0,
            error: response.data?.error || response.data?.raw_response || 'AI could not identify the paint'
          },
          matches: []
        });
      }
    } catch (error: any) {
      console.error('Recognition error:', error);
      // Show error on result screen instead of going back to camera
      setAiResult({
        recognized: {
          brand: 'Error',
          name: 'Recognition Failed',
          paint_type: 'unknown', 
          hex_color: '#FF0000',
          confidence: 0,
          error: error.response?.data?.detail || error.message || 'Failed to analyze image'
        },
        matches: []
      });
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
    setAiResult(null);
    setBarcodeResult(null);
    setScannedBarcode(null);
    setViewMode('camera');
    setIsScanning(true);
    setSearchQuery('');
    setSearchResults([]);
  };

  const startLinkBarcode = () => {
    setViewMode('link-barcode');
    setSearchQuery('');
    setSearchResults([]);
  };

  const searchPaints = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setSearching(true);
    try {
      const response = await paintAPI.getAll({ search: query });
      setSearchResults(response.data.slice(0, 20));
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  const linkBarcodeToPaint = async (paint: Paint) => {
    if (!scannedBarcode) return;
    
    setLinking(true);
    try {
      await barcodeAPI.linkBarcode(scannedBarcode, paint.id);
      Alert.alert(
        'Success!',
        `Barcode linked to ${paint.brand} - ${paint.name}. Other users can now find this paint by scanning!`,
        [{ text: 'OK', onPress: resetScanner }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to link barcode');
    } finally {
      setLinking(false);
    }
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

  // Link barcode view
  if (viewMode === 'link-barcode') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setViewMode('result')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Link Barcode to Paint</Text>
        </View>
        
        <View style={styles.linkContent}>
          <View style={styles.barcodeDisplay}>
            <Ionicons name="barcode" size={24} color="#6366F1" />
            <Text style={styles.barcodeText}>{scannedBarcode}</Text>
          </View>
          
          <Text style={styles.linkInstructions}>
            Search for the paint this barcode belongs to:
          </Text>
          
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search paints..."
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={searchPaints}
              autoFocus
            />
          </View>
          
          {searching && <ActivityIndicator style={styles.searchLoader} color="#6366F1" />}
          
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.paintSearchItem}
                onPress={() => linkBarcodeToPaint(item)}
                disabled={linking}
              >
                <View style={[styles.paintColorDot, { backgroundColor: item.hex_color }]} />
                <View style={styles.paintSearchInfo}>
                  <Text style={styles.paintSearchBrand}>{item.brand}</Text>
                  <Text style={styles.paintSearchName}>{item.name}</Text>
                  <Text style={styles.paintSearchType}>{item.paint_type}</Text>
                </View>
                {linking ? (
                  <ActivityIndicator size="small" color="#6366F1" />
                ) : (
                  <Ionicons name="link" size={20} color="#6366F1" />
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              searchQuery.length >= 2 && !searching ? (
                <Text style={styles.noResults}>No paints found</Text>
              ) : null
            }
            style={styles.searchResultsList}
          />
        </View>
      </View>
    );
  }

  // Result view
  if (viewMode === 'result') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.resultContent}>
        {/* AI Scanner Result */}
        {scanMode === 'ai' && (
          <>
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
            ) : aiResult ? (
              <View style={styles.resultContainer}>
                {aiResult.recognized && (
                  <View style={styles.recognizedCard}>
                    <Text style={styles.recognizedTitle}>AI Recognition Result</Text>
                    <View style={styles.recognizedRow}>
                      <Text style={styles.recognizedLabel}>Brand:</Text>
                      <Text style={styles.recognizedValue}>{aiResult.recognized.brand || 'Unknown'}</Text>
                    </View>
                    <View style={styles.recognizedRow}>
                      <Text style={styles.recognizedLabel}>Name:</Text>
                      <Text style={styles.recognizedValue}>{aiResult.recognized.name || 'Unknown'}</Text>
                    </View>
                    <View style={styles.recognizedRow}>
                      <Text style={styles.recognizedLabel}>Type:</Text>
                      <Text style={styles.recognizedValue}>{aiResult.recognized.paint_type || 'Unknown'}</Text>
                    </View>
                    <View style={styles.recognizedRow}>
                      <Text style={styles.recognizedLabel}>Color:</Text>
                      <View style={styles.colorRow}>
                        <View style={[styles.colorSwatch, { backgroundColor: aiResult.recognized.hex_color || '#888' }]} />
                        <Text style={styles.recognizedValue}>{aiResult.recognized.hex_color || 'Unknown'}</Text>
                      </View>
                    </View>
                    {aiResult.recognized.confidence && (
                      <View style={styles.confidenceContainer}>
                        <Text style={styles.confidenceLabel}>Confidence:</Text>
                        <View style={styles.confidenceBar}>
                          <View
                            style={[
                              styles.confidenceFill,
                              { width: `${(aiResult.recognized.confidence * 100)}%` }
                            ]}
                          />
                        </View>
                        <Text style={styles.confidenceValue}>
                          {Math.round(aiResult.recognized.confidence * 100)}%
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {aiResult.matches && aiResult.matches.length > 0 && (
                  <View style={styles.matchesSection}>
                    <Text style={styles.matchesTitle}>Matching Paints in Database</Text>
                    {aiResult.matches.map((paint) => (
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
          </>
        )}

        {/* Barcode Scanner Result */}
        {scanMode === 'barcode' && (
          <>
            <View style={styles.barcodeResultHeader}>
              <Ionicons name="barcode" size={40} color="#6366F1" />
              <Text style={styles.scannedBarcodeText}>{scannedBarcode}</Text>
            </View>

            {analyzing ? (
              <View style={styles.analyzingContainer}>
                <ActivityIndicator size="large" color="#6366F1" />
                <Text style={styles.analyzingText}>Looking up barcode...</Text>
              </View>
            ) : barcodeResult ? (
              <View style={styles.resultContainer}>
                {barcodeResult.found && barcodeResult.paint ? (
                  <>
                    <View style={styles.foundBadge}>
                      <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                      <Text style={styles.foundText}>Paint Found!</Text>
                    </View>
                    <PaintCard
                      paint={barcodeResult.paint}
                      showActions
                      onAddToCollection={() => addToCollection(barcodeResult.paint!)}
                      onViewEquivalents={() => router.push(`/paint-equivalents?paintId=${barcodeResult.paint!.id}`)}
                    />
                  </>
                ) : (
                  <View style={styles.notFoundContainer}>
                    <Ionicons name="help-circle" size={48} color="#FF9800" />
                    <Text style={styles.notFoundTitle}>Barcode Not Linked</Text>
                    <Text style={styles.notFoundText}>
                      This barcode hasn't been linked to a paint yet. You can help by linking it!
                    </Text>
                    <TouchableOpacity style={styles.linkBtn} onPress={startLinkBarcode}>
                      <Ionicons name="link" size={20} color="#FFF" />
                      <Text style={styles.linkBtnText}>Link to a Paint</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : null}
          </>
        )}

        <TouchableOpacity style={styles.resetBtn} onPress={resetScanner}>
          <Ionicons name="camera" size={20} color="#FFF" />
          <Text style={styles.resetBtnText}>Scan Another</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Camera view
  return (
    <View style={styles.container}>
      {/* Mode Tabs */}
      <View style={styles.modeTabs}>
        <TouchableOpacity
          style={[styles.modeTab, scanMode === 'barcode' && styles.modeTabActive]}
          onPress={() => { setScanMode('barcode'); resetScanner(); }}
        >
          <Ionicons 
            name="barcode" 
            size={20} 
            color={scanMode === 'barcode' ? '#FFF' : '#888'} 
          />
          <Text style={[styles.modeTabText, scanMode === 'barcode' && styles.modeTabTextActive]}>
            Barcode
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, scanMode === 'ai' && styles.modeTabActive]}
          onPress={() => { setScanMode('ai'); resetScanner(); }}
        >
          <Ionicons 
            name="eye" 
            size={20} 
            color={scanMode === 'ai' ? '#FFF' : '#888'} 
          />
          <Text style={[styles.modeTabText, scanMode === 'ai' && styles.modeTabTextActive]}>
            AI Vision
          </Text>
        </TouchableOpacity>
      </View>

      <CameraView
        ref={(ref) => setCameraRef(ref)}
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={scanMode === 'barcode' ? {
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'],
        } : undefined}
        onBarcodeScanned={scanMode === 'barcode' && isScanning ? handleBarcodeScan : undefined}
      >
        <View style={styles.overlay}>
          {scanMode === 'barcode' ? (
            <>
              <View style={styles.barcodeScanFrame} />
              <Text style={styles.scanText}>Position barcode in frame</Text>
              <Text style={styles.scanSubtext}>Supports EAN, UPC, QR codes</Text>
            </>
          ) : (
            <>
              <View style={styles.scanFrame} />
              <Text style={styles.scanText}>Position paint bottle in frame</Text>
            </>
          )}
        </View>
      </CameraView>

      <View style={styles.controls}>
        {scanMode === 'ai' ? (
          <>
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
          </>
        ) : (
          <View style={styles.barcodeHint}>
            <Ionicons name="information-circle" size={24} color="#6366F1" />
            <Text style={styles.barcodeHintText}>
              Point camera at the barcode on the paint bottle
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#1A1A1A',
  },
  backBtn: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
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
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#2A2A2A',
  },
  modeTabActive: {
    backgroundColor: '#6366F1',
  },
  modeTabText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  modeTabTextActive: {
    color: '#FFF',
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
  barcodeScanFrame: {
    width: 300,
    height: 150,
    borderWidth: 2,
    borderColor: '#6366F1',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  scanText: {
    color: '#FFF',
    fontSize: 14,
    marginTop: 20,
  },
  scanSubtext: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
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
  barcodeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  barcodeHintText: {
    color: '#CCC',
    fontSize: 14,
    flex: 1,
  },
  resultContent: {
    padding: 20,
    paddingTop: 60,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 20,
  },
  barcodeResultHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  scannedBarcodeText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 12,
    fontFamily: 'monospace',
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
  foundBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  foundText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
  },
  notFoundContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
  },
  notFoundTitle: {
    color: '#FF9800',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  notFoundText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 32,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
  },
  linkBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
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
  // Link barcode styles
  linkContent: {
    flex: 1,
    padding: 20,
  },
  barcodeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  barcodeText: {
    color: '#FFF',
    fontSize: 18,
    fontFamily: 'monospace',
  },
  linkInstructions: {
    color: '#999',
    fontSize: 14,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
    paddingVertical: 14,
  },
  searchLoader: {
    marginTop: 20,
  },
  searchResultsList: {
    marginTop: 16,
  },
  paintSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  paintColorDot: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  paintSearchInfo: {
    flex: 1,
  },
  paintSearchBrand: {
    color: '#888',
    fontSize: 12,
  },
  paintSearchName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },
  paintSearchType: {
    color: '#6366F1',
    fontSize: 12,
    marginTop: 2,
  },
  noResults: {
    color: '#666',
    textAlign: 'center',
    marginTop: 32,
    fontSize: 14,
  },
});
