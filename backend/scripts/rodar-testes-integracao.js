/**
 * Roda, em sequência, os três testes de integração que dependem da stack
 * real (API + Worker + RabbitMQ + Postgres já em pé via docker compose):
 *   1) fluxo assíncrono (solicitação -> PENDENTE -> Worker -> CONCLUÍDO)
 *   2) concorrência / race condition (saldo nunca fica negativo)
 *   3) imutabilidade da auditoria (UPDATE/DELETE bloqueados pela trigger)
 *
 * Uso (com a stack já rodando e migração aplicada):
 *   node scripts/rodar-testes-integracao.js
 */
const { execFileSync } = require("child_process");
const path = require("path");

const scripts = ["testar-fluxo-assincrono.js", "testar-concorrencia.js", "testar-imutabilidade.js"];

for (const script of scripts) {
  console.log(`\n=== Executando ${script} ===`);
  try {
    execFileSync("node", [path.join(__dirname, script)], { stdio: "inherit" });
  } catch (err) {
    console.error(`\n[rodar-testes-integracao] "${script}" falhou. Abortando.`);
    process.exit(1);
  }
}

console.log("\n=== Todos os testes de integração passaram ===");
