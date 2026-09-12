# Architecture Decision Records — PulsePay

Registro das decisões arquiteturais aceitas para o projeto. Cada ADR tem
uma suíte de testes de conformidade correspondente em
`backend/tests/adr/`, rodada pelo workflow `.github/workflows/adr-compliance.yml`
(não bloqueante — ver seção "Pipeline de conformidade" no `run.txt`).

| ADR | Decisão | Testes de conformidade |
| --- | --- | --- |
| [ADR-0001](./ADR-0001-transferencia-assincrona.md) | Processar transferências de forma assíncrona com RabbitMQ e Worker | `backend/tests/adr/adr-0001-transferencia-assincrona.test.js`, `backend/tests/adr/adr-0001-worker-confirmacao.test.js` |
| [ADR-0002](./ADR-0002-autenticacao-JWT.md) | Usar JWT expirável para proteger sessões e rotas | `backend/tests/adr/adr-0002-autenticacao-jwt.test.js` |
| [ADR-0003](./ADR-0003-extrato-cronologico.md) | Consultar o extrato cronológico diretamente no PostgreSQL | `backend/tests/adr/adr-0003-extrato-cronologico.test.js` |

Documentos de produto relacionados (priorização e fatias de feature que
originaram estes ADRs) estão em `../product/`.
