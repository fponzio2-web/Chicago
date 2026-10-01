'use strict';

/* ---------- ações ---------- */
function removeItem(it) {
  const idx = items.indexOf(it);
  if (idx < 0) return;
  items.splice(idx, 1);
  if (ui.openId === it.id) ui.openId = null;
  save(); render();
  toast('Item excluído', () => { items.splice(Math.min(idx, items.length), 0, it); save(); render(); });
}
function act(name, it, btn) {
  switch (name) {
    case 'quickcat': it.category = btn.value; save(); renderList(); break;
    case 'toggledesc': {
      const p = btn.closest('.more').querySelector('.description');
      const show = p.hidden;
      p.hidden = !show;
      btn.setAttribute('aria-expanded', String(show));
      btn.textContent = show ? 'Ocultar descrição' : 'Ver descrição';
      break;
    }
    case 'toggle': it.done = !it.done; save(); render(); break;
    case 'open': ui.openId = ui.openId === it.id ? null : it.id; renderList(); break;
    case 'show':
      if (!hasGeo(it) || !map) return;
      setView('map');
      setTimeout(() => {
        map.setView([it.lat, it.lng], Math.max(map.getZoom(), 16));
        const m = markers.get(it.id); if (m) m.openPopup();
      }, 120);
      break;
    case 'edit': openForm(it); break;
    case 'del': removeItem(it); break;
    case 'retry': it.geo = 'pending'; save(); render(); queueGeo(it.id); break;
    case 'place': startPlacing(it); break;
  }
}

/* ---------- formulário (um item) ---------- */
function openForm(it) {
  ui.editingId = it ? it.id : null;
  $('#formTitle').textContent = it ? 'Editar lugar' : 'Novo lugar';
  $('#formSubmit').textContent = it ? 'Salvar' : 'Adicionar';
  $('#fName').value = it ? it.name : '';
  $('#fAddr').value = it ? it.address : '';
  $('#fRegion').value = it ? it.region : '';
  $('#fCategory').value = it ? (it.category || '') : '';
  $('#fDesc').value = it ? (it.description || '') : '';
  $('#fNote').value = it ? it.note : '';
  $('#formErr').hidden = true;
  $('#formDlg').showModal();
  if (!it) $('#fName').focus();
}
$('#form').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#fName').value.trim(), address = $('#fAddr').value.trim();
  const region = canonRegion($('#fRegion').value), category = $('#fCategory').value;
  const description = $('#fDesc').value.trim(), note = $('#fNote').value.trim();
  const err = $('#formErr');
  if (!name) return;
  const dup = items.find(i => nameKey(i.name) === nameKey(name) && i.id !== ui.editingId);
  if (dup) { err.textContent = 'Já existe um item com esse nome.'; err.hidden = false; return; }
  if (ui.editingId) {
    const it = items.find(x => x.id === ui.editingId);
    if (it) {
      const moved = it.name !== name || it.address !== address;
      Object.assign(it, { name, address, region, category, description, note });
      if (moved) { it.lat = undefined; it.lng = undefined; it.geo = 'pending'; it.manual = false; queueGeo(it.id); }
    }
    ui.fitNext = false;
  } else {
    const it = clean({ name, address, region, category, description, note });
    items.unshift(it);
    ui.status = 'all'; ui.groupValue = 'all'; ui.fitNext = true;
    queueGeo(it.id);
  }
  save(); render();
  $('#formDlg').close();
});

