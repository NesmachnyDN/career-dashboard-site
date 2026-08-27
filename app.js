let snapshot = null;
let currentView = 'today';
let query = '';
let vacancyStatusFilter = 'all';
let vacancyExactStatusFilter = 'all';
let vacancyOriginFilter = 'all';
let opportunityStatusFilter = 'all';
let opportunityExactStatusFilter = 'all';
let opportunityPage = 1;
let opportunityPageSize = 10;
const opportunityExpanded = new Set();

const $ = (s) => document.querySelector(s);
const esc = (v = '') => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const safeUrl = (url) => /^https?:\/\//i.test(url || '') ? url : '';
const fmtDate = (value) => {
  if (!value) return '—';
  if (['unknown','to-verify','none'].includes(value)) return ru(value);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:value.includes('T')?'short':undefined}).format(d);
};
const containsQuery = (obj) => !query || JSON.stringify(obj).toLowerCase().includes(query.toLowerCase());

const RU = {
  // Special values and workflow statuses
  'unknown': 'неизвестно',
  'to-verify': 'нужно уточнить',
  'none': 'нет',
  'pending': 'ожидание',
  'success': 'успешно',
  'no-findings': 'нет подходящих результатов',
  'partial': 'частично',
  'failed': 'ошибка',
  'new': 'новая',
  'reviewing': 'на рассмотрении',
  'dismissed': 'отклонена',
  'promoted': 'переведена в работу',
  'expired': 'неактуальна',

  // Priorities
  'urgent': 'срочно',
  'high': 'высокий приоритет',
  'normal': 'обычный приоритет',
  'low': 'низкий приоритет',

  // Item kinds
  'vacancy': 'вакансия',
  'side-income': 'подработка',
  'email': 'письмо',
  'post': 'публикация',
  'comment': 'комментарий',
  'brief': 'обзор',

  // Workflows
  'vacancy-market-screening': 'Поиск вакансий',
  'daily-brand-scan': 'Поиск профессионального контента',
  'historical-vacancy-backfill': 'Восстановление истории вакансий',
  'manual-vacancy-capture': 'Добавление вакансии вручную',

  // Recommendation vocabulary
  'pursue': 'рассматривать',
  'conditional': 'условно подходит',
  'low-priority': 'низкий приоритет',
  'skip': 'пропустить',
  'pursue-after-gates': 'рассматривать после проверки условий',
  'TAKE': 'брать',
  'CONSIDER': 'рассмотреть',
  'SKIP': 'пропустить',

  // Compensation and fit
  'compensation-unknown': 'компенсация неизвестна',
  'to-normalize': 'нужно нормализовать компенсацию',
  'qualified': 'подходит',
  'below-floor': 'ниже допустимого уровня',
  'not-applicable': 'не применимо',
  'not-assessed': 'не оценено',
  'weak-fit': 'слабое соответствие',
  'rejected': 'отказ',

  // Opportunity stages
  'discovered': 'найдена',
  'captured': 'зафиксирована',
  'classified': 'классифицирована',
  'evidence-mapped': 'опыт сопоставлен',
  'applied': 'отклик отправлен',
  'recruiter-screen': 'контакт с рекрутером',
  'hiring-manager-screen': 'интервью с нанимающим менеджером',
  'technical-or-architecture-interview': 'техническое / архитектурное интервью',
  'final-interview': 'финальное интервью',
  'offer-or-contract-discussion': 'обсуждение оффера / контракта',
  'accepted': 'принято',
  'withdrawn': 'отозвано',
  'archived': 'архив',

  // Как вакансия появилась
  'scheduled-search': 'автопоиск',
  'manual-search': 'нашёл сам',
  'recruiter-inbound': 'рекрутер предложил',
  'platform-inbound': 'входящее предложение с площадки',

  // Role tracks
  'architecture-first': 'архитектурный трек',
  'engineering-first': 'инженерный трек',
  'hybrid': 'гибридный трек',
  'reject': 'нецелевой трек',

  // Interaction direction and channels
  'outbound': 'исходящее',
  'inbound': 'входящее',
  'internal': 'внутреннее',
  'linkedin': 'LinkedIn',
  'phone': 'телефон',
  'telegram': 'Telegram',
  'job-platform': 'площадка вакансий',
  'website': 'сайт',
  'meeting': 'встреча',
  'other': 'другое',

  // Recovered source labels
  'Recovered listing mirror': 'Восстановленная копия объявления',
  'Get-Works / HH-derived listing': 'Get-Works / объявление на основе HH',
  'Alfa-Bank careers': 'Карьерный сайт Альфа-Банка',
  'HH.ru current matching listing': 'HH.ru — актуальная совпадающая вакансия',
  'LinkedIn post / direct contact': 'публикация в LinkedIn / прямой контакт',
  'direct recruiter email': 'прямое письмо рекрутера',

  // Vacancy titles / roles shown to the user
  'РТК-СОФТ — Корпоративный архитектор / Enterprise Architect': 'РТК-СОФТ — Корпоративный архитектор',
  'Корпоративный архитектор / Enterprise Architect': 'Корпоративный архитектор',
  'Альфа-Банк — Архитектура / Solution Architect': 'Альфа-Банк — Архитектор решений',
  'Архитектура / Solution Architect': 'Архитектор решений',
  'Т-Банк — Архитектор платёжных систем (Enterprise / Solution)': 'Т-Банк — Архитектор платёжных систем',
  'Архитектор платёжных систем (Enterprise / Solution)': 'Архитектор платёжных систем',
  'Архитектор домена Core Banking / модернизация АБС (проект ОТП Банка)': 'Архитектор домена банковского ядра / модернизация АБС (проект ОТП Банка)',

  // Current opportunity metadata
  'await Alfa-Bank review of CV and technical interview invitation': 'ожидать рассмотрения резюме Альфа-Банком и приглашения на техническое интервью',
  '500,000 RUB/month standard maximum; tax basis unknown; possible exception up to 600,000 RUB/month after Alfa-Bank interview': 'стандартный максимум — 500 000 руб./мес.; неизвестно, указана сумма до или после налогов; после интервью в Альфа-Банке возможное исключение до 600 000 руб./мес.',
  'employer range unknown; candidate stated 650,000 RUB net/month; recruiter replied that this level could not be met': 'диапазон работодателя неизвестен; кандидат указал ориентир 650 000 руб. на руки в месяц; рекрутер сообщил, что компания не сможет предложить такой уровень',

  // Current interaction titles
  'LinkedIn outreach': 'Первичное сообщение в LinkedIn',
  'Email application with CV': 'Отклик по электронной почте с резюме',
  'HR call proposed': 'Предложен звонок с рекрутером',
  'HR call slot confirmed': 'Слот звонка с рекрутером подтверждён',
  'Recruiter phone screen completed': 'Телефонный скрининг с рекрутером завершён',
  'Recruiter outreach with OTP Bank architecture roles': 'Рекрутер предложил архитектурные роли в проекте ОТП Банка',
  'Candidate reply with role preference and compensation anchor': 'Ответ кандидата с приоритетом ролей и ориентиром по компенсации',
  'Recruiter rejection on compensation': 'Отказ рекрутера из-за уровня компенсации',

  // Current interaction events and follow-ups
  'Direct LinkedIn message sent regarding the published architect-direction vacancy.': 'Отправлено прямое сообщение в LinkedIn по опубликованной вакансии архитектора направления.',
  'Application email sent regarding the published `Архитектор направления` vacancy; the message states that LinkedIn outreach was also sent the same day.': 'Отправлен отклик по электронной почте на вакансию «Архитектор направления»; в письме также указано, что в тот же день было отправлено сообщение в LinkedIn.',
  'Inbound response received proposing an HR call; a slot at `2026-08-19 15:00 MSK` is available.': 'Получен входящий ответ с предложением звонка с HR; доступен слот 19 августа 2026 года в 15:00 МСК.',
  'Confirmed availability for the HR call at `2026-08-19 15:00 MSK`.': 'Подтверждена готовность к звонку с HR 19 августа 2026 года в 15:00 МСК.',
  'Recruiter phone screen completed. Андрей Бойко clarified that the vacancy is employment through Selecty for an internal Alfa-Bank project. The employee works inside the Alfa-Bank contour with Alfa-Bank accesses while equipment is provided by Selecty. The project is related to AI-agent quality evaluation and development of new agents. Alfa-Bank architecture is organized as a separate function with its own management. The client-side selection is expected to contain one technical interview. Selecty stated a standard maximum compensation of 500,000 RUB/month, with a possible exception up to 600,000 RUB/month after a successful Alfa-Bank interview; tax basis was not confirmed.': 'Телефонный скрининг с рекрутером завершён. Андрей Бойко уточнил, что оформление предполагается через Selecty для внутреннего проекта Альфа-Банка. Работа выполняется во внутреннем контуре Альфа-Банка с соответствующими доступами, оборудование предоставляет Selecty. Проект связан с оценкой качества ИИ-агентов и разработкой новых агентов. Архитектура в Альфа-Банке выделена в отдельную функцию со своим руководством. На стороне заказчика ожидается одно техническое интервью. Selecty указал стандартный максимум 500 000 руб./мес. и возможное исключение до 600 000 руб./мес. после успешного интервью в Альфа-Банке; gross или net не уточнено.',
  'Recruiter sent four architecture positions for OTP Bank projects and asked whether the opportunity was interesting, preferred time for an HR call, compensation expectations, and possible start timing.': 'Рекрутер прислал четыре архитектурные позиции для проектов ОТП Банка и запросил подтверждение интереса, удобное время для звонка с HR, финансовые ожидания и возможный срок выхода.',
  'Dmitry confirmed interest, prioritizing the Core Banking domain architect role and also the ABS modernization architect role. He stated practical ArchiMate experience, BIAN familiarity at reference-model/self-study level without project practice, a compensation orientation of approximately 650,000 RUB net/month, willingness to agree an HR call slot, and start timing by agreement.': 'Дмитрий подтвердил интерес, указав приоритет роли архитектора домена банковского ядра и дополнительный интерес к роли по модернизации АБС. Сообщил о практическом опыте ArchiMate, знакомстве с BIAN на уровне референсной модели и самостоятельного изучения без проектного применения, ориентире по компенсации около 650 000 руб. net/мес., готовности согласовать слот звонка с HR и срок выхода по договорённости.',
  'Recruiter thanked Dmitry for the reply and stated that the company could not interest him on the financial side.': 'Рекрутер поблагодарил за ответ и сообщил, что компания не сможет заинтересовать по финансовым условиям.',
  'await response and perform follow-up if no response': 'ожидать ответ; при отсутствии ответа выполнить повторный контакт',
  'confirm 2026-08-19 15:00 MSK slot and attend HR call': 'подтвердить слот 19 августа 2026 года в 15:00 МСК и провести звонок с HR',
  'attend HR call at 2026-08-19 15:00 MSK': 'провести звонок с HR 19 августа 2026 года в 15:00 МСК',
  'await Alfa-Bank CV review and technical interview invitation': 'ожидать рассмотрения резюме Альфа-Банком и приглашения на техническое интервью',
  'Reply with role preference, compensation expectation and availability.': 'Ответить с приоритетом ролей, финансовыми ожиданиями и доступностью.',
  'Await recruiter response.': 'Ожидать ответ рекрутера.',

  // Historical vacancy descriptions
  'Сильное architecture-first совпадение. Перед существенными затратами времени нужно подтвердить фактический формат удалённой работы и approved compensation range.': 'Сильное соответствие архитектурному треку. Перед существенными затратами времени нужно подтвердить фактический формат удалённой работы и утверждённый диапазон компенсации.',
  'Архитектурная ответственность релевантна, но роль связана с ИИ-платформой. Нужно проверить обязательную глубину по федеральным ГИС, ПП РФ №676 и КИИ и убедиться, что роль не требует неподтверждённого production AI/ML ownership.': 'Архитектурная ответственность релевантна, но роль связана с ИИ-платформой. Нужно проверить обязательную глубину по федеральным ГИС, ПП РФ №676 и КИИ и убедиться, что роль не требует неподтверждённой ответственности за промышленные решения ИИ/машинного обучения.',
  'Ранее оценена как сильная architecture-first цель. Перед действием нужно заново открыть исходную вакансию и подтвердить approved compensation range; эта запись не является Selecty / OPP-2026-001.': 'Ранее оценена как сильная цель архитектурного трека. Перед действием нужно заново открыть исходную вакансию и подтвердить утверждённый диапазон компенсации; эта запись не относится к Selecty / OPP-2026-001.',
  'Solution-architecture роль с Java/Spring, Kubernetes, PostgreSQL, Kafka и архитектурной ответственностью. Совпадает с ранее сохранённой целью ДОМ.РФ; compensation не опубликована и требует отдельной квалификации.': 'Архитектурная роль с Java/Spring, Kubernetes, PostgreSQL, Kafka и архитектурной ответственностью. Совпадает с ранее сохранённой целью ДОМ.РФ; компенсация не опубликована и требует отдельной квалификации.',
  'Architecture-first роль по распределённым высоконагруженным банковским системам: архитектурные ревью, стандарты, Java/Spring, PostgreSQL/Oracle, Kafka. Compensation не опубликована и должна быть квалифицирована до tailoring.': 'Архитектурная роль по распределённым высоконагруженным банковским системам: архитектурные ревью, стандарты, Java/Spring, PostgreSQL/Oracle, Kafka. Компенсация не опубликована и должна быть квалифицирована до адаптации материалов.',
  'Ранее отмечена как CONSIDER; факта отклика или отдельного контакта с работодателем не зафиксировано.': 'Ранее отмечена как «рассмотреть»; факта отклика или отдельного контакта с работодателем не зафиксировано.',
  'Ранее пользователь просил добавить ДОМ.РФ в активный пул; отдельного отклика или recruiter interaction не зафиксировано.': 'Ранее пользователь просил добавить ДОМ.РФ в активный пул; отдельного отклика или взаимодействия с рекрутером не зафиксировано.',
  'Вакансия была сохранена в материалах прежнего поиска; факта отдельного решения, отклика или recruiter interaction не зафиксировано.': 'Вакансия была сохранена в материалах прежнего поиска; факта отдельного решения, отклика или взаимодействия с рекрутером не зафиксировано.',
  'Recoverable architecture-first vacancy discoveries from pre-dashboard August 2026 searches. Excludes vacancies with known applications/recruiter interactions; uncertainty is preserved where the original listing URL or wording could not be reconstructed reliably.': 'Восстановленные вакансии архитектурного трека из поисков августа 2026 года до появления карьерного центра. В выборку не включены вакансии с известными откликами или взаимодействиями с рекрутерами; там, где исходную ссылку или формулировку нельзя было надёжно восстановить, неопределённость сохранена.'
};

