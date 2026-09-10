const express = require('express');
const router = express.Router();
const amqplib = require('amqplib');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const RABBIT_URL = process.env.RABBITMQ_URL || 'amqp://rabbitmq';
const QUEUE = process.env.RABBITMQ_QUEUE || 'transferencias';

async function publish(message) {
  const conn = await amqplib.connect(RABBIT_URL);
  const ch = await conn.createChannel();
  await ch.assertQueue(QUEUE, { durable: true });
  ch.sendToQueue(QUEUE, Buffer.from(JSON.stringify(message)), { persistent: true });
  setTimeout(() => { ch.close(); conn.close(); }, 500);
}

router.post('/', async (req, res) => {
  const { fromAccountId, toAccountId, amount } = req.body;
  if (!fromAccountId || !toAccountId || !amount) return res.status(400).json({ error: 'missing fields' });
  try {
    const tx = await prisma.transaction.create({ data: { fromAccountId, toAccountId, amount: Number(amount), status: 'PENDENTE' } });
    await publish({ txId: tx.id });
    res.status(202).json({ id: tx.id, status: tx.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed' });
  }
});

module.exports = router;