/* ---------- adicionar vários ---------- */
function parseBatch(text) {
  text = text.trim();
  if (!text) return [];
  if (text[0] === '[') {
    try {
      const arr = JSON.parse(text);
      if (Array.isArray(arr)) return arr.map(o => ({
        name: String(o.name || o.nome || '').trim(),
        address: String(o.address || o.endereco || o['endereço'] || '').trim(),
        region: String(o.region || o.regiao || o['região'] || o.bairro || '').trim(),
        category: String(o.category || o.categoria || o.tipo || '').trim(),
        description: String(o.description || o.descricao || o['descrição'] || '').trim(),
        note: String(o.note || o.nota || '').trim()
      })).filter(o => o.name);
    } catch (e) { /* segue como texto */ }
  }
  return text.split(/\r?\n/)
    .map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/^\s*\|/, '').replace(/\|\s*$/, '').trim())
    .filter(l => l && !/^[-\s|:]+$/.test(l))
    .map(l => {
      const [name, address, region, category, description] = l.split('|').map(s => s.trim());
      return { name: name || '', address: address || '', region: region || '', category: category || '', description: description || '' };
    })
    .filter(o => o.name);
}
$('#bText').addEventListener('input', () => {
  const n = parseBatch($('#bText').value).length;
  $('#bCount').textContent = n ? `${n} ${n === 1 ? 'item reconhecido' : 'itens reconhecidos'}.` : 'Cole ou escreva a lista acima.';
});
function buildPrompt() {
  const n = Math.max(1, Math.min(50, +$('#aiQty').value || 10));
  const th = $('#aiTheme').value.trim();
  const list = arr => arr.map(i => `${i.name}${i.region ? ' (' + i.region + ')' : ''}`).join('; ');
  const rated = items.filter(i => i.done && i.rating);
  const love = rated.filter(i => i.rating >= 4), meh = rated.filter(i => i.rating === 3), nope = rated.filter(i => i.rating <= 2);
  let p = `Liste ${n} coisas para fazer em Chicago${th ? ' sobre: ' + th : ''}.\n`;
  if (items.length) p += `\nJÁ ESTÃO NA MINHA LISTA (não repita nenhum, nem com nome parecido):\n${items.map(i => i.name).join('; ')}\n`;
  if (rated.length) {
    p += '\nO QUE JÁ FIZ E COMO AVALIEI (nota de 1 a 5):\n';
    if (love.length) p += `Gostei muito (4 a 5): ${list(love.map(i => Object.assign({}, i, { name: i.name + ' - nota ' + i.rating })))}\n`;
    if (meh.length) p += `Achei ok (3): ${list(meh)}\n`;
    if (nope.length) p += `Não gostei (1 a 2): ${list(nope)}\n`;
    p += 'Use isso para entender meu gosto: sugira coisas parecidas com as que gostei e evite o estilo das que não gostei.\n';
  }
  p += `\nResponda só com uma linha por item, neste formato exato:\nNome do lugar | Endereço completo, Chicago, IL | Bairro | Categoria | Descrição\nA categoria deve ser uma destas, exatamente como está escrita: ${CATEGORIES.join(', ')}.\nA descrição deve ter de 1 a 2 frases curtas (até 35 palavras) contando um pouco sobre o lugar: o que dá para fazer ou ver ali. Se a categoria for Museu ou for um Evento pago, inclua também o preço aproximado da entrada e, se existir, em quais dias a entrada é gratuita. Se a entrada já for gratuita, diga isso em vez de preço.\nSem numeração, sem títulos e sem texto extra. Use apenas lugares reais e endereços que você tenha certeza que existem.`;
  return { text: p, total: items.length, rated: rated.length };
}
$('#copyPrompt').addEventListener('click', async () => {
  const { text, total, rated } = buildPrompt();
  const ok = await copyText(text);
  flash($('#bStatus'), ok ? `Prompt copiado, com ${total} itens da lista e ${rated} notas. Cole na sua IA.` : 'Não foi possível copiar.');
});
$('#bAdd').addEventListener('click', () => {
  const parsed = parseBatch($('#bText').value);
  if (!parsed.length) { flash($('#bStatus'), 'Nenhum item reconhecido.'); return; }
  const seen = new Set(items.map(i => nameKey(i.name)));
  const fresh = []; let dups = 0;
  parsed.forEach(o => {
    const k = nameKey(o.name);
    if (seen.has(k)) { dups++; return; }
    seen.add(k);
    fresh.push(clean({ name: o.name, address: o.address, region: canonRegion(o.region), category: canonCategory(o.category), description: o.description, ts: 0 }));
  });
  if (!fresh.length) { flash($('#bStatus'), 'Todos esses itens já estão na lista.'); return; }
  const base = Date.now();
  fresh.forEach((f, k) => { f.ts = base + (fresh.length - k); });
  items.unshift(...fresh);
  ui.status = 'all'; ui.groupValue = 'all'; ui.fitNext = true;
  save(); render();
  fresh.forEach(i => queueGeo(i.id));
  $('#batchDlg').close();
  $('#bText').value = ''; $('#bCount').textContent = 'Cole ou escreva a lista acima.';
  toast(`${fresh.length} ${fresh.length === 1 ? 'item adicionado' : 'itens adicionados'}${dups ? `, ${dups} repetido${dups > 1 ? 's' : ''} ignorado${dups > 1 ? 's' : ''}` : ''}.`);
});

