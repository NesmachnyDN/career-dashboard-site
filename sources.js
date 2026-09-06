(() => {
  const escS = (v='') => String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const safe = u => /^https?:\/\//i.test(u||'') ? u : '';
  const modeLabel = m => ({fixed:'Фиксированный','dynamic':'Найден в запуске','dynamic-channel':'Динамический поиск'}[m] || m);
  const coverageLabel = c => ({mandatory:'Обязательный',exploratory:'Дополнительный',disabled:'Отключён',rotation:'Ротация',workflow:'По правилам процесса',observed:'Наблюдался'}[c] || c || '—');
  const stateLabel = s => s.enabled === false ? 'Отключён' : 'Активен';
  let stream = 'all', mode = 'all', localQuery = '';
  function renderSources() {
    const root = document.querySelector('#view');
    const data = snapshot?.source_analytics;
    if (!root) return;
    if (!data) { root.innerHTML='<div class="empty">Аналитика источников появится после следующей сборки снимка.</div>'; return; }
    const all = data.sources || [];
    const streams = [...new Set(all.map(s=>s.stream_label).filter(Boolean))].sort();
    const filtered = all.filter(s => (stream==='all'||s.stream_label===stream) && (mode==='all'||s.mode===mode) && (!localQuery || JSON.stringify(s).toLowerCase().includes(localQuery.toLowerCase())));
    const sum = data.summary || {};
    root.innerHTML = `<div class="grid cards source-metrics">
      <div class="metric"><span class="metric-label">Активных фиксированных</span><strong>${sum.fixed_enabled||0}</strong><span class="metric-note">из ${sum.fixed_total||0} зарегистрированных</span></div>
      <div class="metric"><span class="metric-label">Динамических источников</span><strong>${sum.dynamic_observed||0}</strong><span class="metric-note">наблюдались в сохранённых результатах</span></div>
      <div class="metric"><span class="metric-label">Найдено результатов</span><strong>${sum.findings||0}</strong><span class="metric-note">по сохранённой истории запусков</span></div>
      <div class="metric"><span class="metric-label">Целевых результатов</span><strong>${sum.actionable_findings||0}</strong><span class="metric-note">прошли первичный отбор</span></div></div>
      <div class="section"><div class="section-head"><div><h2>Источники сбора данных</h2><p class="section-note">Фиксированные источники берутся из реестров pipeline. Динамические — фактические источники, найденные во время запусков.</p></div></div>
      <div class="source-controls"><select id="source-stream"><option value="all">Все направления</option>${streams.map(v=>`<option ${stream===v?'selected':''}>${escS(v)}</option>`).join('')}</select><select id="source-mode"><option value="all">Все типы</option><option value="fixed" ${mode==='fixed'?'selected':''}>Фиксированные</option><option value="dynamic" ${mode==='dynamic'?'selected':''}>Найденные динамически</option><option value="dynamic-channel" ${mode==='dynamic-channel'?'selected':''}>Каналы динамического поиска</option></select><input id="source-query" type="search" placeholder="Фильтр источников…" value="${escS(localQuery)}"></div>
      <div class="source-table-wrap"><table class="source-table"><thead><tr><th>Источник</th><th>Направление</th><th>Модель</th><th>Покрытие</th><th>Результаты</th><th>Целевые</th><th>Запуски с результатом</th><th>Последняя находка</th></tr></thead><tbody>${filtered.map(s=>`<tr><td><div class="source-name">${safe(s.entrypoint)?`<a href="${escS(s.entrypoint)}" target="_blank" rel="noopener">${escS(s.name)}</a>`:escS(s.name)}</div><div class="source-meta">${escS(stateLabel(s))}${s.parent?` · ${escS(s.parent)}`:''}</div></td><td>${escS(s.stream_label)}</td><td><span class="source-chip mode-${escS(s.mode)}">${escS(modeLabel(s.mode))}</span></td><td>${escS(coverageLabel(s.coverage))}</td><td class="source-num">${s.findings||0}</td><td class="source-num">${s.actionable_findings||0}</td><td class="source-num">${s.runs_with_findings||0}</td><td>${s.last_finding_at?new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium'}).format(new Date(s.last_finding_at)):'—'}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">По фильтру источников нет.</td></tr>'}</tbody></table></div></div>
      <div class="section source-method"><h2>Как читать эффективность</h2><p>${escS(data.methodology?.finding_definition||'')}</p><p>${escS(data.methodology?.actionable_definition||'')}</p><p>${escS(data.methodology?.dynamic_definition||'')}</p><p class="section-note">${escS(data.methodology?.limitation||'')}</p></div>`;
    root.querySelector('#source-stream')?.addEventListener('change',e=>{stream=e.target.value;renderSources();});
    root.querySelector('#source-mode')?.addEventListener('change',e=>{mode=e.target.value;renderSources();});
    root.querySelector('#source-query')?.addEventListener('input',e=>{localQuery=e.target.value.trim();renderSources();});
  }
  function activate() { document.querySelectorAll('#nav button').forEach(b=>b.classList.remove('active')); document.querySelector('#sources-nav')?.classList.add('active'); const title=document.querySelector('#view-title'); if(title) title.textContent='Источники данных'; renderSources(); }
  document.addEventListener('DOMContentLoaded',()=>{ document.querySelector('#sources-nav')?.addEventListener('click',activate); document.querySelector('#nav')?.addEventListener('click',()=>document.querySelector('#sources-nav')?.classList.remove('active')); });
})();
