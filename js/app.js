// App.js logic and state management

// Satus and data management
let DB = {
  ingredientes: [],
  formulas: [],
  ultimoRespaldo: null
};

function cargarDB() {
  try {
    const raw = localStorage.getItem('myalquimia_db');
    if (raw) DB = JSON.parse(raw);
  } catch(e) { console.error('Error cargando base de datos', e); }
}

function guardarDB() {
  localStorage.setItem('myalquimia_db', JSON.stringify(DB));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Navigation pages
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  const btns = document.querySelectorAll('nav button');
  const labels = ['dashboard','ingredientes','formulas','respaldo'];
  btns[labels.indexOf(name)].classList.add('active');
  renderAll();
}

// General render function to update all views
function renderAll() {
  renderDashboard();
  renderIngredientes();
  renderFormulas();
  checkBackupBanner();
}

function checkBackupBanner() {
  const banner = document.getElementById('backup-banner');
  if (!banner) return;
  if (!DB.ultimoRespaldo) { banner.style.display = 'flex'; return; }
  const diff = Date.now() - new Date(DB.ultimoRespaldo).getTime();
  banner.style.display = diff > 86400000 ? 'flex' : 'none';
}

// Dashboard overview with stats and quick actions
function renderDashboard() {
  document.getElementById('stat-ing').textContent = DB.ingredientes.length;
  document.getElementById('stat-form').textContent = DB.formulas.length;
  document.getElementById('stat-backup').textContent = DB.ultimoRespaldo
    ? new Date(DB.ultimoRespaldo).toLocaleDateString('es', {day:'2-digit', month:'short'})
    : '—';

  const cont = document.getElementById('dashboard-list');
  if (!DB.formulas.length) {
    cont.innerHTML = `<div class="empty-state"><div class="empty-icon">⚗️</div><h3>Sin fórmulas aún</h3><p>Crea recetas base en la pestaña Fórmulas para analizar sus costos.</p></div>`;
    return;
  }

  cont.innerHTML = DB.formulas.map(f => {
    let costo100g = 0;
    (f.ingredientes || []).forEach(fi => {
      const ing = DB.ingredientes.find(x => x.id === fi.ingId);
      if (ing) {
        const precioPorUnidad = ing.precio / (ing.cantidadCompra || 1);
        costo100g += fi.cantidad * precioPorUnidad;
      }
    });

    return `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">${f.nombre}</div>
          <div class="card-meta">${f.categoria || 'Sin categoría'} · Receta Base Estándar</div>
        </div>
        <button class="btn btn-brown btn-sm" onclick="abrirModalProduccion('${f.id}')">🧪 Escalar Lote</button>
      </div>
      <div class="cost-summary">
        <div class="cost-item"><div class="cost-label">Costo Referencial por cada 100 gramos</div><div class="cost-val">€${costo100g.toFixed(2)}</div></div>
      </div>
    </div>`;
  }).join('');
}

// Ingredients management: list, add, edit, delete
function renderIngredientes() {
  const tbody = document.getElementById('tabla-ingredientes');
  if (!DB.ingredientes.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">⚗️</div><h3>Sin ingredientes</h3><p>Agrega los ingredientes que compras para calcular costos.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = DB.ingredientes.map(i => {
    const cantCompra = parseFloat(i.cantidadCompra) || 1;
    const precioProrrateado = parseFloat(i.precio) / cantCompra;
    const moneda = i.moneda || '€';
    return `
    <tr>
      <td class="td-name">${i.nombre}</td>
      <td><span class="badge badge-brown">${cantCompra} ${i.unidad}</span></td>
      <td class="td-cost">
        ${moneda}${parseFloat(i.precio).toFixed(2)}
        <div style="font-size:0.72rem; color:var(--text-muted); font-weight:normal; margin-top:2px;">
          (${moneda}${precioProrrateado.toFixed(4)} / ${i.unidad})
        </div>
      </td>
      <td style="color:var(--text-muted)">${i.proveedor || '—'}</td>
      <td style="color:var(--text-muted); font-size:0.82rem">${i.notas || '—'}</td>
      <td><div class="td-actions">
        <button class="btn btn-outline btn-sm" onclick="editarIngrediente('${i.id}')">Editar</button>
        <button class="btn btn-danger" onclick="eliminarIngrediente('${i.id}')">Eliminar</button>
      </div></td>
    </tr>`;
  }).join('');
}

