const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.post('/register', async (req, res) => {
  const { nome, email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ error: 'email/senha required' });
  const hash = await bcrypt.hash(senha, 10);
  try {
    const user = await prisma.user.create({ data: { nome, email, senha: hash } });
    res.json({ id: user.id, email: user.email });
  } catch (err) {
    res.status(500).json({ error: 'registration failed' });
  }
});

router.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'invalid credentials' });
  const ok = await bcrypt.compare(senha, user.senha);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });
  const token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '2h' });
  res.json({ token });
});

module.exports = router;
