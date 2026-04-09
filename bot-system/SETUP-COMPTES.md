# SETUP COMPTES · Bot System v4.1

## ÉTAPE 1 · Créer le Gmail central (2 min)

Allez sur : https://accounts.google.com/signup

- Adresse : **jeremy.botsystem@gmail.com**
- Ce mail reçoit TOUTES les alertes de TOUTES les plateformes
- Activer le transfert auto plus tard (étape 5)

---

## ÉTAPE 2 · Créer les comptes plateformes (3 min chacun)

Tous avec le même email : jeremy.botsystem@gmail.com

### 2.1 · eBay France
- URL : https://signup.ebay.fr
- Pseudo : jeremy-deals-fr
- Après création : Mon eBay → Paramètres → Pays : France

### 2.2 · Vinted
- URL : https://www.vinted.fr/member/general/sign-up
- Pseudo : jeremy-deals
- Après création : Profil → Activer les notifications email

### 2.3 · LeBonCoin
- URL : https://www.leboncoin.fr/compte/creation
- Après création : Mon compte → Notifications → Alertes email : OUI

### 2.4 · Facebook (compte dédié Marketplace)
- URL : https://www.facebook.com/r.php
- Nom : Jeremy Deals
- Après création : Marketplace → Activer notifications

### 2.5 · Interenchères
- URL : https://www.interencheres.com/inscription
- Après création : Mon compte → Alertes

### 2.6 · Drouot
- URL : https://www.drouot.com/inscription
- Après création : Alertes → Mots-clés

---

## ÉTAPE 3 · Configurer les 32 alertes (10 min)

Sur CHAQUE plateforme, créer une alerte pour chaque mot-clé.
Fréquence : **immédiate** partout.

### Pokemon & Cartes
1. lot carte pokemon
2. booster pokemon scellé
3. display pokemon
4. coffret pokemon neuf
5. carte pokemon dracaufeu
6. carte pokemon holo

### LEGO
7. lego star wars neuf
8. lego technic neuf
9. lego creator expert
10. lego harry potter neuf

### Consoles & Gaming
11. nintendo switch oled
12. ps5 occasion
13. steam deck
14. game boy color
15. nintendo 64 lot
16. lot jeux nintendo

### Tech
17. airpods pro
18. iphone 14 occasion
19. iphone 15 occasion
20. macbook air m2
21. dyson v15

### Collectibles
22. funko pop chase
23. funko pop exclusive
24. figurine dragon ball
25. figurine one piece bandai

### Outils
26. makita lot perceuse
27. dewalt lot

### Photo vintage
28. olympus mju
29. contax t2
30. canon ae-1

### Consommables
31. telecommande samsung lot
32. cartouche hp 302 lot

---

## ÉTAPE 4 · Sauvegarder les sessions Playwright (5 min)

Depuis le terminal du projet :

```bash
cd ~/Desktop/maprimeadapt/bot-system
npm run setup
```

Se connecter sur chaque plateforme avec les nouveaux comptes.
Les sessions sont sauvées dans ./sessions/

---

## ÉTAPE 5 · Activer le transfert email (3 min)

Gmail jeremy.botsystem@gmail.com :
1. Paramètres → Transfert et POP/IMAP
2. Ajouter une adresse de transfert
3. Entrer : (votre URL Railway ou localhost pour test)
4. Confirmer le code reçu

Alternative simple : garder Gmail ouvert et copier-coller les alertes dans le bot via /api/funnel/alert

---

## RÉCAP

| Compte | Pseudo | Email | Usage |
|---|---|---|---|
| Gmail | — | jeremy.botsystem@gmail.com | Central alertes |
| eBay FR | jeremy-deals-fr | jeremy.botsystem@gmail.com | Vente + achat |
| Vinted | jeremy-deals | jeremy.botsystem@gmail.com | Vente + achat |
| LeBonCoin | — | jeremy.botsystem@gmail.com | Vente + achat |
| Facebook | Jeremy Deals | jeremy.botsystem@gmail.com | Marketplace |
| Interenchères | — | jeremy.botsystem@gmail.com | Enchères |
| Drouot | — | jeremy.botsystem@gmail.com | Enchères |

Temps total : ~25 minutes
Coût : 0€
