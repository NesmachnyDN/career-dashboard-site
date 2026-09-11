(() => {
  if (typeof renderAnalytics !== 'function') return;

  const baseRenderAnalytics = renderAnalytics;

  const num = (value, fractionDigits = 0) => {
    if (value === null || value === undefined || value === '') return '—';
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return String(value);
    return parsed.toLocaleString('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: fractionDigits,
    });
  };

  const evidenceLabel = (value) => ({
    insufficient: 'недостаточно данных',
    'very-low': 'очень мало данных',
    low: 'низкая уверенность',
    moderate: 'умеренная уверенность',
  }[value] || value || 'недостаточно данных');

  const correlationLabel = (value) => ({
    'insufficient-data': 'сопоставление пока невозможно',
    'engagement-only': 'есть только engagement-сигнал',
    'profile-coincidence': 'есть профильный сигнал по времени',
    'engagement-and-profile-coincidence': 'есть engagement и профильный сигнал',
  }[value] || value || 'сопоставление пока невозможно');

  const platformLabel = (value) => ({
    setka: 'Сетка',
    linkedin: 'LinkedIn',
    other: 'Другое',
  }[String(value || '').toLowerCase()] || value || '—');

  const platformSummary = (platforms) => Object.entries(platforms || {})
    .filter(([, count]) => Number(count) > 0)
    .map(([platform, count]) => `${platformLabel(platform)}: ${num(count)}`)
    .join(' · ') || '—';

  const profileDelta = (topic) => {
    const parts = [];
    if (topic.avg_profile_views_delta !== null && topic.avg_profile_views_delta !== undefined) {
      parts.push(`просмотры профиля ${topic.avg_profile_views_delta >= 0 ? '+' : ''}${num(topic.avg_profile_views_delta, 1)}`);
    }
    if (topic.avg_followers_delta !== null && topic.avg_followers_delta !== undefined) {
      parts.push(`подписчики ${topic.avg_followers_delta >= 0 ? '+' : ''}${num(topic.avg_followers_delta, 1)}`);
    }
    if (topic.avg_content_views_delta !== null && topic.avg_content_views_delta !== undefined) {
      parts.push(`просмотры контента ${topic.avg_content_views_delta >= 0 ? '+' : ''}${num(topic.avg_content_views_delta, 1)}`);
    }
    return parts.join(' · ') || '—';
  };

  function renderBrandIntelligence() {
    const intelligence = snapshot?.analytics?.brand_intelligence;
    if (!intelligence) return '';

    const topics = Array.isArray(intelligence.topics) ? intelligence.topics : [];
    const visibleTopics = topics.filter(topic => Number(topic.published_posts || 0) > 0);
    const methodology = intelligence.methodology || {};

    if (!visibleTopics.length) {
      return `<div class="section analytics-section">
        <div class="section-head"><div><h2>Темы профессионального контента</h2><p class="section-note">Таксономия включена, но опубликованного контента с явной темой пока недостаточно для сравнения.</p></div></div>
        <div class="empty">Новые публикации будут попадать сюда после присвоения нормализованной темы и появления измеримых метрик.</div>
      </div>`;
    }

    const rows = visibleTopics.map(topic => `<tr>
      <td>
        <strong>${esc(topic.label || topic.topic_id || 'Тема')}</strong>
        <div class="meta">${esc(topic.description || '')}</div>
        <div class="meta">${esc(platformSummary(topic.platforms))}</div>
      </td>
      <td>${esc(num(topic.published_posts))}</td>
      <td>${esc(num(topic.linked_post_metrics))}</td>
      <td>${esc(num(topic.avg_views, 1))}</td>
      <td>${topic.avg_erv === null || topic.avg_erv === undefined ? '—' : esc(`${num(topic.avg_erv, 2)}%`)}</td>
      <td>${esc(num(topic.avg_interactions_per_1000_views, 1))}</td>
      <td>
        ${esc(num(topic.profile_signal_pairs))}
        <div class="meta">${esc(profileDelta(topic))}</div>
      </td>
      <td>
        <span class="signal-chip">${esc(evidenceLabel(topic.evidence_strength))}</span>
        <div class="meta">${esc(correlationLabel(topic.correlation_status))}</div>
      </td>
    </tr>`).join('');

    return `<div class="section analytics-section">
      <div class="section-head"><div>
        <h2>Темы профессионального контента</h2>
        <p class="section-note">Сравнение строится только по опубликованным материалам с явной темой. Старый неклассифицированный контент и недоступные метрики не превращаются в нули.</p>
      </div></div>
      <div class="grid cards">
        ${metric('Опубликованных постов с темой', intelligence.classified_published_posts || 0)}
        ${metric('Без классификации', intelligence.unclassified_published_posts || 0)}
        ${metric('С измеримым engagement', intelligence.posts_with_engagement || 0)}
        ${metric('Чистых профильных пар', intelligence.profile_signal_pairs || 0)}
      </div>
      <div class="card chart-card">
        <div class="table-wrap"><table>
          <thead><tr>
            <th>Тема</th>
            <th>Публикаций</th>
            <th>Постовых метрик</th>
            <th>Ср. просмотры</th>
            <th>Ср. ERV</th>
            <th>Взаимодействий / 1000 просмотров</th>
            <th>Профильный сигнал</th>
            <th>Надёжность</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>
      <p class="section-note">Метод: ${esc(methodology.claim_mode_label || 'наблюдательное сопоставление')}. Профильный сигнал учитывается только при сопоставимых срезах до/после публикации и отсутствии другой опубликованной записи между ними. Совпадение по времени не доказывает, что публикация вызвала изменение метрик.</p>
    </div>`;
  }

  renderAnalytics = function renderAnalyticsWithBrandIntelligence() {
    return `${baseRenderAnalytics()}${renderBrandIntelligence()}`;
  };
})();
