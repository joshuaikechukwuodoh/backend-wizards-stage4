import axios from 'axios';
import { getCredentials, saveCredentials, clearCredentials } from './config';

const BASE_URL = process.env.INSIGHTA_API_URL || 'https://backend-wizards-stage3.vercel.app/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
});

api.interceptors.request.use((config) => {
  const creds = getCredentials();
  if (creds?.access_token) {
    config.headers.Authorization = `Bearer ${creds.access_token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const creds = getCredentials();
      if (creds?.refresh_token) {
        try {
          const res = await axios.post(`${BASE_URL}/auth/refresh`, {
            refresh_token: creds.refresh_token,
          });
          const newCreds = { ...creds, access_token: res.data.access_token };
          saveCredentials(newCreds);
          originalRequest.headers.Authorization = `Bearer ${newCreds.access_token}`;
          return api(originalRequest);
        } catch (refreshError) {
          clearCredentials();
          console.error('Session expired. Please login again.');
        }
      }
    }
    return Promise.reject(error);
  }
);
