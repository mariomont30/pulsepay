const BASE_URL = process.env.API_URL || "http://localhost:4000";

async function chamarApi(caminho, { method = "GET", body, token } = {}) {
  const resposta = await fetch(`${BASE_URL}${caminho}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const dados = await resposta.json().catch(() => ({}));
  return { status: resposta.status, dados };
}

/** Cria um usuário novo com e-mail único (timestamp) e devolve token + dados. */
async function criarUsuarioDeTeste(prefixo) {
  const sufixo = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const cpf = String(sufixo).padStart(11, "0").slice(-11);
  const email = `${prefixo}.${sufixo}@teste.pulsepay.local`;
  const senha = "senha123456";

  const registro = await chamarApi("/auth/registrar", {
    method: "POST",
    body: { nome: `Teste ${prefixo}`, email, cpf, senha },
  });
  if (registro.status !== 201) {
    throw new Error(`Falha ao registrar usuário de teste: ${JSON.stringify(registro.dados)}`);
  }

  const login = await chamarApi("/auth/login", { method: "POST", body: { email, senha } });
  if (login.status !== 200) {
    throw new Error(`Falha ao logar usuário de teste: ${JSON.stringify(login.dados)}`);
  }

  return { email, senha, token: login.dados.token, usuario: login.dados.usuario };
}

async function aguardar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Consulta a transferência repetidamente até saber do status final ou expirar o timeout. */
async function esperarStatusFinal(token, transacaoId, timeoutMs = 5000, intervaloMs = 150) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    const { status, dados } = await chamarApi(`/transferencias/${transacaoId}`, { token });
    if (status === 200 && dados.status !== "PENDENTE") {
      return dados;
    }
    await aguardar(intervaloMs);
  }
  throw new Error(`Timeout esperando status final da transferência ${transacaoId}`);
}

module.exports = { BASE_URL, chamarApi, criarUsuarioDeTeste, esperarStatusFinal, aguardar };
