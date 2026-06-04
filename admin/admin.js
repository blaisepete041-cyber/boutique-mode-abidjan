/* ============================
   ADMIN PANEL JS
   ============================ */

let authToken = localStorage.getItem('adminToken') || '';
let allAdminProducts = [];
let ordersChart = null;

// ===== FORMAT PRIX =====
function fmt(n) {
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';
}

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ===== AUTH =====
async function doLogin(e) {
  e.preventDefault();

  const passEl = document.getElementById('loginPass');
  const errEl  = document.getElementById('loginError');

  if (!passEl) {
    location.reload(); // cache obsolète — forcer le rechargement
    return;
  }

  const pass = passEl.value.trim();
  errEl.classList.remove('show');

  if (!pass) {
    errEl.textContent = 'Veuillez saisir le mot de passe.';
    errEl.classList.add('show');
    return;
  }

  // Feedback visuel sur le bouton
  const btn = e.target.querySelector('button[type="submit"]') || document.querySelector('.btn-login');
  if (btn) { btn.textContent = 'Connexion…'; btn.disabled = true; }

  try {
    const res  = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password: pass })
    });
    const data = await res.json();

    if (!res.ok) {
      errEl.textContent = data.error || 'Mot de passe incorrect.';
      errEl.classList.add('show');
      return;
    }

    authToken = data.token;
    localStorage.setItem('adminToken', authToken);
    showApp();
  } catch {
    const url = window.location.href;
    if (url.startsWith('file://')) {
      errEl.textContent = 'Ouvrez le panel via http://localhost:3000/admin (pas depuis un fichier local).';
    } else {
      errEl.textContent = 'Serveur inaccessible. Lancez : node server.js';
    }
    errEl.classList.add('show');
  } finally {
    if (btn) { btn.textContent = 'Accéder au panel'; btn.disabled = false; }
  }
}

function logout() {
  localStorage.removeItem('adminToken');
  authToken = '';
  document.getElementById('app').style.display = 'none';
  document.getElementById('loginPage').style.display = 'flex';
}

async function checkAuth() {
  if (!authToken) return false;
  try {
    const res = await fetch('/api/auth/verify', {
      headers: { Authorization: 'Bearer ' + authToken }
    });
    return res.ok;
  } catch {
    return false;
  }
}

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + authToken };
}

async function showApp() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('app').style.display = 'block';

  const now = new Date();
  document.getElementById('dashDate').textContent =
    now.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  await loadDashboard();
}

// ===== NAVIGATION =====
function showPage(page) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.textContent.toLowerCase().includes(page === 'dashboard' ? 'tableau' :
        page === 'products' ? 'produit' :
        page === 'orders' ? 'commande' : 'promo')) {
      n.classList.add('active');
    }
  });

  if (page === 'products') loadAdminProducts();
  if (page === 'orders') loadOrders();
  if (page === 'promos') loadPromos();

  // Fermer sidebar mobile
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}

// ===== DASHBOARD =====
async function loadDashboard() {
  try {
    const [statsRes, alertsRes] = await Promise.all([
      fetch('/api/admin/stats', { headers: authHeaders() }),
      fetch('/api/admin/alerts', { headers: authHeaders() })
    ]);
    if (statsRes.status === 401) { logout(); return; }
    const data = await statsRes.json();

    document.getElementById('statOrders').textContent = data.total_orders;
    document.getElementById('statRevenue').textContent = fmt(data.today_revenue);
    document.getElementById('statPending').textContent = data.pending_orders;
    document.getElementById('statProducts').textContent = data.active_products;

    renderOrdersChart(data.last_7_days);
    renderRecentOrders(data.recent_orders);

    if (alertsRes.ok) {
      const alerts = await alertsRes.json();
      renderAlerts(alerts);
    }
  } catch (err) {
    console.error(err);
    showToast('Erreur de chargement', 'error');
  }
}

