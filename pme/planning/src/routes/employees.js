const express = require('express');
const router = express.Router();
const supabase = require('../db');
const { requirePermission } = require('../auth');

// GET /api/employees
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('planning_employees')
    .select('*')
    .order('last_name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/employees/:id
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('planning_employees')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(404).json({ error: 'Salarié introuvable' });
  res.json(data);
});

// POST /api/employees
router.post('/', requirePermission('employees:write'), async (req, res) => {
  const { first_name, last_name, email, phone, post, contract_type, weekly_hours } = req.body;
  if (!first_name || !last_name) {
    return res.status(400).json({ error: 'Prénom et nom obligatoires' });
  }
  const { data, error } = await supabase
    .from('planning_employees')
    .insert({ first_name, last_name, email, phone, post, contract_type, weekly_hours, active: true })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PATCH /api/employees/:id
router.patch('/:id', requirePermission('employees:write'), async (req, res) => {
  const allowed = ['first_name', 'last_name', 'email', 'phone', 'post', 'contract_type', 'weekly_hours', 'active'];
  const updates = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  }
  const { data, error } = await supabase
    .from('planning_employees')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/employees/:id (désactivation douce)
router.delete('/:id', requirePermission('employees:write'), async (req, res) => {
  const { error } = await supabase
    .from('planning_employees')
    .update({ active: false })
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
