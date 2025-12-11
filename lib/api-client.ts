import axios, { AxiosError } from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const instance = axios.create({
  baseURL: API_BASE,
});

let authToken: string | null = null;

// Set auth token from outside (to be called from pages)
export const setAuthToken = (token: string | null) => {
  authToken = token;
};

// Interceptor to add auth token
instance.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// Handle 401
instance.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Clear token and redirect
      authToken = null;
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export const apiClient = {
  // Clients
  async getClients(page = 1, limit = 10) {
    try {
      const res = await instance.get('/api/clients', { params: { page, limit } });
      return res.data.data || [];
    } catch (error) {
      console.error('getClients error:', error);
      return [];
    }
  },

  async createClient(data: any) {
    const res = await instance.post('/api/clients', data);
    return res.data.data;
  },

  // Tasks
  async getTasks(filters?: any) {
    try {
      const res = await instance.get('/api/tasks', { params: filters });
      return res.data.data || { items: [] };
    } catch (error) {
      console.error('getTasks error:', error);
      return { items: [] };
    }
  },

  async approveTask(taskId: string) {
    const res = await instance.post(`/api/tasks/${taskId}/approve`);
    return res.data.data;
  },

  // Reports
  async getReports(filters?: any) {
    try {
      const res = await instance.get('/api/reports', { params: filters });
      return res.data.data || { items: [] };
    } catch (error) {
      console.error('getReports error:', error);
      return { items: [] };
    }
  },

  async createReport(data: any) {
    const res = await instance.post('/api/reports', data);
    return res.data.data;
  },

  async getReport(id: string) {
    const res = await instance.get(`/api/reports/${id}`);
    return res.data.data;
  },

  async updateReport(id: string, data: any) {
    const res = await instance.patch(`/api/reports/${id}`, data);
    return res.data.data;
  },

  async signReport(id: string) {
    const res = await instance.post(`/api/reports/${id}/sign`);
    return res.data.data;
  },

  // DataFeeds
  async getDataFeeds(clientId: string) {
    try {
      const res = await instance.get('/api/datafeeds', { params: { clientId } });
      return res.data.data || { items: [] };
    } catch (error) {
      console.error('getDataFeeds error:', error);
      return { items: [] };
    }
  },

  async createDataFeed(data: any) {
    const res = await instance.post('/api/datafeeds', data);
    return res.data.data;
  },

  async syncDataFeed(feedId: string) {
    const res = await instance.post(`/api/datafeeds/${feedId}/sync`);
    return res.data.data;
  },

  // Health
  async getHealth() {
    try {
      const res = await instance.get('/api/admin/health');
      return res.data.data || res.data;
    } catch (error) {
      console.error('getHealth error:', error);
      return { timestamp: new Date().toISOString(), checks: { database: { status: 'error' }, queue: { status: 'error' } } };
    }
  },
};
