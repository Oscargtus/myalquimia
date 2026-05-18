// ═══════════════════════════════════════════
// MYALQUIMIA — LÓGICA DE APLICACIÓN
// ═══════════════════════════════════════════

// ── ESTADO Y STORAGE ──
let DB = {
  ingredientes: [],
  formulas: [],
  ultimoRespaldo: null
};

function cargarDB() {
  try {
    const raw = localStorage.getItem('myalquimia_db');
    if (raw) DB = JSON.parse(raw);
  } catch(e) { console.error('Error cargando datos', e); }
}

function guardarDB() {
  localStorage.setItem('myalquimia_db', JSON.stringify(DB));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ── NAVEGACIÓN ──
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  const btns = document.querySelectorAll('nav button');
  const labels = ['dashboard','ingredientes','formulas','respaldo'];
  btns[labels.indexOf(name)].classList.add('active');
  renderAll();
}

// ── RENDER GENERAL ──
function renderAll() {
  renderDashboard();
  renderIngredientes();
  renderFormulas();
  checkBackupBanner();
}

function checkBackupBanner() {
  const banner = document.getElementById('backup-banner');
  if (!DB.ultimoRespaldo) { banner.style.display = 'flex'; return; }
  const diff = Date.now() - new Date(DB.ultimoRespaldo).getTime();
  banner.style.display = diff > 86400000 ? 'flex' : 'none';
}

// ── DASHBOARD ──
function renderDashboard() {
  document.getElementById('stat-ing').textContent = DB.ingredientes.length;
  document.getElementById('stat-form').textContent = DB.formulas.length;
  document.getElementById('stat-backup').textContent = DB.ultimoRespaldo
    ? new Date(DB.ultimoRespaldo).toLocaleDateString('es', {day:'2-digit', month:'short'})
    : '—';

  const cont = document.getElementById('dashboard-list');
  if (!DB.formulas.length) {
    cont.innerHTML = `<div class="empty-state"><div class="empty-icon">⚗️</div><h3>Sin fórmulas aún</h3><p>Agrega ingredientes y crea tu primera fórmula.</p></div>`;
    return;
  }

  cont.innerHTML = DB.formulas.map(f => {
    const costos = calcularCostos(f);
    return `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">${f.nombre}</div>
          <div class="card-meta">${f.categoria || 'Sin categoría'} · ${f.pesoUnidad || 10}g por unidad · ${f.lote} uds</div>
        </div>
        <span class="badge badge-green">Activo</span>
      </div>
      <div class="cost-summary">
        <div class="cost-item"><div class="cost-label">Costo / 100g</div><div class="cost-val">${fmtMoney(costos.costo100g)}</div></div>
        <div class="cost-item"><div class="cost-label">Costo unitario</div><div class="cost-val">${fmtMoney(costos.unitario)}</div></div>
        <div class="cost-item"><div class="cost-label">Costo lote</div><div class="cost-val">${fmtMoney(costos.total)}</div></div>
        <div class="cost-item"><div class="cost-label">Unidades</div><div class="cost-val">${f.lote}</div></div>
      </div>
    </div>`;
  }).join('');
}