function renderAlerts(data) {
  const card = document.getElementById('alertsCard');
  const list = document.getElementById('alertsList');
  const count = document.getElementById('alertsCount');
  const badge = document.getElementById('pendingBadge');

  if (badge) {
    badge.textContent = data.pending_orders;
    badge.style.display = data.pending_orders > 0 ? 'inline-flex' : 'none';
  }

  if (!card || !list) return;
  if (!data.low_stock || data.low_stock.length === 0) { card.style.display = 'none'; return; }

  card.style.display = 'block';
  if (count) count.textContent = data.low_stock.length + ' produit(s) concerné(s)';
  list.innerHTML = data.low_stock.map(p => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F0EDE8;">
      <div>
        <span style="font-weight:600;font-size:13px;">${escHtml(p.name)}</span>
        <span style="font-size:11px;color:#888;margin-left:8px;">${escHtml(p.category)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:13px;font-weight:700;color:${p.stock === 0 ? '#C62828' : '#E65100'};">
          ${p.stock === 0 ? '🔴 Rupture' : '🟡 Stock: ' + p.stock}
        </span>
        <button class="btn-action btn-edit" onclick="showPage('products'); setTimeout(() => openProductForm(${p.id}), 300);" style="padding:4px 10px;font-size:11px;">Modifier</button>
      </div>
    </div>
  `).join('');
}

function renderOrdersChart(data) {
  const ctx = document.getElementById('ordersChart').getContext('2d');

  // Générer les 7 derniers jours
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }

  const labels = days.map(d => {
    const date = new Date(d + 'T12:00:00');
    return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
  });

  const ordersData = days.map(day => {
    const found = data.find(d => d.day === day);
    return found ? found.orders : 0;
  });

  if (ordersChart) ordersChart.destroy();

  ordersChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Commandes',
        data: ordersData,
        backgroundColor: 'rgba(193, 68, 14, 0.75)',
        borderColor: '#C1440E',
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
          grid: { color: '#F0EDE8' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

function renderRecentOrders(orders) {
  const tbody = document.getElementById('recentOrdersTable');
  if (!orders || orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:#888;">Aucune commande</td></tr>';
    return;
  }

  tbody.innerHTML = orders.map(o => `
    <tr>
      <td>#${o.id}</td>
      <td style="font-weight:600;">${escHtml(o.customer_name)}</td>
      <td class="price-cell">${fmt(o.total)}</td>
      <td>${escHtml(o.district)}</td>
      <td><span class="status-badge ${statusClass(o.status)}">${o.status}</span></td>
      <td style="color:#888;">${formatDate(o.created_at)}</td>
    </tr>
  `).join('');
}

// ===== PRODUITS ADMIN =====
async function loadAdminProducts() {
  try {
    const res = await fetch('/api/admin/products', { headers: authHeaders() });
    if (res.status === 401) { logout(); return; }
    allAdminProducts = await res.json();
    renderProductsTable(allAdminProducts);
  } catch {
    showToast('Erreur de chargement des produits', 'error');
  }
}

function renderProductsTable(products) {
  const tbody = document.getElementById('productsTable');
  const count = document.getElementById('productsTableCount');
  count.textContent = products.length + ' produit(s)';

  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">👗</div><p>Aucun produit trouvé</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = products.map(p => {
    const img = p.images && p.images.length > 0 ? p.images[0] : '';
    return `
      <tr>
        <td><img class="product-table-img" src="${img}" alt="" onerror="this.style.display='none'"></td>
        <td><div class="product-name-cell">${escHtml(p.name)}</div></td>
        <td class="price-cell">${fmt(p.price)}</td>
        <td>${escHtml(p.category)}</td>
        <td style="font-weight:600;">${p.stock}</td>
        <td><span class="status-badge ${p.active ? 'status-active' : 'status-inactive'}">${p.active ? 'Actif' : 'Inactif'}</span></td>
        <td>
          <div class="actions-cell">
            <button class="btn-action btn-edit" onclick="openProductForm(${p.id})">✏️ Modifier</button>
            <button class="btn-action btn-delete" onclick="deleteProduct(${p.id}, '${escHtml(p.name)}')">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterProductsTable(query) {
  const filtered = allAdminProducts.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.category.toLowerCase().includes(query.toLowerCase())
  );
  renderProductsTable(filtered);
}

// ===== UPLOAD & COMPRESSION D'IMAGES =====

// Tableau des images en cours (base64 ou URL)
let currentImages = [];

// Compresser une image via Canvas — max 800px, qualité 0.75
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Lecture impossible'));

    reader.onload = (e) => {
      const img = new Image();

      img.onerror = () => reject(new Error('Format non supporté (essayez JPG ou PNG)'));

      img.onload = () => {
        const MAX = 800;
        let { width, height } = img;

        // Redimensionner si nécessaire
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }

        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF'; // fond blanc pour PNG transparents
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Compresser jusqu'à ce que ça passe sous 400KB
        let quality = 0.78;
        let result  = canvas.toDataURL('image/jpeg', quality);

        // Si encore trop lourd, réduire la qualité
        while (result.length > 500000 && quality > 0.4) {
          quality -= 0.08;
          result = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(result);
      };

      img.src = e.target.result;
    };

    reader.readAsDataURL(file);
  });
}

