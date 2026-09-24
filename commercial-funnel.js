(() => {
  const originalRender = render;
  titles.commercial = 'Коммерческая воронка';

  const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const STAGES = [
    ['captured', 'Зафиксировано'],
    ['qualifying', 'Квалификация'],
    ['qualified', 'Квалифицировано'],
    ['handoff-ready', 'Готово к handoff'],
    ['disqualified', 'Дисквалифицировано'],
    ['withdrawn', 'Отозвано'],
    ['expired', 'Истекло']
  ];
  const CONVERSIONS = {
    demand_to_promotion_ready: 'Спрос → promotion-ready',
    captured_to_qualifying: 'Зафиксировано → квалификация',
    qualifying_to_qualified: 'Квалификация → квалифицировано',
    qualified_to_handoff_ready: 'Квалифицировано → handoff-ready'
  };
  const GAP_LABELS = {
    'promotion-readiness-not-persisted-for-unmaterialized-demand': 'Нет неизменяемого решения promotion readiness',
    'discovery-attribution-unlinked': 'Не связана атрибуция источника',
    'lead-upstream-demand-record-missing': 'Не найден исходный Demand Signal',
    'lead-creation-item-unlinked': 'Не найден discovery item создания лида',
    'commercial-value-unknown': 'Коммерческая стоимость неизвестна',
    'ambiguous-current-demand-history': 'Неоднозначная текущая история Demand'
  };

  function model() {
    return snapshot?.analytics?.commercial_funnel || {
      contract_version: 'commercial-funnel-projection.v1',
      population: {demand_signals: {observed_unique: 0}, promotion_ready: {proven: 0, unknown: 0}, commercial_leads: 0},
      current_state: {stage_counts: {}},
      historical: {milestone_counts: {}, conversions: [], rollback_counts: {}, terminal_outcomes: {counts: {}, entry_points: [], disqualification_criteria: []}},
      dimensions: {discovery_source: {linked_demand_signals: 0, unlinked_demand_signals: 0, unlinked_commercial_leads: 0, rows: []}, service_id: {rows: []}},
      commercial_value: {known_count: 0, unknown_count: 0, known_amount_total: null},
      evidence_gaps: []
    };
  }

  function conversionValue(row) {
    if (!row) return '—';
    if (row.status === 'known' && Number.isFinite(Number(row.conversion_pct))) {
      return `${String(row.conversion_pct).replace('.', ',')}%`;
    }
    if (row.status === 'unknown') return 'неизвестно';
    return 'не применимо';
  }

  function stageCards(counts, note) {
    return `<div class="funnel-stage-grid current-state-grid">${STAGES.map(([key, label]) =>
      `<div class="funnel-stage-card"><span>${esc(label)}</span><strong>${num(counts?.[key])}</strong><small>${esc(note)}</small></div>`
    ).join('')}</div>`;
  }

  function renderConversions() {
    const rows = model().historical?.conversions || [];
    if (!rows.length) return '<div class="empty compact">Конверсионные метрики пока отсутствуют.</div>';
    return `<div class="historical-transition-grid">${rows.map(row => `<article class="transition-card">
      <span>${esc(CONVERSIONS[row.id] || row.id)}</span>
      <strong>${esc(conversionValue(row))}</strong>
      <small>${num(row.numerator)} из ${num(row.denominator)} · ${esc(row.status === 'unknown' ? 'доказательств недостаточно' : row.status === 'not_applicable' ? 'нулевая база' : 'доказанная конверсия')}</small>
    </article>`).join('')}</div>`;
  }

  function renderSources() {
    const source = model().dimensions?.discovery_source || {};
    const rows = source.rows || [];
    return `<div class="grid cards">
      ${metric('Связано Demand Signals', num(source.linked_demand_signals), 'только явная discovery provenance')}
      ${metric('Без атрибуции', num(source.unlinked_demand_signals), 'источник не подставляется эвристически')}
      ${metric('Лидов без атрибуции', num(source.unlinked_commercial_leads), 'остаются unlinked')}
    </div>
    ${rows.length ? `<div class="table-wrap"><table class="funnel-table"><thead><tr><th>Источник</th><th>Demand</th><th>Promotion-ready / лиды</th><th>Qualified</th><th>Handoff-ready</th><th>Основание</th></tr></thead><tbody>${rows.map(row => `<tr>
      <td>${esc(row.label || row.key)}</td>
      <td>${num(row.demand_signals)}</td>
      <td>${num(row.promotion_ready_proven)}</td>
      <td>${num(row.milestone_counts?.qualified)}</td>
      <td>${num(row.milestone_counts?.['handoff-ready'])}</td>
      <td>${esc(row.basis || 'explicit provenance')}</td>
    </tr>`).join('')}</tbody></table></div>` : '<div class="empty compact">Явно атрибутированных коммерческих Demand Signals пока нет.</div>'}`;
  }

  function renderServices() {
    const rows = model().dimensions?.service_id?.rows || [];
    if (!rows.length) return '<div class="empty compact">Канонические Commercial Leads по Service пока отсутствуют.</div>';
    return `<div class="table-wrap"><table class="funnel-table"><thead><tr><th>service_id</th><th>Лиды</th><th>Qualifying</th><th>Qualified</th><th>Handoff-ready</th><th>Текущее handoff-ready</th></tr></thead><tbody>${rows.map(row => `<tr>
      <td><code>${esc(row.key)}</code></td>
      <td>${num(row.promotion_ready_proven)}</td>
      <td>${num(row.milestone_counts?.qualifying)}</td>
      <td>${num(row.milestone_counts?.qualified)}</td>
      <td>${num(row.milestone_counts?.['handoff-ready'])}</td>
      <td>${num(row.current_state_counts?.['handoff-ready'])}</td>
    </tr>`).join('')}</tbody></table></div>`;
  }

  function renderEvidenceGaps() {
    const rows = (model().evidence_gaps || []).filter(row => num(row.count) > 0);
    if (!rows.length) return '<div class="empty compact">Явных пробелов доказательств в текущей коммерческой проекции нет.</div>';
    return `<div class="funnel-segment-grid">${rows.map(row => `<article class="funnel-segment-card">
      <header><strong>${esc(GAP_LABELS[row.code] || row.code)}</strong><span>${num(row.count)}</span></header>
      <p class="section-note">${esc(row.meaning || '')}</p>
    </article>`).join('')}</div>`;
  }

  function renderCommercialFunnel() {
    const data = model();
    const pop = data.population || {};
    const ready = pop.promotion_ready || {};
    const value = data.commercial_value || {};
    const terminal = data.historical?.terminal_outcomes?.counts || {};

    return `<div class="view-note"><strong>Отдельная коммерческая воронка.</strong> Она строится только из bounded Demand Signals и канонического Commercial Lead lifecycle. Вакансии, job-funnel и Engagement сюда не входят; неизвестные значения не превращаются в нули.</div>
      <div class="grid cards funnel-kpis">
        ${metric('Demand Signals', num(pop.demand_signals?.observed_unique), 'уникальные bounded Demand')}
        ${metric('Promotion-ready доказано', num(ready.proven), num(ready.unknown) ? `ещё ${num(ready.unknown)} — unknown` : 'по immutable Lead creation')}
        ${metric('Commercial Leads', num(pop.commercial_leads), 'канонические записи')}
        ${metric('Handoff-ready', num(data.current_state?.stage_counts?.['handoff-ready']), 'текущее состояние; не внешний action')}
      </div>

      <section class="section analytics-section">
        <div class="section-head"><div><h2>Текущее состояние Commercial Leads</h2><p class="section-note">Только текущий lifecycle_state. Исторические достижения показаны отдельно.</p></div></div>
        ${stageCards(data.current_state?.stage_counts || {}, 'текущее состояние')}
      </section>

      <section class="section analytics-section">
        <div class="section-head"><div><h2>Исторические milestones и конверсия</h2><p class="section-note">Milestones считаются один раз на лид и сохраняются при rollback. Проценты берутся из детерминированной проекции, UI их не реконструирует.</p></div></div>
        ${renderConversions()}
        <h3 class="funnel-subhead">Достигнутые milestones</h3>
        ${stageCards(data.historical?.milestone_counts || {}, 'исторически достигнуто')}
      </section>

      <section class="section analytics-section">
        <div class="section-head"><div><h2>Атрибуция discovery source</h2><p class="section-note">Downstream credit получает только явно сохранённая discovery provenance; source_name/source_url не используются как замена.</p></div></div>
        ${renderSources()}
      </section>

      <section class="section analytics-section">
        <div class="section-head"><div><h2>Сегментация по Service</h2><p class="section-note">Показывается только producer-owned service_id. Название, scope, Service Pack и pricing не копируются в Career Center.</p></div></div>
        ${renderServices()}
      </section>

      <section class="section analytics-section">
        <div class="section-head"><div><h2>Коммерческая стоимость и terminal outcomes</h2><p class="section-note">В текущем контракте хранится только known/unknown status; денежная сумма не выводится, пока канонического evidence нет.</p></div></div>
        <div class="grid cards">
          ${metric('Value status: known', num(value.known_count), 'сумма всё ещё не канонизирована')}
          ${metric('Value status: unknown', num(value.unknown_count), 'не считается нулевой выручкой')}
          ${metric('Дисквалифицировано', num(terminal.disqualified), 'исторический terminal milestone')}
          ${metric('Истекло / отозвано', num(terminal.expired) + num(terminal.withdrawn), 'исторические terminal milestones')}
        </div>
      </section>

      <section class="section analytics-section">
        <div class="section-head"><div><h2>Пробелы доказательств</h2><p class="section-note">Неизвестность сохраняется явно и не заполняется эвристиками.</p></div></div>
        ${renderEvidenceGaps()}
      </section>`;
  }

  render = function patchedRender() {
    if (currentView !== 'commercial') return originalRender();
    $('#view-title').textContent = titles.commercial;
    $('#view').innerHTML = renderCommercialFunnel();
  };
})();