const ru = (value) => {
  if (value === null || value === undefined || value === '') return value ?? '';
  const text = String(value);
  return RU[text] || text;
};

const displayTitle = (value) => ru(value);
const displayText = (value) => ru(value);

function b64Bytes(value) {
  const raw = atob(value); const out = new Uint8Array(raw.length);
  for (let i=0;i<raw.length;i++) out[i]=raw.charCodeAt(i); return out;
}

async function decryptPayload(payload, passphrase) {
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    {name:'PBKDF2', salt:b64Bytes(payload.salt), iterations:payload.iterations, hash:'SHA-256'},
    material, {name:'AES-GCM', length:256}, false, ['decrypt']
  );
  const plain = await crypto.subtle.decrypt({name:'AES-GCM', iv:b64Bytes(payload.iv)}, key, b64Bytes(payload.ciphertext));
  return JSON.parse(new TextDecoder().decode(plain));
}

async function loadData() {
  const encrypted = await fetch('data/snapshot.encrypted.json', {cache:'no-store'});
  if (encrypted.ok) {
    const payload = await encrypted.json();
    $('#unlock').classList.remove('hidden');
    $('#unlock-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      $('#unlock-error').textContent = '';
      try {
        snapshot = await decryptPayload(payload, $('#passphrase').value);
        $('#unlock').classList.add('hidden');
        startApp();
      } catch {
        $('#unlock-error').textContent = 'Не удалось расшифровать данные. Проверьте парольную фразу.';
      }
    });
    return;
  }
  const plain = await fetch('data/snapshot.json', {cache:'no-store'});
  if (!plain.ok) throw new Error('Снимок данных карьерного центра не найден');
  snapshot = await plain.json();
  startApp();
}

