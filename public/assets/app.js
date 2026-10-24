/* Almacén Metálicas Sincelejo — lógica de la vitrina (sin dependencias) */
(function () {
  'use strict';
  var T = window.TIENDA || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var pesos = function (n) { return '$ ' + Math.round(Number(n) || 0).toLocaleString('es-CO'); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sinTilde = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  var slug = function (s) { return sinTilde(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); };

  /* ---------- Precios ---------- */
  function precioVigente(p) { return (p.promo != null && p.promo > 0 && p.promo < p.contado) ? p.promo : p.contado; }
  function cuota(p) { return (p.credito && p.meses) ? Math.round(p.credito / p.meses) : null; }
  function enOferta(p) { return p.promo != null && p.promo > 0 && p.promo < p.contado; }

  /* ---------- Medición (GA4 + Meta Pixel, solo con consentimiento) ---------- */
  var medir = function () {};
  function activarMedicion() {
    if (T.ga4) {
      var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + T.ga4; document.head.appendChild(s);
      window.dataLayer = window.dataLayer || []; window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date()); window.gtag('config', T.ga4);
    }
    if (T.metaPixel) {
      !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', T.metaPixel); window.fbq('track', 'PageView');
    }
    medir = function (evento, datos) {
      datos = datos || {};
      if (window.gtag) window.gtag('event', evento, datos);
      if (window.fbq) {
        var mapa = { view_item: 'ViewContent', add_to_cart: 'AddToCart', generate_lead: 'Lead', search: 'Search', contact: 'Contact' };
        if (mapa[evento]) window.fbq('track', mapa[evento], { content_ids: datos.item_id ? [datos.item_id] : undefined, value: datos.value, currency: 'COP', search_string: datos.search_term });
      }
    };
  }
  function iniciarConsentimiento() {
    var c = $('[data-consent]'); var v = null;
    try { v = localStorage.getItem('ms_consent'); } catch (e) {}
    if (v === 'si') activarMedicion();
    if (!c) return;
    if (!v && (T.ga4 || T.metaPixel)) c.classList.add('ver');
    $('[data-consent-si]', c).addEventListener('click', function () { try { localStorage.setItem('ms_consent', 'si'); } catch (e) {} c.classList.remove('ver'); activarMedicion(); });
    $('[data-consent-no]', c).addEventListener('click', function () { try { localStorage.setItem('ms_consent', 'no'); } catch (e) {} c.classList.remove('ver'); });
  }

  /* ---------- Toast ---------- */
  var tt;
  function aviso(msg) { var t = $('[data-toast]'); if (!t) return; t.textContent = msg; t.classList.add('ver'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('ver'); }, 2200); }

  /* ---------- WhatsApp ---------- */
  function linkWa(canal, texto) {
    var n = (T.whatsapp || {})[canal]; if (!n) return null;
    return 'https://wa.me/' + n + (texto ? '?text=' + encodeURIComponent(texto) : '');
  }
  function prepararCanales() {
    $$('[data-wa]').forEach(function (a) {
      var canal = a.getAttribute('data-wa');
      var n = (T.whatsapp || {})[canal];
      if (!n) { a.setAttribute('aria-disabled', 'true'); a.removeAttribute('href'); if (a.closest('.menu-canales')) a.style.display = 'none'; var ir = a.querySelector('.ir'); if (ir) ir.textContent = 'Línea disponible muy pronto'; return; }
      if (a.getAttribute('href') === '#' || !a.getAttribute('href')) a.href = linkWa(canal, 'Hola, vengo de la página web');
      a.addEventListener('click', function () { medir('generate_lead', { method: 'whatsapp_' + canal, origen: a.getAttribute('data-origen') || '' }); });
    });
    var bf = $('[data-flotante]'), menu = $('[data-menu-canales]');
    if (bf && menu) {
      var activos = $$('a[data-wa]', menu).filter(function (a) { return a.style.display !== 'none'; });
      bf.addEventListener('click', function () {
        if (activos.length === 1) { window.open(activos[0].href, '_blank', 'noopener'); medir('generate_lead', { method: 'whatsapp_ventas', origen: 'flotante' }); return; }
        var ab = menu.classList.toggle('abierto'); bf.setAttribute('aria-expanded', ab ? 'true' : 'false');
      });
      document.addEventListener('click', function (e) { if (!menu.contains(e.target) && !bf.contains(e.target)) { menu.classList.remove('abierto'); bf.setAttribute('aria-expanded', 'false'); } });
    }
    $$('[data-evento]').forEach(function (a) { a.addEventListener('click', function () { medir(a.getAttribute('data-evento')); }); });
  }

  /* ---------- Catálogo ---------- */
  var CATALOGO = [];
  function normalizar(id, d) {
    var imgs = Array.isArray(d.imagenes) && d.imagenes.length ? d.imagenes : (d.imagen ? [d.imagen] : []);
    var s = slug(id || ((d.nombre || '') + '-' + (d.marca || '')));
    var num = function (v) { return (v === null || v === undefined || v === '') ? null : Number(v); };
    return {
      id: id, slug: s, nombre: d.nombre || 'Producto', categoria: d.categoria || 'General', catSlug: slug(d.categoria || 'General'),
      marca: d.marca || '', color: d.color || '', contado: num(d.contado) || 0, credito: num(d.credito), meses: num(d.mesesCredito),
      estimado: !!d.creditoEstimado, promo: num(d.promoHoy), desc: d.desc || '', imgs: imgs.filter(Boolean), url: '/producto/' + s + '/'
    };
  }
  function decodificar(v) {
    if (!v) return null;
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return v.doubleValue;
    if ('booleanValue' in v) return v.booleanValue;
    if ('nullValue' in v) return null;
    if ('timestampValue' in v) return v.timestampValue;
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodificar);
    if ('mapValue' in v) { var o = {}; var f = v.mapValue.fields || {}; Object.keys(f).forEach(function (k) { o[k] = decodificar(f[k]); }); return o; }
    return null;
  }
  function urlFS(ruta) { return 'https://firestore.googleapis.com/v1/projects/' + T.firebase.projectId + '/databases/(default)/documents' + ruta; }
  function cargarDesdeFirestore() {
    var todos = [];
    function pagina(token) {
      return fetch(urlFS('/catalogo') + '?pageSize=300&key=' + T.firebase.apiKey + (token ? '&pageToken=' + token : ''))
        .then(function (r) { if (!r.ok) throw new Error('Firestore ' + r.status); return r.json(); })
        .then(function (j) {
          (j.documents || []).forEach(function (doc) { var f = {}; Object.keys(doc.fields || {}).forEach(function (k) { f[k] = decodificar(doc.fields[k]); }); if (f.estado !== 'inactivo') todos.push(normalizar(doc.name.split('/').pop(), f)); });
          return j.nextPageToken ? pagina(j.nextPageToken) : todos;
        });
    }
    return pagina();
  }
  function cargarCatalogo() {
    return fetch('/catalogo.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('sin catalogo.json'); return r.json(); })
      .then(function (j) { return j.productos || []; })
      .catch(function () { return cargarDesdeFirestore(); });
  }

  function tarjeta(p) {
    var c = cuota(p), oferta = enOferta(p);
    var foto = p.imgs[0] ? '<img src="' + esc(p.imgs[0]) + '" alt="' + esc(p.nombre) + '" loading="lazy" decoding="async" width="400" height="400">' : '<span class="sin-foto" aria-hidden="true">📦</span>';
    var ins = (oferta ? '<span class="insignia">Oferta</span>' : '') + (c ? '<span class="insignia azul">A crédito</span>' : '');
    var precio = c
      ? '<div class="cuota"><span class="valor">' + pesos(c) + '</span><span class="por">al mes × ' + p.meses + '</span></div>' +
        '<div class="contado">Contado ' + (oferta ? '<s>' + pesos(p.contado) + '</s>' : '') + '<b>' + pesos(precioVigente(p)) + '</b></div>'
      : '<div class="cuota"><span class="valor">' + pesos(precioVigente(p)) + '</span><span class="por">de contado</span></div>' + (oferta ? '<div class="contado">Antes <s>' + pesos(p.contado) + '</s></div>' : '');
    return '<article class="tarjeta" data-id="' + esc(p.slug) + '">' +
      '<div class="foto">' + foto + '<div class="insignias">' + ins + '</div></div>' +
      '<div class="cuerpo"><span class="meta">' + esc([p.categoria, p.marca].filter(Boolean).join(' · ')) + '</span>' +
      '<h3><a href="' + esc(p.url) + '" data-ver="' + esc(p.slug) + '">' + esc(p.nombre) + '</a></h3>' +
      '<div class="precios">' + precio + (p.estimado && c ? '<div class="nota">Cuota aproximada</div>' : '') + '</div>' +
      '<button class="agregar" type="button" data-agregar="' + esc(p.slug) + '">Agregar a cotización</button></div></article>';
  }
  function buscarProducto(s) { for (var i = 0; i < CATALOGO.length; i++) if (CATALOGO[i].slug === s) return CATALOGO[i]; return null; }

  /* ---------- Página de inicio: filtros ---------- */
  var estado = { q: '', cat: '', marca: '', orden: 'relevancia', ofertas: false };
  function leerUrl() {
    var u = new URLSearchParams(location.search);
    estado.q = u.get('q') || ''; estado.cat = u.get('cat') || '';
    var cp = document.body.getAttribute('data-categoria'); if (cp) estado.cat = cp;
    var inp = $('#q'); if (inp) inp.value = estado.q;
  }
  function escribirUrl() {
    if (document.body.getAttribute('data-pagina') !== 'inicio') return;
    var u = new URLSearchParams(); if (estado.q) u.set('q', estado.q); if (estado.cat) u.set('cat', estado.cat);
    history.replaceState(null, '', location.pathname + (u.toString() ? '?' + u.toString() : '') + location.hash);
  }
  function filtrar() {
    var q = sinTilde(estado.q).split(/\s+/).filter(Boolean);
    var lista = CATALOGO.filter(function (p) {
      if (estado.cat && p.catSlug !== estado.cat) return false;
      if (estado.marca && p.marca !== estado.marca) return false;
      if (estado.ofertas && !enOferta(p)) return false;
      if (q.length) { var t = sinTilde(p.nombre + ' ' + p.categoria + ' ' + p.marca + ' ' + p.color + ' ' + p.desc); for (var i = 0; i < q.length; i++) if (t.indexOf(q[i]) < 0) return false; }
      return true;
    });
    var o = estado.orden;
    if (o === 'menor') lista.sort(function (a, b) { return precioVigente(a) - precioVigente(b); });
    if (o === 'mayor') lista.sort(function (a, b) { return precioVigente(b) - precioVigente(a); });
    if (o === 'cuota') lista.sort(function (a, b) { return (cuota(a) || 1e12) - (cuota(b) || 1e12); });
    if (o === 'relevancia') lista.sort(function (a, b) { return (enOferta(b) - enOferta(a)) || ((b.imgs.length > 0) - (a.imgs.length > 0)); });
    return lista;
  }
  function pintarRejilla() {
    var r = $('[data-rejilla]'); if (!r) return;
    var lista = filtrar();
    r.innerHTML = lista.length ? lista.map(tarjeta).join('') :
      '<div class="vacio"><p><strong>No encontramos ese producto en el catálogo.</strong></p><p>Puede que lo tengamos en la tienda. Pregúntale a un asesor.</p><a class="btn btn-wa" target="_blank" rel="noopener" href="' + esc(linkWa('ventas', 'Hola, busco: ' + (estado.q || 'un producto')) || '#') + '">Preguntar por WhatsApp</a></div>';
    var t = $('[data-total]'); if (t) t.textContent = lista.length + (lista.length === 1 ? ' producto' : ' productos');
    $$('[data-cats] .cat').forEach(function (b) { var on = (b.getAttribute('data-cat') || '') === estado.cat; b.classList.toggle('activa', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  }
  function pintarCategorias() {
    var cont = $('[data-cats]'); if (!cont) return;
    var cats = {}; CATALOGO.forEach(function (p) { cats[p.catSlug] = p.categoria; });
    var esInicio = document.body.getAttribute('data-pagina') === 'inicio';
    var html = '<a class="cat' + (!estado.cat ? ' activa' : '') + '" href="/#catalogo" data-cat="">Todo</a>';
    Object.keys(cats).sort().forEach(function (k) { html += '<a class="cat" href="/categoria/' + k + '/" data-cat="' + esc(k) + '">' + esc(cats[k]) + '</a>'; });
    cont.innerHTML = html;
    if (esInicio) cont.addEventListener('click', function (e) {
      var a = e.target.closest('.cat'); if (!a || e.metaKey || e.ctrlKey) return;
      e.preventDefault(); estado.cat = a.getAttribute('data-cat') || ''; escribirUrl(); pintarRejilla();
      var c = $('#catalogo'); if (c) c.scrollIntoView({ behavior: 'smooth' });
    });
    var sel = $('[data-marca]');
    if (sel) { var marcas = {}; CATALOGO.forEach(function (p) { if (p.marca) marcas[p.marca] = 1; }); Object.keys(marcas).sort().forEach(function (m) { var o = document.createElement('option'); o.value = m; o.textContent = m; sel.appendChild(o); }); }
  }
  function pintarOfertas() {
    var cont = $('[data-ofertas]'), sec = $('[data-seccion-ofertas]'); if (!cont || !sec) return;
    var of = CATALOGO.filter(enOferta).slice(0, 12);
    if (!of.length) { sec.hidden = true; return; }
    cont.innerHTML = of.map(tarjeta).join(''); sec.hidden = false;
  }
  function pintarDestacado() {
    var cont = $('[data-destacado]'); if (!cont) return;
    var cand = CATALOGO.filter(function (p) { return p.imgs.length; });
    var p = cand.filter(enOferta)[0] || cand.filter(cuota)[0] || cand[0]; if (!p) { cont.innerHTML = ''; return; }
    var c = cuota(p);
    cont.innerHTML = '<a class="vitrina-destacada" href="' + esc(p.url) + '" data-ver="' + esc(p.slug) + '">' +
      '<div class="foto"><img src="' + esc(p.imgs[0]) + '" alt="' + esc(p.nombre) + '" width="500" height="500" fetchpriority="high"></div>' +
      '<div><span class="etiqueta">' + (enOferta(p) ? 'Oferta de hoy' : 'Destacado') + '</span><h2>' + esc(p.nombre) + '</h2>' +
      (c ? '<div class="cuota"><span class="valor">' + pesos(c) + '</span><span class="por">al mes × ' + p.meses + '</span></div>' : '') +
      '<div class="contado">Contado <b>' + pesos(precioVigente(p)) + '</b></div></div></a>';
  }
  function iniciarFiltros() {
    var o = $('[data-orden]'), m = $('[data-marca]'), so = $('[data-solo-ofertas]');
    if (o) o.addEventListener('change', function () { estado.orden = o.value; pintarRejilla(); });
    if (m) m.addEventListener('change', function () { estado.marca = m.value; pintarRejilla(); });
    if (so) so.addEventListener('change', function () { estado.ofertas = so.checked; pintarRejilla(); });
    var f = $('[data-buscador]');
    if (f) {
      var inp = $('#q'), tim;
      f.addEventListener('submit', function (e) {
        if (!$('[data-rejilla]') || document.body.getAttribute('data-pagina') !== 'inicio') return; // en otras páginas va a /?q=
        e.preventDefault(); estado.q = inp.value.trim(); escribirUrl(); pintarRejilla(); medir('search', { search_term: estado.q });
        $('#catalogo').scrollIntoView({ behavior: 'smooth' });
      });
      if (document.body.getAttribute('data-pagina') === 'inicio') inp.addEventListener('input', function () { clearTimeout(tim); tim = setTimeout(function () { estado.q = inp.value.trim(); escribirUrl(); pintarRejilla(); }, 220); });
    }
  }

  /* ---------- Ficha rápida ---------- */
  function htmlDetalle(p, comoPagina) {
    var c = cuota(p), oferta = enOferta(p);
    var gal = '<div class="galeria"><div class="principal">' + (p.imgs[0] ? '<img data-foto-principal src="' + esc(p.imgs[0]) + '" alt="' + esc(p.nombre) + '">' : '<span class="sin-foto" style="font-size:64px">📦</span>') + '</div>' +
      (p.imgs.length > 1 ? '<div class="miniaturas">' + p.imgs.map(function (src, i) { return '<button type="button" data-mini="' + i + '" aria-label="Foto ' + (i + 1) + '" aria-current="' + (i === 0) + '"><img src="' + esc(src) + '" alt="" loading="lazy"></button>'; }).join('') + '</div>' : '') + '</div>';
    var precio = '<div class="caja-precio">' +
      (c ? '<div class="credito"><small>Cuota a crédito' + (p.estimado ? ' (aproximada)' : '') + '</small><strong>' + pesos(c) + '</strong> <span>al mes × ' + p.meses + ' meses</span></div>' : '') +
      '<div class="contado-l"><span>Precio de contado</span><span>' + (oferta ? '<s>' + pesos(p.contado) + '</s> ' : '') + '<b>' + pesos(precioVigente(p)) + '</b></span></div></div>';
    var ft = [['Marca', p.marca], ['Color', p.color], ['Categoría', p.categoria]].filter(function (x) { return x[1]; });
    var titulo = comoPagina ? '<h1>' + esc(p.nombre) + '</h1>' : '<h2 class="nombre">' + esc(p.nombre) + '</h2>';
    return gal + '<div class="detalle">' + titulo + precio +
      (p.desc ? '<p class="desc">' + esc(p.desc) + '</p>' : '') +
      (ft.length ? '<dl class="ficha-tecnica">' + ft.map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('') + '</dl>' : '') +
      '<div class="botones"><a class="btn btn-wa" target="_blank" rel="noopener" data-wa-producto="' + esc(p.slug) + '" href="' + esc(linkWa('ventas', mensajeProducto(p)) || '#') + '"><svg class="ico"><use href="#i-wa"/></svg>Lo quiero, escribir por WhatsApp</a>' +
      '<button class="btn btn-borde" type="button" data-agregar="' + esc(p.slug) + '">Agregar a cotización</button>' +
      (!comoPagina ? '<a class="enlace" href="' + esc(p.url) + '">Ver página del producto</a>' : '') + '</div>' +
      '<p class="nota">Precios en COP. La cuota depende del estudio de crédito; un asesor la confirma.</p></div>';
  }
  function mensajeProducto(p) {
    var c = cuota(p);
    return 'Hola, me interesa este producto:\n• ' + p.nombre + (p.marca ? ' (' + p.marca + ')' : '') + '\nContado: ' + pesos(precioVigente(p)) + (c ? '\nCuota: ' + pesos(c) + ' x ' + p.meses + ' meses' : '') + '\n' + (T.dominio || location.origin) + p.url;
  }
  function enlazarGaleria(raiz) {
    raiz.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mini]'); if (!b) return;
      var p = buscarProducto(raiz.getAttribute('data-slug')) || window.__PRODUCTO;
      var img = $('[data-foto-principal]', raiz); if (img && p) img.src = p.imgs[+b.getAttribute('data-mini')];
      $$('[data-mini]', raiz).forEach(function (x) { x.setAttribute('aria-current', x === b ? 'true' : 'false'); });
    });
    raiz.addEventListener('click', function (e) { var a = e.target.closest('[data-wa-producto]'); if (a) medir('generate_lead', { method: 'whatsapp_ventas', item_id: a.getAttribute('data-wa-producto'), origen: 'producto' }); });
  }
  var ultimoFoco = null;
  function abrirFicha(p) {
    var f = $('[data-ficha]'), caja = $('[data-ficha-caja]'); if (!f) return;
    ultimoFoco = document.activeElement;
    caja.setAttribute('data-slug', p.slug);
    caja.innerHTML = '<button class="cerrar" type="button" data-cerrar-ficha aria-label="Cerrar">×</button>' + htmlDetalle(p, false);
    f.classList.add('abierto'); $('[data-velo]').classList.add('abierto'); document.body.style.overflow = 'hidden';
    $('[data-cerrar-ficha]', caja).focus();
    medir('view_item', { item_id: p.slug, item_name: p.nombre, value: precioVigente(p), currency: 'COP' });
  }
  function cerrarFicha() {
    var f = $('[data-ficha]'); if (!f || !f.classList.contains('abierto')) return;
    f.classList.remove('abierto'); if (!$('[data-panel]').classList.contains('abierto')) { $('[data-velo]').classList.remove('abierto'); document.body.style.overflow = ''; }
    if (ultimoFoco) ultimoFoco.focus();
  }

  /* ---------- Cotización ---------- */
  var COT = [];
  try { COT = JSON.parse(localStorage.getItem('ms_cotizacion') || '[]'); } catch (e) { COT = []; }
  function guardarCot() { try { localStorage.setItem('ms_cotizacion', JSON.stringify(COT)); } catch (e) {} pintarCot(); }
  function agregar(p) {
    var it = COT.filter(function (x) { return x.slug === p.slug; })[0];
    if (it) it.cant++; else COT.push({ slug: p.slug, nombre: p.nombre, marca: p.marca, precio: precioVigente(p), cuota: cuota(p), meses: p.meses, img: p.imgs[0] || '', url: p.url, cant: 1 });
    guardarCot(); aviso('Agregado a tu cotización');
    medir('add_to_cart', { item_id: p.slug, item_name: p.nombre, value: precioVigente(p), currency: 'COP' });
  }
  function pintarCot() {
    var n = COT.reduce(function (s, x) { return s + x.cant; }, 0);
    $$('[data-contador]').forEach(function (c) { c.textContent = n; c.setAttribute('data-n', n); });
    var cont = $('[data-items]'); if (!cont) return;
    cont.innerHTML = COT.length ? COT.map(function (x, i) {
      return '<div class="item">' + (x.img ? '<img src="' + esc(x.img) + '" alt="">' : '<span class="mini">📦</span>') +
        '<div><h3>' + esc(x.nombre) + '</h3><small>' + pesos(x.precio) + ' de contado' + (x.cuota ? '<br>o ' + pesos(x.cuota) + ' al mes × ' + x.meses : '') + '</small></div>' +
        '<div class="cant"><button type="button" data-menos="' + i + '" aria-label="Quitar uno">−</button><span>' + x.cant + '</span><button type="button" data-mas="' + i + '" aria-label="Agregar uno">+</button></div></div>';
    }).join('') : '<p class="vacio">Tu cotización está vacía. Agrega productos desde el catálogo y envíalos juntos por WhatsApp.</p>';
    var s = $('[data-suma]'); if (s) s.textContent = pesos(COT.reduce(function (t, x) { return t + x.precio * x.cant; }, 0));
    var b = $('[data-enviar-cotizacion]'); if (b) b.disabled = !COT.length;
  }
  function abrirPanel() { $('[data-panel]').classList.add('abierto'); $('[data-panel]').setAttribute('aria-hidden', 'false'); $('[data-velo]').classList.add('abierto'); document.body.style.overflow = 'hidden'; $('[data-panel] .cerrar').focus(); }
  function cerrarPanel() { $('[data-panel]').classList.remove('abierto'); $('[data-panel]').setAttribute('aria-hidden', 'true'); if (!$('[data-ficha]').classList.contains('abierto')) { $('[data-velo]').classList.remove('abierto'); document.body.style.overflow = ''; } }
  function iniciarCot() {
    $$('[data-abrir-cotizacion]').forEach(function (b) { b.addEventListener('click', abrirPanel); });
    $('[data-panel] [data-cerrar]').addEventListener('click', cerrarPanel);
    $('[data-velo]').addEventListener('click', function () { cerrarPanel(); cerrarFicha(); });
    $('[data-ficha]').addEventListener('click', function (e) { if (e.target === e.currentTarget) cerrarFicha(); if (e.target.closest('[data-cerrar-ficha]')) cerrarFicha(); });
    enlazarGaleria($('[data-ficha-caja]'));
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { cerrarFicha(); cerrarPanel(); } });
    $('[data-items]').addEventListener('click', function (e) {
      var m = e.target.closest('[data-mas]'), n = e.target.closest('[data-menos]');
      if (m) COT[+m.getAttribute('data-mas')].cant++;
      if (n) { var i = +n.getAttribute('data-menos'); COT[i].cant--; if (COT[i].cant <= 0) COT.splice(i, 1); }
      if (m || n) guardarCot();
    });
    $('[data-vaciar]').addEventListener('click', function () { COT = []; guardarCot(); });
    $('[data-enviar-cotizacion]').addEventListener('click', function () {
      if (!COT.length) return;
      var lineas = COT.map(function (x) { return '• ' + x.cant + ' × ' + x.nombre + (x.marca ? ' (' + x.marca + ')' : '') + ' — ' + pesos(x.precio) + ' contado' + (x.cuota ? ' / ' + pesos(x.cuota) + ' x ' + x.meses + ' meses' : ''); });
      var total = COT.reduce(function (t, x) { return t + x.precio * x.cant; }, 0);
      var txt = 'Hola, quiero cotizar estos productos de la página web:\n' + lineas.join('\n') + '\n\nTotal de contado: ' + pesos(total) + '\n¿Me ayudan con disponibilidad y plan de crédito?';
      var url = linkWa('ventas', txt); if (!url) return aviso('WhatsApp de ventas no configurado');
      medir('generate_lead', { method: 'whatsapp_cotizacion', value: total, currency: 'COP' });
      window.open(url, '_blank', 'noopener');
    });
    // Delegación global: agregar y ver
    document.addEventListener('click', function (e) {
      var a = e.target.closest('[data-agregar]');
      if (a) { var p = buscarProducto(a.getAttribute('data-agregar')) || window.__PRODUCTO; if (p) { agregar(p); a.classList.add('listo'); a.textContent = 'Agregado ✓'; setTimeout(function () { a.classList.remove('listo'); a.textContent = 'Agregar a cotización'; }, 1600); } return; }
      var v = e.target.closest('[data-ver]');
      if (v && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) { var pv = buscarProducto(v.getAttribute('data-ver')); if (pv) { e.preventDefault(); abrirFicha(pv); } }
    });
    pintarCot();
  }

  /* ---------- Reseñas (colección 'resenas', aprobación manual) ---------- */
  function cargarResenas() {
    var cont = $('[data-resenas]'); if (!cont || !T.firebase) return;
    fetch(urlFS(':runQuery') + '?key=' + T.firebase.apiKey, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'resenas' }], where: { fieldFilter: { field: { fieldPath: 'aprobado' }, op: 'EQUAL', value: { booleanValue: true } } }, limit: 30 } })
    }).then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) {
      var lista = (rows || []).filter(function (x) { return x.document; }).map(function (x) { var f = {}; Object.keys(x.document.fields || {}).forEach(function (k) { f[k] = decodificar(x.document.fields[k]); }); return f; })
        .sort(function (a, b) { return String(b.fecha || '').localeCompare(String(a.fecha || '')); }).slice(0, 8);
      if (!lista.length) return;
      cont.innerHTML = lista.map(function (r) { var n = Math.max(1, Math.min(5, Number(r.estrellas) || 5)); return '<figure class="resena" style="margin:0"><span class="est" aria-label="' + n + ' de 5 estrellas">' + '★★★★★'.slice(0, n) + '<span style="color:#D5D7E6">' + '★★★★★'.slice(n) + '</span></span><blockquote style="margin:0"><p>' + esc(r.texto) + '</p></blockquote><figcaption><small>' + esc(r.nombre) + (r.fecha ? ' · ' + new Date(r.fecha).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }) : '') + '</small></figcaption></figure>'; }).join('');
    }).catch(function () {});
  }
  function iniciarFormResena() {
    var f = $('[data-form-resena]'); if (!f) return;
    var est = 0, msg = $('[data-msg-resena]');
    $$('[data-estrellas] button', f).forEach(function (b) {
      b.addEventListener('click', function () { est = +b.getAttribute('data-v'); $$('[data-estrellas] button', f).forEach(function (x) { var on = +x.getAttribute('data-v') <= est; x.classList.toggle('on', on); x.setAttribute('aria-checked', +x.getAttribute('data-v') === est ? 'true' : 'false'); }); });
    });
    f.addEventListener('submit', function (e) {
      e.preventDefault(); msg.className = 'msg';
      var nombre = f.nombre.value.trim(), texto = f.texto.value.trim();
      if (f.web.value) return; // bot
      if (!nombre || texto.length < 10) { msg.textContent = 'Escribe tu nombre y un comentario de al menos 10 caracteres.'; msg.classList.add('err'); return; }
      if (!est) { msg.textContent = 'Elige una calificación de 1 a 5 estrellas.'; msg.classList.add('err'); return; }
      if (!f.acepto.checked) { msg.textContent = 'Marca la autorización para publicar tu opinión.'; msg.classList.add('err'); return; }
      try { var u = +localStorage.getItem('ms_ult_resena') || 0; if (Date.now() - u < 6e5) { msg.textContent = 'Ya recibimos tu opinión. Gracias.'; msg.classList.add('ok'); return; } } catch (er) {}
      var btn = f.querySelector('button[type=submit]'); btn.disabled = true;
      fetch(urlFS('/resenas') + '?key=' + T.firebase.apiKey, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { nombre: { stringValue: nombre.slice(0, 60) }, texto: { stringValue: texto.slice(0, 600) }, estrellas: { integerValue: String(est) }, aprobado: { booleanValue: false }, fecha: { stringValue: new Date().toISOString() }, origen: { stringValue: 'web' } } })
      }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        try { localStorage.setItem('ms_ult_resena', Date.now()); } catch (er) {}
        f.reset(); est = 0; $$('[data-estrellas] button', f).forEach(function (x) { x.classList.remove('on'); });
        msg.textContent = 'Recibimos tu opinión. La publicamos después de revisarla.'; msg.classList.add('ok');
      }).catch(function () { msg.textContent = 'No se pudo enviar tu opinión. Inténtalo de nuevo o escríbenos por WhatsApp.'; msg.classList.add('err'); })
        .then(function () { btn.disabled = false; });
    });
  }

  /* ---------- Arranque ---------- */
  function arrancar() {
    iniciarConsentimiento(); prepararCanales(); iniciarCot(); leerUrl(); iniciarFiltros(); iniciarFormResena(); cargarResenas();
    if (window.__PRODUCTO) { enlazarGaleria($('[data-detalle-producto]')); medir('view_item', { item_id: window.__PRODUCTO.slug, item_name: window.__PRODUCTO.nombre, value: precioVigente(window.__PRODUCTO), currency: 'COP' }); }
    cargarCatalogo().then(function (lista) {
      CATALOGO = lista || [];
      if (!CATALOGO.length) return;
      if (window.__PRODUCTO && !buscarProducto(window.__PRODUCTO.slug)) CATALOGO.push(window.__PRODUCTO);
      pintarCategorias();
      if ($('[data-rejilla]')) { pintarRejilla(); pintarOfertas(); pintarDestacado(); }
      if (estado.q) medir('search', { search_term: estado.q });
    }).catch(function () {
      var r = $('[data-rejilla]');
      if (r && !r.children.length) r.innerHTML = '<div class="vacio"><p><strong>No pudimos cargar el catálogo en este momento.</strong></p><p>Recarga la página o pregunta directamente a un asesor.</p></div>';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar); else arrancar();
})();
