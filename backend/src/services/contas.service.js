const prisma = require("../config/prisma");

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

async function consultarExtrato(usuarioId) {
  const conta = await obterContaPorUsuario(usuarioId);

  const transacoes = await prisma.transacao.findMany({
    where: {
      OR: [{ contaOrigemId: conta.id }, { contaDestinoId: conta.id }],
    },
    orderBy: { criadoEm: "desc" },
    include: { contaOrigem: true, contaDestino: true },
    take: 100,
  });

  return transacoes.map((t) => ({
    id: t.id,
    tipo: t.contaOrigemId === conta.id ? "ENVIADA" : "RECEBIDA",
    valor: t.valor,
    status: t.status,
    criadoEm: t.criadoEm,
    concluidoEm: t.concluidoEm,
  }));
}

module.exports = { obterContaPorUsuario, consultarSaldo, consultarExtrato };