function abrirModalIngrediente(id) {
  limpiarModal('ing');
  if (id) {
    const i = DB.ingredientes.find(x => x.id === id);
    document.getElementById('modal-ing-title').textContent = 'Editar Ingrediente';
    document.getElementById('ing-edit-id').value = i.id;
    document.getElementById('ing-nombre').value = i.nombre;
    document.getElementById('ing-unidad').value = i.unidad;
    document.getElementById('ing-cantidad-compra').value = i.cantidadCompra || 1;
    document.getElementById('ing-precio').value = i.precio;
    document.getElementById('ing-moneda').value = i.moneda || '€';
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
  const cantidadCompra = parseFloat(document.getElementById('ing-cantidad-compra').value);
  
  if (!nombre) return mostrarError('ing', 'El nombre es obligatorio.');
  if (isNaN(cantidadCompra) || cantidadCompra <= 0) return mostrarError('ing', 'La cantidad del envase comprado debe ser mayor a 0.');
  if (isNaN(precio) || precio < 0) return mostrarError('ing', 'El precio debe ser un número válido.');

  const editId = document.getElementById('ing-edit-id').value;
  const data = {
    id: editId || uid(),
    nombre,
    unidad: document.getElementById('ing-unidad').value,
    cantidadCompra,
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
  if (!confirm(`¿Eliminar "${ing.nombre}"? Se removerá de las fórmulas existentes.`)) return;
  DB.ingredientes = DB.ingredientes.filter(x => x.id !== id);
  DB.formulas.forEach(f => {
    f.ingredientes = (f.ingredientes || []).filter(i => i.ingId !== id);
  });
  guardarDB();
  renderAll();
}

// Formulas management: list, add, edit, delete, and scaling for production
let formulaIngs = [];

function renderFormulas() {
  const cont = document.getElementById('lista-formulas');
  if (!DB.formulas.length) {
    cont.innerHTML = `<div class="empty-state"><div class="empty-icon">⚗️</div><h3>Sin fórmulas aún</h3><p>Haz clic en "+ Nueva Fórmula" para capturar una receta basada en 100g.</p></div>`;
    return;
  }
  cont.innerHTML = DB.formulas.map(f => {
    let costo100g = 0;
    const itemsHTML = (f.ingredientes || []).map(fi => {
      const ing = DB.ingredientes.find(x => x.id === fi.ingId);
      if (!ing) return '';
      const precioPorGramo = ing.precio / (ing.cantidadCompra || 1);
      const costoIng = fi.cantidad * precioPorGramo;
      costo100g += costoIng;

      return `<tr>
        <td>${ing.nombre}</td>
        <td><strong>${fi.cantidad} ${ing.unidad}</strong></td>
        <td style="text-align:right; color:var(--text-muted); font-size:0.85rem">${ing.moneda||'€'}${costoIng.toFixed(2)}</td>
      </tr>`;
    }).join('');

    return `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">${f.nombre}</div>
          <div class="card-meta">${f.categoria || 'Cosmética'} · Proporciones sobre Base fija de 100g</div>
        </div>
        <div class="btn-actions">
          <button class="btn btn-brown btn-sm" onclick="abrirModalProduccion('${f.id}')">🧪 Escalar Lote</button>
          <button class="btn btn-outline btn-sm" onclick="editarFormula('${f.id}')">Editar Receta</button>
          <button class="btn btn-danger" onclick="eliminarFormula('${f.id}')">Eliminar</button>
        </div>
      </div>
      <div class="table-wrap" style="margin-bottom:0.75rem;">
        <table>
          <thead>
            <tr>
              <th>Ingrediente</th>
              <th>Cantidad requerida para 100g totales</th>
              <th style="text-align:right">Costo Prorrateado</th>
            </tr>
          </thead>
          <tbody>${itemsHTML || '<tr><td colspan="3" style="color:var(--text-light)">Fórmula vacía.</td></tr>'}</tbody>
        </table>
      </div>
      <div class="cost-summary">
        <div class="cost-item"><div class="cost-label">Costo Total estimado por cada 100g de masa base</div><div class="cost-val">€${costo100g.toFixed(2)}</div></div>
      </div>
    </div>`;
  }).join('');
}

function abrirModalFormula(id) {
  formulaIngs = [];
  limpiarModal('form');

  if (id) {
    const f = DB.formulas.find(x => x.id === id);
    document.getElementById('modal-form-title').textContent = 'Editar Receta Base (100g)';
    document.getElementById('form-edit-id').value = f.id;
    document.getElementById('form-nombre').value = f.nombre;
    document.getElementById('form-categoria').value = f.categoria || '';
    document.getElementById('form-notas').value = f.notas || '';
    formulaIngs = JSON.parse(JSON.stringify(f.ingredientes || []));
  } else {
    document.getElementById('modal-form-title').textContent = 'Nueva Receta Base (100g)';
  }

  renderFormulaIngs();
  document.getElementById('modal-formula').classList.add('open');
}

function editarFormula(id) { abrirModalFormula(id); }

function agregarIngredienteFormula() {
  if (!DB.ingredientes.length) {
    alert('Primero debes registrar ingredientes en tu catálogo.');
    return;
  }
  formulaIngs.push({ ingId: DB.ingredientes[0].id, cantidad: 0 });
  renderFormulaIngs();
}

function renderFormulaIngs() {
  const cont = document.getElementById('formula-ingredientes-list');
  if (!formulaIngs.length) {
    cont.innerHTML = `<p style="font-size:0.85rem; color:var(--text-muted); padding:0.5rem 0.75rem;">Usa el botón inferior para vincular un ingrediente a la fórmula maestra de 100g.</p>`;
    actualizarPreviewReceta();
    return;
  }

  cont.innerHTML = formulaIngs.map((fi, idx) => {
    const ing = DB.ingredientes.find(x => x.id === fi.ingId);
    const precioPorGramo = ing ? (ing.precio / (ing.cantidadCompra || 1)) : 0;
    const costo100g = ing ? (fi.cantidad * precioPorGramo).toFixed(2) : '0.00';
    const moneda = ing ? (ing.moneda || '€') : '€';
    const opts = DB.ingredientes.map(i =>
      `<option value="${i.id}" ${i.id === fi.ingId ? 'selected' : ''}>${i.nombre} (${i.unidad})</option>`
    ).join('');

    return `<div class="ing-row" data-idx="${idx}">
      <select onchange="updateIngRow(${idx},'ingId',this.value)">${opts}</select>
      <input type="number" min="0" step="any" value="${fi.cantidad}" placeholder="Cant."
        onchange="updateIngRow(${idx},'amount',parseFloat(this.value)||0)">
      <span style="font-size:0.82rem; color:var(--text-muted)">${ing ? ing.unidad : ''}</span>
      <span class="calc-cost" id="cost-${idx}">${moneda}${costo100g}</span>
      <button class="ing-remove" onclick="quitarIngRow(${idx})">×</button>
    </div>`;
  }).join('');

  actualizarPreviewReceta();
}

function updateIngRow(idx, campo, val) {
  // Fix context sync from template input triggers
  const targetProperty = campo === 'amount' ? 'cantidad' : campo;
  formulaIngs[idx][targetProperty] = val;
  renderFormulaIngs();
}

function quitarIngRow(idx) {
  formulaIngs.splice(idx, 1);
  renderFormulaIngs();
}

function actualizarPreviewReceta() {
  let costo100g = 0;
  formulaIngs.forEach(fi => {
    const ing = DB.ingredientes.find(x => x.id === fi.ingId);
    if (ing) {
      costo100g += fi.cantidad * (ing.precio / (ing.cantidadCompra || 1));
    }
  });
  const prev = document.getElementById('formula-cost-preview');
  if (prev) {
    prev.style.display = formulaIngs.length ? 'flex' : 'none';
    document.getElementById('preview-total').textContent = '€' + costo100g.toFixed(2);
  }
}

function guardarFormula() {
  const nombre = document.getElementById('form-nombre').value.trim();
  if (!nombre) return mostrarError('form', 'El nombre del producto es obligatorio.');

  const editId = document.getElementById('form-edit-id').value;
  const data = {
    id: editId || uid(),
    nombre,
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
  if (!confirm('¿Seguro que deseas eliminar esta receta?')) return;
  DB.formulas = DB.formulas.filter(x => x.id !== id);
  guardarDB();
  renderAll();
}


// Production scaling and printout generation
function abrirModalProduccion(formulaPreseleccionadaId) {
  const select = document.getElementById('prod-formula-id');
  if (!DB.formulas.length) {
    alert('No tienes fórmulas registradas aún para escalar. Registra una primero.');
    return;
  }

  select.innerHTML = DB.formulas.map(f => `<option value="${f.id}">${f.nombre} [${f.categoria || 'Sin Cat.'}]</option>`).join('');

  if (formulaPreseleccionadaId) {
    select.value = formulaPreseleccionadaId;
  }

  document.getElementById('prod-peso-unidad').value = 7;
  document.getElementById('prod-unidades').value = 50;

  calcularEscalaProduccion();
  document.getElementById('modal-produccion').classList.add('open');
}

function calcularEscalaProduccion() {
  const formulaId = document.getElementById('prod-formula-id').value;
  const pesoUnidad = parseFloat(document.getElementById('prod-peso-unidad').value) || 0;
  const unidades = parseInt(document.getElementById('prod-unidades').value) || 0;

  const f = DB.formulas.find(x => x.id === formulaId);
  const tbody = document.getElementById('prod-tabla-ingredientes');

  if (!f) {
    tbody.innerHTML = '<tr><td colspan="4">Selecciona una fórmula válida.</td></tr>';
    return;
  }

  const masaTotalLote = pesoUnidad * unidades; 
  const factorEscala = masaTotalLote / 100;    
  let costoTotalLote = 0;

  const filasHTML = (f.ingredientes || []).map(fi => {
    const ing = DB.ingredientes.find(x => x.id === fi.ingId);
    if (!ing) return '';

    const precioPorGramo = ing.precio / (ing.cantidadCompra || 1);
    const cantidadLoteReal = fi.cantidad * factorEscala; 
    const costoLoteIng = cantidadLoteReal * precioPorGramo;
    costoTotalLote += costoLoteIng;

    return `<tr>
      <td><strong>${ing.nombre}</strong></td>
      <td style="color:var(--text-light); font-size:0.85rem;">${fi.cantidad} ${ing.unidad}</td>
      <td style="color:var(--green-deep);"><span style="font-size:1.1rem; font-weight:500;">${cantidadLoteReal.toFixed(2)}</span> ${ing.unidad}</td>
      <td style="text-align:right; font-weight:500;">€${costoLoteIng.toFixed(2)}</td>
    </tr>`;
  }).join('');

  tbody.innerHTML = filasHTML || '<tr><td colspan="4" style="color:var(--text-light)">Esta fórmula no tiene ingredientes asignados.</td></tr>';

  document.getElementById('prod-total-peso-lote').textContent = masaTotalLote.toFixed(1) + ' g/ml';
  document.getElementById('prod-costo-total-lote').textContent = '€' + costoTotalLote.toFixed(2);
  
  const costoIndividualUnitario = unidades > 0 ? (costoTotalLote / unidades) : 0;
  document.getElementById('prod-costo-unitario').textContent = '€' + costoIndividualUnitario.toFixed(2);
  
  document.getElementById('prod-titulo-lote').textContent = `Hoja de Pesaje: ${unidades} uds × ${pesoUnidad}g = Lote de ${masaTotalLote.toFixed(1)}g totales`;
}

function imprimirLoteActual() {
  const formulaId = document.getElementById('prod-formula-id').value;
  const pesoUnidad = parseFloat(document.getElementById('prod-peso-unidad').value) || 0;
  const unidades = parseInt(document.getElementById('prod-unidades').value) || 0;
  const f = DB.formulas.find(x => x.id === formulaId);

  if (!f) return;

  const masaTotalLote = pesoUnidad * unidades;
  const factorEscala = masaTotalLote / 100;
  let costoTotalLote = 0;

  const filasHTML = (f.ingredientes || []).map(fi => {
    const ing = DB.ingredientes.find(x => x.id === fi.ingId);
    if (!ing) return '';
    const cantidadLoteReal = fi.cantidad * factorEscala;
    const costoLoteIng = cantidadLoteReal * (ing.precio / (ing.cantidadCompra || 1));
    costoTotalLote += costoLoteIng;

    return `<tr>
      <td>${ing.nombre}</td>
      <td>${fi.cantidad} ${ing.unidad}</td>
      <td style="font-size:1.2rem;"><strong>${cantidadLoteReal.toFixed(2)} ${ing.unidad}</strong></td>
      <td>€${costoLoteIng.toFixed(2)}</td>
    </tr>`;
  }).join('');

  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><title>Ficha de Fabricación — ${f.nombre}</title>
    <style>
      body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 2.5rem; color: #2C2416; background:#fff; }
      h1 { color: #1B4D2E; margin-bottom: 4px; font-size:1.8rem; }
      h2 { color: #6B4A1E; font-size: 1.1rem; font-weight: normal; margin-top:0; margin-bottom: 25px; border-bottom:2px solid #EDE6D6; padding-bottom:10px;}
      table { width:100%; border-collapse:collapse; margin-top:1.5rem; }
      th { background:#EDE6D6; padding:0.6rem; text-align:left; font-size:0.8rem; text-transform:uppercase; letter-spacing:0.05em; }
      td { padding:0.7rem; border-bottom:1px solid #E8E0CC; }
      .totales { margin-top:2rem; background:#1B4D2E; color:#fff; padding:1.2rem; border-radius:8px; display:flex; justify-content:space-between; }
      .tot-val { font-size:1.4rem; font-weight:bold; margin-top:4px; }
      .tot-label { font-size:0.75rem; text-transform:uppercase; opacity:0.8; }
      @media print { button { display:none; } }
    </style></head><body>
    <h1>ORDEN DE FABRICACIÓN: ${f.nombre}</h1>
    <h2>Categoría: ${f.categoria || 'General'} · Tamaño del lote: ${unidades} unidades de ${pesoUnidad}g (Masa total a pesar: ${masaTotalLote.toFixed(1)}g)</h2>
    <p><em>Instrucciones: Pese en báscula digital las cantidades de la tercera columna. Las proporciones han sido escaladas automáticamente desde la receta base de 100g.</em></p>
    <table>
      <thead>
        <tr>
          <th>Ingrediente</th>
          <th>Proporción Base (100g)</th>
          <th>CANTIDAD NETO A PESAR</th>
          <th>Costo Proporcional</th>
        </tr>
      </thead>
      <tbody>${filasHTML}</tbody>
    </table>
    <div class="totales">
      <div><div class="tot-label">Masa Total Fabricada</div><div class="tot-val">${masaTotalLote.toFixed(1)} g</div></div>
      <div><div class="tot-label">Costo Lote Total</div><div class="tot-val">€${costoTotalLote.toFixed(2)}</div></div>
      <div><div class="tot-label">Costo Unitario Final</div><div class="tot-val">€${(unidades > 0 ? costoTotalLote/unidades : 0).toFixed(2)}</div></div>
    </div>
    <br><br><button onclick="window.print()" style="padding:10px 20px; background:#6B4A1E; color:#fff; border:none; border-radius:4px; cursor:pointer;">🖨 Imprimir Hoja de Laboratorio</button>
    </body></html>`);
  win.document.close();
}


// Export and Import JSON for backup and sync, plus CSV exports for spreadsheets
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
    msg.innerHTML = '<div class="alert alert-success">✓ Respaldo generado. Descárgalo y muévelo a tu carpeta de iCloud.</div>';
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
      if (!data.ingredientes || !data.formulas) throw new Error('Formato no válido');
      if (!confirm('¿Importar respaldo? Esto sobreescribirá los datos locales actuales.')) return;
      DB = data;
      guardarDB();
      renderAll();
      document.getElementById('import-msg').innerHTML = `<div class="alert alert-success">✓ Sincronizado: ${data.ingredientes.length} ingredientes y ${data.formulas.length} fórmulas restauradas.</div>`;
    } catch(err) {
      document.getElementById('import-msg').innerHTML = '<div class="alert alert-error">Error: El archivo JSON no es válido.</div>';
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function exportarIngredientesCSV() {
  if (!DB.ingredientes.length) { alert('No hay ingredientes para exportar.'); return; }
  const headers = ['Nombre','Unidad','Cantidad Envase','Precio Envase','Moneda','Proveedor','Notas'];
  const rows = DB.ingredientes.map(i => [i.nombre, i.unidad, i.cantidadCompra||1, i.precio, i.moneda||'€', i.proveedor||'', i.notas||'']);
  descargarCSV('MyAlquimia_ingredientes.csv', headers, rows);
}

function exportarFormulasCSV() {
  if (!DB.formulas.length) { alert('No hay fórmulas para exportar.'); return; }
  const headers = ['Producto','Categoría','Notas','Composición (Ingrediente:Cantidad)'];
  const rows = DB.formulas.map(f => {
    const ings = (f.ingredientes||[]).map(fi => {
      const ing = DB.ingredientes.find(x => x.id === fi.ingId);
      return ing ? `${ing.nombre}:${fi.cantidad}${ing.unidad}` : '';
    }).join(' | ');
    return [f.nombre, f.categoria||'', f.notas||'', ings];
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

// Utilities for modal management and form handling
function cerrarModal(id) {
  document.getElementById(id).classList.remove('open');
}

function limpiarModal(prefix) {
  ['nombre','proveedor','notes','precio','categoria','cantidad-compra','notas'].forEach(f => {
    const el = document.getElementById(prefix+'-'+f);
    if (el) el.value = '';
  });
  const editId = document.getElementById(prefix+'-edit-id');
  if (editId) editId.value = '';
  const err = document.getElementById(prefix+'-error');
  if (err) err.style.display = 'none';
  if (prefix === 'ing') document.getElementById('ing-cantidad-compra').value = 1;
}

function mostrarError(prefix, msg) {
  const el = document.getElementById(prefix+'-error');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 4000);
}


// Pipeline DOM ready: load DB, render initial view, and setup global event listeners
document.addEventListener('DOMContentLoaded', () => {
  // 1. DB Initialization and initial render
  cargarDB();
  renderAll();

  // 2. Global event listener for closing modals when clicking outside the content area
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  // 3. Intro animation sequence: olive branch reveal, cascading text, fade out, and slide up to dashboard
  const intro = document.querySelector('.intro');
  const logoSpans = document.querySelectorAll('.logo-header .logo'); 
  const plantArt = document.querySelector('.botanical-art');

  if (intro) {
    // Olive branch bloom animation
    setTimeout(() => {
      if (plantArt) plantArt.classList.add('bloom');
    }, 100);

    // Header text cascade animation
    setTimeout(() => {
      logoSpans.forEach((span, idx) => {
        setTimeout(() => {
          span.classList.add('active');
        }, (idx + 1) * 220);
      });
    }, 300);

    // Fade out text after a delay, preparing for the slide up
    setTimeout(() => {
      logoSpans.forEach((span, idx) => {
        setTimeout(() => {
          span.classList.remove('active');
          span.classList.add('fade');
        }, idx * 70);
      });
    }, 4600);

    // Slide up the intro container to reveal the dashboard after the fade out completes
    setTimeout(() => {
      intro.classList.add('slide-up');
    }, 5000);
  }
});