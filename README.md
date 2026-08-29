# PulsePay — Pagamentos Instantâneos

Projeto acadêmico da Equipe 01 para uma fintech de transferências instantâneas entre usuários finais e pequenos comerciantes.

## Entrega atual

| Entrega | Estado |
|---|---|
| 1 — Plano de Desenvolvimento e Arquitetura | Concluída em 29/08/2026 |
| 2 — CI / MVP (Front e Back) | Aguardando aprovação da Entrega 1 |
| 3 — Observabilidade | Aguardando aprovação da Entrega 2 |
| 4 — Plano de Teste e de Escala | Aguardando aprovação da Entrega 3 |

O documento da Entrega 1 contém a visão arquitetural, escopo, cronograma das quatro aulas, estratégias de testes e segurança, plano de operação/capacidade e matriz de riscos:

- [Plano de Desenvolvimento e Arquitetura](docs/entrega-1-plano-desenvolvimento-arquitetura.md)

## Decisão arquitetural em uma frase

O MVP adota um **monólito modular orientado a eventos**: o PostgreSQL é a fonte de verdade do núcleo financeiro e grava transferência, partidas de razão, auditoria e Outbox na mesma transação; o RabbitMQ distribui apenas os efeitos posteriores ao commit, com confirmação de publicação, consumidores idempotentes, retentativas e DLQ.

## Autoria

Autoria exclusiva de **Mário_DEV** (`mario_gmm@hotmail.com`). Consulte [AUTHORS.md](AUTHORS.md) e [NOTICE](NOTICE).

## Uso

Este repositório é um trabalho acadêmico. Todos os direitos estão reservados ao autor; nenhum direito de redistribuição ou relicenciamento é concedido implicitamente.
