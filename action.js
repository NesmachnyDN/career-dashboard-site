(() => {
  const originalRender = render;
  titles.action = 'Действия';
  let actionFilter = 'all';

  const data = () => snapshot?.analytics?.action_center || {
    items: [],
    summary: {total: 0, decisions: 0, follow_ups: 0}
  };

  function dayNumber(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    return Date.UTC(year, month - 1, day) / 86400000;
  }

  function todayNumber() {
    const now = new Date();
    return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000;
  }

  function deadlineState(item) {
    const next = item.next_action || {};
    if (next.due_kind === 'to-verify') return {id: 'to-verify', label: 'срок нужно уточнить', rank: 2};
    if (next.due_kind !== 'exact') return {id: 'undated', label: 'без подтверждённого срока', rank: 4};

    const due = dayNumber(next.date);
    if (due === null) return {id: 'undated', label: 'без подтверждённого срока', rank: 4};
    const delta = due - todayNumber();
    if (delta < 0) return {id: 'overdue', label: 'просрочено', rank: 0};
    if (delta === 0) return {id: 'today', label: 'сегодня', rank: 1};
    return {id: 'upcoming', label: 'запланировано', rank: 3};
  }

  function kindLabel(kind) {
    return kind === 'decision' ? 'решение' : 'следующий шаг';
  }

  function dataQualityLabel(code) {
    return ({
      'missing-next-action': 'не задано следующее действие',
      'invalid-next-action-date': 'некорректная дата следующего действия'
    })[code] || code;
  }

  function preparationPrompt(item) {
    const next = item.next_action || {};
    const gates = (item.unresolved_gates || []).map(g => g.label).filter(Boolean);
    const lines = [
      `Подготовь следующий шаг по opportunity ${item.opportunity_id}: ${item.company} — ${item.role}.`,
      `Текущий этап: ${item.current_stage}. Каноническое следующее действие: ${next.text || 'unknown'}.`,
      `Срок: ${next.date || 'unknown'}. Рекомендация: ${item.recommendation || 'assess'}.`,
    ];
    if (gates.length) lines.push(`Незакрытые квалификационные условия: ${gates.join('; ')}.`);
    lines.push('Сначала сверяй актуальную каноническую запись opportunity в NesmachnyDN/career-branding. Если следующий шаг требует внешней коммуникации, подготовь только черновик; если это решение или подготовка к интервью — подготовь соответствующий материал. Ничего не отправляй и не меняй внешний статус без моей прямой команды.');
    return lines.join('\n');
  }

  function actionMatchesFilter(item) {
    const deadline = deadlineState(item);
    if (actionFilter === 'all') return true;
    if (actionFilter === 'overdue') return deadline.id === 'overdue';
    if (actionFilter === 'decision') return item.action_kind === 'decision';
    if (actionFilter === 'follow-up') return item.action_kind === 'follow-up';
    if (actionFilter === 'gates') return Number(item.unresolved_gate_count || 0) > 0;
    return true;
  }

  function actionSort(a, b) {
    const da = deadlineState(a);
    const db = deadlineState(b);
    if (da.rank !== db.rank) return da.rank - db.rank;
    const ad = a.next_action?.date || '9999-12-31';
    const bd = b.next_action?.date || '9999-12-31';
    if (ad !== bd) return ad.localeCompare(bd);
    if (a.action_kind !== b.action_kind) return a.action_kind === 'decision' ? -1 : 1;
    return String(a.company || '').localeCompare(String(b.company || ''), 'ru');
  }

  function filterButton(id, label, count) {
    return `<button type="button" class="action-filter ${actionFilter === id ? 'active' : ''}" data-action-filter="${esc(id)}">
      <span>${esc(label)}</span><strong>${count}</strong>
    </button>`;
  }

  function renderActionCard(item) {
    const deadline = deadlineState(item);
    const next = item.next_action || {};
    const readiness = item.tailoring_readiness?.status || 'hold';
    const gateStatus = item.compensation_gate?.status || 'unresolved';
    const gates = item.unresolved_gates || [];
    const prep = preparationPrompt(item);

    return `<article class="action-card action-${esc(deadline.id)}">
      <header class="action-card-head">
        <div>
          <div class="action-chips">
            <span class="action-chip kind-${esc(item.action_kind)}">${esc(kindLabel(item.action_kind))}</span>
            <span class="action-chip deadline-${esc(deadline.id)}">${esc(deadline.label)}</span>
          </div>
          <strong class="action-company">${esc(item.company || '—')}</strong>
          <div class="action-role">${esc(ru(item.role || '—'))}</div>
        </div>
        <div class="action-stage">${esc(ru(item.current_stage || 'unknown'))}</div>
      </header>

      <div class="action-next">
        <span>Следующее действие</span>
        <strong>${esc(ru(next.text || 'unknown'))}</strong>
        <small>${next.due_kind === 'exact' ? `до ${esc(fmtDate(next.date))}` : esc(ru(next.date || 'unknown'))}</small>
      </div>

      <div class="action-signals">
        <div><span>Рекомендация</span><strong>${esc(ru(item.recommendation || 'assess'))}</strong></div>
        <div><span>Компенсация</span><strong>${esc(ru(gateStatus))}</strong></div>
        <div><span>Готовность материалов</span><strong>${esc(ru(readiness))}</strong></div>
      </div>

      ${gates.length ? `<div class="action-gates"><strong>Незакрытые условия</strong>${gates.map(g => `<span>${esc(ru(g.label || g.kind || '—'))}</span>`).join('')}</div>` : ''}

      ${(item.data_quality || []).length ? `<div class="action-data-warning">Нужно исправить канонические данные действия: ${esc(item.data_quality.map(dataQualityLabel).join(', '))}</div>` : ''}

      <footer class="action-card-actions">
        <button type="button" data-action-open="${esc(item.opportunity_id)}">Открыть процесс</button>
        <button type="button" data-copy="${encodeURIComponent(prep)}">Скопировать задачу для подготовки</button>
      </footer>
    </article>`;
  }

  function renderActionCenter() {
    const all = (data().items || []).filter(containsQuery);
    const decorated = all.map(item => ({item, deadline: deadlineState(item)}));
    const overdue = decorated.filter(row => row.deadline.id === 'overdue').length;
    const today = decorated.filter(row => row.deadline.id === 'today').length;
    const decisions = all.filter(item => item.action_kind === 'decision').length;
    const followUps = all.filter(item => item.action_kind === 'follow-up').length;
    const gates = all.filter(item => Number(item.unresolved_gate_count || 0) > 0).length;
    const filtered = all.filter(actionMatchesFilter).sort(actionSort);

    return `<div class="view-note action-safety-note">
      Действия — оперативная очередь решений и следующих шагов. Здесь показано только то, что требует внимания сейчас: что сделать, к какому сроку и какие условия ещё не закрыты. Раздел только для чтения и ничего не отправляет автоматически.
    </div>
    <div class="grid cards action-metrics">
      ${metric('Требуют действия', all.length)}
      ${metric('Просрочено', overdue)}
      ${metric('На сегодня', today)}
      ${metric('Незакрытые условия', gates)}
    </div>
    <div class="section">
      <div class="section-head"><div><h2>Что требует внимания</h2><p class="section-note">Одно текущее действие на процесс. Полная история взаимодействий находится в разделе «Процессы».</p></div></div>
      <div class="action-filter-row">
        ${filterButton('all', 'Все', all.length)}
        ${filterButton('overdue', 'Просрочено', overdue)}
        ${filterButton('decision', 'Решения', decisions)}
        ${filterButton('follow-up', 'Следующие шаги', followUps)}
        ${filterButton('gates', 'Незакрытые условия', gates)}
      </div>
      <div class="action-list">
        ${filtered.length ? filtered.map(renderActionCard).join('') : '<div class="empty">По выбранному фильтру действий нет.</div>'}
      </div>
    </div>`;
  }

  render = function actionCenterRender() {
    if (currentView !== 'action') return originalRender();
    $('#view-title').textContent = titles.action;
    $('#view').innerHTML = renderActionCenter();
  };

  document.addEventListener('click', event => {
    const filter = event.target.closest('[data-action-filter]');
    if (filter) {
      actionFilter = filter.dataset.actionFilter || 'all';
      if (currentView === 'action') render();
      return;
    }

    const open = event.target.closest('[data-action-open]');
    if (!open) return;
    currentView = 'opportunities';
    query = open.dataset.actionOpen || '';
    $('#search').value = query;
    opportunityStatusFilter = 'all';
    opportunityExactStatusFilter = 'all';
    opportunityPage = 1;
    setActiveNav();
    render();
  });
})();
