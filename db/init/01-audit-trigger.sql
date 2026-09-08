-- Este script roda automaticamente na primeira inicialização do container Postgres
-- (montado em /docker-entrypoint-initdb.d). As tabelas em si são criadas pelo Prisma
-- Migrate; aqui só garantimos a trigger de imutabilidade da auditoria, que é criada
-- de forma idempotente via função + trigger condicional (aplicada após o migrate
-- criar a tabela "Auditoria", ver instruções no run.txt).

CREATE OR REPLACE FUNCTION bloquear_alteracao_auditoria()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Tabela de auditoria é append-only: operações UPDATE/DELETE não são permitidas';
END;
$$ LANGUAGE plpgsql;

-- A trigger abaixo só pode ser criada depois que a tabela "Auditoria" existir
-- (criada pelo `npx prisma migrate dev` do backend). Por isso este bloco é
-- protegido com verificação de existência e pode ser reexecutado com segurança
-- via `docker exec` conforme descrito no run.txt.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Auditoria') THEN
        DROP TRIGGER IF EXISTS trg_bloquear_alteracao_auditoria ON "Auditoria";
        CREATE TRIGGER trg_bloquear_alteracao_auditoria
        BEFORE UPDATE OR DELETE ON "Auditoria"
        FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao_auditoria();
    END IF;
END $$;
