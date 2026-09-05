(() => {
  const originalRender = render;
  titles.funnel = 'Воронка поиска';

  const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const pct = (part, total) => total > 0 ? `${(part / total * 100).toFixed(1).replace('.', ',')}%` : '—';
  const safeDate = (value) => value ? fmtDate(value) : '—';

  function opportunityHasInbound(opportunity) {
    return (opportunity.interactions || []).some(interaction => interaction.direction === 'inbound');
  }

  function opportunityReachedRecruiterScreen(opportunity) {
    const stage = opportunity.current_stage || '';
    const stages = new Set([
      'recruiter-screen',
      'hiring-manager-screen',
      'technical-or-architecture-interview',
      'final-interview',
      'offer-or-contract-discussion',
      'accepted'
    ]);
    if (stages.has(stage)) return true;
    return (opportunity.interactions || []).some(interaction => {
      const text = `${interaction.title || ''} ${interaction.event || ''}`.toLowerCase();
      return text.includes('recruiter') || text.includes('hr call') || text.includes('скрининг') || text.includes('звонок с hr');
    });
  }

  function opportunityReachedTechnical(opportunity) {
    return new Set([
      'technical-or-architecture-interview',
      'final-interview',
      'offer-or-contract-discussion',
      'accepted'
    ]).has(opportunity.current_stage || '');
  }

  function opportunityReachedOffer(opportunity) {
    return new Set(['offer-or-contract-discussion', 'accepted']).has(opportunity.current_stage || '');
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

  function observedStages() {
    const opportunities = snapshot.opportunities || [];
    const registry = num(snapshot.analytics?.vacancy_count || (snapshot.vacancies || []).length);
    const real = opportunities.length;
    const inbound = opportunities.filter(opportunityHasInbound).length;
    const recruiter = opportunities.filter(opportunityReachedRecruiterScreen).length;
    const technical = opportunities.filter(opportunityReachedTechnical).length;
    const offers = opportunities.filter(opportunityReachedOffer).length;
    return [
      {label: 'В едином реестре', short: 'Вакансии', value: registry, note: 'все сохранённые вакансии'},
      {label: 'Взаимодействие начато', short: 'Контакт', value: real, note: registry ? `${pct(real, registry)} от реестра` : 'канонические opportunities'},
      {label: 'Есть входящий ответ', short: 'Ответ', value: inbound, note: real ? `${pct(inbound, real)} от взаимодействий` : 'по журналу контактов'},
      {label: 'Recruiter screen / диалог', short: 'Recruiter', value: recruiter, note: real ? `${pct(recruiter, real)} от взаимодействий` : 'по статусам и журналу'},
      {label: 'Техническое интервью', short: 'Тех. интервью', value: technical, note: recruiter ? `${pct(technical, recruiter)} от recruiter screen` : 'пока нет'},
      {label: 'Оффер / обсуждение', short: 'Оффер', value: offers, note: technical ? `${pct(offers, technical)} от тех. интервью` : 'пока нет'}
    ];
  }

  function stageCard(label, value, note = '') {
    return `<div class="funnel-stage-card"><span>${esc(label)}</span><strong>${esc(value)}</strong>${note ? `<small>${esc(note)}</small>` : ''}</div>`;
  }

  function renderGraphicFunnel() {
    const stages = observedStages();
    const max = Math.max(1, ...stages.map(stage => stage.value));
    return `<div class="visual-funnel" aria-label="Графическая воронка поиска">${stages.map((stage, index) => {
      const proportional = stage.value > 0 ? stage.value / max * 100 : 0;
      const width = stage.value > 0 ? Math.max(34, proportional) : 28;
      const previous = index ? stages[index - 1].value : 0;
      const conversion = index ? pct(stage.value, previous) : '100%';
      return `<div class="visual-funnel-row">
        <div class="visual-funnel-bar ${stage.value === 0 ? 'zero' : ''}" style="--funnel-width:${width}%">
          <strong>${stage.value}</strong><span>${esc(stage.short)}</span>
        </div>
        <div class="visual-funnel-copy">
          <strong>${esc(stage.label)}</strong>
          <span>${esc(stage.note)}</span>
          <small>${index ? `Переход с предыдущего этапа: ${conversion}` : 'База текущего реестра'}</small>
        </div>
      </div>`;
    }).join('')}</div>`;
  }

  function renderObservedFunnel() {
    const stages = observedStages();
    return `<div class="funnel-stage-grid">${stages.map(stage => stageCard(stage.label, stage.value, stage.note)).join('')}</div>`;
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

  function renderChannelOutcomes() {
    const grouped = new Map();
    for (const opportunity of snapshot.opportunities || []) {
      const channel = normalizeChannel(opportunity.source);
      if (!grouped.has(channel)) grouped.set(channel, {opportunities: 0, inbound: 0, recruiter: 0, technical: 0, offers: 0});
      const row = grouped.get(channel);
      row.opportunities += 1;
      if (opportunityHasInbound(opportunity)) row.inbound += 1;
      if (opportunityReachedRecruiterScreen(opportunity)) row.recruiter += 1;
      if (opportunityReachedTechnical(opportunity)) row.technical += 1;
      if (opportunityReachedOffer(opportunity)) row.offers += 1;
    }

    const rows = [...grouped.entries()].sort((a, b) => b[1].opportunities - a[1].opportunities || a[0].localeCompare(b[0], 'ru'));
    if (!rows.length) return '<div class="empty compact">Взаимодействия по источникам пока не зафиксированы.</div>';

    return `<div class="table-wrap"><table class="funnel-table"><thead><tr>
      <th>Источник</th><th>Opportunities</th><th>Входящие ответы</th><th>Recruiter screen</th><th>Тех. интервью</th><th>Офферы</th>
    </tr></thead><tbody>${rows.map(([channel, data]) => `<tr>
      <td>${esc(channel)}</td><td>${data.opportunities}</td><td>${data.inbound}</td><td>${data.recruiter}</td><td>${data.technical}</td><td>${data.offers}</td>
    </tr>`).join('')}</tbody></table></div>`;
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

    return `<div class="view-note">Все графики ниже строятся непосредственно из актуального snapshot Карьерного центра: applications, единого реестра вакансий и append-only automation-results. При очередной сборке сайта значения пересчитываются автоматически; отсутствующие показатели не восстанавливаются предположениями.</div>
      <div class="grid cards funnel-kpis">
        ${metric('HH: показы', hhImpressions || '—', hhRows.length ? `последний сохранённый snapshot по ${hhRows.length} резюме` : 'нет снимка')}
        ${metric('HH: просмотры', hhViews || '—', hhImpressions ? `${pct(hhViews, hhImpressions)} от показов` : 'нет данных')}
        ${metric('HH: приглашения', hhInvitations || '—', hhViews ? `${pct(hhInvitations, hhViews)} от просмотров` : 'нет данных')}
        ${metric('Реальные opportunities', (snapshot.opportunities || []).length, 'отклик, входящий контакт или иной реальный процесс')}
      </div>
      <div class="dashboard-viz-grid">
        <section class="section analytics-section viz-panel viz-panel-wide">
          <div class="section-head"><div><h2>Основная воронка поиска</h2><p class="section-note">Ширина сегмента отражает текущий объём этапа; справа показана фактическая конверсия.</p></div></div>
          ${renderGraphicFunnel()}
        </section>
        <section class="section analytics-section viz-panel">
          <div class="section-head"><div><h2>Источники вакансий</h2><p class="section-note">Распределение текущего единого реестра по зафиксированным источникам.</p></div></div>
          ${renderSourceDistribution()}
        </section>
      </div>
      <div class="section analytics-section">
        <div class="section-head"><div><h2>Эффективность каналов</h2><p class="section-note">Отдельные мини-воронки по платформам и резюме. Если площадка не предоставляет показатель, отображается «—», а не искусственный ноль.</p></div></div>
        ${renderChannelFunnels()}
      </div>
      <div class="section analytics-section">
        <div class="section-head"><div><h2>Динамика платформенных метрик</h2><p class="section-note">До 12 последних сохранённых снимков. График расширяется автоматически по мере накопления append-only истории.</p></div></div>
        ${renderTrendChart()}
      </div>
      <details class="section analytics-section details-section">
        <summary><strong>Табличная детализация</strong><span>Точные значения и история</span></summary>
        <div class="details-body">
          <h3>Наблюдаемая воронка</h3>${renderObservedFunnel()}
          <h3>Метрики площадок и резюме</h3>${renderProfileMetrics()}
          <h3>Результаты по источникам</h3>${renderChannelOutcomes()}
          <h3>История снимков</h3>${renderHistory()}
        </div>
      </details>`;
  }

  render = function patchedRender() {
    if (currentView !== 'funnel') return originalRender();
    $('#view-title').textContent = titles.funnel;
    $('#view').innerHTML = renderSearchFunnel();
  };
})();
