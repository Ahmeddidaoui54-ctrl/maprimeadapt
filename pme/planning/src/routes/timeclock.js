const express = require('express');
const router = express.Router();
const supabase = require('../db');
const { detectAnomalies } = require('../anomaly');
const { requirePermission } = require('../auth');

// POST /api/timeclock — enregistrer un pointage (depuis logiciel externe)
// Body: { employee_id, type: 'in'|'out', clocked_at?: ISO8601, source?, note? }
router.post('/', requirePermission('timeclock:write'), async (req, res) => {
  const { employee_id, type, clocked_at, source, note } = req.body;

  if (!employee_id || !type) {
    return res.status(400).json({ error: 'employee_id et type (in/out) requis' });
  }
  if (!['in', 'out'].includes(type)) {
    return res.status(400).json({ error: "type doit être 'in' ou 'out'" });
  }

  // Vérifier que le salarié existe
  const { data: emp } = await supabase
    .from('planning_employees')
    .select('id, first_name, last_name, active')
    .eq('id', employee_id)
    .single();

  if (!emp) return res.status(404).json({ error: 'Salarié introuvable' });
  if (!emp.active) return res.status(403).json({ error: 'Salarié inactif' });

  const ts = clocked_at || new Date().toISOString();

  const { data: entry, error } = await supabase
    .from('planning_timeclock')
    .insert({
      employee_id,
      type,
      clocked_at: ts,
      source: source || req.apiKeyRecord?.label || 'api',
      note,
      api_key_id: req.apiKeyRecord?.id
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Détection d'anomalies en arrière-plan
  const anomalies = await detectAnomalies(employee_id, entry);

  res.status(201).json({
    entry,
    employee: { id: emp.id, name: `${emp.first_name} ${emp.last_name}` },
    anomalies_detected: anomalies.length,
    anomalies: anomalies.map(a => ({ type: a.type, label: a.label, severity: a.severity }))
  });
});

// GET /api/timeclock?employee_id=&from=&to=&type=
router.get('/', async (req, res) => {
  const { employee_id, from, to, type, limit = 100 } = req.query;
  let query = supabase
    .from('planning_timeclock')
    .select('*, planning_employees(first_name, last_name)')
    .order('clocked_at', { ascending: false })
    .limit(parseInt(limit, 10));

  if (employee_id) query = query.eq('employee_id', employee_id);
  if (type) query = query.eq('type', type);
  if (from) query = query.gte('clocked_at', from);
  if (to) query = query.lte('clocked_at', to);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/timeclock/live — état actuel (qui est présent en ce moment)
router.get('/live', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('planning_timeclock')
    .select('employee_id, type, clocked_at, planning_employees(first_name, last_name, post)')
    .gte('clocked_at', `${today}T00:00:00`)
    .order('clocked_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // Pour chaque salarié, retenir le dernier pointage
  const byEmployee = {};
  for (const e of data) {
    if (!byEmployee[e.employee_id]) byEmployee[e.employee_id] = e;
  }

  const present = Object.values(byEmployee).filter(e => e.type === 'in');
  const absent = Object.values(byEmployee).filter(e => e.type === 'out');
  const unseen = []; // salariés avec planning mais sans pointage

  res.json({ present, absent, date: today });
});

// DELETE /api/timeclock/:id — correction d'un pointage erroné
router.delete('/:id', requirePermission('timeclock:write'), async (req, res) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'Motif de suppression requis' });

  const { data: entry } = await supabase
    .from('planning_timeclock')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (!entry) return res.status(404).json({ error: 'Pointage introuvable' });

  await supabase.from('planning_audit_log').insert({
    action: 'timeclock_deleted',
    detail: { deleted_entry: entry, reason, deleted_by: req.apiKeyRecord?.label },
    severity: 'warning'
  });

  const { error } = await supabase.from('planning_timeclock').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
