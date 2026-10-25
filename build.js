#!/usr/bin/env node
/* =====================================================================
   build.js — genera la vitrina publicable en /dist
   - Lee el catálogo de Firestore (colección 'catalogo')
   - Agrupa las categorías en departamentos (config.js)
   - Inicio corto + páginas por departamento y categoría con paginación
   - Página por producto, buscador, sitemap, robots, feeds Google/Meta
   Uso:   node build.js                      (lee Firestore)
          node build.js --local datos.json   (prueba con un JSON local)
   Requiere Node 18+. Sin dependencias.
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = __dirname;
const PUB = path.join(RAIZ, 'public');
const DIST = path.join(RAIZ, 'dist');

/* ---------- Configuración + funciones compartidas ---------- */
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(PUB, 'assets/config.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(PUB, 'assets/comun.js'), 'utf8'), ctx);
const T = ctx.window.TIENDA;
const MS = ctx.window.MS;
const { esc, pesos, sinTilde, slug, enOferta, precioVigente, cuota, descuento, tarjeta, ORDENES, fondo } = MS;
const DOM = (process.env.DOMINIO || T.dominio).replace(/\/$/, '');
const POR_PAGINA = T.productosPorPagina || 24;
const num = v => (v === null || v === undefined || v === '') ? null : Number(v);
const ld = o => JSON.stringify(o).replace(/</g, '\\u003c');
const abs = u => /^https?:/.test(u) ? u : DOM + u;

function copiar(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) {
    const a = path.join(src, f), b = path.join(dst, f);
    if (fs.statSync(a).isDirectory()) copiar(a, b); else fs.copyFileSync(a, b);
  }
}
function escribir(rel, contenido) {
  const f = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, contenido);
}

/* ---------- Firestore ---------- */
function decodificar(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodificar);
  if ('mapValue' in v) { const o = {}; for (const [k, x] of Object.entries(v.mapValue.fields || {})) o[k] = decodificar(x); return o; }
  return null;
}
async function leerFirestore() {
  const base = `https://firestore.googleapis.com/v1/projects/${T.firebase.projectId}/databases/(default)/documents/catalogo`;
  const out = []; let token = '';
  do {
    const r = await fetch(`${base}?pageSize=300&key=${T.firebase.apiKey}${token ? '&pageToken=' + token : ''}`);
    if (!r.ok) throw new Error(`Firestore respondió ${r.status}: ${await r.text()}`);
    const j = await r.json();
    for (const d of j.documents || []) {
      const f = {}; for (const [k, v] of Object.entries(d.fields || {})) f[k] = decodificar(v);
      out.push({ id: d.name.split('/').pop(), ...f });
    }
    token = j.nextPageToken || '';
  } while (token);
  return out;
}

/* ---------- Taxonomía ---------- */
const DEPTOS = T.departamentos.map(d => ({ ...d, claves: new Set(d.categorias.map(c => sinTilde(c).trim())) }));
const ALIAS = {}; for (const [k, v] of Object.entries(T.aliasCategorias || {})) ALIAS[sinTilde(k).trim()] = v;
const capital = s => { s = String(s || '').trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'General'; };
function clasificar(categoria) {
  const k = sinTilde(categoria).trim();
  const nombreSub = ALIAS[k] || capital(categoria);
  const kSub = sinTilde(nombreSub).trim();
  const d = DEPTOS.find(x => x.claves.has(k) || x.claves.has(kSub)) || DEPTOS[DEPTOS.length - 1];
  return { d, sub: nombreSub, subSlug: slug(nombreSub) };
}

/* ---------- Normalización + fotos ---------- */
function guardarFoto(src, nombreBase) {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  const m = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/i.exec(src);
  if (!m) return null;
  const ext = m[1].toLowerCase().replace('jpeg', 'jpg');
  const rel = `/img/p/${nombreBase}.${ext}`;
  escribir(rel, Buffer.from(m[2], 'base64'));
  return rel;
}
function normalizar(docs) {
  const usados = new Set();
  return docs.filter(d => d.estado !== 'inactivo' && d.nombre).map(d => {
    let s = slug(d.id || `${d.nombre}-${d.marca || ''}`) || slug(d.nombre);
    while (usados.has(s)) s += '-2';
    usados.add(s);
    const fuentes = (Array.isArray(d.imagenes) && d.imagenes.length ? d.imagenes : (d.imagen ? [d.imagen] : [])).filter(Boolean);
    const imgs = fuentes.map((src, i) => guardarFoto(src, `${s}-${i + 1}`)).filter(Boolean);
    const c = clasificar(d.categoria || 'General');
    const marca = String(d.marca || '').trim();
    return {
      id: d.id, slug: s, nombre: String(d.nombre).trim().replace(/\s+/g, ' '),
      categoriaOriginal: d.categoria || '', dept: c.d.nombre, deptSlug: c.d.slug, icono: c.d.icono, sub: c.sub, subSlug: c.subSlug,
      marca: marca ? marca.charAt(0).toUpperCase() + marca.slice(1) : '', color: d.color || '',
      contado: num(d.contado) || 0, credito: num(d.credito), meses: num(d.mesesCredito),
      estimado: !!d.creditoEstimado, promo: num(d.promoHoy), desc: d.desc || '', imgs, url: `/producto/${s}/`
    };
  }).filter(p => p.contado > 0);
}

