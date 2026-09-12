const prisma = require("../config/prisma");

const PAGINA_PADRAO = 1;
const POR_PAGINA_PADRAO = 20;
const POR_PAGINA_MAXIMO = 100; // ADR-0003: "limite máximo por requisição"

async function obterContaPorUsuario(usuarioId) {
  const conta = await prisma.conta.findUnique({ where: { usuarioId } });
  if (!conta) {
    const erro = new Error("Conta não encontrada para este usuário");
    erro.status = 404;
    throw erro;
  }
  return conta;
}

async function consultarSaldo(usuarioId) {
  const conta = await obterContaPorUsuario(usuarioId);
  return { contaId: conta.id, saldo: conta.saldo, status: conta.status };
}

/**
 * Extrato cronológico (ADR-0003). Implementa fielmente os pontos 2-7 da
 * decisão:
 *   - conta identificada pelo usuarioId autenticado (nunca por um id
 *     arbitrário vindo do cliente);
 *   - transações em que a conta é origem OU destino;
 *   - classificação ENVIADA/RECEBIDA relativa à conta autenticada;
 *   - resposta contendo somente id, tipo, valor, data e status;
 *   - ordenação do mais recente para o mais antigo, com o id como segundo
 *     critério para manter uma ordem estável mesmo com timestamps iguais;
 *   - paginação por deslocamento (offset) com limite máximo por página.
 */
async function consultarExtrato(usuarioId, { pagina = PAGINA_PADRAO, porPagina = POR_PAGINA_PADRAO } = {}) {
  const conta = await obterContaPorUsuario(usuarioId);

  const paginaSegura = Math.max(1, Number(pagina) || PAGINA_PADRAO);
  const porPaginaSegura = Math.min(POR_PAGINA_MAXIMO, Math.max(1, Number(porPagina) || POR_PAGINA_PADRAO));

  const [transacoes, total] = await Promise.all([
    prisma.transacao.findMany({
      where: {
        OR: [{ contaOrigemId: conta.id }, { contaDestinoId: conta.id }],
      },
      orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
      skip: (paginaSegura - 1) * porPaginaSegura,
      take: porPaginaSegura,
    }),
    prisma.transacao.count({
      where: {
        OR: [{ contaOrigemId: conta.id }, { contaDestinoId: conta.id }],
      },
    }),
  ]);

  return {
    dados: transacoes.map((t) => ({
      id: t.id,
      tipo: t.contaOrigemId === conta.id ? "ENVIADA" : "RECEBIDA",
      valor: t.valor,
      status: t.status,
      criadoEm: t.criadoEm,
      concluidoEm: t.concluidoEm,
    })),
    paginacao: {
      pagina: paginaSegura,
      porPagina: porPaginaSegura,
      total,
      totalPaginas: Math.max(1, Math.ceil(total / porPaginaSegura)),
    },
  };
}

module.exports = { obterContaPorUsuario, consultarSaldo, consultarExtrato };
