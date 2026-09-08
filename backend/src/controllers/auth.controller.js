const authService = require("../services/auth.service");

async function registrar(req, res, next) {
  try {
    const usuario = await authService.registrar(req.body);
    return res.status(201).json(usuario);
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const resultado = await authService.login(req.body);
    return res.status(200).json(resultado);
  } catch (err) {
    return next(err);
  }
}

module.exports = { registrar, login };
