/**
 * Suíte de conformidade com o ADR-0002 (JWT expirável para proteger
 * sessões e rotas). Cada teste corresponde a um ponto numerado da seção
 * "Decisão" do ADR.
 */
const fs = require("fs");
const path = require("path");

describe("ADR-0002: JWT expirável para proteger sessões e rotas", () => {
  test("decisão 1: o token emitido contém o identificador do usuário em 'sub' e expiração em 'exp'", () => {
    jest.isolateModules(() => {
      process.env.JWT_SECRET = "segredo-de-teste";
      process.env.JWT_EXPIRES_IN = "1h";
      const { gerarToken } = require("../../src/utils/jwt");
      const jwt = require("jsonwebtoken");

      const token = gerarToken({ sub: "usuario-123", email: "a@b.com" });
      const payload = jwt.decode(token);

      expect(payload.sub).toBe("usuario-123");
      expect(typeof payload.exp).toBe("number");
      expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });

  test("decisão 2: segredo e tempo de expiração vêm de variáveis de ambiente, não são fixos no código", () => {
    let tokenComSegredoA;
    jest.isolateModules(() => {
      process.env.JWT_SECRET = "segredo-A";
      const { gerarToken } = require("../../src/utils/jwt");
      tokenComSegredoA = gerarToken({ sub: "u1" });
    });

    // Um verificador configurado com um segredo DIFERENTE deve rejeitar o
    // token - prova de que o valor realmente vem do ambiente, e não de uma
    // constante fixa compartilhada entre instâncias.
    jest.isolateModules(() => {
      process.env.JWT_SECRET = "segredo-B-completamente-diferente";
      const { verificarToken } = require("../../src/utils/jwt");
      expect(() => verificarToken(tokenComSegredoA)).toThrow();
    });
  });

  test("decisão 3/4: o middleware central exige 'Authorization: Bearer <token>' e valida assinatura/expiração", () => {
    jest.isolateModules(() => {
      process.env.JWT_SECRET = "segredo-de-teste";
      const { autenticar } = require("../../src/middleware/auth");
      const { gerarToken } = require("../../src/utils/jwt");

      const responder = () => {
        const res = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        return res;
      };

      // Sem header -> 401
      let res = responder();
      let next = jest.fn();
      autenticar({ headers: {} }, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();

      // Header sem o prefixo "Bearer " -> 401
      res = responder();
      next = jest.fn();
      const tokenValido = gerarToken({ sub: "u1", email: "a@b.com" });
      autenticar({ headers: { authorization: tokenValido } }, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();

      // Token com assinatura inválida -> 401
      res = responder();
      next = jest.fn();
      autenticar({ headers: { authorization: "Bearer token.invalido.assinatura" } }, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();

      // Token válido -> segue adiante (next chamado, sem erro)
      res = responder();
      next = jest.fn();
      const req = { headers: { authorization: `Bearer ${tokenValido}` } };
      autenticar(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  test("decisão 3/4: um token expirado é rejeitado pelo middleware", () => {
    jest.isolateModules(() => {
      process.env.JWT_SECRET = "segredo-de-teste";
      process.env.JWT_EXPIRES_IN = "-10s"; // já nasce expirado
      const { gerarToken } = require("../../src/utils/jwt");
      const { autenticar } = require("../../src/middleware/auth");

      const tokenExpirado = gerarToken({ sub: "u1", email: "a@b.com" });
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
      const next = jest.fn();

      autenticar({ headers: { authorization: `Bearer ${tokenExpirado}` } }, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  test("decisão 5: a identidade usada nas rotas vem sempre do 'sub' do token, nunca de um campo enviado pelo cliente", () => {
    // Verificação estática: o schema de validação da transferência não
    // aceita um campo de identidade (usuarioId/contaOrigemId) vindo do
    // corpo da requisição - a única fonte de identidade é o middleware.
    const { transferenciaSchema } = require("../../src/schemas/validation.schemas");
    const campos = Object.keys(transferenciaSchema._def.schema?.shape || transferenciaSchema._def.shape?.() || {});
    expect(campos).not.toContain("usuarioId");
    expect(campos).not.toContain("contaOrigemId");

    // Verificação estática: o controller deriva a identidade de
    // req.usuario.id (preenchido pelo middleware a partir do token),
    // nunca de req.body.
    const controllerSrc = fs.readFileSync(
      path.join(__dirname, "../../src/controllers/transferencias.controller.js"),
      "utf-8"
    );
    expect(controllerSrc).toMatch(/req\.usuario\.id/);
    expect(controllerSrc).not.toMatch(/req\.body\.usuarioId/);
  });

  test("decisão 6: o logout do frontend remove o token e os dados de sessão do cliente", () => {
    // Verificação estática do AuthContext do frontend (não roda no ambiente
    // de testes do backend, então checamos a implementação por leitura de
    // código, não execução em DOM).
    const authContextSrc = fs.readFileSync(
      path.join(__dirname, "../../../frontend/src/context/AuthContext.jsx"),
      "utf-8"
    );
    const funcaoSair = authContextSrc.slice(authContextSrc.indexOf("const sair"));
    expect(funcaoSair).toMatch(/removeItem\(["']pulsepay_token["']\)/);
    expect(funcaoSair).toMatch(/removeItem\(["']pulsepay_usuario["']\)/);
  });
});
