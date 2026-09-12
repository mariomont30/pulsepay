/**
 * Suíte de conformidade com o ADR-0001 (transferência assíncrona via
 * RabbitMQ + Worker). Cada teste corresponde a um ponto numerado da seção
 * "Decisão" do ADR. Isso NÃO substitui os testes funcionais normais
 * (tests/unit, tests/integration) - é uma camada de rastreabilidade
 * arquitetural: se alguém alterar o código de um jeito que quebre uma
 * decisão registrada, este arquivo aponta exatamente qual ponto do ADR
 * foi violado.
 */
jest.mock("../../src/config/prisma", () => ({
  conta: { findUnique: jest.fn() },
  transacao: { create: jest.fn(), findUnique: jest.fn() },
  auditoria: { create: jest.fn() },
}));

jest.mock("../../src/config/rabbitmq", () => ({
  getChannel: jest.fn(),
  conectar: jest.fn(),
  FILA_TRANSFERENCIAS: "transferencias",
  FILA_NOTIFICACOES: "notificacoes",
}));

const prisma = require("../../src/config/prisma");
const { getChannel } = require("../../src/config/rabbitmq");
const { solicitarTransferencia, consultarTransferencia } = require("../../src/services/transferencia.service");

const CONTA_ORIGEM_ID = "c1";
const CONTA_DESTINO_ID = "c2";
const USUARIO_ORIGEM_ID = "u1";

describe("ADR-0001: transferência assíncrona com RabbitMQ e Worker", () => {
  beforeEach(() => jest.clearAllMocks());

  test("decisão 2: a transferência é gravada como PENDENTE ANTES de ser publicada na fila", async () => {
    prisma.conta.findUnique
      .mockResolvedValueOnce({ id: CONTA_ORIGEM_ID, usuarioId: USUARIO_ORIGEM_ID, saldo: 500 })
      .mockResolvedValueOnce({ id: CONTA_DESTINO_ID, status: "ATIVA" });
    prisma.transacao.create.mockResolvedValueOnce({ id: "t1", status: "PENDENTE", criadoEm: new Date() });
    prisma.auditoria.create.mockResolvedValueOnce({});

    const canalMock = { sendToQueue: jest.fn() };
    getChannel.mockReturnValue(canalMock);

    await solicitarTransferencia(USUARIO_ORIGEM_ID, { contaDestinoId: CONTA_DESTINO_ID, valor: 100 });

    const ordemCriacao = prisma.transacao.create.mock.invocationCallOrder[0];
    const ordemPublicacao = canalMock.sendToQueue.mock.invocationCallOrder[0];
    expect(ordemCriacao).toBeLessThan(ordemPublicacao);
    expect(prisma.transacao.create.mock.calls[0][0].data.status).toBe("PENDENTE");
  });

  test("decisão 3: a mensagem publicada é persistente e contém somente o identificador da transferência", async () => {
    prisma.conta.findUnique
      .mockResolvedValueOnce({ id: CONTA_ORIGEM_ID, usuarioId: USUARIO_ORIGEM_ID, saldo: 500 })
      .mockResolvedValueOnce({ id: CONTA_DESTINO_ID, status: "ATIVA" });
    prisma.transacao.create.mockResolvedValueOnce({ id: "t1", status: "PENDENTE", criadoEm: new Date() });
    prisma.auditoria.create.mockResolvedValueOnce({});

    const canalMock = { sendToQueue: jest.fn() };
    getChannel.mockReturnValue(canalMock);

    await solicitarTransferencia(USUARIO_ORIGEM_ID, { contaDestinoId: CONTA_DESTINO_ID, valor: 100 });

    expect(canalMock.sendToQueue).toHaveBeenCalledTimes(1);
    const [, corpoBuffer, opcoes] = canalMock.sendToQueue.mock.calls[0];
    const corpo = JSON.parse(corpoBuffer.toString());

    // "apenas o identificador" - não deve conter valor, contas ou qualquer
    // outro dado financeiro/sensível na mensagem da fila.
    expect(Object.keys(corpo).sort()).toEqual(["criadoEm", "transacaoId"]);
    expect(corpo.transacaoId).toBe("t1");
    expect(opcoes).toMatchObject({ persistent: true });
  });

  test("decisão 3: a API devolve imediatamente o identificador e o status PENDENTE", async () => {
    prisma.conta.findUnique
      .mockResolvedValueOnce({ id: CONTA_ORIGEM_ID, usuarioId: USUARIO_ORIGEM_ID, saldo: 500 })
      .mockResolvedValueOnce({ id: CONTA_DESTINO_ID, status: "ATIVA" });
    prisma.transacao.create.mockResolvedValueOnce({ id: "t1", status: "PENDENTE", criadoEm: new Date() });
    prisma.auditoria.create.mockResolvedValueOnce({});
    getChannel.mockReturnValue({ sendToQueue: jest.fn() });

    const resultado = await solicitarTransferencia(USUARIO_ORIGEM_ID, {
      contaDestinoId: CONTA_DESTINO_ID,
      valor: 100,
    });

    expect(resultado).toMatchObject({ id: "t1", status: "PENDENTE" });
  });

  test("decisão 6: a consulta de status é restrita ao remetente ou ao destinatário da transferência", async () => {
    prisma.conta.findUnique.mockResolvedValueOnce({ id: "conta-de-um-terceiro" });
    prisma.transacao.findUnique.mockResolvedValueOnce({
      id: "t1",
      contaOrigemId: CONTA_ORIGEM_ID,
      contaDestinoId: CONTA_DESTINO_ID,
      status: "CONCLUIDO",
    });

    await expect(consultarTransferencia("usuario-nao-envolvido", "t1")).rejects.toMatchObject({ status: 403 });
  });

  test("decisão 6: remetente e destinatário conseguem consultar normalmente a própria transferência", async () => {
    prisma.conta.findUnique.mockResolvedValueOnce({ id: CONTA_ORIGEM_ID });
    prisma.transacao.findUnique.mockResolvedValueOnce({
      id: "t1",
      contaOrigemId: CONTA_ORIGEM_ID,
      contaDestinoId: CONTA_DESTINO_ID,
      status: "CONCLUIDO",
    });

    await expect(consultarTransferencia(USUARIO_ORIGEM_ID, "t1")).resolves.toMatchObject({ id: "t1" });
  });
});
