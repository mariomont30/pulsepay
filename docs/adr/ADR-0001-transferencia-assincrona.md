# 0002. Processar transferências de forma assíncrona com RabbitMQ e Worker

* **Status:** Aceito
* **Data:** 2026-09-11
* **Feature/Fatia:** Feature 1 — Transferência processada por fila, com status `PENDENTE` e consulta até a conclusão

## Contexto

O PulsePay precisa receber solicitações de transferência sem manter a requisição HTTP aberta durante todo o débito e crédito. Um processamento exclusivamente síncrono aumenta o acoplamento entre a API e a operação financeira, responde pior a picos de demanda e torna falhas temporárias mais difíceis de tratar.

A solicitação deve ser aceita rapidamente, permanecer rastreável e evoluir de `PENDENTE` para um estado final consultável. Conforme o ADR 0001, o PostgreSQL continua sendo a fonte oficial da verdade para saldos, transações e estados.

## Decisão

Vamos adotar o **RabbitMQ como fila de comandos** e um **Worker dedicado** para processar as transferências.

O fluxo será:

1. A API autentica o usuário e valida origem, destino e valor.
2. A transferência é gravada no PostgreSQL com identificador único e status `PENDENTE` antes da publicação na fila.
3. A API publica no RabbitMQ uma mensagem persistente contendo apenas o identificador da transferência e devolve imediatamente esse identificador e o status ao cliente.
4. O Worker consome a mensagem, carrega os dados oficiais no PostgreSQL e realiza débito, crédito e atualização de status dentro de uma transação ACID.
5. Quando o processamento termina, a transação recebe `CONCLUIDO` ou `FALHOU`.
6. O usuário acompanha o resultado por um endpoint autenticado de consulta, acessível somente ao remetente ou ao destinatário.
7. A mensagem recebe confirmação de consumo somente depois do commit no PostgreSQL.

O RabbitMQ não armazenará saldos nem será tratado como fonte de verdade. Retentativas limitadas, idempotência completa, dead-letter queue e auditoria imutável serão aprofundadas na fatia posterior de confiabilidade.

## Alternativas Consideradas

* **Processamento totalmente síncrono na API:** Mais simples no início, porém mantém o usuário aguardando, acopla a requisição à movimentação financeira e absorve pior os picos.
* **Tabela no PostgreSQL consultada periodicamente pelo Worker:** Evita um broker adicional, mas exige polling contínuo, aumenta consultas ao banco e oferece menos recursos nativos de entrega e controle de consumo.
* **Apache Kafka:** Adequado para alto volume de eventos e retenção longa, mas adiciona complexidade operacional desnecessária ao porte acadêmico atual do PulsePay.

## Consequências

* **Positivas:**
  * Resposta rápida da API com operação rastreável desde a solicitação.
  * Desacoplamento entre o recebimento da transferência e sua efetivação.
  * Capacidade de absorver picos sem executar todo o trabalho na requisição HTTP.
  * Preservação da consistência financeira pelo PostgreSQL e por transações ACID.
  * Possibilidade de escalar API e Worker separadamente no futuro.
* **Negativas:**
  * Consistência eventual: o usuário poderá visualizar o estado `PENDENTE` antes da conclusão.
  * Inclusão de RabbitMQ e Worker aumenta a complexidade de execução, monitoramento e suporte.
  * Uma falha entre o commit no PostgreSQL e a publicação pode deixar uma transação pendente, exigindo reconciliação ou padrão Outbox em uma evolução posterior.
  * Reentregas são possíveis e exigirão idempotência para impedir processamento duplicado.
  * A consulta de status ou uma notificação será necessária para atualizar a experiência do usuário.
