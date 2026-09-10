require('dotenv').config();
const amqplib = require('amqplib');
const { PrismaClient } = require('@prisma/client');
const promClient = require('prom-client');
const io = require('socket.io-client');

const prisma = new PrismaClient();
const QUEUE = process.env.RABBITMQ_QUEUE || 'transferencias';
const RABBIT_URL = process.env.RABBITMQ_URL || 'amqp://rabbitmq';

const socketUrl = process.env.WS_URL || 'http://frontend:3000';
const socket = io(socketUrl, { autoConnect: false });

async function start() {
  const conn = await amqplib.connect(RABBIT_URL);
  const ch = await conn.createChannel();
  await ch.assertQueue(QUEUE, { durable: true });
  ch.prefetch(1);
  console.log('Worker waiting for messages...');
  ch.consume(QUEUE, async (msg) => {
    if (!msg) return;
    const content = JSON.parse(msg.content.toString());
    const txId = content.txId;
    try {
      const tx = await prisma.transaction.findUnique({ where: { id: txId } });
      if (!tx) {
        ch.ack(msg);
        return;
      }
      // idempotency: check status
      if (tx.status === 'CONCLUÍDO') { ch.ack(msg); return; }
      await prisma.$transaction(async (txConn) => {
        const from = await prisma.account.findUnique({ where: { id: tx.fromAccountId } });
        const to = await prisma.account.findUnique({ where: { id: tx.toAccountId } });
        if (!from || !to) throw new Error('account not found');
        if (from.balance < tx.amount) throw new Error('insufficient funds');
        // debit/credit
        await prisma.account.update({ where: { id: from.id }, data: { balance: from.balance - tx.amount } });
        await prisma.account.update({ where: { id: to.id }, data: { balance: to.balance + tx.amount } });
        await prisma.transaction.update({ where: { id: tx.id }, data: { status: 'CONCLUÍDO' } });
        await prisma.audit.create({ data: { event: 'TRANSFER_COMPLETED', payload: { txId: tx.id } } });
      });
      // notify via websocket (best-effort)
      try { socket.emit('transfer_completed', { txId }); } catch (e) {}
      ch.ack(msg);
    } catch (err) {
      console.error('worker error', err);
      // leave message for retry (or send to dead-letter)
      ch.nack(msg, false, false);
    }
  });
}

start().catch(err => { console.error(err); process.exit(1); });
