// ArmaTuPC - lógica de la página

// ---------------- Datos fijos ----------------
const CATEGORIAS = [
  { id: 'cpu', nombre: 'Procesador', icono: '🧠', ayuda: 'Es el cerebro de la PC. Define qué motherboard podés usar (socket).', obligatorio: true },
  { id: 'mother', nombre: 'Motherboard', icono: '🔌', ayuda: 'Une todo. Tiene que tener el mismo socket que el procesador y el mismo tipo de RAM.', obligatorio: true },
  { id: 'ram', nombre: 'Memoria RAM', icono: '📏', ayuda: 'Para juegos hoy se recomiendan 16 GB o más.', obligatorio: true },
  { id: 'gpu', nombre: 'Placa de video', icono: '🎮', ayuda: 'Es la que más importa para jugar. Sin placa, el procesador tiene que tener gráficos integrados.', obligatorio: false },
  { id: 'almacenamiento', nombre: 'Almacenamiento', icono: '💾', ayuda: 'Un SSD NVMe hace que todo cargue mucho más rápido.', obligatorio: true },
  { id: 'fuente', nombre: 'Fuente', icono: '⚡', ayuda: 'Le da energía a todo. Calculamos cuántos watts necesitás.', obligatorio: true },
  { id: 'gabinete', nombre: 'Gabinete', icono: '🗄️', ayuda: 'Tiene que entrar la motherboard y la placa de video.', obligatorio: true },
  { id: 'cooler', nombre: 'Cooler CPU', icono: '❄️', ayuda: 'Algunos procesadores no traen cooler y hay que comprarlo aparte.', obligatorio: true }
];

const PROVINCIAS = ['Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'];
const CIUDADES_SUGERIDAS = ['Olavarría', 'Azul', 'Tandil', 'Bahía Blanca', 'Mar del Plata', 'La Plata', 'Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza'];

// Tiendas locales conocidas por ciudad (se pueden agregar más)
const TIENDAS_LOCALES = {
  'olavarria': { id: 'olanet', nombre: 'Olanet', direccion: 'Av. Pringles 3409, Olavarría', web: 'https://olanet.com.ar' }
};

// Gráficos integrados (cuando no hay placa de video): puntaje aproximado
const PUNTAJE_INTEGRADO = { 'r5-5600g': 7, 'AMD': 3, 'Intel': 4 };

const CALIDAD = { bajo: 1.8, medio: 1.35, alto: 1, ultra: 0.78 };
const RESOLUCION = { 1080: 1, 1440: 0.68, 2160: 0.38 };

// ---------------- Estado ----------------
let catalogo = {};
let juegos = [];
let zona = null;
let categoriaActual = 'cpu';
let nivelPrecio = 'medio';
const elegidos = {};          // categoria -> componente
const ofertas = {};           // id componente -> respuesta del servidor
const fotos = leerLocal('armatupc-fotos') || {};
// Las fotos que no se encontraron se vuelven a intentar al abrir la página
for (const k in fotos) if (!fotos[k]) delete fotos[k];   // id componente -> foto real del producto
let servidorActivo = false;

const $ = (sel) => document.querySelector(sel);
const pesos = (n) => (n || n === 0) ? '$ ' + Math.round(n).toLocaleString('es-AR') : '—';
const normalizar = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

function guardarLocal(clave, valor) { try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) {} }
function leerLocal(clave) { try { return JSON.parse(localStorage.getItem(clave)); } catch (e) { return null; } }

// Ícono de reemplazo cuando una tienda no devuelve imagen
function iconoCategoria(cat) {
  const c = CATEGORIAS.find((x) => x.id === cat);
  return `<div class="img-icono">${c ? c.icono : '🖥️'}</div>`;
}

