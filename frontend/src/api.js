import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

export function api(token) {
  const instance = axios.create({ baseURL: API_BASE + '/api' });
  instance.interceptors.request.use((config) => {
    if (token?.()) config.headers.Authorization = `Bearer ${token()}`;
    return config;
  });
  return instance;
}
