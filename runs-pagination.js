let runsPage = 1;
let runsPageSize = 10;

function runsPageNumbers(totalPages, page) {
  if (totalPages <= 1) return [];
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  return [...pages].filter(p => p >= 1 && p <= totalPages).sort((a, b) => a - b);
}

function runsPagination(total, page, totalPages) {
  if (total <= runsPageSize) return '';
  const pages = runsPageNumbers(totalPages, page);
  let previous = 0;
  const numbered = pages.map(p => {
    const gap = previous && p - previous > 1 ? '<span class="pagination-gap">…</span>' : '';
    previous = p;
    return `${gap}<button type="button" class="page-button ${p === page ? 'active' : ''}" data-runs-page="${p}" ${p === page ? 'aria-current="page"' : ''}>${p}</button>`;
  }).join('');

  return `<nav class="pagination" aria-label="Страницы истории запусков">
    <button type="button" class="page-button" data-runs-page="${Math.max(1, page - 1)}" ${page === 1 ? 'disabled' : ''}>← Назад</button>
    <div class="page-numbers">${numbered}</div>
    <button type="button" class="page-button" data-runs-page="${Math.min(totalPages, page + 1)}" ${page === totalPages ? 'disabled' : ''}>Далее →</button>
  </nav>`;
}

function renderRuns() {
  const runs = (snapshot.automation.runs || []).filter(containsQuery);
  if (!runs.length) return '<div class="empty">Сохранённых запусков пока нет.</div>';

  const totalPages = Math.max(1, Math.ceil(runs.length / runsPageSize));
  runsPage = Math.min(runsPage, totalPages);
  const start = (runsPage - 1) * runsPageSize;
  const pageItems = runs.slice(start, start + runsPageSize);
  const firstShown = start + 1;
  const lastShown = Math.min(start + runsPageSize, runs.length);

  return `<div class="runs-toolbar">
      <div class="runs-list-head">
        <span>Показано ${firstShown}–${lastShown} из ${runs.length}</span>
      </div>
      <div class="filters runs-selects">
        <label>На странице
          <select data-runs-filter="page-size">
            ${[10, 20, 30].map(size => `<option value="${size}" ${runsPageSize === size ? 'selected' : ''}>${size}</option>`).join('')}
          </select>
        </label>
      </div>
    </div>
    ${runTable(pageItems, 'Сохранённых запусков пока нет.')}
    ${runsPagination(runs.length, runsPage, totalPages)}`;
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-runs-page]');
  if (!button || button.disabled) return;
  runsPage = Number(button.dataset.runsPage) || 1;
  if (currentView === 'runs') render();
});

document.addEventListener('change', (event) => {
  const select = event.target.closest('[data-runs-filter="page-size"]');
  if (!select) return;
  runsPageSize = Number(select.value) || 10;
  runsPage = 1;
  if (currentView === 'runs') render();
});
