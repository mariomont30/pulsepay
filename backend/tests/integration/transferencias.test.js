const request = require("supertest");

// Mocka o Prisma Client e o canal do RabbitMQ para que o teste de integração
// da API rode sem depender de Postgres/RabbitMQ reais (ver README seção 4).
jest.mock("../../src/config/prisma", () => ({
  conta: {
    findUnique: jest.fn(),
  },
  transacao: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  auditoria: {
    create: jest.fn(),
  },
}));

jest.mock("../../src/config/rabbitmq", () => ({
  getChannel: jest.fn(() => ({ sendToQueue: jest.fn() })),
  conectar: jest.fn(),
  FILA_TRANSFERENCIAS: "transferencias",
  FILA_NOTIFICACOES: "notificacoes",
}));

const prisma = require("../../src/config/prisma");
const { gerarToken } = require("../../src/utils/jwt");
const criarApp = require("../../src/app");

const app = criarApp();

const CONTA_ORIGEM_ID = "11111111-1111-1111-1111-111111111111";
const CONTA_DESTINO_ID = "22222222-2222-2222-2222-222222222222";
const USUARIO_ID = "33333333-3333-3333-3333-333333333333";

describe("POST /transferencias", () => {
  const token = gerarToken({ sub: USUARIO_ID, email: "usuario@teste.com" });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("deve retornar 401 sem token", async () => {
    const res = await request(app).post("/transferencias").send({});
    expect(res.status).toBe(401);
  });

  test("deve rejeitar payload inválido (valor negativo)", async () => {
    const res = await request(app)
      .post("/transferencias")
      .set("Authorization", `Bearer ${token}`)
      .send({ contaDestinoId: CONTA_DESTINO_ID, valor: -50 });

    expect(res.status).toBe(400);
  });

  test("deve criar transferência como PENDENTE quando payload e saldo são válidos", async () => {
    prisma.conta.findUnique
      .mockResolvedValueOnce({ id: CONTA_ORIGEM_ID, usuarioId: USUARIO_ID, saldo: 500 }) // conta origem
      .mockResolvedValueOnce({ id: CONTA_DESTINO_ID, status: "ATIVA" }); // conta destino

    prisma.transacao.create.mockResolvedValueOnce({
      id: "44444444-4444-4444-4444-444444444444",
      status: "PENDENTE",
      criadoEm: new Date(),
    });
    prisma.auditoria.create.mockResolvedValueOnce({});

    const res = await request(app)
      .post("/transferencias")
      .set("Authorization", `Bearer ${token}`)
      .send({ contaDestinoId: CONTA_DESTINO_ID, valor: 100 });

    expect(res.status).toBe(202);
    expect(res.body.status).toBe("PENDENTE");
  });

  test("deve retornar 422 quando saldo é insuficiente", async () => {
    prisma.conta.findUnique
      .mockResolvedValueOnce({ id: CONTA_ORIGEM_ID, usuarioId: USUARIO_ID, saldo: 10 })
      .mockResolvedValueOnce({ id: CONTA_DESTINO_ID, status: "ATIVA" });

    const res = await request(app)
      .post("/transferencias")
      .set("Authorization", `Bearer ${token}`)
      .send({ contaDestinoId: CONTA_DESTINO_ID, valor: 100 });

    expect(res.status).toBe(422);
  });
});