function setActiveNav() {
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.view === currentView));
}

function drilldownAttrs(config = {}) {
  const attrs = [`data-drilldown-view="${esc(config.view || 'vacancies')}"`];
  if (config.statusGroup) attrs.push(`data-drilldown-status-group="${esc(config.statusGroup)}"`);
  if (config.status) attrs.push(`data-drilldown-status="${esc(config.status)}"`);
  if (config.origin) attrs.push(`data-drilldown-origin="${esc(config.origin)}"`);
  return attrs.join(' ');
}

function openDrilldown(target) {
  currentView = target.dataset.drilldownView || 'vacancies';
  query = '';
  $('#search').value = '';

  if (currentView === 'vacancies') {
    vacancyStatusFilter = target.dataset.drilldownStatusGroup || 'all';
    vacancyExactStatusFilter = target.dataset.drilldownStatus || 'all';
    vacancyOriginFilter = target.dataset.drilldownOrigin || 'all';
  }
  if (currentView === 'opportunities') {
    opportunityStatusFilter = 'all';
    opportunityExactStatusFilter = 'all';
    opportunityPage = 1;
  }

  setActiveNav();
  render();
}

function startApp() {
  $('#shell').classList.remove('hidden');
  $('#generated-at').textContent = `Снимок: ${fmtDate(snapshot.generated_at)}`;
  $('#nav').addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-view]'); if (!btn) return;
    currentView = btn.dataset.view;
    setActiveNav();
    render();
  });
  $('#search').addEventListener('input', (event) => {
    query = event.target.value.trim();
    if (currentView === 'opportunities') opportunityPage = 1;
    render();
  });
  document.addEventListener('click', async (event) => {
    const drilldown = event.target.closest('[data-drilldown-view]');
    if (drilldown) {
      openDrilldown(drilldown);
      return;
    }

    const opportunityToggle = event.target.closest('[data-opportunity-toggle]');
    if (opportunityToggle) {
      const key = opportunityToggle.dataset.opportunityToggle;
      if (opportunityExpanded.has(key)) opportunityExpanded.delete(key);
      else opportunityExpanded.add(key);
      render();
      return;
    }

    const opportunityQuickFilter = event.target.closest('[data-opportunity-status]');
    if (opportunityQuickFilter) {
      opportunityStatusFilter = opportunityQuickFilter.dataset.opportunityStatus;
      opportunityExactStatusFilter = 'all';
      opportunityPage = 1;
      render();
      return;
    }

    const opportunityPageButton = event.target.closest('[data-opportunity-page]');
    if (opportunityPageButton && !opportunityPageButton.disabled) {
      opportunityPage = Number(opportunityPageButton.dataset.opportunityPage) || 1;
      render();
      return;
    }

    const btn = event.target.closest('[data-copy]'); if (!btn) return;
    const text = decodeURIComponent(btn.dataset.copy);
    await navigator.clipboard.writeText(text);
    const before = btn.textContent; btn.textContent = 'Скопировано'; setTimeout(() => btn.textContent = before, 1200);
  });
  document.addEventListener('change', (event) => {
    const vacancyFilter = event.target.closest('[data-vacancy-filter]');
    if (vacancyFilter) {
      if (vacancyFilter.dataset.vacancyFilter === 'status') {
        vacancyStatusFilter = vacancyFilter.value;
        vacancyExactStatusFilter = 'all';
      }
      if (vacancyFilter.dataset.vacancyFilter === 'exact-status') {
        vacancyExactStatusFilter = vacancyFilter.value;
        vacancyStatusFilter = 'all';
      }
      if (vacancyFilter.dataset.vacancyFilter === 'origin') vacancyOriginFilter = vacancyFilter.value;
      render();
      return;
    }

    const opportunityFilter = event.target.closest('[data-opportunity-filter]');
    if (!opportunityFilter) return;
    if (opportunityFilter.dataset.opportunityFilter === 'exact-status') {
      opportunityExactStatusFilter = opportunityFilter.value;
      opportunityStatusFilter = 'all';
    }
    if (opportunityFilter.dataset.opportunityFilter === 'page-size') {
      opportunityPageSize = Number(opportunityFilter.value) || 10;
    }
    opportunityPage = 1;
    render();
  });
  render();
}

