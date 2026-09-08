/**
 * Regra de negócio pura (sem I/O) usada tanto pela API quanto pelo Worker
 * para checar se uma conta tem saldo suficiente para uma transferência.
 * Extraída em função própria para facilitar teste unitário isolado
 * (ver README seção 4 - Estratégia de Testes).
 */
function possuiSaldoSuficiente(saldoAtual, valor) {
  return Number(saldoAtual) >= Number(valor);
}

function calcularNovoSaldoAposDebito(saldoAtual, valor) {
  const novoSaldo = Number(saldoAtual) - Number(valor);
  if (novoSaldo < 0) {
    throw new Error("Operação resultaria em saldo negativo");
  }
  return novoSaldo;
}

function calcularNovoSaldoAposCredito(saldoAtual, valor) {
  return Number(saldoAtual) + Number(valor);
}

module.exports = { possuiSaldoSuficiente, calcularNovoSaldoAposDebito, calcularNovoSaldoAposCredito };
