import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const { autenticar } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const { token, usuario } = await login({ email, senha });
      autenticar(token, usuario);
      navigate("/dashboard");
    } catch (err) {
      setErro(err.response?.data?.erro || "Falha ao entrar");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="container">
      <h1>PulsePay</h1>
      <p>Entrar na sua conta</p>
      <form onSubmit={handleSubmit}>
        <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
        />
        {erro && <span className="erro">{erro}</span>}
        <button type="submit" disabled={carregando}>
          {carregando ? "Entrando..." : "Entrar"}
        </button>
      </form>
      <p style={{ marginTop: 16, fontSize: 14 }}>
        Não tem conta? <Link to="/registrar">Cadastre-se</Link>
      </p>
    </div>
  );
}
