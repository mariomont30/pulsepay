import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { solicitarTransferencia, consultarTransferencia } from "../services/api";
import { formatarMoeda } from "../utils/moeda";

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
      for (let tentativa = 0; tentativa < 60; tentativa++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        const atual = await consultarTransferencia(dados.id);
        setResultado(atual);
        if (atual.status !== "PENDENTE") break;
      }
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
        Informe o e-mail do destinatário e o valor. Acompanhe a confirmação abaixo.
      </p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="destinatario">E-mail do destinatário</label>
        <input id="destinatario"
          type="email"
          placeholder="E-mail do destinatário"
          value={emailDestino}
          onChange={(e) => setEmailDestino(e.target.value)}
          required
        />
        <label htmlFor="valor">Valor em reais</label>
        <input id="valor"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="Valor (R$)"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          required
        />
        {erro && <span className="erro" role="alert">{erro}</span>}
        {resultado && (
          <span className={resultado.status === "FALHOU" ? "erro" : "sucesso"} role="status" aria-live="polite">
            {resultado.status === "CONCLUIDO" ? `Transferência de ${formatarMoeda(valor)} concluída.` : resultado.status === "FALHOU" ? `Transferência não concluída: ${resultado.motivoFalha || "verifique o extrato"}.` : "Solicitação recebida. Aguardando confirmação."}
            {" "}Status: {resultado.status}. Identificador: {resultado.id.slice(0, 8)}
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
