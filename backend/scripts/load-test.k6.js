/**
 * Teste de carga (k6) - README seção 6 (Plano de Operação) e Entrega 4.
 *
 * Simula o cenário descrito no README:
 *   - 100-150 usuários simultâneos fictícios
 *   - ~30-50 req/s em carga constante
 *   - pico de ~150 req/s por 1 minuto (dia de pagamento de salário)
 *
 * Valida na prática:
 *   - tempo de resposta síncrono da API (< 500ms, antes da fila) - medido
 *     APENAS no POST /transferencias (tag "solicitacao"), separado das
 *     chamadas de polling de status, para não poluir a métrica.
 *   - tempo de confirmação ponta a ponta da transferência (<= 2s), medido
 *     via polling em GET /transferencias/:id até o status deixar de ser
 *     PENDENTE
 *
 * IMPORTANTE sobre distribuição de carga: a carga é distribuída entre um
 * POOL de contas (não 2 contas fixas). Usar poucas contas faria todas as
 * transferências brigarem pelo mesmo lock de linha no Postgres
 * (SELECT ... FOR UPDATE em worker.js), serializando artificialmente TODA
 * a carga - o que não reflete um cenário realista (na vida real, milhares
 * de transferências saem de contas diferentes e podem ser processadas em
 * paralelo).
 *
 * Instalação do k6: https://k6.io/docs/get-started/installation/
 *
 * Uso (com a stack rodando via docker compose):
 *   k6 run backend/scripts/load-test.k6.js
 *
 * Variáveis de ambiente aceitas:
 *   API_URL          (padrão http://localhost:4000)
 *   QUANTIDADE_PARES (padrão 20 - número de pares origem/destino no pool)
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Counter } from "k6/metrics";

const API_URL = __ENV.API_URL || "http://localhost:4000";
const QUANTIDADE_PARES = Number(__ENV.QUANTIDADE_PARES || 20);

// Métricas customizadas para validar o SLA descrito no README seção 6.
const tempoConfirmacaoTrend = new Trend("pulsepay_tempo_confirmacao_ms");
const transferenciasFalhasCounter = new Counter("pulsepay_transferencias_falhas");

export const options = {
  setupTimeout: "180s", // criar dezenas de usuários (bcrypt) pode levar um tempo
  scenarios: {
    // Carga constante: ~30-50 req/s sustentado (README seção 6)
    carga_constante: {
      executor: "constant-arrival-rate",
      rate: 40,
      timeUnit: "1s",
      duration: "1m",
      preAllocatedVUs: 60,
      maxVUs: 150,
      exec: "fluxoTransferencia",
      startTime: "0s",
    },
    // Pico simulado: rajada de ~150 req/s por 1 minuto (README seção 6:
    // "dia de pagamento de salário/data comercial")
    pico_simulado: {
      executor: "constant-arrival-rate",
      rate: 150,
      timeUnit: "1s",
      duration: "1m",
      preAllocatedVUs: 150,
      maxVUs: 250,
      exec: "fluxoTransferencia",
      startTime: "1m5s", // roda depois que a carga constante termina
    },
  },
  thresholds: {
    // Meta README seção 6: resposta síncrona da API < 500ms.
    // Escopado só na tag "solicitacao" (o POST /transferencias em si),
    // sem incluir as chamadas de polling de status na mesma métrica.
    "http_req_duration{transferencia:solicitacao}": ["p(95)<500"],
    // Meta README seção 6: confirmação ponta a ponta <= 2s
    pulsepay_tempo_confirmacao_ms: ["p(95)<2000"],
    // Meta README seção 6: 99,95% de disponibilidade -> <=0.05% de falhas HTTP
    http_req_failed: ["rate<0.0005"],
  },
};

/**
 * setup() roda uma única vez antes do teste: cria um POOL de pares de
 * usuários (origem/destino) que serão sorteados aleatoriamente a cada
 * iteração, distribuindo a carga entre várias linhas/contas diferentes
 * no banco (em vez de martelar sempre a mesma conta).
 */
