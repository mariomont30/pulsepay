# Fatias das Features — PulsePay

## Feature 1 — Transferência assíncrona com processamento confiável

1. Transferência direta entre duas contas, com validação de saldo, débito e crédito atômicos e exibição do resultado ao usuário.

2. Transferência processada por fila (RabbitMQ e Worker), com status `PENDENTE` na solicitação e consulta até a conclusão.

3. Transferência confiável mesmo com concorrência ou falhas, usando idempotência, retentativas, auditoria e confirmação em até 2 segundos no cenário de teste.

---

## Feature 2 — Cadastro com KYC básico e autenticação JWT

1. Cadastro e login com nome, e-mail e senha protegida por hash, liberando o acesso do usuário à própria conta.

2. Inclusão do CPF fictício no cadastro, com validação de formato e bloqueio de e-mail ou CPF duplicado.

3. Sessão com JWT expirável, proteção das rotas de saldo, extrato e transferência e logout seguro ao encerrar ou expirar a sessão.

---

## Feature 3 — Conta digital: saldo e extrato de transações

1. Exibição do saldo atualizado da conta para o usuário autenticado.

2. Extrato cronológico com transferências enviadas e recebidas, mostrando valor, data e status.

3. Consulta detalhada da transação, com filtros no extrato, acompanhamento do status e comprovante das operações concluídas.
