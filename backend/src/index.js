require("dotenv").config();
const http = require("http");

const criarApp = require("./app");
const { conectar } = require("./config/rabbitmq");
const { iniciarSocket, iniciarConsumidorNotificacoes } = require("./sockets/socket");

const PORT = process.env.API_PORT || 4000;

const app = criarApp();
const servidorHttp = http.createServer(app);
iniciarSocket(servidorHttp);

async function iniciar() {
  await conectar();
  await iniciarConsumidorNotificacoes();

  servidorHttp.listen(PORT, () => {
    console.log(`[api] PulsePay API rodando na porta ${PORT}`);
  });
}

iniciar().catch((err) => {
  console.error("[api] falha fatal ao iniciar:", err);
  process.exit(1);
});

module.exports = app;
