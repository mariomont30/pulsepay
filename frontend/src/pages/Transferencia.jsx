import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { solicitarTransferencia } from "../services/api";

export default function Transferencia() {
  const [emailDestino, setEmailDestino] = useState("");
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setErro(null);
    setResultado(null);
    setCarregando(true);
    try {
      const dados = await solicitarTransferencia({ emailDestino, valor: Number(valor) });
      setResultado(dados);
    } catch (err) {
      setErro(err.response?.data?.erro || "Falha ao solicitar transferência");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="container">
      <h1>Nova transferência</h1>
      <p style={{ color: "#666", fontSize: 14 }}>
        Informe o e-mail cadastrado do destinatário (não é preciso saber o UUID da conta dele).
        A confirmação é assíncrona: a resposta abaixo indica que a solicitação foi recebida
        (status <strong>PENDENTE</strong>); o Worker efetiva o débito/crédito em seguida.
      </p>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="E-mail do destinatário"
          value={emailDestino}
          onChange={(e) => setEmailDestino(e.target.value)}
          required
        />
        <input
          type="number"
          step="0.01"
          min="0.01"
          placeholder="Valor (R$)"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          required
        />
        {erro && <span className="erro">{erro}</span>}
        {resultado && (
          <span className="sucesso">
            Solicitação recebida! Status: {resultado.status} (ID: {resultado.id.slice(0, 8)})
          </span>
        )}
        <button type="submit" disabled={carregando}>
          {carregando ? "Enviando..." : "Transferir"}
        </button>
      </form>
      <button className="link-secundario" style={{ marginTop: 16 }} onClick={() => navigate("/dashboard")}>
        Voltar ao dashboard
      </button>
    </div>
  );
}
