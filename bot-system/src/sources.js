const axios = require('axios');
const crypto = require('crypto');

// ============================================================
// BASE DE DONNÉES NICHES COMPLÈTE · 20 CATÉGORIES · 80+ SOUS-NICHES
// Verrouillée — couvre TOUS les marchés rentables identifiés
// ============================================================

const NICHES = {

  // ── CATÉGORIE 1 : ÉLECTRONIQUE & TECH ──────────────────────
  smartphones: {
    cat: 'tech', name: 'Smartphones & Tablettes',
    keywords: ['iPhone occasion', 'Samsung Galaxy reconditionne', 'iPad pro occasion', 'telephone debloque', 'smartphone lot', 'iPhone ecran casse'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: [9], // Spike lancement Apple
    priceMax: 50
  },
  laptops: {
    cat: 'tech', name: 'Laptops & PC',
    keywords: ['MacBook Pro occasion', 'laptop reconditionne', 'PC portable gamer', 'MacBook M1 M2', 'ThinkPad occasion', 'iMac occasion'],
    margin: 'medium', speed: 'fast', demand: 'high',
    season: [8, 9],
    priceMax: 50
  },
  vintage_cameras: {
    cat: 'tech', name: 'Appareils photo vintage',
    keywords: ['appareil photo argentique', 'Canon AE-1', 'Nikon FM2', 'Olympus mju', 'Contax T2', 'appareil photo compact film', 'appareil photo annees 2000'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: null,
    priceMax: 50
  },
  gaming: {
    cat: 'tech', name: 'Consoles & Jeux vidéo',
    keywords: ['PS5 occasion', 'Nintendo Switch', 'Xbox Series', 'console retro', 'Game Boy', 'Nintendo 64', 'jeux video retro', 'manette collector', 'Steam Deck'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: [11, 12],
    priceMax: 50
  },
  boring_tech: {
    cat: 'tech', name: 'Tech "ennuyeuse" (marge cachée)',
    keywords: ['telecommande universelle', 'routeur wifi', 'calculatrice graphique TI', 'calculatrice Casio', 'disque dur externe', 'lecteur CD portable', 'scanner occasion'],
    margin: 'high', speed: 'medium', demand: 'medium',
    season: [8, 9], // Calculatrices rentrée
    priceMax: 30
  },
  phone_accessories: {
    cat: 'tech', name: 'Accessoires téléphone (bulk)',
    keywords: ['coque iPhone lot', 'chargeur rapide lot', 'cable USB-C lot', 'ecouteurs sans fil', 'powerbank', 'protection ecran lot', 'AirPods occasion'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: null,
    priceMax: 20
  },
  smart_home: {
    cat: 'tech', name: 'Domotique & Smart Home',
    keywords: ['Alexa Echo occasion', 'Google Nest', 'camera surveillance wifi', 'thermostat connecte', 'ampoule connectee lot', 'prise connectee'],
    margin: 'medium', speed: 'medium', demand: 'medium',
    season: [11, 12],
    priceMax: 40
  },

  // ── CATÉGORIE 2 : MODE & VÊTEMENTS ─────────────────────────
  streetwear: {
    cat: 'fashion', name: 'Streetwear & Hype',
    keywords: ['Supreme', 'Off-White', 'Palace', 'Stussy', 'BAPE', 'Nike collab', 'hoodie oversize', 'lot vetements streetwear'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: null,
    priceMax: 50
  },
  vintage_clothing: {
    cat: 'fashion', name: 'Vêtements vintage 70s-2000s',
    keywords: ['vetement vintage 90s', 'Tommy Hilfiger vintage', 'Champion vintage', 'Starter jacket', 'veste cuir vintage', 'jean Levis 501 vintage', 'survetement retro', 'Fubu'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: null,
    priceMax: 30
  },
  women_premium: {
    cat: 'fashion', name: 'Femme premium (Sézane, Maje...)',
    keywords: ['Sezane occasion', 'Maje occasion', 'Sandro', 'Isabel Marant', 'Zadig Voltaire', 'ba&sh occasion', 'Reformation'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: null,
    priceMax: 50
  },
  athleisure: {
    cat: 'fashion', name: 'Athleisure & Sport',
    keywords: ['Lululemon occasion', 'Nike Dri-Fit', 'Alo Yoga', 'Gymshark', 'legging sport femme', 'brassiere sport marque'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: [1, 4, 5],
    priceMax: 40
  },
  denim: {
    cat: 'fashion', name: 'Denim (Levi\'s, Wrangler...)',
    keywords: ['Levis 501 vintage', 'Levis 517 bootcut', 'Wrangler vintage', 'Lee vintage', 'jean selvedge', 'jean brut', 'lot jeans'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: null,
    priceMax: 25
  },
  kids_clothing: {
    cat: 'fashion', name: 'Vêtements enfant & bébé',
    keywords: ['vetement bebe lot', 'Petit Bateau occasion', 'Jacadi occasion', 'manteau enfant marque', 'chaussures bebe', 'lot vetements enfant'],
    margin: 'medium', speed: 'fast', demand: 'high',
    season: null,
    priceMax: 20
  },
  workwear: {
    cat: 'fashion', name: 'Workwear vintage (niche cachée)',
    keywords: ['Carhartt occasion', 'Dickies vintage', 'bleu de travail vintage', 'veste travail', 'coverall vintage'],
    margin: 'high', speed: 'medium', demand: 'medium',
    season: null,
    priceMax: 25
  },

  // ── CATÉGORIE 3 : SNEAKERS & CHAUSSURES ─────────────────────
  sneakers_limited: {
    cat: 'sneakers', name: 'Sneakers édition limitée',
    keywords: ['Nike Dunk limited', 'Jordan 1 retro', 'Yeezy Boost', 'New Balance 550', 'Adidas Samba', 'Nike Air Max 1', 'collab sneakers'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: null,
    priceMax: 50
  },
  sneakers_classic: {
    cat: 'sneakers', name: 'Sneakers classiques',
    keywords: ['Nike Air Force 1', 'Converse Chuck Taylor', 'Adidas Stan Smith', 'Vans Old Skool', 'New Balance 990', 'ASICS Gel'],
    margin: 'medium', speed: 'fast', demand: 'high',
    season: null,
    priceMax: 40
  },
  luxury_shoes: {
    cat: 'sneakers', name: 'Chaussures luxe & Dr Martens',
    keywords: ['Louboutin occasion', 'Gucci loafers', 'Golden Goose occasion', 'Dr Martens vintage', 'bottines cuir vintage'],
    margin: 'high', speed: 'medium', demand: 'medium',
    season: null,
    priceMax: 50
  },

  // ── CATÉGORIE 4 : LUXE & ACCESSOIRES ────────────────────────
  luxury_bags: {
    cat: 'luxury', name: 'Sacs à main luxe',
    keywords: ['sac Louis Vuitton occasion', 'sac Chanel vintage', 'Hermes Birkin', 'Celine sac', 'Dior saddle bag', 'Bottega Veneta'],
    margin: 'high', speed: 'medium', demand: 'high',
    season: null,
    priceMax: 50
  },
  watches: {
    cat: 'luxury', name: 'Montres (Seiko, Casio, Omega...)',
    keywords: ['montre Seiko vintage', 'Casio G-Shock', 'Omega occasion', 'Swatch collector', 'Tudor occasion', 'Tag Heuer occasion', 'montre automatique'],
    margin: 'high', speed: 'medium', demand: 'high',
    season: [2, 6, 12],
    priceMax: 50
  },
  jewelry: {
    cat: 'luxury', name: 'Bijoux vintage & fantaisie',
    keywords: ['bijoux vintage lot', 'bijoux fantaisie lot', 'bague argent', 'collier perle', 'bracelet plaque or', 'bijoux createur'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: [2, 5, 12],
    priceMax: 20
  },
  sunglasses: {
    cat: 'luxury', name: 'Lunettes de soleil',
    keywords: ['Ray-Ban occasion', 'lunettes soleil vintage', 'Oakley occasion', 'Persol vintage', 'lunettes soleil marque'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: [4, 5, 6, 7, 8],
    priceMax: 30
  },
  perfumes: {
    cat: 'luxury', name: 'Parfums & cosmétiques (neufs)',
    keywords: ['parfum neuf sous blister', 'lot cosmetiques neuf', 'maquillage neuf', 'parfum miniature collection', 'coffret parfum', 'palette maquillage neuve'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: [2, 5, 12],
    priceMax: 30
  },

  // ── CATÉGORIE 5 : MAISON & MOBILIER ─────────────────────────
  vintage_furniture: {
    cat: 'home', name: 'Mobilier vintage & scandinave',
    keywords: ['meuble vintage', 'chaise scandinave', 'table basse vintage', 'lampe design vintage', 'fauteuil retro', 'meuble teck', 'buffet annees 60'],
    margin: 'high', speed: 'medium', demand: 'high',
    season: [3, 4, 5],
    priceMax: 50
  },
  office_chairs: {
    cat: 'home', name: 'Fauteuils bureau ergonomiques',
    keywords: ['Herman Miller Aeron occasion', 'Steelcase Leap', 'fauteuil bureau ergonomique', 'Humanscale occasion'],
    margin: 'high', speed: 'medium', demand: 'high',
    season: null,
    priceMax: 50
  },
  home_decor: {
    cat: 'home', name: 'Déco maison (bulk sourcing)',
    keywords: ['coussin decoratif lot', 'bougie parfumee lot', 'vase vintage', 'miroir decoratif', 'objet deco tendance'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: null,
    priceMax: 15
  },
  vintage_kitchen: {
    cat: 'home', name: 'Cuisine vintage (Pyrex, Le Creuset)',
    keywords: ['Pyrex vintage', 'Le Creuset occasion', 'Staub cocotte', 'ustensile cuisine retro', 'vaisselle vintage', 'Tupperware collector'],
    margin: 'high', speed: 'medium', demand: 'high',
    season: null,
    priceMax: 30
  },

  // ── CATÉGORIE 6 : JOUETS & COLLECTIBLES ─────────────────────
  lego: {
    cat: 'collectibles', name: 'LEGO (sets retirés)',
    keywords: ['LEGO Star Wars retire', 'LEGO Technic', 'LEGO Creator Expert', 'LEGO modulaire', 'LEGO neuf scelle', 'LEGO minifigure rare', 'LEGO Harry Potter'],
    margin: 'high', speed: 'medium', demand: 'high',
    season: [11, 12],
    priceMax: 50
  },
  trading_cards: {
    cat: 'collectibles', name: 'Cartes (Pokemon, Yu-Gi-Oh, Magic)',
    keywords: ['carte Pokemon rare', 'booster Pokemon scelle', 'carte Yu-Gi-Oh', 'Magic the Gathering', 'display Pokemon', 'carte holo'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: null,
    priceMax: 30
  },
  funko_figurines: {
    cat: 'collectibles', name: 'Funko Pop & figurines',
    keywords: ['Funko Pop rare', 'Funko Pop exclusive', 'figurine collector', 'figurine anime', 'Dragon Ball figurine', 'Funko Pop chase'],
    margin: 'high', speed: 'medium', demand: 'high',
    season: null,
    priceMax: 20
  },
  vintage_toys: {
    cat: 'collectibles', name: 'Jouets vintage (80s-90s)',
    keywords: ['jouet vintage', 'figurine Star Wars vintage', 'Playmobil lot', 'jouet annees 80 90', 'Transformers vintage', 'Hot Wheels rare'],
    margin: 'high', speed: 'medium', demand: 'medium',
    season: null,
    priceMax: 30
  },
  board_games: {
    cat: 'collectibles', name: 'Jeux de société (scellés/rares)',
    keywords: ['jeu de societe scelle', 'jeu de societe rare', 'jeu de societe vintage', 'jeu de plateau epuise'],
    margin: 'medium', speed: 'medium', demand: 'medium',
    season: [11, 12],
    priceMax: 25
  },
  montessori: {
    cat: 'collectibles', name: 'Jouets Montessori & éducatifs',
    keywords: ['jouet Montessori', 'jouet educatif bois', 'jouet eveil bebe', 'materiel Montessori'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: null,
    priceMax: 15
  },

  // ── CATÉGORIE 7 : SPORT & OUTDOOR ──────────────────────────
  fitness: {
    cat: 'sport', name: 'Équipement fitness',
    keywords: ['velo appartement occasion', 'tapis course occasion', 'halteres', 'banc musculation', 'rameur occasion', 'kettlebell'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: [1, 4, 5],
    priceMax: 50
  },
  cycling: {
    cat: 'sport', name: 'Vélo & pièces',
    keywords: ['velo route occasion', 'VTT occasion', 'velo electrique', 'cadre velo carbone', 'Shimano', 'velo vintage Peugeot'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: [3, 4, 5, 6],
    priceMax: 50
  },
  golf: {
    cat: 'sport', name: 'Golf',
    keywords: ['club golf occasion', 'driver Titleist', 'Callaway occasion', 'sac golf', 'putter Scotty Cameron'],
    margin: 'high', speed: 'medium', demand: 'medium',
    season: [3, 4, 5, 6],
    priceMax: 50
  },
  outdoor_gear: {
    cat: 'sport', name: 'Outdoor & montagne',
    keywords: ['Patagonia occasion', 'Arc teryx occasion', 'North Face vintage', 'sac a dos randonnee', 'veste Gore-Tex', 'Fjallraven'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: [3, 4, 9, 10],
    priceMax: 50
  },
  ski: {
    cat: 'sport', name: 'Ski & sports d\'hiver',
    keywords: ['ski occasion', 'chaussure ski', 'casque ski', 'snowboard occasion', 'veste ski marque', 'masque ski'],
    margin: 'medium', speed: 'fast', demand: 'medium',
    season: [10, 11, 12, 1, 2],
    priceMax: 50
  },
  water_sports: {
    cat: 'sport', name: 'Sports nautiques',
    keywords: ['planche surf occasion', 'paddle gonflable', 'combinaison neoprene', 'kayak occasion', 'equipement plongee'],
    margin: 'high', speed: 'medium', demand: 'medium',
    season: [4, 5, 6, 7, 8],
    priceMax: 50
  },
  camping: {
    cat: 'sport', name: 'Camping & survie',
    keywords: ['tente occasion', 'sac couchage', 'rechaud camping', 'lampe frontale', 'hamac camping', 'couteau survie'],
    margin: 'high', speed: 'fast', demand: 'medium',
    season: [4, 5, 6, 7],
    priceMax: 40
  },

  // ── CATÉGORIE 8 : OUTILS & BRICOLAGE ───────────────────────
  power_tools: {
    cat: 'tools', name: 'Outillage électrique (Makita, DeWalt...)',
    keywords: ['Makita occasion', 'DeWalt occasion', 'Bosch Professional', 'Milwaukee', 'perceuse visseuse', 'scie circulaire', 'meuleuse', 'lot outils'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: [3, 4, 5],
    priceMax: 50
  },
  vintage_tools: {
    cat: 'tools', name: 'Outils anciens (collection)',
    keywords: ['rabot ancien', 'outil ancien', 'Stanley vintage', 'etabli ancien', 'outil menuisier', 'cle a molette ancienne'],
    margin: 'high', speed: 'medium', demand: 'medium',
    season: null,
    priceMax: 20
  },
  garden_tools: {
    cat: 'tools', name: 'Jardinage',
    keywords: ['tondeuse occasion', 'taille haie', 'tronconneuse Stihl', 'debroussailleuse', 'robot tondeuse occasion', 'outils jardin lot'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: [3, 4, 5, 6],
    priceMax: 50
  },

  // ── CATÉGORIE 9 : INSTRUMENTS DE MUSIQUE ───────────────────
  guitars: {
    cat: 'music', name: 'Guitares',
    keywords: ['guitare Fender occasion', 'Gibson Les Paul', 'guitare electrique vintage', 'guitare acoustique', 'Stratocaster', 'guitare classique'],
    margin: 'high', speed: 'medium', demand: 'high',
    season: [9, 12],
    priceMax: 50
  },
  synths: {
    cat: 'music', name: 'Synthés & claviers',
    keywords: ['synthetiseur vintage', 'clavier MIDI', 'piano numerique occasion', 'Roland Juno', 'Korg occasion', 'Yamaha DX7'],
    margin: 'high', speed: 'medium', demand: 'medium',
    season: null,
    priceMax: 50
  },
  audio_dj: {
    cat: 'music', name: 'Audio / DJ / Studio',
    keywords: ['platine vinyle Technics', 'table mixage', 'enceinte monitor', 'micro studio', 'interface audio', 'casque audio professionnel'],
    margin: 'high', speed: 'medium', demand: 'medium',
    season: null,
    priceMax: 50
  },

  // ── CATÉGORIE 10 : LIVRES & MEDIA ──────────────────────────
  rare_books: {
    cat: 'books', name: 'Livres rares & 1ère édition',
    keywords: ['livre rare', 'edition originale', 'livre ancien', 'premier tirage', 'livre collector', 'livre signe'],
    margin: 'high', speed: 'slow', demand: 'medium',
    season: null,
    priceMax: 20
  },
  textbooks: {
    cat: 'books', name: 'Manuels scolaires & pro',
    keywords: ['manuel scolaire', 'livre medecine', 'livre droit', 'livre informatique', 'annales concours', 'livre prepa'],
    margin: 'medium', speed: 'fast', demand: 'high',
    season: [8, 9, 10],
    priceMax: 20
  },
  manga_bd: {
    cat: 'books', name: 'Manga & BD',
    keywords: ['manga lot', 'manga complet', 'One Piece lot', 'BD Tintin', 'manga rare', 'BD collector', 'Asterix edition ancienne'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: null,
    priceMax: 20
  },
  vinyl_records: {
    cat: 'books', name: 'Vinyles & disques',
    keywords: ['vinyle rare', 'disque vinyl 33 tours', 'vinyle jazz', 'vinyle rock', 'vinyle pressage original', 'vinyle lot', 'disque collector'],
    margin: 'high', speed: 'medium', demand: 'medium',
    season: [4], // Record Store Day
    priceMax: 20
  },

  // ── CATÉGORIE 11 : AUTO & MOTO ─────────────────────────────
  auto_parts: {
    cat: 'auto', name: 'Pièces auto',
    keywords: ['piece auto occasion', 'phare voiture', 'alternateur occasion', 'demarreur occasion', 'jante alu occasion', 'turbo occasion'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: null,
    priceMax: 50
  },
  car_accessories: {
    cat: 'auto', name: 'Accessoires auto (bulk)',
    keywords: ['autoradio occasion', 'GPS voiture', 'camera recul', 'housse siege auto', 'tapis voiture lot', 'accessoire voiture lot'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: null,
    priceMax: 20
  },
  moto_parts: {
    cat: 'auto', name: 'Pièces & équipement moto',
    keywords: ['piece moto occasion', 'casque moto', 'echappement moto', 'equipement motard', 'selle moto'],
    margin: 'high', speed: 'medium', demand: 'medium',
    season: [3, 4, 5, 6],
    priceMax: 50
  },

  // ── CATÉGORIE 12 : PIÈCES DÉTACHÉES (MINE D'OR CACHÉE) ────
  printer_ink: {
    cat: 'parts', name: 'Cartouches d\'encre (neuves)',
    keywords: ['cartouche encre HP neuve', 'cartouche Epson', 'toner laser neuf', 'cartouche Brother', 'lot cartouches'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: null,
    priceMax: 15
  },
  appliance_parts: {
    cat: 'parts', name: 'Pièces électroménager',
    keywords: ['plateau micro-ondes verre', 'sac aspirateur lot', 'filtre aspirateur', 'brosse aspirateur robot', 'joint cocotte minute', 'lame robot cuisine'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: null,
    priceMax: 10
  },
  remotes: {
    cat: 'parts', name: 'Télécommandes (marge 300-1000%)',
    keywords: ['telecommande TV Samsung', 'telecommande universelle', 'telecommande portail', 'telecommande climatiseur'],
    margin: 'high', speed: 'fast', demand: 'medium',
    season: null,
    priceMax: 10
  },
  cables_adapters: {
    cat: 'parts', name: 'Câbles & adaptateurs (bulk)',
    keywords: ['cable HDMI lot', 'adaptateur USB-C lot', 'chargeur laptop universel', 'cable alimentation', 'lot cables informatique'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: null,
    priceMax: 10
  },

  // ── CATÉGORIE 13 : BÉBÉ & SANTÉ ───────────────────────────
  baby_gear: {
    cat: 'baby', name: 'Puériculture haut de gamme',
    keywords: ['poussette Yoyo Babyzen', 'UppaBaby occasion', 'Bugaboo', 'siege auto Cybex', 'transat BabyBjorn', 'porte bebe ergonomique'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: null,
    priceMax: 50
  },
  medical: {
    cat: 'baby', name: 'Matériel médical & mobilité',
    keywords: ['fauteuil roulant occasion', 'deambulateur', 'tensiometre', 'oxymetre', 'appareil massage', 'coussin orthopedique'],
    margin: 'high', speed: 'medium', demand: 'medium',
    season: null,
    priceMax: 30
  },

  // ── CATÉGORIE 14 : ÉLECTROMÉNAGER ──────────────────────────
  kitchen_appliances: {
    cat: 'appliances', name: 'Petit électroménager cuisine',
    keywords: ['Thermomix occasion', 'robot patissier KitchenAid', 'machine Nespresso', 'air fryer', 'blender Vitamix', 'SodaStream'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: [11, 12],
    priceMax: 50
  },
  vacuum: {
    cat: 'appliances', name: 'Aspirateurs premium',
    keywords: ['Dyson aspirateur occasion', 'iRobot Roomba', 'aspirateur robot', 'Dyson V15', 'aspirateur balai sans fil'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: null,
    priceMax: 50
  },

  // ── CATÉGORIE 15 : LOISIRS CRÉATIFS ────────────────────────
  sewing: {
    cat: 'craft', name: 'Machines à coudre & mercerie',
    keywords: ['machine a coudre Singer vintage', 'machine a coudre occasion', 'surjeteuse', 'lot tissu', 'patron couture vintage'],
    margin: 'high', speed: 'medium', demand: 'medium',
    season: null,
    priceMax: 30
  },
  art_supplies: {
    cat: 'craft', name: 'Fournitures art & dessin',
    keywords: ['Copic markers', 'tablette graphique Wacom', 'chevalet peinture', 'peinture acrylique lot', 'lot pinceaux'],
    margin: 'high', speed: 'medium', demand: 'medium',
    season: [8, 9],
    priceMax: 30
  },

  // ── CATÉGORIE 16 : ANIMAUX ─────────────────────────────────
  pet_accessories: {
    cat: 'pets', name: 'Accessoires animaux (bulk)',
    keywords: ['arbre a chat', 'panier chien', 'collier chien cuir', 'harnais chien', 'lot jouet chien', 'gamelle design'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: null,
    priceMax: 20
  },
  aquarium: {
    cat: 'pets', name: 'Aquariophilie & terrarium',
    keywords: ['aquarium complet', 'filtre aquarium', 'eclairage LED aquarium', 'terrarium', 'pompe aquarium'],
    margin: 'high', speed: 'medium', demand: 'medium',
    season: null,
    priceMax: 30
  },

  // ── CATÉGORIE 17 : SAISONNIER & ÉVÉNEMENTS ─────────────────
  holiday_decor: {
    cat: 'seasonal', name: 'Déco fêtes (acheter hors saison)',
    keywords: ['decoration Noel', 'guirlande lumineuse', 'sapin artificiel', 'decoration Halloween', 'decoration Paques'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: [1, 10, 11, 12], // Acheter en jan, vendre oct-déc
    priceMax: 20
  },
  costumes: {
    cat: 'seasonal', name: 'Déguisements & cosplay',
    keywords: ['deguisement Halloween', 'costume cosplay', 'perruque deguisement', 'deguisement enfant'],
    margin: 'high', speed: 'fast', demand: 'high',
    season: [2, 10],
    priceMax: 20
  },
  wedding: {
    cat: 'seasonal', name: 'Articles mariage',
    keywords: ['decoration mariage lot', 'robe mariee occasion', 'accessoire mariage', 'centre de table mariage'],
    margin: 'high', speed: 'medium', demand: 'high',
    season: [1, 2, 3, 4, 5, 6],
    priceMax: 30
  },

  // ── CATÉGORIE 18 : COLLECTIBLES NICHE ──────────────────────
  coins_stamps: {
    cat: 'niche', name: 'Monnaies & timbres',
    keywords: ['piece monnaie ancienne', 'billet collection', 'timbre rare', 'piece euro rare', 'piece 2 euros commemorative'],
    margin: 'high', speed: 'slow', demand: 'medium',
    season: null,
    priceMax: 10
  },
  antiques: {
    cat: 'niche', name: 'Brocante & antiquités',
    keywords: ['objet ancien', 'brocante lot', 'porcelaine ancienne', 'argenterie', 'pendule ancienne', 'objet art deco'],
    margin: 'high', speed: 'slow', demand: 'medium',
    season: [4, 5, 6], // Saison brocantes France
    priceMax: 30
  },
  advertising_memorabilia: {
    cat: 'niche', name: 'Plaques émaillées & pub vintage',
    keywords: ['plaque emaillee ancienne', 'affiche publicitaire vintage', 'objet publicitaire', 'enseigne lumineuse', 'plaque metal deco'],
    margin: 'high', speed: 'medium', demand: 'medium',
    season: null,
    priceMax: 20
  },
  sports_memorabilia: {
    cat: 'niche', name: 'Memorabilia sport',
    keywords: ['maillot foot vintage', 'maillot signe', 'carte sport collection', 'ballon signe', 'programme match ancien'],
    margin: 'high', speed: 'medium', demand: 'medium',
    season: [6, 7], // Coupe du Monde, Euro, JO
    priceMax: 30
  },

  // ── CATÉGORIE 19 : BUREAU & INFORMATIQUE ───────────────────
  office_equipment: {
    cat: 'office', name: 'Équipement bureau',
    keywords: ['imprimante laser occasion', 'scanner professionnel', 'plastifieuse', 'massicot', 'etiqueteuse Dymo'],
    margin: 'high', speed: 'medium', demand: 'medium',
    season: [1, 9],
    priceMax: 30
  },
  software: {
    cat: 'office', name: 'Licences logicielles (boîte)',
    keywords: ['Windows licence boite', 'Office licence neuve', 'logiciel boite', 'antivirus neuf'],
    margin: 'medium', speed: 'fast', demand: 'medium',
    season: null,
    priceMax: 30
  },

  // ── CATÉGORIE 20 : TISSUS & MATÉRIAUX ──────────────────────
  fabrics: {
    cat: 'materials', name: 'Tissus & mercerie en lot',
    keywords: ['tissu lot', 'tissu vintage', 'lot mercerie', 'bouton ancien lot', 'dentelle ancienne', 'patron vintage'],
    margin: 'high', speed: 'medium', demand: 'medium',
    season: null,
    priceMax: 15
  }
};

// ============================================================
// SÉLECTION INTELLIGENTE DES NICHES · DOUBLE STRATÉGIE
// ============================================================
//
// RÈGLE ABSOLUE : ON N'ACHÈTE JAMAIS SANS ACHETEUR IDENTIFIÉ
//
// Pas de stock spéculatif. Pas de "acheter bradé pour revendre dans 6 mois".
// Chaque opération = un acheteur existe DÉJÀ ou une demande PROUVÉE existe.
//
// STRATÉGIE UNIQUE : ARBITRAGE RAPIDE
//   1. Trouver un produit à prix bas sur plateforme A
//   2. VÉRIFIER qu'il se vend activement à prix plus haut sur plateforme B
//   3. Seulement si la paire achat/vente est confirmée → recommander
//
// Preuves d'acheteur acceptées :
//   - "Vendu récemment" à prix X sur eBay/Vinted (ventes complétées)
//   - Demande active (watchlists, recherches, "je recherche")
//   - Prix moyen de vente observé > prix d'achat + frais
//   - Produit en rupture ailleurs = demande non satisfaite

// Calcule les mois "opposés" d'une saison (quand les gens bradent)
function getOffSeasonMonths(seasonMonths) {
  if (!seasonMonths) return [];
  const allMonths = [1,2,3,4,5,6,7,8,9,10,11,12];
  return allMonths.filter(m => !seasonMonths.includes(m));
}

// Calcule dans combien de mois la prochaine saison haute commence
function monthsUntilSeason(seasonMonths, currentMonth) {
  if (!seasonMonths || !seasonMonths.length) return 99;
  let minDist = 12;
  for (const s of seasonMonths) {
    const dist = s >= currentMonth ? s - currentMonth : 12 - currentMonth + s;
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

// Retourne les niches où l'ARBITRAGE RAPIDE est possible maintenant
// Critères : demande active + revente rapide + marge prouvable
function getNichesToScan(maxNiches = 15) {
  const month = new Date().getMonth() + 1;
  const scored = Object.entries(NICHES).map(([id, n]) => {
    let score = 0;

    // CRITÈRE 1 : Vitesse de revente (le plus important = acheteur existe)
    // Fast = acheteurs actifs, ça part en heures/jours
    score += n.speed === 'fast' ? 4 : n.speed === 'medium' ? 2 : 0;

    // CRITÈRE 2 : Demande (prouve que des acheteurs cherchent)
    score += n.demand === 'high' ? 3 : n.demand === 'medium' ? 1.5 : 0;

    // CRITÈRE 3 : Marge (écart achat/revente observé)
    score += n.margin === 'high' ? 2 : n.margin === 'medium' ? 1 : 0;

    // CRITÈRE 4 : En saison = acheteurs MAINTENANT (pas dans 6 mois)
    if (n.season && n.season.includes(month)) score += 3;
    // Pas de saison = acheteurs toute l'année
    if (!n.season) score += 1.5;
    // HORS saison = PAS d'acheteurs → pénalité forte
    if (n.season && !n.season.includes(month)) score -= 2;

    // CRITÈRE 5 : Prix bas = opération rapide, moins de risque
    if (n.priceMax <= 15) score += 1;
    if (n.priceMax <= 10) score += 0.5;

    return { id, ...n, score: Math.round(score * 10) / 10 };
  });

  return scored
    .filter(n => n.score > 0) // Exclure les scores négatifs (hors saison sans demande)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxNiches);
}

// Retourne les keywords eBay à scanner (top niches, rotatifs)
function getSearchKeywords(maxKeywords = 20) {
  const niches = getNichesToScan(12);
  const keywords = [];
  for (const n of niches) {
    const shuffled = n.keywords.sort(() => Math.random() - 0.5);
    keywords.push(...shuffled.slice(0, 2));
    if (keywords.length >= maxKeywords) break;
  }
  return keywords.slice(0, maxKeywords);
}

// ============================================================
// NEWSAPI (free: 100 req/jour)
// ============================================================

const NEWS_KEYWORDS_FR = [
  'penurie', 'rupture stock', 'liquidation', 'faillite', 'destockage',
  'edition limitee', 'collector', 'viral TikTok', 'record vente',
  'interdiction', 'nouvelle reglementation', 'rappel produit'
];
const NEWS_KEYWORDS_EN = [
  'shortage', 'sold out', 'limited edition', 'recall', 'ban',
  'crisis', 'disaster', 'viral', 'trending', 'liquidation',
  'clearance', 'bankruptcy', 'supply chain disruption',
  'product launch Apple Nike PlayStation', 'sports event FIFA Olympics'
];

async function fetchNews(lang = 'en') {
  const key = process.env.NEWSAPI_KEY;
  if (!key) return [];
  const kw = lang === 'fr' ? NEWS_KEYWORDS_FR : NEWS_KEYWORDS_EN;
  try {
    const q = kw.slice(0, 5).join(' OR ');
    const { data } = await axios.get('https://newsapi.org/v2/everything', {
      params: { q, sortBy: 'publishedAt', pageSize: 30, language: lang },
      headers: { 'X-Api-Key': key },
      timeout: 8000
    });
    return (data.articles || []).map(a => ({
      source: 'newsapi',
      title: a.title,
      url: a.url,
      published: a.publishedAt,
      description: a.description || ''
    }));
  } catch (e) {
    console.error('[NEWS] Erreur:', e.message);
    return [];
  }
}

// ============================================================
// EBAY BROWSE API (free: 5000/jour)
// ============================================================

let ebayToken = null;
let ebayTokenExpiry = 0;

async function getEbayToken() {
  const appId = process.env.EBAY_APP_ID;
  const secret = process.env.EBAY_APP_SECRET;
  if (!appId || !secret) return null;
  if (ebayToken && Date.now() < ebayTokenExpiry) return ebayToken;
  try {
    const creds = Buffer.from(`${appId}:${secret}`).toString('base64');
    const { data } = await axios.post(
      'https://api.ebay.com/identity/v1/oauth2/token',
      'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
      { headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 8000 }
    );
    ebayToken = data.access_token;
    ebayTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return ebayToken;
  } catch (e) {
    console.error('[EBAY] Auth erreur:', e.message);
    return null;
  }
}

async function searchEbay(query, maxPrice = 50, limit = 10) {
  const token = await getEbayToken();
  if (!token) return [];
  try {
    const { data } = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
      params: {
        q: query,
        limit,
        sort: 'newlyListed',
        filter: `price:[..${maxPrice}],priceCurrency:EUR,deliveryCountry:FR`
      },
      headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_FR' },
      timeout: 8000
    });
    return (data.itemSummaries || []).map(item => ({
      source: 'ebay',
      title: item.title,
      price: parseFloat(item.price?.value || 0),
      currency: item.price?.currency || 'EUR',
      url: item.itemWebUrl,
      image: item.image?.imageUrl,
      condition: item.condition,
      seller: item.seller?.username,
      sellerScore: item.seller?.feedbackPercentage ? parseFloat(item.seller.feedbackPercentage) : null
    }));
  } catch (e) {
    console.error('[EBAY] Search erreur:', e.message);
    return [];
  }
}

// ============================================================
// RSS FEEDS (gratuit, illimité)
// ============================================================

async function fetchRss(feedUrl) {
  try {
    const { data: xml } = await axios.get(feedUrl, { timeout: 8000 });
    const items = [];
    const matches = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
    for (const m of matches.slice(0, 20)) {
      const title = (m.match(/<title><!\[CDATA\[(.*?)\]\]>/) || m.match(/<title>(.*?)<\/title>/) || [])[1] || '';
      const link = (m.match(/<link>(.*?)<\/link>/) || [])[1] || '';
      const desc = (m.match(/<description><!\[CDATA\[(.*?)\]\]>/) || m.match(/<description>(.*?)<\/description>/) || [])[1] || '';
      const pubDate = (m.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
      items.push({ source: 'rss', title: title.trim(), url: link.trim(), description: desc.trim().slice(0, 200), published: pubDate });
    }
    return items;
  } catch (e) {
    console.error('[RSS] Erreur:', e.message);
    return [];
  }
}

const DEAL_FEEDS = [
  'https://www.dealabs.com/rss/bons-plans',
  'https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1'
];

async function fetchAllDeals() {
  const results = await Promise.allSettled(DEAL_FEEDS.map(fetchRss));
  return results.filter(r => r.status === 'fulfilled').flatMap(r => r.value);
}

// ============================================================
// HASHING pour scan différentiel (R5)
// ============================================================

function hashItem(item) {
  const key = `${item.source}|${item.title}|${item.url}`;
  return crypto.createHash('md5').update(key).digest('hex');
}

// ============================================================
// SCORING événements (JS pur, 0 LLM)
// ============================================================

const IMPACT_KEYWORDS = {
  critical: {
    words: ['shortage', 'penurie', 'sold out', 'rupture stock', 'recall', 'rappel produit',
            'ban', 'interdiction', 'crisis', 'crise', 'disaster', 'catastrophe',
            'supply chain disruption', 'embargo', 'sanctions'],
    weight: 4
  },
  high: {
    words: ['viral', 'trending', 'limited edition', 'edition limitee', 'collector',
            'faillite', 'bankruptcy', 'record vente', 'unprecedented demand',
            'Apple launch', 'Nike launch', 'PlayStation', 'iPhone', 'GPU shortage'],
    weight: 3
  },
  medium: {
    words: ['liquidation', 'clearance', 'destockage', 'discount', 'sale', 'soldes',
            'new release', 'launch', 'event', 'World Cup', 'Olympics', 'Euro 2026',
            'FIFA', 'Super Bowl', 'Comic Con'],
    weight: 2
  },
  low: {
    words: ['update', 'review', 'comparison', 'guide', 'tips', 'restocked', 'restock'],
    weight: 1
  }
};

function scoreEvent(article) {
  const text = `${article.title} ${article.description}`.toLowerCase();
  let score = 0;
  let matchedKeywords = [];
  for (const [level, config] of Object.entries(IMPACT_KEYWORDS)) {
    for (const word of config.words) {
      if (text.includes(word.toLowerCase())) {
        score += config.weight;
        matchedKeywords.push(word);
      }
    }
  }
  return { score: Math.min(10, Math.round(score)), matchedKeywords };
}

// ============================================================
// DONNÉES MARCHÉS (scores par plateforme)
// ============================================================

const MARKETS = {
  // Europe
  'ebay_fr':       { name: 'eBay France',      zone: 'EU', liquidity: 8, marge: 6, accessibility: 9 },
  'ebay_de':       { name: 'eBay Allemagne',   zone: 'EU', liquidity: 8, marge: 7, accessibility: 8 },
  'ebay_uk':       { name: 'eBay UK',          zone: 'EU', liquidity: 9, marge: 7, accessibility: 7 },
  'vinted':        { name: 'Vinted',           zone: 'EU', liquidity: 7, marge: 8, accessibility: 9 },
  'leboncoin':     { name: 'LeBonCoin',        zone: 'EU', liquidity: 8, marge: 7, accessibility: 9 },
  'rakuten_fr':    { name: 'Rakuten FR',       zone: 'EU', liquidity: 5, marge: 6, accessibility: 8 },
  'wallapop':      { name: 'Wallapop (ES)',    zone: 'EU', liquidity: 6, marge: 7, accessibility: 6 },
  'marktplaats':   { name: 'Marktplaats (NL)', zone: 'EU', liquidity: 6, marge: 7, accessibility: 5 },
  'subito':        { name: 'Subito (IT)',      zone: 'EU', liquidity: 6, marge: 7, accessibility: 5 },
  'kleinanzeigen': { name: 'Kleinanzeigen (DE)', zone: 'EU', liquidity: 7, marge: 7, accessibility: 6 },
  // Amériques
  'amazon_us':     { name: 'Amazon US',        zone: 'US', liquidity: 10, marge: 4, accessibility: 7 },
  'ebay_us':       { name: 'eBay US',          zone: 'US', liquidity: 9, marge: 7, accessibility: 7 },
  'mercado_libre': { name: 'Mercado Libre',    zone: 'US', liquidity: 8, marge: 7, accessibility: 5 },
  'poshmark':      { name: 'Poshmark',         zone: 'US', liquidity: 5, marge: 7, accessibility: 6 },
  'offerup':       { name: 'OfferUp',          zone: 'US', liquidity: 6, marge: 8, accessibility: 6 },
  // Asie-Pacifique
  'aliexpress':    { name: 'AliExpress',       zone: 'APAC', liquidity: 9, marge: 6, accessibility: 7 },
  'taobao':        { name: 'Taobao',           zone: 'APAC', liquidity: 9, marge: 8, accessibility: 3 },
  'rakuten_jp':    { name: 'Rakuten JP',       zone: 'APAC', liquidity: 7, marge: 6, accessibility: 4 },
  'carousell':     { name: 'Carousell (SG)',   zone: 'APAC', liquidity: 5, marge: 7, accessibility: 5 },
  // Global
  'amazon_global': { name: 'Amazon Global',    zone: 'GLOBAL', liquidity: 10, marge: 4, accessibility: 8 },
  'etsy':          { name: 'Etsy',             zone: 'GLOBAL', liquidity: 6, marge: 8, accessibility: 7 },
  'facebook_mp':   { name: 'Facebook MP',      zone: 'GLOBAL', liquidity: 8, marge: 8, accessibility: 8 },
};

function scoreMarket(market) {
  return Math.round((market.liquidity + market.marge + market.accessibility) / 3 * 10) / 10;
}

function getActiveMarkets(threshold = 7) {
  return Object.entries(MARKETS)
    .map(([id, m]) => ({ id, ...m, score: scoreMarket(m) }))
    .filter(m => m.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

// ============================================================
// STATS EXPORT
// ============================================================

function getNicheStats() {
  // Fusionner niches classiques + Web3
  let web3Niches = {};
  try { web3Niches = require('./web3-sources').WEB3_NICHES; } catch(e) {}
  const allNiches = { ...NICHES, ...web3Niches };
  const total = Object.keys(allNiches).length;
  const cats = [...new Set(Object.values(allNiches).map(n => n.cat))];
  const highMargin = Object.values(allNiches).filter(n => n.margin === 'high').length;
  const fast = Object.values(allNiches).filter(n => n.speed === 'fast').length;
  const totalKeywords = Object.values(allNiches).reduce((s, n) => s + n.keywords.length, 0);
  return { totalNiches: total, categories: cats.length, highMargin, fastSpeed: fast, totalKeywords, marketplaces: Object.keys(MARKETS).length };
}

module.exports = {
  NICHES, getNichesToScan, getSearchKeywords,
  fetchNews, NEWS_KEYWORDS_FR, NEWS_KEYWORDS_EN,
  searchEbay, fetchRss, fetchAllDeals,
  hashItem, scoreEvent, IMPACT_KEYWORDS,
  MARKETS, scoreMarket, getActiveMarkets,
  getNicheStats
};