// ---------------- Inicio ----------------
async function iniciar() {
  try {
    const [c, j] = await Promise.all([fetch('data/catalogo.json').then((r) => r.json()), fetch('data/juegos.json').then((r) => r.json())]);
    catalogo = c; juegos = j.juegos;
  } catch (e) {
    document.body.innerHTML = '<div class="error-inicio"><h1>No se pudo cargar la página</h1><p>Abrí la terminal en la carpeta del proyecto, escribí <code>node server.js</code> y entrá a <b>http://localhost:3000</b>.</p></div>';
    return;
  }

  // ¿Está el servidor de precios?
  try {
    const r = await fetch('/api/dolar');
    servidorActivo = r.ok;
  } catch (e) { servidorActivo = false; }
  $('#estadoTiendas').textContent = servidorActivo ? '🟢 Conectado a las tiendas' : '🟠 Sin conexión: precios de referencia';
  $('#estadoTiendas').classList.toggle('apagado', !servidorActivo);

  // Restaurar lo guardado
  const guardado = leerLocal('armatupc-pc') || {};
  for (const cat in guardado) {
    const comp = (catalogo[cat] || []).find((x) => x.id === guardado[cat]);
    if (comp) elegidos[cat] = comp;
  }
  nivelPrecio = leerLocal('armatupc-nivel') || 'medio';

  prepararZona();
  dibujarPasos();
  elegirCategoria('cpu');
  dibujarResumen();
  prepararEventos();
}

// ---------------- Zona ----------------
function prepararZona() {
  $('#provincia').innerHTML = PROVINCIAS.map((p) => `<option>${p}</option>`).join('');
  $('#ciudades').innerHTML = CIUDADES_SUGERIDAS.map((c) => `<option value="${c}">`).join('');
  $('#ciudad').addEventListener('input', mostrarTiendaLocal);

  zona = leerLocal('armatupc-zona');
  if (zona) {
    $('#provincia').value = zona.provincia;
    $('#ciudad').value = zona.ciudad;
    $('#modalZona').classList.add('oculto');
    actualizarTextoZona();
  } else {
    $('#provincia').value = 'Buenos Aires';
  }
  mostrarTiendaLocal();
}

function mostrarTiendaLocal() {
  const local = TIENDAS_LOCALES[normalizar($('#ciudad').value)];
  $('#tiendaLocalInfo').innerHTML = local
    ? `✅ Encontramos una tienda en tu ciudad: <b>${local.nombre}</b> (${local.direccion}). La vamos a usar como opción de precio medio.`
    : ($('#ciudad').value ? 'No tenemos una tienda cargada en tu ciudad: para la opción media usamos las tiendas oficiales de Mercado Libre.' : '');
}

function guardarZona() {
  const ciudad = $('#ciudad').value.trim();
  if (!ciudad) { $('#ciudad').focus(); $('#ciudad').classList.add('error'); return; }
  const local = TIENDAS_LOCALES[normalizar(ciudad)] || null;
  zona = { provincia: $('#provincia').value, ciudad, local };
  guardarLocal('armatupc-zona', zona);
  $('#modalZona').classList.add('oculto');
  actualizarTextoZona();
  for (const k in ofertas) delete ofertas[k];      // los precios cambian según la zona
  elegirCategoria(categoriaActual);
  dibujarResumen();
}

function actualizarTextoZona() {
  $('#zonaTexto').textContent = zona.ciudad + ', ' + zona.provincia;
}

// ---------------- Pasos (categorías) ----------------
function dibujarPasos() {
  $('#pasos').innerHTML = CATEGORIAS.map((c, i) => {
    const comp = elegidos[c.id];
    return `<button class="paso ${c.id === categoriaActual ? 'activo' : ''} ${comp ? 'listo' : ''}" data-cat="${c.id}">
      <span class="paso-num">${comp ? '✓' : i + 1}</span>
      <span class="paso-txt"><b>${c.icono} ${c.nombre}</b><small>${comp ? comp.nombre : (c.obligatorio ? 'Sin elegir' : 'Opcional')}</small></span>
    </button>`;
  }).join('');
}

function elegirCategoria(cat) {
  categoriaActual = cat;
  const c = CATEGORIAS.find((x) => x.id === cat);
  $('#tituloCategoria').textContent = c.icono + ' ' + c.nombre;
  $('#ayudaCategoria').textContent = c.ayuda;
  $('#filtro').value = '';
  $('#busquedaNueva').value = '';
  $('#resultadosNovedades').innerHTML = '';
  dibujarPasos();
  dibujarLista();
  dibujarDetalle();
  cargarFotos();
}

