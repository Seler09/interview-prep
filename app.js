(() => {
  'use strict';

  const QUESTIONS = (window.QUESTIONS || []).filter(q => q && q.id && q.question);
  const PROGRESS_KEY = 'rekru:progress:v1';
  const FILTERS_KEY = 'rekru:filters:v1';
  const SESSION_SIZE = 20;   // ile pytań w jednej sesji
  const MAX_BOX = 5;         // poziomy opanowania (system Leitnera)
  const MASTERED_BOX = 3;    // od tego poziomu pytanie liczy się jako "opanowane"
  const DIFF = { 1: 'Łatwe', 2: 'Średnie', 3: 'Trudne' };

  const $ = s => document.querySelector(s);

  // ---------- storage ----------
  function loadJSON(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  }
  function saveJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* tryb prywatny itp. */ }
  }

  let progress = loadJSON(PROGRESS_KEY, {});
  const saved = loadJSON(FILTERS_KEY, {});
  const filters = {
    categories: new Set(saved.categories || []),
    difficulty: new Set(saved.difficulty || []),
  };

  const categories = [...new Set(QUESTIONS.map(q => q.category))].sort((a, b) => a.localeCompare(b, 'pl'));
  for (const c of [...filters.categories]) if (!categories.includes(c)) filters.categories.delete(c);

  const diffOf = q => q.difficulty || 1;
  const boxOf = q => (progress[q.id] && progress[q.id].box) || 0;
  const lastSeenOf = q => (progress[q.id] && progress[q.id].lastSeen) || 0;
  const matches = q =>
    (!filters.categories.size || filters.categories.has(q.category)) &&
    (!filters.difficulty.size || filters.difficulty.has(diffOf(q)));
  const filtered = () => QUESTIONS.filter(matches);

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------- mini markdown (```kod```, `kod`, **pogrubienie**, listy "- ") ----------
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const LIST_RE = /^\s*(?:[-*]|\d+[.)]) /;
  const fmt = l => esc(l.trim())
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // lista z jednym poziomem zagnieżdżenia (podpunkty wcięte min. 2 spacjami)
  function renderList(lines) {
    const tag = /^\s*\d/.test(lines[0]) ? 'ol' : 'ul';
    let html = '';
    let inSub = false;
    lines.forEach((l, i) => {
      const text = fmt(l.replace(LIST_RE, ''));
      if (/^\s{2,}/.test(l) && i > 0) {
        if (!inSub) { html = html.replace(/<\/li>$/, '') + '<ul>'; inSub = true; }
        html += '<li>' + text + '</li>';
      } else {
        if (inSub) { html += '</ul></li>'; inSub = false; }
        html += '<li>' + text + '</li>';
      }
    });
    if (inSub) html += '</ul></li>';
    return `<${tag}>${html}</${tag}>`;
  }

  // blok = akapity i listy przemieszane linia po linii
  function renderBlock(block) {
    let out = '';
    let para = [];
    let list = [];
    const flushP = () => { if (para.length) { out += '<p>' + para.map(fmt).join('<br>') + '</p>'; para = []; } };
    const flushL = () => { if (list.length) { out += renderList(list); list = []; } };
    block.split('\n').forEach(l => {
      if (LIST_RE.test(l)) { flushP(); list.push(l); }
      else if (l.trim()) { flushL(); para.push(l); }
    });
    flushP();
    flushL();
    return out;
  }

  function inline(text) {
    const t = text.trim();
    if (!t) return '';
    return t.split(/\n\s*\n/).map(renderBlock).join('');
  }

  function md(src) {
    const parts = String(src || '').split(/```[\w-]*\n?([\s\S]*?)```/g);
    let html = '';
    parts.forEach((part, i) => {
      html += i % 2 === 0 ? inline(part) : '<pre><code>' + esc(part.replace(/\n$/, '')) + '</code></pre>';
    });
    return html;
  }

  function answerHtml(q) {
    let html = md(q.answer);
    if (Array.isArray(q.followUps) && q.followUps.length) {
      html += '<div class="followups"><strong>Możliwe dopytania:</strong><ul>' +
        q.followUps.map(f => '<li>' + inline(f).replace(/^<p>|<\/p>$/g, '') + '</li>').join('') +
        '</ul></div>';
    }
    return html;
  }

  // ---------- filtry ----------
  function chip(label, active, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (active ? ' active' : '');
    b.textContent = label;
    b.setAttribute('aria-pressed', String(active));
    b.addEventListener('click', onClick);
    return b;
  }
  const toggle = (set, v) => (set.has(v) ? set.delete(v) : set.add(v));

  function renderChips() {
    const cat = $('#category-filters');
    cat.replaceChildren(chip('Wszystkie', filters.categories.size === 0, () => { filters.categories.clear(); onFilters(); }));
    categories.forEach(c => {
      const n = QUESTIONS.filter(q => q.category === c).length;
      cat.append(chip(`${c} (${n})`, filters.categories.has(c), () => { toggle(filters.categories, c); onFilters(); }));
    });

    const dif = $('#difficulty-filters');
    dif.replaceChildren(chip('Każdy poziom', filters.difficulty.size === 0, () => { filters.difficulty.clear(); onFilters(); }));
    [1, 2, 3].forEach(d =>
      dif.append(chip(DIFF[d], filters.difficulty.has(d), () => { toggle(filters.difficulty, d); onFilters(); })));
  }

  function onFilters() {
    saveJSON(FILTERS_KEY, { categories: [...filters.categories], difficulty: [...filters.difficulty] });
    renderChips();
    startSession();
    renderBrowse();
    renderStats();
  }

  // ---------- sesja nauki ----------
  let queue = [];
  let current = null;
  let sessionTotal = 0;
  let revealed = false;

  function startSession() {
    // najpierw najsłabiej opanowane, przy remisie najdawniej widziane; nowe w losowej kolejności
    const pool = shuffle(filtered()).sort((a, b) => boxOf(a) - boxOf(b) || lastSeenOf(a) - lastSeenOf(b));
    queue = pool.slice(0, SESSION_SIZE);
    sessionTotal = queue.length;
    next();
  }

  function next() {
    current = queue.shift() || null;
    revealed = false;
    const has = !!current;
    $('#card').hidden = !has;
    $('#actions').hidden = !has;
    $('#done').hidden = has;

    if (!has) {
      $('#session-info').textContent = '';
      $('#done-text').textContent = sessionTotal
        ? `Sesja zakończona! 🎉 Przerobione pytania: ${sessionTotal}.`
        : 'Brak pytań dla wybranych filtrów.';
      $('#done-restart').hidden = !sessionTotal;
      return;
    }

    $('#session-info').textContent = `Zostało w sesji: ${queue.length + 1} z ${sessionTotal}`;
    $('#card-category').textContent = current.category;
    const d = diffOf(current);
    $('#card-difficulty').textContent = DIFF[d] || '';
    $('#card-difficulty').className = 'badge d' + d;
    $('#card-box').textContent = `Opanowanie: ${boxOf(current)}/${MAX_BOX}`;
    $('#card-question').textContent = current.question;
    $('#card-answer').innerHTML = answerHtml(current);
    $('#card-answer').hidden = true;
    $('#reveal').hidden = false;
    $('#rate').hidden = true;
  }

  function reveal() {
    if (!current || revealed) return;
    revealed = true;
    $('#card-answer').hidden = false;
    $('#reveal').hidden = true;
    $('#rate').hidden = false;
  }

  function rate(r) {
    if (!current || !revealed) return;
    const p = progress[current.id] || { box: 0, seen: 0, lastSeen: 0 };
    p.seen += 1;
    p.lastSeen = Date.now();
    if (r === 0) {
      p.box = 0;
      queue.splice(Math.min(3, queue.length), 0, current); // wróci za chwilę w tej samej sesji
    } else if (r === 1) {
      p.box = Math.max(1, p.box);
    } else {
      p.box = Math.min(MAX_BOX, p.box + 1);
    }
    progress[current.id] = p;
    saveJSON(PROGRESS_KEY, progress);
    next();
  }

  // ---------- przeglądanie ----------
  function renderBrowse() {
    const term = $('#search').value.trim().toLowerCase();
    const items = filtered().filter(q =>
      !term || [q.question, q.answer, q.category, ...(q.followUps || [])].join(' ').toLowerCase().includes(term));
    $('#browse-count').textContent = `Pytań: ${items.length}`;
    $('#list').innerHTML = items.map(q => `
      <details>
        <summary>${esc(q.question)}</summary>
        <div class="meta">
          <span class="badge">${esc(q.category)}</span>
          <span class="badge d${diffOf(q)}">${DIFF[diffOf(q)] || ''}</span>
          <span class="badge subtle">Opanowanie: ${boxOf(q)}/${MAX_BOX}</span>
        </div>
        <div class="answer">${answerHtml(q)}</div>
      </details>`).join('');
  }

  // ---------- statystyki ----------
  function bucket(list) {
    let good = 0, mid = 0;
    list.forEach(q => {
      const b = boxOf(q);
      if (b >= MASTERED_BOX) good++;
      else if (progress[q.id]) mid++;
    });
    return { total: list.length, good, mid, fresh: list.length - good - mid };
  }

  function renderStats() {
    const all = bucket(filtered());
    const pct = (n, t) => (t ? (n / t) * 100 : 0);
    const rows = categories
      .filter(c => !filters.categories.size || filters.categories.has(c))
      .map(c => {
        const s = bucket(filtered().filter(q => q.category === c));
        if (!s.total) return '';
        return `
          <div class="stat-row">
            <header><strong>${esc(c)}</strong><span class="muted">${s.good}/${s.total} opanowane</span></header>
            <div class="bar">
              <span class="good" style="width:${pct(s.good, s.total)}%"></span>
              <span class="mid" style="width:${pct(s.mid, s.total)}%"></span>
            </div>
          </div>`;
      }).join('');

    $('#stats').innerHTML = `
      <div class="stat-total">
        <div><strong>${all.good}</strong><span class="muted">opanowane</span></div>
        <div><strong>${all.mid}</strong><span class="muted">w trakcie</span></div>
        <div><strong>${all.fresh}</strong><span class="muted">nowe</span></div>
      </div>
      <div class="legend"><span class="l-good">opanowane (≥${MASTERED_BOX})</span><span class="l-mid">w trakcie</span><span class="l-new">nowe</span></div>
      ${rows}`;
  }

  // ---------- eksport / import ----------
  function exportProgress() {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), progress }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `postep-rekrutacja-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function importProgress(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const incoming = data && typeof data.progress === 'object' ? data.progress : null;
        if (!incoming) throw new Error('Brak pola "progress"');
        progress = incoming;
        saveJSON(PROGRESS_KEY, progress);
        onFilters();
        alert('Zaimportowano postęp.');
      } catch (e) {
        alert('Nie udało się wczytać pliku: ' + e.message);
      }
    };
    reader.readAsText(file);
  }

  // ---------- widoki ----------
  function showView(name) {
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== 'view-' + name; });
    if (name === 'stats') renderStats();
    if (name === 'browse') renderBrowse();
  }

  // ---------- zdarzenia ----------
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
  $('#reveal').addEventListener('click', reveal);
  $('#card').addEventListener('click', e => { if (!e.target.closest('pre, code')) reveal(); });
  $('#rate').addEventListener('click', e => {
    const b = e.target.closest('[data-rate]');
    if (b) rate(Number(b.dataset.rate));
  });
  $('#restart').addEventListener('click', startSession);
  $('#done-restart').addEventListener('click', startSession);
  $('#search').addEventListener('input', renderBrowse);
  $('#export').addEventListener('click', exportProgress);
  $('#import').addEventListener('change', e => { if (e.target.files[0]) importProgress(e.target.files[0]); e.target.value = ''; });
  $('#reset').addEventListener('click', () => {
    if (!confirm('Na pewno usunąć cały postęp nauki?')) return;
    progress = {};
    saveJSON(PROGRESS_KEY, progress);
    onFilters();
  });

  document.addEventListener('keydown', e => {
    if ($('#view-learn').hidden || e.target.matches('input, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
    if ((e.key === ' ' || e.key === 'Enter') && !revealed) { e.preventDefault(); reveal(); }
    else if (revealed && ['1', '2', '3'].includes(e.key)) rate(Number(e.key) - 1);
  });

  // ---------- start ----------
  renderChips();
  startSession();
  renderBrowse();
  renderStats();
})();
