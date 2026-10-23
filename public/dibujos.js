// ArmaTuPC - dibujos de cada componente (SVG hechos con código, sin logos de marcas)
// Se usan cuando no hay foto real del producto.

const COLOR_MARCA = { NVIDIA: '#76b900', AMD: '#e2231a', Intel: '#0071c5' };

function marcaDe(cat, c) {
  if (c.marca) return c.marca;
  const n = (c.nombre || '').toLowerCase();
  if (n.includes('nvidia') || n.includes('rtx')) return 'NVIDIA';
  if (n.includes('amd') || n.includes('ryzen') || n.includes('radeon')) return 'AMD';
  if (n.includes('intel')) return 'Intel';
  if (cat === 'mother') return c.socket && c.socket.startsWith('AM') ? 'AMD' : 'Intel';
  return '';
}

function textoCorto(cat, c) {
  switch (cat) {
    case 'cpu': return c.nombre.replace(/^(AMD|Intel)\s(Core\s)?/, '');
    case 'mother': return c.nombre.split(' ').slice(1, 3).join(' ');
    case 'ram': return c.gb + 'GB ' + c.tipo;
    case 'gpu': return c.nombre.replace(/^(NVIDIA|AMD Radeon|Intel)\s/, '').replace(/\s\d+ GB$/, '');
    case 'almacenamiento': return c.gb >= 1000 ? c.gb / 1000 + 'TB' : c.gb + 'GB';
    case 'fuente': return c.watts + 'W';
    case 'gabinete': return c.formatos ? c.formatos[0] : '';
    case 'cooler': return c.tipo === 'agua' ? 'AIO' : c.tipo === 'stock' ? 'Stock' : 'Torre';
  }
  return '';
}

