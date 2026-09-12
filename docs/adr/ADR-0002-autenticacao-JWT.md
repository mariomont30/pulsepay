# 0003. Usar JWT expirável para proteger sessões e rotas

* **Status:** Aceito
* **Data:** 2026-09-11
* **Feature/Fatia:** Feature 2 — Sessão com JWT expirável, rotas protegidas e logout seguro

## Contexto

Saldo, extrato e transferência contêm dados ou ações pertencentes a um usuário específico. Essas rotas não podem confiar em um identificador enviado livremente pelo cliente, pois isso permitiria consultar ou movimentar contas de terceiros.

O PulsePay precisa de uma sessão autenticada compatível com a API Node.js e simples de executar no ambiente acadêmico. A sessão também deve expirar, ser encerrada explicitamente no logout e fornecer tratamento previsível quando a credencial estiver ausente, alterada ou vencida.

## Decisão

Vamos adotar **JSON Web Token (JWT) assinado e com tempo de expiração** como credencial de acesso da aplicação.

O fluxo será:

1. Após validar e-mail e senha, a API emite um JWT contendo o identificador do usuário no campo `sub` e uma expiração no campo `exp`.
2. O segredo de assinatura e o tempo de validade serão configurados por variáveis de ambiente e não serão versionados.
3. O frontend envia o token no cabeçalho `Authorization: Bearer <token>`.
4. Um middleware central valida assinatura e expiração antes de liberar as rotas de saldo, extrato e transferência.
5. A identidade usada nas consultas é sempre derivada do `sub` validado, nunca de um `usuarioId` informado pelo cliente.
6. No logout, o frontend remove o token e os dados locais da sessão.
7. Ao receber resposta de token inválido ou expirado, o frontend limpa a sessão, informa o usuário e o direciona para um novo login.

Não haverá refresh token nem lista de revogação nesta fatia. Portanto, o logout invalida a cópia mantida pelo cliente, enquanto um token eventualmente copiado permanece válido somente até sua expiração.

## Alternativas Consideradas

* **Sessão tradicional armazenada no servidor:** Permite revogação imediata, mas exige armazenamento compartilhado de sessão e aumenta o acoplamento operacional ao escalar a API.
* **Token opaco com consulta ao banco a cada requisição:** Facilita revogação centralizada, porém adiciona uma consulta de autenticação em todas as chamadas protegidas.
* **JWT sem expiração:** Implementação mais simples, mas mantém indefinidamente o risco de uso de um token comprometido e foi rejeitado.

## Consequências

* **Positivas:**
  * Proteção uniforme das rotas financeiras por um middleware central.
  * API sem estado de sessão, facilitando a execução de múltiplas instâncias no futuro.
  * Expiração limita o período de uso de uma credencial comprometida.
  * O campo `sub` fornece uma identidade confiável para restringir saldo, extrato e transferências.
  * Logout e expiração produzem um comportamento claro para o usuário.
* **Negativas:**
  * Não existe revogação imediata antes da expiração sem uma blacklist ou mudança de estratégia.
  * O cliente precisa proteger o token contra acesso indevido e ataques de XSS.
  * Segredo fraco ou exposto compromete todos os tokens assinados com ele.
  * Diferenças de horário entre os componentes podem afetar a validação da expiração.
  * Refresh token, múltiplos dispositivos e recuperação de sessão exigirão novas decisões arquiteturais.
