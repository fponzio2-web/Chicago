'use strict';

/* ---------- constantes e configuração ---------- */
const KEY = 'chicago-checklist-v1';
const STAR = '12,2 14.89,7 20.66,7 17.77,12 20.66,17 14.89,17 12,22 9.11,17 3.34,17 6.23,12 3.34,7 9.11,7';
const SUGGEST = ['Loop','West Loop','South Loop','River North','Near North Side','Gold Coast','Streeterville','Old Town','Lincoln Park','Lakeview','Wicker Park','Logan Square','Pilsen','Chinatown','Hyde Park','Uptown','Andersonville','Greektown','Bronzeville','Fulton Market'];
const CATEGORIES = ['Atração', 'Museu', 'Parque', 'Restaurante', 'Fast food', 'Bar / Café', 'Compras', 'Evento', 'Outro'];
const CAT_SYNONYMS = [
  ['atracao', 'Atração'], ['attraction', 'Atração'], ['tourist attraction', 'Atração'], ['ponto turistico', 'Atração'], ['landmark', 'Atração'],
  ['museu', 'Museu'], ['museum', 'Museu'], ['galeria', 'Museu'], ['gallery', 'Museu'], ['art gallery', 'Museu'],
  ['parque', 'Parque'], ['park', 'Parque'], ['jardim', 'Parque'], ['garden', 'Parque'], ['zoo', 'Parque'], ['zoologico', 'Parque'], ['praia', 'Parque'], ['beach', 'Parque'],
  ['restaurante', 'Restaurante'], ['restaurant', 'Restaurante'], ['pizzaria', 'Restaurante'], ['steakhouse', 'Restaurante'],
  ['fast food', 'Fast food'], ['fastfood', 'Fast food'], ['lanchonete', 'Fast food'], ['burger', 'Fast food'], ['hamburgueria', 'Fast food'],
  ['bar', 'Bar / Café'], ['bar cafe', 'Bar / Café'], ['cafe', 'Bar / Café'], ['coffee', 'Bar / Café'], ['coffee shop', 'Bar / Café'], ['pub', 'Bar / Café'], ['cafeteria', 'Bar / Café'],
  ['compras', 'Compras'], ['shopping', 'Compras'], ['loja', 'Compras'], ['store', 'Compras'], ['mercado', 'Compras'], ['market', 'Compras'],
  ['evento', 'Evento'], ['show', 'Evento'], ['teatro', 'Evento'], ['theatre', 'Evento'], ['theater', 'Evento'], ['musica', 'Evento'], ['concert', 'Evento'], ['esporte', 'Evento'], ['sports', 'Evento'],
  ['outro', 'Outro'], ['other', 'Outro']
];
const SAMPLES = [
  ['Cloud Gate (The Bean)','201 E Randolph St','Loop',41.8827,-87.6233,'Atração','Escultura de aço polido que reflete o horizonte da cidade, ótima para fotos'],
  ['Art Institute of Chicago','111 S Michigan Ave','Loop',41.8796,-87.6237,'Museu','Um dos maiores museus de arte dos EUA, com obras impressionistas famosas'],
  ['Skydeck Chicago (Willis Tower)','233 S Wacker Dr','Loop',41.8789,-87.6359,'Atração','Mirante com piso de vidro a 412 metros de altura sobre a cidade'],
  ['Navy Pier','600 E Grand Ave','Streeterville',41.8917,-87.6086,'Atração','Píer à beira do lago com roda-gigante, parque e passeios de barco'],
  ['Wrigley Field','1060 W Addison St','Lakeview',41.9484,-87.6553,'Evento','Estádio histórico do Chicago Cubs, um dos mais antigos do beisebol'],
  ['Lincoln Park Zoo','2001 N Clark St','Lincoln Park',41.9212,-87.6337,'Parque','Zoológico gratuito com leões, girafas e um belo jardim conservatório'],
  ['Museum of Science and Industry','5700 S DuSable Lake Shore Dr','Hyde Park',41.7906,-87.5830,'Museu','Museu interativo de ciência, com um submarino de verdade e mina de carvão'],
  ['Garfield Park Conservatory','300 N Central Park Ave','East Garfield Park',41.8862,-87.7168,'Parque','Estufa enorme com plantas tropicais, deserto e um jardim de crianças']
];

const CFG = window.APP_CONFIG || {};
const LOCK_KEY = 'chicago-unlock-v1';
const RAW_HASH = String(CFG.passcodeHash || '').trim().toLowerCase();
const WANT_LOCK = !!RAW_HASH && !/COLE_AQUI/i.test(RAW_HASH) && /^[0-9a-f]{64}$/.test(RAW_HASH);
async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function isUnlocked() {
  if (!WANT_LOCK) return true;
  try { return localStorage.getItem(LOCK_KEY) === RAW_HASH; } catch (e) { return false; }
}
function revealApp() {
  $('#lockScreen').hidden = true;
  $('#app').hidden = false;
}
const TABLE = 'places';
const SEEDED = 'chicago-cloud-seeded';
const WANT_CLOUD = !!(CFG.supabaseUrl && CFG.supabaseKey) && !/COLE_AQUI/.test(CFG.supabaseUrl + CFG.supabaseKey);
const CLOUD = WANT_CLOUD && !!window.supabase;

const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const STAR_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><polygon class="star" points="${STAR}"/></svg>`;
const HEART_PATH = 'M12 21s-7-4.35-9.33-8.5C.9 9.3 2.6 5.5 6.2 5.5c2.1 0 3.6 1.2 5.8 3.5 2.2-2.3 3.7-3.5 5.8-3.5 3.6 0 5.3 3.8 3.53 7C19 16.65 12 21 12 21z';
const heartSvg = cls => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path class="h" d="${HEART_PATH}"/></svg>`;
const PIN_SVG = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';

let items = [];
const ui = { status: 'all', groupBy: 'region', groupValue: 'all', sort: 'recent', view: 'list', openId: null, placingId: null, editingId: null, fitNext: true };

/* ---------- avisos (toast) e utilitários ---------- */
let toastTimer;
function toast(msg, undoFn) {
  const t = $('#toast'), b = t.querySelector('button');
  t.querySelector('span').textContent = msg;
  b.hidden = !undoFn;
  b.onclick = () => { if (undoFn) undoFn(); t.hidden = true; };
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, undoFn ? 6000 : 3500);
}
function flash(el, msg) {
  el.textContent = msg;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.textContent = ''; }, 4000);
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; }
  catch (e) {
    const ta = document.createElement('textarea');
    ta.value = t; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { /* ignora */ }
    ta.remove(); return ok;
  }
}
