import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { registrar } from "../services/api";

export default function Register() {
  const [form, setForm] = useState({ nome: "", email: "", cpf: "", senha: "" });
  const [erro, setErro] = useState(null);
  const [sucesso, setSucesso] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const navigate = useNavigate();

  function atualizarCampo(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      await registrar(form);
      setSucesso(true);
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setErro(err.response?.data?.erro || "Falha ao cadastrar");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="container">
      <h1>Criar conta</h1>
      <p>Cadastro fictício (KYC básico) — projeto acadêmico, sem dados reais.</p>
      <form onSubmit={handleSubmit}>
        <input
          placeholder="Nome completo"
          value={form.nome}
          onChange={(e) => atualizarCampo("nome", e.target.value)}
          required
        />
        <input
          type="email"
          placeholder="E-mail"
          value={form.email}
          onChange={(e) => atualizarCampo("email", e.target.value)}
          required
        />
        <input
          placeholder="CPF fictício (somente números, 11 dígitos)"
          value={form.cpf}
          onChange={(e) => atualizarCampo("cpf", e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Senha (mín. 6 caracteres)"
          value={form.senha}
          onChange={(e) => atualizarCampo("senha", e.target.value)}
          required
        />
        {erro && <span className="erro">{erro}</span>}
        {sucesso && <span className="sucesso">Cadastro realizado! Redirecionando...</span>}
        <button type="submit" disabled={carregando}>
          {carregando ? "Cadastrando..." : "Cadastrar"}
        </button>
      </form>
      <p style={{ marginTop: 16, fontSize: 14 }}>
        Já tem conta? <Link to="/login">Entrar</Link>
      </p>
    </div>
  );
}
