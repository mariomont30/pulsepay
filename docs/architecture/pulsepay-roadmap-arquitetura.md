# PulsePay — Roadmap de Evolução Arquitetural | 6 meses

**Data da análise:** 12/09/2026  
**Horizonte:** 12/09/2026 a 11/03/2027, em seis ciclos mensais  
**Repositório:** [mariomont30/pulsepay](https://github.com/mariomont30/pulsepay)  
**Versão analisada:** [`35167aaf5e7e1000aa06b9d25cd80682073bb4ba`](https://github.com/mariomont30/pulsepay/tree/35167aaf5e7e1000aa06b9d25cd80682073bb4ba) — branch `main`  
**Escopo:** arquitetura, consistência, infraestrutura, segurança técnica, qualidade, observabilidade, desempenho e operação.

> Este roadmap não adiciona funcionalidades de produto. Cadastro, autenticação, saldo, extrato, transferência e notificação permanecem como jornadas existentes. Nenhuma etapa inclui Pix real, cobrança, cashback, novos meios de pagamento, MFA ou relatórios de negócio.

## 1. Resumo executivo

A arquitetura atual — monólito modular, PostgreSQL, RabbitMQ e Worker separado — é adequada como ponto de partida. O problema prioritário não é a ausência de microsserviços, mas a distância entre uma implementação acadêmica de host único e uma operação distribuída que preserve consistência durante falhas.

A evolução recomendada é manter o núcleo financeiro no PostgreSQL e tornar as unidades de execução independentes, observáveis, idempotentes e substituíveis. A multiplicação de réplicas só deve ocorrer depois de corrigir os riscos de duplicação e publicação de mensagens. A alta disponibilidade será construída por redundância entre domínios de falha, não apenas por `restart: unless-stopped`.

| Ciclo | Período | Objetivo principal | Marco de saída |
| --- | --- | --- | --- |
| **Mês 1** | 12/09–11/10/2026 | Padronizar execução e estabelecer governança arquitetural | Builds reproduzíveis e contratos protegidos pelo CI |
| **Mês 2** | 12/10–11/11/2026 | Garantir consistência entre banco, fila e processamento | Outbox e idempotência concorrente validadas |
| **Mês 3** | 12/11–11/12/2026 | Medir corretamente e remover gargalos comprovados | SLOs, orçamento de capacidade e restauração testados |
| **Mês 4** | 12/12/2026–11/01/2027 | Executar com múltiplas réplicas e entrega contínua real | Homologação multi-host com deploy e rollback automatizados |
| **Mês 5** | 12/01–11/02/2027 | Remover pontos únicos de falha dos componentes de estado | PostgreSQL, RabbitMQ e transporte de sockets redundantes |
| **Mês 6** | 12/02–11/03/2027 | Comprovar recuperação, capacidade e estabilidade | Evidências de failover, DR, SLOs e prontidão operacional |

### Premissas e limites

- A análise é estática, complementada pela consulta dos workflows. Não foram executados novos testes de carga, benchmarks ou experimentos de falha nesta tarefa.
- Os números de desempenho abaixo são metas propostas para validação, não capacidades já comprovadas.
- Assume-se uma equipe pequena, com apoio de infraestrutura e orçamento para homologação multi-host a partir do mês 4. Seleção de provedor, contratação e provisionamento dependem de aprovação da equipe.
- O projeto continua usando dados e saldos fictícios. A evolução para HA amplia a arquitetura além do escopo local do README, mas não autoriza operação financeira real nem substitui avaliação regulatória.
- Um mês não é considerado concluído apenas porque seus arquivos foram criados: os critérios de avanço devem produzir evidências verificáveis.

## 2. Diagnóstico da stack e da estrutura atual

### 2.1 Stack observada

| Camada | Implementação no snapshot | Implicação arquitetural |
| --- | --- | --- |
| Backend | JavaScript/CommonJS, Node.js, Express 4 e Zod | Há separação entre rotas, controllers e services, mas domínio e infraestrutura ainda se acoplam diretamente. |
| Execução | API e Worker em processos distintos, derivados da mesma imagem | Já existe uma boa divisão de unidades escaláveis, sem necessidade de extrair serviços de negócio. |
| Persistência | PostgreSQL 16, Prisma 5 e valores `Decimal(14,2)` | Base adequada para ACID; comparações monetárias ainda convertem para `Number` no código. |
| Mensageria | `amqplib`, fila durable, mensagens persistent e consumo manual | Persistência e ack existem; faltam publisher confirms, Outbox e recuperação completa dos consumidores. |
| Frontend | React 18, Vite 5, Axios e Socket.IO Client 4 | Pode ser distribuído como ativo estático; o endereço da API está incorporado no build. |
| Identidade | JWT expirável e bcrypt | Sem estado de sessão no servidor; requer configuração segura, tratamento de expiração e coordenação de chaves entre réplicas. |
| Observabilidade | `prom-client`, Prometheus e Grafana | Instrumentação inicial existe, mas ainda não comprova o SLO ponta a ponta. |
| Qualidade | Jest, Supertest, testes de ADR, scripts reais de integração e k6 | Boa base existente; mocks e verificações estáticas não substituem testes distribuídos com infraestrutura real. |
| Entrega e operação | GitHub Actions, Docker e Docker Compose | Build e testes existem; publicação de release e deploy real ainda não estão implementados. |

As versões citadas são as linhas declaradas nos manifests ou Dockerfiles, não uma afirmação sobre o runtime implantado. Os arquivos Docker usam Node 20, enquanto o CI usa Node 22. Na data da análise, Node 20 está EOL e Node 24 é LTS, tornando a padronização do runtime uma prioridade imediata. [Manifests e estrutura do projeto](https://github.com/mariomont30/pulsepay/tree/35167aaf5e7e1000aa06b9d25cd80682073bb4ba), [ciclo oficial do Node.js](https://nodejs.org/en/about/previous-releases).

### 2.2 Riscos que orientam a sequência

| Prioridade | Evidência no código | Risco e resposta no roadmap |
| --- | --- | --- |
| **Crítica** | A API grava `Transacao`, grava `Auditoria` e depois publica no RabbitMQ em operações separadas. | Uma falha intermediária deixa dados ou comandos incompletos. Corrigir com commit único de transação, auditoria e Outbox no mês 2. |
| **Crítica** | O Worker verifica `PENDENTE` antes de entrar na transação e adquirir locks de contas. | Duas execuções podem ler o mesmo estado e ambas efetivar a mesma transferência. Revalidar sob lock da própria transação no mês 2. |
| **Alta** | A notificação é publicada depois do commit financeiro. | Falha nessa publicação pode perder a notificação; a reentrega encontra a transação concluída e a ignora. Persistir também esse evento em Outbox no mês 2. |
| **Alta** | O consumidor usa `nack(..., true)` sem limite; o parse do JSON ocorre fora do bloco de tratamento. | Retentativas infinitas e mensagens inválidas podem consumir recursos continuamente. Classificar erros, limitar tentativas e criar DLQ no mês 2. |
| **Alta** | Reconexão recria o canal, mas não reinstala explicitamente os consumidores; o bootstrap da API espera o broker. | Conexão recuperada não significa consumo recuperado; indisponibilidade da fila pode impedir até consultas. Separar capacidades e restaurar subscriptions no mês 2. |
| **Alta** | Cronômetro de confirmação começa dentro do Worker; `/health` sempre responde `ok`; dashboard usa `up`. | Tempo de fila fica fora da latência; coleta de métricas não equivale a disponibilidade da jornada. Corrigir os SLIs no mês 3. |
| **Alta** | Compose define uma instância de cada serviço e `container_name` fixo. | Host, banco e broker são pontos únicos de falha; replicação limitada. Corrigir execução no mês 4 e estado no mês 5. |
| **Alta** | Notificação é consumida por uma API e enviada a rooms apenas locais. | Com várias APIs, o consumidor pode não hospedar o socket do usuário. Adotar dispatcher e adapter distribuído no mês 4. |
| **Média** | Extrato usa offset, `count` por consulta e índices individuais; pools são configurados por processo. | Crescimento do histórico e do número de réplicas pressiona o banco. Medir planos, introduzir cursor e orçamento global de conexões no mês 3. |
| **Média** | Segredo JWT tem fallback de desenvolvimento, CORS aberto e frontend sem tratamento centralizado de `401`. | Configuração insegura e divergência de comportamento entre HTTP e sockets. Endurecer sem alterar funcionalidades no mês 1. |
| **Média** | CI usa `npm install`, não executa lint e mantém ADR/k6 não bloqueantes; deploy é placeholder. | Build verde não garante conformidade ou entrega reproduzível. Evoluir gates no mês 1 e CD no mês 4. |

Esses riscos são inferências da implementação, não incidentes de produção comprovados. As evidências principais estão no [serviço de transferência](https://github.com/mariomont30/pulsepay/blob/35167aaf5e7e1000aa06b9d25cd80682073bb4ba/backend/src/services/transferencia.service.js), [Worker](https://github.com/mariomont30/pulsepay/blob/35167aaf5e7e1000aa06b9d25cd80682073bb4ba/backend/worker/worker.js), [configuração do RabbitMQ](https://github.com/mariomont30/pulsepay/blob/35167aaf5e7e1000aa06b9d25cd80682073bb4ba/backend/src/config/rabbitmq.js), [sockets](https://github.com/mariomont30/pulsepay/blob/35167aaf5e7e1000aa06b9d25cd80682073bb4ba/backend/src/sockets/socket.js) e [Compose](https://github.com/mariomont30/pulsepay/blob/35167aaf5e7e1000aa06b9d25cd80682073bb4ba/docker-compose.yml).

O CI do snapshot aparece concluído com sucesso, mas isso não comprova o SLA: o teste de carga e a suíte de conformidade têm caminhos não bloqueantes. [Execução consultada](https://github.com/mariomont30/pulsepay/actions/runs/34674584061), [workflow principal](https://github.com/mariomont30/pulsepay/blob/35167aaf5e7e1000aa06b9d25cd80682073bb4ba/.github/workflows/ci.yml), [workflow de ADR](https://github.com/mariomont30/pulsepay/blob/35167aaf5e7e1000aa06b9d25cd80682073bb4ba/.github/workflows/adr-compliance.yml).

---

## 3. Roadmap técnico cronológico

### Mês 1 — Fundação reproduzível e governança arquitetural

**Período:** 12/09 a 11/10/2026

#### 1) Objetivo principal

Eliminar divergências de ambiente, estabelecer limites entre módulos e transformar decisões já aceitas em contratos técnicos verificáveis. Criar uma base segura para modificar o processamento financeiro sem regressões.

#### 2) Decisões arquiteturais específicas

1. **Manter o monólito modular.** Organizar autenticação, contas e transferências por módulo; controllers não acessam Prisma ou RabbitMQ diretamente. Casos de uso dependem de interfaces de repositório e publicação, implementadas por adapters.
2. **Padronizar Node 24 LTS no CI e nas imagens.** Validar compatibilidade de Prisma, bcrypt e OpenSSL; fixar versão de patch e digest após os testes. Inventariar também a versão real de RabbitMQ/Erlang e definir uma linha suportada e um caminho de atualização. Atualizações entram separadamente, sem salto simultâneo de todos os majors. [Suporte e releases do RabbitMQ](https://www.rabbitmq.com/release-information).
3. **Usar instalação reproduzível.** Versionar lockfile também no frontend, usar `npm ci`, construir imagens multi-stage, executar como usuário não root e remover ferramentas de migração do runtime sempre que houver imagem/job específico.
4. **Preservar JavaScript nesta fase.** Adotar JSDoc e checagem estática incremental nos contratos e regras de domínio. Reescrita integral em TypeScript não será requisito para resolver problemas de consistência e operação.
5. **Validar configuração no startup.** Falhar em ambientes não locais se segredo JWT ou configurações essenciais estiverem ausentes; restringir algoritmos JWT, emissor/audiência conforme contrato, origens CORS e exposição de erros internos. Encerrar sockets quando a credencial expirar e centralizar a limpeza da sessão em `401`.
6. **Normalizar governança dos ADRs.** Os nomes atuais `0001/0002/0003` divergem dos títulos `0002/0003/0004`, e há referências ambíguas ao ADR do PostgreSQL. Criar mapa de equivalência histórico e corrigir referências sem renumerar silenciosamente documentos aceitos.
7. **Separar gates e experimentos.** Testes funcionais e invariantes implementadas bloqueiam PR; decisões ainda não implementadas ficam em backlog explícito com prazo. Testes críticos não podem ser classificados permanentemente como mera advertência.

#### 3) Entregáveis técnicos exatos

- `docs/architecture/current-state.md`: desenho atual, dependências e pontos de falha.
- `docs/architecture/risk-register.md`: riscos, responsáveis, severidade e mês de resolução.
- `docs/architecture/runtime-compatibility.md`: matriz Node/Prisma/bcrypt/OpenSSL e versões testadas.
- `docs/adr/README.md` corrigido e ADR de modularização/execução reproduzível, com novo identificador sem colisão.
- `backend/src/modules/{auth,contas,transferencias}/` e `backend/src/adapters/`, com interfaces de entrada/saída e testes de proibição de dependências indevidas.
- Configuração de ESLint, checagem estática e validação de ambiente; execução em PR.
- Dockerfiles reproduzíveis, lockfiles completos e job isolado de migrations.
- CI de PR com lint, testes unitários, contratos HTTP e integração básica em PostgreSQL/RabbitMQ efêmeros; relatórios publicados.
- `docs/architecture/baseline.md`: resultados iniciais, recursos do ambiente e lacunas ainda não implementadas.

#### Critérios de avanço

- CI e containers usam o mesmo runtime suportado.
- Dois builds do mesmo commit usam o mesmo grafo de dependências e geram artefatos rastreáveis ao SHA.
- Um PR que viola um contrato protegido falha; não existe fallback de segredo em homologação.
- Cadastro, autenticação, saldo, extrato, transferência e sockets mantêm seus contratos existentes.

#### Justificativa

- **Débito técnico:** remove deriva de versões, scripts não executados e dependências cruzadas difíceis de testar.
- **Escalabilidade:** cria unidades de execução e contratos claros sem pagar agora o custo de transações distribuídas entre microsserviços.
- **Alta disponibilidade:** imagens imutáveis e configuração consistente permitem substituir uma instância por outra previsivelmente.

---

### Mês 2 — Consistência distribuída e processamento recuperável

**Período:** 12/10 a 11/11/2026

#### 1) Objetivo principal

Garantir que uma transferência aceita permaneça recuperável e seja efetivada uma única vez, mesmo com duplicação, reinício ou interrupção entre banco e broker. Este é o pré-requisito para escalar Workers.

#### 2) Decisões arquiteturais específicas

1. **Adotar Transactional Outbox no PostgreSQL.** Criar `Transacao`, auditoria de solicitação e comando de processamento na mesma transação ACID. No Worker, persistir débito, crédito, estado final, auditoria e evento de notificação no mesmo commit. Um relay separado publica registros confirmados. Essa é a aplicação proposta para a lacuna de dual write identificada; Outbox não elimina possíveis duplicatas de publicação. [Padrão Transactional Outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html).
2. **Usar entrega at-least-once com efeito financeiro idempotente.** Bloquear e reler a linha de `Transacao` dentro da transação do Worker; só `PENDENTE` pode produzir movimentação. Adquirir locks de contas em ordem determinística. Não prometer exactly-once do broker.
3. **Adicionar idempotência de requisição como contrato técnico.** Chave única por usuário/operação; repetição com mesmo payload retorna a mesma transação, e payload diferente é conflito. Manter compatibilidade dos clientes existentes e reaproveitar a chave nas retentativas do cliente.
4. **Confirmar publicação e respeitar backpressure.** Relay usa confirm channel, valida roteamento e só marca publicação concluída após confirmação. Falha depois do envio e antes da atualização do Outbox causa republicação segura, não perda. Consumer ack continua após commit e no canal de origem. [Publisher confirms e acknowledgements](https://www.rabbitmq.com/docs/confirms).
5. **Controlar falhas.** Separar erro de negócio de erro técnico; validar o envelope antes do uso; aplicar retentativas limitadas com atraso/backoff e jitter, depois DLQ. Erros de negócio recebem estado final e não entram em retry infinito.
6. **Reconectar toda a capacidade, não apenas o socket AMQP.** Restaurar canais, topologia e subscriptions com cancelamento e limites de reconexão. API de leitura pode iniciar com PostgreSQL disponível mesmo quando o broker estiver temporariamente indisponível; admissão de transferências é limitada pela saúde e pelo backlog do Outbox.
7. **Preservar a semântica monetária.** Usar operações Decimal no domínio, validar no máximo duas casas decimais e impor constraints de valor positivo, origem diferente do destino e saldo não negativo. Levar trigger de auditoria para migration, em vez de depender de comando manual pós-inicialização. A proteção append-only vale para os papéis de aplicação; não equivale a resistência física a adulteração nem certificação regulatória.

#### 3) Entregáveis técnicos exatos

- ADRs de Outbox, idempotência, política de entrega/retentativa e tratamento monetário.
- Migrations para `Outbox`, chaves de idempotência, constraints financeiras e trigger de auditoria.
- `backend/src/relay/index.js`: execução independente, seleção em lotes, claim concorrente seguro e publisher confirms.
- Envelope versionado de comando/evento com `messageId`, `transacaoId`, versão e correlação, sem payload financeiro desnecessário.
- Worker refatorado com revalidação sob lock da transação, locks de contas, erro classificado e commit único.
- Topologia versionada de fila de processamento, retries e DLQ; limites e política de replay documentados.
- Atualização do RabbitMQ para a linha suportada escolhida, com sequência de versões/feature flags validada e restauração ensaiada antes da promoção.
- Testes reais para duas execuções simultâneas da mesma transação, transferência cruzada, crash antes/depois do commit, perda de ack, indisponibilidade do broker e mensagem inválida.
- Script operacional de reconciliação de Outbox e transações pendentes, sem reaplicar débito automaticamente.
- `docs/runbooks/messaging-recovery.md`: reconexão, triagem de DLQ e replay autorizado.

#### Critérios de avanço

- Reentregas simultâneas do mesmo comando movimentam o saldo uma vez.
- Uma API interrompida após commit não perde o comando pendente no Outbox.
- Falha da publicação de notificação não reaplica a movimentação financeira.
- Reinício ou reconexão restaura consumo automaticamente; mensagem inválida não derruba o fluxo.
- Testes não apresentam saldo negativo nem divergência entre débito, crédito e auditoria.

#### Justificativa

- **Débito técnico:** elimina dual writes frágeis, idempotência superficial, retries infinitos e etapas manuais de integridade.
- **Escalabilidade:** torna seguros vários relays e Workers concorrentes, com controle de carga e exclusão mútua somente nas linhas necessárias.
- **Alta disponibilidade:** instâncias passam a poder morrer e voltar sem perda de operações confirmadas no banco, sujeito à durabilidade do próprio PostgreSQL.

---

### Mês 3 — Observabilidade real, desempenho e recuperação de dados

**Período:** 12/11 a 11/12/2026

#### 1) Objetivo principal

Estabelecer uma verdade operacional sobre latência, saturação e recuperação. Otimizar gargalos medidos antes de replicar infraestrutura, evitando esconder problemas com aumento indiscriminado de recursos.

#### 2) Decisões arquiteturais específicas

1. **Separar latência de aceite, fila, processamento e confirmação.** Medir confirmação desde o instante de solicitação persistido até o commit final, e não somente a execução interna do Worker. Contabilizar deadlines vencidos e pendências; não tratar `FALHOU` de negócio como pagamento bem-sucedido.
2. **Definir SLIs de jornada.** Disponibilidade será sucesso de requisições elegíveis e sondas sintéticas, não o `up` de scrape do Prometheus. `/live` verifica o processo; `/ready` expressa dependências da capacidade atendida. A fila não deve provocar cascata de reinícios da API de leitura.
3. **Correlacionar HTTP e eventos.** Logs estruturados e traces atravessam API, Outbox, RabbitMQ e Worker. UUIDs não entram como labels de métrica; rotas usam templates. Habilitar métricas do broker declarativamente e remover gauges nunca atualizados.
4. **Otimizar o PostgreSQL a partir de planos.** Medir `EXPLAIN (ANALYZE, BUFFERS)` e contenção. Evoluir extrato para cursor composto `(criadoEm, id)` e índices compostos por origem/destino com data e ID. Descontinuar `count` obrigatório e offset profundo por migração compatível de contrato; nenhum novo relatório de produto será criado.
5. **Fixar orçamento global de conexões e concorrência.** Somar pools de todas as réplicas, relays e jobs, reservando pelo menos 30% da capacidade de conexão para margem/operabilidade. Ajustar prefetch e paralelismo ao banco. Pooler adicional só entra com prova de saturação e teste de compatibilidade com Prisma, prepared statements e migrations.
6. **Implementar backup e PITR antes de HA.** Backup base e arquivamento de WAL para armazenamento independente, criptografado e com retenção definida; restauração em ambiente isolado. Replicação futura não substitui backup. [Arquivamento contínuo e PITR do PostgreSQL](https://www.postgresql.org/docs/16/continuous-archiving.html).

#### 3) Entregáveis técnicos exatos

- `docs/operations/slo.md`: população elegível, denominadores, janelas, deadlines, metas e error budget.
- Instrumentação corrigida de API, Outbox e Worker; Collector de traces e logs estruturados com remoção de dados sensíveis.
- Dashboards de confirmação E2E, idade do Outbox, backlog, DLQ, locks, pool, event loop e capacidade de publicação/consumo.
- Regras de alerta e respectivos runbooks; configuração automática do plugin Prometheus do RabbitMQ.
- Política de retenção/purga dos registros publicados do Outbox, com índices e recuperação testados para evitar crescimento ilimitado.
- Migrations de índices compostos e relatório de planos antes/depois em `docs/performance/query-plans.md`.
- Cursor de extrato e teste de contrato para consumidores existentes, com plano de depreciação do offset documentado.
- `docs/performance/capacity-baseline.md`: hardware, tamanho dos dados, perfil de tráfego, pools, prefetch, gargalos e limites seguros de réplicas.
- Suíte k6 revisada com fluxo de transferência, leitura concorrente, distribuição de contas, conta quente e deadlines contabilizados como falhas de SLO.
- `infra/backup/`: jobs/scripts de backup, WAL, política de retenção e restauração; relatório de PITR com checagem de invariantes.

#### Critérios de avanço

- Medidas internas e k6 refletem o tempo ponta a ponta com diferença explicável de polling/rede.
- Alertas detectam Worker parado, backlog envelhecendo e Outbox acumulando, mesmo com API respondendo.
- Benchmark reproduzido três vezes no mesmo ambiente e dataset, incluindo histórico de um milhão de transações fictícias.
- Pools máximos e limites de Workers estão registrados; aumentar prefetch não é a única resposta ao atraso.
- Backup restaurado com evidências de integridade; metas propostas de DR: RPO de até cinco minutos e RTO de até 30 minutos, ainda sujeitas ao teste de escala final.

#### Justificativa

- **Débito técnico:** corrige indicadores enganosos e decisões de performance por tentativa e erro, além da ausência de restauração verificável.
- **Escalabilidade:** reduz custo de leitura, identifica contenção por conta e evita esgotar conexões ao multiplicar processos.
- **Alta disponibilidade:** permite distinguir instância viva de serviço saudável e recuperar dados mesmo após erro lógico ou perda do ambiente.

---

### Mês 4 — Execução multi-host, sockets distribuídos e CD real

**Período:** 12/12/2026 a 11/01/2027

#### 1) Objetivo principal

Migrar a homologação de host único para unidades replicáveis, com atualização gradual, desligamento seguro e rollback. Corrigir a topologia de notificações antes de distribuir clientes entre APIs.

#### 2) Decisões arquiteturais específicas

1. **Usar Kubernetes gerenciado como runtime de referência de homologação.** Deployments separados para API, Worker, relay e dispatcher; Compose permanece para desenvolvimento/testes locais. Não migrar o núcleo para microsserviços de negócio.
2. **Distribuir aplicações entre hosts.** Começar com duas réplicas de API e duas de Worker, em nós distintos; configurar probes, requests/limits, distribuição de pods e orçamento de interrupção. Não afirmar tolerância a falha de zona enquanto as dependências de estado ainda estiverem no mês 5.
3. **Adotar desligamento gracioso.** Em `SIGTERM`, retirar readiness, parar recebimento/consumo, drenar operações em andamento e fechar Prisma/AMQP. Trabalho não confirmado permanece recuperável. Jobs de migration são únicos por release, nunca executados simultaneamente por cada pod.
4. **Distribuir o Socket.IO corretamente.** Um dispatcher consome o evento existente de notificação e publica através de adapter/emitter Redis, alcançando rooms de todas as APIs. Redis é transporte, não repositório financeiro. Manter afinidade no balanceador enquanto o fallback de long-polling estiver habilitado. [Socket.IO em múltiplos nós](https://socket.io/docs/v4/using-multiple-nodes/).
5. **Preservar consistência após desconexão.** Reconexão do cliente sincroniza saldo/extrato com PostgreSQL; o socket é um aviso de atualização, não confirmação oficial da transferência. Deduplicar pelo identificador do evento, sem criar uma caixa de notificações ou outra funcionalidade.
6. **Publicar e promover imagens imutáveis.** GitHub Actions envia imagens identificadas por SHA/digest a registry; homologação e ambiente de referência usam o mesmo artefato. URLs da API usam roteamento relativo ou configuração de runtime, evitando rebuild por ambiente.
7. **Automatizar CD com compatibilidade de schema.** Migration expand/contract, rolling deployment, smoke test e rollback de aplicação. Schema destrutivo não é revertido automaticamente; restauração de dados segue runbook próprio.

#### 3) Entregáveis técnicos exatos

- ADR de runtime gerenciado e relatório de custo, limites e responsabilidade operacional, aprovado antes de provisionar.
- `infra/terraform/` para rede, runtime, registry, identidades e ambientes, no provedor aprovado; estado remoto protegido.
- `infra/k8s/` com Deployments, Services, probes, distribuição, PDBs, recursos e jobs de migration.
- API, Worker e relay sem nomes/portas de instância fixos e sem dependência artificial do Worker no startup da API.
- `backend/src/notification-dispatcher/` e integração de adapter/emitter Redis.
- Configuração de balanceamento com TLS, upgrade WebSocket e afinidade de long-polling.
- Workflows de build/publish/promote/deploy/rollback, usando identidade federada e aprovação de ambiente.
- `docs/runbooks/deploy-rollback.md` e testes de drain, reinício, socket entre réplicas e rollback.

#### Critérios de avanço

- Cliente conectado à API A recebe evento consumido pelo dispatcher sem depender de qual API o hospedou.
- Reinício de uma API ou Worker não perde operação aceita e permite reconexão.
- Smoke tests verificam jornadas existentes após cada release; regressão bloqueia promoção.
- Rollback da imagem é realizado em até dez minutos no ensaio, sem exigir reconstrução e sem corromper schema.
- As limitações de HA causadas por banco, broker e Redis ainda não redundantes estão explicitamente registradas.

#### Justificativa

- **Débito técnico:** substitui deploy manual/placeholder por artefatos rastreáveis e corrige o estado local das notificações.
- **Escalabilidade:** permite ajustar API, Worker e relay independentemente, respeitando o orçamento de conexões do mês 3.
- **Alta disponibilidade:** fornece substituição automática e atualizações graduais das aplicações, ainda sem esconder os pontos únicos de falha de estado. PDB protege interrupções voluntárias; não evita falha de host nem garante HA sozinho. [Interrupções em Kubernetes](https://kubernetes.io/docs/concepts/workloads/pods/disruptions/).

---

### Mês 5 — Alta disponibilidade dos componentes de estado

**Período:** 12/01 a 11/02/2027

#### 1) Objetivo principal

Remover a dependência de um único banco, broker ou transporte de sockets, preservando durabilidade e evitando split-brain. Evoluir para tolerância a falha de um domínio, não apenas de um processo.

#### 2) Decisões arquiteturais específicas

1. **Adotar PostgreSQL gerenciado multi-AZ com único escritor.** Alvo: primário e dois standbys candidatos em três domínios, com confirmação síncrona de ao menos um standby durável. Failover usa eleição, fencing e endpoint estável do serviço; não implementar promoção automática artesanal. RPO zero de commits confirmados só é aceito após verificar a configuração efetiva e o comportamento em falhas. Não habilitar fallback assíncrono silencioso. [Replicação e trade-offs do PostgreSQL](https://www.postgresql.org/docs/16/warm-standby.html).
2. **Manter leitura crítica no escritor.** Consulta imediatamente posterior à transferência precisa refletir o commit. Réplica de leitura só será introduzida para carga tolerante a atraso e mediante evidência; não cachear saldo como fonte oficial.
3. **Replicar RabbitMQ com quorum queues.** Cluster de três nós em domínios distintos, filas financeiras quorum e publisher confirms. Uma minoria isolada não deve aceitar trabalho sem quorum. A perda da maioria interrompe processamento, mas não autoriza perda de consistência. [Quorum queues](https://www.rabbitmq.com/docs/quorum-queues).
4. **Migrar topologia de fila explicitamente.** Tipo de fila não será alterado por redeclaração incompatível. Criar filas versionadas, promover publicação de forma controlada, drenar as antigas e só então removê-las; manter plano de reversão durante a transição.
5. **Redundar Redis e acesso à infraestrutura.** Usar serviço Redis com failover automático ou topologia equivalente aprovada. Sua indisponibilidade degrada avisos, não o commit financeiro. Balanceador, DNS, runtime e armazenamento de backup precisam estar fora do mesmo ponto de falha.
6. **Segregar privilégios e segredos.** Credenciais distintas para API, Worker, relay e migrations; TLS para dependências; secret manager e política de rotação compatível entre réplicas. Usuário de runtime não tem privilégios para remover a auditoria ou desativar sua proteção.
7. **Executar cutover reversível.** Primeiro homologação; conferir Outbox, DLQ, contagens, saldos e auditoria. Não manter dois primários financeiros ativos para facilitar migração.

#### 3) Entregáveis técnicos exatos

- ADRs de HA do PostgreSQL, quorum queues, topologia de Redis, consistência de leitura e gestão de segredos.
- Módulos IaC para banco multi-AZ, broker replicado, Redis redundante, rede privada, TLS e secret manager.
- Distribuição final das aplicações e balanceamento entre os domínios de falha, incluindo capacidade sobrevivente quando um domínio estiver indisponível.
- Políticas de RabbitMQ versionadas, filas novas e scripts de drain/cutover com relatório de reconciliação.
- `docs/operations/failure-domains.md`: localização de cada componente, dependência e falha tolerada.
- `docs/runbooks/postgres-failover.md`, `rabbitmq-failover.md` e `redis-degradation.md`.
- Testes de failover do escritor, perda de um broker, perda de uma réplica Redis e substituição de nó de aplicação.
- Backups/PITR verificados na configuração gerenciada, não apenas no ambiente anterior.
- Relatório de custo mensal e plano de rollback/cutover assinado pela equipe responsável.

#### Critérios de avanço

- Nenhuma perda de commit financeiro confirmado durante os ensaios de falha simples previstos.
- RTO proposto de failover do banco: até 60 segundos, sujeito à capacidade do provedor e à medição.
- RabbitMQ mantém publicação confirmada/consumo com um nó indisponível; a perda de quorum falha de forma segura.
- Failover e reconexão não duplicam transferências e não mantêm dois escritores ativos.
- Ambiente recriado a partir de IaC e backups, com reconciliação dos dados.
- Iniciar a janela contínua de observação de 30 dias ao final desta fase, antes do encerramento do mês 6.

#### Justificativa

- **Débito técnico:** substitui configurações locais implícitas por topologias, privilégios e procedimentos versionados.
- **Escalabilidade:** permite distribuir consumo e conexões com limites explícitos; a replicação do banco favorece resiliência, mas não aumenta a capacidade do único escritor automaticamente.
- **Alta disponibilidade:** remove pontos únicos de falha e protege commits reconhecidos. Replicação síncrona adiciona latência e pode bloquear commits se os standbys exigidos não estiverem disponíveis; esse custo deve ser medido, não ocultado.

---

### Mês 6 — Validação de resiliência e operação sustentável

**Período:** 12/02 a 11/03/2027

#### 1) Objetivo principal

Demonstrar que a arquitetura mantém consistência, se recupera e atende aos SLOs na infraestrutura final. Converter o roadmap em evidências operacionais e decisões para o próximo horizonte.

#### 2) Decisões arquiteturais específicas

1. **Escalar por saturação mensurada.** API usa sinais de CPU, event loop e requisições; Workers usam idade/backlog da fila, taxa de processamento e pressão no banco. Configurar mínimo, máximo, estabilização e limite global de conexões. Autoscaling não deve aumentar contenção de contas quentes sem benefício. [Autoscaling em Kubernetes](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/).
2. **Validar falhas progressivas.** Executar experimentos controlados em homologação: morte de pod, perda de nó, failover do banco, interrupção AMQP, mensagem inválida, duplicação, partição de rede e indisponibilidade de Redis. Injeção de falhas em produção requer autorização separada.
3. **Praticar recuperação de desastre.** Restaurar backup/WAL em ambiente limpo, recuperar configuração e reconciliar saldos, transações, auditoria e Outbox antes de liberar tráfego. Dados restaurados não autorizam replay cego de todos os eventos históricos.
4. **Operar com error budget.** Promoção de release depende das invariantes e da janela de SLO; orçamento esgotado direciona o trabalho para estabilidade. Definir plantão/responsáveis, severidades e runbooks mínimos sem presumir uma equipe de SRE grande.
5. **Decidir a próxima evolução com gatilhos.** Extração de serviços, read replicas, pooler, particionamento ou sharding só avançam com gargalo e benefício demonstrados. Três componentes de execução não justificam, por si, três bancos ou sagas financeiras.

#### 3) Entregáveis técnicos exatos

- Políticas de autoscaling de API e Worker, com teto calculado a partir do relatório de capacidade.
- `tests/resilience/` com cenários reproduzíveis e checagem automática de conservação de valores.
- `docs/operations/game-day-report.md`: cronologia, observações, RTO/RPO medidos, falhas encontradas e correções.
- `docs/operations/dr-restore-report.md`: ambiente restaurado, duração, ponto recuperado e reconciliação.
- `docs/performance/final-capacity-report.md`: throughput sustentado, limites de pico, contas quentes, custo e comparativo com o mês 3.
- `docs/operations/slo-report-30d.md`: janela, população de teste, disponibilidade, confirmação, backlog e error budget.
- `docs/operations/production-readiness.md`: checklist, riscos residuais e decisão formal de go/no-go para o ambiente de referência.
- `docs/architecture/next-horizon.md`: decisões mantidas, adiadas e gatilhos objetivos para o ciclo seguinte.

#### Critérios de avanço

- Janelas e perfis de carga documentados; SLOs abaixo verificados na infraestrutura final, não inferidos da quantidade de pods.
- Zero duplicação financeira ou divergência contábil em todos os experimentos de falha.
- Failover de banco, drain de Worker, rollback de release e restauração de backup demonstrados.
- Limites de autoscaling não esgotam o PostgreSQL nem criam retry storm.
- Pendências críticas abertas impedem declaração de prontidão; resultado parcial é registrado como parcial.

#### Justificativa

- **Débito técnico:** encerra lacunas com testes repetíveis e runbooks, evitando conhecimento operacional concentrado em uma pessoa.
- **Escalabilidade:** comprova capacidade útil e custo por carga, separando escala real de adição de infraestrutura.
- **Alta disponibilidade:** valida tolerância a falhas e recuperação de forma prática, sem confundir uma arquitetura desenhada para HA com um SLA efetivamente cumprido.

---

## 4. Metas arquiteturais propostas e como verificá-las

As metas devem ser aprovadas no mês 3 e confirmadas no mês 6. Alterá-las exige nova decisão e justificativa, não apenas flexibilizar o teste para obter CI verde.

| Dimensão | Meta proposta | Evidência exigida |
| --- | --- | --- |
| Integridade financeira | Nenhum débito/crédito duplicado; nenhum saldo negativo; conservação do valor entre contas | Testes reais de duplicação, concorrência, replay e failover; reconciliação no PostgreSQL |
| Disponibilidade da jornada | Pelo menos 99,95% em janela de 30 dias, com população elegível e sondas externas definidas | Relatório de SLIs e incidentes; scrape `up` isolado não é suficiente |
| Confirmação E2E | Pelo menos 99% das transferências elegíveis aceitas concluídas em até 2 s no perfil nominal; falhas/pendências fora do prazo entram no denominador | Timestamp de solicitação até commit final e medição externa correlacionada |
| Latência do aceite | p95 do `POST /transferencias` inferior a 500 ms no perfil nominal | k6 específico do endpoint; polling não misturado à métrica |
| Carga de referência inicial | 40 transferências/s sustentadas, pico de 150/s por 1 minuto e leituras concorrentes | Ambiente e recursos fixados; identificar transações/s versus total de requisições HTTP/s |
| Capacidade adicional | Perfil de referência duplicado ou, se inviável, limite máximo seguro e gargalo documentados | Relatório de capacidade; não uma promessa prévia de escala linear |
| Failover simples do banco | RPO zero de commits confirmados e RTO de até 60 s | Teste com replicação síncrona efetiva, fencing e reconexão |
| Recuperação de desastre | RPO de até 5 min e RTO de até 30 min | Restauração em ambiente limpo e dados reconciliados |
| Rollback de aplicação | Até 10 min, sem rebuild e com schema compatível | Ensaio automatizado de rollback por digest |

**Interpretação dos dois segundos:** o README descreve uma meta de referência; o k6 atual valida p95, não um limite absoluto para todas as operações. Este roadmap propõe um SLO estatístico mais explícito. Se a exigência formal for que 100% das transferências terminem em até dois segundos, essa condição deverá substituir a meta proposta e poderá demandar controle de admissão e capacidade adicional. [Cenário k6 atual](https://github.com/mariomont30/pulsepay/blob/35167aaf5e7e1000aa06b9d25cd80682073bb4ba/backend/scripts/load-test.k6.js).

**Disponibilidade não é apenas taxa de erro de um teste curto.** 99,95% em 30 dias corresponde a aproximadamente 21,6 minutos de indisponibilidade quando o SLI é baseado em tempo; em SLI por requisição, o orçamento é 0,05% das requisições elegíveis. O denominador precisa ser definido antes da medição. Sucesso em homologação com carga controlada também não prova disponibilidade futura de uma operação financeira real.

## 5. Decisões que ficam fora dos seis meses

| Evolução não priorizada | Justificativa e gatilho futuro |
| --- | --- |
| Decomposição completa em microsserviços | API/Worker já escalam separadamente. Extrair domínio somente com gargalo de escala, isolamento ou autonomia de equipe comprovado. |
| Sharding financeiro e múltiplos escritores | Aumentam a complexidade de consistência e reconciliação. Considerar apenas após saturação do escritor com tuning e capacidade vertical esgotados. |
| Event sourcing completo | Auditoria append-only não é event sourcing. Outbox resolve a lacuna atual sem reescrever a fonte de verdade. |
| Troca de RabbitMQ por Kafka | O problema imediato é segurança de entrega/consumo, não retenção de stream em escala. Reavaliar com necessidade comprovada. |
| Cache de saldo como fonte oficial | Risco de obsolescência financeira. Redis atende transporte de sockets; PostgreSQL mantém a autoridade. |
| Multi-região active-active | Primeiro comprovar HA multi-AZ e DR. Escrita financeira multi-região exigiria nova análise de consistência, latência e custo. |
| Reescrita integral de linguagem/framework | Mudança ampla sem benefício medido distrai de riscos críticos. Evolução de dependências segue matriz de compatibilidade e testes. |

## 6. Resultado arquitetural esperado

Ao final do horizonte, o PulsePay permanece um monólito modular de negócio, mas sua operação deixa de depender de um único host ou de publicações best-effort. API, Worker, relay e dispatcher são unidades independentes; PostgreSQL mantém a consistência financeira; Outbox e idempotência permitem recuperação segura; RabbitMQ e dependências de estado passam a ter redundância; e releases, desempenho e failover são sustentados por evidências.

O resultado não é “mais tecnologias” nem “mais microsserviços”: é **uma arquitetura evolutiva com contratos protegidos, integridade demonstrável, escala limitada conscientemente e caminho verificável para alta disponibilidade**, sem expandir o escopo funcional do produto.
