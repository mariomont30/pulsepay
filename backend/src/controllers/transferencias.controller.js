const transferenciaService = require("../services/transferencia.service");

async function solicitar(req, res, next) {
  try {
    const resultado = await transferenciaService.solicitarTransferencia(req.usuario.id, req.body);
    // Resposta rápida "recebido" (parte síncrona, meta <500ms — README seção 6);
    // a efetivação (CONCLUIDO) acontece de forma assíncrona pelo worker.
    return res.status(202).json(resultado);
  } catch (err) {
    return next(err);
  }
}

async function consultar(req, res, next) {
  try {
    const resultado = await transferenciaService.consultarTransferencia(req.usuario.id, req.params.id);
    return res.status(200).json(resultado);
  } catch (err) {
    return next(err);
  }
}

module.exports = { solicitar, consultar };
