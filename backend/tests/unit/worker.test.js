jest.mock("../../src/config/prisma", () => ({
  transacao: { findUnique: jest.fn(), update: jest.fn() },
  conta: { findUnique: jest.fn(), update: jest.fn() },
  auditoria: { create: jest.fn() },
  $transaction: jest.fn(),
  $queryRawUnsafe: jest.fn(),
}));

jest.mock("../../src/config/rabbitmq", () => ({
  conectar: jest.fn(),
  getChannel: jest.fn(() => ({ sendToQueue: jest.fn(), prefetch: jest.fn(), consume: jest.fn() })),
  FILA_TRANSFERENCIAS: "transferencias",
  FILA_NOTIFICACOES: "notificacoes",
}));

const prisma = require("../../src/config/prisma");
const { getChannel } = require("../../src/config/rabbitmq");
const { efetivarTransferencia } = require("../../worker/worker");

const TRANSACAO_ID = "t1";
const CONTA_ORIGEM_ID = "c1";
const CONTA_DESTINO_ID = "c2";

function criarTxMock({ saldoOrigem, saldoDestino }) {
  return {
    $queryRawUnsafe: jest.fn(),
    conta: {
      findUnique: jest
        .fn()
        .mockImplementation(({ where: { id } }) =>
          id === CONTA_ORIGEM_ID
            ? { id: CONTA_ORIGEM_ID, saldo: saldoOrigem, usuarioId: "u1" }
            : { id: CONTA_DESTINO_ID, saldo: saldoDestino, usuarioId: "u2" }
        ),
      update: jest.fn(),
    },
    transacao: { update: jest.fn().mockResolvedValue({ id: TRANSACAO_ID, concluidoEm: new Date() }) },
    auditoria: { create: jest.fn() },
  };
}

describe("worker.efetivarTransferencia", () => {
  beforeEach(() => jest.clearAllMocks());

  test("deve ignorar transação que já não está mais PENDENTE (idempotência)", async () => {
    prisma.transacao.findUnique.mockResolvedValueOnce({
      id: TRANSACAO_ID,
      status: "CONCLUIDO",
      contaOrigemId: CONTA_ORIGEM_ID,
      contaDestinoId: CONTA_DESTINO_ID,
      valor: 100,
    });

    await efetivarTransferencia(TRANSACAO_ID);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("deve marcar como FALHOU quando saldo é insuficiente no momento da efetivação", async () => {
    prisma.transacao.findUnique.mockResolvedValueOnce({
      id: TRANSACAO_ID,
      status: "PENDENTE",
      contaOrigemId: CONTA_ORIGEM_ID,
      contaDestinoId: CONTA_DESTINO_ID,
      valor: 100,
    });

    const txMock = criarTxMock({ saldoOrigem: 10, saldoDestino: 0 });
    prisma.$transaction.mockImplementationOnce(async (callback) => callback(txMock));

    await efetivarTransferencia(TRANSACAO_ID);

    expect(txMock.transacao.update).toHaveBeenCalledWith({
      where: { id: TRANSACAO_ID },
      data: { status: "FALHOU", motivoFalha: expect.any(String) },
    });
    expect(txMock.conta.update).not.toHaveBeenCalled();
  });

  test("deve efetivar débito/crédito e publicar notificação quando há saldo suficiente", async () => {
    prisma.transacao.findUnique.mockResolvedValueOnce({
      id: TRANSACAO_ID,
      status: "PENDENTE",
      contaOrigemId: CONTA_ORIGEM_ID,
      contaDestinoId: CONTA_DESTINO_ID,
      valor: 100,
    });

    const txMock = criarTxMock({ saldoOrigem: 500, saldoDestino: 50 });
    prisma.$transaction.mockImplementationOnce(async (callback) => callback(txMock));

    const canalMock = { sendToQueue: jest.fn() };
    getChannel.mockReturnValue(canalMock);

    await efetivarTransferencia(TRANSACAO_ID);

    expect(txMock.conta.update).toHaveBeenCalledTimes(2);
    expect(txMock.transacao.update).toHaveBeenCalledWith({
      where: { id: TRANSACAO_ID },
      data: { status: "CONCLUIDO", concluidoEm: expect.any(Date) },
    });
    expect(canalMock.sendToQueue).toHaveBeenCalledTimes(1);
  });
});
