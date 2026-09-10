import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { consultarSaldo, consultarExtrato } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { usuario, sair, notificacoes } = useAuth();
  const [saldo, setSaldo] = useState(null);
  const [extrato, setExtrato] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const navigate = useNavigate();

  async function carregarDados() {
    setCarregando(true);
    const [dadosSaldo, dadosExtrato] = await Promise.all([consultarSaldo(), consultarExtrato()]);
    setSaldo(dadosSaldo);
    setExtrato(dadosExtrato);
    setCarregando(false);
  }

  useEffect(() => {
    carregarDados();
  }, []);

  // Sempre que uma notificação de transferência concluída chega via WebSocket,
  // recarrega saldo e extrato para refletir o novo estado.
  useEffect(() => {
    if (notificacoes.length > 0) {
      carregarDados();
    }
  }, [notificacoes]);

  function handleSair() {
    sair();
    navigate("/login");
  }

  if (carregando) return <div className="container">Carregando...</div>;

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <div className="top-bar">
        <div>
          <h2>Olá, {usuario?.nome}</h2>
          <p style={{ margin: 0, color: "#666" }}>Conta #{saldo?.contaId?.slice(0, 8)}</p>
        </div>
        <button className="link-secundario" onClick={handleSair}>
          Sair
        </button>
      </div>

      <p style={{ marginBottom: 4 }}>Saldo disponível</p>
      <div className="saldo">
        R$ {Number(saldo?.saldo).toFixed(2)}
      </div>

      <Link to="/transferencia">
        <button>Nova transferência</button>
      </Link>

      {notificacoes.length > 0 && (
        <div style={{ marginTop: 16, background: "#eef2ff", padding: 12, borderRadius: 8 }}>
          <strong>Notificações recentes:</strong>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 14 }}>
            {notificacoes.map((n) => (
              <li key={n.transacaoId}>Você recebeu R$ {Number(n.valor).toFixed(2)}</li>
            ))}
          </ul>
        </div>
      )}

      <h3 style={{ marginTop: 24 }}>Extrato</h3>
      <table>
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Valor</th>
            <th>Status</th>
            <th>Data</th>
          </tr>
        </thead>
        <tbody>
          {extrato.map((t) => (
            <tr key={t.id}>
              <td>{t.tipo}</td>
              <td>R$ {Number(t.valor).toFixed(2)}</td>
              <td>
                <span className={`badge ${t.status}`}>{t.status}</span>
              </td>
              <td>{new Date(t.criadoEm).toLocaleString("pt-BR")}</td>
            </tr>
          ))}
          {extrato.length === 0 && (
            <tr>
              <td colSpan={4}>Nenhuma transação ainda.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
