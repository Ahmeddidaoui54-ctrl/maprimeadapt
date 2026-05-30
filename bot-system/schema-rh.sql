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

  -- Secrétaire : 14 étapes couvrant la journée complète
  ('secretaire',     'pointage_entree',         'Arrivée et pointage entrée',                         8,  9,  true,  1,  30),
  ('secretaire',     'ouverture_poste',          'Démarrage PC, messagerie, logiciels métier',         8,  9,  true,  2,  20),
  ('secretaire',     'tri_courrier_emails',      'Tri et priorisation courrier physique + emails',     8,  9,  true,  3,  30),
  ('secretaire',     'gestion_agenda',           'Mise à jour agenda / planning RDV du jour',          9,  10, true,  4,  30),
  ('secretaire',     'traitement_appels',        'Prise en charge des appels entrants',                9,  12, false, 5,  60),
  ('secretaire',     'saisie_courriers',         'Rédaction et mise en forme des courriers sortants',  9,  12, false, 6,  90),
  ('secretaire',     'accueil_visiteurs',        'Accueil et orientation des visiteurs',               9,  17, false, 7,  60),
  ('secretaire',     'pause_dejeuner',           'Pause déjeuner',                                    12,  14, false, 8,  30),
  ('secretaire',     'suivi_dossiers',           'Suivi et relance des dossiers en cours',            14,  16, true,  9,  60),
  ('secretaire',     'saisie_informatique',      'Saisie et mise à jour bases de données / ERP',      14,  16, false, 10, 90),
  ('secretaire',     'preparation_reunions',     'Préparation documents et salles de réunion',        14,  17, false, 11, 60),
  ('secretaire',     'archivage',                'Archivage physique et numérique des documents',     16,  17, true,  12, 30),
  ('secretaire',     'rapport_journalier',       'Compte-rendu journalier et transmission direction', 17,  18, true,  13, 30),
  ('secretaire',     'pointage_sortie',          'Fermeture poste et pointage sortie',               17,  18, true,  14, 30)
ON CONFLICT DO NOTHING;
