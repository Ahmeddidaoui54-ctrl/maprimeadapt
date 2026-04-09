const { createClient } = require('@supabase/supabase-js');

let supabase = null;

function getDb() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;
    if (!url || !key) {
      console.warn('[DB] Supabase non configuré — mode mémoire locale');
      return null;
    }
    supabase = createClient(url, key);
  }
  return supabase;
}

// --- Helpers génériques ---

async function insert(table, row) {
  const db = getDb();
  if (!db) { console.log(`[DB-LOCAL] ${table}:`, JSON.stringify(row)); return row; }
  const { data, error } = await db.from(table).insert(row).select().single();
  if (error) console.error(`[DB] insert ${table}:`, error.message);
  return data;
}

async function select(table, filters = {}, opts = {}) {
  const db = getDb();
  if (!db) return [];
  let q = db.from(table).select('*');
  for (const [k, v] of Object.entries(filters)) {
    q = q.eq(k, v);
  }
  if (opts.order) q = q.order(opts.order, { ascending: opts.asc ?? false });
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) console.error(`[DB] select ${table}:`, error.message);
  return data || [];
}

async function update(table, id, changes) {
  const db = getDb();
  if (!db) { console.log(`[DB-LOCAL] update ${table} #${id}:`, changes); return changes; }
  const { data, error } = await db.from(table).update(changes).eq('id', id).select().single();
  if (error) console.error(`[DB] update ${table}:`, error.message);
  return data;
}

async function count(table, filters = {}) {
  const db = getDb();
  if (!db) return 0;
  let q = db.from(table).select('*', { count: 'exact', head: true });
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
  const { count: c, error } = await q;
  if (error) console.error(`[DB] count ${table}:`, error.message);
  return c || 0;
}

// --- Helpers spécifiques ---

async function log(bot, action, auth = 'auto', result = null, data = null) {
  return insert('logs', { bot, action, auth, result, data });
}

async function hashExists(hash) {
  const db = getDb();
  if (!db) return false;
  const { count: c } = await db.from('ops').select('*', { count: 'exact', head: true }).eq('hash', hash);
  return (c || 0) > 0;
}

module.exports = { getDb, insert, select, update, count, log, hashExists };