// ── INGREDIENTES ──
function renderIngredientes() {
  const tbody = document.getElementById('tabla-ingredientes');
  if (!DB.ingredientes.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">⚗️</div><h3>Sin ingredientes</h3><p>Agrega tu primer ingrediente.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = DB.ingredientes.map(i => `
    <tr>
      <td class="td-name">${i.nombre}</td>
      <td><span class="badge badge-brown">${i.unidad}</span></td>
      <td class="td-cost">${i.moneda || '$'}${parseFloat(i.precio).toFixed(2)}</td>
      <td style="color:var(--text-muted)">${i.proveedor || '—'}</td>
      <td style="color:var(--text-muted); font-size:0.82rem">${i.notas || '—'}</td>
      <td><div class="td-actions">
        <button class="btn btn-outline btn-sm" onclick="editarIngrediente('${i.id}')">Editar</button>
        <button class="btn btn-danger" onclick="eliminarIngrediente('${i.id}')">Eliminar</button>
      </div></td>
    </tr>`).join('');
}

function abrirModalIngrediente(id) {
  limpiarModal('ing');
  if (id) {
    const i = DB.ingredientes.find(x => x.id === id);
    document.getElementById('modal-ing-title').textContent = 'Editar Ingrediente';
    document.getElementById('ing-edit-id').value = i.id;
    document.getElementById('ing-nombre').value = i.nombre;
    document.getElementById('ing-unidad').value = i.unidad;
    document.getElementById('ing-precio').value = i.precio;
    document.getElementById('ing-moneda').value = i.moneda || '$';
    document.getElementById('ing-proveedor').value = i.proveedor || '';
    document.getElementById('ing-notas').value = i.notas || '';
  } else {
    document.getElementById('modal-ing-title').textContent = 'Nuevo Ingrediente';
  }
  document.getElementById('modal-ingrediente').classList.add('open');
}

function editarIngrediente(id) { abrirModalIngrediente(id); }

function guardarIngrediente() {
  const nombre = document.getElementById('ing-nombre').value.trim();
  const precio = parseFloat(document.getElementById('ing-precio').value);
  if (!nombre) return mostrarError('ing', 'El nombre es obligatorio.');
  if (isNaN(precio) || precio < 0) return mostrarError('ing', 'Ingresa un precio válido.');

  const editId = document.getElementById('ing-edit-id').value;
  const data = {
    id: editId || uid(),
    nombre,
    unidad: document.getElementById('ing-unidad').value,
    precio,
    moneda: document.getElementById('ing-moneda').value,
    proveedor: document.getElementById('ing-proveedor').value.trim(),
    notas: document.getElementById('ing-notas').value.trim()
  };

  if (editId) {
    const idx = DB.ingredientes.findIndex(x => x.id === editId);
    DB.ingredientes[idx] = data;
  } else {
    DB.ingredientes.push(data);
  }

  guardarDB();
  cerrarModal('modal-ingrediente');
  renderAll();
}

function eliminarIngrediente(id) {
  const ing = DB.ingredientes.find(x => x.id === id);
  if (!confirm(`¿Eliminar "${ing.nombre}"? Se quitará de todas las fórmulas.`)) return;
  DB.ingredientes = DB.ingredientes.filter(x => x.id !== id);
  DB.formulas.forEach(f => {
    f.ingredientes = (f.ingredientes || []).filter(i => i.ingId !== id);
  });
  guardarDB();
  renderAll();
}

// ── FÓRMULAS ──
let formulaIngs = [];

function renderFormulas() {
  const cont = document.getElementById('lista-formulas');
  if (!DB.formulas.length) {
    cont.innerHTML = `<div class="empty-state"><div class="empty-icon">⚗️</div><h3>Sin fórmulas aún</h3><p>Crea tu primera fórmula cosmética.</p></div>`;
    return;
  }
  cont.innerHTML = DB.formulas.map(f => {
    const costos = calcularCostos(f);
    const ings = (f.ingredientes || []).map(fi => {
      const ing = DB.ingredientes.find(x => x.id === fi.ingId);
      if (!ing) return '';
      const c = fi.cantidad * ing.precio;
      return `<tr>
        <td>${ing.nombre}</td>
        <td>${fi.cantidad} ${ing.unidad}</td>
        <td style="text-align:right; color:var(--brown); font-weight:500">${ing.moneda||'$'}${c.toFixed(2)}</td>
      </tr>`;
    }).join('');

    return `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">${f.nombre}</div>
          <div class="card-meta">${f.categoria || 'Sin categoría'} · Base 100g · ${f.pesoUnidad || 10}g por unidad · ${f.lote} uds${f.notas ? ' · ' + f.notas : ''}</div>
        </div>
        <div class="btn-actions">
          <button class="btn btn-outline btn-sm" onclick="imprimirFormula('${f.id}')">🖨</button>
          <button class="btn btn-outline btn-sm" onclick="editarFormula('${f.id}')">Editar</button>
          <button class="btn btn-danger" onclick="eliminarFormula('${f.id}')">Eliminar</button>
        </div>
      </div>
      ${ings ? `<div class="table-wrap" style="margin-bottom:0.75rem;">
        <table>
          <thead><tr><th>Ingrediente</th><th>Cantidad en 100g</th><th style="text-align:right">Costo</th></tr></thead>
          <tbody>${ings}</tbody>
        </table>
      </div>` : '<p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:0.75rem;">Sin ingredientes aún.</p>'}
      <div class="cost-summary">
        <div class="cost-item"><div class="cost-label">Costo / 100g</div><div class="cost-val">${fmtMoney(costos.costo100g)}</div></div>
        <div class="cost-item"><div class="cost-label">Costo unitario</div><div class="cost-val">${fmtMoney(costos.unitario)}</div></div>
        <div class="cost-item"><div class="cost-label">Costo lote</div><div class="cost-val">${fmtMoney(costos.total)}</div></div>
        <div class="cost-item"><div class="cost-label">Unidades</div><div class="cost-val">${f.lote}</div></div>
      </div>
    </div>`;
  }).join('');
}

function calcularCostos(f) {
  let costo100g = 0;
  (f.ingredientes || []).forEach(fi => {
    const ing = DB.ingredientes.find(x => x.id === fi.ingId);
    if (ing) costo100g += fi.cantidad * ing.precio;
  });
  const pesoUnidad = parseFloat(f.pesoUnidad) || 10;
  const lote = parseInt(f.lote) || 50;
  const unitario = (costo100g / 100) * pesoUnidad;
  const total = unitario * lote;
  return { costo100g, unitario, total, lote, pesoUnidad };
}

function fmtMoney(n) {
  return '$' + n.toFixed(2);
}

function abrirModalFormula(id) {
  formulaIngs = [];
  limpiarModal('form');

  if (id) {
    const f = DB.formulas.find(x => x.id === id);
    document.getElementById('modal-form-title').textContent = 'Editar Fórmula';
    document.getElementById('form-edit-id').value = f.id;
    document.getElementById('form-nombre').value = f.nombre;
    document.getElementById('form-lote').value = f.lote;
    document.getElementById('form-peso').value = f.pesoUnidad || 10;
    document.getElementById('form-categoria').value = f.categoria || '';
    document.getElementById('form-notas').value = f.notas || '';
    formulaIngs = JSON.parse(JSON.stringify(f.ingredientes || []));
  } else {
    document.getElementById('modal-form-title').textContent = 'Nueva Fórmula';
  }

  renderFormulaIngs();
  document.getElementById('modal-formula').classList.add('open');
}

function editarFormula(id) { abrirModalFormula(id); }

function agregarIngredienteFormula() {
  if (!DB.ingredientes.length) {
    alert('Primero agrega ingredientes al catálogo.');
    return;
  }
  formulaIngs.push({ ingId: DB.ingredientes[0].id, cantidad: 0 });
  renderFormulaIngs();
}

function renderFormulaIngs() {
  const cont = document.getElementById('formula-ingredientes-list');
  if (!formulaIngs.length) {
    cont.innerHTML = `<p style="font-size:0.85rem; color:var(--text-muted); padding:0.5rem 0.75rem;">Sin ingredientes. Agrega uno.</p>`;
    actualizarPreview();
    return;
  }

  cont.innerHTML = formulaIngs.map((fi, idx) => {
    const ing = DB.ingredientes.find(x => x.id === fi.ingId);
    const costo = ing ? (fi.cantidad * ing.precio).toFixed(2) : '0.00';
    const moneda = ing ? (ing.moneda || '$') : '$';
    const opts = DB.ingredientes.map(i =>
      `<option value="${i.id}" ${i.id === fi.ingId ? 'selected' : ''}>${i.nombre} (${i.unidad})</option>`
    ).join('');

    return `<div class="ing-row" data-idx="${idx}">
      <select onchange="updateIngRow(${idx},'ingId',this.value)">${opts}</select>
      <input type="number" min="0" step="0.001" value="${fi.cantidad}" placeholder="0"
        onchange="updateIngRow(${idx},'cantidad',parseFloat(this.value)||0)">
      <span style="font-size:0.82rem; color:var(--text-muted)">${ing ? ing.unidad : ''}</span>
      <span class="calc-cost" id="cost-${idx}">${moneda}${costo}</span>
      <button class="ing-remove" onclick="quitarIngRow(${idx})" title="Quitar">×</button>
    </div>`;
  }).join('');

  actualizarPreview();
}

function updateIngRow(idx, campo, val) {
  formulaIngs[idx][campo] = val;
  renderFormulaIngs();
}

function quitarIngRow(idx) {
  formulaIngs.splice(idx, 1);
  renderFormulaIngs();
}

function actualizarPreview() {
  const lote = parseInt(document.getElementById('form-lote').value) || 50;
  const peso = parseFloat(document.getElementById('form-peso').value) || 10;
  let costo100g = 0;
  formulaIngs.forEach(fi => {
    const ing = DB.ingredientes.find(x => x.id === fi.ingId);
    if (ing) costo100g += fi.cantidad * ing.precio;
  });
  const unitario = (costo100g / 100) * peso;
  const loteTotal = unitario * lote;
  const prev = document.getElementById('formula-cost-preview');
  prev.style.display = formulaIngs.length ? 'flex' : 'none';
  document.getElementById('preview-total').textContent = fmtMoney(costo100g);
  document.getElementById('preview-peso').textContent = peso + 'g';
  document.getElementById('preview-unit-cost').textContent = fmtMoney(unitario);
  document.getElementById('preview-lote-total').textContent = fmtMoney(loteTotal);
  document.getElementById('preview-units').textContent = lote;
}

function guardarFormula() {
  const nombre = document.getElementById('form-nombre').value.trim();
  const lote = parseInt(document.getElementById('form-lote').value);
  const pesoUnidad = parseFloat(document.getElementById('form-peso').value);
  if (!nombre) return mostrarError('form', 'El nombre del producto es obligatorio.');
  if (!lote || lote < 1) return mostrarError('form', 'Las unidades a producir deben ser al menos 1.');
  if (!pesoUnidad || pesoUnidad <= 0) return mostrarError('form', 'El peso por unidad debe ser mayor a 0.');

  const editId = document.getElementById('form-edit-id').value;
  const data = {
    id: editId || uid(),
    nombre,
    lote,
    pesoUnidad,
    categoria: document.getElementById('form-categoria').value.trim(),
    notas: document.getElementById('form-notas').value.trim(),
    ingredientes: formulaIngs.map(fi => ({ ingId: fi.ingId, cantidad: fi.cantidad }))
  };

  if (editId) {
    const idx = DB.formulas.findIndex(x => x.id === editId);
    DB.formulas[idx] = data;
  } else {
    DB.formulas.push(data);
  }

  guardarDB();
  cerrarModal('modal-formula');
  renderAll();
}

function eliminarFormula(id) {
  const f = DB.formulas.find(x => x.id === id);
  if (!confirm(`¿Eliminar la fórmula "${f.nombre}"?`)) return;
  DB.formulas = DB.formulas.filter(x => x.id !== id);
  guardarDB();
  renderAll();
}

function imprimirFormula(id) {
  const f = DB.formulas.find(x => x.id === id);
  const costos = calcularCostos(f);
  const ings = (f.ingredientes || []).map(fi => {
    const ing = DB.ingredientes.find(x => x.id === fi.ingId);
    if (!ing) return '';
    return `<tr><td>${ing.nombre}</td><td>${fi.cantidad} ${ing.unidad}</td><td>${ing.moneda||'$'}${(fi.cantidad*ing.precio).toFixed(2)}</td></tr>`;
  }).join('');

  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><title>${f.nombre}</title>
    <style>
      body { font-family: Georgia, serif; padding: 2rem; color: #2C2416; }
      h1 { color: #1B4D2E; font-size: 1.5rem; }
      h2 { color: #6B4A1E; font-size: 1rem; font-weight: normal; margin-top:0; }
      table { width:100%; border-collapse:collapse; margin-top:1rem; }
      th { background:#EDE6D6; padding:0.5rem; text-align:left; font-size:0.8rem; text-transform:uppercase; letter-spacing:0.05em; }
      td { padding:0.5rem; border-bottom:1px solid #E8E0CC; }
      .totales { margin-top:1.5rem; background:#1B4D2E; color:#fff; padding:1rem; border-radius:8px; display:flex; gap:2rem; flex-wrap:wrap; }
      .tot-item { text-align:center; }
      .tot-label { font-size:0.7rem; text-transform:uppercase; opacity:0.75; }
      .tot-val { font-size:1.5rem; }
      @media print { button { display:none; } }
    </style></head><body>
    <h1>${f.nombre}</h1>
    <h2>${f.categoria || ''} · Base 100g · ${f.pesoUnidad || 10}g por unidad · ${f.lote} unidades</h2>
    <table>
      <thead><tr><th>Ingrediente</th><th>Cantidad en 100g</th><th>Costo</th></tr></thead>
      <tbody>${ings}</tbody>
    </table>
    <div class="totales">
      <div class="tot-item"><div class="tot-label">Costo / 100g</div><div class="tot-val">${fmtMoney(costos.costo100g)}</div></div>
      <div class="tot-item"><div class="tot-label">Costo unitario</div><div class="tot-val">${fmtMoney(costos.unitario)}</div></div>
      <div class="tot-item"><div class="tot-label">Costo lote</div><div class="tot-val">${fmtMoney(costos.total)}</div></div>
      <div class="tot-item"><div class="tot-label">Unidades</div><div class="tot-val">${f.lote}</div></div>
    </div>
    <br><button onclick="window.print()">🖨 Imprimir</button>
    </body></html>`);
  win.document.close();
}

