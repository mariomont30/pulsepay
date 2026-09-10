const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.get('/me', async (req, res) => {
  const userId = req.user.sub;
  const conta = await prisma.account.findUnique({ where: { userId } });
  if (!conta) return res.status(404).json({ error: 'Conta não encontrada' });
  res.json({ id: conta.id, saldo: conta.balance });
});

module.exports = router;
