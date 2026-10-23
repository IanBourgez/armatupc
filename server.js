// ArmaTuPC - servidor
// Sirve la página (carpeta public) y consulta las tiendas en vivo.
// No usa librerías externas: solo Node.js 18 o más nuevo.
// Para arrancarlo:  node server.js   y abrir http://localhost:3000

const http = require('http');
const fs = require('fs');
const path = require('path');

const PUERTO = process.env.PORT || 3000;
const CARPETA_PUBLICA = path.join(__dirname, 'public');
const ARCHIVO_CACHE = path.join(__dirname, 'cache-precios.json');
const MINUTOS_CACHE = 30;

// Encabezados para que las tiendas nos respondan como a un navegador común
const NAVEGADOR = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
  'Accept': 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8'
};

// ---------------- Caché (para no consultar las tiendas a cada rato) ----------------
let cache = {};
try { cache = JSON.parse(fs.readFileSync(ARCHIVO_CACHE, 'utf8')); } catch (e) { cache = {}; }

function leerCache(clave) {
  const dato = cache[clave];
  if (dato && Date.now() - dato.fecha < MINUTOS_CACHE * 60 * 1000) return dato.valor;
  return null;
}
function guardarCache(clave, valor) {
  cache[clave] = { fecha: Date.now(), valor };
  fs.writeFile(ARCHIVO_CACHE, JSON.stringify(cache), () => {});
}

