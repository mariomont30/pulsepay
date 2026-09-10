const { Server } = require("socket.io");
const { verificarToken } = require("../utils/jwt");
const { getChannel, FILA_NOTIFICACOES } = require("../config/rabbitmq");

let io = null;

/**
 * Inicializa o servidor Socket.io sobre o servidor HTTP da API.
 * Cada cliente autenticado entra em uma "room" nomeada com o seu userId,
 * assim as notificações de transferência concluída são enviadas apenas
 * para o usuário destinatário correto.
 */
function iniciarSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Token não informado"));
      const payload = verificarToken(token);
      socket.usuarioId = payload.sub;
      return next();
    } catch (err) {
      return next(new Error("Token inválido"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`usuario:${socket.usuarioId}`);
    console.log(`[socket] usuário ${socket.usuarioId} conectado`);
  });

  return io;
}

/**
 * Consome a fila de notificações publicada pelo Worker assim que uma
 * transferência é efetivada, e repassa em tempo real via WebSocket.
 */
async function iniciarConsumidorNotificacoes() {
  const canal = getChannel();
  await canal.consume(FILA_NOTIFICACOES, (msg) => {
    if (!msg) return;
    try {
      const evento = JSON.parse(msg.content.toString());
      if (io) {
        io.to(`usuario:${evento.usuarioDestinoId}`).emit("transferencia:concluida", evento);
      }
      canal.ack(msg);
    } catch (err) {
      console.error("[socket] erro ao processar notificação:", err.message);
      canal.nack(msg, false, false);
    }
  });
}

module.exports = { iniciarSocket, iniciarConsumidorNotificacoes };
