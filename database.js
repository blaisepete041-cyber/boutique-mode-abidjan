require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || './boutique.db';
const db = new Database(path.resolve(DB_PATH));

// Activation des foreign keys et du mode WAL pour performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Création des tables
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    original_price INTEGER,
    category TEXT NOT NULL,
    sizes TEXT DEFAULT '[]',
    colors TEXT DEFAULT '[]',
    images TEXT DEFAULT '[]',
    stock INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    badge TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    address TEXT NOT NULL,
    district TEXT NOT NULL,
    items_json TEXT NOT NULL,
    subtotal INTEGER NOT NULL,
    delivery_fee INTEGER NOT NULL,
    promo_code TEXT,
    discount INTEGER DEFAULT 0,
    total INTEGER NOT NULL,
    status TEXT DEFAULT 'En attente',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS promo_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('percentage', 'fixed')),
    value INTEGER NOT NULL,
    expiry_date DATE,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed des produits si la table est vide
const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get();

if (productCount.count === 0) {
  console.log('Insertion des produits de démonstration...');

  const insertProduct = db.prepare(`
    INSERT INTO products (name, description, price, original_price, category, sizes, colors, images, stock, active, badge)
    VALUES (@name, @description, @price, @original_price, @category, @sizes, @colors, @images, @stock, @active, @badge)
  `);

  const seedProducts = [
    {
      name: 'Robe Wax Bogolan',
      description: 'Magnifique robe en tissu wax bogolan, coupe élégante avec des motifs traditionnels du Mali revisités façon moderne. Parfaite pour les occasions festives et les sorties chic.',
      price: 25000,
      original_price: 32000,
      category: 'Robes',
      sizes: JSON.stringify(['S', 'M', 'L', 'XL']),
      colors: JSON.stringify(['Terracotta/Or', 'Bleu/Blanc', 'Vert/Noir']),
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1590735213920-68192a487bc2?w=600',
        'https://images.unsplash.com/photo-1594938298603-c8148c4b4357?w=600',
        'https://images.unsplash.com/photo-1618374945843-6a6de67a5e45?w=600'
      ]),
      stock: 15,
      active: 1,
      badge: 'Promo'
    },
    {
      name: 'Robe Kente Midi',
      description: 'Robe midi en tissu kente authentique du Ghana. Coupe droite valorisante, encolure bateau. Un chef-d\'oeuvre de l\'artisanat africain.',
      price: 35000,
      original_price: null,
      category: 'Robes',
      sizes: JSON.stringify(['XS', 'S', 'M', 'L', 'XL', 'XXL']),
      colors: JSON.stringify(['Multicolore Traditionnel', 'Or/Rouge', 'Bleu Royal/Or']),
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600',
        'https://images.unsplash.com/photo-1568252542512-9fe8fe6b8744?w=600',
        'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=600'
      ]),
      stock: 8,
      active: 1,
      badge: 'Nouveauté'
    },
    {
      name: 'Robe Dashiki Maxi',
      description: 'Longue robe dashiki aux couleurs vibrantes. Tissu léger et respirant, idéal pour le climat chaud d\'Abidjan. Coupe ample et confortable.',
      price: 18000,
      original_price: null,
      category: 'Robes',
      sizes: JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']),
      colors: JSON.stringify(['Orange/Or', 'Rose/Bordeaux', 'Turquoise/Blanc']),
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1592301933927-35b597393c0a?w=600',
        'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=600',
        'https://images.unsplash.com/photo-1566206091558-7f218b696731?w=600'
      ]),
      stock: 20,
      active: 1,
      badge: null
    },
    {
      name: 'Haut Peplum Ankara',
      description: 'Top peplum en tissu Ankara à imprimés géométriques. Coupe courte qui met en valeur la silhouette. Parfait avec un jean ou un pantalon tailleur.',
      price: 12000,
      original_price: 15000,
      category: 'Hauts',
      sizes: JSON.stringify(['XS', 'S', 'M', 'L', 'XL']),
      colors: JSON.stringify(['Jaune/Noir', 'Rouge/Blanc', 'Bleu/Orange']),
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1581044777550-4cfa60707c03?w=600',
        'https://images.unsplash.com/photo-1584370848010-d7fe6bc767ec?w=600',
        'https://images.unsplash.com/photo-1614091090903-e0e9d6af4e28?w=600'
      ]),
      stock: 25,
      active: 1,
      badge: 'Promo'
    },
    {
      name: 'Blouse Brodée Sahel',
      description: 'Blouse en coton brodée à la main selon les traditions sahéliennes. Broderies dorées sur fond crème. Légère et élégante, pour le bureau comme pour les sorties.',
      price: 22000,
      original_price: null,
      category: 'Hauts',
      sizes: JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']),
      colors: JSON.stringify(['Crème/Or', 'Blanc/Argent', 'Beige/Cuivre']),
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=600',
        'https://images.unsplash.com/photo-1562137369-1a1a0bc73a2f?w=600',
        'https://images.unsplash.com/photo-1604644401890-0bd678c83788?w=600'
      ]),
      stock: 12,
      active: 1,
      badge: 'Nouveauté'
    },
    {
      name: 'Top Imprimé Baoulé',
      description: 'Top sans manches aux imprimés inspirés des tissus Baoulé de Côte d\'Ivoire. Tissu fluide et confortable. Un hommage à l\'artisanat ivoirien.',
      price: 9500,
      original_price: null,
      category: 'Hauts',
      sizes: JSON.stringify(['XS', 'S', 'M', 'L', 'XL']),
      colors: JSON.stringify(['Terracotta/Crème', 'Noir/Or', 'Bordeaux/Beige']),
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1533659828870-95ee305cee3e?w=600',
        'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=600',
        'https://images.unsplash.com/photo-1576185850227-1f72b7f8d189?w=600'
      ]),
      stock: 30,
      active: 1,
      badge: null
    },
    {
      name: 'Pantalon Tailleur Wax',
      description: 'Pantalon tailleur coupe droite en tissu wax premium. Taille haute, jambe large. Un must-have pour la femme moderne et élégante d\'Abidjan.',
      price: 28000,
      original_price: 35000,
      category: 'Pantalons',
      sizes: JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']),
      colors: JSON.stringify(['Noir/Or', 'Bleu Électrique/Blanc', 'Vert Forêt/Beige']),
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1594938298603-c8148c4b4357?w=600',
        'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600',
        'https://images.unsplash.com/photo-1549062572-544a64fb0c56?w=600'
      ]),
      stock: 18,
      active: 1,
      badge: 'Promo'
    },
    {
      name: 'Jupe Midi Tissage',
      description: 'Jupe midi en tissage traditionnel africain. Coupe évasée, taille élastique. Tissu résistant et lavable en machine. Idéale pour le quotidien chic.',
      price: 16000,
      original_price: null,
      category: 'Pantalons',
      sizes: JSON.stringify(['XS', 'S', 'M', 'L', 'XL']),
      colors: JSON.stringify(['Terracotta', 'Ocre/Noir', 'Bordeaux']),
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1571513722275-4b41940f54b8?w=600',
        'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=600',
        'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=600'
      ]),
      stock: 22,
      active: 1,
      badge: null
    },
    {
      name: 'Sac Raphia Tressé',
      description: 'Sac à main en raphia tressé à la main par des artisanes ivoiriennes. Fermeture magnétique, bandoulière ajustable. Durable et écologique.',
      price: 15000,
      original_price: null,
      category: 'Accessoires',
      sizes: JSON.stringify(['Taille Unique']),
      colors: JSON.stringify(['Naturel/Marron', 'Naturel/Noir', 'Coloré Multicolore']),
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600',
        'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600',
        'https://images.unsplash.com/photo-1473188588951-666fce8e7c68?w=600'
      ]),
      stock: 35,
      active: 1,
      badge: 'Bestseller'
    },
    {
      name: 'Collier Perles Krobo',
      description: 'Collier en perles Krobo faites à la main au Ghana. Technique ancestrale de fabrication à partir de verre recyclé. Chaque pièce est unique.',
      price: 8500,
      original_price: null,
      category: 'Accessoires',
      sizes: JSON.stringify(['Taille Unique']),
      colors: JSON.stringify(['Multicolore Festif', 'Tons Chauds', 'Tons Naturels']),
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1611085583191-a3b181a88401?w=600',
        'https://images.unsplash.com/photo-1535556116002-6281ff3e9f36?w=600',
        'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=600'
      ]),
      stock: 50,
      active: 1,
      badge: null
    },
    {
      name: 'Ensemble Wax 2 Pièces',
      description: 'Ensemble coordonné top + pantalon en wax africain. Coupe moderne et structurée. Livré dans un pochon cadeau. Parfait pour les cérémonies et mariages.',
      price: 42000,
      original_price: 52000,
      category: 'Nouveautés',
      sizes: JSON.stringify(['S', 'M', 'L', 'XL']),
      colors: JSON.stringify(['Terracotta/Or/Noir', 'Bleu/Blanc/Or', 'Rouge/Crème/Or']),
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600',
        'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600',
        'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600'
      ]),
      stock: 10,
      active: 1,
      badge: 'Nouveauté'
    },
    {
      name: 'Robe Soirée Bazin',
      description: 'Robe de soirée en bazin riche brodé. Tissu luxueux et brillant. Coupe sirène qui valorise la silhouette. Pour les grandes occasions et cérémonies.',
      price: 45000,
      original_price: 60000,
      category: 'Soldes',
      sizes: JSON.stringify(['S', 'M', 'L', 'XL']),
      colors: JSON.stringify(['Noir/Or', 'Bordeaux/Argent', 'Bleu Nuit/Or']),
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=600',
        'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600',
        'https://images.unsplash.com/photo-1570463206370-df28d56abf04?w=600'
      ]),
      stock: 5,
      active: 1,
      badge: 'Soldes'
    }
  ];

  const insertMany = db.transaction((products) => {
    for (const product of products) {
      insertProduct.run(product);
    }
  });

  insertMany(seedProducts);
  console.log(`${seedProducts.length} produits insérés avec succès.`);
}

// Seed des codes promo si vide
const promoCount = db.prepare('SELECT COUNT(*) as count FROM promo_codes').get();
if (promoCount.count === 0) {
  db.prepare(`
    INSERT INTO promo_codes (code, type, value, expiry_date, active)
    VALUES ('ABIDJAN10', 'percentage', 10, '2026-12-31', 1),
           ('BIENVENUE', 'fixed', 2000, null, 1),
           ('SOLDES20', 'percentage', 20, '2026-07-31', 1)
  `).run();
  console.log('Codes promo insérés.');
}

console.log('Base de données initialisée avec succès.');

module.exports = db;
