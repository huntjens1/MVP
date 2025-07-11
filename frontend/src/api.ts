import axios, { type AxiosInstance } from "axios";

const apiBase = import.meta.env.VITE_API_BASE || "";

const api: AxiosInstance = axios.create({ baseURL: apiBase });

// Interceptor: JWT-token automatisch meesturen
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("jwt");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
