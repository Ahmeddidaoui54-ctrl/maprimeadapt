# Business Plan - ChatBot Pro

## 1. Resume executif

ChatBot Pro propose des chatbots IA cle en main aux PME francaises, specialises par secteur (immobilier, restauration, dentaire). Le modele repose sur des frais de mise en place + abonnement mensuel. Infrastructure quasi gratuite (Typebot self-hosted), marge nette >80%.

Objectif : 30 clients recurrents a M12, soit 3 590 EUR/mois de revenus recurrents (MRR).

---

## 2. Analyse de marche

### Le contexte
- 81% des PME souhaitent integrer l'IA dans leur activite
- Seulement 32% l'ont fait : **gap de 49 points = opportunite massive**
- 4,2 millions de PME en France
- Les PME n'ont ni le temps ni les competences techniques pour deployer l'IA elles-memes

### Les secteurs cibles

| Secteur | Nb d'entreprises FR | Besoin principal | Douleur |
|---------|-------------------|-----------------|---------|
| Immobilier | 30 000 agences | Capter les leads hors horaires | 60% des recherches se font le soir |
| Restaurants | 175 000 | Reservations sans telephone | Appels manques pendant le service |
| Dentistes | 43 000 cabinets | Prise de RDV en ligne | Secretariat deborde |

### Taille du marche adressable
- Cible initiale : PME avec site web dans les 3 secteurs = ~50 000 entreprises
- Taux de conversion realiste : 0,06% = 30 clients en Y1
- Potentiel Y2-Y3 avec nouveaux secteurs : x5 a x10

---

## 3. Analyse concurrentielle

| Concurrent | Prix/mois | Forces | Faiblesses |
|-----------|----------|--------|-----------|
| Botnation | 9 EUR | Prix bas | Pas de personnalisation sectorielle, pas de service |
| Tidio | 29 EUR | Interface simple | Generique, en anglais |
| Crisp | 45 EUR | CRM integre | Complexe pour les PME, pas d'IA native |
| iAdvize | 550 EUR | Enterprise grade | Hors budget PME |
| Drift | 2 500 EUR | Leader USA | Pas adapte au marche francais |

### Notre positionnement
- **Milieu de gamme** : 49-199 EUR/mois
- **Specialise par secteur** : templates pre-configures, le client n'a rien a creer
- **Service inclus** : on fait tout, le client n'a aucune competence technique a avoir
- **Marche francais** : en francais, RGPD natif, support local

---

## 4. Offres et pricing

| | Starter | Business | Premium |
|-|---------|----------|---------|
| Setup | 149 EUR | 299 EUR | 499 EUR |
| Mensuel | 49 EUR | 99 EUR | 199 EUR |
| Chatbot FAQ | Oui | Oui | Oui |
| Prise de RDV | - | Oui | Oui |
| IA conversationnelle | - | Oui | Oui |
| Integration CRM | - | - | Oui |
| Support | Email | Prioritaire | Dedie |

**Panier moyen estime** : 99 EUR/mois (offre Business la plus populaire)

---

## 5. Structure de couts

### Couts fixes mensuels
| Poste | Cout |
|-------|------|
| VPS (Hetzner/OVH) | 5 EUR |
| Domaine + email pro | 5 EUR |
| Outils (Lemlist free, LinkedIn) | 0 EUR |
| **Total fixe** | **10 EUR/mois** |

### Couts variables par client
| Poste | Cout |
|-------|------|
| API OpenAI (si IA) | 2-5 EUR/mois |
| Temps de config (1ere fois) | ~2h |
| Support mensuel | ~15 min |

### Marge
- Offre Business a 99 EUR/mois : cout variable ~5 EUR = **marge 95%**
- Seul vrai cout : le temps de prospection et configuration

---

## 6. Projections financieres (conservateur)

### Hypotheses
- 2-3 nouveaux clients/mois a partir de M3
- Churn : 10%/mois (1 client sur 10 quitte chaque mois)
- Mix : 30% Starter, 50% Business, 20% Premium
- Panier moyen : setup 265 EUR + 99 EUR/mois

### Projection mois par mois

