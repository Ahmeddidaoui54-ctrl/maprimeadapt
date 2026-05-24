const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../db');
const { requirePermission } = require('../auth');

const ALL_PERMISSIONS = [
  'employees:write',
  'schedules:write',
  'timeclock:write',
  'anomalies:write',
  'anomalies:scan',
  'apikeys:write'
];

// GET /api/apikeys — liste des clés (masquées)
router.get('/', requirePermission('apikeys:write'), async (req, res) => {
  const { data, error } = await supabase
    .from('planning_api_keys')
    .select('id, label, permissions, active, created_at, last_used_at, use_count')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/apikeys — créer une nouvelle clé
router.post('/', requirePermission('apikeys:write'), async (req, res) => {
  const { label, permissions } = req.body;
  if (!label) return res.status(400).json({ error: 'label requis' });

  const perms = Array.isArray(permissions) ? permissions : ['timeclock:write'];
  const invalid = perms.filter(p => p !== '*' && !ALL_PERMISSIONS.includes(p));
  if (invalid.length > 0) {
    return res.status(400).json({ error: `Permissions inconnues: ${invalid.join(', ')}`, valid: ALL_PERMISSIONS });
  }

  const key = `psk_${uuidv4().replace(/-/g, '')}`;
  const { data, error } = await supabase
    .from('planning_api_keys')
    .insert({ label, permissions: perms, key_value: key, active: true, use_count: 0 })
    .select('id, label, permissions, active, created_at')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // La valeur brute n'est retournée qu'à la création
  res.status(201).json({ ...data, key_value: key, warning: 'Conservez cette clé, elle ne sera plus affichée.' });
});

// PATCH /api/apikeys/:id — activer/désactiver ou changer les permissions
router.patch('/:id', requirePermission('apikeys:write'), async (req, res) => {
  const { active, permissions, label } = req.body;
  const updates = {};
  if (active !== undefined) updates.active = active;
  if (label) updates.label = label;
  if (permissions) updates.permissions = permissions;

  const { data, error } = await supabase
    .from('planning_api_keys')
    .update(updates)
    .eq('id', req.params.id)
    .select('id, label, permissions, active')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/apikeys/:id
router.delete('/:id', requirePermission('apikeys:write'), async (req, res) => {
  const { error } = await supabase.from('planning_api_keys').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
