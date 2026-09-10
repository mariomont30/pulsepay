const { Router } = require("express");
const transferenciasController = require("../controllers/transferencias.controller");
const { autenticar } = require("../middleware/auth");
const { validar } = require("../middleware/validate");
const { transferenciaSchema } = require("../schemas/validation.schemas");

const router = Router();

router.post("/", autenticar, validar(transferenciaSchema), transferenciasController.solicitar);
router.get("/:id", autenticar, transferenciasController.consultar);

module.exports = router;