/* ---------- Fragmentos ---------- */
function marcaHTML() {
  if (T.logo) return `<img src="${esc(T.logo)}" alt="${esc(T.nombre)}" width="142" height="46">`;
  return `<span class="marca-txt"><strong>${esc(T.nombreCorto)}</strong><span>${esc(T.lema)}</span></span>`;
}
function redesHTML() {
  const r = T.redes || {}, ic = { facebook: 'fb', instagram: 'ig', tiktok: 'tt', youtube: 'yt' };
  return Object.keys(ic).filter(k => r[k]).map(k => `<a href="${esc(r[k])}" target="_blank" rel="noopener" aria-label="${k}"><svg class="ico"><use href="#i-${ic[k]}"/></svg></a>`).join('');
}
const icono = (id, cls) => `<svg class="${cls || 'ico'}" aria-hidden="true"><use href="#d-${esc(id)}"/></svg>`;
function riel(items, id) {
  return `<div class="riel" data-riel><button class="riel-btn ant" type="button" data-riel-ant aria-label="Anteriores" aria-controls="${id}"><svg class="ico"><use href="#i-flecha"/></svg></button>` +
    `<div class="carril" id="${id}">${items.map(tarjeta).join('')}</div>` +
    `<button class="riel-btn sig" type="button" data-riel-sig aria-label="Siguientes" aria-controls="${id}"><svg class="ico"><use href="#i-flecha"/></svg></button></div>`;
}

/* ---------- Preguntas frecuentes ---------- */
const FAQ = [
  ['¿Cómo saco un producto a crédito?', `Escoge el producto y escríbenos por WhatsApp o visita la tienda en ${T.direccion.calle}. Un asesor revisa tu solicitud, te indica los documentos que necesitas y te propone un plan de cuotas.`],
  ['¿Las cuotas que aparecen en la página son definitivas?', 'Son una referencia. La cuota final depende del estudio de crédito y del plazo que elijas; un asesor te la confirma antes de cerrar la compra.'],
  ['¿Hacen entregas a domicilio? ¿A qué municipios llegan?', `Sí. Entregamos en ${T.direccion.ciudad} y en gran parte de los municipios de Sucre y Córdoba. La entrega está sujeta a cobertura: escríbenos por WhatsApp con tu municipio y te confirmamos si llegamos, el día y las condiciones.`],
  ['¿Dónde pago las cuotas de mi crédito?', 'Puedes pagar en la tienda o consultar tu saldo y cuotas pendientes por la línea de WhatsApp de pagos y cartera.'],
  ['¿Qué hago si un producto que compré presenta una falla?', 'Escríbenos a la línea de servicio técnico con tu número de contrato y una descripción de la falla para gestionar la revisión.'],
  ['¿Puedo ver los productos en persona?', `Claro. Estamos en ${T.direccion.calle}, ${T.direccion.ciudad}. ${T.horarioTexto ? 'Horario: ' + T.horarioTexto + '.' : ''}`.trim()]
];

/* ---------- Datos estructurados ---------- */
function negocio() {
  const n = {
    '@type': ['Store', 'LocalBusiness'], '@id': DOM + '/#tienda', name: T.nombre, slogan: T.lema, url: DOM + '/',
    image: [DOM + '/img/fachada.jpg', DOM + '/img/og-portada.jpg'], logo: abs(T.logo || '/img/icono-512.png'), telephone: T.telefono, priceRange: '$$',
    currenciesAccepted: 'COP', paymentAccepted: 'Efectivo, crédito directo',
    address: { '@type': 'PostalAddress', streetAddress: T.direccion.calle, addressLocality: T.direccion.ciudad, addressRegion: T.direccion.departamento, postalCode: T.direccion.codigoPostal, addressCountry: T.direccion.pais },
    areaServed: [{ '@type': 'City', name: T.direccion.ciudad }, { '@type': 'State', name: 'Sucre' }, { '@type': 'State', name: 'Córdoba' }],
    sameAs: [T.googlePerfil, ...Object.values(T.redes || {})].filter(Boolean)
  };
  if (T.correo) n.email = T.correo;
  if (T.geo && T.geo.lat) n.geo = { '@type': 'GeoCoordinates', latitude: T.geo.lat, longitude: T.geo.lng };
  if (T.horario && T.horario.length) n.openingHoursSpecification = T.horario.map(h => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: h.dias.map(d => 'https://schema.org/' + ({ Mo: 'Monday', Tu: 'Tuesday', We: 'Wednesday', Th: 'Thursday', Fr: 'Friday', Sa: 'Saturday', Su: 'Sunday' }[d])), opens: h.abre, closes: h.cierra }));
  if (T.nit) n.taxID = T.nit;
  return n;
}
function productoLD(p) {
  const o = {
    '@type': 'Product', '@id': DOM + p.url + '#producto', name: p.nombre, sku: p.slug, url: DOM + p.url, category: `${p.dept} > ${p.sub}`,
    description: p.desc || `${p.nombre} disponible en ${T.nombre}, ${T.direccion.ciudad}. Crédito directo y entrega a domicilio en Sucre y Córdoba.`,
    image: p.imgs.map(abs),
    offers: { '@type': 'Offer', url: DOM + p.url, priceCurrency: 'COP', price: precioVigente(p), availability: 'https://schema.org/InStock', itemCondition: 'https://schema.org/NewCondition', seller: { '@id': DOM + '/#tienda' } }
  };
  if (p.marca) o.brand = { '@type': 'Brand', name: p.marca };
  if (p.color) o.color = p.color;
  if (!o.image.length) delete o.image;
  return o;
}

/* ---------- Plantilla común ---------- */
const PLANTILLA = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
const corte = (a, b) => PLANTILLA.slice(PLANTILLA.indexOf(a), PLANTILLA.indexOf(b) + b.length);
const CABECERA = corte('<!--CABECERA-->', '<!--/CABECERA-->');
const PIE = corte('<!--PIE-->', '<!--/PIE-->');
const FUENTES = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Figtree:wght@400;600;700;800&display=swap" rel="stylesheet">';

