const { Router } = require("express");
const contasController = require("../controllers/contas.controller");
const { autenticar } = require("../middleware/auth");

const router = Router();

router.get("/saldo", autenticar, contasController.saldo);
router.get("/extrato", autenticar, contasController.extrato);

module.exports = router;