async function handleImageFiles(files) {
  const remaining = 3 - currentImages.length;
  if (remaining <= 0) {
    showToast('Maximum 3 photos par produit', 'error');
    return;
  }

  const toProcess = Array.from(files).slice(0, remaining);

  // Afficher les placeholders de chargement
  toProcess.forEach(() => addLoadingPlaceholder());

  for (const file of toProcess) {
    // Vérifier le type — HEIC (iPhone) non supporté par Canvas
    if (!file.type.startsWith('image/') || file.type === 'image/heic' || file.type === 'image/heif') {
      removeLoadingPlaceholder();
      showToast('"' + file.name + '" : format non supporté. Convertissez en JPG ou PNG.', 'error');
      continue;
    }

    if (file.size > 15 * 1024 * 1024) {
      removeLoadingPlaceholder();
      showToast('"' + file.name + '" dépasse 15 MB. Réduisez la taille.', 'error');
      continue;
    }

    try {
      const base64 = await compressImage(file);
      removeLoadingPlaceholder();
      currentImages.push(base64);
      renderImagePreviews();
    } catch (err) {
      removeLoadingPlaceholder();
      showToast('"' + file.name + '" : ' + (err.message || 'Erreur de traitement'), 'error');
    }
  }

  // Réinitialiser l'input pour permettre de re-sélectionner le même fichier
  document.getElementById('pImagesFile').value = '';
}

function addLoadingPlaceholder() {
  const preview = document.getElementById('imagesPreview');
  const div = document.createElement('div');
  div.className = 'preview-loading';
  div.innerHTML = '<div class="spinner" style="width:24px;height:24px;border-width:2px;"></div><span>Compression…</span>';
  preview.appendChild(div);
}

function removeLoadingPlaceholder() {
  const ph = document.getElementById('imagesPreview').querySelector('.preview-loading');
  if (ph) ph.remove();
}

function renderImagePreviews() {
  const container = document.getElementById('imagesPreview');
  // Garder les placeholders de chargement
  const loaders = container.querySelectorAll('.preview-loading');

  // Supprimer uniquement les preview-item
  container.querySelectorAll('.preview-item').forEach(el => el.remove());

  currentImages.forEach((src, index) => {
    const div = document.createElement('div');
    div.className = 'preview-item';
    div.innerHTML = `
      <img src="${src}" alt="Photo ${index + 1}">
      ${index === 0 ? '<span class="preview-main-badge">Principale</span>' : ''}
      <button type="button" class="preview-remove" onclick="removeImage(${index})" title="Supprimer">✕</button>
    `;
    // Insérer avant les loaders
    if (loaders.length > 0) {
      container.insertBefore(div, loaders[0]);
    } else {
      container.appendChild(div);
    }
  });

  // Mettre à jour le compteur sur la zone
  const uploadZone = document.getElementById('uploadZone');
  const hint = uploadZone.querySelector('.upload-hint');
  const remaining = 3 - currentImages.length;
  hint.textContent = remaining > 0
    ? `${currentImages.length}/3 photo(s) · Encore ${remaining} possible${remaining > 1 ? 's' : ''}`
    : '3/3 photos · Maximum atteint';
}

