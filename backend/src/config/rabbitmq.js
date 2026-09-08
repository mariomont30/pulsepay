const amqp = require("amqplib");

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost:5672";
const FILA_TRANSFERENCIAS = process.env.RABBITMQ_QUEUE_TRANSFERENCIAS || "transferencias";
const FILA_NOTIFICACOES = process.env.RABBITMQ_QUEUE_NOTIFICACOES || "notificacoes";

let connection = null;
let channel = null;

/**
 * Conecta ao RabbitMQ com retentativa exponencial simples.
 * Necessário porque o container da API pode subir antes do RabbitMQ
 * estar totalmente pronto para aceitar conexões.
 */
async function conectar(tentativa = 1) {
  try {
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue(FILA_TRANSFERENCIAS, { durable: true });
    await channel.assertQueue(FILA_NOTIFICACOES, { durable: true });

    connection.on("close", () => {
      console.error("[rabbitmq] conexão fechada, tentando reconectar...");
      channel = null;
      setTimeout(() => conectar(1), 3000);
    });

    console.log("[rabbitmq] conectado com sucesso");
    return channel;
  } catch (err) {
    const espera = Math.min(1000 * tentativa, 10000);
    console.error(`[rabbitmq] falha ao conectar (tentativa ${tentativa}): ${err.message}. Nova tentativa em ${espera}ms`);
    await new Promise((resolve) => setTimeout(resolve, espera));
    return conectar(tentativa + 1);
  }
}

function getChannel() {
  if (!channel) {
    throw new Error("Canal do RabbitMQ ainda não está pronto");
  }
  return channel;
}

module.exports = {
  conectar,
  getChannel,
  FILA_TRANSFERENCIAS,
  FILA_NOTIFICACOES,
};
