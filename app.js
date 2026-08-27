let snapshot = null;
let currentView = 'today';
let query = '';

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

function startApp() {
  $('#shell').classList.remove('hidden');
  $('#generated-at').textContent = `Снимок: ${fmtDate(snapshot.generated_at)}`;
  $('#nav').addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-view]'); if (!btn) return;
    currentView = btn.dataset.view;
    document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b === btn));
    render();
  });
  $('#search').addEventListener('input', (event) => { query = event.target.value.trim(); render(); });
  document.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-copy]'); if (!btn) return;
    const text = decodeURIComponent(btn.dataset.copy);
    await navigator.clipboard.writeText(text);
    const before = btn.textContent; btn.textContent = 'Скопировано'; setTimeout(() => btn.textContent = before, 1200);
  });
  render();
}

const titles = {today:'Сегодня',discovered:'Найденные вакансии',opportunities:'Вакансии и взаимодействия',content:'Контент',inbox:'Почта и действия',analytics:'Аналитика',runs:'История запусков'};
function render() {
  $('#view-title').textContent = titles[currentView];
  const fn = {today:renderToday,discovered:renderDiscovered,opportunities:renderOpportunities,content:renderContent,inbox:renderInbox,analytics:renderAnalytics,runs:renderRuns}[currentView];
  $('#view').innerHTML = fn();
}

function metric(label, value, note='') { return `<div class="metric"><span class="meta">${esc(label)}</span><strong>${esc(value)}</strong><span class="meta">${esc(note)}</span></div>`; }
function badge(text, cls='') { return `<span class="badge ${esc(cls)}">${esc(text)}</span>`; }
function link(label, url) { const u=safeUrl(url); return u?`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(label)}</a>`:''; }
function copyBox(text) { if(!text) return ''; return `<div class="copybox">${esc(text)}<button data-copy="${encodeURIComponent(text)}">Копировать</button></div>`; }

function itemCard(item) {
  const actions = [link('Источник', item.source_url), link('Открыть цель', item.target_url)].filter(Boolean).join('');
  const meta = [ru(item.kind), ru(item.source_name), item.company, ru(item.role), ru(item.recommendation), item.fit_score != null ? `соответствие ${item.fit_score}%`: '', fmtDate(item.observed_at)].filter(Boolean);
  return `<article class="card">
    <div class="meta">${badge(ru(item.priority || 'normal'), item.priority)} ${meta.map(esc).join(' · ')}</div>
    <h3>${esc(displayTitle(item.title))}</h3>
    ${item.summary?`<p class="summary">${esc(displayText(item.summary))}</p>`:''}
    ${item.compensation?`<p class="meta">Компенсация: ${esc(ru(item.compensation))}${item.compensation_status?` · ${esc(ru(item.compensation_status))}`:''}</p>`:''}
    ${copyBox(item.copy_text)}
    ${actions?`<div class="actions">${actions}</div>`:''}
  </article>`;
}

function renderToday() {
  const items = snapshot.automation.active_items.filter(containsQuery);
  const urgent = items.filter(i => ['urgent','high'].includes(i.priority)).slice(0,8);
  const discoveries = items.filter(i => ['vacancy','side-income'].includes(i.kind)).slice(0,8);
  const latest = Object.values(snapshot.automation.latest_by_workflow || {}).sort((a,b)=>new Date(b.completed_at)-new Date(a.completed_at));
  return `<div class="grid cards">
    ${metric('Активные вакансии', snapshot.analytics.active_opportunity_count)}
    ${metric('Новые сигналы', items.length)}
    ${metric('Требуют внимания', urgent.length)}
    ${metric('Взаимодействия', snapshot.analytics.interaction_count)}
  </div>
  <div class="section"><div class="section-head"><h2>Приоритетные действия</h2></div>${urgent.length?urgent.map(itemCard).join(''):'<div class="empty">Срочных новых действий нет.</div>'}</div>
  <div class="section"><div class="section-head"><h2>Свежие возможности</h2></div>${discoveries.length?discoveries.map(itemCard).join(''):'<div class="empty">Новых подходящих возможностей в сохранённых запусках нет.</div>'}</div>
  <div class="section"><div class="section-head"><h2>Последние автоматизации</h2></div><div class="table-wrap"><table><thead><tr><th>Автоматизация</th><th>Статус</th><th>Завершено</th><th>Результатов</th></tr></thead><tbody>${latest.map(r=>`<tr><td>${esc(ru(r.workflow))}</td><td>${badge(ru(r.status), r.status)}</td><td>${esc(fmtDate(r.completed_at))}</td><td>${r.items?.length||0}</td></tr>`).join('')||'<tr><td colspan="4">Пока нет сохранённых запусков</td></tr>'}</tbody></table></div></div>`;
}

