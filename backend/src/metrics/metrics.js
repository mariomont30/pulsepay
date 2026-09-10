const client = require("prom-client");

// Coleta métricas padrão de processo (CPU, memória, event loop) além das
// métricas customizadas abaixo. Consumido pelo Prometheus (ver seção 6/8 do README).
const registro = new client.Registry();
client.collectDefaultMetrics({ register: registro });

const httpDuracaoSegundos = new client.Histogram({
  name: "pulsepay_http_request_duration_seconds",
  help: "Duração das requisições HTTP em segundos",
  labelNames: ["metodo", "rota", "status"],
  buckets: [0.05, 0.1, 0.2, 0.5, 1, 2],
  registers: [registro],
});

const transferenciasSolicitadasTotal = new client.Counter({
  name: "pulsepay_transferencias_solicitadas_total",
  help: "Total de transferências solicitadas via API",
  registers: [registro],
});

const transferenciasConcluidasTotal = new client.Counter({
  name: "pulsepay_transferencias_concluidas_total",
  help: "Total de transferências efetivadas pelo worker",
  labelNames: ["status"],
  registers: [registro],
});

const transferenciaTempoConfirmacaoSegundos = new client.Histogram({
  name: "pulsepay_transferencia_tempo_confirmacao_segundos",
  help: "Tempo ponta a ponta entre solicitação e status CONCLUIDO (meta SLA <= 2s)",
  buckets: [0.25, 0.5, 1, 1.5, 2, 3, 5],
  registers: [registro],
});

const filaTamanho = new client.Gauge({
  name: "pulsepay_fila_tamanho",
  help: "Tamanho atual da fila de transferências pendentes no worker",
  registers: [registro],
});

/** Middleware Express que mede a duração de cada requisição HTTP. */
function medirRequisicoes(req, res, next) {
  const fimTimer = httpDuracaoSegundos.startTimer();
  res.on("finish", () => {
    fimTimer({ metodo: req.method, rota: req.route?.path || req.path, status: res.statusCode });
  });
  next();
}

module.exports = {
  registro,
  medirRequisicoes,
  transferenciasSolicitadasTotal,
  transferenciasConcluidasTotal,
  transferenciaTempoConfirmacaoSegundos,
  filaTamanho,
};
