const assert = require('assert/strict');
const prisma = require('../src/config/prisma');
const { efetivarTransferencia } = require('../worker/worker');
(async () => {
  let erroEsperado;
  try { await efetivarTransferencia(process.argv[2]); }
  catch (err) { erroEsperado = err; }
  assert(erroEsperado && /check constraint|validacao_credito_destino/i.test(erroEsperado.message), 'A restrição de crédito deveria provocar rollback');
  console.log(JSON.stringify({expectedFailure:true,prismaCode:erroEsperado.code,scenario:'falha de crédito sob restrição temporária'}));
})().catch(err => { console.error(err); process.exitCode = 1; }).finally(() => prisma.$disconnect());