// ---------------- Compatibilidad de un componente con lo ya elegido ----------------
function problemaCon(cat, comp) {
  const cpu = elegidos.cpu, mother = elegidos.mother, ram = elegidos.ram, gpu = elegidos.gpu, gab = elegidos.gabinete;
  switch (cat) {
    case 'cpu':
      if (mother && comp.socket !== mother.socket) return `Socket ${comp.socket}: no entra en la motherboard (${mother.socket})`;
      if (ram && !comp.ram.includes(ram.tipo)) return `No usa memoria ${ram.tipo}`;
      break;
    case 'mother':
      if (cpu && comp.socket !== cpu.socket) return `Socket ${comp.socket}: el procesador es ${cpu.socket}`;
      if (ram && comp.ram !== ram.tipo) return `Usa ${comp.ram} y elegiste RAM ${ram.tipo}`;
      if (gab && !gab.formatos.includes(comp.formato)) return `Formato ${comp.formato}: no entra en el gabinete`;
      break;
    case 'ram':
      if (mother && comp.tipo !== mother.ram) return `La motherboard usa ${mother.ram}`;
      if (!mother && cpu && !cpu.ram.includes(comp.tipo)) return `El procesador no usa ${comp.tipo}`;
      if (mother && comp.modulos > mother.slotsRam) return `Son ${comp.modulos} módulos y la mother tiene ${mother.slotsRam} ranuras`;
      break;
    case 'gpu':
      if (gab && comp.largo > gab.gpuMax) return `Mide ${comp.largo} mm y el gabinete admite ${gab.gpuMax} mm`;
      break;
    case 'gabinete':
      if (mother && !comp.formatos.includes(mother.formato)) return `No entra una motherboard ${mother.formato}`;
      if (gpu && gpu.largo > comp.gpuMax) return `La placa de video (${gpu.largo} mm) no entra`;
      if (elegidos.cooler && elegidos.cooler.altura > comp.coolerMax) return `El cooler (${elegidos.cooler.altura} mm) no entra`;
      break;
    case 'fuente': {
      const necesita = wattsRecomendados();
      if (necesita && comp.watts < necesita) return `Te recomendamos al menos ${necesita} W`;
      break;
    }
    case 'cooler':
      if (cpu && comp.tipo === 'stock' && !cpu.traeCooler) return 'Este procesador no trae cooler en la caja';
      if (cpu && comp.tdpMax < cpu.tdp) return `Es chico para este procesador (${cpu.tdp} W)`;
      if (cpu && !comp.sockets.includes(cpu.socket)) return `No es compatible con ${cpu.socket}`;
      if (gab && comp.altura > gab.coolerMax) return `Mide ${comp.altura} mm y el gabinete admite ${gab.coolerMax} mm`;
      break;
  }
  return null;
}

function consumoEstimado() {
  const cpu = elegidos.cpu, gpu = elegidos.gpu;
  if (!cpu && !gpu) return 0;
  // procesador + placa + resto (mother, RAM, discos, coolers)
  return (cpu ? Math.round(cpu.tdp * 1.4) : 90) + (gpu ? gpu.tdp : 0) + 70;
}
function wattsRecomendados() {
  const c = consumoEstimado();
  if (!c) return 0;
  return Math.ceil((c * 1.4) / 50) * 50;   // 40 % de margen, redondeado a 50 W
}

// ---------------- Lista de componentes ----------------
function precioDe(comp, nivel = nivelPrecio) {
  const o = ofertas[comp.id];
  if (o && o.opciones) {
    const op = o.opciones.find((x) => x.nivel === nivel);
    if (op && op.producto && op.producto.precio) return { precio: op.producto.precio, vivo: true };
  }
  return { precio: comp.precioRef, vivo: false };
}

