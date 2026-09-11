require("dotenv").config();
const http = require("http");
const prisma = require("../src/config/prisma");
const { conectar, getChannel, FILA_TRANSFERENCIAS, FILA_NOTIFICACOES } = require("../src/config/rabbitmq");
const {
  registro,
  transferenciasConcluidasTotal,
  transferenciaTempoConfirmacaoSegundos,
} = require("../src/metrics/metrics");

const METRICS_PORT = process.env.WORKER_METRICS_PORT || 4001;

/**
 * Efetiva o débito/crédito de uma transferência de forma atômica.
 * Usa `SELECT ... FOR UPDATE` (lock pessimista) nas duas contas, na MESMA
 * ordem sempre (por id), para evitar tanto race condition (saldo negativo
 * por leituras concorrentes) quanto deadlock entre transferências cruzadas.
 * Ver README seção 7 (Riscos Conhecidos: Atomicidade / Race condition).
 */
async function efetivarTransferencia(transacaoId) {
  const transacaoAtual = await prisma.transacao.findUnique({ where: { id: transacaoId } });

  if (!transacaoAtual) {
    console.error(`[worker] transação ${transacaoId} não encontrada, descartando mensagem`);
    return;
  }

  // Idempotência: se já foi processada (reentrega da fila), não processa de novo.
  if (transacaoAtual.status !== "PENDENTE") {
    console.warn(`[worker] transação ${transacaoId} já está em status ${transacaoAtual.status}, ignorando`);
    return;
  }

  const inicio = Date.now();
  const [idMenor, idMaior] = [transacaoAtual.contaOrigemId, transacaoAtual.contaDestinoId].sort();

  try {
    const eventoNotificacao = await prisma.$transaction(async (tx) => {
      // Lock nas duas contas em ordem determinística (evita deadlock)
      await tx.$queryRawUnsafe(`SELECT id FROM "Conta" WHERE id = $1 FOR UPDATE`, idMenor);
      await tx.$queryRawUnsafe(`SELECT id FROM "Conta" WHERE id = $1 FOR UPDATE`, idMaior);

      const contaOrigem = await tx.conta.findUnique({ where: { id: transacaoAtual.contaOrigemId } });
      const contaDestino = await tx.conta.findUnique({ where: { id: transacaoAtual.contaDestinoId } });

      if (Number(contaOrigem.saldo) < Number(transacaoAtual.valor)) {
        await tx.transacao.update({
          where: { id: transacaoId },
          data: { status: "FALHOU", motivoFalha: "Saldo insuficiente no momento da efetivação" },
        });
        await tx.auditoria.create({
          data: { transacaoId, evento: "TRANSFERENCIA_FALHOU", detalhes: { motivo: "saldo_insuficiente" } },
        });
        return null;
      }

      await tx.conta.update({
        where: { id: contaOrigem.id },
        data: { saldo: { decrement: transacaoAtual.valor } },
      });
      await tx.conta.update({
        where: { id: contaDestino.id },
        data: { saldo: { increment: transacaoAtual.valor } },
      });

      const transacaoAtualizada = await tx.transacao.update({
        where: { id: transacaoId },
        data: { status: "CONCLUIDO", concluidoEm: new Date() },
      });

      await tx.auditoria.create({
        data: {
          transacaoId,
          evento: "TRANSFERENCIA_CONCLUIDA",
          detalhes: { contaOrigemId: contaOrigem.id, contaDestinoId: contaDestino.id, valor: transacaoAtual.valor },
        },
      });

      return {
        transacaoId: transacaoAtualizada.id,
        usuarioDestinoId: contaDestino.usuarioId,
        valor: transacaoAtualizada.valor,
        concluidoEm: transacaoAtualizada.concluidoEm,
      };
    });

    const tempoSegundos = (Date.now() - inicio) / 1000;
    transferenciaTempoConfirmacaoSegundos.observe(tempoSegundos);

    if (eventoNotificacao) {
      transferenciasConcluidasTotal.inc({ status: "CONCLUIDO" });
      const canal = getChannel();
      canal.sendToQueue(FILA_NOTIFICACOES, Buffer.from(JSON.stringify(eventoNotificacao)), { persistent: true });
      console.log(`[worker] transferência ${transacaoId} concluída em ${tempoSegundos.toFixed(3)}s`);
    } else {
      transferenciasConcluidasTotal.inc({ status: "FALHOU" });
    }
  } catch (err) {
    console.error(`[worker] erro ao efetivar transferência ${transacaoId}:`, err);
    throw err; // mensagem volta para a fila (nack) para nova tentativa
  }
}

async function iniciarConsumidorTransferencias() {
  const canal = getChannel();
  await canal.prefetch(10);

  await canal.consume(FILA_TRANSFERENCIAS, async (msg) => {
    if (!msg) return;
    const { transacaoId } = JSON.parse(msg.content.toString());

    try {
      await efetivarTransferencia(transacaoId);
      canal.ack(msg);
    } catch (err) {
      // requeue=true permite nova tentativa; em produção seria ideal usar
      // uma dead-letter queue após N tentativas.
      canal.nack(msg, false, true);
    }
  });

  console.log("[worker] aguardando mensagens na fila de transferências...");
}

/** Servidor HTTP mínimo apenas para expor /metrics ao Prometheus. */
function iniciarServidorMetricas() {
  http
    .createServer(async (req, res) => {
      if (req.url === "/metrics") {
        res.setHeader("Content-Type", registro.contentType);
        res.end(await registro.metrics());
      } else {
        res.writeHead(404);
        res.end();
      }
    })
    .listen(METRICS_PORT, () => console.log(`[worker] métricas expostas em :${METRICS_PORT}/metrics`));
}

async function iniciar() {
  await conectar();
  iniciarServidorMetricas();
  await iniciarConsumidorTransferencias();
}

// Só dispara o bootstrap real quando o arquivo é executado diretamente
// (`node worker/worker.js`), e não quando é `require`'ido pelos testes.
if (require.main === module) {
  iniciar().catch((err) => {
    console.error("[worker] falha fatal ao iniciar:", err);
    process.exit(1);
  });
}

module.exports = { efetivarTransferencia, iniciarConsumidorTransferencias, iniciarServidorMetricas };
