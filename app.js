(() => {
  'use strict';

  // =====================================================================
  // CONFIG
  // =====================================================================
  const QUESTIONS = (window.QUESTIONS || []).filter(q => q && q.id && q.question);
  const KEYS = {
    progress: 'rekru:progress:v1',   // { [id]: { box, seen, lastSeen } }
    filters: 'rekru:filters:v1',
    activity: 'rekru:activity:v1',   // { days: { 'YYYY-MM-DD': answers } }
    view: 'rekru:view:v1',
  };
  const SESSION_SIZE = 20;   // questions per session
  const MAX_BOX = 5;         // mastery levels (Leitner system)
  const MASTERED_BOX = 3;    // from this level a question counts as "mastered"
  const DIFF = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };
  const LEVELS = { all: 'All', basic: 'Fundamentals', senior: 'Senior' };

  const $ = s => document.querySelector(s);

  // =====================================================================
  // LOCAL STORAGE (no accounts: everything stays in this browser)
  // =====================================================================
  let storageOk = true;
  try {
    localStorage.setItem('rekru:test', '1');
    localStorage.removeItem('rekru:test');
  } catch {
    storageOk = false;
  }

  function loadJSON(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v && typeof v === 'object' ? v : fallback;
    } catch {
      return fallback;
    }
  }
  function saveJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* quota / private mode */ }
  }

  let progress = loadJSON(KEYS.progress, {});
  let activity = loadJSON(KEYS.activity, { days: {} });
  if (!activity.days || typeof activity.days !== 'object') activity = { days: {} };

  const saved = loadJSON(KEYS.filters, {});
  const filters = {
    level: LEVELS[saved.level] ? saved.level : 'all',
    categories: new Set(Array.isArray(saved.categories) ? saved.categories : []),
    difficulty: new Set(Array.isArray(saved.difficulty) ? saved.difficulty.map(Number) : []),
  };
  const saveProgress = () => saveJSON(KEYS.progress, progress);
  const saveFilters = () => saveJSON(KEYS.filters, {
    level: filters.level, categories: [...filters.categories], difficulty: [...filters.difficulty],
  });

  // =====================================================================
  // HELPERS
  // =====================================================================
  const levelOf = q => (q.level === 'senior' ? 'senior' : 'basic');
  const diffOf = q => q.difficulty || 1;
  const boxOf = q => (progress[q.id] && progress[q.id].box) || 0;
  const lastSeenOf = q => (progress[q.id] && progress[q.id].lastSeen) || 0;
  const inLevel = q => filters.level === 'all' || levelOf(q) === filters.level;
  const matches = q =>
    inLevel(q) &&
    (!filters.categories.size || filters.categories.has(q.category)) &&
    (!filters.difficulty.size || filters.difficulty.has(diffOf(q)));
  const filtered = () => QUESTIONS.filter(matches);

  const allCategories = [...new Set(QUESTIONS.map(q => q.category))]; // file order
  const levelCategories = () => allCategories.filter(c => QUESTIONS.some(q => q.category === c && inLevel(q)));
  function pruneCategories() {
    const valid = levelCategories();
    for (const c of [...filters.categories]) if (!valid.includes(c)) filters.categories.delete(c);
  }
  pruneCategories();

  const dayKey = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const nq = n => `${n} ${n === 1 ? 'question' : 'questions'}`;

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // keep --dock-h equal to the fixed bottom dock's height so page content always ends above it
  function syncDock() {
    document.documentElement.style.setProperty('--dock-h', $('.dock').offsetHeight + 'px');
  }

  function boxDots(q) {
    const b = boxOf(q);
    return Array.from({ length: MAX_BOX }, (_, i) => `<i class="${i < b ? 'on' : ''}"></i>`).join('');
  }

  // =====================================================================
  // MINI MARKDOWN: ```code```, `code`, **bold**, lists "- " / "1. ",
  // sub-items indented by 2 spaces, blank line = new paragraph
  // =====================================================================
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LIST_RE = /^\s*(?:[-*]|\d+[.)]) /;
  const fmt = l => esc(l.trim())
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

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

  const TABLE_RE = /^\s*\|.*\|\s*$/;
  function renderTable(rows) {
    const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    const body = rows.filter(r => !/^\s*\|[\s:|-]+\|\s*$/.test(r));   // drop |---| separator
    const [head, ...rest] = body;
    return '<div class="table-wrap"><table><thead><tr>' +
      cells(head).map(c => `<th>${fmt(c)}</th>`).join('') + '</tr></thead><tbody>' +
      rest.map(r => '<tr>' + cells(r).map(c => `<td>${fmt(c)}</td>`).join('') + '</tr>').join('') +
      '</tbody></table></div>';
  }

  function renderBlock(block) {
    let out = '';
    let para = [];
    let list = [];
    let table = [];
    const flushP = () => { if (para.length) { out += '<p>' + para.map(fmt).join('<br>') + '</p>'; para = []; } };
    const flushL = () => { if (list.length) { out += renderList(list); list = []; } };
    const flushT = () => { if (table.length) { out += renderTable(table); table = []; } };
    block.split('\n').forEach(l => {
      if (TABLE_RE.test(l)) { flushP(); flushL(); table.push(l); }
      else if (LIST_RE.test(l)) { flushP(); flushT(); list.push(l); }
      else if (list.length && /^\s{2,}\S/.test(l)) { list[list.length - 1] += ' ' + l.trim(); } // continuation line
      else if (l.trim()) { flushL(); flushT(); para.push(l); }
    });
    flushP();
    flushL();
    flushT();
    return out;
  }

  function inline(text) {
    const t = String(text || '').trim();
    return t ? t.split(/\n\s*\n/).map(renderBlock).join('') : '';
  }

  function md(src) {
    const parts = String(src || '').split(/```[\w-]*\n?([\s\S]*?)```/g);
    return parts.map((part, i) =>
      i % 2 === 0 ? inline(part) : '<pre><code>' + esc(part.replace(/\n$/, '')) + '</code></pre>').join('');
  }

  // followUps: string or { q, a }
  const fuQ = f => (typeof f === 'string' ? f : f.q);
  const fuA = f => (typeof f === 'string' ? '' : f.a || '');

  function answerHtml(q) {
    let html = '';
    if (q.tldr) html += `<div class="tldr"><span class="tldr-label">TL;DR</span>${fmt(q.tldr)}</div>`;
    html += md(q.answer);
    if (Array.isArray(q.followUps) && q.followUps.length) {
      html += '<div class="followups"><strong>Likely follow-up questions</strong>' +
        q.followUps.map(f => fuA(f)
          ? `<details class="fu"><summary>${fmt(fuQ(f))}</summary><div class="fu-a">${md(fuA(f))}</div></details>`
          : `<div class="fu-plain">${fmt(fuQ(f))}</div>`).join('') +
        '</div>';
    }
    return html;
  }

  const searchText = q => [q.question, q.tldr, q.answer, q.category,
    ...(q.followUps || []).map(f => fuQ(f) + ' ' + fuA(f))].join(' ').toLowerCase();

  // =====================================================================
  // FILTERS
  // =====================================================================
  function chip(html, active, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (active ? ' active' : '');
    b.innerHTML = html;
    b.setAttribute('aria-pressed', String(active));
    b.addEventListener('click', onClick);
    return b;
  }
  const toggle = (set, v) => (set.has(v) ? set.delete(v) : set.add(v));
  const count = n => `<span class="count">${n}</span>`;

  function renderFilters() {
    const lvl = $('#level-filters');
    lvl.replaceChildren(...Object.entries(LEVELS).map(([key, label]) => {
      const n = QUESTIONS.filter(q => key === 'all' || levelOf(q) === key).length;
      return chip(`${label} ${count(n)}`, filters.level === key, () => {
        filters.level = key;
        pruneCategories();
        onFiltersChange();
      });
    }));

    const cat = $('#category-filters');
    cat.replaceChildren(
      chip('All', filters.categories.size === 0, () => { filters.categories.clear(); onFiltersChange(); }),
      ...levelCategories().map(c => {
        const n = QUESTIONS.filter(q => q.category === c && inLevel(q)).length;
        return chip(`${esc(c)} ${count(n)}`, filters.categories.has(c), () => { toggle(filters.categories, c); onFiltersChange(); });
      }),
    );

    const dif = $('#difficulty-filters');
    dif.replaceChildren(
      chip('Any', filters.difficulty.size === 0, () => { filters.difficulty.clear(); onFiltersChange(); }),
      ...[1, 2, 3].map(d => chip(DIFF[d], filters.difficulty.has(d), () => { toggle(filters.difficulty, d); onFiltersChange(); })),
    );

    const parts = [LEVELS[filters.level]];
    if (filters.categories.size === 1) parts.push([...filters.categories][0]);
    else if (filters.categories.size > 1) parts.push(`${filters.categories.size} categories`);
    if (filters.difficulty.size) parts.push([...filters.difficulty].sort().map(d => DIFF[d]).join(', '));
    parts.push(nq(filtered().length));
    $('#filters-summary').textContent = parts.join(' · ');
  }

  function onFiltersChange() {
    saveFilters();
    renderFilters();
    startSession();
    renderBrowse();
    renderStats();
  }

  // =====================================================================
  // STUDY SESSION
  // =====================================================================
  let queue = [];
  let current = null;
  let sessionIds = [];
  let results = {};   // id -> last rating in this session
  let revealed = false;

  function startSession() {
    // weakest first, then least recently seen; new questions in random order
    const pool = shuffle(filtered()).sort((a, b) => boxOf(a) - boxOf(b) || lastSeenOf(a) - lastSeenOf(b));
    queue = pool.slice(0, SESSION_SIZE);
    sessionIds = queue.map(q => q.id);
    results = {};
    next();
  }

  function updateSessionBar() {
    const total = sessionIds.length;
    const remaining = new Set(queue.map(q => q.id).concat(current ? [current.id] : [])).size;
    const done = total - remaining;
    $('#session-bar').style.width = total ? `${(done / total) * 100}%` : '0';
    $('#session-info').textContent = current ? `Question ${done + 1} of ${total}` : (total ? `Completed ${total} of ${total}` : '');
  }

  function next() {
    current = queue.shift() || null;
    revealed = false;
    const has = !!current;
    $('#card').hidden = !has;
    $('#actions').hidden = !has;
    $('#done').hidden = has;
    document.body.classList.toggle('has-actions', has);
    syncDock();
    updateSessionBar();

    if (!has) return showDone();

    const card = $('#card');
    card.classList.remove('revealed');
    card.style.animation = 'none';
    void card.offsetWidth; // restart animation
    card.style.animation = '';

    $('#card-level').hidden = levelOf(current) !== 'senior';
    $('#card-category').textContent = current.category;
    const d = diffOf(current);
    $('#card-difficulty').textContent = DIFF[d] || '';
    $('#card-difficulty').className = 'badge d' + d;
    $('#card-box').innerHTML = boxDots(current);
    $('#card-box').title = `Mastery level: ${boxOf(current)}/${MAX_BOX}`;
    $('#card-question').textContent = current.question;
    $('#card-answer').innerHTML = answerHtml(current);
    $('#card-answer').hidden = true;
    $('#tap-hint').hidden = false;
    $('#reveal').hidden = false;
    $('#rate').hidden = true;

    // new question: if we scrolled down through a long answer, jump back to the card
    const headerH = $('.topbar').offsetHeight;
    const top = card.getBoundingClientRect().top;
    if (top < headerH) window.scrollTo({ top: window.scrollY + top - headerH - 12, behavior: 'smooth' });
  }

  function showDone() {
    const total = sessionIds.length;
    $('#done-restart').hidden = !total;
    $('#done-stats').hidden = !total;
    if (!total) {
      $('#done-emoji').textContent = '🔍';
      $('#done-title').textContent = 'No questions';
      $('#done-text').textContent = 'No question matches the selected filters. Adjust them above.';
      return;
    }
    const vals = Object.values(results);
    const good = vals.filter(v => v === 2).length;
    const mid = vals.filter(v => v === 1).length;
    const bad = vals.filter(v => v === 0).length;
    const ratio = total ? good / total : 0;
    $('#done-emoji').textContent = ratio >= 0.8 ? '🏆' : ratio >= 0.5 ? '🎉' : '💪';
    $('#done-title').textContent = ratio >= 0.8 ? 'Outstanding!' : ratio >= 0.5 ? 'Nice session!' : 'Session complete';
    $('#done-text').textContent = `You went through ${nq(total)}. Progress is saved on this device.`;
    $('#done-stats').innerHTML = `
      <div class="good"><strong>${good}</strong><span>Nailed it</span></div>
      <div class="mid"><strong>${mid}</strong><span>Partly</span></div>
      <div class="bad"><strong>${bad}</strong><span>To review</span></div>`;
  }

  function reveal() {
    if (!current || revealed) return;
    revealed = true;
    $('#card').classList.add('revealed');
    $('#card-answer').hidden = false;
    $('#tap-hint').hidden = true;
    $('#reveal').hidden = true;
    $('#rate').hidden = false;
  }

  function rate(r) {
    if (!current || !revealed) return;
    const p = progress[current.id] || { box: 0, seen: 0, lastSeen: 0 };
    p.seen = (p.seen || 0) + 1;
    p.lastSeen = Date.now();
    if (r === 0) {
      p.box = 0;
      queue.splice(Math.min(3, queue.length), 0, current); // comes back shortly
    } else if (r === 1) {
      p.box = Math.max(1, p.box || 0);
    } else {
      p.box = Math.min(MAX_BOX, (p.box || 0) + 1);
    }
    progress[current.id] = p;
    results[current.id] = r;
    saveProgress();

    const today = dayKey();
    activity.days[today] = (activity.days[today] || 0) + 1;
    saveJSON(KEYS.activity, activity);

    renderMasteryPill();
    next();
  }

  // =====================================================================
  // BROWSE
  // =====================================================================
  function renderBrowse() {
    const term = $('#search').value.trim().toLowerCase();
    const items = filtered().filter(q => !term || searchText(q).includes(term));
    $('#browse-count').textContent = `Found: ${nq(items.length)}`;
    $('#list').innerHTML = items.map(q => `
      <details>
        <summary>
          <span class="q">${esc(q.question)}</span>
          <span class="meta">
            ${levelOf(q) === 'senior' ? '<span class="badge badge-senior">Senior</span>' : ''}
            <span class="badge badge-cat">${esc(q.category)}</span>
            <span class="badge d${diffOf(q)}">${DIFF[diffOf(q)] || ''}</span>
            <span class="box-dots" title="Mastery level: ${boxOf(q)}/${MAX_BOX}">${boxDots(q)}</span>
          </span>
        </summary>
        <div class="answer">${answerHtml(q)}</div>
      </details>`).join('');
  }

  // =====================================================================
  // STATS
  // =====================================================================
  function bucket(list) {
    let good = 0, mid = 0;
    list.forEach(q => {
      if (boxOf(q) >= MASTERED_BOX) good++;
      else if (progress[q.id]) mid++;
    });
    return { total: list.length, good, mid, fresh: list.length - good - mid };
  }

  function streak() {
    const d = new Date();
    if (!activity.days[dayKey(d)]) d.setDate(d.getDate() - 1); // nothing today yet? count from yesterday
    let n = 0;
    while (activity.days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  function renderMasteryPill() {
    const s = bucket(QUESTIONS);
    $('#mastery-pill').textContent = `${s.total ? Math.round((s.good / s.total) * 100) : 0}%`;
  }

  function renderStats() {
    const list = filtered();
    const s = bucket(list);
    const pct = s.total ? Math.round((s.good / s.total) * 100) : 0;
    $('#ring').style.setProperty('--p', pct);
    $('#ring-value').textContent = pct + '%';
    $('#st-good').textContent = s.good;
    $('#st-mid').textContent = s.mid;
    $('#st-new').textContent = s.fresh;
    $('#st-today').textContent = activity.days[dayKey()] || 0;
    $('#st-streak').textContent = streak();
    $('#st-total').textContent = Object.values(activity.days).reduce((a, b) => a + b, 0);

    const w = (n, t) => (t ? (n / t) * 100 : 0);
    $('#stats-cats').innerHTML = levelCategories()
      .filter(c => !filters.categories.size || filters.categories.has(c))
      .map(c => {
        const b = bucket(list.filter(q => q.category === c));
        if (!b.total) return '';
        return `
          <div class="stat-row">
            <header><strong>${esc(c)}</strong><span>${b.good}/${b.total} · ${Math.round(w(b.good, b.total))}%</span></header>
            <div class="bar">
              <span class="good" style="width:${w(b.good, b.total)}%"></span>
              <span class="mid" style="width:${w(b.mid, b.total)}%"></span>
            </div>
          </div>`;
      }).join('');
  }

  // =====================================================================
  // RESET / EXPORT / IMPORT
  // =====================================================================
  function refreshAfterDataChange() {
    renderMasteryPill();
    renderFilters();
    startSession();
    renderBrowse();
    renderStats();
  }

  function resetAll() {
    if (!confirm('Delete ALL study progress and stats? This cannot be undone.')) return;
    progress = {};
    activity = { days: {} };
    saveProgress();
    saveJSON(KEYS.activity, activity);
    refreshAfterDataChange();
    toast('Progress cleared');
  }

  function resetFiltered() {
    const ids = filtered().map(q => q.id).filter(id => progress[id]);
    if (!ids.length) return toast('No progress to reset for these filters');
    if (!confirm(`Reset progress for ${nq(ids.length)} matching the current filters?`)) return;
    ids.forEach(id => delete progress[id]);
    saveProgress();
    refreshAfterDataChange();
    toast(`Reset ${nq(ids.length)}`);
  }

  function exportProgress() {
    const data = { app: 'rekru', version: 1, exportedAt: new Date().toISOString(), progress, activity };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rekru-progress-${dayKey()}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Progress file saved');
  }

  function importProgress(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data.progress !== 'object' || data.progress === null) throw new Error('missing "progress" field');
        if (!confirm('Importing will replace the current progress on this device. Continue?')) return;
        progress = data.progress;
        activity = data.activity && typeof data.activity.days === 'object' ? data.activity : { days: {} };
        saveProgress();
        saveJSON(KEYS.activity, activity);
        refreshAfterDataChange();
        toast('Progress imported');
      } catch (e) {
        alert('Could not read the file: ' + e.message);
      }
    };
    reader.readAsText(file);
  }

  // =====================================================================
  // VIEWS
  // =====================================================================
  function showView(name) {
    if (!['learn', 'browse', 'stats'].includes(name)) name = 'learn';
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== 'view-' + name; });
    document.body.classList.toggle('learn-active', name === 'learn');
    syncDock();
    if (name === 'stats') renderStats();
    if (name === 'browse') renderBrowse();
    try { localStorage.setItem(KEYS.view, name); } catch { /* ignore */ }
    window.scrollTo({ top: 0 });
  }

  // =====================================================================
  // EVENTS
  // =====================================================================
  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
  $('#reveal').addEventListener('click', reveal);
  $('#card').addEventListener('click', e => {
    if (!revealed && !e.target.closest('a, button')) reveal();
  });
  $('#rate').addEventListener('click', e => {
    const b = e.target.closest('[data-rate]');
    if (b) rate(Number(b.dataset.rate));
  });
  $('#restart').addEventListener('click', () => { startSession(); toast('New session'); });
  $('#done-restart').addEventListener('click', startSession);
  $('#search').addEventListener('input', renderBrowse);
  $('#export').addEventListener('click', exportProgress);
  $('#import').addEventListener('change', e => {
    if (e.target.files[0]) importProgress(e.target.files[0]);
    e.target.value = '';
  });
  $('#reset').addEventListener('click', resetAll);
  $('#reset-filtered').addEventListener('click', resetFiltered);

  document.addEventListener('keydown', e => {
    if ($('#view-learn').hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest('input, textarea, select, summary, .chip, .tab, .link-btn')) return;
    if ((e.key === ' ' || e.key === 'Enter') && current && !revealed) {
      e.preventDefault();
      reveal();
    } else if (revealed && ['1', '2', '3'].includes(e.key)) {
      e.preventDefault();
      rate(Number(e.key) - 1);
    }
  });

  // =====================================================================
  // START
  // =====================================================================
  if ('ResizeObserver' in window) new ResizeObserver(syncDock).observe($('.dock'));
  window.addEventListener('resize', syncDock);

  if (window.matchMedia('(min-width: 900px)').matches) $('#filters').open = true;
  renderFilters();
  renderMasteryPill();
  startSession();
  renderBrowse();
  renderStats();
  let initialView = 'learn';
  try { initialView = localStorage.getItem(KEYS.view) || 'learn'; } catch { /* ignore */ }
  showView(initialView);
  if (!storageOk) toast('⚠ Your browser blocks storage: progress will not be saved');
})();
