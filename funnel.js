(() => {
  const originalRender = render;
  titles.funnel = 'Воронка поиска';

  const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const pct = (part, total) => total > 0 ? `${(part / total * 100).toFixed(1).replace('.', ',')}%` : '—';
  const safeDate = (value) => value ? fmtDate(value) : '—';

  const STAGE_ORDER = [
    'discovered', 'captured', 'classified', 'evidence-mapped', 'qualified',
    'applied', 'recruiter-screen', 'hiring-manager-screen',
    'technical-or-architecture-interview', 'final-interview',
    'offer-or-contract-discussion', 'accepted', 'rejected', 'withdrawn', 'archived', 'unknown'
  ];
  const MILESTONES = [
    ['applied', 'Отклик'],
    ['recruiter', 'Рекрутер'],
    ['interview', 'Интервью'],
    ['offer', 'Оффер'],
    ['accepted', 'Принято']
  ];
  const TRANSITION_LABELS = {
    applied_to_recruiter: 'Отклик → рекрутер',
    recruiter_to_interview: 'Рекрутер → интервью',
    interview_to_offer: 'Интервью → оффер',
    offer_to_accepted: 'Оффер → принято'
  };
  const DIMENSIONS = [
    ['source', 'Источник обнаружения'],
    ['role_track', 'Ролевой трек'],
    ['fit_status', 'Соответствие'],
    ['recommendation', 'Рекомендация'],
    ['compensation_status', 'Компенсация']
  ];

  function funnelIntel() {
    return snapshot?.analytics?.funnel || {
      current_state: {opportunity_count: 0, stage_counts: {}, segments: {}},
      historical: {
        opportunity_count: 0,
        evidenced_opportunity_count: 0,
        missing_transition_evidence_count: 0,
        milestone_counts: {},
        transitions: [],
        segments: {}
      }
    };
  }

  function transitionById(id, transitions = funnelIntel().historical?.transitions || []) {
    return transitions.find(row => row.id === id) || null;
  }

  function conversionText(row) {
    return row && row.source_count > 0 && Number.isFinite(Number(row.conversion_pct))
      ? `${String(row.conversion_pct).replace('.', ',')}%`
      : '—';
  }

  function coverageText(evidenced, total) {
    return total > 0 ? `${evidenced} из ${total} (${pct(evidenced, total)})` : '—';
  }

  function normalizeChannel(source) {
    const value = String(source || '').toLowerCase();
    if (value.includes('hh')) return 'HH.ru';
    if (value.includes('getmatch')) return 'Getmatch';
    if (value.includes('habr')) return 'Habr Career';
    if (value.includes('linkedin')) return 'LinkedIn';
    if (value.includes('telegram')) return 'Telegram';
    if (value.includes('career') || value.includes('сайт')) return 'Сайт работодателя';
    if (value.includes('email') || value.includes('письм')) return 'Прямой контакт';
    return source && source !== 'unknown' ? source : 'Источник не зафиксирован';
  }

  function funnelSnapshots() {
    const snapshots = [];
    for (const run of snapshot?.automation?.runs || []) {
      for (const item of run.items || []) {
        const metrics = item?.details?.funnel_metrics;
        if (!metrics) continue;
        snapshots.push({
          ...metrics,
          observed_at: metrics.captured_at || run.completed_at,
          run_id: run.run_id
        });
      }
    }
    return snapshots.sort((a, b) => new Date(b.observed_at || 0) - new Date(a.observed_at || 0));
  }

  function latestProfileMetrics() {
    const latest = new Map();
    for (const record of funnelSnapshots()) {
      for (const channel of record.channels || []) {
        const key = `${channel.channel || 'unknown'}|${channel.profile || 'all'}`;
        if (!latest.has(key)) latest.set(key, {...channel, captured_at: record.observed_at});
      }
    }
    return [...latest.values()];
  }

  function currentStageRows() {
    const counts = funnelIntel().current_state?.stage_counts || {};
    const known = STAGE_ORDER.filter(stage => Object.prototype.hasOwnProperty.call(counts, stage));
    const extra = Object.keys(counts).filter(stage => !STAGE_ORDER.includes(stage)).sort((a,b) => a.localeCompare(b, 'ru'));
    return [...known, ...extra].map(stage => ({stage, count: num(counts[stage])}));
  }

  function renderCurrentState() {
    const rows = currentStageRows();
    if (!rows.length) return '<div class="empty compact">Канонические opportunities пока отсутствуют.</div>';
    return `<div class="funnel-stage-grid current-state-grid">${rows.map(row =>
      stageCard(ru(row.stage), row.count, 'текущее состояние; это не историческая конверсия')
    ).join('')}</div>`;
  }

  function renderCurrentSegments() {
    const segments = funnelIntel().current_state?.segments || {};
    return `<div class="funnel-segment-grid">${DIMENSIONS.map(([dimension, label]) => {
      const rows = segments[dimension] || [];
      return `<article class="funnel-segment-card">
        <header><strong>${esc(label)}</strong><span>текущее распределение</span></header>
        <div class="funnel-segment-list">${rows.length ? rows.map(row =>
          `<div><span>${esc(ru(row.value))}</span><strong>${num(row.count)}</strong></div>`
        ).join('') : '<div class="muted">Нет данных</div>'}</div>
      </article>`;
    }).join('')}</div>`;
  }

  function stageCard(label, value, note = '') {
    return `<div class="funnel-stage-card"><span>${esc(label)}</span><strong>${esc(value)}</strong>${note ? `<small>${esc(note)}</small>` : ''}</div>`;
  }

  function renderHistoricalFunnel() {
    const historical = funnelIntel().historical || {};
    const counts = historical.milestone_counts || {};
    const max = Math.max(1, ...MILESTONES.map(([id]) => num(counts[id])));
    return `<div class="visual-funnel" aria-label="Историческая воронка по подтверждённым переходам">${MILESTONES.map(([id, label], index) => {
      const value = num(counts[id]);
      const width = value > 0 ? Math.max(34, value / max * 100) : 28;
      const prevId = index ? MILESTONES[index - 1][0] : null;
      const transition = prevId ? transitionById(`${prevId}_to_${id}`) : null;
      const note = transition
        ? `${conversionText(transition)} · ${transition.converted_count} из ${transition.source_count} с доказанным предыдущим этапом`
        : 'зафиксированный этап после события';
      return `<div class="visual-funnel-row">
        <div class="visual-funnel-bar ${value === 0 ? 'zero' : ''}" style="--funnel-width:${width}%">
          <strong>${value}</strong><span>${esc(label)}</span>
        </div>
        <div class="visual-funnel-copy">
          <strong>${esc(label)}</strong>
          <span>${esc(note)}</span>
          <small>Только зафиксированные этапы из журнала взаимодействий; текущий статус здесь не используется.</small>
        </div>
      </div>`;
    }).join('')}</div>`;
  }

  function renderHistoricalTransitions() {
    const rows = funnelIntel().historical?.transitions || [];
    if (!rows.length) return '<div class="empty compact">Исторические переходы пока не вычислены.</div>';
    return `<div class="historical-transition-grid">${rows.map(row => `<article class="transition-card">
      <span>${esc(TRANSITION_LABELS[row.id] || row.id)}</span>
      <strong>${esc(conversionText(row))}</strong>
      <small>${row.source_count ? `${row.converted_count} из ${row.source_count}` : 'нет подтверждённой базы этапа'}</small>
    </article>`).join('')}</div>`;
  }

  function renderEvidenceCoverage() {
    const h = funnelIntel().historical || {};
    const evidenced = num(h.evidenced_opportunity_count);
    const total = num(h.opportunity_count);
    const missing = num(h.missing_transition_evidence_count);
    return `<div class="funnel-evidence-note">
      <strong>Покрытие историческими доказательствами: ${esc(coverageText(evidenced, total))}</strong>
      <span>Без зафиксированного этапа после события: ${missing}. Такие записи остаются в текущем состоянии, но не повышают историческую конверсию.</span>
    </div>`;
  }

  function metricValue(row, key) {
    const raw = row?.[key];
    return Number.isFinite(Number(raw)) ? Number(raw) : null;
  }

  function renderMiniFunnel(row) {
    const impressions = metricValue(row, 'impressions');
    const views = metricValue(row, 'views');
    const invitations = metricValue(row, 'invitations');
    const matching = metricValue(row, 'matching_vacancies') ?? metricValue(row, 'recommendations');
    const known = [impressions, views, invitations].filter(value => value !== null);
    const max = Math.max(1, ...known, matching ?? 0);
    const step = (label, value) => {
      const width = value === null ? 72 : value === 0 ? 34 : Math.max(36, value / max * 100);
      return `<div class="mini-funnel-step ${value === null ? 'unknown' : value === 0 ? 'zero' : ''}" style="--mini-width:${width}%"><strong>${value === null ? '—' : value}</strong><span>${esc(label)}</span></div>`;
    };
    const steps = matching !== null && impressions === null
      ? [step('подходящих', matching), step('просмотров', views), step('приглашений', invitations)]
      : [step('показов', impressions), step('просмотров', views), step('приглашений', invitations)];
    return `<article class="channel-funnel-card">
      <header><strong>${esc(row.channel || 'Канал')}</strong><span>${esc(row.profile || 'Профиль')}</span></header>
      <div class="mini-funnel">${steps.join('')}</div>
      <footer>${esc(safeDate(row.captured_at))}</footer>
    </article>`;
  }

  function renderChannelFunnels() {
    const rows = latestProfileMetrics().filter(row => row.channel || row.profile);
    if (!rows.length) return '<div class="empty compact">Платформенные метрики пока не зафиксированы.</div>';
    return `<div class="channel-funnel-grid">${rows.map(renderMiniFunnel).join('')}</div>`;
  }

  function renderProfileMetrics() {
    const rows = latestProfileMetrics().filter(row => row.channel || row.profile);
    if (!rows.length) return '<div class="empty compact">Платформенные метрики пока не зафиксированы.</div>';

    return `<div class="table-wrap"><table class="funnel-table"><thead><tr>
      <th>Канал</th><th>Профиль / резюме</th><th>Показы</th><th>Просмотры</th><th>Приглашения</th><th>CTR показ→просмотр</th><th>Просмотр→приглашение</th><th>Снимок</th>
    </tr></thead><tbody>${rows.map(row => {
      const impressions = metricValue(row, 'impressions');
      const views = metricValue(row, 'views');
      const invitations = metricValue(row, 'invitations');
      return `<tr>
        <td>${esc(row.channel || '—')}</td>
        <td>${esc(row.profile || '—')}</td>
        <td>${impressions ?? '—'}</td>
        <td>${views ?? '—'}</td>
        <td>${invitations ?? '—'}</td>
        <td>${esc(impressions ? pct(views || 0, impressions) : '—')}</td>
        <td>${esc(views ? pct(invitations || 0, views) : '—')}</td>
        <td>${esc(safeDate(row.captured_at))}</td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function transitionCell(rows, id) {
    return conversionText(transitionById(id, rows || []));
  }

  function renderHistoricalSegments() {
    const segments = funnelIntel().historical?.segments || {};
    return DIMENSIONS.map(([dimension, label]) => {
      const rows = segments[dimension] || [];
      if (!rows.length) return `<section class="funnel-segment-section"><h4>${esc(label)}</h4><div class="empty compact">Нет данных.</div></section>`;
      return `<section class="funnel-segment-section">
        <h4>${esc(label)}</h4>
        <div class="table-wrap"><table class="funnel-table funnel-segment-table"><thead><tr>
          <th>Сегмент</th><th>Процессы</th><th>Есть история переходов</th>
          <th>Отклик → рекрутер</th><th>Рекрутер → интервью</th><th>Интервью → оффер</th><th>Оффер → принято</th>
        </tr></thead><tbody>${rows.map(row => `<tr>
          <td>${esc(ru(row.value))}</td>
          <td>${num(row.opportunity_count)}</td>
          <td>${esc(coverageText(num(row.evidenced_opportunity_count), num(row.opportunity_count)))}</td>
          <td>${esc(transitionCell(row.transitions, 'applied_to_recruiter'))}</td>
          <td>${esc(transitionCell(row.transitions, 'recruiter_to_interview'))}</td>
          <td>${esc(transitionCell(row.transitions, 'interview_to_offer'))}</td>
          <td>${esc(transitionCell(row.transitions, 'offer_to_accepted'))}</td>
        </tr>`).join('')}</tbody></table></div>
      </section>`;
    }).join('');
  }

  function sourceDistribution() {
    const counts = new Map();
    for (const vacancy of snapshot.vacancies || []) {
      const channel = normalizeChannel(vacancy.source_name || vacancy.source || vacancy.origin);
      counts.set(channel, (counts.get(channel) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }

  function renderSourceDistribution() {
    const rows = sourceDistribution();
    const total = rows.reduce((sum, [, count]) => sum + count, 0);
    if (!total) return '<div class="empty compact">Для распределения по источникам пока нет данных.</div>';
    const colors = ['#3478f6', '#5bc99a', '#8b6cf6', '#f1a23c', '#7aa7d9', '#e56f8f', '#5cb7c5', '#9aa4b2'];
    let cursor = 0;
    const segments = rows.map(([, count], index) => {
      const start = cursor;
      cursor += count / total * 100;
      return `${colors[index % colors.length]} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
    }).join(', ');
    return `<div class="source-viz">
      <div class="source-donut" style="background:conic-gradient(${segments})"><div><strong>${total}</strong><span>вакансий</span></div></div>
      <div class="source-legend">${rows.map(([channel, count], index) => `<div><i style="background:${colors[index % colors.length]}"></i><span>${esc(channel)}</span><strong>${count}</strong><small>${pct(count, total)}</small></div>`).join('')}</div>
    </div>`;
  }

  function historySeries() {
    return funnelSnapshots().slice().reverse().slice(-12).map(record => {
      const channels = record.channels || [];
      return {
        date: record.observed_at,
        impressions: channels.reduce((sum, row) => sum + num(row.impressions), 0),
        views: channels.reduce((sum, row) => sum + num(row.views), 0),
        invitations: channels.reduce((sum, row) => sum + num(row.invitations), 0)
      };
    });
  }

  function sparkPath(values, width, height, max) {
    if (!values.length) return '';
    const step = values.length > 1 ? width / (values.length - 1) : width / 2;
    return values.map((value, index) => {
      const x = values.length > 1 ? index * step : width / 2;
      const y = height - (max ? value / max * height : 0);
      return `${index ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  }

  function renderTrendChart() {
    const rows = historySeries();
    if (!rows.length) return '<div class="empty compact">История платформенных снимков пока пуста.</div>';
    const width = 820;
    const height = 210;
    const values = rows.flatMap(row => [row.impressions, row.views, row.invitations]);
    const max = Math.max(1, ...values);
    const series = [
      ['Показы', rows.map(row => row.impressions), '#3478f6'],
      ['Просмотры', rows.map(row => row.views), '#5bc99a'],
      ['Приглашения', rows.map(row => row.invitations), '#f1a23c']
    ];
    return `<div class="trend-wrap"><svg class="trend-chart" viewBox="0 0 ${width} ${height + 42}" role="img" aria-label="Динамика платформенных метрик">
      ${[0, .25, .5, .75, 1].map(ratio => `<line x1="0" y1="${(height * ratio).toFixed(1)}" x2="${width}" y2="${(height * ratio).toFixed(1)}" class="trend-grid"/>`).join('')}
      ${series.map(([, valuesForSeries, color]) => `<path d="${sparkPath(valuesForSeries, width, height, max)}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}
      ${rows.map((row, index) => {
        const x = rows.length > 1 ? index * (width / (rows.length - 1)) : width / 2;
        return `<text x="${x.toFixed(1)}" y="${height + 30}" text-anchor="middle" class="trend-label">${esc(safeDate(row.date))}</text>`;
      }).join('')}
    </svg><div class="trend-legend">${series.map(([label,, color]) => `<span><i style="background:${color}"></i>${label}</span>`).join('')}</div></div>`;
  }

  function renderHistory() {
    const records = funnelSnapshots();
    if (!records.length) return '<div class="empty compact">История платформенных снимков пока пуста.</div>';
    return `<div class="funnel-history">${records.slice(0, 12).map(record => `<div class="funnel-history-row">
      <strong>${esc(safeDate(record.observed_at))}</strong>
      <span>${esc(record.period_label || 'Снимок метрик')}</span>
      <span>${(record.channels || []).length} проф.</span>
    </div>`).join('')}</div>`;
  }

  function renderSearchFunnel() {
    const platformRows = latestProfileMetrics();
    const hhRows = platformRows.filter(row => row.channel === 'HH.ru');
    const hhImpressions = hhRows.reduce((sum, row) => sum + num(row.impressions), 0);
    const hhViews = hhRows.reduce((sum, row) => sum + num(row.views), 0);
    const hhInvitations = hhRows.reduce((sum, row) => sum + num(row.invitations), 0);
    const h = funnelIntel().historical || {};

    return `<div class="view-note"><strong>Текущее состояние и историческая конверсия разделены.</strong> Текущий статус показывает, где процесс находится сейчас. Конверсия считается только по явно зафиксированным переходам в журнале взаимодействий; пропущенная история не восстанавливается из текущего статуса.</div>
      <div class="grid cards funnel-kpis">
        ${metric('Текущие процессы', num(funnelIntel().current_state?.opportunity_count), 'канонические записи по возможностям')}
        ${metric('С подтверждённой историей', num(h.evidenced_opportunity_count), coverageText(num(h.evidenced_opportunity_count), num(h.opportunity_count)))}
        ${metric('Без подтверждённой истории', num(h.missing_transition_evidence_count), 'не участвуют в исторической конверсии')}
        ${metric('Подтверждённые офферы', num(h.milestone_counts?.offer), 'только зафиксированные этапы')}
      </div>

      <section class="section analytics-section">
        <div class="section-head"><div><h2>Текущее состояние</h2><p class="section-note">Распределение по текущему статусу. Значения показывают состояние на момент сборки и не интерпретируются как последовательная конверсия.</p></div></div>
        ${renderCurrentState()}
        <h3 class="funnel-subhead">Текущая сегментация</h3>
        ${renderCurrentSegments()}
      </section>

      <section class="section analytics-section">
        <div class="section-head"><div><h2>Историческая воронка</h2><p class="section-note">Только доказанные этапы и переходы. Из-за пробелов в истории уровни могут быть немонотонными — это сигнал качества данных, а не повод дорисовывать историю.</p></div></div>
        ${renderEvidenceCoverage()}
        ${renderHistoricalTransitions()}
        ${renderHistoricalFunnel()}
      </section>

      <div class="dashboard-viz-grid">
        <section class="section analytics-section viz-panel viz-panel-wide">
          <div class="section-head"><div><h2>Платформенные сигналы</h2><p class="section-note">Показы, просмотры и приглашения — отдельная наблюдаемая воронка площадок; она не смешивается с конверсией процессов.</p></div></div>
          <div class="grid cards">
            ${metric('HH: показы', hhImpressions || '—', hhRows.length ? `последний сохранённый снимок по ${hhRows.length} резюме` : 'нет снимка')}
            ${metric('HH: просмотры', hhViews || '—', hhImpressions ? `${pct(hhViews, hhImpressions)} от показов` : 'нет данных')}
            ${metric('HH: приглашения', hhInvitations || '—', hhViews ? `${pct(hhInvitations, hhViews)} от просмотров` : 'нет данных')}
          </div>
        </section>
        <section class="section analytics-section viz-panel">
          <div class="section-head"><div><h2>Источники текущего реестра</h2><p class="section-note">Распределение всех сохранённых вакансий; это текущее распределение, а не конверсия.</p></div></div>
          ${renderSourceDistribution()}
        </section>
      </div>

      <div class="section analytics-section">
        <div class="section-head"><div><h2>Эффективность каналов профиля</h2><p class="section-note">Мини-воронки площадок. Отсутствующий показатель отображается как «—», а не как искусственный ноль.</p></div></div>
        ${renderChannelFunnels()}
      </div>
      <div class="section analytics-section">
        <div class="section-head"><div><h2>Динамика платформенных метрик</h2><p class="section-note">До 12 последних append-only снимков.</p></div></div>
        ${renderTrendChart()}
      </div>

      <details class="section analytics-section details-section">
        <summary><strong>Историческая сегментация и точные данные</strong><span>источник / ролевой трек / соответствие / рекомендация / компенсация</span></summary>
        <div class="details-body">
          <h3>Историческая конверсия по сегментам</h3>
          ${renderHistoricalSegments()}
          <h3>Метрики площадок и резюме</h3>${renderProfileMetrics()}
          <h3>История платформенных снимков</h3>${renderHistory()}
        </div>
      </details>`;
  }

  render = function patchedRender() {
    if (currentView !== 'funnel') return originalRender();
    $('#view-title').textContent = titles.funnel;
    $('#view').innerHTML = renderSearchFunnel();
  };
})();
