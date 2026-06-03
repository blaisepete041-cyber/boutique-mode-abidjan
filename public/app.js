/* ============================
   BOUTIQUE MODE ABIDJAN - app.js
   ============================ */

// ===== ÉTAT GLOBAL =====
let allProducts = [];
let cart = JSON.parse(localStorage.getItem('cart') || '[]');
let currentFilter = 'Tous';
let currentSort = 'nouveautes';
let currentSearch = '';
let currentPromo = null;
let deliveryFee = 2000;
let currentProduct = null;
let selectedSize = '';
let selectedColor = '';
let modalQty = 1;
let selectedPayment = 'wave';

const PAYMENT_LABELS = {
  wave:      'Wave CI',
  orange:    'Orange Money',
  mtn:       'MTN MoMo',
  livraison: 'Paiement à la livraison'
};

const PAYMENT_INSTRUCTIONS = {
  wave:      'Vous recevrez un lien Wave pour payer avant la livraison.',
  orange:    'Nous vous enverrons le numéro Orange Money pour le transfert.',
  mtn:       'Nous vous enverrons le numéro MTN MoMo pour le transfert.',
  livraison: 'Vous payez en cash au moment de la livraison.'
};

// ===== FORMAT PRIX FCFA =====
function formatPrice(amount) {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
}

// ===== CHARGEMENT DES PRODUITS =====
async function loadProducts() {
  showLoader(true);
  try {
    const params = new URLSearchParams();
    if (currentFilter !== 'Tous') params.set('category', currentFilter);
    if (currentSearch) params.set('search', currentSearch);
    if (currentSort) params.set('sort', currentSort);

    const res = await fetch('/api/products?' + params.toString());
    if (!res.ok) throw new Error('Erreur réseau');
    allProducts = await res.json();
    renderProducts(allProducts);
  } catch (err) {
    console.error(err);
    showToast('Erreur lors du chargement des produits', 'error');
  } finally {
    showLoader(false);
  }
}

function showLoader(show) {
  const loader = document.getElementById('loader');
  if (show) {
    loader.classList.add('active');
  } else {
    loader.classList.remove('active');
  }
}

// ===== RENDU DES PRODUITS =====
function renderProducts(products) {
  const grid = document.getElementById('productsGrid');
  const count = document.getElementById('productsCount');

  count.textContent = products.length + (products.length > 1 ? ' articles trouvés' : ' article trouvé');

  // Vider la grille (sauf le loader)
  const loader = document.getElementById('loader');
  grid.innerHTML = '';
  grid.appendChild(loader);

  if (products.length === 0) {
    grid.innerHTML += `
      <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:#888;">
        <div style="font-size:48px;margin-bottom:16px;">🔍</div>
        <p style="font-size:16px;">Aucun produit trouvé pour cette recherche</p>
        <button onclick="filterCategory('Tous')" style="margin-top:16px;padding:10px 24px;background:var(--terracotta);color:#fff;border:none;border-radius:25px;cursor:pointer;font-size:14px;">
          Voir toute la collection
        </button>
      </div>`;
    return;
  }

  products.forEach((product, index) => {
    const card = createProductCard(product, index);
    grid.appendChild(card);
  });

  // Déclenchement des animations fade-in
  setTimeout(() => {
    const cards = grid.querySelectorAll('.fade-in');
    cards.forEach((card, i) => {
      setTimeout(() => card.classList.add('visible'), i * 60);
    });
  }, 50);
}