let COMUNES = {};
function headExtra() {
  let h = '';
  if (T.googleVerificacion) h += `<meta name="google-site-verification" content="${esc(T.googleVerificacion)}">`;
  if (T.metaVerificacion) h += `<meta name="facebook-domain-verification" content="${esc(T.metaVerificacion)}">`;
  return h;
}
function fichas(html, extra) {
  const mapaQ = encodeURIComponent(`${T.nombre}, ${T.direccion.calle}, ${T.direccion.ciudad}, ${T.direccion.departamento}`);
  const t = Object.assign({
    NOMBRE: esc(T.nombre), LEMA: esc(T.lema), ANIOS: T.anios, TEL: esc(T.telefono), TEL_LINK: T.telefono.replace(/[^\d+]/g, ''),
    DIR: esc(T.direccion.calle), CIUDAD: esc(T.direccion.ciudad), DEPTO: esc(T.direccion.departamento), DOMINIO: DOM,
    WA_VENTAS: (T.whatsapp || {}).ventas || '', HORARIO: esc(T.horarioTexto || ''), NIT: esc(T.nit || ''), ANIO: new Date().getFullYear(),
    GOOGLE_PERFIL: esc(T.googlePerfil || ''), MAPA_Q: mapaQ, HEAD_EXTRA: headExtra(), MARCA: marcaHTML(), REDES: redesHTML()
  }, COMUNES, extra || {});
  // dos pasadas: algunos fragmentos contienen fichas
  let out = html;
  for (let i = 0; i < 2; i++) out = out.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in t ? t[k] : ''));
  return out;
}
function pagina({ titulo, descripcion, url, imagen, tipoOG, schema, cuerpo, bodyAttrs, extra, noindex }) {
  return fichas(`<!doctype html>
<html lang="es-CO">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descripcion)}">
<link rel="canonical" href="${DOM}${url}">
<meta name="robots" content="${noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large'}">
<meta name="theme-color" content="#2E3095">
<meta property="og:type" content="${tipoOG || 'website'}">
<meta property="og:locale" content="es_CO">
<meta property="og:site_name" content="{{NOMBRE}}">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descripcion)}">
<meta property="og:url" content="${DOM}${url}">
<meta property="og:image" content="${esc(imagen || DOM + '/img/og-portada.jpg')}">
<meta name="twitter:card" content="summary_large_image">
{{HEAD_EXTRA}}
<link rel="icon" href="/img/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="/img/icono-192.png">
<link rel="manifest" href="/manifest.webmanifest">
${FUENTES}
<link rel="stylesheet" href="/assets/styles.css">
<script type="application/ld+json">${ld({ '@context': 'https://schema.org', '@graph': schema })}</script>
</head>
<body ${bodyAttrs || ''}>
<a class="sr" href="#contenido">Saltar al contenido</a>
${CABECERA}
<main id="contenido">
${cuerpo}
</main>
${PIE}
<script src="/assets/config.js"></script>
<script src="/assets/comun.js"></script>
${extra || ''}
<script src="/assets/app.js" defer></script>
</body>
</html>`);
}
function migas(items) {
  const html = '<nav class="migas" aria-label="Ruta"><ol>' + items.map((it, i) => i < items.length - 1 ? `<li><a href="${esc(it[1])}">${esc(it[0])}</a></li>` : `<li aria-current="page">${esc(it[0])}</li>`).join('') + '</ol></nav>';
  const schema = { '@type': 'BreadcrumbList', itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it[0], item: DOM + it[1] })) };
  return { html, schema };
}

/* ---------- Página de producto ---------- */
function detalleHTML(p) {
  const c = cuota(p), d = descuento(p);
  const gal = `<div class="galeria"><div class="principal${p.imgs[0] ? ' conf' : ''}"${fondo(p.imgs[0])}>${p.imgs[0] ? `<img data-foto-principal src="${esc(p.imgs[0])}" alt="${esc(p.nombre)}" width="700" height="700" fetchpriority="high">` : MS.foto(p, 700)}${d ? `<span class="dto grande">-${d}%</span>` : ''}</div>${p.imgs.length > 1 ? '<div class="miniaturas">' + p.imgs.map((src, i) => `<button type="button" data-mini="${i}" aria-label="Foto ${i + 1}" aria-current="${i === 0}"><img src="${esc(src)}" alt="${esc(p.nombre)}, foto ${i + 1}" loading="lazy"></button>`).join('') + '</div>' : ''}</div>`;
  const precio = `<div class="caja-precio">${c ? `<div class="credito"><small>Cuota a crédito${p.estimado ? ' (aproximada)' : ''}</small><strong>${pesos(c)}</strong> <span>al mes × ${p.meses} meses</span></div>` : ''}<div class="contado-l"><span>Precio de contado</span><span>${d ? `<s>${pesos(p.contado)}</s> ` : ''}<b>${pesos(precioVigente(p))}</b></span></div></div>`;
  const ft = [['Marca', p.marca], ['Color', p.color], ['Categoría', p.sub]].filter(x => x[1]);
  const msg = encodeURIComponent(`Hola, me interesa este producto:\n• ${p.nombre}${p.marca ? ' (' + p.marca + ')' : ''}\nContado: ${pesos(precioVigente(p))}${c ? `\nCuota: ${pesos(c)} x ${p.meses} meses` : ''}\n${DOM}${p.url}`);
  return `${gal}<div class="detalle">${p.marca ? `<p class="meta">${esc(p.marca)}</p>` : ''}<h1>${esc(p.nombre)}</h1>${precio}${p.desc ? `<p class="desc">${esc(p.desc)}</p>` : ''}${ft.length ? '<dl class="ficha-tecnica">' + ft.map(x => `<dt>${x[0]}</dt><dd>${esc(x[1])}</dd>`).join('') + '</dl>' : ''}<div class="botones"><a class="btn btn-wa" target="_blank" rel="noopener" data-wa-producto="${esc(p.slug)}" href="https://wa.me/${(T.whatsapp || {}).ventas}?text=${msg}"><svg class="ico"><use href="#i-wa"/></svg>Lo quiero, escribir por WhatsApp</a><button class="btn btn-borde" type="button" data-agregar="${esc(p.slug)}">Agregar a cotización</button></div><ul class="garantias"><li><svg class="ico"><use href="#i-cuota"/></svg>Crédito directo con el almacén</li><li><svg class="ico"><use href="#i-camion"/></svg>Domicilio en Sucre y Córdoba (sujeto a cobertura)</li><li><svg class="ico"><use href="#i-tienda"/></svg>Míralo en la tienda: ${esc(T.direccion.calle)}</li></ul><p class="nota">Precios en COP. La cuota depende del estudio de crédito; un asesor la confirma.</p></div>`;
}

