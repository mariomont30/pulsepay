require('dotenv').config();
const express = require('express');
const cors = require('cors');
const promClient = require('prom-client');
const { PrismaClient } = require('@prisma/client');
const authRoutes = require('./routes/auth');
const contasRoutes = require('./routes/contas');
const transferRoutes = require('./routes/transferencias');
const authMiddleware = require('./middleware/auth');

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());

// Metrics
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics();
const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'code']
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

// Routes
app.use('/auth', authRoutes);
app.use('/contas', authMiddleware, contasRoutes);
app.use('/transferencias', authMiddleware, transferRoutes);

app.get('/', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));

module.exports = app;