/* ---------- classificar existentes ---------- */
function buildClassifyPrompt() {
  const todo = items.filter(i => !i.category);
  const p = `Para cada item da lista abaixo (lugares em Chicago), diga a categoria mais adequada, escolhendo só entre estas opções: ${CATEGORIES.join(', ')}.\nResponda uma linha por item, exatamente neste formato:\nNome do lugar | Categoria\nUse o nome exatamente como está abaixo, sem numeração nem texto extra.\n\nItens:\n${todo.map(i => i.name + (i.address ? ' - ' + i.address : '')).join('\n')}`;
  return { text: p, n: todo.length };
}
function refreshClassifyCount() {
  const n = items.filter(i => !i.category).length;
  $('#classifyCount').textContent = n ? `${n} ${n === 1 ? 'item ainda não tem' : 'itens ainda não têm'} categoria.` : 'Todos os itens já têm categoria. ✓';
}
function openClassify() {
  $('#cStatus').textContent = ''; $('#cText').value = '';
  refreshClassifyCount();
  $('#classifyDlg').showModal();
}
$('#copyClassifyPrompt').addEventListener('click', async () => {
  const { text, n } = buildClassifyPrompt();
  if (!n) { flash($('#cStatus'), 'Todos os itens já têm categoria, nada para classificar.'); return; }
  const ok = await copyText(text);
  flash($('#cStatus'), ok ? `Prompt copiado, com ${n} itens sem categoria. Cole na sua IA.` : 'Não foi possível copiar.');
});
$('#cApply').addEventListener('click', () => {
  const lines = $('#cText').value.trim().split(/\r?\n/)
    .map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
  let applied = 0, unmatched = 0;
  lines.forEach(l => {
    const [name, cat] = l.split('|').map(s => (s || '').trim());
    if (!name || !cat) return;
    const it = items.find(i => nameKey(i.name) === nameKey(name));
    if (it) { it.category = canonCategory(cat); applied++; } else unmatched++;
  });
  if (!applied) { flash($('#cStatus'), 'Nenhum item da lista bateu com o texto colado.'); return; }
  save(); render(); refreshClassifyCount();
  $('#cText').value = '';
  flash($('#cStatus'), `${applied} ${applied === 1 ? 'item classificado' : 'itens classificados'}${unmatched ? `, ${unmatched} linha${unmatched > 1 ? 's' : ''} não reconhecida${unmatched > 1 ? 's' : ''}` : ''}.`);
});

/* ---------- backup ---------- */
const exportJSON = () => JSON.stringify({ app: 'chicago-checklist', v: 1, items });
function openData() {
  $('#dataHint').textContent = CLOUD
    ? 'A lista fica na nuvem e aparece em todos os aparelhos. O backup abaixo é só uma cópia de segurança.'
    : 'Sem nuvem configurada: os dados ficam só neste aparelho. Use o backup para levar a lista para outro.';
  $('#dExport').value = exportJSON();
  $('#dImport').value = ''; $('#dStatus').textContent = '';
  $('#dataDlg').showModal();
}
function readImport() {
  const txt = $('#dImport').value.trim();
  if (!txt) { flash($('#dStatus'), 'Cole o backup na caixa acima.'); return null; }
  try {
    const d = JSON.parse(txt);
    const arr = Array.isArray(d) ? d : d.items;
    const list = (arr || []).map(clean).filter(Boolean);
    if (!list.length) throw new Error('vazio');
    return list;
  } catch (e) { flash($('#dStatus'), 'Esse texto não parece um backup válido.'); return null; }
}
function afterImport(msg) {
  ui.status = 'all'; ui.groupValue = 'all'; ui.fitNext = true;
  items.sort(byNewest);
  save(); render();
  items.filter(i => i.geo === 'pending').forEach(i => queueGeo(i.id));
  $('#dataDlg').close(); toast(msg);
}
$('#dCopy').addEventListener('click', async () => {
  $('#dExport').value = exportJSON();
  flash($('#dStatus'), (await copyText($('#dExport').value)) ? 'Backup copiado.' : 'Selecione o texto acima e copie.');
});
$('#dMerge').addEventListener('click', () => {
  const list = readImport(); if (!list) return;
  let added = 0;
  list.forEach(n => {
    const ex = items.find(i => nameKey(i.name) === nameKey(n.name));
    if (ex) { ex.done = ex.done || n.done; }
    else { if (items.some(i => i.id === n.id)) n.id = uid(); items.push(n); added++; }
  });
  afterImport(`${added} novo${added === 1 ? '' : 's'} item${added === 1 ? '' : 's'} adicionado${added === 1 ? '' : 's'}.`);
});
$('#dReplace').addEventListener('click', () => {
  const list = readImport(); if (!list) return;
  if (!confirm('Substituir toda a lista pelo backup?' + (CLOUD ? ' Isso vale para todos os aparelhos.' : ''))) return;
  items = list; ui.openId = null;
  afterImport('Lista substituída.');
});
$('#dWipe').addEventListener('click', () => {
  if (!confirm('Apagar todos os itens?' + (CLOUD ? ' Isso vale para todos os aparelhos.' : '') + ' Não dá para desfazer.')) return;
  items = []; ui.openId = null; save(); render();
  $('#dataDlg').close(); toast('Lista apagada.');
});

