/**
 * Module RH · Planning & Monitoring des salariés
 * Clés API individuelles + détection d'anomalies automatique
 */

const crypto = require('crypto');
const db = require('./db');

// ============================================================
// CONSTANTES
// ============================================================

const URGENCE = {
  ROUGE:  { label: 'ROUGE',  min: 8 },
  ORANGE: { label: 'ORANGE', min: 5 },
  VERTE:  { label: 'VERTE',  min: 2 },
};

// Actions considérées comme sensibles / haut risque (pour tous les postes)
const SENSITIVE_ACTIONS = new Set([
  'acces_coffre', 'modification_prix', 'annulation_vente', 'remboursement',
  'acces_admin', 'export_donnees', 'suppression_enregistrement',
  'modification_stock_manuel', 'ouverture_nuit', 'acces_serveur',
]);

// Plages horaires normales (06h–23h) — toute activité hors plage = anomalie
const HEURE_MIN_NORMALE = 6;
const HEURE_MAX_NORMALE = 23;

// ── Profil secrétaire polyvalente ──
// Ce poste a un périmètre transversal légitime :
// accès multi-pôles, exports de synthèse, saisies multi-domaines.
// Les actions ci-dessous sont normales pour ce rôle → ne déclenchent PAS d'anomalie sensible.
const SECRETAIRE_EXTENDED_PERMS = new Set([
  // Accès légitimes multi-pôles
  'export_donnees', 'acces_admin',
  // RH
  'saisie_conges_absences', 'suivi_absences_maladies', 'onboarding_nouveau_salarie',
  'validation_shifts', 'coordination_planning_jour', 'relance_absences',
  'planification_semaine', 'validation_planning_suivant',
  // Comptabilité
  'suivi_factures', 'relances_clients', 'notes_de_frais',
  'rapprochement_bancaire', 'transmission_comptable',
  // Reporting & pilotage
  'rapport_hebdo_direction', 'rapport_mensuel', 'consolidation_kpis',
  'bilan_semaine_precedente', 'bilan_anomalies_mensuel', 'audit_process',
  // Logistique & accès
  'gestion_acces_locaux', 'suivi_prestataires', 'gestion_fournitures',
]);

// Postes à périmètre large — anomalie sensible pondérée différemment
const POSTES_ELARGIS = new Set(['secretaire', 'responsable']);

// ============================================================
// GÉNÉRATION & GESTION DES CLÉS API
// ============================================================

/**
 * Génère une clé API unique pour un salarié.
 * Format : EMP-{8hex}-{8hex}-{8hex}
 */
function generateApiKey() {
  const part = () => crypto.randomBytes(4).toString('hex').toUpperCase();
  return `EMP-${part()}-${part()}-${part()}`;
}

/**
 * Crée un nouveau salarié avec clé API auto-générée.
 * @param {Object} params - { nom, prenom, poste, email, phone, data }
 * @returns {Object} salarié créé (avec api_key)
 */
async function createEmployee(params) {
  const { nom, prenom, poste, email, phone, data = {} } = params;
  if (!nom || !prenom || !poste) throw new Error('nom, prenom et poste sont requis');

  const api_key   = generateApiKey();
  const key_label = `Badge ${prenom} ${nom} · ${poste}`;

  const employee = await db.insert('employees', {
    nom, prenom, poste, email, phone,
    api_key, key_label,
    status: 'actif',
    data,
  });

  await db.log('rh', 'create_employee', 'auto',
    `Salarié créé : ${prenom} ${nom} (${poste}) · Clé: ${api_key}`
  );

  return employee;
}

/**
 * Liste les salariés (filtrés par status par défaut).
 */
async function listEmployees(status = 'actif') {
  const filters = status ? { status } : {};
  return db.select('employees', filters, { order: 'created_at' });
}

/**
 * Récupère un salarié par son ID.
 */
async function getEmployee(id) {
  const rows = await db.select('employees', { id });
  return rows[0] || null;
}

/**
 * Résout un salarié depuis sa clé API.
 */
async function resolveByKey(api_key) {
  const rows = await db.select('employees', { api_key, status: 'actif' });
  return rows[0] || null;
}

/**
 * Régénère la clé API d'un salarié (révocation de l'ancienne).
 */
