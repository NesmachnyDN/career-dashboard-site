let snapshot = null;
let currentView = 'today';
let query = '';

const $ = (s) => document.querySelector(s);
const esc = (v = '') => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const safeUrl = (url) => /^https?:\/\//i.test(url || '') ? url : '';
const fmtDate = (value) => {
  if (!value || ['unknown','to-verify','none'].includes(value)) return value || '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:value.includes('T')?'short':undefined}).format(d);
};
const containsQuery = (obj) => !query || JSON.stringify(obj).toLowerCase().includes(query.toLowerCase());

function b64Bytes(value) {
  const raw = atob(value); const out = new Uint8Array(raw.length);
  for (let i=0;i<raw.length;i++) out[i]=raw.charCodeAt(i); return out;
}

async function decryptPayload(payload, passphrase) {
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    {name:'PBKDF2', salt:b64Bytes(payload.salt), iterations:payload.iterations, hash:'SHA-256'},
    material, {name:'AES-GCM', length:256}, false, ['decrypt']
  );
  const plain = await crypto.subtle.decrypt({name:'AES-GCM', iv:b64Bytes(payload.iv)}, key, b64Bytes(payload.ciphertext));
  return JSON.parse(new TextDecoder().decode(plain));
}

async function loadData() {
  const encrypted = await fetch('data/snapshot.encrypted.json', {cache:'no-store'});
  if (encrypted.ok) {
    const payload = await encrypted.json();
    $('#unlock').classList.remove('hidden');
    $('#unlock-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      $('#unlock-error').textContent = '';
      try {
        snapshot = await decryptPayload(payload, $('#passphrase').value);
        $('#unlock').classList.add('hidden');
        startApp();
      } catch {
        $('#unlock-error').textContent = 'Не удалось расшифровать данные. Проверьте passphrase.';
      }
    });
    return;
  }
  const plain = await fetch('data/snapshot.json', {cache:'no-store'});
  if (!plain.ok) throw new Error('Dashboard snapshot not found');
  snapshot = await plain.json();
  startApp();
}

function startApp() {
  $('#shell').classList.remove('hidden');
  $('#generated-at').textContent = `Снимок: ${fmtDate(snapshot.generated_at)}`;
  $('#nav').addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-view]'); if (!btn) return;
    currentView = btn.dataset.view;
    document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b === btn));
    render();
  });
  $('#search').addEventListener('input', (event) => { query = event.target.value.trim(); render(); });
  document.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-copy]'); if (!btn) return;
    const text = decodeURIComponent(btn.dataset.copy);
    await navigator.clipboard.writeText(text);
    const before = btn.textContent; btn.textContent = 'Скопировано'; setTimeout(() => btn.textContent = before, 1200);
  });
  render();
}

const titles = {today:'Сегодня',discovered:'Найденные вакансии',opportunities:'Вакансии и взаимодействия',content:'Контент',inbox:'Почта и действия',analytics:'Аналитика',runs:'История запусков'};
function render() {
  $('#view-title').textContent = titles[currentView];
  const fn = {today:renderToday,discovered:renderDiscovered,opportunities:renderOpportunities,content:renderContent,inbox:renderInbox,analytics:renderAnalytics,runs:renderRuns}[currentView];
  $('#view').innerHTML = fn();
}

function metric(label, value, note='') { return `<div class="metric"><span class="meta">${esc(label)}</span><strong>${esc(value)}</strong><span class="meta">${esc(note)}</span></div>`; }
function badge(text, cls='') { return `<span class="badge ${esc(cls)}">${esc(text)}</span>`; }
function link(label, url) { const u=safeUrl(url); return u?`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(label)}</a>`:''; }
function copyBox(text) { if(!text) return ''; return `<div class="copybox">${esc(text)}<button data-copy="${encodeURIComponent(text)}">Копировать</button></div>`; }

function itemCard(item) {
  const actions = [link('Источник', item.source_url), link('Открыть цель', item.target_url)].filter(Boolean).join('');
  const meta = [item.kind, item.source_name, item.company, item.role, item.recommendation, item.fit_score != null ? `fit ${item.fit_score}%`: '', fmtDate(item.observed_at)].filter(Boolean);
  return `<article class="card">
    <div class="meta">${badge(item.priority || 'normal', item.priority)} ${meta.map(esc).join(' · ')}</div>
    <h3>${esc(item.title)}</h3>
    ${item.summary?`<p class="summary">${esc(item.summary)}</p>`:''}
    ${item.compensation?`<p class="meta">Compensation: ${esc(item.compensation)}${item.compensation_status?` · ${esc(item.compensation_status)}`:''}</p>`:''}
    ${copyBox(item.copy_text)}
    ${actions?`<div class="actions">${actions}</div>`:''}
  </article>`;
}

