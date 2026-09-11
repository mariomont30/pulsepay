/**
 * Teste do fluxo assíncrono (README seção 4).
 * Roda contra a stack real (API + Worker + RabbitMQ + Postgres já em pé,
 * via `docker compose up`). Verifica que uma transferência solicitada como
 * PENDENTE é efetivamente consumida pelo Worker e muda para CONCLUÍDO.
 *
 * Uso:
 *   API_URL=http://localhost:4000 node scripts/testar-fluxo-assincrono.js
 */
const { criarUsuarioDeTeste, chamarApi, esperarStatusFinal } = require("./lib/api-client");

async function main() {
  console.log("[teste-fluxo-assincrono] criando usuários de teste...");
  const origem = await criarUsuarioDeTeste("origem");
  const destino = await criarUsuarioDeTeste("destino");

  const valor = 50;
  console.log(`[teste-fluxo-assincrono] solicitando transferência de R$ ${valor} para ${destino.email}...`);
  const inicio = Date.now();

  const solicitacao = await chamarApi("/transferencias", {
    method: "POST",
    token: origem.token,
    body: { emailDestino: destino.email, valor },
  });

  if (solicitacao.status !== 202) {
    throw new Error(`Esperava 202 PENDENTE na solicitação, recebeu ${solicitacao.status}: ${JSON.stringify(solicitacao.dados)}`);
  }
  if (solicitacao.dados.status !== "PENDENTE") {
    throw new Error(`Esperava status PENDENTE na resposta síncrona, recebeu ${solicitacao.dados.status}`);
  }
  console.log(`[teste-fluxo-assincrono] solicitação recebida como PENDENTE (id: ${solicitacao.dados.id})`);

  const transacaoFinal = await esperarStatusFinal(origem.token, solicitacao.dados.id);
  const tempoTotalMs = Date.now() - inicio;

  if (transacaoFinal.status !== "CONCLUIDO") {
    throw new Error(`Esperava status final CONCLUIDO, worker retornou ${transacaoFinal.status}: ${JSON.stringify(transacaoFinal)}`);
  }

  console.log(`[teste-fluxo-assincrono] OK - transação concluída em ${tempoTotalMs}ms (meta README: <= 2000ms)`);
  if (tempoTotalMs > 2000) {
    console.warn("[teste-fluxo-assincrono] ATENÇÃO: tempo de confirmação excedeu a meta de SLA de 2s");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("[teste-fluxo-assincrono] FALHOU:", err.message);
  process.exit(1);
});