function discoveryStatusLabel(status) {
  return ({new:'Новая',reviewing:'На рассмотрении',dismissed:'Отклонена',promoted:'Переведена в работу',expired:'Неактуальна'})[status] || status || 'Новая';
}

function discoveryCard(item) {
  const status = item.discovery_status || 'new';
  const actions = [link('Источник', item.source_url)].filter(Boolean).join('');
  const meta = [
    item.company,
    ru(item.role),
    ru(item.recommendation),
    item.fit_score != null ? `соответствие ${item.fit_score}%` : '',
    ru(item.compensation_status),
    item.originally_seen_at ? `найдена ${fmtDate(item.originally_seen_at)}` : ''
  ].filter(Boolean);
  return `<article class="card">
    <div class="meta">${badge(discoveryStatusLabel(status), status)} ${badge(ru(item.priority || 'normal'), item.priority)} ${meta.map(esc).join(' · ')}</div>
    <h3>${esc(displayTitle(item.title))}</h3>
    ${item.summary?`<p class="summary">${esc(displayText(item.summary))}</p>`:''}
    ${item.status_reason?`<p class="meta"><strong>Статус:</strong> ${esc(displayText(item.status_reason))}</p>`:''}
    ${item.compensation?`<p class="meta">Компенсация: ${esc(ru(item.compensation))}</p>`:''}
    ${actions?`<div class="actions">${actions}</div>`:''}
  </article>`;
}

function renderDiscovered() {
  const items = (snapshot.automation.discovered_vacancies || []).filter(containsQuery);
  const actionable = items.filter(i => ['new','reviewing'].includes(i.discovery_status || 'new'));
  const historical = items.filter(i => !['new','reviewing'].includes(i.discovery_status || 'new'));
  const newCount = items.filter(i => (i.discovery_status || 'new') === 'new').length;
  const reviewingCount = items.filter(i => i.discovery_status === 'reviewing').length;

  if (!items.length) return '<div class="empty">Сохранённых найденных вакансий пока нет.</div>';

  return `<div class="grid cards">
    ${metric('Всего найдено', items.length)}
    ${metric('Новые', newCount)}
    ${metric('На рассмотрении', reviewingCount)}
    ${metric('В работе / закрыто', historical.length)}
  </div>
  <div class="section">
    <div class="section-head"><h2>К рассмотрению</h2></div>
    ${actionable.length?actionable.map(discoveryCard).join(''):'<div class="empty">Нет вакансий, ожидающих решения.</div>'}
  </div>
  <div class="section">
    <div class="section-head"><h2>История найденных вакансий</h2></div>
    ${historical.length?historical.map(discoveryCard).join(''):'<div class="empty">Исторических записей пока нет.</div>'}
  </div>`;
}