function removeImage(index) {
  currentImages.splice(index, 1);
  renderImagePreviews();
}

// Drag & Drop sur la zone d'upload
function initUploadZone() {
  const zone = document.getElementById('uploadZone');
  if (!zone) return;

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });

  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleImageFiles(e.dataTransfer.files);
  });
}

// ===== FORMULAIRE PRODUIT =====
function openProductForm(productId) {
  document.getElementById('productForm').reset();
  document.getElementById('productId').value = '';
  currentImages = [];
  document.getElementById('imagesPreview').innerHTML = '';
  if (document.getElementById('pImagesUrl')) document.getElementById('pImagesUrl').value = '';

  // Réinitialiser le hint de la zone
  const hint = document.querySelector('#uploadZone .upload-hint');
  if (hint) hint.textContent = 'JPG, PNG, WEBP · Max 10 MB par image';

  if (productId) {
    const p = allAdminProducts.find(x => x.id === productId);
    if (!p) return;
    document.getElementById('productModalTitle').textContent = 'Modifier le produit';
    document.getElementById('productId').value = p.id;
    document.getElementById('pName').value = p.name;
    document.getElementById('pDesc').value = p.description || '';
    document.getElementById('pPrice').value = p.price;
    document.getElementById('pOriginalPrice').value = p.original_price || '';
    document.getElementById('pCategory').value = p.category;
    document.getElementById('pStock').value = p.stock;
    document.getElementById('pSizes').value = (p.sizes || []).join(', ');
    document.getElementById('pColors').value = (p.colors || []).join(', ');
    document.getElementById('pBadge').value = p.badge || '';
    document.getElementById('pActive').value = p.active ? '1' : '0';

    // Charger les images existantes
    currentImages = [...(p.images || [])];
    renderImagePreviews();
  } else {
    document.getElementById('productModalTitle').textContent = 'Nouveau produit';
  }

  initUploadZone();
  document.getElementById('productModal').classList.add('open');
}

function closeProductForm() {
  document.getElementById('productModal').classList.remove('open');
}

async function saveProduct(e) {
  e.preventDefault();
  const id = document.getElementById('productId').value;

  const sizes  = document.getElementById('pSizes').value.split(',').map(s => s.trim()).filter(Boolean);
  const colors = document.getElementById('pColors').value.split(',').map(c => c.trim()).filter(Boolean);

  // Fusionner : images uploadées + URLs manuelles
  const urlField = document.getElementById('pImagesUrl');
  const urlImages = urlField && urlField.value.trim()
    ? urlField.value.split('\n').map(u => u.trim()).filter(Boolean)
    : [];
  const images = [...currentImages, ...urlImages];

  if (images.length === 0) {
    showToast('Ajoutez au moins une photo', 'error');
    return;
  }

  const payload = {
    name:           document.getElementById('pName').value.trim(),
    description:    document.getElementById('pDesc').value.trim(),
    price:          parseInt(document.getElementById('pPrice').value),
    original_price: document.getElementById('pOriginalPrice').value
                      ? parseInt(document.getElementById('pOriginalPrice').value) : null,
    category:       document.getElementById('pCategory').value,
    sizes,
    colors,
    images,
    stock:          parseInt(document.getElementById('pStock').value) || 0,
    active:         document.getElementById('pActive').value === '1',
    badge:          document.getElementById('pBadge').value || null
  };

  const saveBtn = document.querySelector('#productModal .btn-save');
  if (saveBtn) { saveBtn.textContent = 'Enregistrement…'; saveBtn.disabled = true; }

  try {
    const url    = id ? '/api/admin/products/' + id : '/api/admin/products';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(payload) });

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Erreur', 'error');
      return;
    }

    showToast(id ? 'Produit mis à jour ✓' : 'Produit créé ✓', 'success');
    closeProductForm();
    loadAdminProducts();
  } catch {
    showToast('Erreur réseau', 'error');
  } finally {
    if (saveBtn) { saveBtn.textContent = 'Enregistrer'; saveBtn.disabled = false; }
  }
}

