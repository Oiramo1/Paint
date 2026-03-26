import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://brush-vault.preview.emergentagent.com';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth APIs
export const authAPI = {
  register: (email: string, password: string, display_name: string) =>
    api.post('/auth/register', { email, password, display_name }),
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  getMe: () => api.get('/auth/me'),
};

// Paint APIs
export const paintAPI = {
  getAll: (params?: { brand?: string; paint_type?: string; category?: string; search?: string }) =>
    api.get('/paints', { params }),
  getById: (id: string) => api.get(`/paints/${id}`),
  getBrands: () => api.get('/paints/brands'),
  getTypes: () => api.get('/paints/types'),
  createCustom: (data: any) => api.post('/paints/custom', data),
  seedPaints: () => api.post('/seed-paints'),
};

// Collection APIs
export const collectionAPI = {
  getAll: (status?: string) => api.get('/collection', { params: status ? { status } : {} }),
  add: (paint_id: string, status: string = 'owned', quantity: number = 1, notes?: string) =>
    api.post('/collection', { paint_id, status, quantity, notes }),
  update: (id: string, data: { status?: string; quantity?: number; notes?: string }) =>
    api.patch(`/collection/${id}`, data),
  remove: (id: string) => api.delete(`/collection/${id}`),
};

// Project APIs
export const projectAPI = {
  getAll: (status?: string) => api.get('/projects', { params: status ? { status } : {} }),
  getById: (id: string) => api.get(`/projects/${id}`),
  create: (data: { name: string; description?: string; image_base64?: string }) =>
    api.post('/projects', data),
  update: (id: string, data: any) => api.patch(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  addPaint: (projectId: string, paint_id: string, is_required: boolean = true, notes?: string) =>
    api.post(`/projects/${projectId}/paints`, { paint_id, is_required, notes }),
  removePaint: (projectId: string, paintId: string) =>
    api.delete(`/projects/${projectId}/paints/${paintId}`),
  getMissingPaints: (projectId: string) => api.get(`/projects/${projectId}/missing-paints`),
};

// Recognition API
export const recognitionAPI = {
  recognize: (image_base64: string) => api.post('/recognize-paint', { image_base64 }),
};

// Paint Equivalents API
export const equivalentsAPI = {
  getEquivalents: (paintId: string, limit: number = 10, sameType: boolean = false) =>
    api.get(`/paints/${paintId}/equivalents`, { params: { limit, same_type: sameType } }),
  getFromCollection: (paintId: string, limit: number = 5) =>
    api.get(`/paints/${paintId}/equivalents-from-collection`, { params: { limit } }),
};

// Barcode API
export const barcodeAPI = {
  findByBarcode: (barcode: string) => api.get(`/barcode/${barcode}`),
  linkBarcode: (barcode: string, paintId: string, notes?: string) =>
    api.post('/barcode/link', { barcode, paint_id: paintId, notes }),
  getAllLinks: (limit: number = 100) => api.get('/barcode/all-links', { params: { limit } }),
};

// Stats API
export const statsAPI = {
  get: () => api.get('/stats'),
};

export default api;
