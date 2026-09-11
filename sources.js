(() => {
  const escS = (v='') => String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const safe = u => /^https?:\/\//i.test(u||'') ? u : '';
  const modeLabel = m => ({fixed:'Фиксированный','dynamic':'Найден в запуске','dynamic-channel':'Динамический поиск'}[m] || m);
  const coverageLabel = c => ({mandatory:'Обязательный',exploratory:'Дополнительный',disabled:'Отключён',rotation:'Ротация',workflow:'По правилам процесса',observed:'Наблюдался'}[c] || c || '—');
  const stateLabel = s => s.enabled === false ? 'Отключён' : 'Активен';
  const numberOrDash = v => v === null || v === undefined ? '—' : String(v);
  const pctOrDash = v => v === null || v === undefined ? '—' : `${Number(v).toLocaleString('ru-RU',{maximumFractionDigits:1})}%`;
  const dateOrDash = v => v ? new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium'}).format(new Date(v)) : '—';
  let stream = 'all', mode = 'all', sortMode = 'downstream', localQuery = '';

  function compareSources(a,b) {
    const num = (v) => v === null || v === undefined ? -1 : Number(v);
    const byName = () => String(a.name).localeCompare(String(b.name),'ru');
    if (sortMode === 'downstream') {
      return num(b.accepted)-num(a.accepted)
        || num(b.offers)-num(a.offers)
        || num(b.interviews)-num(a.interviews)
        || num(b.recruiter_contacts)-num(a.recruiter_contacts)
        || num(b.applications)-num(a.applications)
        || num(b.application_conversion_pct)-num(a.application_conversion_pct)
        || num(b.actionable_candidates)-num(a.actionable_candidates)
        || byName();
    }
    if (sortMode === 'applications') return num(b.applications)-num(a.applications) || num(b.application_conversion_pct)-num(a.application_conversion_pct) || byName();
    if (sortMode === 'recruiter') return num(b.recruiter_contacts)-num(a.recruiter_contacts) || num(b.recruiter_conversion_pct)-num(a.recruiter_conversion_pct) || byName();
    if (sortMode === 'found') return num(b.found_candidates)-num(a.found_candidates) || num(b.saved_results)-num(a.saved_results) || byName();
    if (sortMode === 'yield') return num(b.actionable_yield_pct)-num(a.actionable_yield_pct) || num(b.actionable_candidates)-num(a.actionable_candidates) || byName();
    if (sortMode === 'checks') return num(b.checks)-num(a.checks) || num(b.found_candidates)-num(a.found_candidates) || byName();
    if (sortMode === 'name') return byName();
    return byName();
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
      <div class="metric"><span class="metric-label">Проверок источников</span><strong>${sum.source_checks||0}</strong><span class="metric-note">по ${sum.telemetry_sources||0} источникам${sum.unavailable_attempts?`; недоступно: ${sum.unavailable_attempts}`:''}</span></div>
      <div class="metric"><span class="metric-label">Найдено кандидатов</span><strong>${sum.found_candidates||0}</strong><span class="metric-note">до дедупликации</span></div>
      <div class="metric"><span class="metric-label">Целевых</span><strong>${sum.actionable_candidates||0}</strong><span class="metric-note">прошли action gate</span></div>
      <div class="metric"><span class="metric-label">Атрибутировано вакансий</span><strong>${sum.attributed_vacancies||0}</strong><span class="metric-note">уникальные discovery identity</span></div>
      <div class="metric"><span class="metric-label">Дошли до отклика</span><strong>${sum.applications||0}</strong><span class="metric-note">подтверждено Interaction Log</span></div>
      <div class="metric"><span class="metric-label">Контакт с рекрутером</span><strong>${sum.recruiter_contacts||0}</strong><span class="metric-note">этап recruiter-screen</span></div>
      <div class="metric"><span class="metric-label">Дошли до интервью</span><strong>${sum.interviews||0}</strong><span class="metric-note">hiring / technical / final</span></div>
      <div class="metric"><span class="metric-label">Дошли до оффера</span><strong>${sum.offers||0}</strong><span class="metric-note">${sum.accepted?`принято: ${sum.accepted}`:'offer/contract discussion'}</span></div>
    </div>
    ${sum.scheduled_unlinked_opportunities ? `<div class="view-note">Не атрибутировано к источнику: <strong>${sum.scheduled_unlinked_opportunities}</strong> opportunity из автопоиска без надёжного discovery_key. Они намеренно исключены из source conversion, чтобы не приписывать результат площадке задним числом.</div>` : ''}
    <div class="section">
      <div class="section-head"><div><h2>Источники сбора данных</h2><p class="section-note">Фиксированные источники берутся из реестров pipeline. Динамические появляются только после фактической проверки во время запуска.</p></div></div>
      <div class="source-controls">
        <select id="source-stream"><option value="all">Все направления</option>${streams.map(v=>`<option ${stream===v?'selected':''}>${escS(v)}</option>`).join('')}</select>
        <select id="source-mode"><option value="all">Все типы</option><option value="fixed" ${mode==='fixed'?'selected':''}>Фиксированные</option><option value="dynamic" ${mode==='dynamic'?'selected':''}>Найденные динамически</option><option value="dynamic-channel" ${mode==='dynamic-channel'?'selected':''}>Каналы динамического поиска</option></select>
        <select id="source-sort"><option value="downstream" ${sortMode==='downstream'?'selected':''}>Сортировка: downstream</option><option value="applications" ${sortMode==='applications'?'selected':''}>Сортировка: отклики</option><option value="recruiter" ${sortMode==='recruiter'?'selected':''}>Сортировка: рекрутер</option><option value="found" ${sortMode==='found'?'selected':''}>Сортировка: найдено</option><option value="yield" ${sortMode==='yield'?'selected':''}>Сортировка: actionable yield</option><option value="checks" ${sortMode==='checks'?'selected':''}>Сортировка: проверки</option><option value="name" ${sortMode==='name'?'selected':''}>Сортировка: название</option></select>
        <input id="source-query" type="search" placeholder="Фильтр источников…" value="${escS(localQuery)}">
      </div>
      <div class="source-table-wrap"><table class="source-table"><thead><tr>
        <th>Источник</th><th>Направление</th><th>Модель</th><th>Покрытие</th><th>Проверок</th><th>Найдено</th><th>Новых</th><th>Квалиф.</th><th>Целевых</th><th>Yield</th><th>Сохранено</th><th>Вакансий</th><th>Связано</th><th>Отклик</th><th>Рекрутер</th><th>Интервью</th><th>Оффер</th><th>В отклик</th><th>Рекр./откл.</th><th>Инт./рекр.</th><th>Оффер/инт.</th><th>Последняя проверка</th><th>Последняя находка</th><th>Последний прогресс</th>
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
          <td class="source-num">${escS(numberOrDash(s.actionable_candidates))}</td>
          <td class="source-num">${escS(pctOrDash(s.actionable_yield_pct))}</td>
          <td class="source-num">${s.saved_results||0}</td>
          <td class="source-num">${s.attributed_vacancies||0}</td>
          <td class="source-num">${s.linked_opportunities||0}</td>
          <td class="source-num source-num-strong">${s.applications||0}</td>
          <td class="source-num source-num-strong">${s.recruiter_contacts||0}</td>
          <td class="source-num source-num-strong">${s.interviews||0}</td>
          <td class="source-num source-num-strong">${s.offers||0}${s.accepted?`<span class="source-subnum">принято: ${s.accepted}</span>`:''}</td>
          <td class="source-num">${escS(pctOrDash(s.application_conversion_pct))}</td>
          <td class="source-num">${escS(pctOrDash(s.recruiter_conversion_pct))}</td>
          <td class="source-num">${escS(pctOrDash(s.interview_conversion_pct))}</td>
          <td class="source-num">${escS(pctOrDash(s.offer_conversion_pct))}</td>
          <td>${escS(dateOrDash(s.last_checked_at))}</td>
          <td>${escS(dateOrDash(s.last_finding_at))}</td>
          <td>${escS(dateOrDash(s.last_progress_at))}</td>
        </tr>`).join('') || '<tr><td colspan="24" class="empty">По фильтру источников нет.</td></tr>'}
      </tbody></table></div>
    </div>
    <div class="section source-method"><h2>Как читать эффективность</h2>
      <p>${escS(data.methodology?.telemetry_definition||'')}</p>
      <p>${escS(data.methodology?.finding_definition||'')}</p>
      <p>${escS(data.methodology?.actionable_definition||'')}</p>
      <p>${escS(data.methodology?.interaction_definition||'')}</p>
      <p>${escS(data.methodology?.conversion_definition||'')}</p>
      <p>${escS(data.methodology?.attribution_definition||'')}</p>
      <p>${escS(data.methodology?.conversion_rate_definition||'')}</p>
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