function renderToday() {
  const items = snapshot.automation.active_items.filter(containsQuery);
  const urgent = items.filter(i => ['urgent','high'].includes(i.priority)).slice(0,8);
  const discoveries = items.filter(i => ['vacancy','side-income'].includes(i.kind)).slice(0,8);
  const latest = Object.values(snapshot.automation.latest_by_workflow || {}).sort((a,b)=>new Date(b.completed_at)-new Date(a.completed_at));
  return `<div class="grid cards">
    ${metric('Активные вакансии', snapshot.analytics.active_opportunity_count)}
    ${metric('Новые сигналы', items.length)}
    ${metric('Требуют внимания', urgent.length)}
    ${metric('Взаимодействия', snapshot.analytics.interaction_count)}
  </div>
  <div class="section"><div class="section-head"><h2>Приоритетные действия</h2></div>${urgent.length?urgent.map(itemCard).join(''):'<div class="empty">Срочных новых действий нет.</div>'}</div>
  <div class="section"><div class="section-head"><h2>Свежие возможности</h2></div>${discoveries.length?discoveries.map(itemCard).join(''):'<div class="empty">Новых подходящих возможностей в сохранённых запусках нет.</div>'}</div>
  <div class="section"><div class="section-head"><h2>Последние автоматизации</h2></div><div class="table-wrap"><table><thead><tr><th>Workflow</th><th>Статус</th><th>Завершено</th><th>Результатов</th></tr></thead><tbody>${latest.map(r=>`<tr><td>${esc(r.workflow)}</td><td>${badge(r.status)}</td><td>${esc(fmtDate(r.completed_at))}</td><td>${r.items?.length||0}</td></tr>`).join('')||'<tr><td colspan="4">Пока нет сохранённых запусков</td></tr>'}</tbody></table></div></div>`;
}

function discoveryStatusLabel(status) {
  return ({new:'Новая',reviewing:'На рассмотрении',dismissed:'Отклонена',promoted:'Переведена в работу',expired:'Неактуальна'})[status] || status || 'Новая';
}

function discoveryCard(item) {
  const status = item.discovery_status || 'new';
  const actions = [link('Источник', item.source_url)].filter(Boolean).join('');
  const meta = [
    item.company,
    item.role,
    item.recommendation,
    item.fit_score != null ? `fit ${item.fit_score}%` : '',
    item.compensation_status,
    item.originally_seen_at ? `найдена ${fmtDate(item.originally_seen_at)}` : ''
  ].filter(Boolean);
  return `<article class="card">
    <div class="meta">${badge(discoveryStatusLabel(status), status)} ${badge(item.priority || 'normal', item.priority)} ${meta.map(esc).join(' · ')}</div>
    <h3>${esc(item.title)}</h3>
    ${item.summary?`<p class="summary">${esc(item.summary)}</p>`:''}
    ${item.status_reason?`<p class="meta"><strong>Статус:</strong> ${esc(item.status_reason)}</p>`:''}
    ${item.compensation?`<p class="meta">Compensation: ${esc(item.compensation)}</p>`:''}
    ${actions?`<div class="actions">${actions}</div>`:''}
  </article>`;
}

function renderDiscovered() {
  const items = (snapshot.automation.discovered_vacancies || []).filter(containsQuery);
  const actionable = items.filter(i => ['new','reviewing'].includes(i.discovery_status || 'new'));
  const historical = items.filter(i => !['new','reviewing'].includes(i.discovery_status || 'new'));
  const newCount = items.filter(i => (i.discovery_status || 'new') === 'new').length;
  const reviewingCount = items.filter(i => i.discovery_status === 'reviewing').length;

  if (!items.length) return '<div class="empty">Сохранённых найденных вакансий пока нет.</div>';

  return `<div class="grid cards">
    ${metric('Всего найдено', items.length)}
    ${metric('Новые', newCount)}
    ${metric('На рассмотрении', reviewingCount)}
    ${metric('В работе / закрыто', historical.length)}
  </div>
  <div class="section">
    <div class="section-head"><h2>К рассмотрению</h2></div>
    ${actionable.length?actionable.map(discoveryCard).join(''):'<div class="empty">Нет вакансий, ожидающих решения.</div>'}
  </div>
  <div class="section">
    <div class="section-head"><h2>История найденных вакансий</h2></div>
    ${historical.length?historical.map(discoveryCard).join(''):'<div class="empty">Исторических записей пока нет.</div>'}
  </div>`;
}

