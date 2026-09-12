module.exports = {
  testEnvironment: "node",
  // Exclui tests/adr do `npm test` padrão de propósito: aquela suíte
  // verifica conformidade com os ADRs e pode legitimamente ter casos
  // falhando (gaps documentados) sem que isso reprove o pipeline
  // principal. Ela roda separadamente via `npm run test:adr` /
  // jest.adr.config.js e no workflow adr-compliance.yml.
  testMatch: ["**/tests/unit/**/*.test.js", "**/tests/integration/**/*.test.js"],
  verbose: true,
};
