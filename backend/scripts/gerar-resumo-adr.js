/**
 * Lê um ou mais resultados JSON do Jest (tests/adr) e gera uma tabela
 * Markdown de conformidade com os ADRs, agrupada por arquivo de teste
 * (1 arquivo = 1 ADR, ou uma fatia dele). Pensado para alimentar o Job
 * Summary do GitHub Actions (adr-compliance.yml), mas roda em qualquer
 * lugar. Aceita 1 ou vários arquivos JSON de uma vez - o cabeçalho e o
 * resumo geral aparecem UMA ÚNICA VEZ, com os totais somados entre todos
 * os arquivos passados:
 *
 *   npx jest --config jest.adr.config.js --json --outputFile=reports/adr-results.json || true
 *   node scripts/gerar-resumo-adr.js reports/adr-results.json
 *
 *   # ou vários de uma vez (ex.: um por ADR, como no adr-compliance.yml):
 *   node scripts/gerar-resumo-adr.js reports/adr-0001.json reports/adr-0002.json reports/adr-0003.json
 */
const fs = require("fs");
const path = require("path");

const caminhosJson = process.argv.slice(2);
if (caminhosJson.length === 0) {
  caminhosJson.push(path.join(__dirname, "..", "reports", "adr-results.json"));
}

const resultados = [];
for (const caminho of caminhosJson) {
  if (!fs.existsSync(caminho)) {
    console.error(`Arquivo de resultados não encontrado, pulando: ${caminho}`);
    continue;
  }
  resultados.push(JSON.parse(fs.readFileSync(caminho, "utf-8")));
}

if (resultados.length === 0) {
  console.error("Nenhum arquivo de resultados válido foi encontrado.");
  process.exit(1);
}

function nomeAdr(caminhoArquivo) {
  const base = path.basename(caminhoArquivo, ".test.js");
  return base.replace(/^adr-/, "ADR-").replace(/-/g, " ");
}

// Soma os totais de todos os arquivos passados, para o resumo geral
// refletir o conjunto inteiro (ex.: os 3 ADRs juntos), não só o último.
const totais = resultados.reduce(
  (acc, r) => ({
    passaram: acc.passaram + r.numPassedTests,
    falharam: acc.falharam + r.numFailedTests,
    pendentes: acc.pendentes + (r.numPendingTests || 0),
    total: acc.total + r.numTotalTests,
  }),
  { passaram: 0, falharam: 0, pendentes: 0, total: 0 }
);

let linhas = [];
linhas.push("# Relatório de Conformidade com os ADRs\n");
linhas.push(
  `**Resumo geral:** ${totais.passaram} passaram, ${totais.falharam} falharam, ` +
    `${totais.pendentes} pendentes, de ${totais.total} verificações no total.\n`
);
linhas.push(
  "> Esta suíte verifica se o código implementa fielmente as decisões registradas nos ADRs. " +
    "Ela **não bloqueia o pipeline** (roda com `continue-on-error`) — o objetivo é dar visibilidade " +
    "contínua sobre eventuais desvios entre o que foi decidido e o que foi implementado.\n"
);

for (const resultado of resultados) {
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
}

const markdown = linhas.join("\n");
console.log(markdown);

const destino = process.env.GITHUB_STEP_SUMMARY;
if (destino) {
  fs.appendFileSync(destino, markdown);
}