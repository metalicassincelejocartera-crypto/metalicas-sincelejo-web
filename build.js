#!/usr/bin/env node
/* =====================================================================
   build.js — genera la versión publicable de la vitrina en /dist
   - Lee el catálogo de Firestore (colección 'catalogo')
   - Extrae las fotos (base64) a archivos /img/p/*.jpg
   - Crea una página por producto y por categoría (SEO)
   - Genera sitemap.xml, robots.txt, catalogo.json
   - Genera feeds para Google Merchant Center y Meta (Facebook/Instagram)
   Uso:   node build.js                 (lee Firestore)
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

/* ---------- Configuración ---------- */
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(PUB, 'assets/config.js'), 'utf8'), ctx);
const T = ctx.window.TIENDA;
const DOM = (process.env.DOMINIO || T.dominio).replace(/\/$/, '');

/* ---------- Utilidades ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sinTilde = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const slug = s => sinTilde(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const pesos = n => '$ ' + Math.round(Number(n) || 0).toLocaleString('es-CO');
const num = v => (v === null || v === undefined || v === '') ? null : Number(v);
const precioVigente = p => (p.promo != null && p.promo > 0 && p.promo < p.contado) ? p.promo : p.contado;
const cuota = p => (p.credito && p.meses) ? Math.round(p.credito / p.meses) : null;
const enOferta = p => p.promo != null && p.promo > 0 && p.promo < p.contado;
const ld = o => JSON.stringify(o).replace(/</g, '\\u003c');
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
    return {
      id: d.id, slug: s, nombre: String(d.nombre).trim(), categoria: d.categoria || 'General', catSlug: slug(d.categoria || 'General'),
      marca: d.marca || '', color: d.color || '', contado: num(d.contado) || 0, credito: num(d.credito), meses: num(d.mesesCredito),
      estimado: !!d.creditoEstimado, promo: num(d.promoHoy), desc: d.desc || '', imgs, url: `/producto/${s}/`
    };
  }).filter(p => p.contado > 0);
}
const abs = u => /^https?:/.test(u) ? u : DOM + u;

/* ---------- Fragmentos HTML ---------- */
function tarjeta(p) {
  const c = cuota(p), oferta = enOferta(p);
  const foto = p.imgs[0] ? `<img src="${esc(p.imgs[0])}" alt="${esc(p.nombre)}" loading="lazy" decoding="async" width="400" height="400">` : '<span class="sin-foto" aria-hidden="true">📦</span>';
  const ins = (oferta ? '<span class="insignia">Oferta</span>' : '') + (c ? '<span class="insignia azul">A crédito</span>' : '');
  const precio = c
    ? `<div class="cuota"><span class="valor">${pesos(c)}</span><span class="por">al mes × ${p.meses}</span></div><div class="contado">Contado ${oferta ? `<s>${pesos(p.contado)}</s>` : ''}<b>${pesos(precioVigente(p))}</b></div>`
    : `<div class="cuota"><span class="valor">${pesos(precioVigente(p))}</span><span class="por">de contado</span></div>${oferta ? `<div class="contado">Antes <s>${pesos(p.contado)}</s></div>` : ''}`;
  return `<article class="tarjeta" data-id="${esc(p.slug)}"><div class="foto">${foto}<div class="insignias">${ins}</div></div><div class="cuerpo"><span class="meta">${esc([p.categoria, p.marca].filter(Boolean).join(' · '))}</span><h3><a href="${esc(p.url)}" data-ver="${esc(p.slug)}">${esc(p.nombre)}</a></h3><div class="precios">${precio}${p.estimado && c ? '<div class="nota">Cuota aproximada</div>' : ''}</div><button class="agregar" type="button" data-agregar="${esc(p.slug)}">Agregar a cotización</button></div></article>`;
}
function marcaHTML() {
  if (T.logo) return `<img src="${esc(T.logo)}" alt="${esc(T.nombre)}" width="142" height="46">`;
  return `<span class="marca-logo" aria-hidden="true">M</span><span class="marca-txt"><strong>${esc(T.nombreCorto)}</strong><span>${esc(T.lema)} · Sincelejo</span></span>`;
}
function redesHTML() {
  const r = T.redes || {}, ic = { facebook: 'fb', instagram: 'ig', tiktok: 'tt', youtube: 'yt' };
  return Object.keys(ic).filter(k => r[k]).map(k => `<a href="${esc(r[k])}" target="_blank" rel="noopener" aria-label="${k}"><svg class="ico"><use href="#i-${ic[k]}"/></svg></a>`).join('');
}

