'use strict';

/* ---------- renderização ---------- */
function render() {
  renderHeader(); renderChips(); renderList(); renderMap();
}
function renderHeader() {
  const d = items.filter(i => i.done).length;
  $('#progressText').textContent = items.length ? tr('progressDone', { done: d, total: items.length }) : tr('emptyList');
  $('#regionSuggest').innerHTML = [...new Set([...SUGGEST, ...items.map(i => i.region).filter(Boolean)])].map(r => `<option value="${esc(r)}">`).join('');
  const catOpts = `<option value="">${tr('noCategory')}</option>` + CATEGORIES.map(c => `<option value="${esc(c)}">${esc(categoryLabel(c))}</option>`).join('');
  const fc = $('#fCategory');
  const fcPrev = fc.value;
  fc.innerHTML = catOpts;
  fc.value = fcPrev;
  $('#dataDot').hidden = !items.some(i => !i.category);
}
function renderChips() {
  const isCat = ui.groupBy === 'category';
  const rs = isCat ? categoryList() : regionList();
  if (ui.groupValue !== 'all' && !rs.some(r => r.key === ui.groupValue)) ui.groupValue = 'all';
  const el = $('#chips');
  el.setAttribute('aria-label', isCat ? tr('filterByCategoryAria') : tr('filterByRegionAria'));
  el.hidden = !rs.length;
  el.innerHTML = rs.length
    ? `<button class="chip" data-val="all" aria-pressed="${ui.groupValue === 'all'}">${tr('chipAll')}<small>${items.length}</small></button>` +
      rs.map(r => `<button class="chip" data-val="${esc(r.key)}" aria-pressed="${ui.groupValue === r.key}">${esc(r.name)}<small>${r.n}</small></button>`).join('')
    : '';
  document.querySelectorAll('#seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.status === ui.status)));
  document.querySelectorAll('#groupToggle button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.group === ui.groupBy)));
  $('#sortSelect').value = ui.sort;
}
function moreHTML(i) {
  const catOpts = ['', ...CATEGORIES].map(c => `<option value="${esc(c)}" ${c === (i.category || '') ? 'selected' : ''}>${c ? esc(categoryLabel(c)) : tr('noCategory')}</option>`).join('');
  return `<div class="more">
    ${i.address ? `<p class="addr">${esc(i.address)}</p>` : ''}
    ${i.note ? `<p class="note">${esc(i.note)}</p>` : ''}
    <div class="quickcat">
      <label for="qc-${esc(i.id)}">${tr('categoryFieldLabel')}</label>
      <select id="qc-${esc(i.id)}" data-act="quickcat">${catOpts}</select>
    </div>
    <div class="row">
      ${i.description ? `<button type="button" class="btn small" data-act="toggledesc" aria-expanded="false">${tr('viewDescription')}</button>` : ''}
      ${hasGeo(i) ? `<button class="btn small" data-act="show">${tr('viewOnMap')}</button>` : ''}
      ${i.geo === 'fail' ? `<button class="btn small" data-act="retry">${tr('retry')}</button>` : ''}
      ${map ? `<button class="btn small" data-act="place">${hasGeo(i) ? tr('reposition') : tr('placeOnMap')}</button>` : ''}
      <button class="btn small" data-act="edit">${tr('edit')}</button>
      <button class="btn small danger" data-act="del">${tr('delete')}</button>
    </div>
    ${i.description ? `<p class="description" hidden>${esc(i.description)}</p>` : ''}
  </div>`;
}
function rateRow(i) {
  const val = i.rating || 0;
  let hs = '';
  for (let n = 0; n < 5; n++) {
    const frac = Math.max(0, Math.min(1, val - n)) * 100;
    hs += `<span class="heart-slot">${heartSvg('h-bg')}<span class="h-fill" style="width:${frac}%">${heartSvg('')}</span></span>`;
  }
  const label = val ? tr('rateYourRating', { val: String(val).replace(/\.0$/, '') }) : tr('rateGive');
  return `<div class="rate-row">
    <span class="lbl">${label}</span>
    <div class="hearts" data-id="${esc(i.id)}" role="slider" tabindex="0" aria-label="${tr('rateAriaLabel', { name: esc(i.name) })}" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${val}" aria-valuetext="${val ? tr('rateAriaValueOf5', { val }) : tr('rateAriaNone')}">${hs}</div>
  </div>`;
}
function ratingFromPointer(container, clientX) {
  const rect = container.getBoundingClientRect();
  const w = rect.width || 1;
  const x = Math.max(0, Math.min(w, clientX - rect.left));
  return Math.round((x / w) * 10) / 2;
}
function paintRating(container, val) {
  container.setAttribute('aria-valuenow', val);
  container.setAttribute('aria-valuetext', val ? tr('rateAriaValueOf5', { val }) : tr('rateAriaNone'));
  container.querySelectorAll('.heart-slot').forEach((slot, idx) => {
    const frac = Math.max(0, Math.min(1, val - idx)) * 100;
    slot.querySelector('.h-fill').style.width = frac + '%';
  });
  const lbl = container.parentElement.querySelector('.lbl');
  if (lbl) lbl.textContent = val ? tr('rateYourRating', { val: String(val).replace(/\.0$/, '') }) : tr('rateGive');
}
function bindRating(container) {
  const id = container.dataset.id;
  const commit = val => {
    const it = items.find(x => x.id === id); if (!it) return;
    it.rating = val; save(); renderList();
  };
  const onMove = e => paintRating(container, ratingFromPointer(container, e.clientX));
  const onUp = e => {
    container.removeEventListener('pointermove', onMove);
    container.removeEventListener('pointerup', onUp);
    container.removeEventListener('pointercancel', onUp);
    commit(ratingFromPointer(container, e.clientX));
  };
  container.addEventListener('pointerdown', e => {
    e.preventDefault();
    container.setPointerCapture && container.setPointerCapture(e.pointerId);
    paintRating(container, ratingFromPointer(container, e.clientX));
    container.addEventListener('pointermove', onMove);
    container.addEventListener('pointerup', onUp);
    container.addEventListener('pointercancel', onUp);
  });
  container.addEventListener('keydown', e => {
    const it = items.find(x => x.id === id); if (!it) return;
    let val = it.rating || 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') val = Math.min(5, val + 0.5);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') val = Math.max(0, val - 0.5);
    else return;
    e.preventDefault();
    commit(val);
  });
}
function itemHTML(i) {
  const open = ui.openId === i.id;
  const geoTxt = i.geo === 'pending' ? tr('geoLocating') : i.geo === 'fail' ? tr('geoFail') : '';
  return `<li class="item" data-id="${esc(i.id)}" data-done="${i.done}">
    <button class="check" role="checkbox" aria-checked="${i.done}" aria-label="${tr('markDoneAria', { name: esc(i.name) })}" data-act="toggle">${STAR_SVG}</button>
    <button class="body" data-act="open" aria-expanded="${open}">
      <span class="name">${esc(i.name)}</span>
      <span class="meta"><span class="tag">${esc(regionOf(i))}</span><span class="${catTagClass(i)}">${esc(categoryOf(i))}</span>${(userCoords && hasGeo(i)) ? `<span class="tag dist">${distKm(i).toFixed(1)} km</span>` : ''}${geoTxt ? `<span class="geo ${i.geo}">${geoTxt}</span>` : ''}</span>
    </button>
    <a class="go" href="${mapsUrl(i)}" target="_blank" rel="noopener" aria-label="${tr('openMapsAria', { name: esc(i.name) })}">${PIN_SVG}</a>
    ${i.done ? rateRow(i) : ''}
    ${open ? moreHTML(i) : ''}
  </li>`;
}
function renderList() {
  const cmp = SORTS[ui.sort] || SORTS.recent;
  const vis = visible().slice().sort((a, b) => {
    if (a.done !== b.done) return a.done - b.done;
    if (a.done && b.done) {
      const au = a.rating ? 1 : 0, bu = b.rating ? 1 : 0;
      if (au !== bu) return au - bu;
    }
    return cmp(a, b);
  });
  $('#list').innerHTML = vis.map(itemHTML).join('');
  $('#list').querySelectorAll('.hearts').forEach(bindRating);
  const box = $('#emptyBox');
  if (!items.length) {
    box.hidden = false;
    box.innerHTML = `<h2>${tr('emptyTitle')}</h2><p>${tr('emptyBody')}</p>
      <div class="stack"><button class="btn primary" data-empty="add">${tr('emptyAddBtn')}</button>
      <button class="btn" data-empty="batch">${tr('btnBatch')}</button>
      <button class="btn" data-empty="samples">${tr('emptySamplesBtn')}</button></div>`;
  } else if (!vis.length) {
    box.hidden = false;
    box.innerHTML = `<h2>${tr('emptyFilteredTitle')}</h2><p>${tr('emptyFilteredBody')}</p>
      <div class="stack"><button class="btn" data-empty="clear">${tr('emptyClearBtn')}</button></div>`;
  } else {
    box.hidden = true; box.innerHTML = '';
  }
}
function setView(v) {
  ui.view = v;
  $('#app').dataset.view = v;
  document.querySelectorAll('.tabs button').forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === v)));
  if (map) setTimeout(() => { map.invalidateSize(); renderMap(); }, 0);
}

