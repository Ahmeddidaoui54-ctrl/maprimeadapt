const express = require('express');
const router = express.Router();
const supabase = require('../db');
const { requirePermission } = require('../auth');
const { runDailyAnomalyScan, ANOMALY_TYPES } = require('../anomaly');

// GET /api/anomalies — liste des anomalies (filtrables)
router.get('/', async (req, res) => {
  const { employee_id, severity, type, resolved, from, to, limit = 50 } = req.query;

  let query = supabase
    .from('planning_anomalies')
    .select('*, planning_employees(first_name, last_name, post)')
    .order('detected_at', { ascending: false })
    .limit(parseInt(limit, 10));

  if (employee_id) query = query.eq('employee_id', employee_id);
  if (severity) query = query.eq('severity', severity);
  if (type) query = query.eq('type', type);
  if (resolved !== undefined) query = query.eq('resolved', resolved === 'true');
  if (from) query = query.gte('detected_at', from);
  if (to) query = query.lte('detected_at', to);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/anomalies/summary — résumé chiffré
router.get('/summary', async (req, res) => {
  const { from, to } = req.query;
  let query = supabase.from('planning_anomalies').select('type, severity, resolved');

  if (from) query = query.gte('detected_at', from);
  if (to) query = query.lte('detected_at', to);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const summary = {
    total: data.length,
    unresolved: data.filter(a => !a.resolved).length,
    by_severity: { low: 0, medium: 0, high: 0 },
    by_type: {}
  };

  for (const a of data) {
    if (summary.by_severity[a.severity] !== undefined) summary.by_severity[a.severity]++;
    summary.by_type[a.type] = (summary.by_type[a.type] || 0) + 1;
  }

  res.json(summary);
});

// GET /api/anomalies/types — liste des types possibles
router.get('/types', (_, res) => res.json(ANOMALY_TYPES));

// POST /api/anomalies/scan — déclencher un scan manuel
router.post('/scan', requirePermission('anomalies:scan'), async (req, res) => {
  const result = await runDailyAnomalyScan(req.body.focus_type || null);
  res.json(result);
});

// PATCH /api/anomalies/:id/resolve — marquer comme traité
router.patch('/:id/resolve', requirePermission('anomalies:write'), async (req, res) => {
  const { resolution_note } = req.body;
  const { data, error } = await supabase
    .from('planning_anomalies')
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolution_note,
      resolved_by: req.apiKeyRecord?.label
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
