'use strict';

/* ---------- renderização ---------- */
function render() {
  renderHeader(); renderChips(); renderList(); renderMap();
}
function renderHeader() {
  const d = items.filter(i => i.done).length;
  $('#progressText').textContent = items.length ? `${d} de ${items.length} feitos` : 'Lista vazia';
  $('#regionSuggest').innerHTML = [...new Set([...SUGGEST, ...items.map(i => i.region).filter(Boolean)])].map(r => `<option value="${esc(r)}">`).join('');
  const catOpts = '<option value="">Sem categoria</option>' + CATEGORIES.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  const fc = $('#fCategory');
  if (fc && !fc.dataset.filled) { fc.innerHTML = catOpts; fc.dataset.filled = '1'; }
  $('#dataDot').hidden = !items.some(i => !i.category);
}
function renderChips() {
  const isCat = ui.groupBy === 'category';
  const rs = isCat ? categoryList() : regionList();
  if (ui.groupValue !== 'all' && !rs.some(r => r.key === ui.groupValue)) ui.groupValue = 'all';
  const el = $('#chips');
  el.setAttribute('aria-label', isCat ? 'Filtrar por categoria' : 'Filtrar por região');
  el.hidden = !rs.length;
  el.innerHTML = rs.length
    ? `<button class="chip" data-val="all" aria-pressed="${ui.groupValue === 'all'}">Todas<small>${items.length}</small></button>` +
      rs.map(r => `<button class="chip" data-val="${esc(r.key)}" aria-pressed="${ui.groupValue === r.key}">${esc(r.name)}<small>${r.n}</small></button>`).join('')
    : '';
  document.querySelectorAll('#seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.status === ui.status)));
  document.querySelectorAll('#groupToggle button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.group === ui.groupBy)));
  $('#sortSelect').value = ui.sort;
}
function moreHTML(i) {
  const catOpts = ['', ...CATEGORIES].map(c => `<option value="${esc(c)}" ${c === (i.category || '') ? 'selected' : ''}>${c ? esc(c) : 'Sem categoria'}</option>`).join('');
  return `<div class="more">
    ${i.address ? `<p class="addr">${esc(i.address)}</p>` : ''}
    ${i.note ? `<p class="note">${esc(i.note)}</p>` : ''}
    <div class="quickcat">
      <label for="qc-${esc(i.id)}">Categoria</label>
      <select id="qc-${esc(i.id)}" data-act="quickcat">${catOpts}</select>
    </div>
    <div class="row">
      ${i.description ? '<button type="button" class="btn small" data-act="toggledesc" aria-expanded="false">Ver descrição</button>' : ''}
      ${hasGeo(i) ? '<button class="btn small" data-act="show">Ver no mapa</button>' : ''}
      ${i.geo === 'fail' ? '<button class="btn small" data-act="retry">Tentar de novo</button>' : ''}
      ${map ? `<button class="btn small" data-act="place">${hasGeo(i) ? 'Reposicionar' : 'Marcar no mapa'}</button>` : ''}
      <button class="btn small" data-act="edit">Editar</button>
      <button class="btn small danger" data-act="del">Excluir</button>
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
  const label = val ? `Sua nota: ${String(val).replace(/\.0$/, '')}` : 'Dê uma nota';
  return `<div class="rate-row">
    <span class="lbl">${label}</span>
    <div class="hearts" data-id="${esc(i.id)}" role="slider" tabindex="0" aria-label="Nota para ${esc(i.name)}" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${val}" aria-valuetext="${val ? val + ' de 5' : 'sem nota'}">${hs}</div>
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
  container.setAttribute('aria-valuetext', val ? val + ' de 5' : 'sem nota');
  container.querySelectorAll('.heart-slot').forEach((slot, idx) => {
    const frac = Math.max(0, Math.min(1, val - idx)) * 100;
    slot.querySelector('.h-fill').style.width = frac + '%';
  });
  const lbl = container.parentElement.querySelector('.lbl');
  if (lbl) lbl.textContent = val ? `Sua nota: ${String(val).replace(/\.0$/, '')}` : 'Dê uma nota';
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
  const geoTxt = i.geo === 'pending' ? 'Localizando…' : i.geo === 'fail' ? 'Sem posição no mapa' : '';
  return `<li class="item" data-id="${esc(i.id)}" data-done="${i.done}">
    <button class="check" role="checkbox" aria-checked="${i.done}" aria-label="Marcar ${esc(i.name)} como feito" data-act="toggle">${STAR_SVG}</button>
    <button class="body" data-act="open" aria-expanded="${open}">
      <span class="name">${esc(i.name)}</span>
      <span class="meta"><span class="tag">${esc(regionOf(i))}</span><span class="${catTagClass(i)}">${esc(categoryOf(i))}</span>${(userCoords && hasGeo(i)) ? `<span class="tag dist">${distKm(i).toFixed(1)} km</span>` : ''}${geoTxt ? `<span class="geo ${i.geo}">${geoTxt}</span>` : ''}</span>
    </button>
    <a class="go" href="${mapsUrl(i)}" target="_blank" rel="noopener" aria-label="Abrir ${esc(i.name)} no Google Maps">${PIN_SVG}</a>
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
    box.innerHTML = `<h2>Nada por aqui ainda</h2><p>Adicione o primeiro lugar. Ele aparece no mapa sozinho.</p>
      <div class="stack"><button class="btn primary" data-empty="add">Adicionar um lugar</button>
      <button class="btn" data-empty="batch">Adicionar vários</button>
      <button class="btn" data-empty="samples">Carregar 8 exemplos</button></div>`;
  } else if (!vis.length) {
    box.hidden = false;
    box.innerHTML = `<h2>Nenhum item com esses filtros</h2><p>Troque o filtro para ver outros itens.</p>
      <div class="stack"><button class="btn" data-empty="clear">Limpar filtros</button></div>`;
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

