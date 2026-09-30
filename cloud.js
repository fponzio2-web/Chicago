'use strict';

/* ---------- nuvem (Supabase) ---------- */
let sb = null, syncChain = Promise.resolve();
const remote = new Map();
const SYNC_TEXT = { local: 'Só neste aparelho', loading: 'Conectando à nuvem…', saving: 'Salvando…', ok: 'Nuvem sincronizada', error: 'Sem conexão com a nuvem', nolib: 'Não foi possível carregar a nuvem' };
function setSync(s, detail) {
  const label = (SYNC_TEXT[s] || '') + (detail ? ': ' + detail : '');
  const dot = $('#syncDot');
  dot.dataset.s = s === 'saving' || s === 'loading' ? 'busy' : s;
  dot.setAttribute('aria-label', label); dot.title = label;
  $('#syncState').textContent = SYNC_TEXT[s] || '';
  const bar = $('#syncBar'), bad = s === 'error' || s === 'nolib';
  bar.hidden = !bad; bar.textContent = bad ? label : '';
}
function describeErr(e) {
  const m = String((e && (e.message || e.details)) || e || ''), c = e && e.code;
  if (/rating/i.test(m)) return 'falta a coluna da nota (rode o SQL novo no Supabase)';
  if (/category/i.test(m)) return 'falta a coluna da categoria (rode o SQL novo no Supabase)';
  if (/description/i.test(m)) return 'falta a coluna da descrição (rode o SQL novo no Supabase)';
  if (c === 'PGRST205' || c === '42P01' || /does not exist|schema cache/i.test(m)) return 'tabela não encontrada (rode o SQL no Supabase)';
  if (c === '42501' || /row-level security|permission denied/i.test(m)) return 'sem permissão (rode o SQL da política)';
  if (c === 'PGRST301' || /invalid api key|jwt|apikey/i.test(m)) return 'chave inválida (confira o config.js)';
  if (/failed to fetch|network|load failed/i.test(m)) return 'URL errada ou sem internet (confira o config.js)';
  return m.slice(0, 90) || 'erro desconhecido';
}
const rowOf = i => ({ id: i.id, name: i.name, address: i.address, region: i.region, category: i.category, description: i.description, note: i.note, done: i.done, rating: i.rating,
  lat: hasGeo(i) ? i.lat : null, lng: hasGeo(i) ? i.lng : null, geo: i.geo, manual: i.manual, ts: i.ts });
const sig = i => JSON.stringify(rowOf(i));
const fromRow = r => clean({ id: r.id, name: r.name, address: r.address, region: r.region, category: r.category, description: r.description, note: r.note, done: r.done, rating: r.rating,
  lat: r.lat, lng: r.lng, geo: r.geo, manual: r.manual, ts: r.ts });
const byNewest = (a, b) => b.ts - a.ts;
function diff() {
  const seen = new Set(), up = [];
  items.forEach(i => { seen.add(i.id); if (remote.get(i.id) !== sig(i)) up.push(i); });
  const del = [...remote.keys()].filter(id => !seen.has(id));
  return { up, del };
}
async function doSync() {
  const { up, del } = diff();
  if (!up.length && !del.length) return;
  setSync('saving');
  try {
    if (up.length) {
      const { error } = await sb.from(TABLE).upsert(up.map(rowOf));
      if (error) throw error;
      up.forEach(i => remote.set(i.id, sig(i)));
    }
    if (del.length) {
      const { error } = await sb.from(TABLE).delete().in('id', del);
      if (error) throw error;
      del.forEach(id => remote.delete(id));
    }
    setSync('ok');
  } catch (e) {
    setSync('error', describeErr(e));
    toast('Não deu para salvar na nuvem. Veja o aviso vermelho abaixo do título.');
  }
}
function pushChanges() { syncChain = syncChain.then(doSync); return syncChain; }
async function pull(first) {
  if (!first) { await pushChanges(); }
  const { data, error } = await sb.from(TABLE).select('*').order('ts', { ascending: false });
  if (error) { setSync('error', describeErr(error)); return false; }
  const rows = data.map(fromRow).filter(Boolean);
  remote.clear(); rows.forEach(r => remote.set(r.id, sig(r)));
  let next = rows;
  if (first) {
    let seeded = false;
    try { seeded = !!localStorage.getItem(SEEDED); } catch (e) { /* ignora */ }
    if (!seeded) {
      const names = new Set(rows.map(r => nameKey(r.name)));
      next = rows.concat(items.filter(i => !names.has(nameKey(i.name))));
      try { localStorage.setItem(SEEDED, '1'); } catch (e) { /* ignora */ }
    }
  }
  items = next.sort(byNewest);
  cache(); setSync('ok');
  const d = diff();
  if (d.up.length || d.del.length) pushChanges();
  render();
  items.filter(i => i.geo === 'pending').forEach(i => queueGeo(i.id));
  return true;
}
function onRemoteChange(p) {
  if (p.eventType === 'DELETE') {
    const id = p.old && p.old.id; if (!id) return;
    remote.delete(id);
    const k = items.findIndex(i => i.id === id);
    if (k >= 0) { items.splice(k, 1); if (ui.openId === id) ui.openId = null; afterRemote(); }
    return;
  }
  const it = p.new && fromRow(p.new); if (!it) return;
  remote.set(it.id, sig(it));
  const k = items.findIndex(i => i.id === it.id);
  if (k >= 0) { if (sig(items[k]) === sig(it)) return; items[k] = it; } else items.push(it);
  afterRemote();
}
function afterRemote() { items.sort(byNewest); cache(); ui.fitNext = false; render(); }
async function cloudInit() {
  if (WANT_CLOUD && !window.supabase) { setSync('nolib'); return; }
  if (!CLOUD) { setSync('local'); return; }
  sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey);
  setSync('loading');
  let ok = false;
  try { ok = await pull(true); } catch (e) { setSync('error', describeErr(e)); }
  sb.channel('places-live').on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, onRemoteChange).subscribe();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pull(false); });
  window.addEventListener('online', () => pull(false));
  setInterval(() => { if (document.visibilityState === 'visible') pull(false); }, 60000);
}

