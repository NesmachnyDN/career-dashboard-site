(() => {
  const LEGACY_STORAGE_KEY = 'career-dashboard-content-status-v1';

  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (error) {
    console.warn('Не удалось удалить устаревший локальный статус контента', error);
  }

  function statusClass(status) {
    if (status === 'published') return 'status-success';
    if (status === 'dismissed') return 'status-rejected';
    return 'status-new';
  }

  function statusLabel(status) {
    if (status === 'published') return 'Опубликовано';
    if (status === 'dismissed') return 'Отклонено';
    return 'Не опубликовано';
  }

  function replaceStatusControl(control) {
    if (!(control instanceof HTMLElement)) return;
    const select = control.querySelector('select[data-content-status]');
    if (!select) return;

    const status = select.value || 'unpublished';
    const wrapper = document.createElement('span');
    wrapper.className = 'content-status-readonly';
    wrapper.setAttribute('aria-label', `Статус: ${statusLabel(status)}`);

    const label = document.createElement('span');
    label.className = 'content-status-readonly-label';
    label.textContent = 'Статус';

    const badge = document.createElement('span');
    badge.className = `status-chip ${statusClass(status)}`;
    badge.textContent = statusLabel(status);

    wrapper.append(label, badge);
    control.replaceWith(wrapper);
  }

  function enforceReadOnly(root = document) {
    root.querySelectorAll?.('.content-status-control').forEach(replaceStatusControl);
  }

  document.addEventListener('change', (event) => {
    if (event.target instanceof Element && event.target.closest('[data-content-status]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches('.content-status-control')) replaceStatusControl(node);
        enforceReadOnly(node);
      }
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (typeof window.render === 'function') {
    window.render();
  }
  enforceReadOnly();
})();
