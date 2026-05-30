-- Planning & Monitoring RH · Schema Supabase
-- Executer dans Supabase Dashboard > SQL Editor

-- Table 1 : Salariés
CREATE TABLE IF NOT EXISTS employees (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  nom         TEXT NOT NULL,
  prenom      TEXT NOT NULL,
  poste       TEXT NOT NULL,
  email       TEXT UNIQUE,
  phone       TEXT,
  status      TEXT DEFAULT 'actif',     -- actif, inactif, suspendu
  api_key     TEXT UNIQUE NOT NULL,     -- clé d'authentification individuelle
  key_label   TEXT,                     -- libellé lisible ex: "Badge Entrée Jérémy"
  data        JSONB                     -- infos complémentaires (contrat, horaires_ref, etc.)
);
CREATE INDEX IF NOT EXISTS idx_employees_status   ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_api_key  ON employees(api_key);

-- Table 2 : Planning des shifts
CREATE TABLE IF NOT EXISTS shifts (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  employee_id  BIGINT REFERENCES employees(id) ON DELETE CASCADE,
  date_debut   TIMESTAMPTZ NOT NULL,
  date_fin     TIMESTAMPTZ NOT NULL,
  type         TEXT DEFAULT 'normal',   -- normal, matin, apres-midi, nuit, astreinte
  poste        TEXT,                    -- poste/zone affectée
  status       TEXT DEFAULT 'planifie', -- planifie, actif, termine, absent, retard
  note         TEXT,
  data         JSONB
);
CREATE INDEX IF NOT EXISTS idx_shifts_employee   ON shifts(employee_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date_debut ON shifts(date_debut);
CREATE INDEX IF NOT EXISTS idx_shifts_status     ON shifts(status);

-- Table 3 : Journal d'activité par clé API
CREATE TABLE IF NOT EXISTS employee_logs (
  id             BIGSERIAL PRIMARY KEY,
  ts             TIMESTAMPTZ DEFAULT NOW(),
  employee_id    BIGINT REFERENCES employees(id) ON DELETE SET NULL,
  api_key        TEXT NOT NULL,
  action         TEXT NOT NULL,         -- ex: pointage_entree, pointage_sortie, action_caisse, etc.
  context        TEXT,                  -- description libre
  source         TEXT,                  -- logiciel source, terminal, IP
  anomaly_score  INT DEFAULT 0,         -- 0-10
  is_anomaly     BOOLEAN DEFAULT FALSE,
  anomaly_reason TEXT,                  -- description de l'anomalie détectée
  urgence        TEXT,                  -- ROUGE / ORANGE / VERTE / null
  data           JSONB
);
CREATE INDEX IF NOT EXISTS idx_elogs_employee  ON employee_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_elogs_ts        ON employee_logs(ts);
CREATE INDEX IF NOT EXISTS idx_elogs_anomaly   ON employee_logs(is_anomaly);
CREATE INDEX IF NOT EXISTS idx_elogs_api_key   ON employee_logs(api_key);

-- Table 4 : Étapes de processus de référence (process attendu par poste)
CREATE TABLE IF NOT EXISTS process_steps (
  id             BIGSERIAL PRIMARY KEY,
  poste          TEXT NOT NULL,         -- poste concerné
  action_name    TEXT NOT NULL,         -- nom de l'action attendue
  description    TEXT,
  heure_min      INT,                   -- heure min d'exécution (0-23)
  heure_max      INT,                   -- heure max d'exécution (0-23)
  jours          TEXT DEFAULT 'lun-ven', -- lun-ven / lun-sam / tous
  est_obligatoire BOOLEAN DEFAULT TRUE,
  ordre          INT DEFAULT 0,         -- séquence attendue dans la journée
  tolerance_min  INT DEFAULT 15         -- tolérance en minutes avant/après
);
CREATE INDEX IF NOT EXISTS idx_psteps_poste ON process_steps(poste);

-- Données de base : étapes processus exemple
INSERT INTO process_steps (poste, action_name, description, heure_min, heure_max, est_obligatoire, ordre, tolerance_min) VALUES
  ('vendeur',        'pointage_entree',    'Arrivée et pointage entrée',               8,  9,  true,  1, 30),
  ('vendeur',        'ouverture_caisse',   'Ouverture et vérification caisse',         8,  9,  true,  2, 30),
  ('vendeur',        'check_stock',        'Vérification stock matin',                 9,  10, false, 3, 60),
  ('vendeur',        'pause_dejeuner',     'Pause déjeuner',                          12,  14, false, 4, 30),
  ('vendeur',        'cloture_caisse',     'Clôture caisse fin de journée',           17,  19, true,  5, 30),
  ('vendeur',        'pointage_sortie',    'Pointage sortie',                         17,  19, true,  6, 30),
  ('responsable',    'pointage_entree',    'Arrivée et pointage entrée',               8,  9,  true,  1, 30),
  ('responsable',    'brief_equipe',       'Brief équipe du matin',                    9,  10, true,  2, 30),
  ('responsable',    'validation_planning','Validation planning journée',              9,  11, true,  3, 60),
  ('responsable',    'controle_caisses',   'Contrôle toutes les caisses',             17,  18, true,  4, 30),
  ('responsable',    'rapport_journalier', 'Rapport de fin de journée',               17,  19, true,  5, 30),
  ('responsable',    'pointage_sortie',    'Pointage sortie',                         18,  19, true,  6, 30),
  ('technicien',     'pointage_entree',    'Arrivée et pointage entrée',               7,  9,  true,  1, 30),
  ('technicien',     'check_materiel',     'Vérification matériel et outils',          8,  9,  true,  2, 30),
  ('technicien',     'rapport_intervention','Rapport d''intervention',                16,  18, true,  3, 60),
  ('technicien',     'pointage_sortie',    'Pointage sortie',                         16,  18, true,  4, 30),
  ('administratif',  'pointage_entree',    'Arrivée et pointage entrée',               8,  9,  true,  1, 30),
  ('administratif',  'traitement_courrier','Traitement courrier / emails entrants',    9,  10, true,  2, 60),
  ('administratif',  'pointage_sortie',    'Pointage sortie',                         17,  18, true,  3, 30),

  -- ══════════════════════════════════════════════════════════
  -- SECRÉTAIRE POLYVALENTE · Office Manager transversal
  -- Périmètre : tous les pôles · Autonome · Scalable
  -- ══════════════════════════════════════════════════════════

  -- QUOTIDIEN · Socle (obligatoire chaque jour)
  ('secretaire', 'pointage_entree',            'Arrivée et pointage entrée',                                   8,  9,  true,  1,  30),
  ('secretaire', 'ouverture_poste',            'Démarrage PC, messagerie, ERP, outils métier',                 8,  9,  true,  2,  20),
  ('secretaire', 'tri_courrier_emails',        'Tri + priorisation courrier physique et emails (urgent/normal)',8,  9,  true,  3,  30),
  ('secretaire', 'gestion_agenda',             'Mise à jour agenda direction + agenda équipes',                 9,  10, true,  4,  30),
  ('secretaire', 'coordination_planning_jour', 'Vérif absences, adaptation planning multi-équipes du jour',    9,  10, true,  5,  30),
  ('secretaire', 'relance_absences',           'Contact salariés absents sans justificatif (<1h après shift)',  9,  11, true,  6,  45),

  -- QUOTIDIEN · Communication & accueil
  ('secretaire', 'traitement_appels',          'Prise en charge, filtrage et transfert des appels entrants',   9,  18, false, 7,  60),
  ('secretaire', 'accueil_visiteurs',          'Accueil, identification, orientation des visiteurs',           9,  17, false, 8,  60),
  ('secretaire', 'redaction_courriers',        'Rédaction et mise en forme des courriers sortants',            9,  12, false, 9,  90),
  ('secretaire', 'diffusion_notes_internes',   'Transmission notes/circulaires internes à l''équipe',          9,  17, false, 10, 60),

  -- QUOTIDIEN · RH opérationnel
  ('secretaire', 'saisie_conges_absences',     'Saisie congés, absences, justificatifs dans le système RH',   10, 17, false, 11, 60),
  ('secretaire', 'suivi_absences_maladies',    'Suivi AT/maladie, transmission documents RH/médecine travail', 10, 17, false, 12, 60),
  ('secretaire', 'validation_shifts',          'Confirmation et ajustement des shifts du lendemain',          16, 18, true,  13, 30),

  -- QUOTIDIEN · Comptabilité légère
  ('secretaire', 'suivi_factures',             'Réception, vérification, classement factures fournisseurs',   10, 12, false, 14, 90),
  ('secretaire', 'relances_clients',           'Relances paiements clients en attente (>30 jours)',           14, 17, false, 15, 60),
  ('secretaire', 'notes_de_frais',             'Traitement et vérification notes de frais équipes',           14, 17, false, 16, 60),

  -- QUOTIDIEN · Logistique & support
  ('secretaire', 'gestion_fournitures',        'Suivi stocks fournitures bureau, déclenchement commandes',     9,  17, false, 17, 90),
  ('secretaire', 'suivi_prestataires',         'Coordination prestataires externes (maintenance, livraisons)',  9,  17, false, 18, 90),
  ('secretaire', 'gestion_acces_locaux',       'Gestion badges, clés, accès sécurisés des locaux',            8,  18, false, 19, 60),

  -- QUOTIDIEN · Clôture
  ('secretaire', 'suivi_dossiers',             'Suivi avancement dossiers en cours + relances internes',      14,  17, true,  20, 60),
  ('secretaire', 'preparation_reunions',       'Préparation ordre du jour, documents, salle réunion',         14,  17, false, 21, 60),
  ('secretaire', 'saisie_informatique',        'Saisie et mise à jour bases de données, ERP, tableaux bord',  14,  17, false, 22, 90),
  ('secretaire', 'archivage',                  'Archivage physique + numérique (GED) des documents du jour',  16,  18, true,  23, 30),
  ('secretaire', 'rapport_journalier',         'Compte-rendu journalier consolidé → direction',              17,  18, true,  24, 30),
  ('secretaire', 'pointage_sortie',            'Fermeture poste, sécurisation données, pointage sortie',     17,  18, true,  25, 30),

  -- HEBDOMADAIRE (lundi matin)
  ('secretaire', 'bilan_semaine_precedente',   'Synthèse KPIs semaine écoulée (présences, incidents, tâches)', 8,  10, true,  26, 30),
  ('secretaire', 'planification_semaine',      'Planning multi-équipes semaine : shifts, congés, tâches',      9,  11, true,  27, 45),
  ('secretaire', 'rapprochement_bancaire',     'Rapprochement relevé bancaire vs factures/paiements',          9,  12, false, 28, 60),
  ('secretaire', 'reunion_coordination',       'Réunion de coordination hebdo avec responsables pôles',        9,  11, false, 29, 30),

  -- HEBDOMADAIRE (vendredi)
  ('secretaire', 'rapport_hebdo_direction',    'Rapport hebdomadaire consolidé multi-services → direction',   15,  18, true,  30, 45),
  ('secretaire', 'consolidation_kpis',         'Consolidation KPIs : présences, anomalies, production, CA',   15,  17, true,  31, 45),
  ('secretaire', 'validation_planning_suivant','Validation planning semaine suivante + anticipation absences', 14,  17, true,  32, 45),

  -- MENSUEL (1er du mois)
  ('secretaire', 'rapport_mensuel',            'Rapport mensuel complet : RH, finances, opérations → DG',     8,  12, true,  33, 60),
  ('secretaire', 'transmission_comptable',     'Transmission pièces comptables à l''expert-comptable',         8,  12, true,  34, 60),
  ('secretaire', 'bilan_anomalies_mensuel',    'Synthèse anomalies détectées + actions correctives proposées', 9,  12, true,  35, 60),
  ('secretaire', 'onboarding_nouveau_salarie', 'Accueil nouveaux arrivants : badge, accès, formation process',  9,  17, false, 36, 90),
  ('secretaire', 'audit_process',              'Vérification conformité process par pôle + recommandations',   9,  17, false, 37, 90)
ON CONFLICT DO NOTHING;