async function deleteProduct(id, name) {
  if (!confirm('Supprimer "' + name + '" ? Cette action est irréversible.')) return;

  try {
    const res = await fetch('/api/admin/products/' + id, { method: 'DELETE', headers: authHeaders() });
    if (res.ok) {
      showToast('Produit supprimé', 'success');
      loadAdminProducts();
    } else {
      showToast('Erreur lors de la suppression', 'error');
    }
  } catch {
    showToast('Erreur réseau', 'error');
  }
}

// ===== COMMANDES =====
async function loadOrders() {
  const filter = document.getElementById('ordersFilter').value;
  try {
    const url = '/api/admin/orders' + (filter ? '?status=' + encodeURIComponent(filter) : '');
    const res = await fetch(url, { headers: authHeaders() });
    if (res.status === 401) { logout(); return; }
    const orders = await res.json();
    renderOrdersTable(orders);
  } catch {
    showToast('Erreur de chargement', 'error');
  }
}

function renderOrdersTable(orders) {
  const tbody = document.getElementById('ordersTable');

  if (orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><div class="empty-state-icon">📦</div><p>Aucune commande</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = orders.map(o => {
    const itemsSummary = (o.items || []).map(i => i.name + (i.qty > 1 ? ' x' + i.qty : '')).join(', ');

    return `
      <tr>
        <td style="font-weight:700;">#${o.id}</td>
        <td>
          <div style="font-weight:600;">${escHtml(o.customer_name)}</div>
          <div style="font-size:12px;color:#888;">${escHtml(o.customer_phone)}</div>
        </td>
        <td style="max-width:160px;font-size:12px;color:#555;">${escHtml(itemsSummary)}</td>
        <td class="price-cell">${fmt(o.total)}</td>
        <td style="font-size:12px;">${escHtml(o.district)}</td>
        <td>
          <select class="status-select" onchange="updateOrderStatus(${o.id}, this.value)">
            ${['En attente', 'Confirmée', 'Expédiée', 'Livrée', 'Annulée'].map(s =>
              `<option ${s === o.status ? 'selected' : ''}>${s}</option>`
            ).join('')}
          </select>
        </td>
        <td style="font-size:12px;color:#888;">${formatDate(o.created_at)}</td>
        <td>
          <div class="actions-cell">
            <button class="btn-action btn-whatsapp-contact" onclick="contactClient('${escHtml(o.customer_phone)}', '${escHtml(o.customer_name)}')" title="Contacter via WhatsApp">💬</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function updateOrderStatus(orderId, status) {
  try {
    const res = await fetch('/api/admin/orders/' + orderId + '/status', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      showToast('Statut mis à jour : ' + status, 'success');
    } else {
      showToast('Erreur mise à jour', 'error');
    }
  } catch {
    showToast('Erreur réseau', 'error');
  }
}

function contactClient(phone, name) {
  // Formater le numéro CI
  let num = phone.replace(/\D/g, '');
  if (num.startsWith('0') && num.length === 10) {
    num = '225' + num;
  } else if (!num.startsWith('225')) {
    num = '225' + num;
  }
  const message = 'Bonjour ' + name + ', nous vous contactons concernant votre commande chez Lumière d\'Afrique. 🌟';
  window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(message), '_blank');
}

// ===== CODES PROMO =====
async function loadPromos() {
  try {
    const res = await fetch('/api/admin/promos', { headers: authHeaders() });
    if (res.status === 401) { logout(); return; }
    const promos = await res.json();
    renderPromosTable(promos);
  } catch {
    showToast('Erreur de chargement', 'error');
  }
}

function renderPromosTable(promos) {
  const tbody = document.getElementById('promosTable');

  if (promos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">🎟️</div><p>Aucun code promo</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = promos.map(p => {
    const value = p.type === 'percentage' ? p.value + '%' : fmt(p.value);
    const expired = p.expiry_date && new Date(p.expiry_date) < new Date();

    return `
      <tr>
        <td style="font-weight:700;font-family:monospace;font-size:15px;letter-spacing:1px;">${escHtml(p.code)}</td>
        <td>${p.type === 'percentage' ? 'Pourcentage' : 'Montant fixe'}</td>
        <td style="font-weight:700;color:var(--terracotta);">${value}</td>
        <td style="font-size:12px;color:#888;">${p.expiry_date ? p.expiry_date : 'Sans limite'}</td>
        <td>
          <span class="status-badge ${p.active && !expired ? 'status-active' : 'status-inactive'}">
            ${expired ? 'Expiré' : (p.active ? 'Actif' : 'Inactif')}
          </span>
        </td>
        <td>
          <button class="btn-action btn-toggle" onclick="togglePromo(${p.id})">
            ${p.active ? 'Désactiver' : 'Activer'}
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function openPromoForm() {
  document.getElementById('promoForm').reset();
  document.getElementById('promoModal').classList.add('open');
}

function closePromoForm() {
  document.getElementById('promoModal').classList.remove('open');
}

async function savePromo(e) {
  e.preventDefault();

  const payload = {
    code: document.getElementById('promoCode').value.trim().toUpperCase(),
    type: document.getElementById('promoType').value,
    value: parseInt(document.getElementById('promoValue').value),
    expiry_date: document.getElementById('promoExpiry').value || null
  };

  try {
    const res = await fetch('/api/admin/promos', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Erreur', 'error');
      return;
    }

    showToast('Code promo "' + payload.code + '" créé', 'success');
    closePromoForm();
    loadPromos();
  } catch {
    showToast('Erreur réseau', 'error');
  }
}

async function togglePromo(id) {
  try {
    const res = await fetch('/api/admin/promos/' + id + '/toggle', {
      method: 'PUT',
      headers: authHeaders()
    });
    if (res.ok) {
      showToast('Statut du code modifié', 'success');
      loadPromos();
    }
  } catch {
    showToast('Erreur réseau', 'error');
  }
}

// ===== EXPORT CSV COMMANDES =====
async function exportOrders() {
  try {
    const res = await fetch('/api/admin/orders/export', { headers: authHeaders() });
    if (!res.ok) { showToast('Erreur export', 'error'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'commandes-' + new Date().toISOString().split('T')[0] + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Export CSV téléchargé ✓', 'success');
  } catch {
    showToast('Erreur lors de l\'export', 'error');
  }
}

// ===== UTILITAIRES =====
function statusClass(status) {
  const map = {
    'En attente': 'status-en-attente',
    'Confirmée': 'status-confirmee',
    'Expédiée': 'status-expediee',
    'Livrée': 'status-livree',
    'Annulée': 'status-annulee'
  };
  return map[status] || '';
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function showToast(msg, type) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast ' + (type || '');
  toast.textContent = msg;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ===== INIT =====
(async () => {
  if (authToken) {
    const valid = await checkAuth();
    if (valid) {
      showApp();
    } else {
      localStorage.removeItem('adminToken');
      authToken = '';
    }
  }
})();

// Fermer modales avec Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeProductForm();
    closePromoForm();
  }
});
