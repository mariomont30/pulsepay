/**
 * Teste de concorrência / race condition (README seções 4 e 7).
 * Dispara N transferências simultâneas saindo da MESMA conta, com soma total
 * maior que o saldo disponível, e valida que:
 *   1) o saldo final da conta de origem nunca fica negativo;
 *   2) o saldo final é matematicamente consistente com as transferências
 *      que de fato foram concluídas (nem mais, nem menos);
 *   3) pelo menos uma das transferências falha por saldo insuficiente
 *      (prova de que o lock pessimista está de fato serializando o acesso,
 *      e não deixando todas passarem "otimisticamente").
 *
 * Uso:
 *   API_URL=http://localhost:4000 node scripts/testar-concorrencia.js
 */
const { criarUsuarioDeTeste, chamarApi, esperarStatusFinal } = require("./lib/api-client");

const SALDO_INICIAL = 1000; // definido em auth.service.js ao registrar
const QUANTIDADE_TRANSFERENCIAS = 5;
const VALOR_CADA = 300; // 5 x 300 = 1500 > 1000 de saldo -> deve haver falha(s)

async function main() {
  console.log("[teste-concorrencia] criando conta de origem e destino...");
  const origem = await criarUsuarioDeTeste("concorrencia-origem");
  const destino = await criarUsuarioDeTeste("concorrencia-destino");

  console.log(
    `[teste-concorrencia] disparando ${QUANTIDADE_TRANSFERENCIAS} transferências simultâneas de R$ ${VALOR_CADA} ` +
      `(total R$ ${QUANTIDADE_TRANSFERENCIAS * VALOR_CADA}, saldo disponível R$ ${SALDO_INICIAL})...`
  );

  const solicitacoes = await Promise.all(
    Array.from({ length: QUANTIDADE_TRANSFERENCIAS }, () =>
      chamarApi("/transferencias", {
        method: "POST",
        token: origem.token,
        body: { emailDestino: destino.email, valor: VALOR_CADA },
      })
    )
  );

  const aceitas = solicitacoes.filter((s) => s.status === 202);
  console.log(`[teste-concorrencia] ${aceitas.length}/${QUANTIDADE_TRANSFERENCIAS} solicitações aceitas como PENDENTE`);

  const statusFinais = await Promise.all(
    aceitas.map((s) => esperarStatusFinal(origem.token, s.dados.id))
  );

  const concluidas = statusFinais.filter((t) => t.status === "CONCLUIDO");
  const falhadas = statusFinais.filter((t) => t.status === "FALHOU");

  console.log(`[teste-concorrencia] resultado final: ${concluidas.length} CONCLUÍDA(S), ${falhadas.length} FALHOU(FALHARAM)`);

  const { status, dados: saldoFinal } = await chamarApi("/contas/saldo", { token: origem.token });
  if (status !== 200) throw new Error("Falha ao consultar saldo final");

  const saldoEsperado = SALDO_INICIAL - concluidas.length * VALOR_CADA;
  console.log(`[teste-concorrencia] saldo final: R$ ${saldoFinal.saldo} (esperado: R$ ${saldoEsperado})`);

  // 1) Saldo nunca pode ficar negativo
  if (Number(saldoFinal.saldo) < 0) {
    throw new Error(`FALHA CRÍTICA: saldo final ficou negativo (R$ ${saldoFinal.saldo}) - race condition não foi evitada!`);
  }

  // 2) Saldo final deve ser exatamente consistente com o que foi de fato concluído
  if (Number(saldoFinal.saldo) !== saldoEsperado) {
    throw new Error(
      `FALHA: saldo final (R$ ${saldoFinal.saldo}) não corresponde ao esperado (R$ ${saldoEsperado}) - ` +
        `possível inconsistência/duplicação na efetivação`
    );
  }

  // 3) Como o total solicitado excede o saldo, pelo menos uma deve ter falhado
  if (falhadas.length === 0) {
    throw new Error(
      "FALHA: nenhuma transferência falhou por saldo insuficiente, mas o total solicitado excede o saldo disponível - " +
        "o lock pessimista pode não estar funcionando"
    );
  }

  console.log("[teste-concorrencia] OK - saldo nunca ficou negativo e é consistente com o processamento serializado");
  process.exit(0);
}

main().catch((err) => {
  console.error("[teste-concorrencia] FALHOU:", err.message);
  process.exit(1);
});