function createProductCard(product, index) {
  const div = document.createElement('div');
  div.className = 'product-card fade-in';
  div.style.animationDelay = (index * 0.05) + 's';

  const img = product.images && product.images.length > 0 ? product.images[0] : 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400';
  const discount = product.original_price
    ? Math.round((1 - product.price / product.original_price) * 100)
    : 0;

  div.innerHTML = `
    <div class="product-card-image" onclick="openProductModal(${product.id})">
      <img src="${img}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400'">
      ${product.badge ? `<div class="product-badge"><span class="badge badge-${product.badge.toLowerCase()}">${product.badge}</span></div>` : ''}
      <button class="btn-wishlist" onclick="event.stopPropagation(); toggleWishlist(this)" title="Favoris">🤍</button>
    </div>
    <div class="product-card-body">
      <p class="product-category">${escapeHtml(product.category)}</p>
      <h3 class="product-name" onclick="openProductModal(${product.id})">${escapeHtml(product.name)}</h3>
      <div class="product-price">
        <span class="price-current">${formatPrice(product.price)}</span>
        ${product.original_price ? `<span class="price-original">${formatPrice(product.original_price)}</span>` : ''}
        ${discount > 0 ? `<span class="price-discount">-${discount}%</span>` : ''}
      </div>
      <button class="btn-add-cart" onclick="quickAddToCart(${product.id})">
        + Ajouter au panier
      </button>
    </div>
  `;

  return div;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== FILTRES & RECHERCHE =====
function filterCategory(cat) {
  currentFilter = cat;

  // Mise à jour des boutons actifs
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === cat);
  });

  loadProducts();

  // Scroll vers le catalogue
  document.getElementById('catalogue').scrollIntoView({ behavior: 'smooth' });
}

function handleSearch(query) {
  currentSearch = query.trim();
  clearTimeout(window._searchTimeout);
  window._searchTimeout = setTimeout(loadProducts, 400);
}

function handleSort(value) {
  currentSort = value;
  loadProducts();
}

// ===== MODALE PRODUIT =====
async function openProductModal(productId) {
  try {
    const res = await fetch('/api/products/' + productId);
    if (!res.ok) throw new Error('Produit introuvable');
    const data = await res.json();
    currentProduct = data.product;
    selectedSize = '';
    selectedColor = '';
    modalQty = 1;

    fillProductModal(data.product, data.similar);

    document.getElementById('productModal').classList.add('open');
    document.body.style.overflow = 'hidden';
  } catch (err) {
    showToast('Impossible de charger ce produit', 'error');
  }
}

function fillProductModal(product, similar) {
  const mainImg = product.images && product.images.length > 0 ? product.images[0] : '';
  document.getElementById('modalMainImage').src = mainImg;
  document.getElementById('modalCategory').textContent = product.category;
  document.getElementById('modalName').textContent = product.name;
  document.getElementById('modalPrice').textContent = formatPrice(product.price);
  document.getElementById('modalDescription').textContent = product.description || '';
  document.getElementById('modalQty').textContent = '1';

  const origPrice = document.getElementById('modalOriginalPrice');
  if (product.original_price) {
    origPrice.textContent = formatPrice(product.original_price);
    origPrice.style.display = 'inline';
  } else {
    origPrice.style.display = 'none';
  }

  // Miniatures
  const thumbs = document.getElementById('modalThumbnails');
  thumbs.innerHTML = '';
  (product.images || []).forEach((img, i) => {
    const thumb = document.createElement('div');
    thumb.className = 'gallery-thumb' + (i === 0 ? ' active' : '');
    thumb.innerHTML = `<img src="${img}" alt="">`;
    thumb.onclick = () => {
      document.getElementById('modalMainImage').src = img;
      thumbs.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
    };
    thumbs.appendChild(thumb);
  });

  // Tailles
  const sizeContainer = document.getElementById('sizeOptions');
  sizeContainer.innerHTML = '';
  document.getElementById('selectedSizeLabel').textContent = '';
  (product.sizes || []).forEach(size => {
    const btn = document.createElement('button');
    btn.className = 'size-btn';
    btn.textContent = size;
    btn.onclick = () => {
      sizeContainer.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedSize = size;
      document.getElementById('selectedSizeLabel').textContent = '— ' + size;
    };
    sizeContainer.appendChild(btn);
  });

  // Couleurs
  const colorContainer = document.getElementById('colorOptions');
  colorContainer.innerHTML = '';
  document.getElementById('selectedColorLabel').textContent = '';
  (product.colors || []).forEach(color => {
    const btn = document.createElement('button');
    btn.className = 'color-btn';
    btn.textContent = color;
    btn.onclick = () => {
      colorContainer.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedColor = color;
      document.getElementById('selectedColorLabel').textContent = '— ' + color;
    };
    colorContainer.appendChild(btn);
  });

  // Produits similaires
  const similarGrid = document.getElementById('similarGrid');
  similarGrid.innerHTML = '';
  if (similar && similar.length > 0) {
    document.getElementById('similarProducts').style.display = 'block';
    similar.forEach(p => {
      const card = createProductCard(p, 0);
      card.style.animation = 'none';
      card.style.opacity = '1';
      card.style.transform = 'none';
      similarGrid.appendChild(card);
    });
  } else {
    document.getElementById('similarProducts').style.display = 'none';
  }
}

