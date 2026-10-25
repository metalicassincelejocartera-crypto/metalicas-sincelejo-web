/* Funciones compartidas entre el navegador (app.js) y la compilación (build.js) */
window.MS = (function () {
  'use strict';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var pesos = function (n) { return '$ ' + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  var sinTilde = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  var slug = function (s) { return sinTilde(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); };
  var enOferta = function (p) { return p.promo != null && p.promo > 0 && p.promo < p.contado; };
  var precioVigente = function (p) { return enOferta(p) ? p.promo : p.contado; };
  var cuota = function (p) { return (p.credito && p.meses) ? Math.round(p.credito / p.meses) : null; };
  var descuento = function (p) { return enOferta(p) ? Math.round((1 - p.promo / p.contado) * 100) : 0; };

  function foto(p, ancho, extra) {
    if (p.imgs && p.imgs[0]) return '<img src="' + esc(p.imgs[0]) + '" alt="' + esc(p.nombre) + '" loading="lazy" decoding="async" width="' + ancho + '" height="' + ancho + '"' + (extra || '') + '>';
    return '<span class="sin-foto"><svg aria-hidden="true"><use href="#d-' + esc(p.icono || 'hogar') + '"/></svg><span>Foto disponible por WhatsApp</span></span>';
  }

  function tarjeta(p) {
    var c = cuota(p), d = descuento(p);
    var precio = c
      ? '<p class="cuota"><span class="valor">' + pesos(c) + '</span><span class="por">al mes × ' + p.meses + '</span></p>' +
        '<p class="contado">' + (d ? '<s>' + pesos(p.contado) + '</s> ' : '') + '<span class="nw">Contado <b>' + pesos(precioVigente(p)) + '</b></span></p>'
      : '<p class="cuota"><span class="valor">' + pesos(precioVigente(p)) + '</span><span class="por">de contado</span></p>' + (d ? '<p class="contado">Antes <s>' + pesos(p.contado) + '</s></p>' : '');
    return '<article class="tarjeta">' +
      '<a class="foto" href="' + esc(p.url) + '" data-ver="' + esc(p.slug) + '" tabindex="-1" aria-hidden="true">' + foto(p, 400) + (d ? '<span class="dto">-' + d + '%</span>' : '') + '</a>' +
      '<div class="cuerpo"><p class="meta">' + esc(p.marca || p.sub) + '</p>' +
      '<h3><a href="' + esc(p.url) + '" data-ver="' + esc(p.slug) + '">' + esc(p.nombre) + '</a></h3>' +
      '<div class="precios">' + precio + '</div>' +
      '<button class="agregar" type="button" data-agregar="' + esc(p.slug) + '">Agregar a cotización</button></div></article>';
  }

  // Ordenes
  var ORDENES = {
    relevancia: function (a, b) { return (descuento(b) - descuento(a)) || ((b.imgs.length > 0) - (a.imgs.length > 0)) || a.nombre.localeCompare(b.nombre, 'es'); },
    menor: function (a, b) { return precioVigente(a) - precioVigente(b); },
    mayor: function (a, b) { return precioVigente(b) - precioVigente(a); },
    cuota: function (a, b) { return (cuota(a) || 1e12) - (cuota(b) || 1e12); },
    descuento: function (a, b) { return descuento(b) - descuento(a); }
  };
  // Rangos de precio (contado vigente)
  var RANGOS = [
    { id: 'hasta-500', nombre: 'Hasta $ 500.000', min: 0, max: 500000 },
    { id: '500-1000', nombre: '$ 500.000 a $ 1.000.000', min: 500000, max: 1000000 },
    { id: '1000-2000', nombre: '$ 1.000.000 a $ 2.000.000', min: 1000000, max: 2000000 },
    { id: '2000-5000', nombre: '$ 2.000.000 a $ 5.000.000', min: 2000000, max: 5000000 },
    { id: 'mas-5000', nombre: 'Más de $ 5.000.000', min: 5000000, max: Infinity }
  ];
  function enRango(p, id) { for (var i = 0; i < RANGOS.length; i++) if (RANGOS[i].id === id) { var v = precioVigente(p); return v >= RANGOS[i].min && v < RANGOS[i].max; } return true; }

  return { esc: esc, pesos: pesos, sinTilde: sinTilde, slug: slug, enOferta: enOferta, precioVigente: precioVigente, cuota: cuota, descuento: descuento, foto: foto, tarjeta: tarjeta, ORDENES: ORDENES, RANGOS: RANGOS, enRango: enRango };
})();
