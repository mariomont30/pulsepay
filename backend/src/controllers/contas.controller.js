const contasService = require("../services/contas.service");

async function saldo(req, res, next) {
  try {
    const resultado = await contasService.consultarSaldo(req.usuario.id);
    return res.status(200).json(resultado);
  } catch (err) {
    return next(err);
  }
}

async function extrato(req, res, next) {
  try {
    const resultado = await contasService.consultarExtrato(req.usuario.id);
    return res.status(200).json(resultado);
  } catch (err) {
    return next(err);
  }
}

module.exports = { saldo, extrato };
