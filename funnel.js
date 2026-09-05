(() => {
  const originalRender = render;
  titles.funnel = 'Воронка поиска';

  const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const pct = (part, total) => total > 0 ? `${(part / total * 100).toFixed(1).replace('.', ',')}%` : '—';

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
    if (value.includes('linkedin')) return 'LinkedIn';
    if (value.includes('telegram')) return 'Telegram';
    if (value.includes('career') || value.includes('сайт')) return 'Карьерный сайт работодателя';
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

  function stageCard(label, value, note = '') {
    return `<div class="funnel-stage-card"><span>${esc(label)}</span><strong>${esc(value)}</strong>${note ? `<small>${esc(note)}</small>` : ''}</div>`;
  }

  function renderObservedFunnel() {
    const opportunities = snapshot.opportunities || [];
    const registry = num(snapshot.analytics?.vacancy_count || (snapshot.vacancies || []).length);
    const real = opportunities.length;
    const inbound = opportunities.filter(opportunityHasInbound).length;
    const recruiter = opportunities.filter(opportunityReachedRecruiterScreen).length;
    const technical = opportunities.filter(opportunityReachedTechnical).length;
    const offers = opportunities.filter(opportunityReachedOffer).length;

    const stages = [
      ['В едином реестре', registry, 'все сохранённые вакансии'],
      ['Взаимодействие начато', real, registry ? `${pct(real, registry)} от реестра` : 'канонические opportunities'],
      ['Есть входящий ответ', inbound, real ? `${pct(inbound, real)} от взаимодействий` : 'по журналу контактов'],
      ['Recruiter screen / диалог', recruiter, real ? `${pct(recruiter, real)} от взаимодействий` : 'по статусам и журналу'],
      ['Техническое интервью', technical, recruiter ? `${pct(technical, recruiter)} от recruiter screen` : 'пока нет'],
      ['Оффер / обсуждение', offers, technical ? `${pct(offers, technical)} от тех. интервью` : 'пока нет']
    ];

    return `<div class="funnel-stage-grid">${stages.map(([label, value, note]) => stageCard(label, value, note)).join('')}</div>`;
  }

  function renderProfileMetrics() {
    const rows = latestProfileMetrics().filter(row => row.channel || row.profile);
    if (!rows.length) return '<div class="empty compact">Платформенные метрики пока не зафиксированы.</div>';

    return `<div class="table-wrap"><table class="funnel-table"><thead><tr>
      <th>Канал</th><th>Профиль / резюме</th><th>Показы</th><th>Просмотры</th><th>Приглашения</th><th>CTR показ→просмотр</th><th>Просмотр→приглашение</th><th>Снимок</th>
    </tr></thead><tbody>${rows.map(row => {
      const impressions = num(row.impressions);
      const views = num(row.views);
      const invitations = num(row.invitations);
      return `<tr>
        <td>${esc(row.channel || '—')}</td>
        <td>${esc(row.profile || '—')}</td>
        <td>${impressions || '—'}</td>
        <td>${views || '—'}</td>
        <td>${invitations || '—'}</td>
        <td>${esc(impressions ? pct(views, impressions) : '—')}</td>
        <td>${esc(views ? pct(invitations, views) : '—')}</td>
        <td>${esc(fmtDate(row.captured_at))}</td>
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

  function renderHistory() {
    const records = funnelSnapshots();
    if (!records.length) return '<div class="empty compact">История платформенных снимков пока пуста.</div>';
    return `<div class="funnel-history">${records.slice(0, 12).map(record => `<div class="funnel-history-row">
      <strong>${esc(fmtDate(record.observed_at))}</strong>
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

    return `<div class="view-note">Воронка объединяет два типа данных: платформенные snapshots (когда площадка показывает статистику) и фактические события из канонического журнала opportunities. Отсутствующие показатели не восстанавливаются предположениями.</div>
      <div class="grid cards">
        ${metric('HH: показы', hhImpressions || '—', hhRows.length ? `последний сохранённый snapshot по ${hhRows.length} резюме` : 'нет снимка')}
        ${metric('HH: просмотры', hhViews || '—', hhImpressions ? `${pct(hhViews, hhImpressions)} от показов` : 'нет данных')}
        ${metric('HH: приглашения', hhInvitations || '—', hhViews ? `${pct(hhInvitations, hhViews)} от просмотров` : 'нет данных')}
        ${metric('Реальные opportunities', (snapshot.opportunities || []).length, 'отклик, входящий контакт или иной реальный процесс')}
      </div>
      <div class="section analytics-section">
        <div class="section-head"><div><h2>Наблюдаемая воронка</h2><p class="section-note">Этапы считаются по уже зафиксированным событиям и текущим статусам. Это не ретроспективная CRM-аналитика по переходам, если история перехода не сохранена.</p></div></div>
        ${renderObservedFunnel()}
      </div>
      <div class="section analytics-section">
        <div class="section-head"><div><h2>Метрики площадок и резюме</h2><p class="section-note">Последний известный снимок по каждой паре «канал + профиль». Для площадок без доступной статистики значения не придумываются.</p></div></div>
        ${renderProfileMetrics()}
      </div>
      <div class="section analytics-section">
        <div class="section-head"><div><h2>Результаты по источникам</h2><p class="section-note">Нижняя часть воронки строится из applications/opportunity records и поэтому обновляется автоматически вместе с карьерным процессом.</p></div></div>
        ${renderChannelOutcomes()}
      </div>
      <div class="section analytics-section">
        <div class="section-head"><div><h2>История снимков</h2><p class="section-note">Новые snapshots добавляются append-only; старые значения сохраняются для сравнения динамики.</p></div></div>
        ${renderHistory()}
      </div>`;
  }

  render = function patchedRender() {
    if (currentView !== 'funnel') return originalRender();
    $('#view-title').textContent = titles.funnel;
    $('#view').innerHTML = renderSearchFunnel();
  };
})();