function changeModalQty(delta) {
  modalQty = Math.max(1, modalQty + delta);
  document.getElementById('modalQty').textContent = modalQty;
}

function addToCartFromModal() {
  if (!currentProduct) return;

  const sizes = currentProduct.sizes || [];
  const colors = currentProduct.colors || [];

  if (sizes.length > 0 && !selectedSize) {
    showToast('Veuillez choisir une taille', 'error');
    return;
  }
  if (colors.length > 0 && !selectedColor) {
    showToast('Veuillez choisir une couleur', 'error');
    return;
  }

  addToCart(currentProduct, selectedSize, selectedColor, modalQty);
  closeProductModal();
  openCart();
}

function closeProductModal() {
  document.getElementById('productModal').classList.remove('open');
  document.body.style.overflow = '';
  currentProduct = null;
}

function handleModalClick(e) {
  if (e.target.id === 'productModal') closeProductModal();
}

// ===== AJOUT RAPIDE AU PANIER (depuis la grille) =====
function quickAddToCart(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  // Si le produit nécessite des options, ouvrir la modale
  if ((product.sizes && product.sizes.length > 1) ||
      (product.colors && product.colors.length > 1)) {
    openProductModal(productId);
    return;
  }

  const size = product.sizes && product.sizes.length > 0 ? product.sizes[0] : '';
  const color = product.colors && product.colors.length > 0 ? product.colors[0] : '';
  addToCart(product, size, color, 1);
  showToast(product.name + ' ajouté au panier ✓', 'success');
}

// ===== GESTION DU PANIER =====
function addToCart(product, size, color, qty) {
  const itemKey = product.id + '_' + size + '_' + color;
  const existing = cart.find(item => item.key === itemKey);

  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({
      key: itemKey,
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.images && product.images.length > 0 ? product.images[0] : '',
      size,
      color,
      qty
    });
  }

  saveCart();
  updateCartUI();
  showToast(product.name + ' ajouté au panier ✓', 'success');
}

function removeFromCart(key) {
  cart = cart.filter(item => item.key !== key);
  saveCart();
  updateCartUI();
  renderCartItems();
}

function updateCartItemQty(key, delta) {
  const item = cart.find(i => i.key === key);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  saveCart();
  updateCartUI();
  renderCartItems();
}

function saveCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
}

function updateCartUI() {
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  document.getElementById('cartCount').textContent = totalItems;
  document.getElementById('cartItemsCount').textContent =
    totalItems + (totalItems > 1 ? ' articles' : ' article');
  updateCartTotals();
}

function updateCartTotals() {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  let discount = 0;

  if (currentPromo) {
    if (currentPromo.type === 'percentage') {
      discount = Math.round(subtotal * currentPromo.value / 100);
    } else {
      discount = currentPromo.value;
    }
    discount = Math.min(discount, subtotal);
  }

  const total = subtotal - discount + deliveryFee;

  document.getElementById('cartSubtotal').textContent = formatPrice(subtotal);
  document.getElementById('cartDelivery').textContent = formatPrice(deliveryFee);
  document.getElementById('cartTotal').textContent = formatPrice(Math.max(0, total));

  if (discount > 0) {
    document.getElementById('discountRow').style.display = 'flex';
    document.getElementById('cartDiscount').textContent = '−' + formatPrice(discount);
  } else {
    document.getElementById('discountRow').style.display = 'none';
  }
}

