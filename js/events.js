'use strict';

/* ---------- eventos gerais ---------- */
$('#list').addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || b.tagName === 'SELECT') return;
  const li = b.closest('.item');
  const it = li && items.find(x => x.id === li.dataset.id);
  if (it) act(b.dataset.act, it, b);
});
$('#list').addEventListener('change', e => {
  const b = e.target.closest('[data-act="quickcat"]');
  if (!b) return;
  const li = b.closest('.item');
  const it = li && items.find(x => x.id === li.dataset.id);
  if (it) act('quickcat', it, b);
});
$('#chips').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  ui.groupValue = b.dataset.val; ui.fitNext = true; render();
});
$('#groupToggle').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  ui.groupBy = b.dataset.group; ui.groupValue = 'all'; ui.fitNext = true; render();
});
$('#sortSelect').addEventListener('change', () => { ui.sort = $('#sortSelect').value; renderList(); });
$('#btnNearMe').addEventListener('click', () => {
  const btn = $('#btnNearMe'), lbl = $('#nearBtnLabel'), opt = $('#sortDistanceOpt');
  if (userCoords) {
    userCoords = null;
    opt.hidden = true;
    btn.setAttribute('aria-pressed', 'false'); lbl.textContent = tr('nearLabel');
    if (ui.sort === 'distance') { ui.sort = 'recent'; $('#sortSelect').value = 'recent'; }
    renderList();
    toast(tr('nearMeOff'));
    return;
  }
  if (!navigator.geolocation) { toast(tr('noGeoSupport')); return; }
  btn.disabled = true; lbl.textContent = tr('nearLocating');
  navigator.geolocation.getCurrentPosition(
    pos => {
      userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      opt.hidden = false;
      ui.sort = 'distance'; $('#sortSelect').value = 'distance';
      btn.disabled = false; btn.setAttribute('aria-pressed', 'true'); lbl.textContent = tr('nearLabelActive');
      renderList();
      toast(tr('nearMeReady'));
    },
    err => {
      btn.disabled = false; lbl.textContent = tr('nearLabel');
      toast(err && err.code === 1 ? tr('nearMeDenied') : tr('nearMeFail'));
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
});
$('#seg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  ui.status = b.dataset.status; ui.fitNext = true; render();
});
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
$('#btnAdd').addEventListener('click', () => openForm(null));
$('#btnBatch').addEventListener('click', () => { $('#bStatus').textContent = ''; $('#batchDlg').showModal(); });
$('#btnData').addEventListener('click', () => {
  const n = items.filter(i => !i.category).length;
  const b = $('#classifyBadge');
  b.hidden = !n; b.textContent = n;
  $('#moreDlg').showModal();
});
$('#menuClassify').addEventListener('click', () => { $('#moreDlg').close(); openClassify(); });
$('#menuData').addEventListener('click', () => { $('#moreDlg').close(); openData(); });
$('#menuLang').addEventListener('click', () => { setLang(LANG === 'pt' ? 'en' : 'pt'); });
$('#placingCancel').addEventListener('click', cancelPlacing);
$('#emptyBox').addEventListener('click', e => {
  const b = e.target.closest('[data-empty]'); if (!b) return;
  const k = b.dataset.empty;
  if (k === 'add') openForm(null);
  else if (k === 'batch') { $('#bStatus').textContent = ''; $('#batchDlg').showModal(); }
  else if (k === 'clear') { ui.status = 'all'; ui.groupValue = 'all'; ui.fitNext = true; render(); }
  else if (k === 'samples') {
    const base = Date.now();
    SAMPLES.forEach((s, k) => items.push(clean({ name: s[0], address: s[1], region: s[2], lat: s[3], lng: s[4], category: s[5], description: s[6], ts: base + (SAMPLES.length - k) })));
    items.sort(byNewest);
    ui.fitNext = true; save(); render();
  }
});
document.addEventListener('click', e => {
  const c = e.target.closest('[data-close]');
  if (c) c.closest('dialog').close();
});
window.addEventListener('resize', () => { if (map) map.invalidateSize(); });

/* ---------- início ---------- */
function boot() {
  revealApp();
  applyI18n();
  initMap();
  render();
  if (CLOUD) cloudInit();
  else { setSync(WANT_CLOUD ? 'nolib' : 'local'); items.filter(i => i.geo === 'pending').forEach(i => queueGeo(i.id)); }
}
load();
items.sort(byNewest);
(async () => {
  if (await isUnlocked()) { boot(); return; }
  applyI18n();
  $('#lockScreen').hidden = false;
  $('#lockInput').focus();
  $('#lockForm').addEventListener('submit', async e => {
    e.preventDefault();
    const h = await sha256Hex($('#lockInput').value);
    if (h === RAW_HASH) {
      try { localStorage.setItem(LOCK_KEY, h); } catch (err) { /* ignora */ }
      boot();
    } else {
      $('#lockErr').hidden = false;
      $('#lockInput').value = ''; $('#lockInput').focus();
    }
  });
})();
