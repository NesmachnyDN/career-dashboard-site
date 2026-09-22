function profileSyncStatusLabel(status) {
  return ({
    synchronized: 'синхронизирован',
    outdated: 'нужно обновить',
    review_required: 'требует ревью',
    drift: 'расхождение',
    unverified: 'не проверен',
    unavailable: 'недоступен',
    invalid: 'ошибка источника',
  })[status] || status || 'неизвестно';
}

function profileSyncModeLabel(mode) {
  return ({
    desktop_browser: 'локальный браузер',
    github_repository: 'репозиторий',
    manual: 'вручную',
    web_or_repository: 'web / репозиторий',
  })[mode] || mode || 'неизвестно';
}

function renderProfileSync() {
  const data = snapshot.profile_sync || {targets: [], summary: {}};
  const all = data.targets || [];
  const needle = String(query || '').trim().toLowerCase();
  const targets = needle
    ? all.filter(item => [
        item.display_name, item.platform, item.status,
        ...(item.governed_fields || []), ...(item.source_paths || [])
      ].join(' ').toLowerCase().includes(needle))
    : all;
  const summary = data.summary || {};
  const rows = targets.map(item => {
    const url = /^https?:\/\//.test(item.profile_url || '')
      ? `<a href="${esc(item.profile_url)}" target="_blank" rel="noopener noreferrer">открыть</a>`
      : '<span class="muted">URL не зафиксирован</span>';
    const acceptance = item.runtime_acceptance === 'required'
      ? (item.adapter_ready ? 'принят' : 'ожидает live acceptance')
      : 'не требуется';
    const verified = item.last_verified_at ? esc(fmtDate(item.last_verified_at)) : 'не проверялся';
    return `<tr>
      <td><strong>${esc(item.display_name)}</strong><div class="profile-sync-sub">${esc(item.platform)}</div></td>
      <td><span class="profile-sync-status profile-sync-${esc(item.status)}">${esc(profileSyncStatusLabel(item.status))}</span><div class="profile-sync-reason">${esc(item.reason || '')}</div></td>
      <td>${esc(profileSyncModeLabel(item.publication_mode))}<div class="profile-sync-sub">read-back: ${esc(profileSyncModeLabel(item.readback_mode))}</div></td>
      <td>${esc(acceptance)}</td>
      <td>${verified}</td>
      <td>${(item.governed_fields || []).map(field => `<span class="profile-sync-field">${esc(field)}</span>`).join(' ')}</td>
      <td>${url}</td>
    </tr>`;
  }).join('');

  return `<div class="grid cards">
      ${metric('Целей', summary.target_count || 0)}
      ${metric('Синхронизировано', summary.synchronized || 0)}
      ${metric('Требуют внимания', summary.requires_attention || 0)}
      ${metric('Адаптеры без acceptance', summary.adapter_acceptance_pending || 0)}
    </div>
    <div class="section">
      <div class="section-head">
        <div>
          <h2>Профессиональные профили</h2>
          <p class="section-note">Состояние выводится из repository source + append-only read-back evidence. Отсутствие проверки не считается синхронизацией.</p>
        </div>
      </div>
      <div class="profile-sync-notice">Публикация во внешние профили требует отдельного явного разрешения. Career Center не хранит учетные данные и не выполняет запись сам.</div>
      <div class="table-wrap"><table class="profile-sync-table">
        <thead><tr><th>Канал</th><th>Состояние</th><th>Публикация</th><th>Адаптер</th><th>Последняя проверка</th><th>Поля</th><th>Профиль</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="7">Нет целей, соответствующих фильтру.</td></tr>'}</tbody>
      </table></div>
    </div>`;
}