function detalleCorto(cat, c) {
  switch (cat) {
    case 'cpu': return `${c.socket} · ${c.nucleos} núcleos / ${c.hilos} hilos · ${c.ghz} GHz · ${c.graficos ? 'con gráficos' : 'sin gráficos'}`;
    case 'mother': return `${c.socket} · ${c.ram} · ${c.formato} · ${c.m2} M.2`;
    case 'ram': return `${c.tipo} · ${c.gb} GB · ${c.mhz} MHz`;
    case 'gpu': return `${c.vram} GB · ${c.tdp} W · ${c.largo} mm`;
    case 'almacenamiento': return `${c.tipo} · ${c.gb >= 1000 ? c.gb / 1000 + ' TB' : c.gb + ' GB'}`;
    case 'fuente': return `${c.watts} W · ${c.certificacion}`;
    case 'gabinete': return `${c.formatos.join(', ')} · placa hasta ${c.gpuMax} mm`;
    case 'cooler': return c.tipo === 'stock' ? 'Incluido con algunos procesadores' : `${c.tipo === 'agua' ? 'Líquida' : 'Aire'} · hasta ${c.tdpMax} W`;
  }
  return '';
}

function barraPuntaje(c) {
  if (!c.puntaje) return '';
  const max = categoriaActual === 'gpu' ? 120 : 110;
  return `<div class="puntaje"><div style="width:${Math.min(100, (c.puntaje / max) * 100)}%"></div></div>`;
}