async function rotateKey(employee_id) {
  const new_key   = generateApiKey();
  const employee  = await getEmployee(employee_id);
  if (!employee) throw new Error('Salarié introuvable');

  await db.update('employees', employee_id, {
    api_key:   new_key,
    key_label: `Badge ${employee.prenom} ${employee.nom} · ${employee.poste} (renouvelé)`,
  });

  await db.log('rh', 'rotate_key', 'n1',
    `Clé renouvelée pour ${employee.prenom} ${employee.nom} · Nouvelle clé: ${new_key}`
  );

  return { employee_id, new_key };
}

/**
 * Met à jour le statut d'un salarié.
 */
async function updateEmployeeStatus(id, status) {
  const allowed = ['actif', 'inactif', 'suspendu'];
  if (!allowed.includes(status)) throw new Error(`Status invalide: ${status}`);
  return db.update('employees', id, { status });
}

// ============================================================
// GESTION DU PLANNING (SHIFTS)
// ============================================================

/**
 * Crée un shift planifié pour un salarié.
 */
async function createShift(params) {
  const { employee_id, date_debut, date_fin, type = 'normal', poste, note, data = {} } = params;
  if (!employee_id || !date_debut || !date_fin) {
    throw new Error('employee_id, date_debut et date_fin sont requis');
  }

  const debut = new Date(date_debut);
  const fin   = new Date(date_fin);
  if (fin <= debut) throw new Error('date_fin doit être après date_debut');

  const shift = await db.insert('shifts', {
    employee_id, date_debut: debut.toISOString(), date_fin: fin.toISOString(),
    type, poste, note, status: 'planifie', data,
  });

  await db.log('rh', 'create_shift', 'auto',
    `Shift créé: salarié #${employee_id} · ${debut.toLocaleDateString('fr-FR')} ${debut.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} → ${fin.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  );

  return shift;
}

/**
 * Récupère les shifts d'un salarié (optionnellement filtrés par date).
 */
async function getEmployeeShifts(employee_id, dateStr = null) {
  const dbClient = db.getDb();
  if (!dbClient) return [];

  let q = dbClient.from('shifts').select('*').eq('employee_id', employee_id);
  if (dateStr) {
    const start = new Date(dateStr); start.setHours(0, 0, 0, 0);
    const end   = new Date(dateStr); end.setHours(23, 59, 59, 999);
    q = q.gte('date_debut', start.toISOString()).lte('date_debut', end.toISOString());
  }
  q = q.order('date_debut', { ascending: true });
  const { data, error } = await q;
  if (error) console.error('[RH] getEmployeeShifts:', error.message);
  return data || [];
}

/**
 * Planning du jour : tous les shifts actifs / planifiés aujourd'hui.
 */
async function getTodaySchedule() {
  const dbClient = db.getDb();
  if (!dbClient) return [];

  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end   = new Date(); end.setHours(23, 59, 59, 999);

  const { data, error } = await dbClient
    .from('shifts')
    .select('*, employees(nom, prenom, poste, api_key, status)')
    .gte('date_debut', start.toISOString())
    .lte('date_debut', end.toISOString())
    .order('date_debut', { ascending: true });

  if (error) console.error('[RH] getTodaySchedule:', error.message);
  return data || [];
}

/**
 * Planning sur une plage de dates.
 */
async function getScheduleRange(from, to) {
  const dbClient = db.getDb();
  if (!dbClient) return [];

  const { data, error } = await dbClient
    .from('shifts')
    .select('*, employees(nom, prenom, poste)')
    .gte('date_debut', new Date(from).toISOString())
    .lte('date_fin',   new Date(to).toISOString())
    .order('date_debut', { ascending: true });

  if (error) console.error('[RH] getScheduleRange:', error.message);
  return data || [];
}

/**
 * Met à jour le statut d'un shift.
 */
async function updateShiftStatus(shift_id, status) {
  const allowed = ['planifie', 'actif', 'termine', 'absent', 'retard'];
  if (!allowed.includes(status)) throw new Error(`Status shift invalide: ${status}`);
  return db.update('shifts', shift_id, { status });
}

// ============================================================
// MOTEUR DE DÉTECTION D'ANOMALIES
// ============================================================

/**
 * Calcule un score d'anomalie (0-10) pour une action.
 * Retourne { score, reasons[] }
 */
async function scoreAnomaly(employee, action, context, ts, source) {
  const reasons = [];
  let score = 0;
  const now = ts ? new Date(ts) : new Date();
  const hour = now.getHours();

  // A1 · Action hors horaires normaux
  if (hour < HEURE_MIN_NORMALE || hour >= HEURE_MAX_NORMALE) {
    score += 4;
    reasons.push(`Action à ${hour}h (hors plage ${HEURE_MIN_NORMALE}h-${HEURE_MAX_NORMALE}h)`);
  }

  // A2 · Action sensible (pondération réduite pour postes à périmètre large)
  if (SENSITIVE_ACTIONS.has(action)) {
    const isExtended = POSTES_ELARGIS.has(employee.poste) &&
                       SECRETAIRE_EXTENDED_PERMS.has(action);
    if (!isExtended) {
      score += 3;
      reasons.push(`Action sensible détectée: ${action}`);
    } else {
      score += 1;
      reasons.push(`Action élargie (périmètre ${employee.poste} autorisé): ${action}`);
    }
  }

  // A3 · Salarié suspendu/inactif qui agit quand même
  if (employee.status !== 'actif') {
    score += 5;
    reasons.push(`Salarié ${employee.status} a effectué une action`);
  }

  // A4 · Action hors shift prévu
  const dbClient = db.getDb();
  if (dbClient) {
    const { data: activeShifts } = await dbClient
      .from('shifts')
      .select('*')
      .eq('employee_id', employee.id)
      .lte('date_debut', now.toISOString())
      .gte('date_fin',   now.toISOString());

    if (!activeShifts || activeShifts.length === 0) {
      score += 3;
      reasons.push('Action effectuée hors d\'un shift planifié');
    }
  }

  // A5 · Action non répertoriée dans le processus du poste
  if (dbClient) {
    const { data: steps } = await dbClient
      .from('process_steps')
      .select('action_name')
      .eq('poste', employee.poste);

    const knownActions = new Set((steps || []).map(s => s.action_name));
    if (knownActions.size > 0 && !knownActions.has(action)) {
      score += 2;
      reasons.push(`Action "${action}" absente du processus référence pour le poste ${employee.poste}`);
    }
  }

  // A6 · Fréquence anormale (>10 actions sur la dernière heure depuis cette clé)
  if (dbClient) {
    const oneHourAgo = new Date(now.getTime() - 3600000).toISOString();
    const { count: c } = await dbClient
      .from('employee_logs')
      .select('*', { count: 'exact', head: true })
      .eq('api_key', employee.api_key)
      .gte('ts', oneHourAgo);

    if ((c || 0) > 10) {
      score += 2;
      reasons.push(`Fréquence élevée: ${c} actions dans la dernière heure`);
    }
  }

  score = Math.min(score, 10);

  const urgence = score >= URGENCE.ROUGE.min  ? 'ROUGE'
               : score >= URGENCE.ORANGE.min ? 'ORANGE'
               : score >= URGENCE.VERTE.min  ? 'VERTE'
               : null;

  return { score, urgence, reasons };
}

// ============================================================
// JOURNALISATION D'ACTIVITÉ (via clé API)
// ============================================================

/**
 * Point d'entrée principal : enregistre une action depuis un logiciel externe.
 * L'appelant passe sa clé API → le système identifie l'employé et analyse.
 *
 * @param {string} api_key - Clé du salarié
 * @param {string} action  - Code action (ex: "pointage_entree", "acces_caisse")
 * @param {Object} opts    - { context, source, data }
 * @returns {Object}       - { logged, employee, anomaly }
 */
async function logActivity(api_key, action, opts = {}) {
  const { context = '', source = 'api', data = {} } = opts;

  if (!api_key || !action) throw new Error('api_key et action sont requis');

  const employee = await resolveByKey(api_key);

  // Clé inconnue ou salarié inactif : anomalie immédiate ROUGE
  if (!employee) {
    const entry = await db.insert('employee_logs', {
      api_key, action, context, source,
      anomaly_score: 10, is_anomaly: true, urgence: 'ROUGE',
      anomaly_reason: `Clé API inconnue ou salarié inactif: ${api_key}`,
      data,
    });
    await db.log('rh', 'unknown_key_attempt', 'auto',
      `ALERTE ROUGE · Tentative avec clé inconnue: ${api_key} · action: ${action}`,
      { api_key, action, source }
    );
    return { logged: true, employee: null, anomaly: { score: 10, urgence: 'ROUGE', reasons: ['Clé inconnue'] } };
  }

  // Analyser l'anomalie
  const { score, urgence, reasons } = await scoreAnomaly(employee, action, context, new Date(), source);
  const is_anomaly = score > 0;

  const entry = await db.insert('employee_logs', {
    employee_id: employee.id,
    api_key,
    action,
    context,
    source,
    anomaly_score: score,
    is_anomaly,
    urgence,
    anomaly_reason: reasons.length > 0 ? reasons.join(' | ') : null,
    data,
  });

  // Logguer en audit si anomalie signifiante
  if (is_anomaly && urgence) {
    await db.log('rh', `anomalie_${urgence.toLowerCase()}`, 'auto',
      `[${urgence}] ${employee.prenom} ${employee.nom} · ${action} · Score: ${score}/10 · ${reasons.join(', ')}`,
      { employee_id: employee.id, action, score, reasons }
    );
  }

  return {
    logged: true,
    employee: { id: employee.id, nom: employee.nom, prenom: employee.prenom, poste: employee.poste },
    anomaly: { score, urgence, reasons, is_anomaly },
  };
}

// ============================================================
// CONSULTATION DES ANOMALIES
// ============================================================

/**
 * Récupère les anomalies récentes (toutes urgences).
 */
async function getAnomalies(opts = {}) {
  const { limit = 50, urgence = null } = opts;
  const dbClient = db.getDb();
  if (!dbClient) return [];

  let q = dbClient
    .from('employee_logs')
    .select('*, employees(nom, prenom, poste)')
    .eq('is_anomaly', true)
    .order('ts', { ascending: false })
    .limit(limit);

  if (urgence) q = q.eq('urgence', urgence);

  const { data, error } = await q;
  if (error) console.error('[RH] getAnomalies:', error.message);
  return data || [];
}

/**
 * Résumé des anomalies par salarié (dashboard).
 */
async function anomalySummary() {
  const dbClient = db.getDb();
  if (!dbClient) return [];

  const since = new Date(Date.now() - 7 * 24 * 3600000).toISOString(); // 7 derniers jours

  const { data, error } = await dbClient
    .from('employee_logs')
    .select('employee_id, urgence, employees(nom, prenom, poste)')
    .eq('is_anomaly', true)
    .gte('ts', since);

  if (error) { console.error('[RH] anomalySummary:', error.message); return []; }

  const map = {};
  for (const row of (data || [])) {
    const key = row.employee_id;
    if (!map[key]) {
      map[key] = {
        employee_id: key,
        nom:    row.employees?.nom,
        prenom: row.employees?.prenom,
        poste:  row.employees?.poste,
        rouge: 0, orange: 0, verte: 0, total: 0,
      };
    }
    map[key].total++;
    if (row.urgence === 'ROUGE')  map[key].rouge++;
    if (row.urgence === 'ORANGE') map[key].orange++;
    if (row.urgence === 'VERTE')  map[key].verte++;
  }

  return Object.values(map).sort((a, b) => b.rouge - a.rouge || b.orange - a.orange);
}

// ============================================================
// VÉRIFICATIONS AUTOMATIQUES (cron)
// ============================================================

/**
 * Cron · Vérifie les arrivées manquantes (shift débuté depuis >30 min sans pointage).
 * Appelé toutes les 30 min depuis server.js
 */
async function checkMissingCheckIns() {
  const dbClient = db.getDb();
  if (!dbClient) return;

  const now     = new Date();
  const cutoff  = new Date(now.getTime() - 30 * 60000).toISOString(); // 30 min ago
  const dayStart= new Date(now); dayStart.setHours(0, 0, 0, 0);

  const { data: shifts, error } = await dbClient
    .from('shifts')
    .select('*, employees(nom, prenom, poste, api_key)')
    .eq('status', 'planifie')
    .lte('date_debut', cutoff)
    .gte('date_debut', dayStart.toISOString());

  if (error || !shifts) return;

  for (const shift of shifts) {
    const emp = shift.employees;
    if (!emp) continue;

    // Vérifier si un pointage_entree existe depuis le début du shift
    const { count: c } = await dbClient
      .from('employee_logs')
      .select('*', { count: 'exact', head: true })
      .eq('employee_id', shift.employee_id)
      .eq('action', 'pointage_entree')
      .gte('ts', shift.date_debut);

    if ((c || 0) === 0) {
      const retardMin = Math.floor((now - new Date(shift.date_debut)) / 60000);
      await db.log('rh', 'missing_checkin', 'auto',
        `[ORANGE] Pointage manquant: ${emp.prenom} ${emp.nom} · Retard: ${retardMin} min · Shift: ${shift.id}`,
        { shift_id: shift.id, employee_id: shift.employee_id, retard_min: retardMin }
      );
      await dbClient.from('shifts').update({ status: 'retard' }).eq('id', shift.id);
    }
  }
}

/**
 * Cron · Rapport journalier RH (résumé anomalies + présences).
 * Appelé à 20h30 depuis server.js
 */
async function dailyRhReport() {
  const dbClient = db.getDb();

  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const [employees, todayShifts, todayAnomalies] = await Promise.all([
    db.select('employees', { status: 'actif' }),
    dbClient ? (async () => {
      const { data } = await dbClient.from('shifts')
        .select('*').gte('date_debut', today.toISOString())
        .lt('date_debut', tomorrow.toISOString());
      return data || [];
    })() : [],
    dbClient ? (async () => {
      const { data } = await dbClient.from('employee_logs')
        .select('*').eq('is_anomaly', true)
        .gte('ts', today.toISOString());
      return data || [];
    })() : [],
  ]);

  const rouge  = todayAnomalies.filter(a => a.urgence === 'ROUGE').length;
  const orange = todayAnomalies.filter(a => a.urgence === 'ORANGE').length;
  const absent = todayShifts.filter(s => s.status === 'absent').length;
  const retard = todayShifts.filter(s => s.status === 'retard').length;

  const summary = `RH Journalier: ${employees.length} actifs · Shifts: ${todayShifts.length} · Absents: ${absent} · Retards: ${retard} · Anomalies ROUGE: ${rouge} · ORANGE: ${orange}`;

  await db.log('rh', 'daily_report', 'auto', summary, {
    employees: employees.length,
    shifts: todayShifts.length,
    absent, retard,
    anomalies: { rouge, orange, total: todayAnomalies.length },
  });

  return { summary, rouge, orange, absent, retard };
}

/**
 * Retourne les étapes de processus pour un poste donné.
 */
async function getProcessSteps(poste) {
  return db.select('process_steps', { poste }, { order: 'ordre', asc: true });
}

/**
 * Vérifie quelles étapes obligatoires manquent pour un salarié aujourd'hui.
 */
async function checkMissingSteps(employee_id) {
  const dbClient = db.getDb();
  if (!dbClient) return [];

  const emp = await getEmployee(employee_id);
  if (!emp) return [];

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const [steps, logs] = await Promise.all([
    db.select('process_steps', { poste: emp.poste, est_obligatoire: true }, { order: 'ordre', asc: true }),
    (async () => {
      const { data } = await dbClient.from('employee_logs')
        .select('action').eq('employee_id', employee_id).gte('ts', today.toISOString());
      return data || [];
    })(),
  ]);

  const doneActions = new Set(logs.map(l => l.action));
  return steps.filter(s => !doneActions.has(s.action_name)).map(s => ({
    action: s.action_name,
    description: s.description,
    heure_attendue: `${s.heure_min}h-${s.heure_max}h`,
  }));
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  // Employés
  createEmployee,
  listEmployees,
  getEmployee,
  resolveByKey,
  rotateKey,
  updateEmployeeStatus,

  // Planning
  createShift,
  getEmployeeShifts,
  getTodaySchedule,
  getScheduleRange,
  updateShiftStatus,

  // Activité & monitoring
  logActivity,
  getAnomalies,
  anomalySummary,
  getProcessSteps,
  checkMissingSteps,

  // Crons
  checkMissingCheckIns,
  dailyRhReport,

  // Utilitaires
  generateApiKey,
  SENSITIVE_ACTIONS,
};
