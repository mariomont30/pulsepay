const bcrypt = require("bcrypt");
const prisma = require("../config/prisma");
const { gerarToken } = require("../utils/jwt");

const SALT_ROUNDS = 10;

async function registrar({ nome, email, cpf, senha }) {
  const existente = await prisma.usuario.findFirst({ where: { OR: [{ email }, { cpf }] } });
  if (existente) {
    const erro = new Error("Usuário já cadastrado com este e-mail ou CPF");
    erro.status = 409;
    throw erro;
  }

  const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);

  const usuario = await prisma.usuario.create({
    data: {
      nome,
      email,
      cpf,
      senhaHash,
      conta: { create: { saldo: 1000.0 } }, // saldo inicial fictício para fins didáticos
    },
    include: { conta: true },
  });

  return sanitizarUsuario(usuario);
}

async function login({ email, senha }) {
  const usuario = await prisma.usuario.findUnique({ where: { email }, include: { conta: true } });
  if (!usuario) {
    const erro = new Error("Credenciais inválidas");
    erro.status = 401;
    throw erro;
  }

  const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);
  if (!senhaValida) {
    const erro = new Error("Credenciais inválidas");
    erro.status = 401;
    throw erro;
  }

  const token = gerarToken({ sub: usuario.id, email: usuario.email });
  return { token, usuario: sanitizarUsuario(usuario) };
}

function sanitizarUsuario(usuario) {
  const { senhaHash, ...resto } = usuario;
  return resto;
}

module.exports = { registrar, login };