// ── EXPORT / IMPORT ──
function exportarJSON() {
  DB.ultimoRespaldo = new Date().toISOString();
  guardarDB();
  const fecha = new Date().toISOString().split('T')[0];
  const blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `MyAlquimia_respaldo_${fecha}.json`;
  a.click();
  URL.revokeObjectURL(url);
  const msg = document.getElementById('export-msg');
  if (msg) {
    msg.innerHTML = '<div class="alert alert-success">✓ Archivo descargado. Guárdalo en Documents → MyAlquimia → iCloud</div>';
    setTimeout(() => msg.innerHTML = '', 5000);
  }
  renderAll();
}

function importarJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.ingredientes || !data.formulas) throw new Error('Formato inválido');
      if (!confirm('¿Importar estos datos? Los datos actuales serán reemplazados.')) return;
      DB = data;
      guardarDB();
      renderAll();
      const msg = document.getElementById('import-msg');
      msg.innerHTML = `<div class="alert alert-success">✓ ${data.ingredientes.length} ingredientes y ${data.formulas.length} fórmulas importados.</div>`;
      setTimeout(() => msg.innerHTML = '', 5000);
    } catch(err) {
      document.getElementById('import-msg').innerHTML = '<div class="alert alert-error">Error: archivo JSON inválido o corrupto.</div>';
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function exportarIngredientesCSV() {
  if (!DB.ingredientes.length) { alert('No hay ingredientes para exportar.'); return; }
  const headers = ['Nombre','Unidad','Precio','Moneda','Proveedor','Notas'];
  const rows = DB.ingredientes.map(i => [i.nombre, i.unidad, i.precio, i.moneda||'$', i.proveedor||'', i.notas||'']);
  descargarCSV('MyAlquimia_ingredientes.csv', headers, rows);
}

function exportarFormulasCSV() {
  if (!DB.formulas.length) { alert('No hay fórmulas para exportar.'); return; }
  const headers = ['Producto','Categoría','Peso Unidad (g)','Lote','Costo 100g','Costo Unitario','Costo Lote','Ingredientes'];
  const rows = DB.formulas.map(f => {
    const c = calcularCostos(f);
    const ings = (f.ingredientes||[]).map(fi => {
      const ing = DB.ingredientes.find(x => x.id === fi.ingId);
      return ing ? `${ing.nombre}:${fi.cantidad}${ing.unidad}` : '';
    }).join(' | ');
    return [f.nombre, f.categoria||'', f.pesoUnidad||10, f.lote, c.costo100g.toFixed(2), c.unitario.toFixed(2), c.total.toFixed(2), ings];
  });
  descargarCSV('MyAlquimia_formulas.csv', headers, rows);
}

function descargarCSV(filename, headers, rows) {
  const csvRows = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));
  const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── UTILIDADES MODAL ──
