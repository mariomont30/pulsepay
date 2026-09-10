import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Transferencia from "./pages/Transferencia";
import { useAuth } from "./context/AuthContext";

function RotaProtegida({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/registrar" element={<Register />} />
      <Route
        path="/dashboard"
        element={
          <RotaProtegida>
            <Dashboard />
          </RotaProtegida>
        }
      />
      <Route
        path="/transferencia"
        element={
          <RotaProtegida>
            <Transferencia />
          </RotaProtegida>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