/* ---------- Preguntas frecuentes (también van como datos estructurados) ---------- */
const FAQ = [
  ['¿Cómo saco un producto a crédito?', `Escoge el producto y escríbenos por WhatsApp o visita la tienda en ${T.direccion.calle}. Un asesor revisa tu solicitud, te indica los documentos que necesitas y te propone un plan de cuotas.`],
  ['¿Las cuotas que aparecen en la página son definitivas?', 'Son una referencia aproximada. La cuota final depende del estudio de crédito y del plazo que elijas; un asesor te la confirma antes de cerrar la compra.'],
  ['¿Hacen entregas a domicilio?', `Sí, entregamos a domicilio en ${T.direccion.ciudad}. Al confirmar tu compra el asesor te indica el día y las condiciones de entrega.`],
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
    areaServed: { '@type': 'City', name: T.direccion.ciudad },
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
    '@type': 'Product', '@id': DOM + p.url + '#producto', name: p.nombre, sku: p.slug, url: DOM + p.url, category: p.categoria,
    description: p.desc || `${p.nombre} disponible en ${T.nombre}, ${T.direccion.ciudad}.`,
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

function headExtra() {
  let h = '';
  if (T.googleVerificacion) h += `<meta name="google-site-verification" content="${esc(T.googleVerificacion)}">`;
  if (T.metaVerificacion) h += `<meta name="facebook-domain-verification" content="${esc(T.metaVerificacion)}">`;
  return h;
}
let COMUNES = {};
function fichas(html, extra) {
  const mapaQ = encodeURIComponent(`${T.nombre}, ${T.direccion.calle}, ${T.direccion.ciudad}, ${T.direccion.departamento}`);
  const t = Object.assign({
    NOMBRE: esc(T.nombre), LEMA: esc(T.lema), ANIOS: T.anios, TEL: esc(T.telefono), TEL_LINK: T.telefono.replace(/[^\d+]/g, ''),
    DIR: esc(T.direccion.calle), CIUDAD: esc(T.direccion.ciudad), DEPTO: esc(T.direccion.departamento), DOMINIO: DOM,
    WA_VENTAS: (T.whatsapp || {}).ventas || '', HORARIO: esc(T.horarioTexto || ''), NIT: esc(T.nit || ''), ANIO: new Date().getFullYear(),
    GOOGLE_PERFIL: esc(T.googlePerfil || ''), MAPA_Q: mapaQ, HEAD_EXTRA: headExtra(), MARCA: marcaHTML(), REDES: redesHTML()
  }, COMUNES, extra || {});
  return html.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in t ? t[k] : ''));
}
function pagina({ titulo, descripcion, url, imagen, tipoOG, schema, cuerpo, bodyAttrs, extra }) {
  return fichas(`<!doctype html>
<html lang="es-CO">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descripcion)}">
<link rel="canonical" href="${DOM}${url}">
<meta name="robots" content="index,follow,max-image-preview:large">
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
${CABECERA}
<main id="contenido">
${cuerpo}
</main>
${PIE}
<script src="/assets/config.js"></script>
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

/* ---------- Página de producto (servidor) ---------- */
function detalleHTML(p) {
  const c = cuota(p), oferta = enOferta(p);
  const gal = `<div class="galeria"><div class="principal">${p.imgs[0] ? `<img data-foto-principal src="${esc(p.imgs[0])}" alt="${esc(p.nombre)}" width="700" height="700" fetchpriority="high">` : '<span class="sin-foto" style="font-size:64px">📦</span>'}</div>${p.imgs.length > 1 ? '<div class="miniaturas">' + p.imgs.map((src, i) => `<button type="button" data-mini="${i}" aria-label="Foto ${i + 1}" aria-current="${i === 0}"><img src="${esc(src)}" alt="${esc(p.nombre)} — foto ${i + 1}" loading="lazy"></button>`).join('') + '</div>' : ''}</div>`;
  const precio = `<div class="caja-precio">${c ? `<div class="credito"><small>Cuota a crédito${p.estimado ? ' (aproximada)' : ''}</small><strong>${pesos(c)}</strong> <span>al mes × ${p.meses} meses</span></div>` : ''}<div class="contado-l"><span>Precio de contado</span><span>${oferta ? `<s>${pesos(p.contado)}</s> ` : ''}<b>${pesos(precioVigente(p))}</b></span></div></div>`;
  const ft = [['Marca', p.marca], ['Color', p.color], ['Categoría', p.categoria]].filter(x => x[1]);
  const msg = encodeURIComponent(`Hola, me interesa este producto:\n• ${p.nombre}${p.marca ? ' (' + p.marca + ')' : ''}\nContado: ${pesos(precioVigente(p))}${c ? `\nCuota: ${pesos(c)} x ${p.meses} meses` : ''}\n${DOM}${p.url}`);
  return `${gal}<div class="detalle"><h1>${esc(p.nombre)}</h1>${precio}${p.desc ? `<p class="desc">${esc(p.desc)}</p>` : ''}${ft.length ? '<dl class="ficha-tecnica">' + ft.map(x => `<dt>${x[0]}</dt><dd>${esc(x[1])}</dd>`).join('') + '</dl>' : ''}<div class="botones"><a class="btn btn-wa" target="_blank" rel="noopener" data-wa-producto="${esc(p.slug)}" href="https://wa.me/${(T.whatsapp || {}).ventas}?text=${msg}"><svg class="ico"><use href="#i-wa"/></svg>Lo quiero, escribir por WhatsApp</a><button class="btn btn-borde" type="button" data-agregar="${esc(p.slug)}">Agregar a cotización</button></div><p class="nota">Precios en COP. La cuota depende del estudio de crédito; un asesor la confirma. Entrega a domicilio en ${esc(T.direccion.ciudad)}.</p></div>`;
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
      console.error('    El sitio se publicará sin páginas de producto. Revisa las reglas (firestore.rules).');
      docs = [];
    }
  }

  fs.rmSync(DIST, { recursive: true, force: true });
  copiar(PUB, DIST);
  const productos = normalizar(docs);
  console.log(`✔ ${productos.length} productos activos`);

  const cats = {};
  productos.forEach(p => { (cats[p.catSlug] = cats[p.catSlug] || { nombre: p.categoria, items: [] }).items.push(p); });
  const catsOrden = Object.keys(cats).sort();
  const chips = '<a class="cat activa" href="/#catalogo" data-cat="">Todo</a>' + catsOrden.map(k => `<a class="cat" href="/categoria/${k}/" data-cat="${k}">${esc(cats[k].nombre)}</a>`).join('');
  const pieCats = catsOrden.slice(0, 8).map(k => `<li><a href="/categoria/${k}/">${esc(cats[k].nombre)}</a></li>`).join('') || '<li><a href="/#catalogo">Catálogo</a></li>';
  const comunes = { SSR_CATS: chips, PIE_CATS: pieCats };
  COMUNES = comunes;
  const ordenados = [...productos].sort((a, b) => (enOferta(b) - enOferta(a)) || ((b.imgs.length > 0) - (a.imgs.length > 0)));

  // catalogo.json (lo usa el navegador)
  escribir('catalogo.json', JSON.stringify({ generado: new Date().toISOString(), productos }));

  // Inicio
  const faqHTML = FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');
  const schemaInicio = {
    '@context': 'https://schema.org', '@graph': [
      negocio(),
      { '@type': 'WebSite', '@id': DOM + '/#web', url: DOM + '/', name: T.nombre, inLanguage: 'es-CO', publisher: { '@id': DOM + '/#tienda' }, potentialAction: { '@type': 'SearchAction', target: DOM + '/?q={search_term_string}', 'query-input': 'required name=search_term_string' } },
      { '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
      { '@type': 'ItemList', name: 'Catálogo', itemListElement: ordenados.slice(0, 30).map((p, n) => ({ '@type': 'ListItem', position: n + 1, url: DOM + p.url, name: p.nombre })) }
    ]
  };
  escribir('index.html', fichas(PLANTILLA, Object.assign({}, comunes, {
    SCHEMA_ORG: ld(schemaInicio), SSR_PRODUCTOS: ordenados.map(tarjeta).join(''), FAQ_HTML: faqHTML, SSR_DESTACADO: ''
  })));

  // Productos
  for (const p of productos) {
    const c = cuota(p);
    const m = migas([['Inicio', '/'], [p.categoria, `/categoria/${p.catSlug}/`], [p.nombre, p.url]]);
    const relacionados = cats[p.catSlug].items.filter(x => x !== p).slice(0, 8);
    const titulo = `${p.nombre}${p.marca && !sinTilde(p.nombre).includes(sinTilde(p.marca)) ? ' ' + p.marca : ''} a crédito en Sincelejo | ${T.nombreCorto}`;
    const desc = `${p.nombre} en ${T.direccion.ciudad}: ${pesos(precioVigente(p))} de contado${c ? ` o ${pesos(c)} al mes × ${p.meses}` : ''}. Crédito directo y entrega a domicilio. Cotiza por WhatsApp.`;
    const cuerpo = `<div class="envoltura">${m.html}<div class="pagina-producto" data-detalle-producto data-slug="${esc(p.slug)}">${detalleHTML(p)}</div></div>` +
      (relacionados.length ? `<section class="seccion"><div class="envoltura"><div class="titulo-sec"><div><h2>Más en ${esc(p.categoria)}</h2></div><a class="enlace" href="/categoria/${p.catSlug}/">Ver todo</a></div><div class="carril">${relacionados.map(tarjeta).join('')}</div></div></section>` : '');
    escribir(`producto/${p.slug}/index.html`, pagina({
      titulo, descripcion: desc, url: p.url, imagen: p.imgs[0] ? abs(p.imgs[0]) : null, tipoOG: 'product',
      schema: [negocio(), productoLD(p), m.schema], cuerpo, bodyAttrs: 'data-pagina="producto"',
      extra: `<script>window.__PRODUCTO=${ld(p)};</script>`
    }));
  }

  // Categorías
  for (const k of catsOrden) {
    const cat = cats[k], url = `/categoria/${k}/`;
    const m = migas([['Inicio', '/'], [cat.nombre, url]]);
    const marcas = [...new Set(cat.items.map(p => p.marca).filter(Boolean))].slice(0, 5);
    const desde = Math.min(...cat.items.map(precioVigente));
    const cuerpo = `<div class="envoltura">${m.html}</div><section class="seccion gris" id="catalogo" style="padding-top:24px"><div class="envoltura">
<div class="titulo-sec"><div><h1 style="font-family:var(--f-disp);font-size:clamp(28px,4vw,44px);letter-spacing:-.03em;margin:0">${esc(cat.nombre)} en Sincelejo</h1><p>${cat.items.length} ${cat.items.length === 1 ? 'producto' : 'productos'} desde ${pesos(desde)} de contado${marcas.length ? ' · ' + esc(marcas.join(', ')) : ''}. Crédito directo y entrega a domicilio.</p></div></div>
<div class="barra-filtros"><label class="sr" for="orden">Ordenar</label><select id="orden" data-orden><option value="relevancia">Más relevantes</option><option value="menor">Menor precio</option><option value="mayor">Mayor precio</option><option value="cuota">Menor cuota</option></select><label class="sr" for="marca">Marca</label><select id="marca" data-marca><option value="">Todas las marcas</option></select><label class="chk"><input type="checkbox" data-solo-ofertas> Solo ofertas</label><span class="total" data-total aria-live="polite"></span></div>
<div class="rejilla" data-rejilla>${cat.items.map(tarjeta).join('')}</div></div></section>`;
    escribir(`categoria/${k}/index.html`, pagina({
      titulo: `${cat.nombre} a crédito en Sincelejo | ${T.nombreCorto}`,
      descripcion: `Compra ${cat.nombre.toLowerCase()} en ${T.direccion.ciudad} con crédito directo y entrega a domicilio. ${cat.items.length} opciones desde ${pesos(desde)}.`,
      url, imagen: cat.items.find(p => p.imgs[0]) ? abs(cat.items.find(p => p.imgs[0]).imgs[0]) : null,
      schema: [negocio(), { '@type': 'CollectionPage', name: cat.nombre, url: DOM + url, mainEntity: { '@type': 'ItemList', itemListElement: cat.items.map((p, n) => ({ '@type': 'ListItem', position: n + 1, url: DOM + p.url, name: p.nombre })) } }, m.schema],
      cuerpo, bodyAttrs: `data-pagina="categoria" data-categoria="${k}"`
    }).replace(`class="cat activa" href="/#catalogo"`, `class="cat" href="/#catalogo"`).replace(`data-cat="${k}">`, `data-cat="${k}" aria-current="page">`));
  }

  // Páginas estáticas adicionales (política, etc.): reemplazar fichas
  for (const rel of ['politica-de-privacidad/index.html']) {
    const f = path.join(DIST, rel);
    if (fs.existsSync(f)) {
      const html = fs.readFileSync(f, 'utf8').replace('<!--INCLUIR_CABECERA-->', CABECERA).replace('<!--INCLUIR_PIE-->', PIE);
      fs.writeFileSync(f, fichas(html, comunes));
    }
  }

  // Sitemap
  const hoy = new Date().toISOString().slice(0, 10);
  const urls = [['/', '1.0'], ...catsOrden.map(k => [`/categoria/${k}/`, '0.8']), ...productos.map(p => [p.url, '0.7', p.imgs.map(abs)]), ['/politica-de-privacidad/', '0.2']];
  escribir('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map(([u, pr, imgs]) => `<url><loc>${DOM}${u}</loc><lastmod>${hoy}</lastmod><priority>${pr}</priority>${(imgs || []).map(im => `<image:image><image:loc>${esc(im)}</image:loc></image:image>`).join('')}</url>`).join('\n')}
</urlset>`);
  escribir('robots.txt', `User-agent: *\nAllow: /\nDisallow: /*?q=\n\nSitemap: ${DOM}/sitemap.xml\n`);

  // Feed Google Merchant Center (RSS 2.0)
  const conFoto = productos.filter(p => p.imgs.length);
  const gItem = p => {
    const tit = `${p.nombre}${p.marca && !sinTilde(p.nombre).includes(sinTilde(p.marca)) ? ' ' + p.marca : ''}`.slice(0, 150);
    const d = (p.desc || `${p.nombre}${p.color ? ' color ' + p.color : ''}. Disponible en ${T.nombre}, ${T.direccion.ciudad}. Crédito directo y entrega a domicilio.`).slice(0, 4900);
    return `<item>
<g:id>${esc(p.slug)}</g:id><g:title>${esc(tit)}</g:title><g:description>${esc(d)}</g:description>
<g:link>${DOM}${p.url}</g:link><g:image_link>${esc(abs(p.imgs[0]))}</g:image_link>${p.imgs.slice(1, 10).map(im => `<g:additional_image_link>${esc(abs(im))}</g:additional_image_link>`).join('')}
<g:availability>in_stock</g:availability><g:condition>new</g:condition>
<g:price>${Math.round(p.contado)} COP</g:price>${enOferta(p) ? `<g:sale_price>${Math.round(p.promo)} COP</g:sale_price>` : ''}
${p.marca ? `<g:brand>${esc(p.marca)}</g:brand>` : ''}<g:identifier_exists>no</g:identifier_exists>
<g:product_type>${esc(p.categoria)}</g:product_type>${p.color ? `<g:color>${esc(p.color)}</g:color>` : ''}
</item>`;
  };
  escribir('feeds/google.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>
<title>${esc(T.nombre)}</title><link>${DOM}/</link><description>Catálogo de ${esc(T.nombre)}</description>
${conFoto.map(gItem).join('\n')}
</channel></rss>`);

  // Feed Meta (Facebook / Instagram Shopping) — CSV
  const csv = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const filas = [['id', 'title', 'description', 'availability', 'condition', 'price', 'sale_price', 'link', 'image_link', 'additional_image_link', 'brand', 'product_type', 'color']]
    .concat(conFoto.map(p => [p.slug, p.nombre.slice(0, 200), (p.desc || `${p.nombre}. Crédito directo y entrega a domicilio en ${T.direccion.ciudad}.`).slice(0, 9000), 'in stock', 'new', `${Math.round(p.contado)} COP`, enOferta(p) ? `${Math.round(p.promo)} COP` : '', DOM + p.url, abs(p.imgs[0]), p.imgs.slice(1, 10).map(abs).join(','), p.marca || T.nombre, p.categoria, p.color]));
  escribir('feeds/meta.csv', '﻿' + filas.map(f => f.map(csv).join(',')).join('\n'));

  // Encabezados de caché para Cloudflare Pages
  escribir('_headers', `/assets/*\n  Cache-Control: public, max-age=86400\n/img/*\n  Cache-Control: public, max-age=604800\n/catalogo.json\n  Cache-Control: public, max-age=300\n/feeds/*\n  Cache-Control: public, max-age=3600\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`);

  console.log(`✔ ${catsOrden.length} categorías · ${conFoto.length}/${productos.length} productos con foto en los feeds`);
  if (conFoto.length < productos.length) console.log(`  ⚠️  ${productos.length - conFoto.length} productos sin foto: no aparecerán en Google Shopping ni en Instagram hasta que les subas una.`);
  console.log('✔ dist/ listo para publicar');
})().catch(e => { console.error(e); process.exit(1); });
