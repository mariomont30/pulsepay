const { Router } = require("express");
const authController = require("../controllers/auth.controller");
const { validar } = require("../middleware/validate");
const { registroSchema, loginSchema } = require("../schemas/validation.schemas");

const router = Router();

router.post("/registrar", validar(registroSchema), authController.registrar);
router.post("/login", validar(loginSchema), authController.login);

module.exports = router;
