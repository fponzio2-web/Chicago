'use strict';

/* ---------- dados ---------- */
function clean(o) {
  if (!o || typeof o !== 'object') return null;
  const name = String(o.name || '').trim();
  if (!name) return null;
  const hasGeo = o.lat != null && o.lat !== '' && o.lng != null && o.lng !== '' && Number.isFinite(+o.lat) && Number.isFinite(+o.lng);
  return {
    id: o.id || uid(), name,
    address: String(o.address || '').trim(),
    region: String(o.region || '').trim(),
    category: String(o.category || '').trim(),
    description: String(o.description || '').trim(),
    note: String(o.note || '').trim(),
    done: !!o.done,
    lat: hasGeo ? +o.lat : undefined,
    lng: hasGeo ? +o.lng : undefined,
    geo: hasGeo ? 'ok' : (o.geo === 'fail' ? 'fail' : 'pending'),
    manual: !!o.manual,
    rating: Math.max(0, Math.min(5, Math.round((+o.rating || 0) * 2) / 2)),
    ts: Number.isFinite(+o.ts) && o.ts != null ? +o.ts : Date.now()
  };
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const d = JSON.parse(raw); if (Array.isArray(d)) items = d.map(clean).filter(Boolean); }
  } catch (e) { /* sem dados salvos */ }
}
function cache() {
  try { localStorage.setItem(KEY, JSON.stringify(items)); return true; }
  catch (e) { return false; }
}
function save() {
  if (!cache() && !CLOUD) toast('Não foi possível salvar neste navegador.');
  if (CLOUD) pushChanges();
}
const hasGeo = i => Number.isFinite(i.lat) && Number.isFinite(i.lng);
const regionOf = i => i.region || 'Sem região';
const categoryOf = i => i.category || 'Sem categoria';
const nameKey = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\(.*?\)/g, ' ').replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/^(the|a|an) /, '').trim();
function canonRegion(r) {
  r = (r || '').trim(); if (!r) return '';
  const ex = items.find(i => i.region && i.region.toLowerCase() === r.toLowerCase());
  return ex ? ex.region : r;
}
const CAT_MAP = new Map(CAT_SYNONYMS.map(([k, v]) => [nameKey(k), v]));
CATEGORIES.forEach(c => CAT_MAP.set(nameKey(c), c));
function canonCategory(text) {
  text = (text || '').trim(); if (!text) return '';
  return CAT_MAP.get(nameKey(text)) || 'Outro';
}
const CAT_SLUG = { 'Atração': 'atracao', 'Museu': 'museu', 'Parque': 'parque', 'Restaurante': 'restaurante',
  'Fast food': 'fastfood', 'Bar / Café': 'barcafe', 'Compras': 'compras', 'Evento': 'evento', 'Outro': 'outro' };
const catTagClass = i => i.category ? 'tag cat c-' + (CAT_SLUG[i.category] || 'outro') : 'tag cat unset';
function regionList() {
  const m = new Map();
  items.forEach(i => {
    const name = regionOf(i), key = name.toLowerCase();
    if (!m.has(key)) m.set(key, { key, name, n: 0 });
    m.get(key).n++;
  });
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt'));
}
function categoryList() {
  const m = new Map();
  items.forEach(i => {
    const name = categoryOf(i), key = name.toLowerCase();
    if (!m.has(key)) m.set(key, { key, name, n: 0 });
    m.get(key).n++;
  });
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt'));
}
let userCoords = null;
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
const distKm = i => (userCoords && hasGeo(i)) ? haversineKm(userCoords.lat, userCoords.lng, i.lat, i.lng) : Infinity;
const SORTS = {
  recent: (a, b) => b.ts - a.ts,
  name: (a, b) => a.name.localeCompare(b.name, 'pt'),
  region: (a, b) => regionOf(a).localeCompare(regionOf(b), 'pt') || a.name.localeCompare(b.name, 'pt'),
  category: (a, b) => categoryOf(a).localeCompare(categoryOf(b), 'pt') || a.name.localeCompare(b.name, 'pt'),
  rating: (a, b) => (b.rating || 0) - (a.rating || 0) || a.name.localeCompare(b.name, 'pt'),
  distance: (a, b) => distKm(a) - distKm(b)
};
function visible() {
  const getter = ui.groupBy === 'category' ? categoryOf : regionOf;
  return items.filter(i =>
    (ui.status === 'all' || (ui.status === 'done') === i.done) &&
    (ui.groupValue === 'all' || getter(i).toLowerCase() === ui.groupValue));
}
const mapsUrl = i => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(i.name + ' ' + (i.address || 'Chicago, IL'));


/* ---------- geocodificação (OpenStreetMap / Nominatim) ---------- */
const geoQueue = []; let geoBusy = false, lastReq = 0;
function queueGeo(id) { if (!geoQueue.includes(id)) geoQueue.push(id); runGeo(); }
async function nominatim(q) {
  const wait = Math.max(0, 1100 - (Date.now() - lastReq));
  if (wait) await sleep(wait);
  lastReq = Date.now();
  const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&bounded=1&viewbox=-88.3,42.3,-87.3,41.4&q=' + encodeURIComponent(q);
  const r = await fetch(url);
  if (!r.ok) throw new Error('http ' + r.status);
  const d = await r.json();
  return d && d[0] ? { lat: +d[0].lat, lng: +d[0].lon } : null;
}
async function geocode(it) {
  const city = /chicago|,\s*il\b|illinois/i;
  const tries = [];
  if (it.address) tries.push(city.test(it.address) ? it.address : it.address + ', Chicago, IL');
  tries.push(it.name + ', Chicago, IL');
  if (it.address) tries.push(it.name + ' ' + it.address);
  for (const q of tries) { const r = await nominatim(q); if (r) return r; }
  return null;
}
async function runGeo() {
  if (geoBusy) return;
  geoBusy = true;
  while (geoQueue.length) {
    const id = geoQueue.shift();
    const it = items.find(x => x.id === id);
    if (!it || it.geo !== 'pending') continue;
    let res = null;
    try { res = await geocode(it); } catch (e) { res = null; }
    const cur = items.find(x => x.id === id);
    if (!cur) continue;
    if (res) { cur.lat = res.lat; cur.lng = res.lng; cur.geo = 'ok'; } else { cur.geo = 'fail'; }
    save();
    ui.fitNext = geoQueue.length === 0;
    render();
  }
  geoBusy = false;
}