async function traer(url, extra = {}) {
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), 12000);
  try {
    const resp = await fetch(url, { headers: { ...NAVEGADOR, ...extra }, signal: control.signal, redirect: 'follow' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return await resp.text();
  } finally {
    clearTimeout(timer);
  }
}

// Convierte "1.234.567" o "1,234.56" en número
function aNumero(texto) {
  if (!texto) return null;
  const limpio = String(texto).replace(/[^\d.,]/g, '');
  if (/,\d{2}$/.test(limpio)) return Number(limpio.replace(/\./g, '').replace(',', '.'));
  return Number(limpio.replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.'));
}

const sinEtiquetas = (s) => (s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

// Revisa que el título del producto tenga las palabras importantes de la búsqueda
function coincide(titulo, busqueda) {
  const t = titulo.toLowerCase();
  const claves = busqueda.toLowerCase().split(/\s+/).filter((p) => (p.length > 1 && /\d/.test(p)) || p.length > 3);
  return claves.every((p) => t.includes(p));
}

// ---------------- Mercado Libre ----------------
async function mercadoLibre(busqueda, soloOficiales = false) {
  const resultados = [];
  // 1) API pública de Mercado Libre
  try {
    const url = 'https://api.mercadolibre.com/sites/MLA/search?limit=30&sort=price_asc&q=' + encodeURIComponent(busqueda) + (soloOficiales ? '&official_store=all' : '');
    const datos = JSON.parse(await traer(url, { Accept: 'application/json' }));
    for (const r of datos.results || []) {
      resultados.push({
        titulo: r.title, precio: r.price, moneda: r.currency_id === 'USD' ? 'USD' : 'ARS',
        imagen: (r.thumbnail || '').replace('-I.jpg', '-O.jpg').replace('http://', 'https://'),
        link: r.permalink, vendedor: r.official_store_name || (r.seller && r.seller.nickname) || ''
      });
    }
  } catch (e) { /* si la API pide permiso, probamos con la página */ }

  // 2) Si la API no respondió, leemos la página de resultados
  if (!resultados.length) {
    const slug = busqueda.trim().toLowerCase().replace(/\s+/g, '-');
    const url = 'https://listado.mercadolibre.com.ar/' + encodeURIComponent(slug).replace(/%2D/g, '-') + (soloOficiales ? '_Tienda_all' : '') + '_OrderId_PRICE_NoIndex_True';
    const html = await traer(url);
    const tarjetas = html.split(/class="[^"]*poly-card[ "]/).slice(1);
    for (const t of tarjetas) {
      const titulo = sinEtiquetas((t.match(/class="poly-component__title[^"]*"[^>]*>([\s\S]*?)<\/a>/) || [])[1]);
      const link = (t.match(/class="poly-component__title[^"]*"[^>]*href="([^"]+)"/) || t.match(/href="(https:\/\/[^"]*mercadolibre[^"]+)"/) || [])[1];
      const precio = aNumero((t.match(/andes-money-amount__fraction[^>]*>([\d.]+)</) || [])[1]);
      const imagen = (t.match(/(?:data-src|src)="(https:\/\/http2\.mlstatic\.com[^"]+)"/) || [])[1];
      if (titulo && precio) resultados.push({ titulo, precio, moneda: 'ARS', imagen, link: link ? link.split('#')[0] : url, vendedor: '' });
    }
  }
  return resultados;
}

// ---------------- Olanet (Olavarría) ----------------
// La tienda carga los precios con JavaScript, así que probamos varias formas de leerlos.
async function olanet(busqueda) {
  // Olanet guarda los datos de los productos dentro de la página, en window.data.products
  const url = 'https://olanet.com.ar/s/?q=' + encodeURIComponent(busqueda);
  const html = await traer(url);
  const resultados = [];
  const bloques = html.matchAll(/window\.data\.products = Object\.assign\(window\.data\.products, (\{[\s\S]*?\})\);\s*<\/script>/g);
  for (const b of bloques) {
    let productos;
    try { productos = JSON.parse(b[1]); } catch (e) { continue; }
    for (const p of Object.values(productos)) {
      const precio = Number(p.sellingPrice || p.price || p.minSellingPrice);
      if (!p.name || !precio) continue;
      const img = p.urls && p.urls.images && p.urls.images[0];
      resultados.push({
        titulo: p.name, precio, moneda: 'ARS',
        imagen: img ? 'https://olanet.com.ar' + img : null,
        link: 'https://olanet.com.ar' + ((p.urls && p.urls.detail) || '/producto/' + p.slug),
        vendedor: 'Olanet', sinStock: p.availability !== 'in stock' && !(p.stock > 0)
      });
    }
  }
  return resultados;
}

// ---------------- Amazon ----------------
async function dolar() {
  const guardado = leerCache('dolar');
  if (guardado) return guardado;
  try {
    // Dólar tarjeta: es el que se paga al comprar en el exterior con tarjeta
    const d = JSON.parse(await traer('https://dolarapi.com/v1/dolares/tarjeta', { Accept: 'application/json' }));
    const valor = { venta: d.venta, tipo: 'tarjeta', fecha: d.fechaActualizacion };
    guardarCache('dolar', valor);
    return valor;
  } catch (e) {
    return null;
  }
}

async function amazon(busqueda) {
  const url = 'https://www.amazon.com/s?k=' + encodeURIComponent(busqueda) + '&language=es';
  const html = await traer(url);
  const resultados = [];
  const bloques = html.split('data-component-type="s-search-result"').slice(1);
  for (const b of bloques) {
    const titulo = sinEtiquetas((b.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || [])[1]);
    const entero = (b.match(/a-price-whole">([\d,]+)/) || [])[1];
    const simbolo = ((b.match(/a-price-symbol">([^<]+)</) || [])[1] || '').trim();
    const centavos = (b.match(/a-price-fraction">(\d+)/) || [])[1] || '00';
    const imagen = (b.match(/class="s-image"[^>]*src="([^"]+)"/) || b.match(/src="([^"]+)"[^>]*class="s-image"/) || [])[1];
    const link = (b.match(/href="(\/[^"]*\/dp\/[^"]+)"/) || [])[1];
    if (titulo && entero) {
      resultados.push({ titulo, precio: Number(entero.replace(/,/g, '') + '.' + centavos), moneda: simbolo === 'ARS' ? 'ARS' : 'USD', imagen, link: link ? 'https://www.amazon.com' + link.split('/ref=')[0] : url, vendedor: 'Amazon' });
    }
  }
  return resultados;
}

// ---------------- Arma las 3 opciones de compra ----------------
// Descarta accesorios y repuestos: si el precio es menos del 35 % del precio de referencia, no es el producto
const NO_ES_EL_PRODUCTO = /\b(cooler para|soporte|funda|cable|backplate|usado|repuesto|ventilador para|caja vac[ií]a|solo caja)\b/i;
function elegirMasBarato(lista, busqueda, referencia, moneda = 'ARS', dolarVenta = 0) {
  const buenos = lista.filter((r) => {
    if (!(r.precio > 0) || !coincide(r.titulo, busqueda) || NO_ES_EL_PRODUCTO.test(r.titulo)) return false;
    if (referencia) {
      const enPesos = moneda === 'USD' && dolarVenta ? r.precio * dolarVenta : r.precio;
      if (moneda === 'USD' && !dolarVenta) return true;
      if (enPesos < referencia * 0.35) return false;
    }
    return true;
  });
  const usar = buenos.length ? buenos : [];
  usar.sort((a, b) => a.precio - b.precio);
  return usar[0] || null;
}

// Arma la dirección de Mercado Libre filtrada por la zona del comprador.
// Mercado Libre divide Buenos Aires en varias zonas; el resto de las provincias usan su nombre.
const sinTildes = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const aSlug = (t) => sinTildes(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const COSTA_ATLANTICA = ['mar del plata', 'general pueyrredon', 'miramar', 'pinamar', 'villa gesell', 'necochea', 'mar de ajo', 'san clemente del tuyu', 'santa teresita', 'quequen'];
function zonaMercadoLibre(provincia, ciudad) {
  const p = sinTildes(provincia), c = sinTildes(ciudad);
  if (!p) return '';
  if (p === 'caba' || p.includes('capital')) return 'capital-federal/';
  if (p === 'buenos aires') return (COSTA_ATLANTICA.includes(c) ? 'bs-as-costa-atlantica/' : 'buenos-aires-interior/') + (c ? aSlug(c) + '/' : '');
  return aSlug(provincia) + '/' + (c ? aSlug(c) + '/' : '');
}

async function opcionesDeCompra(busqueda, zona, referencia) {
  const clave = 'ofertas|' + busqueda + '|' + (zona.tiendaLocal || '') + '|' + zona.ciudad;
  const guardado = leerCache(clave);
  if (guardado) return guardado;

  const q = encodeURIComponent(busqueda);
  const slug = aSlug(busqueda);
  const tieneOlanet = zona.tiendaLocal === 'olanet';
  const lugar = zona.ciudad ? zona.ciudad + (zona.provincia ? ', ' + zona.provincia : '') : 'tu zona';

  // Mercado Libre bloquea las consultas automáticas, así que no lo leemos: armamos los links ya filtrados.
  const [loc, amz, cambio] = await Promise.allSettled([
    tieneOlanet ? olanet(busqueda) : Promise.resolve([]),
    amazon(busqueda),
    dolar()
  ]);
  const valor = (r) => (r.status === 'fulfilled' ? r.value : []);
  const dolarTarjeta = cambio.status === 'fulfilled' ? cambio.value : null;
  const venta = dolarTarjeta ? dolarTarjeta.venta : 0;

  const intermedio = elegirMasBarato(valor(loc), busqueda, referencia);
  // Amazon a veces muestra pesos y a veces dólares: pasamos todo a pesos
  const enPesos = valor(amz).map((r) => r.moneda === 'USD' && venta ? { ...r, precioUSD: r.precio, precio: Math.round(r.precio * venta), moneda: 'ARS' } : r);
  const caro = elegirMasBarato(enPesos.filter((r) => r.moneda === 'ARS'), busqueda, referencia);
  if (caro) caro.nota = caro.precioUSD
    ? 'Precio en dólares pasado a pesos con dólar tarjeta ($' + venta + '). Falta sumar envío e impuestos de importación.'
    : 'Precio que muestra Amazon en pesos. El envío y los impuestos de importación se suman al pagar.';
  if (intermedio && intermedio.sinStock) intermedio.nota = 'Figura sin stock: consultá en el local.';

  const mlZona = 'https://listado.mercadolibre.com.ar/' + zonaMercadoLibre(zona.provincia, zona.ciudad) + slug + '_OrderId_PRICE';
  const mlPais = 'https://listado.mercadolibre.com.ar/' + slug + '_OrderId_PRICE';
  const mlOficial = 'https://listado.mercadolibre.com.ar/' + slug + '_Tienda_all_OrderId_PRICE';
  const mapas = 'https://www.google.com/maps/search/' + encodeURIComponent('casa de computación ' + (zona.ciudad || '') + ' ' + (zona.provincia || ''));

  const resultado = {
    busqueda,
    actualizado: new Date().toISOString(),
    opciones: [
      {
        nivel: 'barato', titulo: 'Barato pero no seguro',
        tienda: 'Mercado Libre (cualquier vendedor)',
        explicacion: 'Suele ser el precio más bajo, pero el vendedor puede no dar factura ni garantía. Revisá su reputación antes de comprar.',
        producto: null,
        mensaje: 'Mercado Libre no deja leer sus precios automáticamente. Los botones abren la búsqueda ya ordenada del más barato al más caro.',
        botones: [
          { texto: 'Vendedores de ' + lugar, url: mlZona },
          { texto: 'Todo el país', url: mlPais }
        ],
        buscarEn: mlPais
      },
      {
        nivel: 'medio', titulo: 'Precio medio, seguridad media',
        tienda: tieneOlanet ? 'Olanet (Olavarría)' : 'Tiendas de ' + lugar,
        explicacion: tieneOlanet
          ? 'Tienda de tu ciudad: podés ir a retirarlo y tiene garantía local.'
          : 'Comprar en un local de tu ciudad o en una tienda oficial: hay factura, garantía y alguien a quien reclamarle.',
        producto: intermedio,
        mensaje: tieneOlanet ? 'No pudimos leer el precio de Olanet en este momento.' : 'Consultá en los locales de tu ciudad o en las tiendas oficiales de las marcas.',
        botones: (tieneOlanet ? [{ texto: 'Abrir Olanet', url: 'https://olanet.com.ar/' }] : [])
          .concat([{ texto: 'Locales en el mapa', url: mapas }, { texto: 'Tiendas oficiales ML', url: mlOficial }]),
        buscarEn: tieneOlanet ? 'https://olanet.com.ar/' : mapas
      },
      {
        nivel: 'alto', titulo: 'Precio alto, totalmente confiable',
        tienda: 'Amazon',
        explicacion: 'Producto nuevo y original con devolución garantizada. Es más caro porque se importa.',
        producto: caro,
        mensaje: 'No encontramos este producto en Amazon.',
        botones: [{ texto: 'Buscar en Amazon', url: 'https://www.amazon.com/s?k=' + q }],
        buscarEn: 'https://www.amazon.com/s?k=' + q
      }
    ],
    dolar: dolarTarjeta
  };

  if (intermedio || caro) guardarCache(clave, resultado);
  return resultado;
}

// ---------------- Fotos de productos ----------------
// Las fotos salen de Amazon (Mercado Libre bloquea las consultas automáticas).
// Se buscan de a una, con una pausa, para no ser bloqueados.
let fila = Promise.resolve();
function enFila(tarea) {
  const resultado = fila.then(tarea, tarea);
  fila = resultado.catch(() => {}).then(() => new Promise((r) => setTimeout(r, 1200)));
  return resultado;
}

async function buscarFoto(q) {
  for (let intento = 0; intento < 2; intento++) {
    try {
      const lista = (await amazon(q)).filter((r) => r.imagen && !NO_ES_EL_PRODUCTO.test(r.titulo));
      // Mejor si el título coincide; si no, la primera que haya
      const elegido = lista.find((r) => coincide(r.titulo, q)) || lista[0];
      if (elegido) return elegido.imagen;
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return null;
}

// ---------------- Servidor web ----------------
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

function responderJSON(res, codigo, datos) {
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(datos));
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  // API: precios de un componente en las 3 tiendas
  if (url.pathname === '/api/precios') {
    const q = (url.searchParams.get('q') || '').trim();
    if (!q) return responderJSON(res, 400, { error: 'Falta el nombre del producto' });
    const zona = { tiendaLocal: url.searchParams.get('local') || '', provincia: url.searchParams.get('provincia') || '', ciudad: url.searchParams.get('ciudad') || '' };
    try {
      return responderJSON(res, 200, await opcionesDeCompra(q, zona, Number(url.searchParams.get('ref')) || 0));
    } catch (e) {
      return responderJSON(res, 500, { error: 'No se pudo consultar las tiendas' });
    }
  }

  // API: buscar cualquier producto nuevo en Mercado Libre (para ver lo que va saliendo)
  if (url.pathname === '/api/buscar') {
    const q = (url.searchParams.get('q') || '').trim();
    if (!q) return responderJSON(res, 400, { error: 'Falta la búsqueda' });
    const clave = 'buscar|' + q;
    const guardado = leerCache(clave);
    if (guardado) return responderJSON(res, 200, guardado);
    try {
      const d = await dolar();
      const lista = (await amazon(q)).slice(0, 12).map((r) => r.moneda === 'USD' && d ? { ...r, precioUSD: r.precio, precio: Math.round(r.precio * d.venta), moneda: 'ARS' } : r);
      if (lista.length) guardarCache(clave, lista);
      return responderJSON(res, 200, lista);
    } catch (e) {
      return responderJSON(res, 200, []);
    }
  }

  // API: foto real de un producto (la primera de Mercado Libre). Se guarda 7 días.
  if (url.pathname === '/api/imagen') {
    const q = (url.searchParams.get('q') || '').trim();
    if (!q) return responderJSON(res, 200, { imagen: null });
    const clave = 'imagen|' + q;
    const dato = cache[clave];
    if (dato && Date.now() - dato.fecha < 7 * 24 * 3600 * 1000) return responderJSON(res, 200, { imagen: dato.valor });
    const imagen = await enFila(() => buscarFoto(q));
    if (imagen) guardarCache(clave, imagen);
    console.log((imagen ? 'Foto OK    ' : 'Sin foto   ') + q);
    return responderJSON(res, 200, { imagen });
  }

  // API: valor del dólar
  if (url.pathname === '/api/dolar') return responderJSON(res, 200, (await dolar()) || {});

  // Archivos de la página
  let archivo = path.normalize(path.join(CARPETA_PUBLICA, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname)));
  if (!archivo.startsWith(CARPETA_PUBLICA)) { res.writeHead(403); return res.end(); }
  fs.readFile(archivo, (err, contenido) => {
    if (err) { res.writeHead(404); return res.end('No encontrado'); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream' });
    res.end(contenido);
  });
});

servidor.listen(PUERTO, () => {
  console.log('ArmaTuPC funcionando en http://localhost:' + PUERTO);
});
