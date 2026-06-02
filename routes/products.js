const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/products — Liste des produits actifs avec filtres
router.get('/', (req, res) => {
  try {
    const { category, search, sort } = req.query;

    let query = 'SELECT * FROM products WHERE active = 1';
    const params = [];

    if (category && category !== 'Tous') {
      query += ' AND category = ?';
      params.push(category);
    }

    if (search) {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (sort === 'prix_asc') {
      query += ' ORDER BY price ASC';
    } else if (sort === 'prix_desc') {
      query += ' ORDER BY price DESC';
    } else if (sort === 'popularite') {
      query += ' ORDER BY stock DESC';
    } else {
      query += ' ORDER BY created_at DESC';
    }

    const products = db.prepare(query).all(...params);

    // Désérialisation des champs JSON
    const formatted = products.map(p => ({
      ...p,
      sizes: JSON.parse(p.sizes || '[]'),
      colors: JSON.parse(p.colors || '[]'),
      images: JSON.parse(p.images || '[]')
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la récupération des produits' });
  }
});

// GET /api/products/:id — Détail d'un produit
router.get('/:id', (req, res) => {
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(req.params.id);

    if (!product) {
      return res.status(404).json({ error: 'Produit introuvable' });
    }

    const formatted = {
      ...product,
      sizes: JSON.parse(product.sizes || '[]'),
      colors: JSON.parse(product.colors || '[]'),
      images: JSON.parse(product.images || '[]')
    };

    // Produits similaires (même catégorie, pas le même produit)
    const similar = db.prepare(
      'SELECT * FROM products WHERE category = ? AND id != ? AND active = 1 LIMIT 4'
    ).all(product.category, product.id);

    const formattedSimilar = similar.map(p => ({
      ...p,
      sizes: JSON.parse(p.sizes || '[]'),
      colors: JSON.parse(p.colors || '[]'),
      images: JSON.parse(p.images || '[]')
    }));

    res.json({ product: formatted, similar: formattedSimilar });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Routes admin pour les produits
// POST /api/admin/products — Créer un produit
router.post('/admin', (req, res) => {
  try {
    const { name, description, price, original_price, category, sizes, colors, images, stock, active, badge } = req.body;

    if (!name || !price || !category) {
      return res.status(400).json({ error: 'Nom, prix et catégorie sont requis' });
    }

    const result = db.prepare(`
      INSERT INTO products (name, description, price, original_price, category, sizes, colors, images, stock, active, badge)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      description || '',
      parseInt(price),
      original_price ? parseInt(original_price) : null,
      category,
      JSON.stringify(sizes || []),
      JSON.stringify(colors || []),
      JSON.stringify(images || []),
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
    res.status(500).json({ error: 'Erreur lors de la création du produit' });
  }
});

// PUT /api/admin/products/:id — Modifier un produit
router.put('/admin/:id', (req, res) => {
  try {
    const { name, description, price, original_price, category, sizes, colors, images, stock, active, badge } = req.body;

    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Produit introuvable' });
    }

    db.prepare(`
      UPDATE products SET
        name = ?, description = ?, price = ?, original_price = ?,
        category = ?, sizes = ?, colors = ?, images = ?,
        stock = ?, active = ?, badge = ?
      WHERE id = ?
    `).run(
      name || existing.name,
      description !== undefined ? description : existing.description,
      price ? parseInt(price) : existing.price,
      original_price !== undefined ? (original_price ? parseInt(original_price) : null) : existing.original_price,
      category || existing.category,
      sizes ? JSON.stringify(sizes) : existing.sizes,
      colors ? JSON.stringify(colors) : existing.colors,
      images ? JSON.stringify(images) : existing.images,
      stock !== undefined ? parseInt(stock) : existing.stock,
      active !== undefined ? (active ? 1 : 0) : existing.active,
      badge !== undefined ? badge : existing.badge,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    res.json({
      ...updated,
      sizes: JSON.parse(updated.sizes),
      colors: JSON.parse(updated.colors),
      images: JSON.parse(updated.images)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la modification du produit' });
  }
});

// DELETE /api/admin/products/:id — Supprimer un produit
router.delete('/admin/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Produit introuvable' });
    }

    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ message: 'Produit supprimé avec succès' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// GET /api/admin/products — Tous les produits (admin, incluant inactifs)
router.get('/admin/all', (req, res) => {
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

module.exports = router;
