#!/usr/bin/env node
/* Calcula una "huella" del catálogo de Firestore (id + fecha de última
   modificación de cada producto) SIN descargar las fotos.
   Si la huella cambió respecto a .catalogo-version, la escribe y avisa
   (salida "cambio=1") para que el flujo de GitHub publique la web. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const RAIZ = path.join(__dirname, '..');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'public/assets/config.js'), 'utf8'), ctx);
const { projectId, apiKey } = ctx.window.TIENDA.firebase;
const ARCHIVO = path.join(RAIZ, '.catalogo-version');

(async () => {
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/catalogo`;
  const items = []; let token = '';
  do {
    const r = await fetch(`${base}?pageSize=300&mask.fieldPaths=estado&key=${apiKey}${token ? '&pageToken=' + encodeURIComponent(token) : ''}`);
    if (!r.ok) throw new Error(`Firestore respondió ${r.status}: ${await r.text()}`);
    const j = await r.json();
    for (const d of j.documents || []) items.push(d.name.split('/').pop() + '@' + d.updateTime);
    token = j.nextPageToken || '';
  } while (token);
  // Entregas publicadas: si cambian (nueva foto, ocultar, borrar) también se republica la web
  try {
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ structuredQuery: { select: { fields: [{ fieldPath: 'publicar' }] }, from: [{ collectionId: 'entregas' }], where: { fieldFilter: { field: { fieldPath: 'publicar' }, op: 'EQUAL', value: { booleanValue: true } } } } })
    });
    if (!r.ok) throw new Error(`Firestore respondió ${r.status}: ${(await r.text()).slice(0, 200)}`);
    let n = 0;
    for (const x of await r.json()) if (x.document) { n++; items.push('entrega:' + x.document.name.split('/').pop() + '@' + x.document.updateTime); }
    console.log(`${n} entregas marcadas para publicar`);
  } catch (e) { console.error('Aviso: no se pudieron revisar las entregas:', e.message); }
  items.sort();
  const huella = crypto.createHash('sha256').update(items.join('\n')).digest('hex');
  const anterior = fs.existsSync(ARCHIVO) ? fs.readFileSync(ARCHIVO, 'utf8').split('\n')[0].trim() : '';
  const cambio = huella !== anterior;
  if (cambio) fs.writeFileSync(ARCHIVO, `${huella}\n${items.length} productos\n`);
  console.log(`${items.length} elementos (productos y entregas) · huella ${huella.slice(0, 12)} · ${cambio ? 'CAMBIÓ' : 'sin cambios'}`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `cambio=${cambio ? 1 : 0}\n`);
})().catch(e => { console.error('No se pudo leer el catálogo:', e.message); process.exit(1); });