function dibujo(cat, c) {
  const color = COLOR_MARCA[marcaDe(cat, c)] || '#58a6ff';
  const txt = (textoCorto(cat, c) || '').replace(/[<&>"]/g, '');
  const t = (x, y, size, fill = '#fff') => `<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" font-weight="bold" fill="${fill}" text-anchor="middle">${txt}</text>`;
  let s = '';
  switch (cat) {
    case 'cpu':
      s = `<rect x="22" y="22" width="76" height="76" rx="6" fill="#2b2f36"/>`;
      for (let i = 0; i < 7; i++) { const p = 28 + i * 10; s += `<rect x="${p}" y="14" width="4" height="8" fill="#c9a227"/><rect x="${p}" y="98" width="4" height="8" fill="#c9a227"/><rect x="14" y="${p}" width="8" height="4" fill="#c9a227"/><rect x="98" y="${p}" width="8" height="4" fill="#c9a227"/>`; }
      s += `<rect x="32" y="32" width="56" height="56" rx="4" fill="#c0c4ca"/><rect x="32" y="32" width="56" height="10" rx="3" fill="${color}"/>` + t(60, 70, 10, '#222');
      break;
    case 'mother':
      s = `<rect x="14" y="10" width="92" height="100" rx="4" fill="#1d2a24"/><rect x="34" y="22" width="26" height="26" fill="#444"/><rect x="38" y="26" width="18" height="18" fill="${color}"/>
           <rect x="70" y="18" width="5" height="40" fill="#888"/><rect x="80" y="18" width="5" height="40" fill="#888"/><rect x="22" y="66" width="70" height="6" fill="#555"/><rect x="22" y="80" width="70" height="6" fill="#555"/>
           <rect x="16" y="14" width="10" height="30" fill="#777"/>` + t(60, 104, 9);
      break;
    case 'ram':
      s = `<rect x="8" y="34" width="104" height="44" rx="3" fill="${c.tipo === 'DDR5' ? '#22262c' : '#2a3140'}"/><rect x="8" y="34" width="104" height="10" fill="${c.tipo === 'DDR5' ? '#7c4dff' : '#58a6ff'}"/>
           <rect x="8" y="78" width="104" height="6" fill="#c9a227"/><rect x="58" y="78" width="4" height="6" fill="#0d1117"/>` + t(60, 66, 12);
      break;
    case 'gpu':
      s = `<rect x="6" y="30" width="108" height="56" rx="6" fill="#23272e"/><rect x="6" y="30" width="108" height="6" rx="3" fill="${color}"/>
           <circle cx="36" cy="60" r="18" fill="#111"/><circle cx="36" cy="60" r="6" fill="#444"/><circle cx="84" cy="60" r="18" fill="#111"/><circle cx="84" cy="60" r="6" fill="#444"/>
           <rect x="20" y="86" width="50" height="6" fill="#c9a227"/>` + t(60, 106, 11, '#ddd');
      break;
    case 'almacenamiento':
      s = c.tipo === 'NVMe'
        ? `<rect x="8" y="44" width="104" height="30" rx="3" fill="#1f3b2a"/><rect x="20" y="50" width="26" height="18" fill="#222"/><rect x="54" y="50" width="22" height="18" fill="#222"/><rect x="104" y="48" width="8" height="22" fill="#c9a227"/>` + t(60, 92, 12, '#ddd')
        : `<rect x="20" y="22" width="80" height="76" rx="6" fill="#2b2f36"/><rect x="28" y="30" width="64" height="20" rx="3" fill="#58a6ff"/>` + t(60, 78, 13);
      break;
    case 'fuente':
      s = `<rect x="12" y="20" width="96" height="80" rx="6" fill="#23272e"/><circle cx="60" cy="58" r="28" fill="#111"/>`;
      for (let a = 0; a < 6; a++) s += `<line x1="60" y1="58" x2="${60 + 24 * Math.cos(a)}" y2="${58 + 24 * Math.sin(a)}" stroke="#333" stroke-width="3"/>`;
      s += `<rect x="20" y="88" width="80" height="12" fill="#3fb950"/>` + t(60, 98, 10, '#04260f');
      break;
    case 'gabinete':
      s = `<rect x="28" y="8" width="64" height="104" rx="5" fill="#22262c"/><rect x="34" y="14" width="40" height="92" rx="3" fill="#3a4250" opacity=".6"/>
           <circle cx="54" cy="34" r="9" fill="none" stroke="#58a6ff" stroke-width="3"/><circle cx="54" cy="58" r="9" fill="none" stroke="#58a6ff" stroke-width="3"/><circle cx="54" cy="82" r="9" fill="none" stroke="#58a6ff" stroke-width="3"/>
           <rect x="80" y="14" width="6" height="6" fill="#3fb950"/>` + t(60, 120, 10, '#ddd').replace('y="120"', 'y="118"');
      break;
    case 'cooler':
      s = c.tipo === 'agua'
        ? `<rect x="10" y="20" width="100" height="34" rx="4" fill="#23272e"/><circle cx="35" cy="37" r="13" fill="#111"/><circle cx="85" cy="37" r="13" fill="#111"/><path d="M40 54 Q40 80 60 86" stroke="#555" stroke-width="5" fill="none"/><path d="M80 54 Q80 80 60 86" stroke="#555" stroke-width="5" fill="none"/><circle cx="60" cy="92" r="14" fill="#2b2f36"/>`
        : `<rect x="30" y="16" width="60" height="70" fill="#9aa3ad"/>` + Array.from({ length: 12 }, (_, i) => `<line x1="30" y1="${20 + i * 6}" x2="90" y2="${20 + i * 6}" stroke="#6b737d"/>`).join('') +
          `<circle cx="60" cy="51" r="24" fill="#111" opacity=".85"/><rect x="40" y="88" width="40" height="10" fill="#c0c4ca"/>`;
      s += t(60, 114, 10, '#ddd');
      break;
    default:
      s = `<rect x="20" y="20" width="80" height="80" rx="8" fill="#2b2f36"/>`;
  }
  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${(c.nombre || '').replace(/"/g, '')}">${s}</svg>`;
}
