import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { consultarSaldo, consultarExtrato } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { usuario, sair, notificacoes } = useAuth();
  const [saldo, setSaldo] = useState(null);
  const [extrato, setExtrato] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const navigate = useNavigate();

  async function carregarDados(paginaAlvo = pagina) {
    setCarregando(true);
    const [dadosSaldo, dadosExtrato] = await Promise.all([
      consultarSaldo(),
      consultarExtrato({ pagina: paginaAlvo, porPagina: 10 }),
    ]);
    setSaldo(dadosSaldo);
    setExtrato(dadosExtrato.dados);
    setTotalPaginas(dadosExtrato.paginacao.totalPaginas);
    setCarregando(false);
  }

  useEffect(() => {
    carregarDados(1);
  }, []);

  // Sempre que uma notificação de transferência concluída chega via WebSocket,
  // recarrega saldo e extrato (primeira página) para refletir o novo estado.
  useEffect(() => {
    if (notificacoes.length > 0) {
      setPagina(1);
      carregarDados(1);
    }
  }, [notificacoes]);

  function irParaPagina(novaPagina) {
    setPagina(novaPagina);
    carregarDados(novaPagina);
  }

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

      {totalPaginas > 1 && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
          <button disabled={pagina <= 1} onClick={() => irParaPagina(pagina - 1)}>
            Anterior
          </button>
          <span style={{ fontSize: 14 }}>
            Página {pagina} de {totalPaginas}
          </span>
          <button disabled={pagina >= totalPaginas} onClick={() => irParaPagina(pagina + 1)}>
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
