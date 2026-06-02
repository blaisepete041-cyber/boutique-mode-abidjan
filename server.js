require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globaux
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Fichiers statiques — admin sans cache pour éviter les problèmes de version
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin'), {
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
  }
}));

// Middleware d'authentification admin
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Accès non autorisé' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

// Routes d'authentification
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Route config publique (numéro WhatsApp pour le frontend)
app.get('/api/config', (req, res) => {
  res.json({ whatsapp: process.env.WHATSAPP_NUMBER || '2250700000000' });
});

// Routes produits publiques
app.get('/api/products', (req, res) => {
  try {
    const { category, search, sort } = req.query;
    let query = 'SELECT * FROM products WHERE active = 1';
    const params = [];

    if (category && category !== 'Tous') { query += ' AND category = ?'; params.push(category); }
    if (search) { query += ' AND (name LIKE ? OR description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    if (sort === 'prix_asc') query += ' ORDER BY price ASC';
    else if (sort === 'prix_desc') query += ' ORDER BY price DESC';
    else if (sort === 'popularite') query += ' ORDER BY stock DESC';
    else query += ' ORDER BY created_at DESC';

    const products = db.prepare(query).all(...params);
    res.json(products.map(p => ({ ...p, sizes: JSON.parse(p.sizes || '[]'), colors: JSON.parse(p.colors || '[]'), images: JSON.parse(p.images || '[]') })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/api/products/:id', (req, res) => {
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(req.params.id);
    if (!product) return res.status(404).json({ error: 'Produit introuvable' });

    const fmt = p => ({ ...p, sizes: JSON.parse(p.sizes || '[]'), colors: JSON.parse(p.colors || '[]'), images: JSON.parse(p.images || '[]') });
    const similar = db.prepare('SELECT * FROM products WHERE category = ? AND id != ? AND active = 1 LIMIT 4').all(product.category, product.id);
    res.json({ product: fmt(product), similar: similar.map(fmt) });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Routes commandes publiques
app.post('/api/orders', (req, res) => {
  try {
    const { customer_name, customer_phone, address, district, items, subtotal, delivery_fee, promo_code, discount, total } = req.body;
    if (!customer_name || !customer_phone || !address || !district || !items || !items.length) {
      return res.status(400).json({ error: 'Données de commande incomplètes' });
    }
    const result = db.prepare(`
      INSERT INTO orders (customer_name, customer_phone, address, district, items_json, subtotal, delivery_fee, promo_code, discount, total, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'En attente')
    `).run(customer_name, customer_phone, address, district, JSON.stringify(items), parseInt(subtotal), parseInt(delivery_fee), promo_code || null, parseInt(discount) || 0, parseInt(total));

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ ...order, items: JSON.parse(order.items_json) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création de la commande' });
  }
});

// Validation code promo (public)
app.post('/api/promo/validate', (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code requis' });

    const promo = db.prepare(`
      SELECT * FROM promo_codes
      WHERE code = ? AND active = 1
      AND (expiry_date IS NULL OR expiry_date >= date('now'))
    `).get(code.toUpperCase());

    if (!promo) {
      return res.status(404).json({ error: 'Code promo invalide ou expiré' });
    }

    res.json({
      valid: true,
      code: promo.code,
      type: promo.type,
      value: promo.value
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Routes admin protégées
app.use('/api/admin', authMiddleware);

// Statistiques dashboard
app.get('/api/admin/stats', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const totalOrders = db.prepare('SELECT COUNT(*) as count FROM orders').get();
    const pendingOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'En attente'").get();
    const activeProducts = db.prepare('SELECT COUNT(*) as count FROM products WHERE active = 1').get();

    const todayRevenue = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total FROM orders
      WHERE date(created_at) = ? AND status != 'Annulée'
    `).get(today);

    const last7Days = db.prepare(`
      SELECT date(created_at) as day, COUNT(*) as orders, COALESCE(SUM(total), 0) as revenue
      FROM orders
      WHERE created_at >= date('now', '-7 days') AND status != 'Annulée'
      GROUP BY date(created_at)
      ORDER BY day ASC
    `).all();

    const recentOrders = db.prepare(`
      SELECT * FROM orders ORDER BY created_at DESC LIMIT 5
    `).all().map(o => ({ ...o, items: JSON.parse(o.items_json || '[]') }));

    res.json({
      total_orders: totalOrders.count,
      pending_orders: pendingOrders.count,
      active_products: activeProducts.count,
      today_revenue: todayRevenue.total,
      last_7_days: last7Days,
      recent_orders: recentOrders
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Gestion produits admin
app.get('/api/admin/products', (req, res) => {
  try {
    const products = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
    const formatted = products.map(p => ({
      ...p,
      sizes: JSON.parse(p.sizes || '[]'),
      colors: JSON.parse(p.colors || '[]'),
      images: JSON.parse(p.images || '[]')
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/admin/products', (req, res) => {
  try {
    const { name, description, price, original_price, category, sizes, colors, images, stock, active, badge } = req.body;

    if (!name || !price || !category) {
      return res.status(400).json({ error: 'Nom, prix et catégorie sont requis' });
    }

    const result = db.prepare(`
      INSERT INTO products (name, description, price, original_price, category, sizes, colors, images, stock, active, badge)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name, description || '', parseInt(price),
      original_price ? parseInt(original_price) : null,
      category,
      JSON.stringify(Array.isArray(sizes) ? sizes : (sizes ? sizes.split(',').map(s => s.trim()) : [])),
      JSON.stringify(Array.isArray(colors) ? colors : (colors ? colors.split(',').map(c => c.trim()) : [])),
      JSON.stringify(Array.isArray(images) ? images : (images ? images.split(',').map(i => i.trim()) : [])),
      parseInt(stock) || 0,
      active !== undefined ? (active ? 1 : 0) : 1,
      badge || null
    );

    const newProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({
      ...newProduct,
      sizes: JSON.parse(newProduct.sizes),
      colors: JSON.parse(newProduct.colors),
      images: JSON.parse(newProduct.images)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

app.put('/api/admin/products/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Produit introuvable' });

    const { name, description, price, original_price, category, sizes, colors, images, stock, active, badge } = req.body;

    db.prepare(`
      UPDATE products SET name=?, description=?, price=?, original_price=?,
      category=?, sizes=?, colors=?, images=?, stock=?, active=?, badge=?
      WHERE id=?
    `).run(
      name || existing.name,
      description !== undefined ? description : existing.description,
      price ? parseInt(price) : existing.price,
      original_price !== undefined ? (original_price ? parseInt(original_price) : null) : existing.original_price,
      category || existing.category,
      sizes ? JSON.stringify(Array.isArray(sizes) ? sizes : sizes.split(',').map(s => s.trim())) : existing.sizes,
      colors ? JSON.stringify(Array.isArray(colors) ? colors : colors.split(',').map(c => c.trim())) : existing.colors,
      images ? JSON.stringify(Array.isArray(images) ? images : images.split('\n').map(i => i.trim()).filter(Boolean)) : existing.images,
      stock !== undefined ? parseInt(stock) : existing.stock,
      active !== undefined ? (active ? 1 : 0) : existing.active,
      badge !== undefined ? badge : existing.badge,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    res.json({ ...updated, sizes: JSON.parse(updated.sizes), colors: JSON.parse(updated.colors), images: JSON.parse(updated.images) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la modification' });
  }
});

app.delete('/api/admin/products/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Produit introuvable' });

    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ message: 'Produit supprimé' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// Gestion commandes admin
app.get('/api/admin/orders', (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM orders';
    const params = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    query += ' ORDER BY created_at DESC';

    const orders = db.prepare(query).all(...params);
    res.json(orders.map(o => ({ ...o, items: JSON.parse(o.items_json || '[]') })));
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.put('/api/admin/orders/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['En attente', 'Confirmée', 'Expédiée', 'Livrée', 'Annulée'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Statut invalide' });

    const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Commande introuvable' });

    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ message: 'Statut mis à jour', status });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Gestion codes promo admin
app.get('/api/admin/promos', (req, res) => {
  try {
    const promos = db.prepare('SELECT * FROM promo_codes ORDER BY created_at DESC').all();
    res.json(promos);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/admin/promos', (req, res) => {
  try {
    const { code, type, value, expiry_date } = req.body;
    if (!code || !type || !value) return res.status(400).json({ error: 'Code, type et valeur sont requis' });

    db.prepare(`
      INSERT INTO promo_codes (code, type, value, expiry_date, active)
      VALUES (?, ?, ?, ?, 1)
    `).run(code.toUpperCase(), type, parseInt(value), expiry_date || null);

    res.status(201).json({ message: 'Code promo créé' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ce code existe déjà' });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.put('/api/admin/promos/:id/toggle', (req, res) => {
  try {
    const promo = db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(req.params.id);
    if (!promo) return res.status(404).json({ error: 'Code promo introuvable' });

    const newActive = promo.active ? 0 : 1;
    db.prepare('UPDATE promo_codes SET active = ? WHERE id = ?').run(newActive, req.params.id);
    res.json({ message: 'Statut modifié', active: newActive });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Servir le frontend admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// Toutes les autres routes → frontend client
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`\n✓ Boutique Mode Abidjan démarrée`);
  console.log(`  Boutique :  http://localhost:${PORT}`);
  console.log(`  Admin    :  http://localhost:${PORT}/admin`);
  console.log(`  API      :  http://localhost:${PORT}/api\n`);
});