| Mois | Nouveaux | Total actifs | MRR | Setup | Revenu total |
|------|----------|-------------|-----|-------|-------------|
| M1 | 1 | 1 | 99 | 299 | 398 |
| M2 | 1 | 2 | 198 | 299 | 497 |
| M3 | 2 | 4 | 396 | 530 | 926 |
| M4 | 2 | 6 | 594 | 530 | 1 124 |
| M5 | 3 | 8 | 792 | 795 | 1 587 |
| M6 | 3 | 11 | 1 089 | 795 | 1 884 |
| M7 | 3 | 13 | 1 287 | 795 | 2 082 |
| M8 | 3 | 15 | 1 485 | 795 | 2 280 |
| M9 | 3 | 17 | 1 683 | 795 | 2 478 |
| M10 | 3 | 19 | 1 881 | 795 | 2 676 |
| M11 | 4 | 22 | 2 178 | 1 060 | 3 238 |
| M12 | 4 | 25 | 2 475 | 1 060 | 3 535 |

**Total annee 1 : ~21 700 EUR** (conservateur)
**MRR a M12 : 2 475 EUR**

### Seuil de rentabilite
- Couts fixes : ~10 EUR/mois
- Break-even : atteint des le premier client (marge >90%)

---

## 7. Strategie marketing et acquisition

### Canal 1 : Prospection Google Maps (gratuit)
1. Rechercher "[secteur] + [ville]" sur Google Maps
2. Visiter le site du prospect, verifier qu'il n'a pas de chatbot
3. Envoyer un email personnalise avec lien demo
4. Objectif : 20 emails/jour = 100/semaine

### Canal 2 : LinkedIn (gratuit)
1. Rechercher les gerants/directeurs dans les secteurs cibles
2. Demande de connexion + message de suivi
3. Objectif : 20 connexions/jour

### Canal 3 : Telephone (gratuit)
1. Appeler les prospects qui ont ouvert l'email mais pas repondu
2. Utiliser le script telephonique prepare
3. Objectif : 10 appels/jour

### Canal 4 : Partenariats (M6+)
- Agences web locales (apporteur d'affaires 15% commission)
- Consultants digitalisation PME
- Chambres de commerce (CCI)

### Canal 5 : SEO / contenu (M3+)
- Blog : articles sur les chatbots par secteur
- Etudes de cas clients
- Videos demo YouTube

---

## 8. Timeline et jalons

### Mois 1 : Lancement
- [x] Infrastructure Typebot deployee
- [x] Templates sectoriels crees
- [x] Site vitrine en ligne
- [x] Emails de prospection prets
- [ ] Importer les templates dans Typebot
- [ ] Configurer le SMTP pour les notifications
- [ ] Envoyer les 100 premiers emails
- [ ] Signer le premier client

### Mois 2-3 : Traction
- Affiner le pitch selon les retours
- Creer des etudes de cas (meme avec chiffres estimes)
- Atteindre 5 clients actifs
- Lancer la prospection LinkedIn

### Mois 4-6 : Systematisation
- Automatiser la prospection (Lemlist ou equivalent)
- Creer 2 nouveaux templates sectoriels (avocats, coaches)
- Atteindre 10 clients actifs
- Premier partenariat agence web

### Mois 7-12 : Croissance
- Recruter un freelance pour la prospection
- Lancer le SEO / blog
- Atteindre 25 clients actifs
- MRR > 2 000 EUR

---

## 9. Risques et mitigations

| Risque | Probabilite | Mitigation |
|--------|------------|-----------|
| Churn eleve | Moyenne | Onboarding soigne, check-in mensuel |
| Prospects ne repondent pas | Elevee | Volume + multi-canal (email + tel + LinkedIn) |
| Typebot down | Faible | Self-hosted, backups automatiques |
| Concurrence agressive | Moyenne | Specialisation sectorielle = differentiation |
| OpenAI augmente ses prix | Faible | Cout marginal, repercutable sur le client |

---

## 10. Vision a 3 ans

- **Y1** : 25 clients, 3 secteurs, 1 personne (moi)
- **Y2** : 80 clients, 6 secteurs, 1 commercial freelance, MRR 8 000 EUR
- **Y3** : 200 clients, marque blanche pour agences web, MRR 20 000 EUR, potentiel SAS
