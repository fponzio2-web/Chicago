'use strict';

/* ---------- mapa ---------- */
let map = null, layer = null; const markers = new Map();
function pinIcon(done) {
  const color = done ? '#D8232A' : '#0B6B97';
  const inner = done
    ? `<polygon transform="translate(7.4 7.4) scale(.55)" fill="#fff" points="${STAR}"/>`
    : '<circle cx="14" cy="14" r="5" fill="#fff"/>';
  return L.divIcon({
    className: 'pin',
    html: `<svg width="28" height="36" viewBox="0 0 28 36" aria-hidden="true"><path d="M14 1C6.7 1 1 6.9 1 14c0 9.6 13 21 13 21s13-11.4 13-21C27 6.9 21.3 1 14 1z" fill="${color}" stroke="#fff" stroke-width="1.5"/>${inner}</svg>`,
    iconSize: [28, 36], iconAnchor: [14, 35], popupAnchor: [0, -32]
  });
}
function initMap() {
  if (!window.L) {
    $('#map').innerHTML = '<div class="map-fail"><p>Não foi possível carregar o mapa. Confira a conexão e recarregue a página. A lista continua funcionando.</p></div>';
    return;
  }
  map = L.map('map').setView([41.8781, -87.6298], 11);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  layer = L.layerGroup().addTo(map);
  map.on('click', e => { if (ui.placingId) finishPlacing(e.latlng); });
  map.on('popupopen', e => {
    const el = e.popup.getElement();
    if (!el) return;
    el.querySelectorAll('[data-pop="toggle"]').forEach(b => b.addEventListener('click', () => {
      const it = items.find(x => x.id === b.dataset.id);
      if (!it) return;
      it.done = !it.done; save(); map.closePopup(); render();
    }));
  });
}
function popupHTML(i) {
  return `<div><div class="pop-name">${esc(i.name)}</div>
    <div class="pop-meta">${esc(regionOf(i))}${i.category ? ' · ' + esc(i.category) : ''}</div>
    ${i.address ? `<div class="pop-meta">${esc(i.address)}</div>` : ''}
    <div class="pop-actions">
      <a class="btn primary small" href="${mapsUrl(i)}" target="_blank" rel="noopener">Abrir no Google Maps</a>
      <button class="btn small" data-pop="toggle" data-id="${esc(i.id)}">${i.done ? 'Desmarcar' : 'Marcar como feito'}</button>
    </div></div>`;
}
function renderMap() {
  if (!map) return;
  layer.clearLayers(); markers.clear();
  const vis = visible().filter(hasGeo);
  vis.forEach(i => {
    const m = L.marker([i.lat, i.lng], { icon: pinIcon(i.done), title: i.name }).bindPopup(() => popupHTML(i));
    m.addTo(layer); markers.set(i.id, m);
  });
  const sized = $('#map').clientWidth > 0;
  if (ui.fitNext && sized) {
    if (vis.length) map.fitBounds(L.latLngBounds(vis.map(i => [i.lat, i.lng])), { padding: [40, 40], maxZoom: 15 });
    ui.fitNext = false;
  }
}
function startPlacing(it) {
  if (!map) return;
  ui.placingId = it.id; setView('map');
  $('#placingText').textContent = `Toque no mapa para posicionar “${it.name}”`;
  $('#placing').hidden = false;
  map.getContainer().style.cursor = 'crosshair';
}
function cancelPlacing() {
  ui.placingId = null; $('#placing').hidden = true;
  if (map) map.getContainer().style.cursor = '';
}
function finishPlacing(ll) {
  const it = items.find(x => x.id === ui.placingId);
  cancelPlacing();
  if (!it) return;
  it.lat = ll.lat; it.lng = ll.lng; it.geo = 'ok'; it.manual = true;
  save(); render();
  map.setView(ll, Math.max(map.getZoom(), 15));
  toast('Posição salva.');
}

