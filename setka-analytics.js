(() => {
  if (typeof renderAnalytics !== 'function') return;

  const baseRenderAnalytics = renderAnalytics;

  if (typeof RU === 'object' && RU) {
    RU['setka-monitoring'] = 'Мониторинг Сетки';
  }

  const observedTime = (value) => {
    const time = Date.parse(value || '');
    return Number.isFinite(time) ? time : 0;
  };

  const num = (value, fractionDigits = 0) => {
    if (value === null || value === undefined || value === '') return '—';
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return String(value);
    return parsed.toLocaleString('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: fractionDigits,
    });
  };

  const percent = (value) => value === null || value === undefined || value === ''
    ? '—'
    : `${num(value, 2)}%`;

  const collectionLabel = (metricItem) => {
    const mode = {
      'public-web': 'публичные данные',
      'authenticated-web': 'авторизованная статистика',
      'user-provided': 'пользовательский срез',
      'other': 'другой подтверждённый источник',
    }[metricItem.collection_mode] || metricItem.collection_mode || 'источник неизвестен';
    const status = {
      checked: 'полный срез',
      partial: 'частичный срез',
      unavailable: 'недоступно',
    }[metricItem.collection_status] || metricItem.collection_status || 'статус неизвестен';
    return `${mode} · ${status}`;
  };

  const allSetkaMetrics = () => {
    const runs = snapshot?.automation?.runs || [];
    return runs
      .flatMap(run => (run.brand_metrics || []).map(item => ({
        ...item,
        run_id: run.run_id,
        workflow: run.workflow,
        run_completed_at: run.completed_at,
      })))
      .filter(item => item.platform === 'setka')
      .sort((a, b) => observedTime(b.observed_at) - observedTime(a.observed_at));
  };

  const hasProfileMeasurement = (item) => [
    'followers', 'profile_views', 'content_views', 'reactions', 'comments', 'reposts',
    'er', 'erv', 'average_views', 'average_interactions',
  ].some(key => item[key] !== null && item[key] !== undefined);

  const contentTitleByUrl = () => {
    const result = new Map();
    const items = snapshot?.automation?.content_items || [];
    for (const item of items) {
      const urls = [item.published_url, item.target_url, item.source_url].filter(Boolean);
      for (const url of urls) {
        result.set(canonicalIdentityUrl(url), displayTitle(item.title || 'Публикация Setka'));
      }
    }
    return result;
  };

  const latestPostMetrics = (metrics) => {
    const latest = new Map();
    for (const item of metrics) {
      if (item.scope !== 'post') continue;
      const key = item.subject_id || canonicalIdentityUrl(item.subject_url || '');
      if (!key || latest.has(key)) continue;
      latest.set(key, item);
    }
    return [...latest.values()];
  };

  const profileHistoryTable = (profiles) => {
    if (!profiles.length) {
      return '<div class="empty compact">Срезов профиля Сетки пока нет.</div>';
    }
    const rows = profiles.slice(0, 12).map(item => {
      const interactions = ['reactions', 'comments', 'reposts']
        .map(key => item[key])
        .filter(value => value !== null && value !== undefined)
        .reduce((sum, value) => sum + Number(value || 0), 0);
      const hasInteractions = ['reactions', 'comments', 'reposts']
        .some(key => item[key] !== null && item[key] !== undefined);
      return `<tr>
        <td>${esc(fmtDate(item.observed_at))}</td>
        <td>${esc(collectionLabel(item))}</td>
        <td>${esc(num(item.followers))}</td>
        <td>${esc(num(item.profile_views))}</td>
        <td>${esc(num(item.content_views))}</td>
        <td>${esc(percent(item.er))}</td>
        <td>${esc(percent(item.erv))}</td>
        <td>${esc(hasInteractions ? num(interactions) : '—')}</td>
      </tr>`;
    }).join('');

    return `<div class="table-wrap"><table>
      <thead><tr><th>Срез</th><th>Источник</th><th>Подписчики</th><th>Просмотры профиля</th><th>Просмотры контента</th><th>ER</th><th>ERV</th><th>Взаимодействия</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  };

  const postsTable = (posts) => {
    if (!posts.length) {
      return '<div class="empty compact">Постовые метрики Сетки пока не собраны.</div>';
    }
    const titles = contentTitleByUrl();
    const rows = posts.slice(0, 20).map(item => {
      const canonical = canonicalIdentityUrl(item.subject_url || '');
      const title = titles.get(canonical) || 'Публикация Setka';
      const url = safeUrl(item.subject_url || '');
      const titleCell = url
        ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a>`
        : esc(title);
      return `<tr>
        <td>${titleCell}<div class="meta">${esc(collectionLabel(item))}</div></td>
        <td>${esc(fmtDate(item.published_at || item.observed_at))}</td>
        <td>${esc(num(item.views))}</td>
        <td>${esc(num(item.reactions))}</td>
        <td>${esc(num(item.comments))}</td>
        <td>${esc(num(item.reposts))}</td>
        <td>${esc(percent(item.erv))}</td>
      </tr>`;
    }).join('');

    return `<div class="table-wrap"><table>
      <thead><tr><th>Публикация</th><th>Дата</th><th>Просмотры</th><th>Реакции</th><th>Комментарии</th><th>Репосты</th><th>ERV</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  };

  function renderSetkaAnalytics() {
    const metrics = allSetkaMetrics();
    const profiles = metrics.filter(item => item.scope === 'profile');
    const latestAttempt = profiles[0] || null;
    const latest = profiles.find(hasProfileMeasurement) || latestAttempt;
    const posts = latestPostMetrics(metrics);

    if (!metrics.length) {
      return `<div class="section analytics-section">
        <div class="section-head"><div><h2>Сетка — личный бренд</h2><p class="section-note">Исторические срезы ещё не собраны. Они появятся после выполнения setka-monitoring.</p></div></div>
        <div class="empty">Нет измерений Сетки.</div>
      </div>`;
    }

    const latestMeta = latestAttempt
      ? `Последняя попытка измерения: ${fmtDate(latestAttempt.observed_at)} · ${collectionLabel(latestAttempt)}`
      : 'Срез профиля пока недоступен.';

    return `<div class="section analytics-section">
      <div class="section-head"><div><h2>Сетка — личный бренд</h2><p class="section-note">${esc(latestMeta)}. Недоступные показатели считаются неизвестными, а не нулевыми.</p></div></div>
      <div class="grid cards">
        ${metric('Подписчики', latest ? num(latest.followers) : '—')}
        ${metric('Просмотры профиля', latest ? num(latest.profile_views) : '—')}
        ${metric('Просмотры контента', latest ? num(latest.content_views) : '—')}
        ${metric('ER', latest ? percent(latest.er) : '—')}
        ${metric('ERV', latest ? percent(latest.erv) : '—')}
        ${metric('Отслеживаемых постов', posts.length)}
      </div>
      <div class="section analytics-section">
        <div class="section-head"><div><h3>Динамика профиля</h3><p class="section-note">Последние исторические срезы. Публичные и авторизованные измерения явно различаются.</p></div></div>
        <div class="card chart-card">${profileHistoryTable(profiles)}</div>
      </div>
      <div class="section analytics-section">
        <div class="section-head"><div><h3>Эффективность публикаций</h3><p class="section-note">Для каждого поста показан последний доступный срез. Таблица будет становиться точнее по мере накопления статистики.</p></div></div>
        <div class="card chart-card">${postsTable(posts)}</div>
      </div>
      <p class="section-note">Совпадение публикаций по времени с ростом просмотров профиля или входящими контактами трактуется только как корреляция, если источник контакта явно не подтверждён.</p>
    </div>`;
  }

  renderAnalytics = function renderAnalyticsWithSetka() {
    return `${baseRenderAnalytics()}${renderSetkaAnalytics()}`;
  };
})();