function renderOpportunities() {
  const opps = snapshot.opportunities.filter(containsQuery);
  if (!opps.length) return '<div class="empty">В canonical applications пока нет подходящих записей.</div>';
  return opps.map(o => `<article class="card">
    <div class="meta">${badge(o.current_stage || 'unknown')} ${badge(o.fit_status || 'not-assessed')} ${badge(o.compensation_status || 'unknown')}</div>
    <h3>${esc(o.company || o.title)} — ${esc(o.role || '')}</h3>
    <div class="meta">${esc(o.role_track || '')} · обновлено ${esc(fmtDate(o.last_updated_at))}</div>
    <p class="summary"><strong>Next action:</strong> ${esc(o.next_action || '—')} ${o.next_action_date?`· ${esc(fmtDate(o.next_action_date))}`:''}</p>
    ${o.compensation?`<p class="meta">${esc(o.compensation)}</p>`:''}
    ${link('Исходная вакансия',o.source_url)?`<div class="actions">${link('Исходная вакансия',o.source_url)}</div>`:''}
    <div class="timeline">${(o.interactions||[]).slice().reverse().map(i=>`<div class="timeline-item"><h4>${esc(i.title)}</h4><div class="meta">${esc(fmtDate(i.timestamp))} · ${esc(i.direction||'')} · ${esc(i.channel||'')}</div><div class="summary">${esc(i.event||'')}</div>${i.follow_up?`<div class="meta">Follow-up: ${esc(i.follow_up)}</div>`:''}</div>`).join('')||'<div class="meta">История взаимодействий пока пуста.</div>'}</div>
  </article>`).join('');
}

function renderContent() {
  const items = snapshot.automation.active_items.filter(i => ['post','comment','brief'].includes(i.kind) && containsQuery(i));
  return items.length ? items.map(itemCard).join('') : '<div class="empty">Сохранённых предложений по контенту пока нет.</div>';
}

function renderInbox() {
  const items = snapshot.automation.active_items.filter(i => i.kind === 'email' && containsQuery(i));
  return items.length ? items.map(itemCard).join('') : '<div class="empty">Новых карьерных писем в сохранённых запусках нет.</div>';
}

function bars(data) {
  const entries = Object.entries(data||{}).sort((a,b)=>b[1]-a[1]); const max=Math.max(1,...entries.map(([,v])=>v));
  return entries.map(([k,v])=>`<div class="bar-row"><span>${esc(k)}</span><div class="bar"><i style="width:${Math.round(v/max*100)}%"></i></div><strong>${v}</strong></div>`).join('') || '<div class="empty">Недостаточно данных.</div>';
}
function renderAnalytics() {
  return `<div class="grid cards">${metric('Всего opportunities',snapshot.analytics.opportunity_count)}${metric('Активные',snapshot.analytics.active_opportunity_count)}${metric('Найденные вакансии',snapshot.analytics.discovered_vacancy_count || 0)}${metric('К рассмотрению',snapshot.analytics.actionable_discovered_vacancy_count || 0)}</div>
  <div class="section"><h2>Воронка по стадиям</h2><div class="card">${bars(snapshot.analytics.stage_counts)}</div></div>
  <div class="section"><h2>Статусы найденных вакансий</h2><div class="card">${bars(snapshot.analytics.discovery_status_counts)}</div></div>
  <div class="section"><h2>Источники opportunities</h2><div class="card">${bars(snapshot.analytics.source_counts)}</div></div>
  <div class="section"><h2>Типы текущих сигналов</h2><div class="card">${bars(snapshot.analytics.item_kind_counts)}</div></div>`;
}

function renderRuns() {
  const runs = snapshot.automation.runs.filter(containsQuery);
  return `<div class="table-wrap"><table><thead><tr><th>Workflow</th><th>Run</th><th>Статус</th><th>Завершено</th><th>Items</th><th>Summary</th></tr></thead><tbody>${runs.map(r=>`<tr><td>${esc(r.workflow)}</td><td>${esc(r.run_id)}</td><td>${badge(r.status)}</td><td>${esc(fmtDate(r.completed_at))}</td><td>${r.items?.length||0}</td><td>${esc(r.summary||'')}</td></tr>`).join('')||'<tr><td colspan="6">Сохранённых запусков пока нет.</td></tr>'}</tbody></table></div>`;
}

loadData().catch((error) => {
  document.body.innerHTML = `<div class="unlock"><div class="unlock-card"><h1>Career Operations</h1><p class="error">${esc(error.message)}</p><p>Сначала соберите dashboard snapshot.</p></div></div>`;
});
