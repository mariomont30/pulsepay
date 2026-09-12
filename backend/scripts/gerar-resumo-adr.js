/**
 * Lê o resultado JSON do Jest (tests/adr) e gera uma tabela Markdown de
 * conformidade com os ADRs, agrupada por arquivo de teste (1 arquivo = 1
 * ADR). Pensado para alimentar o Job Summary do GitHub Actions
 * (adr-compliance.yml), mas roda em qualquer lugar:
 *
 *   npx jest --config jest.adr.config.js --json --outputFile=reports/adr-results.json || true
 *   node scripts/gerar-resumo-adr.js reports/adr-results.json
 */
const fs = require("fs");
const path = require("path");

const caminhoJson = process.argv[2] || path.join(__dirname, "..", "reports", "adr-results.json");

if (!fs.existsSync(caminhoJson)) {
  console.error(`Arquivo de resultados não encontrado: ${caminhoJson}`);
  process.exit(1);
}

const resultado = JSON.parse(fs.readFileSync(caminhoJson, "utf-8"));

function nomeAdr(caminhoArquivo) {
  const base = path.basename(caminhoArquivo, ".test.js");
  return base.replace(/^adr-/, "ADR-").replace(/-/g, " ");
}

let linhas = [];
linhas.push("# Relatório de Conformidade com os ADRs\n");
linhas.push(
  `**Resumo geral:** ${resultado.numPassedTests} passaram, ${resultado.numFailedTests} falharam, ` +
    `${resultado.numPendingTests || 0} pendentes, de ${resultado.numTotalTests} verificações no total.\n`
);
linhas.push(
  "> Esta suíte verifica se o código implementa fielmente as decisões registradas nos ADRs. " +
    "Ela **não bloqueia o pipeline** (roda com `continue-on-error`) — o objetivo é dar visibilidade " +
    "contínua sobre eventuais desvios entre o que foi decidido e o que foi implementado.\n"
);

for (const suite of resultado.testResults) {
  linhas.push(`## ${nomeAdr(suite.name)}`);
  linhas.push("");
  linhas.push("| Status | Verificação |");
  linhas.push("| --- | --- |");
  for (const caso of suite.assertionResults) {
    const status = caso.status === "passed" ? "✅" : caso.status === "pending" ? "⏭️" : "❌";
    linhas.push(`| ${status} | ${caso.title} |`);
  }
  linhas.push("");
}

const markdown = linhas.join("\n");
console.log(markdown);

const destino = process.env.GITHUB_STEP_SUMMARY;
if (destino) {
  fs.appendFileSync(destino, markdown);
}
