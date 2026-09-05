let sideIncomeRecommendationFilter = 'all';
let sideIncomeFreshnessFilter = 'active';

function sideIncomeItems() {
  const all = (snapshot?.automation?.runs || [])
    .flatMap(run => (run.items || [])
      .filter(item => item.kind === 'side-income')
      .map(item => ({...item, workflow: run.workflow, run_id: run.run_id, observed_at: run.completed_at})))
    .sort((a,b) => new Date(b.observed_at || 0) - new Date(a.observed_at || 0));

  const newest = new Map();
  for (const item of all) {
    const key = item.dedupe_key || item.item_id || canonicalIdentityUrl(item.source_url || '') || `${item.source_name || ''}|${item.title || ''}`;
    if (!key || newest.has(key)) continue;
    newest.set(key, item);
  }
  return [...newest.values()];
}

function sideIncomeIsActive(item) {
  if (!item.expires_at) return true;
  const time = new Date(item.expires_at).getTime();
  return Number.isNaN(time) || time >= Date.now();
}

function sideIncomeStats(items) {
  const active = items.filter(sideIncomeIsActive);
  return {
    total: items.length,
    active: active.length,
    take: active.filter(i => i.recommendation === 'TAKE').length,
    consider: active.filter(i => i.recommendation === 'CONSIDER').length,
    expired: items.length - active.length,
  };
}

function sideIncomeRecommendationClass(value) {
  if (value === 'TAKE') return 'success';
  if (value === 'CONSIDER') return 'warning';
  if (value === 'SKIP') return 'danger';
  return 'normal';
}

function sideIncomeCard(item) {
  const active = sideIncomeIsActive(item);
  const meta = [
    item.source_name,
    item.source_published_at ? `опубликовано ${fmtDate(item.source_published_at)}` : '',
    item.fit_score != null ? `соответствие ${item.fit_score}%` : '',
    item.observed_at ? `найдено ${fmtDate(item.observed_at)}` : '',
  ].filter(Boolean);
  return `<article class="card">
    <div class="content-card-head">
      <div class="content-card-chips">
        <span class="content-chip content-chip-brief">Подработка</span>
        ${badge(ru(item.recommendation || 'CONSIDER'), sideIncomeRecommendationClass(item.recommendation))}
        ${badge(active ? 'актуально' : 'срок актуальности истёк', active ? 'success' : 'expired')}
      </div>
    </div>
    <h3>${esc(displayTitle(item.title || item.role || 'Задача'))}</h3>
    ${meta.length ? `<div class="meta">${meta.map(esc).join(' · ')}</div>` : ''}
    ${item.compensation ? `<p class="meta">Бюджет / ставка: ${esc(ru(item.compensation))}</p>` : ''}
    ${item.summary ? `<p class="summary">${esc(displayText(item.summary))}</p>` : ''}
    ${item.details ? `<p class="summary">${esc(displayText(typeof item.details === 'string' ? item.details : JSON.stringify(item.details)))}</p>` : ''}
    ${item.source_url ? `<div class="actions">${link('Открыть задачу ↗', item.source_url, 'primary')}</div>` : ''}
  </article>`;
}

