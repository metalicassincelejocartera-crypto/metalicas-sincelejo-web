/* Almacén Metálicas Sincelejo — lógica de la vitrina (sin dependencias) */
(function () {
  'use strict';
  var T = window.TIENDA || {}, M = window.MS;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = M.esc, pesos = M.pesos;
  var CATALOGO = [], POR_PAGINA = T.productosPorPagina || 24;
  var reducirMovimiento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
        var mapa = { view_item: 'ViewContent', add_to_cart: 'AddToCart', generate_lead: 'Lead', search: 'Search' };
        if (mapa[evento]) window.fbq('track', mapa[evento], { content_ids: datos.item_id ? [datos.item_id] : undefined, value: datos.value, currency: 'COP', search_string: datos.search_term });
      }
    };
  }
  function iniciarConsentimiento() {
    var c = $('[data-consent]'), v = null;
    try { v = localStorage.getItem('ms_consent'); } catch (e) {}
    if (v === 'si') activarMedicion();
    if (!c) return;
    if (!v && (T.ga4 || T.metaPixel)) c.classList.add('ver');
    $('[data-consent-si]', c).addEventListener('click', function () { try { localStorage.setItem('ms_consent', 'si'); } catch (e) {} c.classList.remove('ver'); activarMedicion(); });
    $('[data-consent-no]', c).addEventListener('click', function () { try { localStorage.setItem('ms_consent', 'no'); } catch (e) {} c.classList.remove('ver'); });
  }

  /* ---------- Aviso ---------- */
  var tt;
  function aviso(msg) { var t = $('[data-toast]'); if (!t) return; t.textContent = msg; t.classList.add('ver'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('ver'); }, 2200); }

  /* ---------- WhatsApp ---------- */
  function linkWa(canal, texto) { var n = (T.whatsapp || {})[canal]; return n ? 'https://wa.me/' + n + (texto ? '?text=' + encodeURIComponent(texto) : '') : null; }
  function prepararCanales() {
    $$('[data-wa]').forEach(function (a) {
      var canal = a.getAttribute('data-wa');
      if (!(T.whatsapp || {})[canal]) { a.setAttribute('aria-disabled', 'true'); a.removeAttribute('href'); if (a.closest('.menu-canales')) a.style.display = 'none'; return; }
      if (a.getAttribute('href') === '#' || !a.getAttribute('href')) a.href = linkWa(canal, 'Hola, vengo de la página web');
      a.addEventListener('click', function () { medir('generate_lead', { method: 'whatsapp_' + canal, origen: a.getAttribute('data-origen') || '' }); });
    });
    var bf = $('[data-flotante]'), menu = $('[data-menu-canales]');
    if (bf && menu) {
      bf.addEventListener('click', function () { var ab = menu.classList.toggle('abierto'); bf.setAttribute('aria-expanded', ab ? 'true' : 'false'); });
      document.addEventListener('click', function (e) { if (!menu.contains(e.target) && !bf.contains(e.target)) { menu.classList.remove('abierto'); bf.setAttribute('aria-expanded', 'false'); } });
    }
    $$('[data-evento]').forEach(function (a) { a.addEventListener('click', function () { medir(a.getAttribute('data-evento')); }); });
  }

  /* ---------- Menú de categorías ---------- */
  function iniciarMenu() {
    var b = $('[data-abrir-menu]'), m = $('[data-mega]'); if (!b || !m) return;
    function abrir(si) {
      m.hidden = !si; b.setAttribute('aria-expanded', si ? 'true' : 'false');
      document.body.classList.toggle('menu-abierto', si);
      if (si) { var a = $('a', m); if (a) a.focus(); }
    }
    b.addEventListener('click', function () { abrir(m.hidden); });
    $('[data-cerrar-menu]', m).addEventListener('click', function () { abrir(false); b.focus(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !m.hidden) { abrir(false); b.focus(); } });
    document.addEventListener('click', function (e) { if (!m.hidden && !m.contains(e.target) && !b.contains(e.target)) abrir(false); });
    // Marca el departamento actual en los atajos
    var ruta = location.pathname;
    $$('.atajos a').forEach(function (a) { if (ruta.indexOf(a.getAttribute('href')) === 0) { a.classList.add('activo'); a.setAttribute('aria-current', 'page'); } });
  }

  /* ---------- Portada (slider) ---------- */
  function iniciarSlider() {
    var s = $('[data-slider]'); if (!s) return;
    var slides = $$('[data-slide]', s), puntos = $$('[data-punto]', s), i = 0, timer;
    if (slides.length < 2) return;
    function ir(k) {
      i = (k + slides.length) % slides.length;
      slides.forEach(function (x, n) { x.hidden = n !== i; });
      puntos.forEach(function (p, n) { p.setAttribute('aria-selected', n === i ? 'true' : 'false'); });
    }
    function auto() { clearInterval(timer); if (!reducirMovimiento) timer = setInterval(function () { ir(i + 1); }, 6500); }
    $('[data-slider-sig]', s).addEventListener('click', function () { ir(i + 1); auto(); });
    $('[data-slider-ant]', s).addEventListener('click', function () { ir(i - 1); auto(); });
    puntos.forEach(function (p, n) { p.addEventListener('click', function () { ir(n); auto(); }); });
    s.addEventListener('mouseenter', function () { clearInterval(timer); });
    s.addEventListener('mouseleave', auto);
    s.addEventListener('focusin', function () { clearInterval(timer); });
    var x0 = null;
    s.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    s.addEventListener('touchend', function (e) { if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) { ir(i + (dx < 0 ? 1 : -1)); auto(); } x0 = null; });
    auto();
  }

  /* ---------- Rieles horizontales ---------- */
  function iniciarRieles() {
    $$('[data-riel]').forEach(function (r) {
      var c = $('.carril', r), a = $('[data-riel-ant]', r), s = $('[data-riel-sig]', r);
      function estado() { a.disabled = c.scrollLeft < 8; s.disabled = c.scrollLeft + c.clientWidth > c.scrollWidth - 8; }
      a.addEventListener('click', function () { c.scrollBy({ left: -c.clientWidth * 0.9, behavior: reducirMovimiento ? 'auto' : 'smooth' }); });
      s.addEventListener('click', function () { c.scrollBy({ left: c.clientWidth * 0.9, behavior: reducirMovimiento ? 'auto' : 'smooth' }); });
      c.addEventListener('scroll', estado, { passive: true }); window.addEventListener('resize', estado); estado();
    });
  }

  /* ---------- Catálogo ---------- */
  function cargarCatalogo() {
    return fetch('/catalogo.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { POR_PAGINA = j.porPagina || POR_PAGINA; return j.productos || []; });
  }
  function buscarProducto(s) { for (var i = 0; i < CATALOGO.length; i++) if (CATALOGO[i].slug === s) return CATALOGO[i]; return window.__PRODUCTO && window.__PRODUCTO.slug === s ? window.__PRODUCTO : null; }

  /* ---------- Listados: filtros, orden, paginación ---------- */
  var L = null; // estado del listado
  function leerEstado() {
    var u = new URLSearchParams(location.search);
    return {
      q: (u.get('q') || '').trim(), orden: u.get('orden') || 'relevancia', marcas: (u.get('marca') || '').split(',').filter(Boolean),
      rango: u.get('precio') || '', ofertas: u.get('ofertas') === '1', credito: u.get('credito') === '1', sub: u.get('cat') || '',
      p: parseInt(u.get('p'), 10) || 0
    };
  }
  function esPorDefecto(e) { return !e.q && e.orden === 'relevancia' && !e.marcas.length && !e.rango && !e.ofertas && !e.credito && !e.sub; }
  function escribirEstado(e, push) {
    var u = new URLSearchParams();
    if (e.q) u.set('q', e.q);
    if (e.sub) u.set('cat', e.sub);
    if (e.orden !== 'relevancia') u.set('orden', e.orden);
    if (e.marcas.length) u.set('marca', e.marcas.join(','));
    if (e.rango) u.set('precio', e.rango);
    if (e.ofertas) u.set('ofertas', '1');
    if (e.credito) u.set('credito', '1');
    if (e.p > 1 && !esPorDefecto(e)) u.set('p', e.p);
    var base = esPorDefecto(e) ? urlPagina(e.p || 1) : L.base;
    var url = base + (u.toString() ? '?' + u.toString() : '');
    history[push ? 'pushState' : 'replaceState'](null, '', url);
  }
  function urlPagina(k) { return k <= 1 ? L.base : L.base + 'pagina/' + k + '/'; }
  function coincide(p, palabras) {
    var t = M.sinTilde(p.nombre + ' ' + p.dept + ' ' + p.sub + ' ' + p.marca + ' ' + p.color + ' ' + p.desc);
    for (var i = 0; i < palabras.length; i++) {
      var w = palabras[i]; if (t.indexOf(w) >= 0) continue;
      if (w.length > 4 && /s$/.test(w) && t.indexOf(w.replace(/e?s$/, '')) >= 0) continue; // plural simple
      return false;
    }
    return true;
  }
  function aplicar(lista, e, sin) {
    var palabras = M.sinTilde(e.q).split(/\s+/).filter(Boolean);
    return lista.filter(function (p) {
      if (palabras.length && !coincide(p, palabras)) return false;
      if (sin !== 'sub' && e.sub && p.subSlug !== e.sub) return false;
      if (sin !== 'marca' && e.marcas.length && e.marcas.indexOf(p.marca) < 0) return false;
      if (sin !== 'rango' && e.rango && !M.enRango(p, e.rango)) return false;
      if (sin !== 'ofertas' && e.ofertas && !M.enOferta(p)) return false;
      if (sin !== 'credito' && e.credito && !M.cuota(p)) return false;
      return true;
    });
  }
  function pintarFacetas() {
    var e = L.estado, f = $('[data-facetas]', L.raiz); if (!f) return;
    var html = '';
    if (L.alcance.buscar) {
      var cats = {}; aplicar(L.base_items, e, 'sub').forEach(function (p) { (cats[p.subSlug] = cats[p.subSlug] || { n: 0, nombre: p.sub }).n++; });
      var ks = Object.keys(cats).sort(function (a, b) { return cats[b].n - cats[a].n; });
      if (ks.length > 1) html += '<fieldset><legend>Categoría</legend>' + ks.map(function (k) { return '<label class="op"><input type="radio" name="cat" value="' + esc(k) + '"' + (e.sub === k ? ' checked' : '') + '> ' + esc(cats[k].nombre) + ' <small>' + cats[k].n + '</small></label>'; }).join('') + (e.sub ? '<label class="op"><input type="radio" name="cat" value=""> Todas</label>' : '') + '</fieldset>';
    }
    var marcas = {}; aplicar(L.base_items, e, 'marca').forEach(function (p) { if (p.marca) marcas[p.marca] = (marcas[p.marca] || 0) + 1; });
    e.marcas.forEach(function (m) { if (!(m in marcas)) marcas[m] = 0; });
    var mk = Object.keys(marcas).sort(function (a, b) { return a.localeCompare(b, 'es'); });
    if (mk.length) html += '<fieldset><legend>Marca</legend>' + mk.map(function (m) { return '<label class="op"><input type="checkbox" name="marca" value="' + esc(m) + '"' + (e.marcas.indexOf(m) >= 0 ? ' checked' : '') + '> ' + esc(m) + ' <small>' + marcas[m] + '</small></label>'; }).join('') + '</fieldset>';
    var enR = aplicar(L.base_items, e, 'rango');
    var rangos = M.RANGOS.map(function (r) { return { r: r, n: enR.filter(function (p) { return M.enRango(p, r.id); }).length }; }).filter(function (x) { return x.n || e.rango === x.r.id; });
    if (rangos.length > 1 || e.rango) html += '<fieldset><legend>Precio de contado</legend>' + rangos.map(function (x) { return '<label class="op"><input type="radio" name="precio" value="' + x.r.id + '"' + (e.rango === x.r.id ? ' checked' : '') + '> ' + x.r.nombre + ' <small>' + x.n + '</small></label>'; }).join('') + (e.rango ? '<label class="op"><input type="radio" name="precio" value=""> Cualquier precio</label>' : '') + '</fieldset>';
    var nOf = aplicar(L.base_items, e, 'ofertas').filter(M.enOferta).length, nCr = aplicar(L.base_items, e, 'credito').filter(M.cuota).length;
    html += '<fieldset><legend>Mostrar</legend>' +
      (nOf || e.ofertas ? '<label class="op"><input type="checkbox" name="ofertas"' + (e.ofertas ? ' checked' : '') + '> Solo ofertas <small>' + nOf + '</small></label>' : '') +
      '<label class="op"><input type="checkbox" name="credito"' + (e.credito ? ' checked' : '') + '> Solo con crédito <small>' + nCr + '</small></label></fieldset>';
    f.innerHTML = html;
  }
  function pintarActivos() {
    var e = L.estado, c = $('[data-activos]', L.raiz); if (!c) return;
    var chips = [];
    if (e.sub) { var p = L.base_items.filter(function (x) { return x.subSlug === e.sub; })[0]; chips.push(['cat', '', p ? p.sub : e.sub]); }
    e.marcas.forEach(function (m) { chips.push(['marca', m, m]); });
    if (e.rango) M.RANGOS.forEach(function (r) { if (r.id === e.rango) chips.push(['precio', '', r.nombre]); });
    if (e.ofertas) chips.push(['ofertas', '', 'Solo ofertas']);
    if (e.credito) chips.push(['credito', '', 'Solo con crédito']);
    c.innerHTML = chips.length ? chips.map(function (x) { return '<button type="button" class="chip" data-quitar="' + x[0] + '" data-valor="' + esc(x[1]) + '">' + esc(x[2]) + ' <span aria-hidden="true">×</span><span class="sr">Quitar filtro</span></button>'; }).join('') + '<button type="button" class="chip limpiar" data-limpiar>Limpiar filtros</button>' : '';
  }
  function htmlPaginacion(total, actual) {
    var n = Math.ceil(total / POR_PAGINA); if (n <= 1) return '';
    var porDef = esPorDefecto(L.estado);
    var href = function (k) {
      if (porDef) return urlPagina(k);
      var u = new URLSearchParams(location.search); if (k > 1) u.set('p', k); else u.delete('p');
      return L.base + '?' + u.toString();
    };
    var h = '<nav class="paginacion" aria-label="Páginas">';
    if (actual > 1) h += '<a class="pag-flecha" href="' + href(actual - 1) + '" data-ir="' + (actual - 1) + '">Anterior</a>';
    for (var k = 1; k <= n; k++) {
      if (n > 7 && k !== 1 && k !== n && Math.abs(k - actual) > 1) { if (k === 2 || k === n - 1) h += '<span class="pag-puntos">…</span>'; continue; }
      h += k === actual ? '<span class="pag-num" aria-current="page">' + k + '</span>' : '<a class="pag-num" href="' + href(k) + '" data-ir="' + k + '">' + k + '</a>';
    }
    if (actual < n) h += '<a class="pag-flecha" href="' + href(actual + 1) + '" data-ir="' + (actual + 1) + '">Siguiente</a>';
    return h + '</nav>';
  }
  function pintarListado(desplazar) {
    var e = L.estado;
    var lista = aplicar(L.base_items, e).sort(M.ORDENES[e.orden] || M.ORDENES.relevancia);
    var n = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
    var actual = Math.min(Math.max(1, e.p || 1), n);
    var r = $('[data-rejilla]', L.raiz);
    if (!lista.length) {
      var q = e.q || (L.alcance.buscar ? '' : 'un producto');
      r.innerHTML = '<div class="vacio"><p><strong>' + (L.alcance.buscar && !e.q ? 'Escribe qué buscas en el buscador de arriba.' : 'No encontramos productos con esos filtros.') + '</strong></p><p>Puede que lo tengamos en la tienda. Pregúntale a un asesor.</p><a class="btn btn-wa" target="_blank" rel="noopener" href="' + esc(linkWa('ventas', 'Hola, busco: ' + (q || 'un producto')) || '#') + '">Preguntar por WhatsApp</a></div>';
    } else r.innerHTML = lista.slice((actual - 1) * POR_PAGINA, actual * POR_PAGINA).map(M.tarjeta).join('');
    var t = $('[data-total]', L.raiz); if (t) t.textContent = lista.length + (lista.length === 1 ? ' producto' : ' productos');
    $('[data-paginacion]', L.raiz).innerHTML = htmlPaginacion(lista.length, actual);
    pintarFacetas(); pintarActivos();
    var bf = $('[data-abrir-filtros]', L.raiz), na = $$('[data-quitar]', L.raiz).length;
    if (bf) bf.innerHTML = '<svg class="ico"><use href="#i-filtro"/></svg>Filtrar' + (na ? ' (' + na + ')' : '');
    if (desplazar) { var top = L.raiz.getBoundingClientRect().top + window.scrollY - 120; window.scrollTo({ top: top, behavior: reducirMovimiento ? 'auto' : 'smooth' }); }
  }
  function iniciarListado() {
    var raiz = $('[data-listado]'); if (!raiz) return;
    var alcance = {}; try { alcance = JSON.parse(raiz.getAttribute('data-alcance') || '{}'); } catch (er) {}
    L = { raiz: raiz, alcance: alcance, base: raiz.getAttribute('data-base'), estado: leerEstado(), base_items: [] };
    if (!L.estado.p) L.estado.p = parseInt(raiz.getAttribute('data-pagina-actual'), 10) || 1;
    if (alcance.buscar) {
      var h1 = $('h1', raiz); if (L.estado.q && h1) { h1.textContent = 'Resultados para “' + L.estado.q + '”'; document.title = 'Resultados para ' + L.estado.q + ' | ' + T.nombreCorto; }
      var inp = $('#q'); if (inp) inp.value = L.estado.q;
    }
    var sel = $('[data-orden]', raiz); if (sel) sel.value = L.estado.orden;
    // Interacciones
    sel && sel.addEventListener('change', function () { L.estado.orden = sel.value; L.estado.p = 1; escribirEstado(L.estado, false); pintarListado(false); });
    raiz.addEventListener('change', function (ev) {
      var i = ev.target; if (!i.name || !i.closest('[data-facetas]')) return;
      var e = L.estado;
      if (i.name === 'marca') { e.marcas = $$('input[name=marca]:checked', raiz).map(function (x) { return x.value; }); }
      if (i.name === 'precio') e.rango = i.value;
      if (i.name === 'cat') e.sub = i.value;
      if (i.name === 'ofertas') e.ofertas = i.checked;
      if (i.name === 'credito') e.credito = i.checked;
      e.p = 1; escribirEstado(e, false); pintarListado(false);
    });
    raiz.addEventListener('click', function (ev) {
      var q = ev.target.closest('[data-quitar]'), lim = ev.target.closest('[data-limpiar]'), ir = ev.target.closest('[data-ir]');
      var e = L.estado;
      if (q) { var k = q.getAttribute('data-quitar'); if (k === 'marca') e.marcas = e.marcas.filter(function (m) { return m !== q.getAttribute('data-valor'); }); if (k === 'precio') e.rango = ''; if (k === 'cat') e.sub = ''; if (k === 'ofertas') e.ofertas = false; if (k === 'credito') e.credito = false; e.p = 1; escribirEstado(e, false); pintarListado(false); }
      if (lim) { e.marcas = []; e.rango = ''; e.sub = ''; e.ofertas = false; e.credito = false; e.p = 1; escribirEstado(e, false); pintarListado(false); }
      if (ir && !esPorDefecto(e) && !ev.metaKey && !ev.ctrlKey) { ev.preventDefault(); e.p = +ir.getAttribute('data-ir'); escribirEstado(e, true); pintarListado(true); }
    });
    // Filtros en móvil (panel)
    var panel = $('[data-filtros]', raiz);
    $$('[data-abrir-filtros]', raiz).forEach(function (b) { b.addEventListener('click', function () { panel.classList.add('abierto'); document.body.classList.add('menu-abierto'); var x = $('[data-cerrar-filtros]', panel); x && x.focus(); }); });
    $$('[data-cerrar-filtros]', raiz).forEach(function (b) { b.addEventListener('click', function () { panel.classList.remove('abierto'); document.body.classList.remove('menu-abierto'); var a = $('[data-abrir-filtros]', raiz); a && a.focus(); }); });
    window.addEventListener('popstate', function () { if (!L.catalogoListo) return; L.estado = leerEstado(); if (!L.estado.p) L.estado.p = 1; pintarListado(false); });
  }
  function listadoConCatalogo() {
    if (!L) return;
    var a = L.alcance;
    L.base_items = CATALOGO.filter(function (p) { return a.buscar ? true : (p.deptSlug === a.dept && (!a.sub || p.subSlug === a.sub)); });
    L.catalogoListo = true;
    if (a.buscar && L.estado.q) medir('search', { search_term: L.estado.q });
    // En páginas estáticas sin filtros, el HTML ya está pintado: solo calculamos filtros.
    if (!a.buscar && esPorDefecto(L.estado)) { pintarFacetas(); pintarActivos(); }
    else pintarListado(false);
  }

  /* ---------- Ficha rápida ---------- */
  function mensajeProducto(p) {
    var c = M.cuota(p);
    return 'Hola, me interesa este producto:\n• ' + p.nombre + (p.marca ? ' (' + p.marca + ')' : '') + '\nContado: ' + pesos(M.precioVigente(p)) + (c ? '\nCuota: ' + pesos(c) + ' x ' + p.meses + ' meses' : '') + '\n' + (T.dominio || location.origin) + p.url;
  }
  function htmlFicha(p) {
    var c = M.cuota(p), d = M.descuento(p);
    var gal = '<div class="galeria"><div class="principal' + (p.imgs[0] ? ' conf' : '') + '"' + M.fondo(p.imgs[0]) + '>' + (p.imgs[0] ? '<img data-foto-principal src="' + esc(p.imgs[0]) + '" alt="' + esc(p.nombre) + '">' : M.foto(p, 600)) + (d ? '<span class="dto grande">-' + d + '%</span>' : '') + '</div>' +
      (p.imgs.length > 1 ? '<div class="miniaturas">' + p.imgs.map(function (src, i) { return '<button type="button" data-mini="' + i + '" aria-label="Foto ' + (i + 1) + '" aria-current="' + (i === 0) + '"><img src="' + esc(src) + '" alt="" loading="lazy"></button>'; }).join('') + '</div>' : '') + '</div>';
    var precio = '<div class="caja-precio">' + (c ? '<div class="credito"><small>Cuota a crédito' + (p.estimado ? ' (aproximada)' : '') + '</small><strong>' + pesos(c) + '</strong> <span>al mes × ' + p.meses + ' meses</span></div>' : '') +
      '<div class="contado-l"><span>Precio de contado</span><span>' + (d ? '<s>' + pesos(p.contado) + '</s> ' : '') + '<b>' + pesos(M.precioVigente(p)) + '</b></span></div></div>';
    var ft = [['Marca', p.marca], ['Color', p.color], ['Categoría', p.sub]].filter(function (x) { return x[1]; });
    return '<button class="cerrar" type="button" data-cerrar-ficha aria-label="Cerrar">×</button>' + gal + '<div class="detalle">' + (p.marca ? '<p class="meta">' + esc(p.marca) + '</p>' : '') + '<h2 class="nombre" id="ficha-titulo">' + esc(p.nombre) + '</h2>' + precio +
      (p.desc ? '<p class="desc">' + esc(p.desc) + '</p>' : '') +
      (ft.length ? '<dl class="ficha-tecnica">' + ft.map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('') + '</dl>' : '') +
      '<div class="botones"><a class="btn btn-wa" target="_blank" rel="noopener" data-wa-producto="' + esc(p.slug) + '" href="' + esc(linkWa('ventas', mensajeProducto(p)) || '#') + '"><svg class="ico"><use href="#i-wa"/></svg>Lo quiero, escribir por WhatsApp</a>' +
      '<button class="btn btn-borde" type="button" data-agregar="' + esc(p.slug) + '">Agregar a cotización</button>' +
      '<a class="enlace" href="' + esc(p.url) + '">Ver página completa del producto</a></div></div>';
  }
  function enlazarGaleria(raiz) {
    if (!raiz) return;
    raiz.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mini]'); if (b) {
        var p = buscarProducto(raiz.getAttribute('data-slug'));
        var img = $('[data-foto-principal]', raiz); if (img && p) img.src = p.imgs[+b.getAttribute('data-mini')];
        $$('[data-mini]', raiz).forEach(function (x) { x.setAttribute('aria-current', x === b ? 'true' : 'false'); });
      }
      var a = e.target.closest('[data-wa-producto]'); if (a) medir('generate_lead', { method: 'whatsapp_ventas', item_id: a.getAttribute('data-wa-producto'), origen: 'producto' });
    });
  }
  var ultimoFoco = null;
  function bloquear(si) { document.body.style.overflow = si ? 'hidden' : ''; $('[data-velo]').classList.toggle('abierto', si); }
  function abrirFicha(p) {
    var f = $('[data-ficha]'), caja = $('[data-ficha-caja]'); if (!f) return;
    ultimoFoco = document.activeElement;
    caja.setAttribute('data-slug', p.slug); caja.innerHTML = htmlFicha(p);
    f.setAttribute('aria-labelledby', 'ficha-titulo'); f.classList.add('abierto'); bloquear(true);
    $('[data-cerrar-ficha]', caja).focus();
    medir('view_item', { item_id: p.slug, item_name: p.nombre, value: M.precioVigente(p), currency: 'COP' });
  }
  function cerrarFicha() {
    var f = $('[data-ficha]'); if (!f || !f.classList.contains('abierto')) return;
    f.classList.remove('abierto'); if (!$('[data-panel]').classList.contains('abierto')) bloquear(false);
    if (ultimoFoco) ultimoFoco.focus();
  }

  /* ---------- Cotización ---------- */
  var COT = [];
  try { COT = JSON.parse(localStorage.getItem('ms_cotizacion') || '[]'); } catch (e) { COT = []; }
  function guardarCot() { try { localStorage.setItem('ms_cotizacion', JSON.stringify(COT)); } catch (e) {} pintarCot(); }
  function agregar(p) {
    var it = COT.filter(function (x) { return x.slug === p.slug; })[0];
    if (it) it.cant++; else COT.push({ slug: p.slug, nombre: p.nombre, marca: p.marca, precio: M.precioVigente(p), cuota: M.cuota(p), meses: p.meses, img: p.imgs[0] || '', url: p.url, cant: 1 });
    guardarCot(); aviso('Agregado a tu cotización');
    medir('add_to_cart', { item_id: p.slug, item_name: p.nombre, value: M.precioVigente(p), currency: 'COP' });
  }
  function pintarCot() {
    var n = COT.reduce(function (s, x) { return s + x.cant; }, 0);
    $$('[data-contador]').forEach(function (c) { c.textContent = n; c.setAttribute('data-n', n); });
    var cont = $('[data-items]'); if (!cont) return;
    cont.innerHTML = COT.length ? COT.map(function (x, i) {
      return '<div class="item">' + (x.img ? '<img src="' + esc(x.img) + '" alt="">' : '<span class="mini"></span>') +
        '<div><h3><a href="' + esc(x.url) + '">' + esc(x.nombre) + '</a></h3><small>' + pesos(x.precio) + ' de contado' + (x.cuota ? '<br>o ' + pesos(x.cuota) + ' al mes × ' + x.meses : '') + '</small></div>' +
        '<div class="cant"><button type="button" data-menos="' + i + '" aria-label="Quitar uno">−</button><span>' + x.cant + '</span><button type="button" data-mas="' + i + '" aria-label="Agregar uno">+</button></div></div>';
    }).join('') : '<p class="vacio">Tu cotización está vacía. Agrega productos y envíalos juntos por WhatsApp.</p>';
    var s = $('[data-suma]'); if (s) s.textContent = pesos(COT.reduce(function (t, x) { return t + x.precio * x.cant; }, 0));
    var b = $('[data-enviar-cotizacion]'); if (b) b.disabled = !COT.length;
  }
  function abrirPanel() { ultimoFoco = document.activeElement; var p = $('[data-panel]'); p.classList.add('abierto'); p.setAttribute('aria-hidden', 'false'); bloquear(true); $('.cerrar', p).focus(); }
  function cerrarPanel() { var p = $('[data-panel]'); if (!p.classList.contains('abierto')) return; p.classList.remove('abierto'); p.setAttribute('aria-hidden', 'true'); if (!$('[data-ficha]').classList.contains('abierto')) bloquear(false); if (ultimoFoco) ultimoFoco.focus(); }
  function iniciarCot() {
    $$('[data-abrir-cotizacion]').forEach(function (b) { b.addEventListener('click', abrirPanel); });
    $('[data-panel] [data-cerrar]').addEventListener('click', cerrarPanel);
    $('[data-velo]').addEventListener('click', function () { cerrarPanel(); cerrarFicha(); });
    $('[data-ficha]').addEventListener('click', function (e) { if (e.target === e.currentTarget || e.target.closest('[data-cerrar-ficha]')) cerrarFicha(); });
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
      var url = linkWa('ventas', 'Hola, quiero cotizar estos productos de la página web:\n' + lineas.join('\n') + '\n\nTotal de contado: ' + pesos(total) + '\n¿Me ayudan con disponibilidad y plan de crédito?');
      if (!url) return aviso('WhatsApp de ventas no configurado');
      medir('generate_lead', { method: 'whatsapp_cotizacion', value: total, currency: 'COP' });
      window.open(url, '_blank', 'noopener');
    });
    document.addEventListener('click', function (e) {
      var a = e.target.closest('[data-agregar]');
      if (a) { var p = buscarProducto(a.getAttribute('data-agregar')); if (p) { agregar(p); if (!a.classList.contains('listo')) { var orig = a.innerHTML; a.classList.add('listo'); a.textContent = 'Agregado ✓'; setTimeout(function () { a.classList.remove('listo'); a.innerHTML = orig; }, 1600); } } return; }
      var v = e.target.closest('[data-ver]');
      if (v && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0 && window.innerWidth > 760) { var pv = buscarProducto(v.getAttribute('data-ver')); if (pv) { e.preventDefault(); abrirFicha(pv); } }
    });
    pintarCot();
  }

  /* ---------- Reseñas ---------- */
  function urlFS(ruta) { return 'https://firestore.googleapis.com/v1/projects/' + T.firebase.projectId + '/databases/(default)/documents' + ruta; }
  function decodificar(v) {
    if (!v) return null;
    if ('stringValue' in v) return v.stringValue; if ('integerValue' in v) return Number(v.integerValue); if ('doubleValue' in v) return v.doubleValue;
    if ('booleanValue' in v) return v.booleanValue; if ('timestampValue' in v) return v.timestampValue; return null;
  }
  function cargarResenas() {
    var cont = $('[data-resenas]'); if (!cont || !T.firebase) return;
    fetch(urlFS(':runQuery') + '?key=' + T.firebase.apiKey, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'resenas' }], where: { fieldFilter: { field: { fieldPath: 'aprobado' }, op: 'EQUAL', value: { booleanValue: true } } }, limit: 30 } })
    }).then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) {
      var lista = (rows || []).filter(function (x) { return x.document; }).map(function (x) { var f = {}; Object.keys(x.document.fields || {}).forEach(function (k) { f[k] = decodificar(x.document.fields[k]); }); return f; })
        .sort(function (a, b) { return String(b.fecha || '').localeCompare(String(a.fecha || '')); }).slice(0, 6);
      if (!lista.length) return;
      cont.innerHTML = lista.map(function (r) { var n = Math.max(1, Math.min(5, Number(r.estrellas) || 5)); return '<figure class="resena"><span class="est" aria-label="' + n + ' de 5 estrellas">' + '★★★★★'.slice(0, n) + '<span class="apagada">' + '★★★★★'.slice(n) + '</span></span><blockquote><p>' + esc(r.texto) + '</p></blockquote><figcaption><small>' + esc(r.nombre) + (r.fecha ? ', ' + new Date(r.fecha).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }) : '') + '</small></figcaption></figure>'; }).join('');
    }).catch(function () {});
  }
  function iniciarFormResena() {
    var f = $('[data-form-resena]'); if (!f) return;
    var est = 0, msg = $('[data-msg-resena]');
    $$('[data-estrellas] button', f).forEach(function (b) {
      b.addEventListener('click', function () { est = +b.getAttribute('data-v'); $$('[data-estrellas] button', f).forEach(function (x) { x.classList.toggle('on', +x.getAttribute('data-v') <= est); x.setAttribute('aria-checked', +x.getAttribute('data-v') === est ? 'true' : 'false'); }); });
    });
    f.addEventListener('submit', function (e) {
      e.preventDefault(); msg.className = 'msg';
      var nombre = f.nombre.value.trim(), texto = f.texto.value.trim();
      if (f.web.value) return;
      if (!nombre || texto.length < 10) { msg.textContent = 'Escribe tu nombre y un comentario de al menos 10 caracteres.'; msg.classList.add('err'); return; }
      if (!est) { msg.textContent = 'Elige una calificación de 1 a 5 estrellas.'; msg.classList.add('err'); return; }
      if (!f.acepto.checked) { msg.textContent = 'Marca la autorización para publicar tu opinión.'; msg.classList.add('err'); return; }
      var btn = f.querySelector('button[type=submit]'); btn.disabled = true;
      fetch(urlFS('/resenas') + '?key=' + T.firebase.apiKey, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { nombre: { stringValue: nombre.slice(0, 60) }, texto: { stringValue: texto.slice(0, 600) }, estrellas: { integerValue: String(est) }, aprobado: { booleanValue: false }, fecha: { stringValue: new Date().toISOString() }, origen: { stringValue: 'web' } } })
      }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        f.reset(); est = 0; $$('[data-estrellas] button', f).forEach(function (x) { x.classList.remove('on'); });
        msg.textContent = 'Recibimos tu opinión. La publicamos después de revisarla.'; msg.classList.add('ok');
      }).catch(function () { msg.textContent = 'No se pudo enviar tu opinión. Inténtalo de nuevo o escríbenos por WhatsApp.'; msg.classList.add('err'); })
        .then(function () { btn.disabled = false; });
    });
  }

  /* ---------- Arranque ---------- */
  function arrancar() {
    iniciarConsentimiento(); prepararCanales(); iniciarMenu(); iniciarSlider(); iniciarRieles(); iniciarCot(); iniciarListado(); iniciarFormResena(); cargarResenas();
    if (window.__PRODUCTO) { enlazarGaleria($('[data-detalle-producto]')); medir('view_item', { item_id: window.__PRODUCTO.slug, item_name: window.__PRODUCTO.nombre, value: M.precioVigente(window.__PRODUCTO), currency: 'COP' }); }
    cargarCatalogo().then(function (lista) { CATALOGO = lista; listadoConCatalogo(); }).catch(function () {
      if (L && L.alcance.buscar) $('[data-rejilla]', L.raiz).innerHTML = '<div class="vacio"><p><strong>No pudimos cargar el catálogo.</strong></p><p>Recarga la página o pregunta a un asesor por WhatsApp.</p></div>';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar); else arrancar();
})();