/* ---------- Página de listado (departamento, categoría, búsqueda) ---------- */
function htmlPaginacion(total, actual, base) {
  const n = Math.ceil(total / POR_PAGINA); if (n <= 1) return '';
  const url = k => k === 1 ? base : `${base}pagina/${k}/`;
  let h = '<nav class="paginacion" aria-label="Páginas">';
  if (actual > 1) h += `<a class="pag-flecha" href="${url(actual - 1)}" rel="prev">Anterior</a>`;
  for (let k = 1; k <= n; k++) {
    if (n > 7 && k !== 1 && k !== n && Math.abs(k - actual) > 1) { if (k === 2 || k === n - 1) h += '<span class="pag-puntos">…</span>'; continue; }
    h += k === actual ? `<span class="pag-num" aria-current="page">${k}</span>` : `<a class="pag-num" href="${url(k)}">${k}</a>`;
  }
  if (actual < n) h += `<a class="pag-flecha" href="${url(actual + 1)}" rel="next">Siguiente</a>`;
  return h + '</nav>';
}
function htmlListado({ h1, intro, chips, items, actual, base, alcance }) {
  const ini = (actual - 1) * POR_PAGINA;
  const pagina = items.slice(ini, ini + POR_PAGINA);
  const total = items.length;
  return `<section class="listado" data-listado data-alcance='${esc(JSON.stringify(alcance))}' data-pagina-actual="${actual}" data-base="${esc(base)}">
<div class="envoltura">
  <header class="listado-cab"><h1>${esc(h1)}</h1>${intro ? `<p>${intro}</p>` : ''}</header>
  ${chips ? `<nav class="subcats" aria-label="Categorías">${chips}</nav>` : ''}
  <div class="listado-cuerpo">
    <aside class="filtros" data-filtros aria-label="Filtros">
      <div class="filtros-cab"><strong>Filtrar</strong><button class="cerrar" type="button" data-cerrar-filtros aria-label="Cerrar filtros">×</button></div>
      <div data-facetas><p class="nota">Cargando filtros…</p></div>
      <div class="filtros-pie"><button class="btn btn-azul" type="button" data-cerrar-filtros>Ver productos</button></div>
    </aside>
    <div class="resultados">
      <div class="barra-res">
        <button class="btn-filtrar" type="button" data-abrir-filtros><svg class="ico"><use href="#i-filtro"/></svg>Filtrar</button>
        <span class="total" data-total aria-live="polite">${total} ${total === 1 ? 'producto' : 'productos'}</span>
        <label class="orden"><span>Ordenar por</span><select data-orden>
          <option value="relevancia">Recomendados</option><option value="descuento">Mayor descuento</option><option value="cuota">Menor cuota</option><option value="menor">Menor precio</option><option value="mayor">Mayor precio</option>
        </select></label>
      </div>
      <div class="chips-activos" data-activos></div>
      <div class="rejilla" data-rejilla>${pagina.map(tarjeta).join('')}</div>
      <div data-paginacion>${htmlPaginacion(total, actual, base)}</div>
    </div>
  </div>
</div>
</section>`;
}

