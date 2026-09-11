function productValidationStatusLabel(status) {
  return ({
    'not-started':'не начато',
    'collecting':'идёт сбор',
    'evidence-sufficient':'достаточно пилотных данных'
  })[status] || ru(status || 'unknown');
}

function productBoundaryLabel(value) {
  return ({
    'reusable':'переиспользуемо',
    'needs-parameterization':'нужна параметризация',
    'personal':'персонально',
    'contested':'есть расхождения',
    'insufficient-evidence':'недостаточно данных'
  })[value] || ru(value || 'unknown');
}

function productFrictionSeverityLabel(value) {
  return ({low:'низкая',medium:'средняя',high:'высокая',blocking:'блокирующая'})[value] || ru(value || 'unknown');
}

function productGateReasonLabel(value) {
  return ({
    'need-at-least-3-completed-participants':'нужно минимум 3 завершённых пилота',
    'need-at-least-2-personas':'нужно минимум 2 разные персоны',
    'missing-value-score':'не у всех пилотов есть оценка ценности',
    'positive-value-signal-below-two-thirds':'менее двух третей пилотов дали оценку 4–5',
    'fewer-than-2-would-reuse-yes':'меньше двух участников готовы использовать решение повторно',
    'blocking-friction-present':'есть блокирующее трение'
  })[value] || ru(value || 'unknown');
}

function renderProductValidation() {
  const pv = snapshot.analytics?.product_validation;
  if (!pv) return '';
  const summary = pv.summary || {};
  const evidence = pv.evidence_gate || {};
  const gate = pv.monetization_gate || {};
  const friction = pv.friction || [];
  const boundaries = pv.capability_boundary || [];
  const gateReasons = (gate.reasons || []).map(productGateReasonLabel);

  const frictionRows = friction.map(item => `<tr>
    <td>${esc(item.area || 'unknown')}</td>
    <td>${esc(item.participants ?? 0)}</td>
    <td>${esc(productFrictionSeverityLabel(item.highest_severity))}</td>
  </tr>`).join('') || '<tr><td colspan="3">Трение ещё не зафиксировано.</td></tr>';

  const boundaryRows = boundaries.map(item => `<tr>
    <td>${esc(item.capability_id || 'unknown')}</td>
    <td>${esc(productBoundaryLabel(item.classification))}</td>
    <td>${esc(item.participant_evidence ?? 0)}</td>
  </tr>`).join('') || '<tr><td colspan="3">Недостаточно наблюдений для границы переиспользования.</td></tr>';

  const demoNote = snapshot.demo?.is_demo
    ? '<div class="callout"><strong>Синтетические данные.</strong> В публичной демо-версии pilot evidence создано только для демонстрации механики и не является реальной рыночной валидацией.</div>'
    : '';

  return `<div class="section analytics-section">
    <div class="section-head"><div><h2>Проверка продукта</h2><p class="section-note">Контролируемые пилоты измеряют ценность и трение до инвестиций в SaaS. Реальные участники учитываются псевдонимно; повторные сессии одного человека не увеличивают размер выборки.</p></div></div>
    ${demoNote}
    <div class="grid cards">
      ${metric('Завершено пилотов', summary.completed_participants || 0, `цель ${summary.target_cohort_min || 3}–${summary.target_cohort_max || 5}`)}
      ${metric('Персоны', summary.persona_count || 0, 'нужно минимум 2')}
      ${metric('Оценка 4–5', summary.positive_value_scores || 0, `из ${summary.scored_participants || 0} оценённых`)}
      ${metric('Готовы повторить', summary.would_reuse_yes || 0, 'ответ «да»')}
    </div>
    <div class="grid two-col">
      <div class="card">
        <h3>Evidence gate</h3>
        <p><strong>${esc(productValidationStatusLabel(pv.status))}</strong></p>
        <p class="section-note">${evidence.sufficient ? 'Минимальный объём pilot evidence собран.' : 'Данных пока недостаточно для продуктового решения.'}</p>
      </div>
      <div class="card">
        <h3>Гипотеза монетизации</h3>
        <p><strong>${gate.status === 'open' ? 'можно формулировать и тестировать' : 'заблокирована до evidence'}</strong></p>
        <p class="section-note">${gateReasons.length ? esc(gateReasons.join('; ')) : 'Открытый gate разрешает только дешёвый willingness-to-pay эксперимент, а не разработку billing/SaaS.'}</p>
      </div>
    </div>
    <div class="grid two-col">
      <div class="card">
        <h3>Главное трение</h3>
        <div class="table-wrap"><table><thead><tr><th>Область</th><th>Участники</th><th>Макс. серьёзность</th></tr></thead><tbody>${frictionRows}</tbody></table></div>
      </div>
      <div class="card">
        <h3>Граница reusable / personal</h3>
        <div class="table-wrap"><table><thead><tr><th>Capability</th><th>Классификация</th><th>Участники</th></tr></thead><tbody>${boundaryRows}</tbody></table></div>
      </div>
    </div>
    <p class="section-note">Приоритет остаётся architecture-opportunity-first. Пилотная валидация не является разрешением на multi-tenant backend, billing или смену основного карьерного трека.</p>
  </div>`;
}
