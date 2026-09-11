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

  const effectivenessSignalLabel = signal => ({
    'downstream-progress':'Есть downstream-прогресс',
    'interaction':'Есть взаимодействие',
    'actionable-yield':'Есть целевые вакансии',
    'qualified-yield':'Есть квалифицированные',
    'observed-only':'Есть находки без квалификации',
    'zero-qualified-yield':'Нет квалифицированных',
    'unavailable-only':'Только недоступность',
    'not-covered':'Не покрыт за 28 дней',
  }[signal] || signal || '—');

  const tierLabel = tier => ({
    mandatory:'Обязательный',
    rotation:'Ротация',
    exploratory:'Дополнительный',
  }[tier] || tier || '—');

  function cohortValue(value, suffix='') {
    return value === null || value === undefined ? '—' : `${value}${suffix}`;
  }

  function employerDirectSection(data, all) {
    const model = data?.employer_direct;
    if (!model) return '';
    const employer = model.summary || {};
    const benchmark = model.benchmark || {};
    const rows = all
      .filter(s => s.source_group === 'employer-direct' && s.enabled !== false)
      .sort((a,b) => {
        const aw = a.window_28d || {}, bw = b.window_28d || {};
        const num = value => Number(value || 0);
        return num(bw.accepted)-num(aw.accepted)
          || num(bw.offers)-num(aw.offers)
          || num(bw.interviews)-num(aw.interviews)
          || num(bw.recruiter_contacts)-num(aw.recruiter_contacts)
          || num(bw.applications)-num(aw.applications)
          || num(bw.actionable)-num(aw.actionable)
          || num(bw.qualified)-num(aw.qualified)
          || num(bw.new_unique)-num(aw.new_unique)
          || num(bw.checks)-num(aw.checks)
          || String(a.name).localeCompare(String(b.name),'ru');
      });

    const comparisonRows = [
      ['Успешных проверок','checks'],
      ['Доступность','availability_pct','%'],
      ['Новых / проверку','new_unique_per_check'],
      ['Квалифицированных / проверку','qualified_per_check'],
      ['Целевых / проверку','actionable_per_check'],
      ['Конверсия в отклик','application_conversion_pct','%'],
    ];

    return `<div class="section">
      <div class="section-head"><div><h2>Employer-direct effectiveness</h2><p class="section-note">Окно ${model.window_days || 28} дней на дату ${escS(dateOrDash(model.as_of))}. Официальные карьерные источники сравниваются с HH.ru + Getmatch + Habr Career + Setka. Низкий yield не является автоматическим основанием отключать источник.</p></div></div>
      <div class="grid cards source-metrics">
        <div class="metric"><span class="metric-label">Employer-direct источников</span><strong>${employer.source_count||0}</strong><span class="metric-note">попытки были по ${employer.attempted_sources||0}</span></div>
        <div class="metric"><span class="metric-label">Ротация за 7 дней</span><strong>${model.rotation_attempted_7d||0}/${model.rotation_enabled||0}</strong><span class="metric-note">успешно проверено: ${model.rotation_checked_7d||0}</span></div>
        <div class="metric"><span class="metric-label">Доступность employer-direct</span><strong>${cohortValue(employer.availability_pct,'%')}</strong><span class="metric-note">${employer.checks||0} успешных из ${employer.attempts||0} попыток</span></div>
        <div class="metric"><span class="metric-label">Целевых / проверку</span><strong>${cohortValue(employer.actionable_per_check)}</strong><span class="metric-note">benchmark: ${cohortValue(benchmark.actionable_per_check)}</span></div>
        <div class="metric"><span class="metric-label">Продуктивных источников</span><strong>${model.productive_sources||0}</strong><span class="metric-note">из ${employer.source_count||0} employer-direct</span></div>
        <div class="metric"><span class="metric-label">Без qualified yield</span><strong>${model.zero_qualified_sources||0}</strong><span class="metric-note">при хотя бы одной успешной проверке</span></div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Метрика за 28 дней</th><th>Employer-direct</th><th>HH / Getmatch / Habr / Setka</th></tr></thead>
        <tbody>${comparisonRows.map(([label,key,suffix=''])=>`<tr><td>${escS(label)}</td><td class="source-num">${escS(cohortValue(employer[key],suffix))}</td><td class="source-num">${escS(cohortValue(benchmark[key],suffix))}</td></tr>`).join('')}</tbody>
      </table></div>
      <div class="source-table-wrap"><table class="source-table"><thead><tr>
        <th>Работодатель</th><th>Контур</th><th>Приоритет</th><th>Попыток</th><th>Доступность</th><th>Новых</th><th>Квалиф.</th><th>Целевых</th><th>Отклик</th><th>Рекрутер</th><th>Интервью</th><th>Оффер</th><th>Сигнал</th><th>Последняя попытка</th>
      </tr></thead><tbody>
        ${rows.map(s => {
          const w = s.window_28d || {};
          return `<tr>
            <td><div class="source-name">${safe(s.entrypoint)?`<a href="${escS(s.entrypoint)}" target="_blank" rel="noopener">${escS(s.name)}</a>`:escS(s.name)}</div></td>
            <td>${escS(tierLabel(s.employer_direct_tier))}</td>
            <td>${escS(s.priority || '—')}</td>
            <td class="source-num">${w.attempts||0}</td>
            <td class="source-num">${escS(pctOrDash(w.availability_pct))}</td>
            <td class="source-num">${w.new_unique||0}</td>
            <td class="source-num">${w.qualified||0}</td>
            <td class="source-num source-num-strong">${w.actionable||0}</td>
            <td class="source-num">${w.applications||0}</td>
            <td class="source-num">${w.recruiter_contacts||0}</td>
            <td class="source-num">${w.interviews||0}</td>
            <td class="source-num">${w.offers||0}</td>
            <td>${escS(effectivenessSignalLabel(w.signal))}</td>
            <td>${escS(dateOrDash(w.last_attempt_at))}</td>
          </tr>`;
        }).join('') || '<tr><td colspan="14" class="empty">Employer-direct источники не настроены.</td></tr>'}
      </tbody></table></div>
    </div>`;
  }

  const targetStateLabel = state => ({
    'active-process':'Активный процесс',
    'actionable-signal':'Есть целевая вакансия',
    'qualified-signal':'Есть релевантная вакансия',
    'coverage-debt':'Нужно проверить',
    'access-risk':'Проблема доступа',
    'observed':'Есть находки',
    'monitoring':'Мониторинг',
  }[state] || state || '—');

  function targetAccountsSection(data) {
    const model = data?.target_accounts;
    if (!model) return '';
    const summary = model.summary || {};
    const rows = model.accounts || [];
    return `<div class="section">
      <div class="section-head"><div><h2>Целевые работодатели</h2><p class="section-note">Account-centric представление поверх существующих employer source registries: один список стратегических компаний без дублирования URL и source facts. Приоритет high для mandatory employer sources и из watchlist priority.</p></div></div>
      <div class="grid cards source-metrics">
        <div class="metric"><span class="metric-label">Целевых работодателей</span><strong>${summary.total||0}</strong><span class="metric-note">high: ${summary.high_priority||0} · medium: ${summary.medium_priority||0}</span></div>
        <div class="metric"><span class="metric-label">Требуют внимания</span><strong>${summary.needs_attention||0}</strong><span class="metric-note">coverage debt / access risk</span></div>
        <div class="metric"><span class="metric-label">Активный процесс</span><strong>${summary.active_process||0}</strong><span class="metric-note">есть подтверждённый downstream</span></div>
        <div class="metric"><span class="metric-label">Целевой сигнал</span><strong>${summary.actionable_signal||0}</strong><span class="metric-note">actionable за 28 дней</span></div>
      </div>
      <div class="source-table-wrap"><table class="source-table"><thead><tr>
        <th>Работодатель</th><th>Приоритет</th><th>Контур</th><th>Состояние</th><th>Проверок 28д</th><th>Доступность</th><th>Квалиф.</th><th>Целевых</th><th>Отклик</th><th>Рекрутер</th><th>Интервью</th><th>Оффер</th><th>Последняя попытка</th><th>Последняя находка</th>
      </tr></thead><tbody>
        ${rows.map(account => `<tr>
          <td><div class="source-name">${safe(account.entrypoint)?`<a href="${escS(account.entrypoint)}" target="_blank" rel="noopener">${escS(account.name)}</a>`:escS(account.name)}</div></td>
          <td>${escS(account.priority)}</td>
          <td>${escS(tierLabel(account.tier))}</td>
          <td>${escS(targetStateLabel(account.state))}</td>
          <td class="source-num">${account.checks_28d||0}</td>
          <td class="source-num">${escS(pctOrDash(account.availability_pct))}</td>
          <td class="source-num">${account.qualified_28d||0}</td>
          <td class="source-num source-num-strong">${account.actionable_28d||0}</td>
          <td class="source-num">${account.applications||0}</td>
          <td class="source-num">${account.recruiter_contacts||0}</td>
          <td class="source-num">${account.interviews||0}</td>
          <td class="source-num">${account.offers||0}</td>
          <td>${escS(dateOrDash(account.last_attempt_at))}</td>
          <td>${escS(dateOrDash(account.last_finding_at))}</td>
        </tr>`).join('') || '<tr><td colspan="14" class="empty">Целевые работодатели не настроены.</td></tr>'}
      </tbody></table></div>
    </div>`;
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
    ${stream === 'all' || stream === 'Основная работа' ? employerDirectSection(data, all) + targetAccountsSection(data) : ''}
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
      <p>${escS(data.methodology?.employer_direct_definition||'')}</p>
      <p>${escS(data.methodology?.target_account_definition||'')}</p>
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