function renderOpportunities() {
  const opps = snapshot.opportunities.filter(containsQuery);
  if (!opps.length) return '<div class="empty">В разделе откликов и взаимодействий пока нет подходящих записей.</div>';
  return opps.map(o => `<article class="card">
    <div class="meta">${badge(ru(o.current_stage || 'unknown'), o.current_stage)} ${badge(ru(o.fit_status || 'not-assessed'), o.fit_status)} ${badge(ru(o.compensation_status || 'unknown'), o.compensation_status)}</div>
    <h3>${esc(o.company || displayTitle(o.title))} — ${esc(ru(o.role || ''))}</h3>
    <div class="meta">${esc(ru(o.role_track || ''))} · обновлено ${esc(fmtDate(o.last_updated_at))}</div>
    <p class="summary"><strong>Следующее действие:</strong> ${esc(ru(o.next_action || '—'))} ${o.next_action_date?`· ${esc(fmtDate(o.next_action_date))}`:''}</p>
    ${o.compensation?`<p class="meta">Компенсация: ${esc(ru(o.compensation))}</p>`:''}
    ${link('Исходная вакансия',o.source_url)?`<div class="actions">${link('Исходная вакансия',o.source_url)}</div>`:''}
    <div class="timeline">${(o.interactions||[]).slice().reverse().map(i=>`<div class="timeline-item"><h4>${esc(ru(i.title))}</h4><div class="meta">${esc(fmtDate(i.timestamp))} · ${esc(ru(i.direction||''))} · ${esc(ru(i.channel||''))}</div><div class="summary">${esc(displayText(i.event||''))}</div>${i.follow_up?`<div class="meta">Дальше: ${esc(ru(i.follow_up))}</div>`:''}</div>`).join('')||'<div class="meta">История взаимодействий пока пуста.</div>'}</div>
  </article>`).join('');
}

function renderContent() {
  const items = snapshot.automation.active_items.filter(i => ['post','comment','brief'].includes(i.kind) && containsQuery(i));
  return items.length ? items.map(itemCard).join('') : '<div class="empty">Сохранённых предложений по контенту пока нет.</div>';
}

function renderInbox() {
  const items = snapshot.automation.active_items.filter(i => i.kind === 'email' && containsQuery(i));
  return items.length ? items.map(itemCard).join('') : '<div class="empty">Новых карьерных писем в сохранённых запусках нет.</div>';
}

function bars(data) {
  const entries = Object.entries(data||{}).sort((a,b)=>b[1]-a[1]); const max=Math.max(1,...entries.map(([,v])=>v));
  return entries.map(([k,v])=>`<div class="bar-row"><span>${esc(ru(k))}</span><div class="bar"><i style="width:${Math.round(v/max*100)}%"></i></div><strong>${v}</strong></div>`).join('') || '<div class="empty">Недостаточно данных.</div>';
}
function renderAnalytics() {
  return `<div class="grid cards">${metric('Всего вакансий в работе',snapshot.analytics.opportunity_count)}${metric('Активные',snapshot.analytics.active_opportunity_count)}${metric('Найденные вакансии',snapshot.analytics.discovered_vacancy_count || 0)}${metric('К рассмотрению',snapshot.analytics.actionable_discovered_vacancy_count || 0)}</div>
  <div class="section"><h2>Воронка по стадиям</h2><div class="card">${bars(snapshot.analytics.stage_counts)}</div></div>
  <div class="section"><h2>Статусы найденных вакансий</h2><div class="card">${bars(snapshot.analytics.discovery_status_counts)}</div></div>
  <div class="section"><h2>Источники вакансий в работе</h2><div class="card">${bars(snapshot.analytics.source_counts)}</div></div>
  <div class="section"><h2>Типы текущих сигналов</h2><div class="card">${bars(snapshot.analytics.item_kind_counts)}</div></div>`;
}

function renderRuns() {
  const runs = snapshot.automation.runs.filter(containsQuery);
  return `<div class="table-wrap"><table><thead><tr><th>Автоматизация</th><th>Запуск</th><th>Статус</th><th>Завершено</th><th>Результаты</th><th>Итог</th></tr></thead><tbody>${runs.map(r=>`<tr><td>${esc(ru(r.workflow))}</td><td>${esc(r.run_id)}</td><td>${badge(ru(r.status), r.status)}</td><td>${esc(fmtDate(r.completed_at))}</td><td>${r.items?.length||0}</td><td>${esc(displayText(r.summary||''))}</td></tr>`).join('')||'<tr><td colspan="6">Сохранённых запусков пока нет.</td></tr>'}</tbody></table></div>`;
}

loadData().catch((error) => {
  document.body.innerHTML = `<div class="unlock"><div class="unlock-card"><h1>Карьерный центр</h1><p class="error">${esc(error.message)}</p><p>Сначала сформируйте снимок данных карьерного центра.</p></div></div>`;
});
