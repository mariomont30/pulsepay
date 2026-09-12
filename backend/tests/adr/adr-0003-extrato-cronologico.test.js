/**
 * Suíte de conformidade com o ADR-0003 (extrato cronológico consultado
 * diretamente no PostgreSQL). Cada teste corresponde a um ponto numerado
 * da seção "Decisão" do ADR.
 */
const fs = require("fs");
const path = require("path");

jest.mock("../../src/config/prisma", () => ({
  conta: { findUnique: jest.fn() },
  transacao: { findMany: jest.fn(), count: jest.fn() },
}));

const prisma = require("../../src/config/prisma");
const { consultarExtrato } = require("../../src/services/contas.service");

const CONTA_ID = "conta-1";
const USUARIO_ID = "usuario-1";

describe("ADR-0003: extrato cronológico consultado diretamente no PostgreSQL", () => {
  beforeEach(() => jest.clearAllMocks());

  test("decisão 2: a conta é identificada pelo usuarioId autenticado (rota exige o middleware de autenticação)", () => {
    const routesSrc = fs.readFileSync(path.join(__dirname, "../../src/routes/contas.routes.js"), "utf-8");
    const linhaExtrato = routesSrc.split("\n").find((l) => l.includes('"/extrato"'));
    expect(linhaExtrato).toMatch(/autenticar/);

    // O service recebe o usuarioId como parâmetro explícito (derivado do
    // token pelo controller) - nunca lê um id de conta arbitrário do query.
    expect(consultarExtrato.length).toBeGreaterThanOrEqual(1);
  });

  test("decisão 3: seleciona transações em que a conta é origem OU destino", async () => {
    prisma.conta.findUnique.mockResolvedValueOnce({ id: CONTA_ID });
    prisma.transacao.findMany.mockResolvedValueOnce([]);
    prisma.transacao.count.mockResolvedValueOnce(0);

    await consultarExtrato(USUARIO_ID);

    const chamada = prisma.transacao.findMany.mock.calls[0][0];
    expect(chamada.where).toEqual({ OR: [{ contaOrigemId: CONTA_ID }, { contaDestinoId: CONTA_ID }] });
  });

  test("decisão 4: classifica cada registro como ENVIADA ou RECEBIDA em relação à conta autenticada", async () => {
    prisma.conta.findUnique.mockResolvedValueOnce({ id: CONTA_ID });
    prisma.transacao.findMany.mockResolvedValueOnce([
      { id: "t-enviada", contaOrigemId: CONTA_ID, contaDestinoId: "outra-conta", valor: 10, status: "CONCLUIDO", criadoEm: new Date(), concluidoEm: new Date() },
      { id: "t-recebida", contaOrigemId: "outra-conta", contaDestinoId: CONTA_ID, valor: 20, status: "CONCLUIDO", criadoEm: new Date(), concluidoEm: new Date() },
    ]);
    prisma.transacao.count.mockResolvedValueOnce(2);

    const resultado = await consultarExtrato(USUARIO_ID);

    expect(resultado.dados.find((t) => t.id === "t-enviada").tipo).toBe("ENVIADA");
    expect(resultado.dados.find((t) => t.id === "t-recebida").tipo).toBe("RECEBIDA");
  });

  test("decisão 5: a resposta contém somente identificador, tipo, valor, status e datas (nada mais)", async () => {
    prisma.conta.findUnique.mockResolvedValueOnce({ id: CONTA_ID });
    prisma.transacao.findMany.mockResolvedValueOnce([
      {
        id: "t1",
        contaOrigemId: CONTA_ID,
        contaDestinoId: "outra-conta",
        valor: 10,
        status: "CONCLUIDO",
        criadoEm: new Date(),
        concluidoEm: new Date(),
        // Campos que NÃO deveriam vazar para a resposta do extrato:
        motivoFalha: null,
      },
    ]);
    prisma.transacao.count.mockResolvedValueOnce(1);

    const resultado = await consultarExtrato(USUARIO_ID);

    expect(Object.keys(resultado.dados[0]).sort()).toEqual(
      ["concluidoEm", "criadoEm", "id", "status", "tipo", "valor"].sort()
    );
  });

  test("decisão 6: ordena do mais recente para o mais antigo, com o id como critério de desempate", async () => {
    prisma.conta.findUnique.mockResolvedValueOnce({ id: CONTA_ID });
    prisma.transacao.findMany.mockResolvedValueOnce([]);
    prisma.transacao.count.mockResolvedValueOnce(0);

    await consultarExtrato(USUARIO_ID);

    const chamada = prisma.transacao.findMany.mock.calls[0][0];
    expect(chamada.orderBy).toEqual([{ criadoEm: "desc" }, { id: "desc" }]);
  });

  test("decisão 7: usa paginação por deslocamento com limite máximo por requisição", async () => {
    prisma.conta.findUnique.mockResolvedValue({ id: CONTA_ID });
    prisma.transacao.findMany.mockResolvedValue([]);
    prisma.transacao.count.mockResolvedValue(0);

    await consultarExtrato(USUARIO_ID, { pagina: 3, porPagina: 10 });
    let chamada = prisma.transacao.findMany.mock.calls[0][0];
    expect(chamada.skip).toBe(20); // (página 3 - 1) * 10
    expect(chamada.take).toBe(10);

    jest.clearAllMocks();
    prisma.conta.findUnique.mockResolvedValue({ id: CONTA_ID });
    prisma.transacao.findMany.mockResolvedValue([]);
    prisma.transacao.count.mockResolvedValue(0);

    // Pedir um limite muito maior que o razoável deve ser CAPADO, não aceito.
    await consultarExtrato(USUARIO_ID, { pagina: 1, porPagina: 999999 });
    chamada = prisma.transacao.findMany.mock.calls[0][0];
    expect(chamada.take).toBeLessThanOrEqual(100);
  });

  test("decisão 8: existem índices compatíveis com consultas por conta de origem, conta de destino e data", () => {
    const schemaSrc = fs.readFileSync(path.join(__dirname, "../../prisma/schema.prisma"), "utf-8");
    const blocoTransacao = schemaSrc.slice(schemaSrc.indexOf("model Transacao"), schemaSrc.indexOf("model Auditoria"));

    expect(blocoTransacao).toMatch(/@@index\(\[contaOrigemId\]\)/);
    expect(blocoTransacao).toMatch(/@@index\(\[contaDestinoId\]\)/);
    expect(blocoTransacao).toMatch(/@@index\(\[criadoEm\]\)/);
  });
});
