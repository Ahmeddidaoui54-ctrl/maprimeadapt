const express = require('express');
const router = express.Router();
const supabase = require('../db');
const { requirePermission } = require('../auth');
const { generateWeeklySchedule, computeWorkedHours } = require('../scheduler');

// GET /api/schedules?employee_id=&from=&to=
router.get('/', async (req, res) => {
  const { employee_id, from, to, date } = req.query;
  let query = supabase
    .from('planning_schedules')
    .select('*, planning_employees(first_name, last_name, post)')
    .order('date')
    .order('start_time');

  if (employee_id) query = query.eq('employee_id', employee_id);
  if (date) query = query.eq('date', date);
  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/schedules/today — planning du jour pour tous les salariés
router.get('/today', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('planning_schedules')
    .select('*, planning_employees(id, first_name, last_name, post)')
    .eq('date', today)
    .order('start_time');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/schedules/hours?employee_id=&from=&to=
router.get('/hours', async (req, res) => {
  const { employee_id, from, to } = req.query;
  if (!employee_id || !from || !to) {
    return res.status(400).json({ error: 'employee_id, from et to requis' });
  }
  const result = await computeWorkedHours(employee_id, from, to);
  res.json(result);
});

// POST /api/schedules — créer un shift
router.post('/', requirePermission('schedules:write'), async (req, res) => {
  const { employee_id, date, start_time, end_time, post, note } = req.body;
  if (!employee_id || !date || !start_time || !end_time) {
    return res.status(400).json({ error: 'employee_id, date, start_time, end_time requis' });
  }
  const { data, error } = await supabase
    .from('planning_schedules')
    .insert({ employee_id, date, start_time, end_time, post, note })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// POST /api/schedules/weekly — génère une semaine entière depuis un modèle
router.post('/weekly', requirePermission('schedules:write'), async (req, res) => {
  const { employee_id, week_start, template } = req.body;
  if (!employee_id || !week_start || !template) {
    return res.status(400).json({ error: 'employee_id, week_start, template requis' });
  }
  try {
    const result = await generateWeeklySchedule(employee_id, week_start, template);
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/schedules/:id
router.patch('/:id', requirePermission('schedules:write'), async (req, res) => {
  const allowed = ['start_time', 'end_time', 'post', 'note'];
  const updates = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  }
  const { data, error } = await supabase
    .from('planning_schedules')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/schedules/:id
router.delete('/:id', requirePermission('schedules:write'), async (req, res) => {
  const { error } = await supabase.from('planning_schedules').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