const titles = {today:'Сегодня',vacancies:'Все вакансии',opportunities:'Отклики / контакты',content:'Контент',inbox:'Почта и действия',analytics:'Аналитика',runs:'История запусков'};
function render() {
  $('#view-title').textContent = titles[currentView];
  const fn = {today:renderToday,vacancies:renderVacancies,opportunities:renderOpportunities,content:renderContent,inbox:renderInbox,analytics:renderAnalytics,runs:renderRuns}[currentView];
  $('#view').innerHTML = fn();
}

function metric(label, value, note='', drilldown=null) {
  const body = `<span class="metric-label">${esc(label)}</span><strong>${esc(value)}</strong>${note?`<span class="metric-note">${esc(note)}</span>`:''}`;
  if (!drilldown) return `<div class="metric">${body}</div>`;
  return `<button type="button" class="metric metric-action" ${drilldownAttrs(drilldown)} aria-label="${esc(label)}: ${esc(value)}. Открыть детали">${body}<span class="metric-link">Показать детали →</span></button>`;
}
function badge(text, cls='') { return `<span class="badge ${esc(cls)}">${esc(text)}</span>`; }
function link(label, url, cls='') { const u=safeUrl(url); return u?`<a class="${esc(cls)}" href="${esc(u)}" target="_blank" rel="noopener">${esc(label)}</a>`:''; }

function contentTypeChip(item) {
  if (item.kind === 'post') return '<span class="content-chip content-chip-post">Пост по материалу</span>';
  if (item.kind === 'comment') return '<span class="content-chip content-chip-comment">Комментарий</span>';
  if (item.kind === 'brief') return '<span class="content-chip content-chip-brief">Обзор</span>';
  return '';
}

function copyBox(text, label='Готовый текст', buttonLabel='Копировать') {
  if (!text) return '';
  return `<div class="copy-section">
    <div class="copy-label">${esc(label)}</div>
    <div class="copybox">${esc(text)}<button data-copy="${encodeURIComponent(text)}">${esc(buttonLabel)}</button></div>
  </div>`;
}

function itemCard(item) {
  const isPost = item.kind === 'post';
  const isComment = item.kind === 'comment';
  const cardClass = isPost ? ' content-card content-card-post' : isComment ? ' content-card content-card-comment' : '';
  const primaryUrl = isComment ? (item.target_url || item.source_url) : item.source_url;
  const primaryLabel = isComment ? 'Открыть обсуждение' : isPost ? 'Открыть материал' : 'Источник';
  const actions = [
    link(primaryLabel, primaryUrl, isComment ? 'primary' : ''),
    !isComment && item.target_url && item.target_url !== item.source_url ? link('Открыть площадку', item.target_url) : ''
  ].filter(Boolean).join('');
  const meta = [item.target_platform, ru(item.source_name), item.company, ru(item.role), ru(item.recommendation), item.fit_score != null ? `соответствие ${item.fit_score}%`: '', fmtDate(item.observed_at)].filter(Boolean);
  const copyLabel = isPost ? 'Готовый текст публикации — копируйте целиком' : isComment ? 'Готовый комментарий' : 'Готовый текст';
  const copyButton = isPost ? 'Скопировать пост' : isComment ? 'Скопировать комментарий' : 'Копировать';

  return `<article class="card${cardClass}">
    <div class="content-card-head">
      <div class="content-card-chips">${contentTypeChip(item)} ${item.target_platform ? `<span class="platform-chip">${esc(item.target_platform)}</span>` : ''}</div>
      <div class="meta">${badge(ru(item.priority || 'normal'), item.priority)} ${item.backfill ? badge('историческое восстановление', 'backfill') : ''}</div>
    </div>
    <h3>${esc(displayTitle(item.title))}</h3>
    ${meta.length ? `<div class="meta">${meta.map(esc).join(' · ')}</div>` : ''}
    ${item.summary?`<p class="summary">${esc(displayText(item.summary))}</p>`:''}
    ${item.compensation?`<p class="meta">Компенсация: ${esc(ru(item.compensation))}${item.compensation_status?` · ${esc(ru(item.compensation_status))}`:''}</p>`:''}
    ${copyBox(item.copy_text, copyLabel, copyButton)}
    ${actions?`<div class="actions">${actions}</div>`:''}
  </article>`;
}

