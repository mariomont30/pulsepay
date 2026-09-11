## Features priorizadas

### Projeto: `PulsePay`
### Equipe: `Victor Sabino, Kayan Kayser e Mário Gonçalves`

---

### 🥇 Feature 1 — `Transferência assíncrona com processamento confiável`

- **Problema real que ela resolve:** Permite que usuários transfiram valores entre contas sem depender de um processamento síncrono frágil, mantendo a operação rastreável mesmo sob picos ou falhas pontuais.
- **Critério(s) de prioridade que mais pesaram:** É o fluxo principal de valor da fintech; consistência financeira, confiabilidade e aderência ao objetivo acadêmico de processamento distribuído tiveram o maior peso.
- **Em uma frase o que seria a aplicação utópica:** Uma transferência instantânea, sempre consistente, confirmada em até 2 segundos e auditável de ponta a ponta, mesmo em alta demanda.
- **E qual seria um MVP comercializável?** API autenticada para solicitar transferência entre duas contas, publicação da solicitação no RabbitMQ e worker dedicado para validar saldo, debitar, creditar e registrar o resultado; status consultável pelo usuário e confirmação em até 2 segundos no cenário de teste.

---

### 🥈 Feature 2 — `Cadastro com KYC básico e autenticação JWT`

- **Problema real que ela resolve:** Garante que cada conta pertença a um usuário identificado no contexto simulado e impede acesso não autorizado a saldo, extrato e transferências.
- **Critério(s) de prioridade que mais pesaram:** Segurança mínima obrigatória para uma aplicação financeira, proteção de dados de conta e pré-requisito para todo o fluxo autenticado.
- **O "elefante" dela:** Uma identidade digital robusta, com validação documental real, prevenção a fraude, MFA e controles de acesso bancários.
- **A primeira fatia:** Cadastro com nome, CPF fictício e e-mail; login que emite JWT; middleware que exige token válido nas rotas de conta e transferência; senhas armazenadas com hash.

---

### 🥉 Feature 3 — `Conta digital: saldo e extrato de transações`

- **Problema real que ela resolve:** Dá transparência ao usuário sobre o dinheiro disponível e sobre todas as transferências recebidas e enviadas, reduzindo incerteza após uma solicitação de pagamento.
- **Critério(s) de prioridade que mais pesaram:** Valor visível para o usuário, dependência direta do fluxo de transferência e apoio à rastreabilidade e auditoria do sistema.
- **O "elefante" dela:** Uma experiência completa de conta digital, com filtros avançados, comprovantes, categorias, conciliação e relatórios financeiros.
- **A primeira fatia:** Endpoint autenticado de saldo e endpoint de extrato cronológico contendo transferências de entrada e saída, valor, data, status e identificador da operação.

---

### Ficou de fora (e por quê)

Listem pelo menos 2 features que a equipe considerou e decidiu **não** priorizar agora. Uma linha de justificativa basta.

| Feature descartada | Por que não entrou entre as 3 |
| --- | --- |
| Notificação em tempo real ao destinatário | Agrega experiência de uso, mas depende do fluxo de transferência estar estável e não é necessária para validar a consistência financeira central. |
| Observabilidade com Prometheus e Grafana | É essencial para validar SLA, latência e throughput na etapa de qualidade, porém não entrega diretamente a primeira jornada do usuário nem desbloqueia o processamento da transação. |

---
