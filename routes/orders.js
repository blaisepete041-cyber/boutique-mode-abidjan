const express = require('express');
const router = express.Router();
const db = require('../database');

// POST /api/orders — Créer une commande
router.post('/', (req, res) => {
  try {
    const { customer_name, customer_phone, address, district, items, subtotal, delivery_fee, promo_code, discount, total } = req.body;

    if (!customer_name || !customer_phone || !address || !district || !items || !items.length) {
      return res.status(400).json({ error: 'Données de commande incomplètes' });
    }

    const result = db.prepare(`
      INSERT INTO orders (customer_name, customer_phone, address, district, items_json, subtotal, delivery_fee, promo_code, discount, total, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'En attente')
    `).run(
      customer_name,
      customer_phone,
      address,
      district,
      JSON.stringify(items),
      parseInt(subtotal),
      parseInt(delivery_fee),
      promo_code || null,
      parseInt(discount) || 0,
      parseInt(total)
    );

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({
      ...order,
      items: JSON.parse(order.items_json)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création de la commande' });
  }
});

// GET /api/orders — Liste des commandes (admin)
router.get('/', (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM orders';
    const params = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const orders = db.prepare(query).all(...params);
    const formatted = orders.map(o => ({
      ...o,
      items: JSON.parse(o.items_json || '[]')
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/orders/:id — Détail d'une commande (admin)
router.get('/:id', (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Commande introuvable' });
    }

    res.json({ ...order, items: JSON.parse(order.items_json || '[]') });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/orders/:id/status — Mise à jour du statut (admin)
router.put('/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['En attente', 'Confirmée', 'Expédiée', 'Livrée', 'Annulée'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Commande introuvable' });
    }

    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ message: 'Statut mis à jour', status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

module.exports = router;