function renderSideIncome() {
  const all = sideIncomeItems().filter(containsQuery);
  const stats = sideIncomeStats(all);
  const filtered = all.filter(item =>
    (sideIncomeRecommendationFilter === 'all' || item.recommendation === sideIncomeRecommendationFilter) &&
    (sideIncomeFreshnessFilter === 'all' || (sideIncomeFreshnessFilter === 'active' ? sideIncomeIsActive(item) : !sideIncomeIsActive(item)))
  );

  return `<div class="grid cards">
    ${metric('Актуальных задач', stats.active)}
    ${metric('Брать', stats.take)}
    ${metric('Рассмотреть', stats.consider)}
    ${metric('Всего найдено', stats.total, stats.expired ? `истекло: ${stats.expired}` : '')}
  </div>
  <div class="section">
    <div class="section-head">
      <div>
        <h2>Дополнительный заработок</h2>
        <p class="section-note">Отдельный контур коротких оплачиваемых задач: архитектура, интеграции, review, AI/LLM, RAG, automation и небольшая bounded-разработка. Не смешивается с постоянными вакансиями.</p>
      </div>
    </div>
    <div class="filters">
      <label>Рекомендация
        <select data-side-income-filter="recommendation">
          <option value="all" ${sideIncomeRecommendationFilter === 'all' ? 'selected' : ''}>Все</option>
          <option value="TAKE" ${sideIncomeRecommendationFilter === 'TAKE' ? 'selected' : ''}>Брать</option>
          <option value="CONSIDER" ${sideIncomeRecommendationFilter === 'CONSIDER' ? 'selected' : ''}>Рассмотреть</option>
          <option value="SKIP" ${sideIncomeRecommendationFilter === 'SKIP' ? 'selected' : ''}>Пропустить</option>
        </select>
      </label>
      <label>Актуальность
        <select data-side-income-filter="freshness">
          <option value="active" ${sideIncomeFreshnessFilter === 'active' ? 'selected' : ''}>Актуальные</option>
          <option value="expired" ${sideIncomeFreshnessFilter === 'expired' ? 'selected' : ''}>Истёкшие</option>
          <option value="all" ${sideIncomeFreshnessFilter === 'all' ? 'selected' : ''}>Все</option>
        </select>
      </label>
    </div>
    <div class="stack">${filtered.map(sideIncomeCard).join('') || '<div class="empty">По выбранным фильтрам задач пока нет.</div>'}</div>
  </div>`;
}

function sideIncomeAnalyticsMarkup() {
  const items = sideIncomeItems();
  const stats = sideIncomeStats(items);
  const bySource = {};
  const byRecommendation = {};
  for (const item of items.filter(sideIncomeIsActive)) {
    const source = item.source_name || 'unknown';
    bySource[source] = (bySource[source] || 0) + 1;
    const recommendation = item.recommendation || 'unknown';
    byRecommendation[recommendation] = (byRecommendation[recommendation] || 0) + 1;
  }
  return `<div class="section analytics-section" id="side-income-analytics">
    <div class="section-head"><div><h2>Дополнительный заработок</h2><p class="section-note">Текущий запас актуальных коротких платных задач и распределение по источникам.</p></div></div>
    <div class="grid cards">
      ${metric('Актуальных', stats.active)}
      ${metric('Брать', stats.take)}
      ${metric('Рассмотреть', stats.consider)}
      ${metric('Истекло', stats.expired)}
    </div>
    <div class="card chart-card"><h3>По рекомендации</h3>${bars(byRecommendation, null, statusTone)}</div>
    <div class="card chart-card"><h3>По источникам</h3>${bars(bySource, null, ()=>'origin')}</div>
  </div>`;
}

// Extend the existing dashboard without duplicating its core renderer.
titles.sideincome = 'Подработка';
const baseDashboardRender = render;
render = function extendedDashboardRender() {
  if (currentView === 'sideincome') {
    $('#view-title').textContent = titles.sideincome;
    $('#view').innerHTML = renderSideIncome();
    return;
  }
  baseDashboardRender();
  if (currentView === 'analytics' && !$('#side-income-analytics')) {
    $('#view').insertAdjacentHTML('beforeend', sideIncomeAnalyticsMarkup());
  }
};

document.addEventListener('change', (event) => {
  const filter = event.target.closest('[data-side-income-filter]');
  if (!filter) return;
  if (filter.dataset.sideIncomeFilter === 'recommendation') sideIncomeRecommendationFilter = filter.value;
  if (filter.dataset.sideIncomeFilter === 'freshness') sideIncomeFreshnessFilter = filter.value;
  if (currentView === 'sideincome') render();
});