export function setup() {
  const pares = [];

  for (let i = 0; i < QUANTIDADE_PARES; i++) {
    const par = { origem: null, destino: null };

    for (const papel of ["origem", "destino"]) {
      // Sufixo único por usuário: timestamp + índice do par + papel + random.
      const sufixo = `${Date.now()}${i}${papel === "origem" ? 0 : 1}${Math.floor(Math.random() * 10000)}`;
      const email = `k6-${papel}-${sufixo}@teste.pulsepay.local`;
      const cpf = sufixo.padStart(11, "0").slice(-11);
      const senha = "senha123456";

      const registroRes = http.post(
        `${API_URL}/auth/registrar`,
        JSON.stringify({ nome: `k6-${papel}-${i}`, email, cpf, senha }),
        { headers: { "Content-Type": "application/json" } }
      );

      if (registroRes.status !== 201) {
        throw new Error(
          `Falha ao registrar usuário de teste "${papel}" (par ${i}) em ${API_URL}/auth/registrar - ` +
            `status ${registroRes.status}, body: ${registroRes.body}. ` +
            `Confirme que a API está rodando (docker compose up -d) e acessível em ${API_URL} ` +
            `antes de rodar o k6 (teste com: curl ${API_URL}/health).`
        );
      }

      const loginRes = http.post(
        `${API_URL}/auth/login`,
        JSON.stringify({ email, senha }),
        { headers: { "Content-Type": "application/json" } }
      );

      let corpo;
      try {
        corpo = JSON.parse(loginRes.body);
      } catch (err) {
        throw new Error(`Resposta de login não é um JSON válido (status ${loginRes.status}): ${loginRes.body}`);
      }

      if (loginRes.status !== 200 || !corpo || !corpo.token) {
        throw new Error(
          `Falha ao logar usuário de teste "${papel}" (par ${i}) - status ${loginRes.status}, body: ${loginRes.body}`
        );
      }

      par[papel] = { email, token: corpo.token };
    }

    pares.push(par);
  }

  console.log(`[setup] ${pares.length} pares de contas criados para distribuir a carga.`);
  return { pares };
}

/** Executado repetidamente por cada VU/iteração durante os cenários de carga. */
export function fluxoTransferencia(data) {
  // Sorteia um par diferente a cada iteração, distribuindo a carga entre
  // várias contas em vez de concentrar tudo numa só (ver nota no topo).
  const par = data.pares[Math.floor(Math.random() * data.pares.length)];

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${par.origem.token}`,
  };

  const inicio = Date.now();

  const resSolicitacao = http.post(
    `${API_URL}/transferencias`,
    JSON.stringify({ emailDestino: par.destino.email, valor: 1 }),
    { headers, tags: { transferencia: "solicitacao" } }
  );

  const solicitacaoOk = check(resSolicitacao, {
    "solicitação retornou 202 PENDENTE": (r) => r.status === 202,
  });

  if (!solicitacaoOk) {
    transferenciasFalhasCounter.add(1);
    return;
  }

  const { id } = JSON.parse(resSolicitacao.body);

  // Faz polling da transação até saber o status final ou desistir em 2s
  // (o teste não deve bloquear indefinidamente uma VU sob carga). Tag
  // separada da "solicitacao" para não poluir a métrica de latência do
  // POST, que é a que tem meta de <500ms no README.
  let statusFinal = "PENDENTE";
  for (let tentativa = 0; tentativa < 10 && statusFinal === "PENDENTE"; tentativa++) {
    sleep(0.2);
    const resConsulta = http.get(`${API_URL}/transferencias/${id}`, {
      headers,
      tags: { transferencia: "consulta" },
    });
    if (resConsulta.status === 200) {
      statusFinal = JSON.parse(resConsulta.body).status;
    }
  }

  const tempoTotalMs = Date.now() - inicio;
  tempoConfirmacaoTrend.add(tempoTotalMs);

  check(statusFinal, {
    "transferência confirmou (CONCLUIDO ou FALHOU, não ficou PENDENTE)": (s) => s !== "PENDENTE",
  });

  if (statusFinal === "PENDENTE") {
    transferenciasFalhasCounter.add(1);
  }
}

/** Resumo final impresso no console, destacando o atingimento (ou não) do SLA. */
export function handleSummary(data) {
  const p95Confirmacao = data.metrics.pulsepay_tempo_confirmacao_ms?.values["p(95)"];
  const p95Solicitacao = data.metrics["http_req_duration{transferencia:solicitacao}"]?.values["p(95)"];
  const taxaFalha = data.metrics.http_req_failed?.values.rate;

  console.log("\n=== Resumo do teste de carga PulsePay (README seção 6) ===");
  console.log(`Latência do POST /transferencias p95 (meta < 500ms): ${p95Solicitacao?.toFixed(1)}ms`);
  console.log(`Confirmação ponta a ponta p95 (meta <= 2000ms): ${p95Confirmacao?.toFixed(1)}ms`);
  console.log(`Taxa de falha HTTP (meta < 0,05%): ${(taxaFalha * 100).toFixed(3)}%`);

  return {
    stdout: JSON.stringify(data, null, 2),
  };
}
