(() => {
  const escS = (v='') => String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const safe = u => /^https?:\/\//i.test(u||'') ? u : '';
  const modeLabel = m => ({fixed:'Фиксированный','dynamic':'Найден в запуске','dynamic-channel':'Динамический поиск'}[m] || m);
  const coverageLabel = c => ({mandatory:'Обязательный',exploratory:'Дополнительный',disabled:'Отключён',rotation:'Ротация',workflow:'По правилам процесса',observed:'Наблюдался'}[c] || c || '—');
  const stateLabel = s => s.enabled === false ? 'Отключён' : 'Активен';
  const numberOrDash = v => v === null || v === undefined ? '—' : String(v);
  const pctOrDash = v => v === null || v === undefined ? '—' : `${Number(v).toLocaleString('ru-RU',{maximumFractionDigits:1})}%`;
  const dateOrDash = v => v ? new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium'}).format(new Date(v)) : '—';
  let stream = 'all', mode = 'all', sortMode = 'actionable', localQuery = '';

  function compareSources(a,b) {
    const num = (v) => v === null || v === undefined ? -1 : Number(v);
    if (sortMode === 'found') return num(b.found_candidates)-num(a.found_candidates) || num(b.saved_results)-num(a.saved_results) || String(a.name).localeCompare(String(b.name),'ru');
    if (sortMode === 'yield') return num(b.actionable_yield_pct)-num(a.actionable_yield_pct) || num(b.actionable_candidates)-num(a.actionable_candidates) || String(a.name).localeCompare(String(b.name),'ru');
    if (sortMode === 'checks') return num(b.checks)-num(a.checks) || num(b.found_candidates)-num(a.found_candidates) || String(a.name).localeCompare(String(b.name),'ru');
    if (sortMode === 'name') return String(a.name).localeCompare(String(b.name),'ru');
    return num(b.actionable_candidates)-num(a.actionable_candidates) || num(b.saved_results)-num(a.saved_results) || String(a.name).localeCompare(String(b.name),'ru');
  }

  function checkCell(s) {
    if (!s.telemetry_available) return '—';
    const unavailable = Number(s.unavailable_attempts || 0);
    return `<strong>${escS(numberOrDash(s.checks))}</strong>${unavailable?`<span class="source-subnum">+ ${unavailable} недоступ.</span>`:''}`;
  }

  function renderSources() {
    const root = document.querySelector('#view');
    const data = snapshot?.source_analytics;
    if (!root) return;
    if (!data) {
      root.innerHTML='<div class="empty">Аналитика источников появится после следующей сборки снимка.</div>';
      return;
    }
    const all = data.sources || [];
    const streams = [...new Set(all.map(s=>s.stream_label).filter(Boolean))].sort();
    const filtered = all
      .filter(s => (stream==='all'||s.stream_label===stream) && (mode==='all'||s.mode===mode) && (!localQuery || JSON.stringify(s).toLowerCase().includes(localQuery.toLowerCase())))
      .sort(compareSources);
    const sum = data.summary || {};

    root.innerHTML = `<div class="grid cards source-metrics">
      <div class="metric"><span class="metric-label">Активных фиксированных</span><strong>${sum.fixed_enabled||0}</strong><span class="metric-note">из ${sum.fixed_total||0} зарегистрированных</span></div>
      <div class="metric"><span class="metric-label">Проверок источников</span><strong>${sum.source_checks||0}</strong><span class="metric-note">телеметрия по ${sum.telemetry_sources||0} источникам${sum.unavailable_attempts?`; недоступно: ${sum.unavailable_attempts}`:''}</span></div>
      <div class="metric"><span class="metric-label">Найдено кандидатов</span><strong>${sum.found_candidates||0}</strong><span class="metric-note">до дедупликации</span></div>
      <div class="metric"><span class="metric-label">Новых уникальных</span><strong>${sum.new_unique_candidates||0}</strong><span class="metric-note">после дедупликации</span></div>
      <div class="metric"><span class="metric-label">Квалифицировано</span><strong>${sum.qualified_candidates||0}</strong><span class="metric-note">прошли предметную оценку</span></div>
      <div class="metric"><span class="metric-label">Целевых</span><strong>${sum.actionable_candidates||0}</strong><span class="metric-note">прошли практический action gate</span></div>
      <div class="metric"><span class="metric-label">Начато взаимодействий</span><strong>${sum.interaction_started||0}</strong><span class="metric-note">из канонического applications/</span></div>
      <div class="metric"><span class="metric-label">Динамических источников</span><strong>${sum.dynamic_observed||0}</strong><span class="metric-note">фактически наблюдались в запусках</span></div>
    </div>
    <div class="section">
      <div class="section-head"><div><h2>Источники сбора данных</h2><p class="section-note">Фиксированные источники берутся из реестров pipeline. Динамические появляются только после фактической проверки во время запуска.</p></div></div>
      <div class="source-controls">
        <select id="source-stream"><option value="all">Все направления</option>${streams.map(v=>`<option ${stream===v?'selected':''}>${escS(v)}</option>`).join('')}</select>
        <select id="source-mode"><option value="all">Все типы</option><option value="fixed" ${mode==='fixed'?'selected':''}>Фиксированные</option><option value="dynamic" ${mode==='dynamic'?'selected':''}>Найденные динамически</option><option value="dynamic-channel" ${mode==='dynamic-channel'?'selected':''}>Каналы динамического поиска</option></select>
        <select id="source-sort"><option value="actionable" ${sortMode==='actionable'?'selected':''}>Сортировка: целевые</option><option value="found" ${sortMode==='found'?'selected':''}>Сортировка: найдено</option><option value="yield" ${sortMode==='yield'?'selected':''}>Сортировка: конверсия</option><option value="checks" ${sortMode==='checks'?'selected':''}>Сортировка: проверки</option><option value="name" ${sortMode==='name'?'selected':''}>Сортировка: название</option></select>
        <input id="source-query" type="search" placeholder="Фильтр источников…" value="${escS(localQuery)}">
      </div>
      <div class="source-table-wrap"><table class="source-table"><thead><tr>
        <th>Источник</th><th>Направление</th><th>Модель</th><th>Покрытие</th><th>Проверок</th><th>Найдено</th><th>Новых</th><th>Квалиф.</th><th>Целевых</th><th>Сохранено</th><th>Контакты</th><th>Yield</th><th>Последняя проверка</th>
      </tr></thead><tbody>
        ${filtered.map(s=>`<tr>
          <td><div class="source-name">${safe(s.entrypoint)?`<a href="${escS(s.entrypoint)}" target="_blank" rel="noopener">${escS(s.name)}</a>`:escS(s.name)}</div><div class="source-meta">${escS(stateLabel(s))}${s.parent?` · ${escS(s.parent)}`:''}${!s.telemetry_available&&s.saved_results?` · исторические данные`:''}</div></td>
          <td>${escS(s.stream_label)}</td>
          <td><span class="source-chip mode-${escS(s.mode)}">${escS(modeLabel(s.mode))}</span></td>
          <td>${escS(coverageLabel(s.coverage))}</td>
          <td class="source-num">${checkCell(s)}</td>
          <td class="source-num">${escS(numberOrDash(s.found_candidates))}</td>
          <td class="source-num">${escS(numberOrDash(s.new_unique_candidates))}</td>
          <td class="source-num">${escS(numberOrDash(s.qualified_candidates))}</td>
          <td class="source-num source-num-strong">${escS(numberOrDash(s.actionable_candidates))}</td>
          <td class="source-num">${s.saved_results||0}</td>
          <td class="source-num">${s.interaction_started||0}</td>
          <td class="source-num">${escS(pctOrDash(s.actionable_yield_pct))}</td>
          <td>${escS(dateOrDash(s.last_checked_at))}</td>
        </tr>`).join('') || '<tr><td colspan="13" class="empty">По фильтру источников нет.</td></tr>'}
      </tbody></table></div>
    </div>
    <div class="section source-method"><h2>Как читать эффективность</h2>
      <p>${escS(data.methodology?.telemetry_definition||'')}</p>
      <p>${escS(data.methodology?.finding_definition||'')}</p>
      <p>${escS(data.methodology?.actionable_definition||'')}</p>
      <p>${escS(data.methodology?.interaction_definition||'')}</p>
      <p>${escS(data.methodology?.dynamic_definition||'')}</p>
      <p class="section-note">${escS(data.methodology?.legacy_definition||'')}</p>
    </div>`;

    root.querySelector('#source-stream')?.addEventListener('change',e=>{stream=e.target.value;renderSources();});
    root.querySelector('#source-mode')?.addEventListener('change',e=>{mode=e.target.value;renderSources();});
    root.querySelector('#source-sort')?.addEventListener('change',e=>{sortMode=e.target.value;renderSources();});
    root.querySelector('#source-query')?.addEventListener('input',e=>{localQuery=e.target.value.trim();renderSources();});
  }

  function activate() {
    document.querySelectorAll('#nav button').forEach(b=>b.classList.remove('active'));
    document.querySelector('#sources-nav')?.classList.add('active');
    const title=document.querySelector('#view-title');
    if(title) title.textContent='Источники данных';
    renderSources();
  }

  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelector('#sources-nav')?.addEventListener('click',activate);
    document.querySelector('#nav')?.addEventListener('click',()=>document.querySelector('#sources-nav')?.classList.remove('active'));
  });
})();
