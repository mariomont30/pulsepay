import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("pulsepay_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use((resposta) => resposta, (erro) => {
  if (erro.response?.status === 401 && localStorage.getItem("pulsepay_token")) {
    window.dispatchEvent(new Event("pulsepay:sessao-expirada"));
  }
  return Promise.reject(erro);
});

export const registrar = (dados) => api.post("/auth/registrar", dados).then((r) => r.data);
export const login = (dados) => api.post("/auth/login", dados).then((r) => r.data);
export const consultarSaldo = () => api.get("/contas/saldo").then((r) => r.data);
export const consultarExtrato = (params = {}) => api.get("/contas/extrato", { params }).then((r) => r.data);
export const solicitarTransferencia = (dados) => api.post("/transferencias", dados).then((r) => r.data);
export const consultarTransferencia = (id) => api.get(`/transferencias/${id}`).then((r) => r.data);

export { API_URL };
export default api;
