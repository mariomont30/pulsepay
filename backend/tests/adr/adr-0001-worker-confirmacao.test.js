/**
 * Suíte de conformidade com o ADR-0001, decisão 7:
 * "A mensagem recebe confirmação de consumo somente depois do commit no
 * PostgreSQL." Arquivo separado do restante do ADR-0001 para manter os
 * mocks de Prisma/RabbitMQ simples (sem misturar com os testes de
 * transferencia.service.js).
 */
jest.mock("../../src/config/prisma", () => ({
  transacao: { findUnique: jest.fn(), update: jest.fn() },
  conta: { findUnique: jest.fn(), update: jest.fn() },
  auditoria: { create: jest.fn() },
  $transaction: jest.fn(),
  $queryRawUnsafe: jest.fn(),
}));

jest.mock("../../src/config/rabbitmq", () => ({
  conectar: jest.fn(),
  getChannel: jest.fn(),
  FILA_TRANSFERENCIAS: "transferencias",
  FILA_NOTIFICACOES: "notificacoes",
}));

const prisma = require("../../src/config/prisma");
const { getChannel } = require("../../src/config/rabbitmq");
const { iniciarConsumidorTransferencias } = require("../../worker/worker");

async function capturarCallbackDoConsumidor(canalMock) {
  getChannel.mockReturnValue(canalMock);
  let callbackCapturado;
  canalMock.consume.mockImplementation((_fila, callback) => {
    callbackCapturado = callback;
  });
  await iniciarConsumidorTransferencias();
  return callbackCapturado;
}

describe("ADR-0001 (decisão 7): Worker só confirma consumo (ack) após o commit no PostgreSQL", () => {
  beforeEach(() => jest.clearAllMocks());

  test("dá ack somente depois que a efetivação (transação ACID) termina com sucesso", async () => {
    const canalMock = {
      prefetch: jest.fn(),
      consume: jest.fn(),
      ack: jest.fn(),
      nack: jest.fn(),
      sendToQueue: jest.fn(),
    };
    const callback = await capturarCallbackDoConsumidor(canalMock);

    prisma.transacao.findUnique.mockResolvedValueOnce({
      id: "t1",
      status: "PENDENTE",
      contaOrigemId: "c1",
      contaDestinoId: "c2",
      valor: 100,
    });
    prisma.$transaction.mockImplementationOnce(async (cb) =>
      cb({
        $queryRawUnsafe: jest.fn(),
        conta: {
          findUnique: jest.fn().mockResolvedValue({ id: "c1", saldo: 500, usuarioId: "u2" }),
          update: jest.fn(),
        },
        transacao: { update: jest.fn().mockResolvedValue({ id: "t1", concluidoEm: new Date() }) },
        auditoria: { create: jest.fn() },
      })
    );

    const msg = { content: Buffer.from(JSON.stringify({ transacaoId: "t1" })) };
    await callback(msg);

    expect(canalMock.ack).toHaveBeenCalledWith(msg);
    expect(canalMock.nack).not.toHaveBeenCalled();
  });

  test("NÃO dá ack (e faz nack com requeue) quando a efetivação lança um erro inesperado", async () => {
    const canalMock = {
      prefetch: jest.fn(),
      consume: jest.fn(),
      ack: jest.fn(),
      nack: jest.fn(),
      sendToQueue: jest.fn(),
    };
    const callback = await capturarCallbackDoConsumidor(canalMock);

    prisma.transacao.findUnique.mockRejectedValueOnce(new Error("falha de conexão com o banco"));

    const msg = { content: Buffer.from(JSON.stringify({ transacaoId: "t1" })) };
    await callback(msg);

    expect(canalMock.ack).not.toHaveBeenCalled();
    expect(canalMock.nack).toHaveBeenCalledWith(msg, false, true);
  });
});
