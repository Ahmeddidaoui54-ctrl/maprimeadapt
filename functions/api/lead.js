// Cloudflare Pages Function — POST /api/lead
// Reçoit les leads du formulaire et les envoie directement à Brevo
// Variables d'environnement à configurer dans Cloudflare Pages > Settings > Variables :
//   BREVO_API_KEY, BREVO_LIST_ID, BREVO_SENDER, NOTIF_EMAIL

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function sanitize(s, max=100) { return String(s||'').trim().slice(0, max); }
function isValidPhone(p) { return /^[\d\s+().-]{7,20}$/.test(p); }
function isValidCP(cp) { return /^\d{5}$/.test(cp); }

// Rate limit simple via KV ou headers IP (best-effort sans KV)
const ipHits = new Map();
function rateLimit(ip) {
  const now = Date.now();
  const e = ipHits.get(ip) || { n:0, reset: now+3600000 };
  if(now > e.reset) { e.n=0; e.reset=now+3600000; }
  e.n++; ipHits.set(ip, e);
  return e.n > 5;
}

export async function onRequestPost({ request, env }) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if(rateLimit(ip)) {
    return new Response(JSON.stringify({ error:'Trop de soumissions, réessaie dans 1h' }), {
      status: 429, headers: corsHeaders(request)
    });
  }

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error:'JSON invalide' }), { status:400, headers: corsHeaders(request) }); }

  const prenom    = sanitize(body.prenom, 50);
  const nom       = sanitize(body.nom, 50);
  const telephone = sanitize(body.telephone, 20);
  const cp        = sanitize(body.cp, 5);
  const situation = sanitize(body.situation, 100);
  const consent   = body.consent;

  if(!telephone || !consent)       return err('Champs requis manquants', 400, request);
  if(!isValidPhone(telephone))     return err('Téléphone invalide', 400, request);
  if(cp && !isValidCP(cp))         return err('Code postal invalide', 400, request);

  const BREVO_KEY  = env.BREVO_API_KEY;
  const LIST_ID    = parseInt(env.BREVO_LIST_ID || '2');
  const SENDER     = env.BREVO_SENDER     || 'noreply@maprimeadapt-idf.fr';
  const NOTIF      = env.NOTIF_EMAIL      || 'contact@maprimeadapt-idf.fr';

  if(BREVO_KEY) {
    const headers = { 'api-key': BREVO_KEY, 'Content-Type':'application/json' };

    // Ajout contact Brevo
    await fetch('https://api.brevo.com/v3/contacts', {
      method:'POST', headers,
      body: JSON.stringify({
        email: body.email || `${telephone.replace(/\D/g,'')}@noemail.local`,
        firstName: prenom, lastName: nom,
        attributes: { TELEPHONE: telephone, CODE_POSTAL: cp, SITUATION: situation },
        listIds: [LIST_ID], updateEnabled: true,
      })
    }).catch(()=>{});

    // Email de notification interne
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method:'POST', headers,
      body: JSON.stringify({
        sender: { name:'MaPrimeAdapt Lead', email: SENDER },
        to: [{ email: NOTIF }],
        subject: `Nouveau lead — ${esc(prenom)} ${esc(nom)} (${esc(cp)})`,
        htmlContent: `<p><b>${esc(prenom)} ${esc(nom)}</b><br>📞 ${esc(telephone)}<br>📍 ${esc(cp)}<br>Situation : ${esc(situation)}</p>`,
      })
    }).catch(()=>{});
  }

  return new Response(JSON.stringify({ ok:true }), { status:200, headers: corsHeaders(request) });
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status:204, headers: corsHeaders(request) });
}

function corsHeaders(request) {
  const origin = request.headers.get('origin') || '';
  const allowed = ['https://maprimeadapt-idf.fr','https://maprimeadapt-idf.pages.dev','http://localhost'];
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin':  allowed.some(o => origin.startsWith(o)) ? origin : 'https://maprimeadapt-idf.fr',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function err(msg, status, request) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: corsHeaders(request) });
}
