require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const path = require('path');

const employeesRouter = require('./src/routes/employees');
const schedulesRouter = require('./src/routes/schedules');
const timeclockRouter = require('./src/routes/timeclock');
const anomaliesRouter = require('./src/routes/anomalies');
const apikeysRouter = require('./src/routes/apikeys');
const { requireApiKey } = require('./src/auth');
const { runDailyAnomalyScan } = require('./src/anomaly');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// Fichiers statiques (dashboard)
app.use(express.static(path.join(__dirname)));

// Limitation de débit globale
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use('/api', limiter);

// Routes publiques
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'planning-salaries', ts: new Date().toISOString() }));
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));

// Toutes les routes API nécessitent une clé valide
app.use('/api', requireApiKey);
app.use('/api/employees', employeesRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/timeclock', timeclockRouter);
app.use('/api/anomalies', anomaliesRouter);
app.use('/api/apikeys', apikeysRouter);

// Scan d'anomalies automatique chaque matin à 7h
cron.schedule('0 7 * * *', async () => {
  console.log('[CRON] Scan anomalies quotidien...');
  const result = await runDailyAnomalyScan();
  console.log(`[CRON] Scan terminé: ${result.detected} anomalies détectées`);
});

// Rapport de fin de journée à 21h
cron.schedule('0 21 * * *', async () => {
  console.log('[CRON] Vérification pointages manquants fin de journée...');
  const result = await runDailyAnomalyScan('missed_clock_out');
  console.log(`[CRON] ${result.detected} pointages de sortie manquants`);
});

app.listen(PORT, () => {
  console.log(`Planning Salariés démarré sur le port ${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}`);
  console.log(`API: http://localhost:${PORT}/api`);
});
