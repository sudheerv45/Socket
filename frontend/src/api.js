// import axios from 'axios';

// export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

// export function api(token) {
//   const instance = axios.create({ baseURL: API_BASE + '/api' });
//   instance.interceptors.request.use((config) => {
//     if (token?.()) config.headers.Authorization = `Bearer ${token()}`;
//     return config;
//   });
//   return instance;
// }

import axios from "axios";

// If deployed, use VITE_API_URL. If local, use relative path (proxy handles it)
export const API_BASE =
  import.meta.env.VITE_API_URL || ""; // "" means same origin, works with Vite proxy

export function api(getToken) {
  const instance = axios.create({
    baseURL: API_BASE + "/api",
    withCredentials: true,
  });

  instance.interceptors.request.use((config) => {
    const token = getToken?.();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  return instance;
}