function dibujarLista() {
  const filtro = normalizar($('#filtro').value || '');
  const lista = (catalogo[categoriaActual] || []).filter((c) => !filtro || normalizar(c.nombre).includes(filtro));
  const elegido = elegidos[categoriaActual];

  // Primero los compatibles
  const conProblema = lista.map((c) => ({ c, problema: problemaCon(categoriaActual, c) }));
  conProblema.sort((a, b) => (!!a.problema - !!b.problema) || (a.c.precioRef - b.c.precioRef));

  let html = '';
  if (categoriaActual === 'gpu') {
    html += `<button class="item ${!elegido ? 'elegido' : ''}" data-id="__ninguna">
      <div class="item-img">${iconoCategoria('gpu')}</div>
      <div class="item-info"><b>Sin placa de video</b><small>Usar los gráficos del procesador (solo para tareas básicas)</small></div>
      <div class="item-precio">$ 0</div></button>`;
  }
  html += conProblema.map(({ c, problema }) => {
    const p = precioDe(c);
    const o = ofertas[c.id];
    const foto = (o && o.imagen) || fotos[c.id];
    const img = `<div class="dibujo">${dibujo(categoriaActual, c)}</div>` + (foto ? `<img class="foto" src="${foto}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : '');
    return `<button class="item ${elegido && elegido.id === c.id ? 'elegido' : ''} ${problema ? 'incompatible' : ''}" data-id="${c.id}">
      <div class="item-img">${img}</div>
      <div class="item-info"><b>${c.nombre}</b><small>${detalleCorto(categoriaActual, c)}</small>${barraPuntaje(c)}
        ${problema ? `<span class="motivo">⚠️ ${problema}</span>` : ''}</div>
      <div class="item-precio">${c.precioRef === 0 ? 'Incluido' : pesos(p.precio)}<small>${c.precioRef === 0 ? '' : (p.vivo ? 'en vivo' : 'referencia')}</small></div>
    </button>`;
  }).join('');
  $('#lista').innerHTML = html || '<p class="suave">No hay resultados.</p>';
}

// Trae fotos reales de TODOS los componentes, solas y de fondo (4 a la vez).
// Las que ya se trajeron quedan guardadas y no se vuelven a pedir.
let pidiendoFotos = false;
async function cargarFotos() {
  if (!servidorActivo || pidiendoFotos) return;
  pidiendoFotos = true;
  // Primero la categoría que se está viendo, después el resto
  const orden = [categoriaActual, ...CATEGORIAS.map((c) => c.id).filter((id) => id !== categoriaActual)];
  for (const cat of orden) {
    const faltan = (catalogo[cat] || []).filter((c) => c.busqueda && fotos[c.id] === undefined);
    for (const c of faltan) {
      try {
        const r = await fetch('/api/imagen?q=' + encodeURIComponent(c.busqueda)).then((x) => x.json());
        if (r.imagen) fotos[c.id] = r.imagen;
      } catch (e) {}
      if (fotos[c.id] === undefined) fotos[c.id] = '';
      guardarLocal('armatupc-fotos', fotos);
      if (categoriaActual === cat && fotos[c.id]) dibujarLista();
    }
  }
  pidiendoFotos = false;
}

// ---------------- Elegir un componente ----------------
function elegirComponente(id) {
  if (id === '__ninguna') delete elegidos[categoriaActual];
  else {
    const comp = catalogo[categoriaActual].find((c) => c.id === id);
    const problema = problemaCon(categoriaActual, comp);
    if (problema && !confirm('Este componente tiene un problema de compatibilidad:\n\n' + problema + '\n\n¿Lo querés elegir igual?')) return;
    elegidos[categoriaActual] = comp;
    cargarOfertas(comp);
  }
  const guardar = {};
  for (const k in elegidos) guardar[k] = elegidos[k].id;
  guardarLocal('armatupc-pc', guardar);
  dibujarPasos();
  dibujarLista();
  dibujarDetalle();
  dibujarResumen();
}

// Pide al servidor los precios de las 3 tiendas
async function cargarOfertas(comp) {
  if (!comp.busqueda || ofertas[comp.id] || !servidorActivo) return;
  ofertas[comp.id] = { cargando: true };
  dibujarDetalle();
  try {
    const params = new URLSearchParams({ q: comp.busqueda, ref: comp.precioRef, local: zona && zona.local ? zona.local.id : '', provincia: zona ? zona.provincia : '', ciudad: zona ? zona.ciudad : '' });
    const r = await fetch('/api/precios?' + params);
    const datos = await r.json();
    const conImagen = datos.opciones && datos.opciones.map((o) => o.producto && o.producto.imagen).find(Boolean);
    ofertas[comp.id] = { ...datos, imagen: conImagen };
    if (conImagen) { fotos[comp.id] = conImagen; guardarLocal('armatupc-fotos', fotos); }
  } catch (e) {
    ofertas[comp.id] = { error: true };
  }
  dibujarLista();
  dibujarDetalle();
  dibujarResumen();
}

function dibujarDetalle() {
  const comp = elegidos[categoriaActual];
  const caja = $('#detalle');
  if (!comp || !comp.busqueda) { caja.classList.add('oculto'); return; }
  caja.classList.remove('oculto');
  const o = ofertas[comp.id];

  let cuerpo;
  if (!servidorActivo) {
    cuerpo = `<p class="suave">El servidor de precios no está andando, así que mostramos el precio de referencia (${pesos(comp.precioRef)}). Abrí la página con <code>node server.js</code> para ver precios en vivo.</p>`;
  } else if (!o || o.cargando) {
    cuerpo = `<div class="cargando"><span></span> Buscando precios en las tiendas…</div>`;
  } else if (o.error) {
    cuerpo = `<p class="suave">No pudimos conectarnos con las tiendas. <button class="link" data-reintentar="${comp.id}">Reintentar</button></p>`;
  } else {
    cuerpo = '<div class="opciones">' + o.opciones.map((op) => {
      const p = op.producto;
      return `<div class="opcion ${op.nivel} ${nivelPrecio === op.nivel ? 'marcada' : ''}">
        <div class="opcion-cab"><span class="etiqueta">${op.titulo}</span><small>${op.tienda}</small></div>
        ${p ? `
          <div class="opcion-img">${p.imagen ? `<img src="${p.imagen}" alt="" loading="lazy" referrerpolicy="no-referrer">` : dibujo(categoriaActual, comp)}</div>
          <p class="opcion-titulo">${p.titulo}</p>
          <div class="opcion-precio">${pesos(p.precio)}${p.precioUSD ? `<small>US$ ${p.precioUSD}</small>` : ''}</div>
          ${p.nota ? `<p class="nota">${p.nota}</p>` : ''}
          <a class="boton chico" href="${p.link}" target="_blank" rel="noopener">Ver en la tienda</a>
        ` : `
          <div class="opcion-img">${dibujo(categoriaActual, comp)}</div>
          <p class="suave chico-txt">${op.mensaje || 'No pudimos leer el precio en esta tienda.'}</p>
          <p class="ref-precio">Precio de referencia: <b>${pesos(comp.precioRef)}</b></p>
          ${(op.botones || [{ texto: 'Buscar en la tienda', url: op.buscarEn }]).map((b) => `<a class="boton chico secundario" href="${b.url}" target="_blank" rel="noopener">${b.texto}</a>`).join('')}
        `}
        <p class="explica">${op.explicacion}</p>
      </div>`;
    }).join('') + '</div>' +
    `<p class="suave chico-txt">Actualizado: ${new Date(o.actualizado).toLocaleString('es-AR')}${o.dolar ? ` · Dólar tarjeta $${o.dolar.venta}` : ''} · <button class="link" data-reintentar="${comp.id}">Actualizar</button></p>`;
  }

  caja.innerHTML = `<h3>Dónde comprar: ${comp.nombre}</h3>${cuerpo}`;
}

// ---------------- Buscar novedades ----------------
async function buscarNovedades() {
  const q = $('#busquedaNueva').value.trim() || CATEGORIAS.find((c) => c.id === categoriaActual).nombre;
  const caja = $('#resultadosNovedades');
  if (!servidorActivo) { caja.innerHTML = '<p class="suave">Necesitás el servidor encendido para buscar en las tiendas.</p>'; return; }
  caja.innerHTML = '<div class="cargando"><span></span> Buscando…</div>';
  try {
    const lista = await fetch('/api/buscar?q=' + encodeURIComponent(q)).then((r) => r.json());
    caja.innerHTML = lista.length ? lista.map((p) => `
      <a class="novedad" href="${p.link}" target="_blank" rel="noopener">
        ${p.imagen ? `<img src="${p.imagen}" alt="" loading="lazy" referrerpolicy="no-referrer">` : iconoCategoria(categoriaActual)}
        <span>${p.titulo}</span><b>${pesos(p.precio)}</b><small>en Amazon</small>
      </a>`).join('') : '<p class="suave">No encontramos resultados.</p>';
  } catch (e) {
    caja.innerHTML = '<p class="suave">No se pudo buscar.</p>';
  }
}

// ---------------- Resumen y compatibilidad general ----------------
function revisionGeneral() {
  const avisos = [];
  const { cpu, mother, ram, gpu, fuente, gabinete, cooler, almacenamiento } = elegidos;

  for (const cat of CATEGORIAS) {
    const comp = elegidos[cat.id];
    if (comp) {
      const p = problemaCon(cat.id, comp);
      if (p) avisos.push({ tipo: 'error', texto: `${cat.nombre}: ${p}` });
    } else if (cat.obligatorio) {
      avisos.push({ tipo: 'falta', texto: `Falta elegir: ${cat.nombre}` });
    }
  }
  if (cpu && !gpu && !cpu.graficos) avisos.push({ tipo: 'error', texto: 'El procesador no tiene gráficos integrados: necesitás una placa de video para tener imagen.' });
  if (cpu && mother && cpu.socket === mother.socket) avisos.push({ tipo: 'ok', texto: `Procesador y motherboard: socket ${cpu.socket}` });
  if (mother && ram && mother.ram === ram.tipo) avisos.push({ tipo: 'ok', texto: `Memoria ${ram.tipo} compatible` });
  if (fuente && consumoEstimado() && fuente.watts >= wattsRecomendados()) avisos.push({ tipo: 'ok', texto: `Fuente suficiente (${fuente.watts} W para ~${consumoEstimado()} W)` });
  if (gabinete && gpu && gpu.largo <= gabinete.gpuMax) avisos.push({ tipo: 'ok', texto: 'La placa de video entra en el gabinete' });
  if (ram && ram.gb < 16) avisos.push({ tipo: 'aviso', texto: 'Con 8 GB de RAM muchos juegos actuales van a andar trabados.' });
  if (cpu && gpu && gpu.puntaje > 80 && cpu.puntaje < 70) avisos.push({ tipo: 'aviso', texto: 'El procesador es flojo para esta placa: va a limitar los FPS (cuello de botella).' });
  if (almacenamiento && almacenamiento.tipo === 'NVMe' && mother && mother.m2 < 1) avisos.push({ tipo: 'error', texto: 'La motherboard no tiene ranura M.2.' });
  if (cooler && cpu && cooler.tipo === 'stock' && cpu.traeCooler && cpu.tdp > 65) avisos.push({ tipo: 'aviso', texto: 'El cooler de caja puede quedar justo: conviene uno mejor.' });
  return avisos;
}

function totalPC() {
  let total = 0;
  for (const cat in elegidos) total += precioDe(elegidos[cat]).precio || 0;
  return total;
}

function dibujarResumen() {
  $('#resumenLista').innerHTML = CATEGORIAS.map((c) => {
    const comp = elegidos[c.id];
    const p = comp ? precioDe(comp) : null;
    return `<div class="resumen-fila ${comp ? '' : 'vacio'}" data-cat="${c.id}">
      <span>${c.icono}</span>
      <div><small>${c.nombre}</small><b>${comp ? comp.nombre : '—'}</b></div>
      <em>${comp ? (comp.precioRef === 0 ? 'Incluido' : pesos(p.precio)) : ''}</em>
    </div>`;
  }).join('');

  $('#total').textContent = pesos(totalPC());
  document.querySelectorAll('#selectorNivel button').forEach((b) => b.classList.toggle('activo', b.dataset.nivel === nivelPrecio));

  const c = consumoEstimado();
  $('#consumo').textContent = c ? `Consumo estimado: ~${c} W · Fuente recomendada: ${wattsRecomendados()} W o más` : '';

  const avisos = revisionGeneral();
  const iconos = { ok: '✅', error: '❌', falta: '⬜', aviso: '⚠️' };
  avisos.sort((a, b) => ['error', 'aviso', 'falta', 'ok'].indexOf(a.tipo) - ['error', 'aviso', 'falta', 'ok'].indexOf(b.tipo));
  $('#compatibilidad').innerHTML = avisos.map((a) => `<li class="${a.tipo}">${iconos[a.tipo]} ${a.texto}</li>`).join('');

  const lista = avisos.every((a) => a.tipo !== 'error' && a.tipo !== 'falta');
  $('#botonRendimiento').disabled = !lista;
  $('#botonRendimiento').textContent = lista ? '🎮 Ver rendimiento en juegos' : 'Completá la PC para ver el rendimiento';
}

// ---------------- Rendimiento en juegos ----------------
function puntajeGrafico() {
  const { gpu, cpu } = elegidos;
  if (gpu) return gpu.puntaje;
  if (!cpu || !cpu.graficos) return 0;
  return PUNTAJE_INTEGRADO[cpu.id] || PUNTAJE_INTEGRADO[cpu.marca] || 3;
}

function estimarFPS(juego, resolucion, calidad) {
  const { cpu, ram, gpu } = elegidos;
  const g = puntajeGrafico();
  let fpsPlaca = juego.fpsGpu * (g / 100) * CALIDAD[calidad] * RESOLUCION[resolucion];
  let fpsProcesador = juego.fpsCpu * (cpu.puntaje / 100);
  if (ram.gb < juego.ramMin) fpsProcesador *= 0.7;
  if (ram.tipo === 'DDR4' && cpu.ram.includes('DDR5')) fpsProcesador *= 0.95;

  // Si falta memoria de video, el juego se traba
  const vramNecesaria = juego.vramAlto * (calidad === 'ultra' ? 1.25 : calidad === 'alto' ? 1 : 0.75) * (resolucion >= 1440 ? 1.2 : 1);
  const vram = gpu ? gpu.vram : 2;
  if (vram < vramNecesaria) fpsPlaca *= 0.75;

  let fps = Math.min(fpsPlaca, fpsProcesador);
  if (juego.tope) fps = Math.min(fps, juego.tope);
  return { fps: Math.max(0, Math.round(fps)), limita: fpsPlaca < fpsProcesador ? 'placa de video' : 'procesador', faltaVram: vram < vramNecesaria };
}

function dibujarRendimiento() {
  const res = Number($('#resolucion').value);
  const cal = $('#calidad').value;
  const { cpu, gpu, ram } = elegidos;
  $('#rendimientoSub').textContent = `${cpu.nombre} · ${gpu ? gpu.nombre : 'Gráficos integrados'} · ${ram.gb} GB ${ram.tipo}`;

  $('#tablaJuegos').innerHTML = juegos.map((j) => {
    const r = estimarFPS(j, res, cal);
    const estado = r.fps >= 60 ? ['fluido', 'Fluido'] : r.fps >= 30 ? ['jugable', 'Jugable'] : ['no', 'No recomendado'];
    const benchmark = `https://www.youtube.com/results?search_query=${encodeURIComponent((gpu ? gpu.nombre.replace(/^(NVIDIA|AMD Radeon|Intel)\s/, '') : cpu.nombre) + ' ' + cpu.nombre.replace(/^(AMD|Intel)\s/, '') + ' ' + j.nombre + ' ' + res + 'p')}`;
    const cyri = `https://www.google.com/search?q=${encodeURIComponent('can you run it ' + j.cyri + ' systemrequirementslab')}`;
    return `<div class="juego">
      <div class="juego-nombre"><b>${j.nombre}</b><small>Limita: ${r.limita}${r.faltaVram ? ' · poca memoria de video' : ''}</small></div>
      <div class="juego-barra"><div class="${estado[0]}" style="width:${Math.min(100, r.fps / 2.4)}%"></div></div>
      <div class="juego-fps"><b>${r.fps}</b> FPS<span class="estado ${estado[0]}">${estado[1]}</span></div>
      <div class="juego-links"><a href="${cyri}" target="_blank" rel="noopener">Can You Run It</a><a href="${benchmark}" target="_blank" rel="noopener">Ver pruebas</a></div>
    </div>`;
  }).join('');
}

// ---------------- Eventos ----------------
function prepararEventos() {
  $('#guardarZona').addEventListener('click', guardarZona);
  $('#ciudad').addEventListener('keydown', (e) => { if (e.key === 'Enter') guardarZona(); });
  $('#cambiarZona').addEventListener('click', () => $('#modalZona').classList.remove('oculto'));

  $('#pasos').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) elegirCategoria(b.dataset.cat); });
  $('#resumenLista').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) elegirCategoria(b.dataset.cat); });
  $('#lista').addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) elegirComponente(b.dataset.id); });
  $('#filtro').addEventListener('input', dibujarLista);

  $('#detalle').addEventListener('click', (e) => {
    const b = e.target.closest('[data-reintentar]');
    if (b) { delete ofertas[b.dataset.reintentar]; cargarOfertas(elegidos[categoriaActual]); }
  });

  $('#selectorNivel').addEventListener('click', (e) => {
    const b = e.target.closest('[data-nivel]');
    if (!b) return;
    nivelPrecio = b.dataset.nivel;
    guardarLocal('armatupc-nivel', nivelPrecio);
    dibujarResumen(); dibujarLista(); dibujarDetalle();
  });

  $('#botonNovedades').addEventListener('click', buscarNovedades);
  $('#busquedaNueva').addEventListener('keydown', (e) => { if (e.key === 'Enter') buscarNovedades(); });

  $('#botonRendimiento').addEventListener('click', () => { dibujarRendimiento(); $('#modalRendimiento').classList.remove('oculto'); });
  $('#cerrarRendimiento').addEventListener('click', () => $('#modalRendimiento').classList.add('oculto'));
  $('#modalRendimiento').addEventListener('click', (e) => { if (e.target.id === 'modalRendimiento') e.target.classList.add('oculto'); });
  $('#resolucion').addEventListener('change', dibujarRendimiento);
  $('#calidad').addEventListener('change', dibujarRendimiento);

  // Al volver a abrir la página, traer los precios de lo que ya estaba elegido
  for (const cat in elegidos) cargarOfertas(elegidos[cat]);
  cargarFotos();
}

iniciar();
