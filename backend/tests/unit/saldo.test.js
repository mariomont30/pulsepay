const {
  possuiSaldoSuficiente,
  calcularNovoSaldoAposDebito,
  calcularNovoSaldoAposCredito,
} = require("../../src/utils/saldo");
const { transferenciaSchema, registroSchema } = require("../../src/schemas/validation.schemas");

describe("regras de saldo", () => {
  test("deve considerar saldo suficiente quando igual ao valor", () => {
    expect(possuiSaldoSuficiente(100, 100)).toBe(true);
  });

  test("deve considerar saldo insuficiente quando valor é maior que o saldo", () => {
    expect(possuiSaldoSuficiente(50, 100)).toBe(false);
  });

  test("deve debitar corretamente quando há saldo suficiente", () => {
    expect(calcularNovoSaldoAposDebito(100, 40)).toBe(60);
  });

  test("deve lançar erro ao debitar valor maior que o saldo", () => {
    expect(() => calcularNovoSaldoAposDebito(50, 100)).toThrow("saldo negativo");
  });

  test("deve creditar corretamente", () => {
    expect(calcularNovoSaldoAposCredito(100, 40)).toBe(140);
  });
});

describe("validação de payloads (zod)", () => {
  test("transferenciaSchema deve rejeitar valor negativo", () => {
    const resultado = transferenciaSchema.safeParse({
      contaDestinoId: "550e8400-e29b-41d4-a716-446655440000",
      valor: -10,
    });
    expect(resultado.success).toBe(false);
  });

  test("transferenciaSchema deve aceitar payload válido", () => {
    const resultado = transferenciaSchema.safeParse({
      contaDestinoId: "550e8400-e29b-41d4-a716-446655440000",
      valor: 150.5,
    });
    expect(resultado.success).toBe(true);
  });

  test("registroSchema deve rejeitar CPF fictício fora do padrão", () => {
    const resultado = registroSchema.safeParse({
      nome: "Fulano de Tal",
      email: "fulano@example.com",
      cpf: "123",
      senha: "senha123",
    });
    expect(resultado.success).toBe(false);
  });
});
