const { verificarToken } = require("../utils/jwt");

/**
 * Middleware central de autenticação: valida o header Authorization em toda
 * requisição às rotas protegidas (contas/transferências). Ponto central da
 * estratégia de segurança do projeto (ver seção 5 do README).
 */
function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ erro: "Token não informado" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = verificarToken(token);
    req.usuario = { id: payload.sub, email: payload.email };
    return next();
  } catch (err) {
    return res.status(401).json({ erro: "Token inválido ou expirado" });
  }
}

module.exports = { autenticar };
