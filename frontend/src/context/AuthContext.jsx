import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { API_URL } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("pulsepay_token"));
  const [usuario, setUsuario] = useState(() => {
    const salvo = localStorage.getItem("pulsepay_usuario");
    return salvo ? JSON.parse(salvo) : null;
  });
  const [notificacoes, setNotificacoes] = useState([]);
  const [socket, setSocket] = useState(null);

  const autenticar = useCallback((novoToken, novoUsuario) => {
    localStorage.setItem("pulsepay_token", novoToken);
    localStorage.setItem("pulsepay_usuario", JSON.stringify(novoUsuario));
    setToken(novoToken);
    setUsuario(novoUsuario);
  }, []);

  const sair = useCallback(() => {
    localStorage.removeItem("pulsepay_token");
    localStorage.removeItem("pulsepay_usuario");
    setToken(null);
    setUsuario(null);
    if (socket) socket.disconnect();
  }, [socket]);

  // Conecta ao WebSocket da API para receber notificações em tempo real
  // quando uma transferência destinada a este usuário é concluída pelo Worker.
  useEffect(() => {
    if (!token) return;

    const novoSocket = io(API_URL, { auth: { token } });
    novoSocket.on("transferencia:concluida", (evento) => {
      setNotificacoes((atual) => [evento, ...atual].slice(0, 10));
    });
    setSocket(novoSocket);

    return () => novoSocket.disconnect();
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, usuario, autenticar, sair, notificacoes }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
