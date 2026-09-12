-- CreateIndex
-- ADR-0003, ponto 8: "Serão criados índices compatíveis com as consultas
-- por conta de origem, conta de destino e data."
CREATE INDEX "Transacao_criadoEm_idx" ON "Transacao"("criadoEm");
