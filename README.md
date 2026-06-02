# Lumière d'Afrique — Boutique Mode Abidjan

Boutique e-commerce complète pour une marque de mode africaine basée à Abidjan, Côte d'Ivoire.

## Installation rapide

```bash
# 1. Cloner le projet
git clone <url-du-repo>
cd boutique-mode-abidjan

# 2. Installer les dépendances
npm install

# 3. Configurer l'environnement
cp .env.example .env
# Editer .env avec votre numéro WhatsApp et vos identifiants

# 4. Démarrer le serveur (initialise la BDD + seed automatiquement)
node server.js
```

La boutique est accessible à http://localhost:3000

---

## URLs

| Page | URL |
|---|---|
| Boutique client | http://localhost:3000 |
| Panel admin | http://localhost:3000/admin |
| API produits | http://localhost:3000/api/products |
| API config | http://localhost:3000/api/config |

## Identifiants admin par défaut

| Champ | Valeur |
|---|---|
| Identifiant | `admin` |
| Mot de passe | `motdepasse123` |

> Changez ces valeurs dans le fichier `.env` avant toute mise en production.

---

## Variables d'environnement (.env)

```env
PORT=3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=motdepasse123
WHATSAPP_NUMBER=2250700000000    # Format international CI : 225 + numéro sans le 0
JWT_SECRET=change_this_secret    # Changez impérativement en production
DB_PATH=./boutique.db
```

---

## Personnalisation

### Nom de la boutique
Remplacez `Lumière d'Afrique` dans :
- `public/index.html` — titre, logo, footer
- `admin/index.html` — titre du panel

### Numéro WhatsApp
Dans `.env`, modifiez `WHATSAPP_NUMBER` :
```
WHATSAPP_NUMBER=2250709876543
```
Format : `225` suivi du numéro ivoirien sans le zéro initial (10 chiffres au total).

### Couleurs de la boutique
Dans `public/style.css`, modifiez les variables CSS :
```css
:root {
  --terracotta: #C1440E;  /* Couleur principale */
  --or: #D4AF37;          /* Couleur accentuation */
  --creme: #F5F0E8;       /* Fond général */
  --bordeaux: #6B1F2E;    /* Couleur secondaire */
}
```

### Livraison
Dans `public/app.js`, modifiez les frais :
```js
// Ligne ~240 dans selectDelivery()
deliveryFee = type === 'abidjan' ? 2000 : 5000;  // En FCFA
```

---

## Fonctionnalités

### Boutique client
- Catalogue avec filtres par catégorie (Robes, Hauts, Pantalons, Accessoires, Nouveautés, Soldes)
- Recherche live par nom de produit
- Tri prix croissant/décroissant, nouveautés, popularité
- Modale produit avec galerie photos, sélecteur taille/couleur/quantité
- Panier drawer avec codes promo
- Options livraison : Abidjan (2 000 FCFA) / Hors Abidjan (5 000 FCFA)
- Commande finalisée via WhatsApp avec message pré-rempli et professionnel
- Design mobile-first responsive

### Panel admin
- Authentification sécurisée (JWT, session 24h)
- Dashboard : stats du jour + graphique 7 jours (Chart.js)
- CRUD produits complet (nom, prix, images URL, tailles, couleurs, stock, badge, actif/inactif)
- Gestion commandes avec mise à jour statut en 1 clic
- Bouton "Contacter client" → ouvre WhatsApp directement
- Gestion codes promo (pourcentage ou montant fixe, date d'expiration)

---

## Structure du projet

```
boutique-mode-abidjan/
├── server.js          # Serveur Express + toutes les routes API
├── database.js        # Init SQLite + seed 12 produits
├── package.json
├── .env               # Variables d'environnement (ne pas commiter)
├── .env.example       # Modèle de configuration
├── boutique.db        # Base SQLite (générée au premier démarrage)
├── public/
│   ├── index.html     # Boutique client
│   ├── style.css      # Styles mobile-first
│   └── app.js         # Logique frontend (panier, modales, WhatsApp)
├── admin/
│   ├── index.html     # Panel admin
│   ├── admin.css      # Styles admin
│   └── admin.js       # Logique admin (dashboard, CRUD)
└── routes/
    ├── auth.js        # Login / vérification token
    ├── products.js    # Routes produits (non utilisées directement)
    └── orders.js      # Routes commandes (non utilisées directement)
```

---

## API REST

| Méthode | Route | Description | Auth |
|---|---|---|---|
| GET | `/api/products` | Liste produits actifs | Public |
| GET | `/api/products/:id` | Détail produit + similaires | Public |
| POST | `/api/orders` | Créer une commande | Public |
| POST | `/api/promo/validate` | Valider un code promo | Public |
| GET | `/api/config` | Config publique (numéro WA) | Public |
| POST | `/api/auth/login` | Connexion admin | Public |
| GET | `/api/auth/verify` | Vérifier le token | Public |
| GET | `/api/admin/stats` | Stats dashboard | Admin |
| GET | `/api/admin/products` | Tous les produits | Admin |
| POST | `/api/admin/products` | Créer un produit | Admin |
| PUT | `/api/admin/products/:id` | Modifier un produit | Admin |
| DELETE | `/api/admin/products/:id` | Supprimer un produit | Admin |
| GET | `/api/admin/orders` | Liste commandes | Admin |
| PUT | `/api/admin/orders/:id/status` | Mettre à jour statut | Admin |
| GET | `/api/admin/promos` | Liste codes promo | Admin |
| POST | `/api/admin/promos` | Créer un code promo | Admin |
| PUT | `/api/admin/promos/:id/toggle` | Activer/désactiver | Admin |

---

## Déploiement (Render / Railway)

1. Pousser le code sur GitHub
2. Créer un nouveau Web Service sur Render ou Railway
3. Build command : `npm install`
4. Start command : `node server.js`
5. Ajouter les variables d'environnement dans le dashboard

> Pour Render : activer le disque persistant pour conserver `boutique.db` entre les redémarrages.

---

## Codes promo inclus dans le seed

| Code | Type | Valeur | Expiration |
|---|---|---|---|
| `ABIDJAN10` | Pourcentage | -10% | 31/12/2026 |
| `BIENVENUE` | Montant fixe | -2 000 FCFA | Illimitée |
| `SOLDES20` | Pourcentage | -20% | 31/07/2026 |

---

## Stack technique

- **Backend** : Node.js + Express.js
- **Base de données** : SQLite via better-sqlite3
- **Frontend** : HTML5 + CSS3 + JavaScript vanilla
- **Auth** : JWT (jsonwebtoken)
- **Graphiques** : Chart.js (CDN)
- **Polices** : Google Fonts (Playfair Display + Inter)
- **Paiement** : Flow WhatsApp (pas de passerelle en ligne)