/* ---------- Programa principal ---------- */
(async function () {
  const i = process.argv.indexOf('--local');
  let docs;
  if (i > -1) docs = JSON.parse(fs.readFileSync(process.argv[i + 1], 'utf8'));
  else {
    try { docs = await leerFirestore(); }
    catch (e) {
      console.error('⚠️  No se pudo leer Firestore:', e.message);
      console.error('    El sitio se publicará sin productos. Revisa las reglas (firestore.rules).');
      docs = [];
    }
  }

  fs.rmSync(DIST, { recursive: true, force: true });
  copiar(PUB, DIST);
  const productos = normalizar(docs).sort(ORDENES.relevancia);
  console.log(`✔ ${productos.length} productos activos`);

  /* --- Árbol departamento → categorías --- */
  const arbol = DEPTOS.map(d => {
    const items = productos.filter(p => p.deptSlug === d.slug);
    const subs = {};
    items.forEach(p => { (subs[p.subSlug] = subs[p.subSlug] || { slug: p.subSlug, nombre: p.sub, items: [] }).items.push(p); });
    const lista = Object.values(subs).sort((a, b) => b.items.length - a.items.length || a.nombre.localeCompare(b.nombre, 'es'));
    return { ...d, items, subs: lista, url: `/categoria/${d.slug}/` };
  }).filter(d => d.items.length);
  const conSubs = d => d.subs.length > 1;
  const urlSub = (d, s) => conSubs(d) ? `${d.url}${s.slug}/` : d.url;
  productos.forEach(p => { const d = arbol.find(x => x.slug === p.deptSlug); const s = d.subs.find(x => x.slug === p.subSlug); p.subUrl = urlSub(d, s); p.deptUrl = d.url; });

  /* --- Fragmentos comunes (menú, pie) --- */
  const NAV_DEPTOS = arbol.map(d => `<a href="${d.url}" data-dept="${d.slug}">${esc(d.nombre)}</a>`).join('');
  const MEGA = arbol.map(d => `<div class="mega-col"><a class="mega-dept" href="${d.url}">${icono(d.icono)}<span>${esc(d.nombre)}</span></a>${conSubs(d) ? '<ul>' + d.subs.map(s => `<li><a href="${urlSub(d, s)}">${esc(s.nombre)} <small>${s.items.length}</small></a></li>`).join('') + `<li><a class="mega-todo" href="${d.url}">Ver todo</a></li></ul>` : ''}</div>`).join('');
  const PIE_CATS = arbol.map(d => `<li><a href="${d.url}">${esc(d.nombre)}</a></li>`).join('') || '<li><a href="/">Inicio</a></li>';
  COMUNES = { NAV_DEPTOS, MEGA, PIE_CATS };

  /* --- catalogo.json (lo usa el navegador) --- */
  escribir('catalogo.json', JSON.stringify({ generado: new Date().toISOString(), porPagina: POR_PAGINA, productos }));

  /* --- Inicio --- */
  const conFoto = productos.filter(p => p.imgs.length);
  const ofertas = productos.filter(enOferta).sort(ORDENES.descuento);
  const slides = [];
  slides.push(`<div class="slide slide-marca" data-slide>
    <div class="slide-txt"><h1>Llévalo hoy,<br><span class="linea-roja">págalo en cuotas.</span></h1>
    <p>Electrodomésticos y muebles con crédito directo del almacén. Entregamos a domicilio en Sucre y Córdoba (sujeto a cobertura). Más de {{ANIOS}} años en la Avenida Okola.</p>
    <div class="ctas"><a class="btn btn-rojo" href="#departamentos">Ver productos</a><a class="btn btn-borde-claro" href="https://wa.me/{{WA_VENTAS}}?text=Hola%2C%20quiero%20saber%20c%C3%B3mo%20sacar%20un%20cr%C3%A9dito" target="_blank" rel="noopener" data-wa="ventas" data-origen="portada">Pregunta por tu crédito</a></div></div>
    <div class="slide-img foto-tienda"><img src="/img/fachada.jpg" alt="Fachada de {{NOMBRE}} en la Avenida Okola" width="647" height="400" fetchpriority="high"></div></div>`);
  ofertas.filter(p => p.imgs.length).slice(0, 3).forEach(p => {
    const c = cuota(p);
    slides.push(`<div class="slide" data-slide hidden>
      <div class="slide-txt"><p class="slide-etq">Oferta de hoy · -${descuento(p)}%</p><h2>${esc(p.nombre)}</h2>
      ${c ? `<p class="slide-cuota"><b>${pesos(c)}</b> al mes × ${p.meses}</p>` : ''}
      <p class="slide-contado">Contado <s>${pesos(p.contado)}</s> <b>${pesos(precioVigente(p))}</b></p>
      <div class="ctas"><a class="btn btn-rojo" href="${p.url}">Ver producto</a><a class="btn btn-borde-claro" href="${p.deptUrl}">Más en ${esc(p.dept)}</a></div></div>
      <a class="slide-img conf" href="${p.url}" tabindex="-1" aria-hidden="true"${fondo(p.imgs[0])}><img src="${esc(p.imgs[0])}" alt="" width="520" height="520" loading="lazy"></a></div>`);
  });
  const SLIDER = `<div class="slider" data-slider><div class="envoltura">${slides.join('')}</div>${slides.length > 1 ? `<div class="slider-ctrl envoltura"><button type="button" class="slider-btn" data-slider-ant aria-label="Anterior"><svg class="ico" style="transform:scaleX(-1)"><use href="#i-flecha"/></svg></button><div class="puntos" role="tablist" aria-label="Destacados">${slides.map((_, k) => `<button type="button" role="tab" aria-label="Destacado ${k + 1}" aria-selected="${k === 0}" data-punto="${k}"></button>`).join('')}</div><button type="button" class="slider-btn" data-slider-sig aria-label="Siguiente"><svg class="ico"><use href="#i-flecha"/></svg></button></div>` : ''}</div>`;

  const DEPTOS_HTML = arbol.map(d => {
    const conImg = d.items.find(p => p.imgs.length);
    const cuotas = d.items.map(cuota).filter(Boolean);
    const desde = cuotas.length ? `Cuotas desde ${pesos(Math.min(...cuotas))}` : `Desde ${pesos(Math.min(...d.items.map(precioVigente)))}`;
    return `<a class="depto" href="${d.url}"><span class="depto-img${conImg ? ' conf' : ''}"${conImg ? fondo(conImg.imgs[0]) : ''}>${conImg ? `<img src="${esc(conImg.imgs[0])}" alt="" width="240" height="240" loading="lazy">` : icono(d.icono, 'depto-ico')}</span><span class="depto-txt"><strong>${esc(d.nombre)}</strong><small>${d.items.length} ${d.items.length === 1 ? 'producto' : 'productos'}</small><small class="desde">${desde}</small></span></a>`;
  }).join('');

  const OFERTAS = ofertas.length ? `<section class="seccion gris" id="ofertas" aria-labelledby="t-ofertas"><div class="envoltura"><div class="titulo-sec"><div><h2 id="t-ofertas">Ofertas de hoy</h2><p>Precios especiales mientras haya existencias.</p></div></div>${riel(ofertas.slice(0, 12), 'riel-ofertas')}</div></section>` : '';

  const negocioD = arbol.find(d => d.slug === 'equipos-para-negocio');
  const NEGOCIO = negocioD ? `<section class="seccion" aria-labelledby="t-negocio"><div class="envoltura"><div class="banda-negocio">
    <div class="bn-txt"><h2 id="t-negocio">¿Tienes tienda, restaurante o negocio?</h2><p>${esc(negocioD.descripcion || '')} También a crédito directo.</p><a class="btn btn-rojo" href="${negocioD.url}">Ver equipos para negocio</a></div>
    <div class="bn-fotos">${negocioD.items.filter(p => p.imgs.length).slice(0, 3).map(p => `<a class="conf" href="${p.url}"${fondo(p.imgs[0])}><img src="${esc(p.imgs[0])}" alt="${esc(p.nombre)}" width="200" height="200" loading="lazy"></a>`).join('')}</div>
  </div></div></section>` : '';

  const rielDeptos = [...arbol].filter(d => d.slug !== 'equipos-para-negocio').sort((a, b) => b.items.filter(p => p.imgs.length).length - a.items.filter(p => p.imgs.length).length || b.items.length - a.items.length).slice(0, 4);
  const RIELES = rielDeptos.map((d, k) => `<section class="seccion${k % 2 === 0 ? ' gris' : ''}" aria-labelledby="t-r-${d.slug}"><div class="envoltura"><div class="titulo-sec"><div><h2 id="t-r-${d.slug}">${esc(d.nombre)}</h2>${conSubs(d) ? `<p class="mini-subs">${d.subs.slice(0, 5).map(s => `<a href="${urlSub(d, s)}">${esc(s.nombre)}</a>`).join('')}</p>` : ''}</div><a class="btn btn-ver" href="${d.url}">Ver todos (${d.items.length})</a></div>${riel(d.items.slice(0, 10), 'riel-' + d.slug)}</div></section>`).join('');

  const faqHTML = FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');
  const schemaInicio = {
    '@context': 'https://schema.org', '@graph': [
      negocio(),
      { '@type': 'WebSite', '@id': DOM + '/#web', url: DOM + '/', name: T.nombre, inLanguage: 'es-CO', publisher: { '@id': DOM + '/#tienda' }, potentialAction: { '@type': 'SearchAction', target: DOM + '/buscar/?q={search_term_string}', 'query-input': 'required name=search_term_string' } },
      { '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
      { '@type': 'ItemList', name: 'Departamentos', itemListElement: arbol.map((d, n) => ({ '@type': 'ListItem', position: n + 1, url: DOM + d.url, name: d.nombre })) }
    ]
  };
  escribir('index.html', fichas(PLANTILLA, { SCHEMA_ORG: ld(schemaInicio), SLIDER, DEPTOS: DEPTOS_HTML, OFERTAS, NEGOCIO, RIELES, FAQ_HTML: faqHTML }));

  /* --- Departamentos y categorías (con paginación) --- */
  const urlsListado = [];
  function generarListado({ base, titulo, descripcion, h1, intro, chips, items, alcance, migasItems, extraSchema }) {
    const n = Math.max(1, Math.ceil(items.length / POR_PAGINA));
    for (let k = 1; k <= n; k++) {
      const url = k === 1 ? base : `${base}pagina/${k}/`;
      const m = migas(k === 1 ? migasItems : [...migasItems, [`Página ${k}`, url]]);
      const ini = (k - 1) * POR_PAGINA;
      escribir(url.slice(1) + 'index.html', pagina({
        titulo: k === 1 ? titulo : `${titulo.replace(/ \|.*$/, '')} – página ${k} | ${T.nombreCorto}`,
        descripcion, url, imagen: (items.find(p => p.imgs.length) || {}).imgs ? abs(items.find(p => p.imgs.length).imgs[0]) : null,
        schema: [negocio(), { '@type': 'CollectionPage', name: h1, url: DOM + url, mainEntity: { '@type': 'ItemList', itemListElement: items.slice(ini, ini + POR_PAGINA).map((p, x) => ({ '@type': 'ListItem', position: ini + x + 1, url: DOM + p.url, name: p.nombre })) } }, m.schema, ...(extraSchema || [])],
        cuerpo: `<div class="envoltura">${m.html}</div>` + htmlListado({ h1: k === 1 ? h1 : `${h1} – página ${k}`, intro: k === 1 ? intro : '', chips, items, actual: k, base, alcance }),
        bodyAttrs: 'data-pagina="listado"'
      }));
      urlsListado.push([url, k === 1 ? '0.8' : '0.4']);
    }
  }
  for (const d of arbol) {
    const marcas = [...new Set(d.items.map(p => p.marca).filter(Boolean))].slice(0, 5);
    const cuotas = d.items.map(cuota).filter(Boolean);
    const chip = (s, activo) => `<a class="subcat${activo ? ' activa' : ''}" href="${urlSub(d, s)}"${activo ? ' aria-current="page"' : ''}>${esc(s.nombre)} <small>${s.items.length}</small></a>`;
    const chipsDept = conSubs(d) ? `<a class="subcat activa" href="${d.url}" aria-current="page">Todo <small>${d.items.length}</small></a>` + d.subs.map(s => chip(s, false)).join('') : '';
    generarListado({
      base: d.url, titulo: `${d.nombre} a crédito en Sincelejo | ${T.nombreCorto}`,
      descripcion: `${d.nombre} en ${T.direccion.ciudad} con crédito directo y entrega a domicilio. ${d.items.length} opciones${marcas.length ? ': ' + marcas.join(', ') : ''}.`,
      h1: `${d.nombre} en Sincelejo`,
      intro: `${d.descripcion ? esc(d.descripcion) + ' ' : ''}${d.items.length} ${d.items.length === 1 ? 'producto' : 'productos'}${cuotas.length ? `, cuotas desde ${pesos(Math.min(...cuotas))} al mes` : ''}. Crédito directo y domicilio en Sucre y Córdoba (sujeto a cobertura).`,
      chips: chipsDept, items: d.items, alcance: { dept: d.slug }, migasItems: [['Inicio', '/'], [d.nombre, d.url]]
    });
    if (conSubs(d)) for (const s of d.subs) {
      const chipsSub = `<a class="subcat" href="${d.url}">Todo <small>${d.items.length}</small></a>` + d.subs.map(x => chip(x, x === s)).join('');
      generarListado({
        base: urlSub(d, s), titulo: `${s.nombre} a crédito en Sincelejo | ${T.nombreCorto}`,
        descripcion: `Compra ${s.nombre.toLowerCase()} en ${T.direccion.ciudad} con crédito directo y entrega a domicilio. ${s.items.length} ${s.items.length === 1 ? 'opción' : 'opciones'} desde ${pesos(Math.min(...s.items.map(precioVigente)))}.`,
        h1: `${s.nombre} en Sincelejo`, intro: `${s.items.length} ${s.items.length === 1 ? 'producto' : 'productos'} con crédito directo y domicilio en Sucre y Córdoba (sujeto a cobertura).`,
        chips: chipsSub, items: s.items, alcance: { dept: d.slug, sub: s.slug }, migasItems: [['Inicio', '/'], [d.nombre, d.url], [s.nombre, urlSub(d, s)]]
      });
    }
  }

  /* --- Buscador --- */
  escribir('buscar/index.html', pagina({
    titulo: `Buscar productos | ${T.nombreCorto}`, descripcion: `Busca electrodomésticos y muebles en ${T.nombre}.`, url: '/buscar/', noindex: true, schema: [negocio()],
    cuerpo: `<div class="envoltura">${migas([['Inicio', '/'], ['Buscar', '/buscar/']]).html}</div>` + htmlListado({ h1: 'Buscar productos', intro: '', chips: '', items: [], actual: 1, base: '/buscar/', alcance: { buscar: true } }),
    bodyAttrs: 'data-pagina="buscar"'
  }));

  /* --- Productos --- */
  for (const p of productos) {
    const d = arbol.find(x => x.slug === p.deptSlug);
    const rutas = [['Inicio', '/'], [p.dept, p.deptUrl]];
    if (conSubs(d)) rutas.push([p.sub, p.subUrl]);
    rutas.push([p.nombre, p.url]);
    const m = migas(rutas);
    const mismos = d.items.filter(x => x !== p && x.subSlug === p.subSlug);
    const relacionados = [...mismos, ...d.items.filter(x => x !== p && x.subSlug !== p.subSlug)].slice(0, 10);
    const c = cuota(p);
    const titulo = `${p.nombre}${p.marca && !sinTilde(p.nombre).includes(sinTilde(p.marca)) ? ' ' + p.marca : ''} a crédito en Sincelejo | ${T.nombreCorto}`;
    const desc = `${p.nombre} en ${T.direccion.ciudad}: ${pesos(precioVigente(p))} de contado${c ? ` o ${pesos(c)} al mes × ${p.meses}` : ''}. Crédito directo y domicilio en Sucre y Córdoba. Cotiza por WhatsApp.`;
    const cuerpo = `<div class="envoltura">${m.html}<div class="pagina-producto" data-detalle-producto data-slug="${esc(p.slug)}">${detalleHTML(p)}</div></div>` +
      (relacionados.length ? `<section class="seccion"><div class="envoltura"><div class="titulo-sec"><div><h2>También te puede interesar</h2></div><a class="btn btn-ver" href="${p.subUrl}">Ver todo en ${esc(conSubs(d) ? p.sub : p.dept)}</a></div>${riel(relacionados, 'riel-rel')}</div></section>` : '');
    escribir(`producto/${p.slug}/index.html`, pagina({
      titulo, descripcion: desc, url: p.url, imagen: p.imgs[0] ? abs(p.imgs[0]) : null, tipoOG: 'product',
      schema: [negocio(), productoLD(p), m.schema], cuerpo, bodyAttrs: 'data-pagina="producto"',
      extra: `<script>window.__PRODUCTO=${ld(p)};</script>`
    }));
  }

  /* --- Política de privacidad --- */
  {
    const f = path.join(DIST, 'politica-de-privacidad/index.html');
    if (fs.existsSync(f)) fs.writeFileSync(f, fichas(fs.readFileSync(f, 'utf8').replace('<!--INCLUIR_CABECERA-->', CABECERA).replace('<!--INCLUIR_PIE-->', PIE)));
  }

  /* --- 404 --- */
  escribir('404.html', pagina({
    titulo: `Página no encontrada | ${T.nombreCorto}`, descripcion: 'Esta página no existe.', url: '/404', schema: [negocio()], noindex: true,
    cuerpo: `<section class="seccion"><div class="envoltura" style="text-align:center;max-width:640px"><h1 style="font-family:var(--f-disp);font-size:40px;letter-spacing:-.03em">No encontramos esta página</h1><p>Puede que el producto ya no esté publicado. Mira los departamentos o pregúntale a un asesor.</p><div class="deptos" style="margin:24px 0">${DEPTOS_HTML}</div><p style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><a class="btn btn-azul" href="/">Ir al inicio</a><a class="btn btn-wa" href="https://wa.me/${(T.whatsapp || {}).ventas}" target="_blank" rel="noopener">Escribir por WhatsApp</a></p></div></section>`,
    bodyAttrs: 'data-pagina="404"'
  }));

  /* --- Redirecciones de las direcciones anteriores --- */
  const nuevas = new Set(['/', ...urlsListado.map(u => u[0])]);
  const redir = new Map();
  productos.forEach(p => { const vieja = `/categoria/${slug(p.categoriaOriginal || 'General')}/`; if (!nuevas.has(vieja) && !redir.has(vieja)) redir.set(vieja, p.subUrl); });
  escribir('_redirects', [...redir].map(([a, b]) => `${a} ${b} 301`).join('\n') + '\n');

  /* --- Sitemap y robots --- */
  const hoy = new Date().toISOString().slice(0, 10);
  const urls = [['/', '1.0'], ...urlsListado, ...productos.map(p => [p.url, '0.7', p.imgs.map(abs)]), ['/politica-de-privacidad/', '0.2']];
  escribir('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map(([u, pr, imgs]) => `<url><loc>${DOM}${u}</loc><lastmod>${hoy}</lastmod><priority>${pr}</priority>${(imgs || []).map(im => `<image:image><image:loc>${esc(im)}</image:loc></image:image>`).join('')}</url>`).join('\n')}
</urlset>`);
  escribir('robots.txt', `User-agent: *\nAllow: /\nDisallow: /buscar/\nDisallow: /*?*orden=\nDisallow: /*?*marca=\n\nSitemap: ${DOM}/sitemap.xml\n`);

  /* --- Feed Google Merchant Center --- */
  const gItem = p => {
    const tit = `${p.nombre}${p.marca && !sinTilde(p.nombre).includes(sinTilde(p.marca)) ? ' ' + p.marca : ''}`.slice(0, 150);
    const d = (p.desc || `${p.nombre}${p.color ? ' color ' + p.color : ''}. Disponible en ${T.nombre}, ${T.direccion.ciudad}. Crédito directo y entrega a domicilio en Sucre y Córdoba.`).slice(0, 4900);
    return `<item>
<g:id>${esc(p.slug)}</g:id><g:title>${esc(tit)}</g:title><g:description>${esc(d)}</g:description>
<g:link>${DOM}${p.url}</g:link><g:image_link>${esc(abs(p.imgs[0]))}</g:image_link>${p.imgs.slice(1, 10).map(im => `<g:additional_image_link>${esc(abs(im))}</g:additional_image_link>`).join('')}
<g:availability>in_stock</g:availability><g:condition>new</g:condition>
<g:price>${Math.round(p.contado)} COP</g:price>${enOferta(p) ? `<g:sale_price>${Math.round(p.promo)} COP</g:sale_price>` : ''}
${p.marca ? `<g:brand>${esc(p.marca)}</g:brand>` : ''}<g:identifier_exists>no</g:identifier_exists>
<g:product_type>${esc(p.dept + ' > ' + p.sub)}</g:product_type>${p.color ? `<g:color>${esc(p.color)}</g:color>` : ''}
</item>`;
  };
  escribir('feeds/google.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>
<title>${esc(T.nombre)}</title><link>${DOM}/</link><description>Catálogo de ${esc(T.nombre)}</description>
${conFoto.map(gItem).join('\n')}
</channel></rss>`);

  /* --- Feed Meta (Facebook / Instagram / WhatsApp) --- */
  const csv = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const filas = [['id', 'title', 'description', 'availability', 'condition', 'price', 'sale_price', 'link', 'image_link', 'additional_image_link', 'brand', 'product_type', 'color']]
    .concat(conFoto.map(p => [p.slug, p.nombre.slice(0, 200), (p.desc || `${p.nombre}. Crédito directo y entrega a domicilio en ${T.direccion.ciudad}.`).slice(0, 9000), 'in stock', 'new', `${Math.round(p.contado)} COP`, enOferta(p) ? `${Math.round(p.promo)} COP` : '', DOM + p.url, abs(p.imgs[0]), p.imgs.slice(1, 10).map(abs).join(','), p.marca || T.nombre, `${p.dept} > ${p.sub}`, p.color]));
  escribir('feeds/meta.csv', '﻿' + filas.map(f => f.map(csv).join(',')).join('\n'));

  /* --- Caché --- */
  escribir('_headers', `/assets/*\n  Cache-Control: public, max-age=3600\n/img/*\n  Cache-Control: public, max-age=604800\n/catalogo.json\n  Cache-Control: public, max-age=300\n/feeds/*\n  Cache-Control: public, max-age=3600\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`);

  console.log(`✔ ${arbol.length} departamentos · ${arbol.reduce((t, d) => t + d.subs.length, 0)} categorías · ${urlsListado.length} páginas de listado`);
  console.log(`✔ ${conFoto.length}/${productos.length} productos con foto en los feeds`);
  if (conFoto.length < productos.length) console.log(`  ⚠️  ${productos.length - conFoto.length} productos sin foto: no aparecerán en Google Shopping ni en Instagram hasta que les subas una.`);
  if (redir.size) console.log(`✔ ${redir.size} redirecciones desde direcciones anteriores`);
  console.log('✔ dist/ listo para publicar');
})().catch(e => { console.error(e); process.exit(1); });
