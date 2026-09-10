const prisma = require("../config/prisma");
const { getChannel, FILA_TRANSFERENCIAS } = require("../config/rabbitmq");
const { transferenciasSolicitadasTotal } = require("../metrics/metrics");
const { possuiSaldoSuficiente } = require("../utils/saldo");

/**
 * Parte SÍNCRONA da transferência (deve responder em <500ms, ver README seção 6):
 * 1. Valida regras de negócio básicas
 * 2. Grava a transação como PENDENTE (fonte única da verdade no Postgres)
 * 3. Publica o comando de efetivação no RabbitMQ (worker cuida do resto)
 */
async function solicitarTransferencia(usuarioId, { contaDestinoId, emailDestino, valor }) {
  const contaOrigem = await prisma.conta.findUnique({ where: { usuarioId } });
  if (!contaOrigem) {
    const erro = new Error("Conta de origem não encontrada");
    erro.status = 404;
    throw erro;
  }

  // Resolve o e-mail informado para o UUID interno da conta de destino
  // (fluxo usado pelo frontend, para o usuário não precisar copiar UUID).
  let destinoId = contaDestinoId;
  if (!destinoId && emailDestino) {
    const usuarioDestino = await prisma.usuario.findUnique({
      where: { email: emailDestino },
      include: { conta: true },
    });
    if (!usuarioDestino || !usuarioDestino.conta) {
      const erro = new Error("Nenhum usuário cadastrado com este e-mail");
      erro.status = 404;
      throw erro;
    }
    destinoId = usuarioDestino.conta.id;
  }

  if (contaOrigem.id === destinoId) {
    const erro = new Error("Não é possível transferir para a própria conta");
    erro.status = 400;
    throw erro;
  }

  const contaDestino = await prisma.conta.findUnique({ where: { id: destinoId } });
  if (!contaDestino || contaDestino.status !== "ATIVA") {
    const erro = new Error("Conta de destino inválida ou inexistente");
    erro.status = 404;
    throw erro;
  }

  if (!possuiSaldoSuficiente(contaOrigem.saldo, valor)) {
    const erro = new Error("Saldo insuficiente");
    erro.status = 422;
    throw erro;
  }

  const transacao = await prisma.transacao.create({
    data: {
      contaOrigemId: contaOrigem.id,
      contaDestinoId: contaDestino.id,
      valor,
      status: "PENDENTE",
    },
  });

  await prisma.auditoria.create({
    data: {
      transacaoId: transacao.id,
      evento: "TRANSFERENCIA_SOLICITADA",
      detalhes: { contaOrigemId: contaOrigem.id, contaDestinoId: contaDestino.id, valor },
    },
  });

  const canal = getChannel();
  canal.sendToQueue(
    FILA_TRANSFERENCIAS,
    Buffer.from(JSON.stringify({ transacaoId: transacao.id, criadoEm: Date.now() })),
    { persistent: true }
  );

  transferenciasSolicitadasTotal.inc();

  return { id: transacao.id, status: transacao.status, criadoEm: transacao.criadoEm };
}

async function consultarTransferencia(usuarioId, transacaoId) {
  const contaUsuario = await prisma.conta.findUnique({ where: { usuarioId } });
  const transacao = await prisma.transacao.findUnique({ where: { id: transacaoId } });

  if (!transacao) {
    const erro = new Error("Transferência não encontrada");
    erro.status = 404;
    throw erro;
  }

  const pertenceAoUsuario =
    contaUsuario && [transacao.contaOrigemId, transacao.contaDestinoId].includes(contaUsuario.id);
  if (!pertenceAoUsuario) {
    const erro = new Error("Acesso negado a esta transferência");
    erro.status = 403;
    throw erro;
  }

  return transacao;
}

module.exports = { solicitarTransferencia, consultarTransferencia };