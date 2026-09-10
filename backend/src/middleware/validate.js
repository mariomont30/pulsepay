/**
 * Middleware genérico de validação de payload usando schemas Zod
 * (evita dados malformados chegando ao banco, ver seção 5 do README).
 */
function validar(schema) {
  return (req, res, next) => {
    const resultado = schema.safeParse(req.body);
    if (!resultado.success) {
      return res.status(400).json({
        erro: "Dados inválidos",
        detalhes: resultado.error.flatten().fieldErrors,
      });
    }
    req.body = resultado.data;
    return next();
  };
}

module.exports = { validar };