function renderCartItems() {
  const container = document.getElementById('cartItemsList');

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🛍️</div>
        <p>Votre panier est vide</p>
        <p style="font-size:13px;margin-top:6px;">Découvrez nos magnifiques créations</p>
      </div>`;
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-image">
        <img src="${item.image}" alt="${escapeHtml(item.name)}" onerror="this.style.display='none'">
      </div>
      <div class="cart-item-details">
        <div class="cart-item-name">${escapeHtml(item.name)}</div>
        <div class="cart-item-variant">
          ${item.size ? 'Taille: ' + item.size : ''}
          ${item.size && item.color ? ' · ' : ''}
          ${item.color ? item.color : ''}
        </div>
        <div class="cart-item-footer">
          <span class="cart-item-price">${formatPrice(item.price * item.qty)}</span>
          <div style="display:flex;align-items:center;gap:10px;">
            <div class="cart-item-qty">
              <button class="cart-qty-btn" onclick="updateCartItemQty('${item.key}', -1)">−</button>
              <span class="cart-qty-value">${item.qty}</span>
              <button class="cart-qty-btn" onclick="updateCartItemQty('${item.key}', 1)">+</button>
            </div>
            <button class="btn-remove-item" onclick="removeFromCart('${item.key}')" title="Supprimer">✕</button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

// ===== OUVERTURE/FERMETURE PANIER =====
function openCart() {
  renderCartItems();
  updateCartUI();
  document.getElementById('cartOverlay').classList.add('open');
  document.getElementById('cartDrawer').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('cartOverlay').classList.remove('open');
  document.getElementById('cartDrawer').classList.remove('open');
  document.body.style.overflow = '';
}

// ===== LIVRAISON =====
function selectDelivery(type) {
  deliveryFee = type === 'abidjan' ? 2000 : 5000;

  document.getElementById('deliveryAbidjan').classList.toggle('selected', type === 'abidjan');
  document.getElementById('deliveryOther').classList.toggle('selected', type === 'other');

  updateCartTotals();
}

// ===== CODE PROMO =====
async function validatePromo() {
  const code = document.getElementById('promoInput').value.trim();
  const feedback = document.getElementById('promoFeedback');

  if (!code) {
    feedback.className = 'promo-feedback error';
    feedback.textContent = 'Saisissez un code promo';
    return;
  }

  try {
    const res = await fetch('/api/promo/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });

    const data = await res.json();

    if (!res.ok) {
      feedback.className = 'promo-feedback error';
      feedback.textContent = data.error || 'Code invalide';
      currentPromo = null;
    } else {
      currentPromo = data;
      const desc = data.type === 'percentage'
        ? '-' + data.value + '% sur votre commande'
        : '-' + formatPrice(data.value) + ' sur votre commande';
      feedback.className = 'promo-feedback success';
      feedback.textContent = 'Code "' + data.code + '" appliqué : ' + desc;
      updateCartTotals();
    }
  } catch {
    feedback.className = 'promo-feedback error';
    feedback.textContent = 'Erreur réseau';
  }
}

// ===== CHECKOUT =====
function openCheckout() {
  if (cart.length === 0) {
    showToast('Votre panier est vide', 'error');
    return;
  }

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  let discount = 0;
  if (currentPromo) {
    discount = currentPromo.type === 'percentage'
      ? Math.round(subtotal * currentPromo.value / 100)
      : currentPromo.value;
    discount = Math.min(discount, subtotal);
  }

  const total = subtotal - discount + deliveryFee;

  // Remplir le résumé
  const itemsList = document.getElementById('checkoutItemsList');
  itemsList.innerHTML = cart.map(item => `
    <div class="checkout-item">
      <span>${escapeHtml(item.name)} × ${item.qty}${item.size ? ' (' + item.size + ')' : ''}</span>
      <span>${formatPrice(item.price * item.qty)}</span>
    </div>
  `).join('') + (discount > 0 ? `
    <div class="checkout-item" style="color:#2E7D32;">
      <span>Réduction promo</span>
      <span>−${formatPrice(discount)}</span>
    </div>
  ` : '') + `
    <div class="checkout-item">
      <span>Livraison</span>
      <span>${formatPrice(deliveryFee)}</span>
    </div>
  `;

  document.getElementById('checkoutTotalAmount').textContent = formatPrice(total);

  closeCart();
  document.getElementById('checkoutModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCheckout() {
  document.getElementById('checkoutModal').classList.remove('open');
  document.body.style.overflow = '';
}

async function submitOrder(e) {
  e.preventDefault();

  const customerName = document.getElementById('customerName').value.trim();
  const customerPhone = document.getElementById('customerPhone').value.trim();
  const address = document.getElementById('customerAddress').value.trim();
  const district = document.getElementById('customerDistrict').value;

  if (!customerName || !customerPhone || !address || !district) {
    showToast('Veuillez remplir tous les champs', 'error');
    return;
  }

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  let discount = 0;
  if (currentPromo) {
    discount = currentPromo.type === 'percentage'
      ? Math.round(subtotal * currentPromo.value / 100)
      : currentPromo.value;
    discount = Math.min(discount, subtotal);
  }
  const total = subtotal - discount + deliveryFee;

  // Snapshot du panier AVANT vidage pour le message WhatsApp
  const cartSnapshot = [...cart];
  const promoSnapshot = currentPromo ? { ...currentPromo } : null;

  // Sauvegarde en base
  try {
    await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: customerName,
        customer_phone: customerPhone,
        address,
        district,
        items: cart,
        subtotal,
        delivery_fee: deliveryFee,
        promo_code: currentPromo ? currentPromo.code : null,
        discount,
        total
      })
    });
  } catch {
    // On continue même si la sauvegarde échoue
  }

  // Génération du message WhatsApp avec le snapshot
  const waNumber = window.WA_NUMBER || '2250700000000';
  const message = buildWhatsAppMessage(customerName, customerPhone, address, district, cartSnapshot, subtotal, discount, total, promoSnapshot);
  const waUrl = 'https://wa.me/' + waNumber + '?text=' + encodeURIComponent(message);

  // Vider le panier
  cart = [];
  saveCart();
  updateCartUI();
  currentPromo = null;
  document.getElementById('promoFeedback').className = 'promo-feedback';
  document.getElementById('promoInput').value = '';

  closeCheckout();
  showToast('Commande envoyée ! Redirection vers WhatsApp...', 'success');

  setTimeout(() => { window.open(waUrl, '_blank'); }, 1200);
}

function buildWhatsAppMessage(name, phone, address, district, items, subtotal, discount, total, promo) {
  const nf = n => new Intl.NumberFormat('fr-FR').format(n);
  const lines = [
    "Bonjour Lumière d'Afrique ! 🌟",
    '',
    '*NOUVELLE COMMANDE*',
    '',
    '*Client :* ' + name,
    '*Téléphone :* ' + phone,
    '*Adresse :* ' + address + ', ' + district,
    '',
    '*Articles commandés :*'
  ];

  items.forEach(item => {
    let line = '• ' + item.name;
    if (item.size) line += ' (Taille: ' + item.size + ')';
    if (item.color) line += ' — ' + item.color;
    line += ' × ' + item.qty + ' = ' + nf(item.price * item.qty) + ' FCFA';
    lines.push(line);
  });

  lines.push('');
  lines.push('*Sous-total :* ' + nf(subtotal) + ' FCFA');
  if (discount > 0 && promo) {
    lines.push('*Réduction (' + promo.code + ') :* −' + nf(discount) + ' FCFA');
  }
  lines.push('*Livraison :* ' + nf(deliveryFee) + ' FCFA');
  lines.push('*TOTAL À PAYER :* ' + nf(total) + ' FCFA');
  lines.push('');
  lines.push('*Mode de paiement :* ' + (PAYMENT_LABELS[selectedPayment] || selectedPayment));
  lines.push('');
  lines.push('Merci de confirmer ma commande. 🙏');

  return lines.join('\n');
}

// ===== MODALES INFORMATIONS =====
const INFO_CONTENT = {

  apropos: {
    title: 'À propos de Lumière d\'Afrique',
    html: `
      <div class="info-body">
        <div class="info-section">
          <h3>🌍 Notre histoire</h3>
          <p>Lumière d'Afrique est une boutique mode africaine basée à Port-Bouët, Abidjan. Nous célébrons la beauté et le savoir-faire artisanal de l'Afrique à travers des créations modernes et élégantes.</p>
        </div>
        <div class="info-section">
          <h3>✨ Notre mission</h3>
          <p>Proposer des vêtements et accessoires de qualité — robes wax, ensembles kente, hauts brodés — qui allient tradition africaine et style contemporain, à des prix accessibles pour toutes les femmes d'Abidjan et de Côte d'Ivoire.</p>
        </div>
        <div class="info-section">
          <h3>🤝 Nos engagements</h3>
          <ul>
            <li>Tissus authentiques sélectionnés auprès d'artisans africains</li>
            <li>Qualité vérifiée sur chaque pièce avant expédition</li>
            <li>Livraison rapide à Abidjan et dans toute la Côte d'Ivoire</li>
            <li>Service client disponible 7j/7 sur WhatsApp</li>
            <li>Échanges possibles sous 7 jours si la taille ne convient pas</li>
          </ul>
        </div>
        <div class="info-section">
          <h3>📍 Nous trouver</h3>
          <p>Port-Bouët, Abidjan, Côte d'Ivoire.<br>Commandes et renseignements sur WhatsApp : <strong>+225 01 02 00 48 78</strong></p>
        </div>
      </div>`
  },

  livraison: {
    title: 'Livraison & Retours',
    html: `
      <div class="info-body">
        <div class="info-section">
          <h3>🚴 Livraison à Abidjan</h3>
          <ul>
            <li>Frais de livraison : <strong>2 000 FCFA</strong></li>
            <li>Délai : <strong>24 à 48h</strong> après confirmation</li>
            <li>Zones couvertes : tous les quartiers d'Abidjan</li>
            <li>Livraison directement à votre adresse</li>
          </ul>
        </div>
        <div class="info-section">
          <h3>📦 Livraison hors Abidjan</h3>
          <ul>
            <li>Frais de livraison : <strong>5 000 FCFA</strong></li>
            <li>Délai : <strong>3 à 5 jours ouvrables</strong></li>
            <li>Transport via agences de voyage ou transporteurs</li>
            <li>Villes : Bouaké, Daloa, Yamoussoukro, San-Pédro, Korhogo…</li>
          </ul>
        </div>
        <div class="info-section">
          <h3>💳 Modes de paiement acceptés</h3>
          <ul>
            <li>Wave CI</li>
            <li>Orange Money</li>
            <li>MTN MoMo</li>
            <li>Paiement à la livraison (Abidjan uniquement)</li>
          </ul>
        </div>
        <div class="info-section">
          <h3>↩️ Échanges & retours</h3>
          <ul>
            <li>Échange possible sous <strong>7 jours</strong> après réception</li>
            <li>Article non porté, étiquette intacte</li>
            <li>Contacter le service client sur WhatsApp pour initier l'échange</li>
            <li>Les frais de retour sont à la charge du client</li>
          </ul>
        </div>
        <div class="info-section">
          <h3>⚠️ Articles non échangeables</h3>
          <ul>
            <li>Articles en promotion (soldes)</li>
            <li>Accessoires (sacs, colliers, bijoux)</li>
            <li>Articles portés ou lavés</li>
          </ul>
        </div>
      </div>`
  },

  tailles: {
    title: 'Guide des tailles',
    html: `
      <div class="info-body">
        <div class="info-section">
          <h3>📏 Comment prendre ses mesures</h3>
          <p>Mesurez avec un mètre ruban souple. Pour la poitrine et les hanches, mesurez la partie la plus large. Pour la taille, mesurez la partie la plus étroite du buste.</p>
        </div>
        <div class="info-section">
          <h3>👗 Tableau des tailles — Vêtements</h3>
          <div style="overflow-x:auto;">
            <table class="size-table">
              <thead>
                <tr>
                  <th>Taille</th>
                  <th>Poitrine (cm)</th>
                  <th>Taille (cm)</th>
                  <th>Hanches (cm)</th>
                </tr>
              </thead>
              <tbody>
                <tr><td><strong>XS</strong></td><td>80 – 83</td><td>60 – 63</td><td>86 – 89</td></tr>
                <tr><td><strong>S</strong></td><td>84 – 87</td><td>64 – 67</td><td>90 – 93</td></tr>
                <tr><td><strong>M</strong></td><td>88 – 91</td><td>68 – 71</td><td>94 – 97</td></tr>
                <tr><td><strong>L</strong></td><td>92 – 96</td><td>72 – 76</td><td>98 – 102</td></tr>
                <tr><td><strong>XL</strong></td><td>97 – 102</td><td>77 – 82</td><td>103 – 108</td></tr>
                <tr><td><strong>XXL</strong></td><td>103 – 110</td><td>83 – 90</td><td>109 – 116</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="info-section">
          <h3>💡 Conseils</h3>
          <ul>
            <li>En cas de doute entre deux tailles, prenez la plus grande</li>
            <li>Les robes et ensembles wax ont une coupe ajustée — référez-vous au tableau</li>
            <li>Contactez-nous sur WhatsApp pour un conseil personnalisé</li>
          </ul>
        </div>
      </div>`
  },

  contact: {
    title: 'Nous contacter',
    html: `
      <div class="info-body">
        <div class="info-section">
          <h3>💬 Service client</h3>
          <p style="margin-bottom:16px;">Disponible 7j/7 de 8h à 20h. Réponse garantie sous 2 heures.</p>

          <a href="https://wa.me/2250102004878" target="_blank" class="contact-card">
            <div class="contact-card-icon cc-whatsapp">💬</div>
            <div class="contact-card-info">
              <strong>WhatsApp</strong>
              <span>+225 01 02 00 48 78 · Réponse rapide</span>
            </div>
          </a>

          <a href="tel:+2250102004878" class="contact-card">
            <div class="contact-card-icon cc-phone">📞</div>
            <div class="contact-card-info">
              <strong>Appel téléphonique</strong>
              <span>+225 01 02 00 48 78</span>
            </div>
          </a>

          <a href="mailto:contact@lumiere-afrique.ci" class="contact-card">
            <div class="contact-card-icon cc-email">✉️</div>
            <div class="contact-card-info">
              <strong>Email</strong>
              <span>contact@lumiere-afrique.ci</span>
            </div>
          </a>

          <div class="contact-card" style="cursor:default;">
            <div class="contact-card-icon cc-location">📍</div>
            <div class="contact-card-info">
              <strong>Localisation</strong>
              <span>Port-Bouët, Abidjan, Côte d'Ivoire</span>
            </div>
          </div>
        </div>

        <div class="info-section">
          <h3>⏰ Horaires</h3>
          <ul>
            <li>Lundi – Vendredi : 8h00 – 20h00</li>
            <li>Samedi : 9h00 – 18h00</li>
            <li>Dimanche : 10h00 – 16h00</li>
          </ul>
        </div>
      </div>`
  }
};

function openInfoModal(page) {
  const content = INFO_CONTENT[page];
  if (!content) return;

  document.getElementById('infoModalTitle').textContent = content.title;
  document.getElementById('infoModalBody').innerHTML = content.html;

  const modal = document.getElementById('infoModal');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeInfoModal() {
  document.getElementById('infoModal').style.display = 'none';
  document.body.style.overflow = '';
}

// ===== PAIEMENT MOBILE MONEY =====
function selectPayment(type) {
  selectedPayment = type;
  document.querySelectorAll('.payment-option').forEach(el => el.classList.remove('selected'));
  const clicked = document.querySelector(`.payment-option input[value="${type}"]`);
  if (clicked) clicked.closest('.payment-option').classList.add('selected');
  const instr = document.getElementById('paymentInstruction');
  if (instr) instr.textContent = PAYMENT_INSTRUCTIONS[type] || '';
}

// ===== WISHLIST =====
function toggleWishlist(btn) {
  btn.classList.toggle('active');
  btn.textContent = btn.classList.contains('active') ? '❤️' : '🤍';
}

// ===== TOAST NOTIFICATIONS =====
function showToast(message, type = '') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===== MENU MOBILE =====
function openMobileMenu() {
  document.getElementById('mobileMenu').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
  document.getElementById('mobileMenu').classList.remove('open');
  document.body.style.overflow = '';
}

// ===== SCROLL ANIMATIONS =====
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
}

// ===== INITIALISATION =====
document.addEventListener('DOMContentLoaded', async () => {
  // Charger le numéro WhatsApp depuis la config serveur
  try {
    const cfg = await fetch('/api/config').then(r => r.json());
    window.WA_NUMBER = cfg.whatsapp || '2250700000000';
  } catch {
    window.WA_NUMBER = '2250700000000';
  }

  loadProducts();
  updateCartUI();

  // Scroll observer
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.08 });

  // Réobserver quand de nouveaux éléments apparaissent
  new MutationObserver(() => {
    document.querySelectorAll('.fade-in:not(.visible)').forEach(el => observer.observe(el));
  }).observe(document.getElementById('productsGrid'), { childList: true });

  // Fermer la modale avec Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeProductModal();
      closeCart();
      closeCheckout();
      closeMobileMenu();
      closeInfoModal();
    }
  });
});
