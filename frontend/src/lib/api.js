import axios from 'axios';
import Cookies from 'js-cookie';

const rawApiBase = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.trim() : '';
const API_URL = rawApiBase ? `${rawApiBase.replace(/\/$/, '')}/api` : '/api';

console.log(API_URL)
const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = Cookies.get('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
