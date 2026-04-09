// Endpoint capture leads MaPrimeAdapt → Brevo
const axios = require('axios');

// Échappement HTML pour prévenir l'injection dans les emails internes
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Rate limiting simple en mémoire — 5 soumissions / IP / heure
const rateMap = new Map();
function rateLimit(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip) || { count:0, reset: now + 3600000 };
  if(now > entry.reset) { entry.count = 0; entry.reset = now + 3600000; }
  entry.count++;
  rateMap.set(ip, entry);
  return entry.count > 5;
}

// Validation stricte des champs
function sanitize(s, maxLen=100) { return String(s||'').trim().slice(0, maxLen); }
function isValidPhone(p) { return /^[\d\s+().-]{7,20}$/.test(p); }
function isValidCP(cp) { return /^\d{5}$/.test(cp); }

module.exports = function(app) {
  app.post('/api/lead', async (req,res) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    if(rateLimit(ip)) return res.status(429).json({ error:'Trop de soumissions, réessaie dans 1h' });

    const prenom    = sanitize(req.body.prenom, 50);
    const nom       = sanitize(req.body.nom, 50);
    const telephone = sanitize(req.body.telephone, 20);
    const cp        = sanitize(req.body.cp, 5);
    const situation = sanitize(req.body.situation, 100);
    const consent   = req.body.consent;

    if(!telephone || !consent) return res.status(400).json({ error:'Champs requis manquants' });
    if(!isValidPhone(telephone)) return res.status(400).json({ error:'Téléphone invalide' });
    if(cp && !isValidCP(cp)) return res.status(400).json({ error:'Code postal invalide' });

    console.log(`[LEAD] ${new Date().toISOString()} — ${prenom} ${nom} ${telephone} ${cp}`);

    if(process.env.BREVO_API_KEY) {
      try {
        await axios.post('https://api.brevo.com/v3/contacts', {
          email: req.body.email || `${telephone.replace(/\D/g,'')}@noemail.local`,
          firstName: prenom, lastName: nom,
          attributes: { TELEPHONE: telephone, CODE_POSTAL: cp, SITUATION: situation },
          listIds: [parseInt(process.env.BREVO_LIST_ID || 2)],
          updateEnabled: true,
        }, { headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type':'application/json' } });

        await axios.post('https://api.brevo.com/v3/smtp/email', {
          sender: { name:'MaPrimeAdapt Lead', email: process.env.BREVO_SENDER || 'noreply@maprimeadapt-idf.fr' },
          to: [{ email: process.env.NOTIF_EMAIL || 'contact@maprimeadapt-idf.fr' }],
          subject: `Nouveau lead — ${esc(prenom)} ${esc(nom)} (${esc(cp)})`,
          htmlContent: `<p><b>${esc(prenom)} ${esc(nom)}</b><br>📞 ${esc(telephone)}<br>📍 ${esc(cp)}<br>Situation : ${esc(situation)}</p>`,
        }, { headers: { 'api-key': process.env.BREVO_API_KEY } });

        console.log(`[LEAD] Envoyé à Brevo ✓`);
      } catch(e) { console.error('[LEAD] Erreur Brevo:', e.response?.data?.message || e.message); }
    }
    res.json({ ok: true });
  });
};
