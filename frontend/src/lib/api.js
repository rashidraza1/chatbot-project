import axios from 'axios';
import Cookies from 'js-cookie';

// Use same-origin relative '/api' path in browser, with fallback for SSR
const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = Cookies.get('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
