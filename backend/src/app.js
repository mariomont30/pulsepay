const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const contasRoutes = require("./routes/contas.routes");
const transferenciasRoutes = require("./routes/transferencias.routes");
const { medirRequisicoes, registro } = require("./metrics/metrics");

/**
 * Monta o app Express sem efeitos colaterais (sem conectar RabbitMQ, sem
 * abrir socket, sem `listen`). Isso permite importar o app diretamente
 * nos testes de integração (Supertest) sem precisar de infraestrutura real.
 * O bootstrap "de verdade" (RabbitMQ + Socket.io + listen) fica em index.js.
 */
function criarApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(medirRequisicoes);

  app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

  app.get("/metrics", async (req, res) => {
    res.set("Content-Type", registro.contentType);
    res.end(await registro.metrics());
  });

  app.use("/auth", authRoutes);
  app.use("/contas", contasRoutes);
  app.use("/transferencias", transferenciasRoutes);

  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    // Em teste (NODE_ENV=test, definido automaticamente pelo Jest), erros
    // esperados (ex.: 422 "saldo insuficiente" testado de propósito) não
    // são logados, para não confundir com uma falha real do teste.
    // Erros inesperados (5xx) continuam sendo logados mesmo em teste.
    const status = err.status || 500;
    if (process.env.NODE_ENV !== "test" || status >= 500) {
      console.error(err);
    }
    res.status(status).json({ erro: err.message || "Erro interno do servidor" });
  });

  return app;
}

module.exports = criarApp;
