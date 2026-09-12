# 0004. Consultar o extrato cronológico diretamente no PostgreSQL

* **Status:** Aceito
* **Data:** 2026-09-11
* **Feature/Fatia:** Feature 3 — Extrato com transferências enviadas e recebidas, valor, data e status

## Contexto

O usuário precisa compreender como seu saldo foi formado e acompanhar tanto as transferências enviadas quanto as recebidas. A consulta deve apresentar informações consistentes com a movimentação financeira e não pode expor transações de outras contas.

O ADR 0001 define o PostgreSQL como banco oficial do PulsePay. Como as transferências e seus estados já são persistidos nesse banco, criar uma segunda base apenas para o primeiro extrato aumentaria a complexidade e poderia produzir divergências. Ao mesmo tempo, a consulta precisa ser limitada e indexada para não degradar conforme o histórico crescer.

## Decisão

Vamos gerar o **extrato cronológico diretamente a partir da tabela de transações do PostgreSQL**.

O fluxo será:

1. O usuário autenticado solicita o extrato por uma rota protegida.
2. A API identifica a conta pelo `sub` do JWT, sem aceitar um identificador arbitrário de usuário ou conta.
3. A consulta seleciona transações em que a conta seja a origem ou o destino.
4. Cada registro é classificado como `ENVIADA` ou `RECEBIDA` em relação à conta autenticada.
5. A resposta contém somente identificador, tipo, valor, data e status da operação.
6. Os itens são ordenados do mais recente para o mais antigo por data de criação, com o identificador como segundo critério para manter uma ordem estável.
7. A API usa paginação e limite máximo por requisição.
8. Serão criados índices compatíveis com as consultas por conta de origem, conta de destino e data.

O PostgreSQL permanece como fonte de verdade também para operações `PENDENTE`, `CONCLUIDO` e `FALHOU`. A auditoria não será usada para calcular o extrato, pois representa eventos técnicos e não o estado financeiro consolidado.

## Alternativas Consideradas

* **Calcular o extrato a partir da tabela de auditoria:** Oferece muitos eventos, mas exige reconstruir o estado das transações e pode exibir duplicidades ou detalhes técnicos inadequados ao usuário.
* **Criar imediatamente um banco ou modelo de leitura separado:** Pode melhorar consultas em grande escala, porém introduz sincronização e consistência eventual sem necessidade no volume atual.
* **Buscar todo o histórico sem paginação:** É simples para poucos registros, mas aumenta memória, tráfego e tempo de resposta conforme o uso cresce.

## Consequências

* **Positivas:**
  * O extrato reflete os mesmos dados oficiais usados no processamento das transferências.
  * Consultas relacionais permitem reunir entradas e saídas de forma consistente.
  * Autorização baseada no JWT impede a escolha de uma conta de terceiros.
  * Ordenação estável e paginação mantêm a experiência previsível conforme o histórico aumenta.
  * A solução aproveita a infraestrutura já adotada e evita uma segunda fonte de verdade.
* **Negativas:**
  * A consulta com origem ou destino exige índices adequados e acompanhamento de desempenho.
  * O banco transacional também passa a atender leituras de histórico.
  * Relatórios complexos e grande volume poderão exigir réplica de leitura ou modelo especializado no futuro.
  * Operações pendentes podem mudar de status entre duas páginas, exigindo atualização posterior da interface.
  * Paginação por deslocamento pode perder estabilidade em históricos muito ativos; nesse cenário, deverá evoluir para cursor.