function cerrarModal(id) {
  document.getElementById(id).classList.remove('open');
}

function limpiarModal(prefix) {
  ['nombre','proveedor','notas','precio','categoria'].forEach(f => {
    const el = document.getElementById(prefix+'-'+f);
    if (el) el.value = '';
  });
  const editId = document.getElementById(prefix+'-edit-id');
  if (editId) editId.value = '';
  const err = document.getElementById(prefix+'-error');
  if (err) err.style.display = 'none';
  if (prefix === 'form') {
    document.getElementById('form-lote').value = 50;
    document.getElementById('form-peso').value = 10;
    document.getElementById('formula-cost-preview').style.display = 'none';
  }
}

function mostrarError(prefix, msg) {
  const el = document.getElementById(prefix+'-error');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 4000);
}

// Cerrar modal al clic fuera
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// Listeners de preview en tiempo real
document.getElementById('form-peso').addEventListener('input', actualizarPreview);
document.getElementById('form-lote').addEventListener('input', actualizarPreview);

// ── LOGO ──
function intentarCargarLogo() {
  const img = document.getElementById('header-logo');
  const posibles = ['myalquimia.png', 'Myalquimia.png', 'MyAlquimia.png', 'logo.png'];
  let idx = 0;
  function intentar() {
    if (idx >= posibles.length) { img.style.display = 'none'; return; }
    img.src = posibles[idx];
    img.onerror = () => { idx++; intentar(); };
    img.onload = () => { img.style.display = 'block'; };
  }
  intentar();
}

// ── INIT ──
cargarDB();
intentarCargarLogo();
renderAll();
