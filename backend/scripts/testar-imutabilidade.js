/**
 * Teste de imutabilidade da auditoria (README seção 4).
 * Conecta diretamente no Postgres (fora do Prisma) e tenta UPDATE/DELETE
 * na tabela "Auditoria", validando que a trigger de bloqueio
 * (db/init/01-audit-trigger.sql) realmente impede a alteração.
 *
 * Pré-requisito: já deve existir ao menos uma linha em "Auditoria" (rode
 * scripts/testar-fluxo-assincrono.js antes, ou qualquer transferência real,
 * para garantir isso).
 *
 * Uso:
 *   DATABASE_URL=postgresql://user:pass@localhost:5432/pulsepay node scripts/testar-imutabilidade.js
 */
const { Client } = require("pg");

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const { rows } = await client.query('SELECT id FROM "Auditoria" LIMIT 1');
    if (rows.length === 0) {
      throw new Error(
        'Nenhuma linha em "Auditoria" para testar. Rode uma transferência real primeiro ' +
          "(ex.: scripts/testar-fluxo-assincrono.js)."
      );
    }
    const { id } = rows[0];
    console.log(`[teste-imutabilidade] usando linha de auditoria id=${id}`);

    let updateBloqueado = false;
    try {
      await client.query('UPDATE "Auditoria" SET evento = $1 WHERE id = $2', ["TENTATIVA_HACK", id]);
    } catch (err) {
      updateBloqueado = /append-only/i.test(err.message);
      if (!updateBloqueado) throw err;
    }

    let deleteBloqueado = false;
    try {
      await client.query('DELETE FROM "Auditoria" WHERE id = $1', [id]);
    } catch (err) {
      deleteBloqueado = /append-only/i.test(err.message);
      if (!deleteBloqueado) throw err;
    }

    if (!updateBloqueado || !deleteBloqueado) {
      throw new Error(
        `FALHA CRÍTICA: trigger de imutabilidade não bloqueou a operação ` +
          `(UPDATE bloqueado: ${updateBloqueado}, DELETE bloqueado: ${deleteBloqueado}). ` +
          "A tabela de auditoria pode ter sido alterada/apagada indevidamente!"
      );
    }

    console.log("[teste-imutabilidade] OK - UPDATE e DELETE foram corretamente bloqueados pela trigger");
    process.exit(0);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[teste-imutabilidade] FALHOU:", err.message);
  process.exit(1);
});
