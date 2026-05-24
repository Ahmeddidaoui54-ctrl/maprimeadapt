const supabase = require('./db');

// Extrait la clé depuis Authorization: Bearer <key> ou ?api_key=<key>
function extractKey(req) {
  const header = req.headers['authorization'] || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return req.query.api_key || req.headers['x-api-key'] || null;
}

async function requireApiKey(req, res, next) {
  const key = extractKey(req);
  if (!key) {
    return res.status(401).json({ error: 'Clé API manquante (Authorization: Bearer <key>)' });
  }

  // Clé admin directe (pour la gestion initiale)
  if (key === process.env.ADMIN_SECRET) {
    req.apiKeyRecord = { id: 'admin', label: 'Admin', permissions: ['*'], is_admin: true };
    return next();
  }

  const { data, error } = await supabase
    .from('planning_api_keys')
    .select('*')
    .eq('key_value', key)
    .eq('active', true)
    .single();

  if (error || !data) {
    await supabase.from('planning_audit_log').insert({
      action: 'auth_failure',
      detail: { key_prefix: key.slice(0, 8) + '...', ip: req.ip },
      severity: 'warning'
    });
    return res.status(403).json({ error: 'Clé API invalide ou désactivée' });
  }

  // Mise à jour de la dernière utilisation
  await supabase
    .from('planning_api_keys')
    .update({ last_used_at: new Date().toISOString(), use_count: (data.use_count || 0) + 1 })
    .eq('id', data.id);

  req.apiKeyRecord = data;
  next();
}

// Vérifie une permission spécifique (ex: 'schedules:write')
function requirePermission(perm) {
  return (req, res, next) => {
    const perms = req.apiKeyRecord?.permissions || [];
    if (perms.includes('*') || perms.includes(perm)) return next();
    return res.status(403).json({ error: `Permission insuffisante: ${perm} requise` });
  };
}

module.exports = { requireApiKey, requirePermission };