function localDateKey(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function runsToday() {
  const today = localDateKey();
  return (snapshot.automation.runs || [])
    .filter(r => localDateKey(r.completed_at) === today)
    .filter(containsQuery);
}

function itemsFromRuns(runs) {
  return runs.flatMap(run => (run.items || []).map(item => ({
    ...item,
    workflow: run.workflow,
    run_id: run.run_id,
    observed_at: run.completed_at,
    backfill: Boolean(run.backfill)
  })));
}

function runTable(runs, emptyText) {
  return `<div class="table-wrap"><table><thead><tr><th>Автоматизация</th><th>Запуск</th><th>Статус</th><th>Завершено</th><th>Результаты</th><th>Итог</th></tr></thead><tbody>${runs.map(r=>`<tr><td>${esc(ru(r.workflow))}</td><td>${esc(r.run_id)}</td><td>${badge(ru(r.status), r.status)}</td><td>${esc(fmtDate(r.completed_at))}</td><td>${r.items?.length||0}</td><td>${esc(displayText(r.summary||''))}</td></tr>`).join('')||`<tr><td colspan="6">${esc(emptyText)}</td></tr>`}</tbody></table></div>`;
}

function renderToday() {
  const runs = runsToday();
  const items = itemsFromRuns(runs);
  const attention = items.filter(i => !i.backfill && ['urgent','high'].includes(i.priority));
  const failed = runs.filter(r => ['partial','failed'].includes(r.status));

  return `<div class="grid cards">
    ${metric('Запусков сегодня', runs.length)}
    ${metric('Результатов сегодня', items.length)}
    ${metric('Требуют внимания', attention.length)}
    ${metric('Частично / с ошибкой', failed.length)}
  </div>
  <div class="section">
    <div class="section-head"><h2>Запуски сегодня</h2></div>
    ${runTable(runs, 'Сегодня сохранённых запусков пока нет.')}
  </div>
  <div class="section">
    <div class="section-head"><h2>Результаты запусков сегодня</h2></div>
    ${items.length ? items.map(itemCard).join('') : '<div class="empty">Сегодня сохранённых результатов пока нет.</div>'}
  </div>
  <div class="section">
    <div class="section-head"><h2>Текущее состояние вакансий</h2></div>
    <div class="grid cards">
      ${metric('Всего вакансий', snapshot.analytics.vacancy_count || 0, '', {view:'vacancies'})}
      ${metric('К рассмотрению', snapshot.analytics.vacancy_consideration_count || 0, '', {view:'vacancies',statusGroup:'consideration'})}
      ${metric('В процессе', snapshot.analytics.vacancy_active_count || 0, '', {view:'vacancies',statusGroup:'active'})}
      ${metric('Взаимодействия', snapshot.analytics.interaction_count, '', {view:'opportunities'})}
    </div>
  </div>`;
}

function vacancyAssessment(v) {
  const parts = [];
  if (v.fit_score != null) parts.push(`соответствие ${v.fit_score}%`);
  if (v.fit_status) parts.push(ru(v.fit_status));
  if (v.recommendation) parts.push(ru(v.recommendation));
  return parts.length ? parts.join(' · ') : 'не оценено';
}

function vacancyCompensation(v) {
  const status = esc(ru(v.compensation_status || 'unknown'));
  const value = v.compensation && v.compensation !== 'unknown' ? ru(v.compensation) : '';
  return value ? `${status}<div class="cell-note">${esc(value)}</div>` : status;
}

function vacancyOrigin(v) {
  const label = ru(v.origin || 'unknown');
  const firstSeen = v.first_seen_at ? `<div class="cell-note">впервые: ${esc(fmtDate(v.first_seen_at))}</div>` : '';
  return `${badge(label, v.origin || 'unknown')}${firstSeen}`;
}

function vacancyStatus(v) {
  const interactions = v.interaction_count ? `<div class="cell-note">${v.interaction_count} взаимодействий</div>` : '';
  return `${badge(ru(v.status || 'unknown'), v.status || 'unknown')}${interactions}`;
}

function renderVacancies() {
  const allItems = (snapshot.vacancies || []).filter(containsQuery);
  const exactStatuses = [...new Set((snapshot.vacancies || []).map(v => v.status).filter(Boolean))]
    .sort((a,b)=>ru(a).localeCompare(ru(b), 'ru'));
  const items = allItems.filter(v =>
    (vacancyStatusFilter === 'all' || v.status_group === vacancyStatusFilter) &&
    (vacancyExactStatusFilter === 'all' || v.status === vacancyExactStatusFilter) &&
    (vacancyOriginFilter === 'all' || v.origin === vacancyOriginFilter)
  );
  if (!allItems.length) return '<div class="empty">Вакансий пока нет.</div>';

  return `<div class="grid cards">
    ${metric('Всего вакансий', snapshot.analytics.vacancy_count || items.length, '', {view:'vacancies'})}
    ${metric('К рассмотрению', snapshot.analytics.vacancy_consideration_count || 0, '', {view:'vacancies',statusGroup:'consideration'})}
    ${metric('В процессе', snapshot.analytics.vacancy_active_count || 0, '', {view:'vacancies',statusGroup:'active'})}
    ${metric('Закрыто', snapshot.analytics.vacancy_closed_count || 0, '', {view:'vacancies',statusGroup:'closed'})}
  </div>
  <div class="section">
    <div class="section-head"><h2>Единый список вакансий</h2></div>
    <div class="filters">
      <label>Состояние
        <select data-vacancy-filter="status">
          <option value="all" ${vacancyStatusFilter === 'all' ? 'selected' : ''}>Все</option>
          <option value="consideration" ${vacancyStatusFilter === 'consideration' ? 'selected' : ''}>К рассмотрению</option>
          <option value="active" ${vacancyStatusFilter === 'active' ? 'selected' : ''}>В процессе</option>
          <option value="closed" ${vacancyStatusFilter === 'closed' ? 'selected' : ''}>Закрытые</option>
        </select>
      </label>
      <label>Точный статус
        <select data-vacancy-filter="exact-status">
          <option value="all" ${vacancyExactStatusFilter === 'all' ? 'selected' : ''}>Все статусы</option>
          ${exactStatuses.map(status => `<option value="${esc(status)}" ${vacancyExactStatusFilter === status ? 'selected' : ''}>${esc(ru(status))}</option>`).join('')}
        </select>
      </label>
      <label>Как появилась
        <select data-vacancy-filter="origin">
          <option value="all" ${vacancyOriginFilter === 'all' ? 'selected' : ''}>Все</option>
          <option value="scheduled-search" ${vacancyOriginFilter === 'scheduled-search' ? 'selected' : ''}>Автопоиск</option>
          <option value="manual-search" ${vacancyOriginFilter === 'manual-search' ? 'selected' : ''}>Нашёл сам</option>
          <option value="recruiter-inbound" ${vacancyOriginFilter === 'recruiter-inbound' ? 'selected' : ''}>Рекрутер предложил</option>
          <option value="platform-inbound" ${vacancyOriginFilter === 'platform-inbound' ? 'selected' : ''}>Входящее с площадки</option>
        </select>
      </label>
      <span class="meta">Показано: ${items.length} из ${allItems.length}</span>
    </div>
    ${items.length ? `<div class="table-wrap">
      <table class="vacancies-table">
        <thead>
          <tr>
            <th>Статус</th>
            <th>Вакансия</th>
            <th>Как появилась</th>
            <th>Источник</th>
            <th>Оценка</th>
            <th>Компенсация</th>
            <th>Следующее действие</th>
            <th>Обновлено</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${items.map(v => `<tr>
            <td>${vacancyStatus(v)}</td>
            <td>
              <strong>${esc(v.company || '—')}</strong>
              <div>${esc(ru(v.role || v.title || '—'))}</div>
              ${v.summary ? `<div class="cell-note">${esc(displayText(v.summary))}</div>` : ''}
            </td>
            <td>${vacancyOrigin(v)}</td>
            <td>
              ${esc(ru(v.source_name || 'unknown'))}
              ${v.contact_name && v.contact_name !== 'unknown' ? `<div class="cell-note">контакт: ${esc(v.contact_name)}</div>` : ''}
            </td>
            <td>${esc(vacancyAssessment(v))}</td>
            <td>${vacancyCompensation(v)}</td>
            <td>
              ${esc(ru(v.next_action || 'none'))}
              ${v.next_action_date && !['none','unknown','to-verify'].includes(v.next_action_date) ? `<div class="cell-note">до ${esc(fmtDate(v.next_action_date))}</div>` : ''}
            </td>
            <td>${esc(fmtDate(v.last_activity_at || v.first_seen_at))}</td>
            <td>${link('Открыть', v.source_url)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : '<div class="empty">По выбранным фильтрам вакансий нет.</div>'}
    <div class="table-legend">
      <span>${badge('автопоиск', 'scheduled-search')}</span>
      <span>${badge('нашёл сам', 'manual-search')}</span>
      <span>${badge('рекрутер предложил', 'recruiter-inbound')}</span>
      <span class="meta">«Как появилась» фиксируется один раз и не меняется после отклика или ответа рекрутера.</span>
    </div>
  </div>`;
}

const OPPORTUNITY_NEW_STAGES = new Set(['discovered','captured','classified','evidence-mapped']);
const OPPORTUNITY_ACTIVE_STAGES = new Set([
  'applied','recruiter-screen','hiring-manager-screen','technical-or-architecture-interview',
  'final-interview','offer-or-contract-discussion'
]);
const OPPORTUNITY_REJECTED_STAGES = new Set(['rejected']);
const OPPORTUNITY_SUCCESS_STAGES = new Set(['accepted']);
const OPPORTUNITY_CLOSED_STAGES = new Set(['rejected','withdrawn','accepted','archived']);

function opportunityGroup(stage) {
  if (OPPORTUNITY_NEW_STAGES.has(stage)) return 'new';
  if (OPPORTUNITY_ACTIVE_STAGES.has(stage)) return 'active';
  if (OPPORTUNITY_REJECTED_STAGES.has(stage)) return 'rejected';
  if (OPPORTUNITY_SUCCESS_STAGES.has(stage)) return 'success';
  if (OPPORTUNITY_CLOSED_STAGES.has(stage)) return 'closed';
  return 'other';
}

function opportunityMatchesGroup(o, group) {
  const stage = o.current_stage || 'unknown';
  if (group === 'all') return true;
  if (group === 'closed') return OPPORTUNITY_CLOSED_STAGES.has(stage);
  return opportunityGroup(stage) === group;
}

function opportunityStatusClass(stage) {
  const group = opportunityGroup(stage);
  if (group === 'rejected') return 'status-rejected';
  if (group === 'active') return 'status-active';
  if (group === 'new') return 'status-new';
  if (group === 'success') return 'status-success';
  if (group === 'closed') return 'status-closed';
  return 'status-unknown';
}

function opportunityStatusChip(stage) {
  const value = stage || 'unknown';
  return `<span class="status-chip ${opportunityStatusClass(value)}">${esc(ru(value))}</span>`;
}

function opportunityKey(o, index) {
  return String(o.opportunity_id || o.id || o.title || `opportunity-${index}`);
}

function opportunityLastActivity(o) {
  const timestamps = [
    o.last_updated_at,
    ...(o.interactions || []).map(i => i.timestamp)
  ].filter(Boolean).map(value => new Date(value).getTime()).filter(Number.isFinite);
  return timestamps.length ? Math.max(...timestamps) : 0;
}

function opportunitySort(a,b) {
  const rank = stage => {
    const group = opportunityGroup(stage);
    if (group === 'active') return 0;
    if (group === 'new') return 1;
    if (group === 'success') return 2;
    if (group === 'rejected') return 4;
    if (group === 'closed') return 3;
    return 2;
  };
  return rank(a.current_stage) - rank(b.current_stage) || opportunityLastActivity(b) - opportunityLastActivity(a);
}

function opportunityFilterCounts(opps) {
  return {
    all: opps.length,
    active: opps.filter(o => opportunityMatchesGroup(o,'active')).length,
    new: opps.filter(o => opportunityMatchesGroup(o,'new')).length,
    rejected: opps.filter(o => opportunityMatchesGroup(o,'rejected')).length,
    closed: opps.filter(o => opportunityMatchesGroup(o,'closed')).length,
  };
}

function opportunityQuickFilters(opps) {
  const counts = opportunityFilterCounts(opps);
  const options = [
    ['all','Все'],
    ['active','В работе'],
    ['new','Новые'],
    ['rejected','Отказы'],
    ['closed','Закрытые'],
  ];
  return `<div class="status-filters" aria-label="Фильтр откликов по состоянию">${options.map(([value,label]) =>
    `<button type="button" class="status-filter ${opportunityStatusFilter === value ? 'active' : ''}" data-opportunity-status="${value}">${label}<strong>${counts[value]}</strong></button>`
  ).join('')}</div>`;
}

function opportunityPageNumbers(totalPages, page) {
  if (totalPages <= 1) return [];
  const pages = new Set([1,totalPages,page-1,page,page+1]);
  return [...pages].filter(p=>p>=1 && p<=totalPages).sort((a,b)=>a-b);
}

function opportunityPagination(total, page, totalPages) {
  if (total <= opportunityPageSize) return '';
  const pages = opportunityPageNumbers(totalPages,page);
  let previous = 0;
  const numbered = pages.map(p => {
    const gap = previous && p - previous > 1 ? '<span class="pagination-gap">…</span>' : '';
    previous = p;
    return `${gap}<button type="button" class="page-button ${p===page?'active':''}" data-opportunity-page="${p}" ${p===page?'aria-current="page"':''}>${p}</button>`;
  }).join('');
  return `<nav class="pagination" aria-label="Страницы откликов">
    <button type="button" class="page-button" data-opportunity-page="${Math.max(1,page-1)}" ${page===1?'disabled':''}>← Назад</button>
    <div class="page-numbers">${numbered}</div>
    <button type="button" class="page-button" data-opportunity-page="${Math.min(totalPages,page+1)}" ${page===totalPages?'disabled':''}>Далее →</button>
  </nav>`;
}

function interactionCountLabel(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'контакт';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'контакта';
  return 'контактов';
}

function opportunityCard(o,index) {
  const key = opportunityKey(o,index);
  const expanded = opportunityExpanded.has(key);
  const interactions = o.interactions || [];
  const interactionCount = interactions.length;
  const sourceLink = link('Исходная вакансия',o.source_url);
  const nextAction = ru(o.next_action || 'none');
  return `<article class="opportunity-card ${expanded?'expanded':''}">
    <button type="button" class="opportunity-preview" data-opportunity-toggle="${esc(key)}" aria-expanded="${expanded?'true':'false'}">
      <span class="opportunity-status">${opportunityStatusChip(o.current_stage)}</span>
      <span class="opportunity-main">
        <strong>${esc(o.company || displayTitle(o.title))}</strong>
        <span class="opportunity-role">${esc(ru(o.role || ''))}</span>
        <span class="opportunity-preview-meta">${esc(ru(o.role_track || ''))} · обновлено ${esc(fmtDate(o.last_updated_at))}</span>
      </span>
      <span class="opportunity-next">
        <small>Следующее действие:</small>
        <span>${esc(nextAction)}${o.next_action_date && !['unknown','none','to-verify'].includes(o.next_action_date) ? ` · ${esc(fmtDate(o.next_action_date))}` : ''}</span>
      </span>
      <span class="opportunity-interactions"><strong>${interactionCount}</strong><small>${interactionCountLabel(interactionCount)}</small></span>
      <span class="opportunity-toggle-label">${expanded?'Свернуть':'Развернуть'} <i class="chevron" aria-hidden="true">⌄</i></span>
    </button>
    ${expanded ? `<div class="opportunity-details">
      <div class="opportunity-detail-head">
        <div class="meta">${badge(ru(o.fit_status || 'not-assessed'), o.fit_status)} ${badge(ru(o.compensation_status || 'unknown'), o.compensation_status)}</div>
        ${sourceLink?`<div class="actions">${sourceLink}</div>`:''}
      </div>
      ${o.compensation?`<p class="meta">Компенсация: ${esc(ru(o.compensation))}</p>`:''}
      <div class="timeline">${interactions.slice().reverse().map(i=>`<div class="timeline-item"><h4>${esc(ru(i.title))}</h4><div class="meta">${esc(fmtDate(i.timestamp))} · ${esc(ru(i.direction||''))} · ${esc(ru(i.channel||''))}</div><div class="summary">${esc(displayText(i.event||''))}</div>${i.follow_up?`<div class="meta">Дальше: ${esc(ru(i.follow_up))}</div>`:''}</div>`).join('')||'<div class="meta">История взаимодействий пока пуста.</div>'}</div>
    </div>` : ''}
  </article>`;
}

function renderOpportunities() {
  const searchable = snapshot.opportunities.filter(containsQuery).sort(opportunitySort);
  if (!searchable.length) return '<div class="empty">В разделе откликов и взаимодействий пока нет подходящих записей.</div>';

  const exactStatuses = [...new Set(snapshot.opportunities.map(o=>o.current_stage).filter(Boolean))]
    .sort((a,b)=>ru(a).localeCompare(ru(b),'ru'));

  const filtered = searchable.filter(o =>
    opportunityMatchesGroup(o,opportunityStatusFilter) &&
    (opportunityExactStatusFilter === 'all' || o.current_stage === opportunityExactStatusFilter)
  );

  const totalPages = Math.max(1,Math.ceil(filtered.length / opportunityPageSize));
  opportunityPage = Math.min(opportunityPage,totalPages);
  const start = (opportunityPage - 1) * opportunityPageSize;
  const pageItems = filtered.slice(start,start + opportunityPageSize);
  const firstShown = filtered.length ? start + 1 : 0;
  const lastShown = Math.min(start + opportunityPageSize,filtered.length);

  return `<div class="view-note">Здесь показаны вакансии, по которым уже были отклики или контакты. Карточки свернуты по умолчанию, чтобы список оставался компактным; нажмите на строку, чтобы открыть полную историю. Отказы всегда начинают просмотр в свернутом состоянии.</div>
    <div class="opportunity-toolbar">
      ${opportunityQuickFilters(searchable)}
      <div class="filters opportunity-selects">
        <label>Точный статус
          <select data-opportunity-filter="exact-status">
            <option value="all" ${opportunityExactStatusFilter === 'all'?'selected':''}>Все статусы</option>
            ${exactStatuses.map(status=>`<option value="${esc(status)}" ${opportunityExactStatusFilter === status?'selected':''}>${esc(ru(status))}</option>`).join('')}
          </select>
        </label>
        <label>На странице
          <select data-opportunity-filter="page-size">
            ${[10,20,30].map(size=>`<option value="${size}" ${opportunityPageSize===size?'selected':''}>${size}</option>`).join('')}
          </select>
        </label>
      </div>
    </div>
    <div class="opportunity-list-head">
      <span>Показано ${firstShown}–${lastShown} из ${filtered.length}</span>
      <span>Сначала: вакансии в работе и новые, затем закрытые</span>
    </div>
    <div class="opportunity-list">${pageItems.map((o,index)=>opportunityCard(o,start+index)).join('') || '<div class="empty">По выбранным фильтрам откликов нет.</div>'}</div>
    ${opportunityPagination(filtered.length,opportunityPage,totalPages)}`;
}

function renderContent() {
  const items = snapshot.automation.active_items.filter(i => ['post','comment','brief'].includes(i.kind) && containsQuery(i));
  if (!items.length) return '<div class="empty">Сохранённых предложений по контенту пока нет.</div>';
  return `<div class="view-note content-legend">
    <span class="content-chip content-chip-post">Пост по материалу</span> — готовая самостоятельная публикация: копируйте весь блок целиком.
    <span class="content-chip content-chip-comment">Комментарий</span> — текст для вставки в конкретное обсуждение по кнопке «Открыть обсуждение».
  </div>${items.map(itemCard).join('')}`;
}

function renderInbox() {
  const items = snapshot.automation.active_items.filter(i => i.kind === 'email' && containsQuery(i));
  return items.length ? items.map(itemCard).join('') : '<div class="empty">Новых карьерных писем в сохранённых запусках нет.</div>';
}

const PROCESS_STAGES = [
  {label:'К рассмотрению', statusGroup:'consideration', tone:'neutral'},
  {label:'Отклик отправлен', status:'applied', tone:'info'},
  {label:'Контакт с рекрутером', status:'recruiter-screen', tone:'info'},
  {label:'Интервью с нанимающим менеджером', status:'hiring-manager-screen', tone:'accent'},
  {label:'Техническое / архитектурное интервью', status:'technical-or-architecture-interview', tone:'accent'},
  {label:'Финальное интервью', status:'final-interview', tone:'accent'},
  {label:'Оффер / контракт', status:'offer-or-contract-discussion', tone:'success'},
  {label:'Закрыто', statusGroup:'closed', tone:'danger'},
];

function stageCount(stage) {
  return (snapshot.vacancies || []).filter(v =>
    (stage.statusGroup && v.status_group === stage.statusGroup) ||
    (stage.status && v.status === stage.status)
  ).length;
}

function renderProcessStages() {
  return `<div class="stage-grid">${PROCESS_STAGES.map((stage,index) => {
    const count = stageCount(stage);
    const drilldown = {view:'vacancies',statusGroup:stage.statusGroup,status:stage.status};
    return `<button type="button" class="stage-card tone-${stage.tone}" ${drilldownAttrs(drilldown)}>
      <span class="stage-step">${index + 1}</span>
      <span class="stage-name">${esc(stage.label)}</span>
      <strong>${count}</strong>
    </button>`;
  }).join('')}</div>`;
}

function statusTone(key) {
  if (['rejected','withdrawn','dismissed','expired','archived'].includes(key)) return 'danger';
  if (['accepted','offer-or-contract-discussion','promoted'].includes(key)) return 'success';
  if (['new','reviewing','consideration'].includes(key)) return 'warning';
  if (['hiring-manager-screen','technical-or-architecture-interview','final-interview'].includes(key)) return 'accent';
  return 'info';
}

function chartTicks(max) {
  if (max <= 5) return Array.from({length:max + 1}, (_,i)=>i);
  const step = Math.ceil(max / 4);
  const ticks = [0];
  for (let value = step; value < max; value += step) ticks.push(value);
  ticks.push(max);
  return [...new Set(ticks)];
}

function bars(data, drilldownFor, toneFor = ()=>'info') {
  const entries = Object.entries(data || {}).sort((a,b)=>b[1]-a[1]);
  if (!entries.length) return '<div class="empty compact">Пока недостаточно данных для распределения.</div>';

  const max = Math.max(1, ...entries.map(([,v])=>v));
  const total = Math.max(1, entries.reduce((sum,[,v])=>sum + v, 0));
  const ticks = chartTicks(max);

  return `<div class="chart">
    <div class="chart-axis">
      <span></span>
      <span class="chart-axis-scale">${ticks.map(t=>`<i style="left:${Math.round(t/max*10000)/100}%">${t}</i>`).join('')}</span>
      <span class="chart-axis-unit">кол-во</span>
    </div>
    ${entries.map(([k,v]) => {
      const width = Math.max(v ? 3 : 0, Math.round(v/max*1000)/10);
      const pct = Math.round(v/total*100);
      const drilldown = drilldownFor ? drilldownFor(k) : null;
      const attrs = drilldown ? drilldownAttrs(drilldown) : '';
      return `<button type="button" class="chart-row tone-${toneFor(k)}" ${attrs}>
        <span class="chart-label">${esc(ru(k))}</span>
        <span class="chart-track" style="background-size:${Math.max(20,100/max)}% 100%">
          <span class="chart-bar" style="width:${width}%"></span>
        </span>
        <span class="chart-value"><strong>${v}</strong><small>${pct}%</small></span>
      </button>`;
    }).join('')}
  </div>`;
}

function renderAnalytics() {
  return `<div class="grid cards">
    ${metric('Всего вакансий',snapshot.analytics.vacancy_count || 0,'',{view:'vacancies'})}
    ${metric('К рассмотрению',snapshot.analytics.vacancy_consideration_count || 0,'',{view:'vacancies',statusGroup:'consideration'})}
    ${metric('В процессе',snapshot.analytics.vacancy_active_count || 0,'',{view:'vacancies',statusGroup:'active'})}
    ${metric('Закрыто',snapshot.analytics.vacancy_closed_count || 0,'',{view:'vacancies',statusGroup:'closed'})}
  </div>
  <div class="section analytics-section">
    <div class="section-head"><div><h2>Текущий этап процесса</h2><p class="section-note">Показано текущее положение вакансий по статусной модели. Нажмите на этап, чтобы открыть соответствующие вакансии.</p></div></div>
    ${renderProcessStages()}
  </div>
  <div class="section analytics-section">
    <div class="section-head"><div><h2>Точные статусы вакансий</h2><p class="section-note">Шкала показывает абсолютное число вакансий, справа — количество и доля. Нажатие применяет точный фильтр статуса.</p></div></div>
    <div class="card chart-card">${bars(snapshot.analytics.vacancy_status_counts, status => ({view:'vacancies',status}), statusTone)}</div>
  </div>
  <div class="section analytics-section">
    <div class="section-head"><div><h2>Как вакансии появились</h2><p class="section-note">Происхождение вакансии фиксируется отдельно от её текущего состояния.</p></div></div>
    <div class="card chart-card">${bars(snapshot.analytics.vacancy_origin_counts, origin => ({view:'vacancies',origin}), ()=>'origin')}</div>
  </div>`;
}

function renderRuns() {
  const runs = (snapshot.automation.runs || []).filter(containsQuery);
  return runTable(runs, 'Сохранённых запусков пока нет.');
}

loadData().catch((error) => {
  document.body.innerHTML = `<div class="unlock"><div class="unlock-card"><h1>Карьерный центр</h1><p class="error">${esc(error.message)}</p><p>Сначала сформируйте снимок данных карьерного центра.</p></div></div>`;
});
