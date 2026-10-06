/* TRENZO — кабинет тренера. Навигация повторяет архитектуру athlete;
   доступ к данным изолирован за trainerStore. */
const trainerUI = {
  route: { page: 'today' }, history: [], search: '', clientFilter: 'all', reviewFilter: 'all',
  programFilter: 'mine', modal: null, draft: null, editorWeek: 0, messages: [], tasks: [], chatMessages: {}, workspaceStorage: null, workspaceKey: '', toastTimer: null
};
const trainerStatusLabels = { ok: 'Всё по плану', attention: 'Требует внимания', waiting: 'Ждёт решения', inactive: 'Нет активности' };
const trainerReviewLabels = { new: 'Новый', requires_action: 'Требует решения', approved: 'Готово', dismissed: 'Готово' };
const trainerIcons = {
  home: '<path d="m3 10 9-7 9 7M5 9v11h14V9M9 20v-6h6v6"/>',
  today: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2 2M16.4 16.4l2 2M5.6 18.4l2-2M16.4 7.6l2-2"/><circle cx="12" cy="12" r="4"/>',
  clients: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M19 14a5 5 0 0 1 2 4v2"/>',
  clientsSolid: '<circle cx="12" cy="7.5" r="3.3"/><circle cx="5.2" cy="10" r="2.5"/><circle cx="18.8" cy="10" r="2.5"/><path d="M5.5 20v-1.7a6.5 6.5 0 0 1 13 0V20zM1.7 19v-1.2a3.7 3.7 0 0 1 4.7-3.6M22.3 19v-1.2a3.7 3.7 0 0 0-4.7-3.6"/>',
  reviews: '<rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h3"/>',
  programs: '<path d="M3 9v6M6 6v12M9 10v4M9 12h6M15 10v4M18 6v12M21 9v6"/>',
  analytics: '<path d="M4 20v-6M10 20V9M16 20V5M22 20V2"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  ai: '<path d="m12 3 2.8 6.2L21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8L12 3Z"/><path d="m20 2 .6 1.4L22 4l-1.4.6L20 6l-.6-1.4L18 4l1.4-.6Z"/>',
  task: '<rect x="5" y="6" width="14" height="16" rx="2"/><path d="M9 6V4h6v2M8 11l1.5 1.5L12 10M14 11h2M8 16l1.5 1.5L12 15M14 16h2"/>',
  chat: '<path d="M14.5 5a6 6 0 0 1 5.8 7.5l1 2.8-3.2-.8a6 6 0 0 1-2.6.5"/><path d="M10 7a7 7 0 0 0-6.7 9.1L2 20l3.8-.8A7 7 0 1 0 10 7Z"/><path d="M7 13h.01M10 13h.01M13 13h.01"/>',
  income: '<path d="M4.5 7H19a2 2 0 0 1 2 2v11H5a2 2 0 0 1-2-2V7a3 3 0 0 1 3-3h13"/><path d="M3 9h18M14 12h7v5h-7a2.5 2.5 0 0 1 0-5Z"/><path d="M16.5 14.5h.01"/>',
  arrow: '<path d="m9 5 7 7-7 7"/>', back: '<path d="m15 5-7 7 7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="m5 12 4 4L19 6"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>',
  memory: '<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/><circle cx="12" cy="12" r="4"/>'
};
function trainerEscape(value = '') { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function trainerIcon(name) { return `<svg viewBox="0 0 24 24" aria-hidden="true">${trainerIcons[name] || trainerIcons.arrow}</svg>`; }
function trainerAssistantIcon() {
  return '<svg class="trainer-ai-card-icon" viewBox="0 0 40 34" aria-hidden="true"><path d="m14 4 3.7 8.3L26 16l-8.3 3.7L14 28l-3.7-8.3L2 16l8.3-3.7L14 4Z"/><path d="m26 2 .85 2.15L29 5l-2.15.85L26 8l-.85-2.15L23 5l2.15-.85Z"/><text x="27" y="30" fill="currentColor" stroke="none" font-family="Arial, sans-serif" font-size="11" font-weight="700">AI</text></svg>';
}
function trainerAction(action, text, values = {}, className = 'trainer-button') {
  return `<button type="button" class="${className}" data-action="${action}" ${Object.entries(values).map(([key, value]) => `data-${key}="${trainerEscape(value)}"`).join(' ')}>${text}</button>`;
}
function trainerNumber(value, digits = 1) { return value == null ? '—' : Number(value).toLocaleString('ru-RU', { maximumFractionDigits: digits, minimumFractionDigits: digits }); }
function trainerDelta(value) { return value == null ? 'Нет измерений' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${trainerNumber(Math.abs(value))} кг`; }
function trainerFullName(client) { return `${client.name} ${client.surname || ''}`.trim(); }
function trainerLatestWeight(client) { return client.weights.length ? client.weights[client.weights.length - 1].weight_kg : null; }
function trainerDateLabel(date) {
  if (!date) return 'Нет активности';
  if (date.slice(0, 10) === trainerDemoDate()) return 'Сегодня';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'Europe/Moscow' }).format(new Date(date.length === 10 ? `${date}T12:00:00Z` : date));
}
function trainerTimeLabel(date) { return `${trainerDateLabel(date)} · ${new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }).format(new Date(date))}`; }
function trainerRelative(date) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  if (minutes < 1) return 'Только что';
  if (minutes < 60) return `${minutes} мин назад`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} ч назад`;
  return trainerDateLabel(date);
}
function trainerAvatar(client, large = false) { return `<span class="trainer-avatar${large ? ' is-large' : ''}" aria-hidden="true">${trainerEscape(client.name[0] || '')}${trainerEscape(client.surname?.[0] || '')}</span>`; }
function trainerBadge(status, review = false) { return `<span class="trainer-badge is-${status}">${trainerEscape((review ? trainerReviewLabels : trainerStatusLabels)[status])}</span>`; }
function trainerTags(tags) { return `<div class="trainer-tags">${tags.map(tag => `<span>${trainerEscape(tag)}</span>`).join('')}</div>`; }
function trainerSection(title, count, link = '') { return `<div class="trainer-section-heading"><h2>${trainerEscape(title)}${count != null ? `<span class="trainer-count">${count}</span>` : ''}</h2>${link}</div>`; }
function trainerEmpty(title, text, action = '') { return `<section class="trainer-empty"><span class="trainer-empty-icon">${trainerIcon('clients')}</span><h2>${trainerEscape(title)}</h2><p>${trainerEscape(text)}</p>${action}</section>`; }
function trainerMetric(label, value, note = '') { return `<div class="trainer-metric"><span>${trainerEscape(label)}</span><strong>${trainerEscape(value)}</strong>${note ? `<small>${trainerEscape(note)}</small>` : ''}</div>`; }
function trainerDashboardIcon(name, size = 'side') {
  if (name === 'clients') return `<svg class="trainer-dashboard-icon is-people is-${size}" viewBox="0 0 24 24" aria-hidden="true">${trainerIcons.clientsSolid}</svg>`;
  if (name === 'reports') return `<svg class="trainer-dashboard-icon is-${size} is-report" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 8h25l11 11v36H15z"/><path d="M40 8v12h11M23 29h12M23 38h10M39 39l4 4 8-9M39 49l4 4 8-9"/></svg>`;
  const viewBox = name === 'programs' ? '132 100 684 485' : '1465 100 510 485';
  const id = `trainer-dashboard-${name}-cutout`;
  return `<svg class="trainer-dashboard-icon is-${size}" viewBox="${viewBox}" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet"><defs><filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 1 0 0 0 0"/></filter></defs><image href="assets/dashboard-metric-icons.png" x="0" y="0" width="2172" height="724" filter="url(#${id})"/></svg>`;
}
function trainerDashboardMetric(icon, value, label, center = false) {
  const labelMarkup = label.split('|').map(part => trainerEscape(part)).join('<br>');
  const ring = `<svg class="trainer-dashboard-ring" viewBox="0 0 100 100" aria-hidden="true"><circle class="trainer-dashboard-ring-track" cx="50" cy="50" r="43"/><circle class="trainer-dashboard-ring-arc" cx="50" cy="50" r="43" pathLength="100"/></svg>`;
  if (center) return `<div class="trainer-dashboard-metric trainer-dashboard-center"><div class="trainer-dashboard-center-gauge">${ring}<div class="trainer-dashboard-center-copy">${trainerDashboardIcon(icon, 'center')}<strong>${trainerEscape(value)}</strong><span>${labelMarkup}</span></div></div></div>`;
  return `<div class="trainer-dashboard-metric trainer-dashboard-side"><div class="trainer-dashboard-side-gauge">${ring}${trainerDashboardIcon(icon)}</div><strong>${trainerEscape(value)}</strong><span>${labelMarkup}</span></div>`;
}
function trainerHeader(title = '') {
  if (trainerUI.route.page === 'clients') {
    const count = trainerStore.state.clients.length;
    const plural = new Intl.PluralRules('ru-RU').select(count);
    return `<header class="trainer-header trainer-clients-header"><h1>В команде ${count} ${plural === 'few' ? 'человека' : 'человек'}</h1>${trainerAction('add-client', `${trainerIcon('plus')}<span class="trainer-sr-only">Добавить подопечного</span>`, {}, 'trainer-clients-add')}</header>`;
  }
  const detail = !['today', 'clients', 'reviews', 'programs', 'profile'].includes(trainerUI.route.page);
  return `<header class="trainer-header"><div class="trainer-header-brand">${detail ? trainerAction('back', `${trainerIcon('back')}<span class="trainer-sr-only">Назад</span>`, {}, 'trainer-icon-button') : '<div class="logo" aria-label="TRENZO">TREN<span>ZO</span></div>'}${detail ? `<span class="trainer-header-label">${trainerEscape(title)}</span>` : ''}</div><div class="trainer-header-actions"><button type="button" class="trainer-profile-shortcut" data-action="navigate" data-page="profile" aria-label="Профиль тренера" title="Профиль"><svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle cx="24" cy="24" r="21"/><circle cx="24" cy="18" r="7"/><path d="M11 39c1.8-7 6.2-10.5 13-10.5S35.2 32 37 39"/></svg></button></div></header>`;
}
function trainerNavigation() {
  let active = trainerUI.route.page;
  if (['client', 'memory'].includes(active)) active = 'clients';
  if (['tasks', 'chats', 'chat', 'income'].includes(active)) active = 'today';
  return `<nav class="trainer-navigation" aria-label="Разделы тренера">${[['today', 'Главная', 'home'], ['clients', 'Клиенты', 'clients'], ['reviews', 'Разборы', 'reviews'], ['programs', 'Схемы', 'programs'], ['profile', 'Аналитика', 'analytics']].map(([page, label, icon]) => `<button type="button" data-action="navigate" data-page="${page}" ${active === page ? 'aria-current="page"' : ''}>${trainerIcon(icon)}<span>${label}</span>${page === 'reviews' && trainerStore.state.reviews.some(trainerStore.pending) ? '<i aria-hidden="true"></i>' : ''}</button>`).join('')}</nav>`;
}
function trainerFilterTabs(items, active, action) { return `<div class="trainer-filter-tabs" role="group" aria-label="Фильтр">${items.map(([value, label]) => `<button type="button" aria-pressed="${value === active}" data-action="${action}" data-value="${value}">${label}</button>`).join('')}</div>`; }
function trainerReviewCard(review, compact = false) {
  const client = trainerStore.client(review.clientId);
  return `<button type="button" class="trainer-card trainer-review-card${compact ? ' is-compact' : ''}" data-action="review" data-id="${review.id}" aria-label="${trainerStore.pending(review) ? 'Разобрать' : 'Открыть разбор'}: ${trainerEscape(client.name)}, ${trainerEscape(review.title)}">${trainerAvatar(client)}<span class="trainer-review-copy"><strong>${trainerEscape(client.name)}</strong><span>${trainerEscape(compact ? review.type : review.title)}</span><small>${compact ? trainerRelative(review.occurredAt) : trainerTimeLabel(review.occurredAt)}</small>${!compact ? trainerTags(review.tags) : ''}</span>${!compact ? trainerBadge(review.status, true) : trainerIcon('arrow')}</button>`;
}
function trainerToday() {
  const { clients, reviews } = trainerStore.state;
  const weekStart = trainerDemoDate(6);
  const activeClients = clients.filter(client => client.activityDate && client.activityDate >= weekStart).length;
  const completedWorkouts = clients.reduce((total, client) => total + (Number(client.metrics.workoutCompleted) || 0), 0);
  const submittedAnswers = reviews.filter(review => !['inactive', 'decision'].includes(review.kind) && review.occurredAt?.slice(0, 10) >= weekStart).length;
  return `<section class="trainer-dashboard" aria-labelledby="trainerDashboardTitle"><h2 id="trainerDashboardTitle">Недельные показатели</h2><div class="trainer-dashboard-metrics">${trainerDashboardMetric('clients', activeClients, 'Активные|клиенты')}${trainerDashboardMetric('programs', completedWorkouts, 'Выполнено|тренировок', true)}${trainerDashboardMetric('reports', submittedAnswers, 'Сдано|отчетов')}</div></section>
    <section class="trainer-home-tools" aria-label="Инструменты тренера">
      ${trainerAction('navigate', `<span class="trainer-home-tool-icon">${trainerIcon('task')}</span><span class="trainer-home-tool-copy"><strong>Мои задачи</strong><small>Личные дела и задачи от TRENZO</small></span>${trainerIcon('arrow')}`, { page: 'tasks' }, 'trainer-card trainer-home-shortcut')}
      ${trainerAction('navigate', `<span class="trainer-home-tool-icon">${trainerIcon('chat')}</span><span class="trainer-home-tool-copy"><strong>Чаты с клиентами</strong><small>Переписки и карточки подопечных</small></span>${trainerIcon('arrow')}`, { page: 'chats' }, 'trainer-card trainer-home-shortcut')}
      ${trainerAction('navigate', `<span class="trainer-home-tool-icon">${trainerIcon('income')}</span><span class="trainer-home-tool-copy"><strong>Доходы</strong><small>Планирование и учёт</small></span>${trainerIcon('arrow')}`, { page: 'income' }, 'trainer-card trainer-home-shortcut')}
      ${trainerAction('navigate', `<span class="trainer-home-tool-icon is-ai">${trainerAssistantIcon()}</span><span class="trainer-home-tool-copy"><strong>Личный ассистент</strong><small>Помощь и разборы на основе данных</small></span>${trainerIcon('arrow')}`, { page: 'ai' }, 'trainer-card trainer-home-shortcut')}
    </section>`;
}

function trainerTasks() {
  const aiTasks = trainerStore.state.reviews.filter(trainerStore.pending).sort((a, b) => b.priority - a.priority);
  const personalTasks = trainerUI.tasks;
  const personalMarkup = personalTasks.length ? personalTasks.map(task => `<article class="trainer-card trainer-task-row${task.done ? ' is-complete' : ''}"><button type="button" class="trainer-task-toggle" data-action="toggle-task" data-id="${trainerEscape(task.id)}" aria-pressed="${task.done}" aria-label="${task.done ? 'Отметить невыполненной' : 'Отметить выполненной'}: ${trainerEscape(task.title)}">${task.done ? trainerIcon('check') : ''}</button><span class="trainer-task-copy"><strong>${trainerEscape(task.title)}</strong><small>${task.done ? 'Выполнено' : 'Личная задача'}</small></span><button type="button" class="trainer-task-delete" data-action="delete-task" data-id="${trainerEscape(task.id)}" aria-label="Удалить задачу">${trainerIcon('close')}</button></article>`).join('') : '<p class="trainer-muted trainer-task-empty">Пока нет личных задач. Добавь первую — она сохранится на этом устройстве.</p>';
  const aiMarkup = aiTasks.length ? aiTasks.map(review => {
    const client = trainerStore.client(review.clientId);
    return `<button type="button" class="trainer-card trainer-ai-task" data-action="review" data-id="${trainerEscape(review.id)}"><span class="trainer-home-tool-icon is-ai">${trainerIcon('ai')}</span><span class="trainer-ai-task-copy"><small>TRENZO AI · ${trainerEscape(client?.name || 'Подопечный')}</small><strong>${trainerEscape(review.title)}</strong><span>${trainerEscape(review.proposedAction)}</span></span>${trainerIcon('arrow')}</button>`;
  }).join('') : '<p class="trainer-muted trainer-task-empty">Новых рекомендаций пока нет. Здесь появятся задачи, сформированные по отчётам и активности клиентов.</p>';
  return `<div class="trainer-page-heading"><h1>Мои задачи</h1><p>Личные напоминания и подсказки TRENZO по подопечным.</p></div>
    <section><div class="trainer-section-heading"><h2>Личные задачи</h2></div><form class="trainer-task-form" data-form="create-task"><label class="trainer-sr-only" for="trainerTaskTitle">Новая задача</label><input id="trainerTaskTitle" name="title" maxlength="140" placeholder="Например, подготовить план на неделю" required><button type="submit" class="trainer-button">Добавить</button></form><div class="trainer-list">${personalMarkup}</div></section>
    <section><div class="trainer-section-heading"><h2>Задачи от ИИ <span class="trainer-count">${aiTasks.length}</span></h2></div><div class="trainer-list">${aiMarkup}</div></section>`;
}
function trainerChats() {
  const clients = trainerStore.state.clients;
  const list = clients.map(client => {
    const messages = trainerUI.chatMessages[client.id] || [];
    const latest = messages[messages.length - 1];
    const preview = latest ? `Вы: ${latest.text}` : 'Начать переписку';
    return `<button type="button" class="trainer-card trainer-chat-list-item" data-action="open-chat" data-id="${trainerEscape(client.id)}">${trainerAvatar(client)}<span class="trainer-chat-list-copy"><strong>${trainerEscape(trainerFullName(client))}</strong><small>${trainerEscape(preview)}</small></span>${trainerIcon('arrow')}</button>`;
  }).join('');
  return `<div class="trainer-page-heading"><h1>Чаты с клиентами</h1><p>Открой диалог или перейди в карточку подопечного.</p></div>${clients.length ? `<p class="trainer-demo-note">Демо-режим: сообщения пока сохраняются только в этом приложении.</p><div class="trainer-list">${list}</div>` : trainerEmpty('Пока нет клиентов', 'Добавь подопечного, чтобы открыть с ним диалог.', trainerAction('add-client', 'Добавить клиента'))}`;
}
function trainerChat() {
  const client = trainerStore.client(trainerUI.route.id);
  if (!client) return trainerEmpty('Диалог недоступен', 'Клиент не найден.', trainerAction('navigate', 'К чатам', { page: 'chats' }, 'trainer-secondary-button'));
  const messages = trainerUI.chatMessages[client.id] || [];
  const thread = messages.length ? messages.map(message => `<div class="trainer-chat-message is-trainer"><small>Вы</small><p>${trainerEscape(message.text)}</p></div>`).join('') : '<div class="trainer-chat-empty"><span class="trainer-home-tool-icon">' + trainerIcon('chat') + '</span><strong>Диалог пока пуст</strong><p>Напиши клиенту. Переписка появится здесь.</p></div>';
  return `<div class="trainer-chat-client-bar">${trainerAvatar(client)}<div><strong>${trainerEscape(trainerFullName(client))}</strong><small>${trainerEscape(client.goal)}</small></div>${trainerAction('client-from-chat', 'Карточка клиента →', { id: client.id }, 'trainer-text-button')}</div><div class="trainer-chat-thread" aria-live="polite">${thread}</div><p class="trainer-demo-note">Демо-режим: сообщения не отправляются клиенту.</p><form class="trainer-chat-compose" data-form="client-chat" data-client-id="${trainerEscape(client.id)}"><label class="trainer-sr-only" for="trainerClientMessage">Сообщение клиенту</label><input id="trainerClientMessage" name="message" maxlength="1000" placeholder="Сообщение…" autocomplete="off" required><button type="submit" aria-label="Отправить сообщение">${trainerIcon('arrow')}</button></form>`;
}
function trainerIncome() {
  return `<div class="trainer-page-heading"><h1>Доходы</h1><p>Планирование и учёт работы с клиентами.</p></div><section class="trainer-card trainer-income-intro"><span class="trainer-home-tool-icon">${trainerIcon('income')}</span><h2>Финансовый блок готовим</h2><p>Здесь будут план дохода, учёт оплат и задолженностей, а также история поступлений. Финансовые данные пока не подключены.</p></section><section class="trainer-income-preview"><div class="trainer-section-heading"><h2>Что появится в разделе</h2></div><div class="trainer-list"><article class="trainer-card trainer-income-row"><span><strong>План дохода</strong><small>Цель на месяц и прогноз</small></span><small>Скоро</small></article><article class="trainer-card trainer-income-row"><span><strong>Оплаты клиентов</strong><small>Поступления и ожидаемые платежи</small></span><small>Скоро</small></article><article class="trainer-card trainer-income-row"><span><strong>История и учёт</strong><small>Финансовые операции по периодам</small></span><small>Скоро</small></article></div></section>`;
}

function trainerClientCard(client) {
  const status = trainerStore.status(client.id);
  const displayStatus = status === 'inactive' ? 'attention' : status;
  const label = { attention: 'Требует внимания', waiting: 'Ждёт решения', ok: 'Всё хорошо' }[displayStatus];
  return `<button type="button" class="trainer-card trainer-client-card" data-action="client" data-id="${client.id}" aria-label="Открыть подопечного ${trainerEscape(trainerFullName(client))}">
    ${trainerAvatar(client)}<span class="trainer-client-copy"><strong>${trainerEscape(trainerFullName(client))}</strong><small>${trainerEscape(client.goal)}</small></span>
    <span class="trainer-client-status is-${displayStatus}">${label}</span>${trainerIcon('arrow')}</button>`;
}
function trainerFilteredClients() {
  const normalize = text => text.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');
  const words = normalize(trainerUI.search.trim()).split(/\s+/).filter(Boolean);
  return trainerStore.state.clients.filter(client => {
    const status = trainerStore.status(client.id);
    const matches = trainerUI.clientFilter === 'all' || (trainerUI.clientFilter === 'attention' ? ['attention', 'inactive'].includes(status) : status === trainerUI.clientFilter);
    const text = normalize(`${trainerFullName(client)} ${client.goal}`);
    return matches && words.every(word => text.includes(word));
  });
}
function trainerClientListMarkup() {
  const clients = trainerFilteredClients();
  return clients.length ? clients.map(client => `<li>${trainerClientCard(client)}</li>`).join('') : `<li>${trainerEmpty('Подопечных не найдено', 'Попробуй другой запрос или фильтр.', trainerAction('reset-client-filters', 'Сбросить поиск и фильтры', {}, 'trainer-secondary-button'))}</li>`;
}
function trainerClients() {
  return !trainerStore.state.clients.length ? trainerEmpty('Добавьте первого подопечного', 'Начните с имени и цели. Отчёты появятся после подключения клиента.', `${trainerAction('add-client', 'Добавить подопечного')}${trainerAction('invite', 'Пригласить по ссылке', {}, 'trainer-secondary-button')}`) : `
    <label class="trainer-search">${trainerIcon('search')}<input type="search" placeholder="Найти подопечного" aria-label="Найти подопечного" maxlength="100" value="${trainerEscape(trainerUI.search)}" data-search></label>
    ${trainerFilterTabs([['all', 'Все'], ['attention', 'Требуют внимания'], ['waiting', 'Ждут решения'], ['ok', 'Всё хорошо']], trainerUI.clientFilter, 'client-filter')}
    <p class="trainer-sr-only" id="trainerClientResults" role="status">Найдено: ${trainerFilteredClients().length}</p>
    <ul class="trainer-list trainer-clients-list" id="trainerClientList" aria-label="Клиенты">${trainerClientListMarkup()}</ul>`;
}
function trainerClientOverview(client) {
  const metrics = client.metrics;
  const outstanding = trainerStore.state.reviews.filter(r => r.clientId === client.id && trainerStore.pending(r));
  const lastReview = trainerStore.state.reviews.find(r => r.clientId === client.id && !trainerStore.pending(r));
  const summary = outstanding.length ? `${outstanding[0].analysis} ${outstanding[0].hypothesis}` : lastReview
    ? `Последний разбор подтверждён. Решение тренера: ${lastReview.proposedAction} Новых вопросов сейчас нет.` : client.programId
    ? 'По данным примера неделя проходит по плану. Открытых решений сейчас нет.'
    : 'Подопечный добавлен. Чтобы подготовить первый разбор, назначьте программу и дождитесь данных о тренировках и питании.';
  return `<section class="trainer-card">${trainerSection('Последние 7 дней')}<div class="trainer-metrics-grid">
      ${trainerMetric('Тренировки', `${metrics.workoutCompleted} / ${metrics.workoutTarget || '—'}`)}${trainerMetric('Изменение веса', trainerDelta(metrics.weightDelta))}
      ${trainerMetric('Питание', metrics.nutritionPercent == null ? '—' : `${metrics.nutritionPercent}%`)}${trainerMetric('Средний RPE', metrics.rpe == null ? '—' : trainerNumber(metrics.rpe))}${trainerMetric('Сон', metrics.sleep || '—')}
    </div></section>
    <section class="trainer-card trainer-ai-summary"><div class="trainer-ai-summary-heading">${trainerIcon('ai')}<strong>TRENZO</strong><span>Вывод по данным</span></div><p>${trainerEscape(summary)}</p>
      ${outstanding.length ? trainerAction('review', 'Разобрать неделю', { id: outstanding[0].id }) : trainerAction('ai-client', 'Разобрать неделю', { id: client.id }, 'trainer-secondary-button')}</section>
    ${outstanding.length ? `<section>${trainerSection('Открытые разборы', outstanding.length)}<div class="trainer-list">${outstanding.map(r => trainerReviewCard(r, true)).join('')}</div></section>` : ''}
    ${trainerAction('memory', `${trainerIcon('memory')}<span><strong>Память TRENZO</strong><small>Факты и последние решения</small></span>${trainerIcon('arrow')}`, { id: client.id }, 'trainer-card trainer-link-card')}`;
}
function trainerClientTraining(client) {
  const program = trainerStore.clientProgram(client.id);
  if (!program) return trainerEmpty('Программа ещё не назначена', 'Выберите программу из своих или создайте новую.', trainerAction('client-programs', 'Выбрать программу', { id: client.id }));
  const week = program.weeks[Math.max(0, Math.min(client.currentWeek - 1, program.weeks.length - 1))];
  return `<section class="trainer-card"><p class="trainer-kicker">ТЕКУЩАЯ ПРОГРАММА</p><h2>${trainerEscape(program.title)}</h2><p>Неделя ${client.currentWeek} из ${program.weeks.length}</p><div class="trainer-button-row">${trainerAction('client-program', 'Открыть программу', { id: client.id }, 'trainer-secondary-button')}${trainerAction('client-edit-program', 'Изменить программу', { id: client.id }, 'trainer-secondary-button')}</div></section>
    <section>${trainerSection('Тренировки недели')}<div class="trainer-list">${week.sessions.map((session, index) => `<div class="trainer-card trainer-session-row"><span class="trainer-session-status${index < (client.programCompleted ?? client.metrics.workoutCompleted) ? ' is-done' : ''}">${trainerIcon(index < (client.programCompleted ?? client.metrics.workoutCompleted) ? 'check' : 'programs')}</span><div><strong>${trainerEscape(session.title)}</strong><small>${session.exercises.length} упражнений · ${index < (client.programCompleted ?? client.metrics.workoutCompleted) ? 'Выполнена' : 'Предстоит'}</small></div></div>`).join('')}</div></section>
    <section>${trainerSection('История выполнения')}<div class="trainer-list">${client.workouts.map(workout => `<details class="trainer-card trainer-workout"><summary><span><strong>${trainerEscape(workout.title)}</strong><small>${trainerDateLabel(workout.workout_date)}${workout.rpe != null ? ` · RPE ${trainerNumber(workout.rpe)}` : ''}</small></span>${trainerIcon('arrow')}</summary><div>${workout.exercises.map(exercise => `<h3>${trainerEscape(exercise.name)}</h3><p>${exercise.sets.map(set => `${trainerNumber(set.weight_kg)} кг × ${set.reps}`).join(' · ')}</p>`).join('')}</div></details>`).join('') || '<p class="trainer-muted">Тренировки ещё не отмечены.</p>'}</div></section>`;
}
function trainerClientNutrition(client) {
  if (!client.nutrition.length) return trainerEmpty('Пока нет данных о питании', 'После внесения дневника здесь появятся суточные КБЖУ и история отчётов.');
  const avg = key => Math.round(client.nutrition.reduce((sum, entry) => sum + entry[key], 0) / client.nutrition.length);
  return `<section class="trainer-card">${trainerSection('Среднее за 7 дней')}<div class="trainer-metrics-grid">${trainerMetric('Калории', `${avg('calories')} ккал`)}${trainerMetric('Белки', `${avg('protein_g')} г`)}${trainerMetric('Жиры', `${avg('fat_g')} г`)}${trainerMetric('Углеводы', `${avg('carbs_g')} г`)}${trainerMetric('Выполнение цели', `${client.metrics.nutritionPercent}%`)}</div></section>
    <section>${trainerSection('Дневник питания')}<div class="trainer-card trainer-nutrition-days">${client.nutrition.slice().reverse().map(entry => `<div><strong>${trainerDateLabel(entry.report_date)}</strong><span>${Math.round(entry.calories)} ккал<small>Б ${Math.round(entry.protein_g)} · Ж ${Math.round(entry.fat_g)} · У ${Math.round(entry.carbs_g)} г</small></span></div>`).join('')}</div></section>
    ${trainerClientReports(client, 'Питание')}`;
}
function trainerWeightChart(client) {
  if (client.weights.length < 2) return '<p class="trainer-muted">График появится после двух взвешиваний.</p>';
  const values = client.weights.map(point => Number(point.weight_kg)), min = Math.min(...values) - 0.3, max = Math.max(...values) + 0.3;
  const points = values.map((value, i) => [26 + i / (values.length - 1) * 272, 120 - (value - min) / (max - min) * 88]);
  return `<svg class="trainer-weight-chart" viewBox="0 0 324 160" role="img" aria-label="Вес: ${trainerNumber(values[0])} → ${trainerNumber(values[values.length - 1])} килограмма за четыре недели"><path class="trainer-chart-grid" d="M26 32H298M26 76H298M26 120H298"/><polyline points="${points.map(p => p.join(',')).join(' ')}"/>${points.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4"/>`).join('')}<text x="26" y="149">${trainerDateLabel(client.weights[0].measured_on)}</text><text x="298" y="149" text-anchor="end">${trainerDateLabel(client.weights[client.weights.length - 1].measured_on)}</text><text x="298" y="22" text-anchor="end">${trainerNumber(values[values.length - 1])} кг</text></svg>`;
}
function trainerClientProgress(client) {
  return `<section class="trainer-card">${trainerSection('Динамика веса')}<div class="trainer-metric-inline"><strong>${trainerLatestWeight(client) == null ? '—' : `${trainerNumber(trainerLatestWeight(client))} кг`}</strong><span>${trainerDelta(client.metrics.weightDelta)} за неделю</span></div>${trainerWeightChart(client)}</section>
    <section class="trainer-card">${trainerSection('Последние замеры')}<div class="trainer-metrics-grid">${Object.entries(client.measurements).map(([key, value]) => trainerMetric({ waist_cm: 'Талия', chest_cm: 'Грудь', hips_cm: 'Бёдра' }[key], `${value} см`)).join('') || '<p class="trainer-muted">Замеры ещё не внесены.</p>'}</div></section>
    <section class="trainer-card">${trainerSection('Личные рекорды')}<div class="trainer-facts">${client.records.map(record => `<div><span>${trainerEscape(record.exercise)}</span><strong>${trainerEscape(record.value)}</strong></div>`).join('') || '<p class="trainer-muted">Рекорды появятся после тренировок.</p>'}</div></section>
    <section class="trainer-card">${trainerSection('Выполнение тренировок')}<p class="trainer-metric-inline"><strong>${client.metrics.workoutCompleted} / ${client.metrics.workoutTarget || '—'}</strong><span>за последние 7 дней</span></p></section>`;
}
function trainerClientReports(client, type = null) {
  const reviews = trainerStore.state.reviews.filter(r => r.clientId === client.id && (!type || r.type === type)).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  return reviews.length ? `<section>${trainerSection('Отчёты', reviews.length)}<div class="trainer-list">${reviews.map(r => trainerReviewCard(r)).join('')}</div></section>` : trainerEmpty('Отчётов пока нет', 'Здесь будут тренировки, отчёты недели и разборы питания.');
}
function trainerClient() {
  const client = trainerStore.client(trainerUI.route.id);
  if (!client) return trainerEmpty('Подопечный не найден', 'Вернитесь к списку подопечных.', trainerAction('navigate', 'Подопечные', { page: 'clients' }));
  const tab = trainerUI.route.tab || 'overview', weight = trainerLatestWeight(client);
  return `<section class="trainer-client-heading">${trainerAvatar(client, true)}<div><h1>${trainerEscape(client.name)}</h1><p>${trainerEscape(client.goal)}</p><small>${weight == null ? 'Вес не внесён' : `${trainerNumber(weight)} кг`}${client.targetWeight ? ` → цель ${trainerNumber(client.targetWeight)} кг` : ''}${client.currentWeek ? `<br>Неделя ${client.currentWeek} из ${client.totalWeeks}` : ''}</small>${trainerBadge(trainerStore.status(client.id))}</div></section>
    ${trainerFilterTabs([['overview', 'Обзор'], ['training', 'Тренировки'], ['nutrition', 'Питание'], ['progress', 'Прогресс'], ['reports', 'Отчёты']], tab, 'client-tab')}
    <div class="trainer-tab-content">${({ overview: trainerClientOverview, training: trainerClientTraining, nutrition: trainerClientNutrition, progress: trainerClientProgress, reports: trainerClientReports })[tab](client)}</div>`;
}
function trainerMemory() {
  const client = trainerStore.client(trainerUI.route.id);
  if (!client) return trainerEmpty('Подопечный не найден', 'Вернитесь к списку.');
  const plan = trainerStore.program(client.programId), frequency = plan?.weeks[Math.min(Math.max(client.currentWeek - 1, 0), plan.weeks.length - 1)].sessions.length;
  const facts = [['Цель', client.targetWeight ? `${client.goal} · ${trainerNumber(client.targetWeight)} кг` : client.goal], ['Тренируется', frequency ? `${frequency} раза в неделю` : 'Частота не определена'], ['Инвентарь', client.equipment], ['Предпочтения', client.preferences], ['Ограничения', client.restrictions]];
  return `<div class="trainer-page-heading"><p class="trainer-kicker">${trainerEscape(client.name)}</p><h1>Память TRENZO</h1><p>Подтверждённые данные и решения тренера.</p></div><section class="trainer-card">${trainerSection('Факты')}<dl class="trainer-facts">${facts.map(([label, value]) => `<div><dt>${label}</dt><dd>${trainerEscape(value)}</dd></div>`).join('')}</dl></section>
    <section>${trainerSection('Последние решения')}<div class="trainer-card trainer-timeline">${client.decisions.map(item => `<article><time>${trainerDateLabel(item.date)}</time><p>${trainerEscape(item.action)}</p>${item.reviewId ? trainerAction('review', 'Открыть разбор →', { id: item.reviewId }, 'trainer-text-button') : ''}</article>`).join('') || '<p class="trainer-muted">Принятых решений ещё нет.</p>'}</div></section>`;
}
function trainerReviews() {
  const filtered = trainerStore.state.reviews.filter(review => trainerUI.reviewFilter === 'all' || (trainerUI.reviewFilter === 'pending' ? trainerStore.pending(review) : !trainerStore.pending(review))).sort((a, b) => Number(trainerStore.pending(b)) - Number(trainerStore.pending(a)) || b.occurredAt.localeCompare(a.occurredAt));
  const pendingCount = trainerStore.state.reviews.filter(trainerStore.pending).length;
  return `<div class="trainer-page-heading"><h1>Разборы</h1><p>Данные, выводы и решения по подопечным.</p></div>${trainerFilterTabs([['all', 'Все'], ['pending', `Требуют решения · ${pendingCount}`], ['done', 'Готово']], trainerUI.reviewFilter, 'review-filter')}
    <div class="trainer-list">${filtered.map(r => trainerReviewCard(r)).join('') || trainerEmpty('Разборов пока нет', trainerUI.reviewFilter === 'done' ? 'Здесь появятся подтверждённые решения.' : 'Новые отчёты появятся здесь после поступления данных.')}</div>`;
}
function trainerReview() {
  const review = trainerStore.review(trainerUI.route.id);
  if (!review) return trainerEmpty('Разбор не найден', 'Вернитесь к списку разборов.', trainerAction('navigate', 'Все разборы', { page: 'reviews' }));
  const client = trainerStore.client(review.clientId), pending = trainerStore.pending(review);
  return `<div class="trainer-review-heading">${trainerAction('client', `${trainerAvatar(client)}<span><strong>${trainerEscape(client.name)}</strong><small>${trainerTimeLabel(review.occurredAt)}</small></span>${trainerIcon('arrow')}`, { id: client.id }, 'trainer-client-shortcut')}${trainerBadge(review.status, true)}</div>
    <div class="trainer-page-heading"><p class="trainer-kicker">${trainerEscape(review.type)}</p><h1>${trainerEscape(review.title)}</h1></div>
    <section class="trainer-card">${trainerSection('Что произошло')}<p>${trainerEscape(review.event)}</p><div class="trainer-metrics-grid">${review.context.map(item => trainerMetric(item.label, item.value)).join('')}</div></section>
    <section class="trainer-card trainer-ai-summary"><div class="trainer-ai-summary-heading">${trainerIcon('ai')}<strong>Что заметил TRENZO</strong></div><p>${trainerEscape(review.analysis)}</p>${review.hypothesis ? `<div class="trainer-hypothesis"><span>TRENZO предполагает</span><p>${trainerEscape(review.hypothesis)}</p></div>` : ''}</section>
    <section class="trainer-card">${trainerSection('Почему')}<p class="trainer-fact-label">Факты из отчётов</p><ul class="trainer-reasons">${review.facts.map(fact => `<li>${trainerEscape(fact)}</li>`).join('')}</ul></section>
    <section class="trainer-card trainer-proposed-action">${trainerSection(pending ? 'Предлагаемое действие' : 'Решение тренера')}<p>${trainerEscape(review.proposedAction)}</p>${review.editedByTrainer ? '<small>Изменено тренером</small>' : ''}${!pending ? `<small>Подтверждено · ${trainerDateLabel(review.decidedAt || review.occurredAt)}. Сохранено в истории клиента.</small>${trainerAction('memory', 'История решений →', { id: client.id }, 'trainer-text-button')}` : '<small>Изменение применяется только после подтверждения.</small>'}</section>
    ${pending ? `<div class="trainer-review-actions">${trainerAction('edit-review', 'Изменить', { id: review.id }, 'trainer-secondary-button')}${trainerAction('approve-review', `${trainerIcon('check')} Подтвердить`, { id: review.id })}</div>` : ''}`;
}
function trainerProgramCard(program) {
  const count = trainerStore.state.clients.filter(client => client.programId === program.id).length;
  return `<button type="button" class="trainer-card trainer-program-card" data-action="program" data-id="${program.id}"><span class="trainer-program-symbol">${trainerIcon('programs')}</span><span><strong>${trainerEscape(program.title)}</strong><small>${program.weeks[0].sessions.length} тренировки в неделю · ${program.weeks.length} недель</small><span>${program.source === 'template' ? 'Шаблон TRENZO' : count ? `Назначена: ${count} подопечных` : 'Пока не назначена'}</span></span>${trainerIcon('arrow')}</button>`;
}
function trainerPrograms() {
  const programs = trainerStore.state.programs.filter(program => trainerUI.programFilter === 'templates' ? program.source === 'template' : trainerUI.programFilter === 'assigned' ? trainerStore.state.clients.some(c => c.programId === program.id) : program.source === 'mine');
  return `<div class="trainer-title-row"><div><h1>Программы</h1><p>${trainerUI.route.clientId ? `Выбор для ${trainerEscape(trainerStore.client(trainerUI.route.clientId)?.name || 'подопечного')}` : 'От первого плана до следующей недели.'}</p></div>${trainerAction('new-program', `${trainerIcon('plus')}<span class="trainer-sr-only">Создать программу</span>`, {}, 'trainer-icon-button is-accent')}</div>
    ${trainerFilterTabs([['mine', 'Мои'], ['templates', 'Шаблоны'], ['assigned', 'Назначенные']], trainerUI.programFilter, 'program-filter')}<div class="trainer-list">${programs.map(trainerProgramCard).join('') || trainerEmpty('Здесь пока нет программ', 'Создайте программу или возьмите за основу шаблон.', trainerAction('new-program', 'Создать программу'))}</div>`;
}
function trainerProgram() {
  const program = trainerUI.route.clientId ? trainerStore.clientProgram(trainerUI.route.clientId) : trainerStore.program(trainerUI.route.id);
  if (!program) return trainerEmpty('Программа не найдена', 'Вернитесь к списку программ.');
  const currentWeek = trainerUI.route.clientId ? trainerStore.client(trainerUI.route.clientId).currentWeek - 1 : 0;
  const weekIndex = Math.max(0, Math.min(trainerUI.route.week ?? currentWeek, program.weeks.length - 1)), week = program.weeks[weekIndex];
  const assigned = trainerStore.state.clients.filter(client => client.programId === program.id);
  return `<div class="trainer-page-heading"><p class="trainer-kicker">${program.source === 'template' ? 'ШАБЛОН TRENZO' : 'ПРОГРАММА'}${trainerUI.route.clientId ? ` · ${trainerEscape(trainerStore.client(trainerUI.route.clientId).name)}` : ''}</p><h1>${trainerEscape(program.title)}</h1><p>${trainerEscape(program.goal)}<br>${program.weeks.length} недель · ${program.duration} мин · ${trainerEscape(program.equipment)}</p></div>
    <div class="trainer-button-row">${trainerAction('edit-program', program.source === 'template' ? 'Создать копию' : 'Редактировать', { id: program.id }, 'trainer-secondary-button')}${trainerAction('assign-program', 'Назначить подопечному', { id: program.id })}</div>
    <label class="trainer-field trainer-week-select">Неделя<select data-program-week>${program.weeks.map((w, i) => `<option value="${i}" ${i === weekIndex ? 'selected' : ''}>Неделя ${i + 1}</option>`).join('')}</select></label>
    <div class="trainer-list">${week.sessions.map((session, index) => `<details class="trainer-card trainer-program-day" ${index === 0 ? 'open' : ''}><summary><span><small>ДЕНЬ ${index + 1}</small><strong>${trainerEscape(session.title)}</strong></span>${trainerIcon('arrow')}</summary><div>${session.exercises.map(exercise => `<div class="trainer-exercise"><strong>${trainerEscape(exercise.name)}</strong><p>${exercise.sets} × ${trainerEscape(exercise.reps)} <span>· ${trainerNumber(exercise.weightKg)} кг</span></p><small>${trainerEscape(exercise.effortType)} ${exercise.effort} · Отдых ${exercise.restSeconds} сек${exercise.notes ? `<br>${trainerEscape(exercise.notes)}` : ''}</small></div>`).join('')}</div></details>`).join('')}</div>
    ${program.notes ? `<section class="trainer-card"><h2>Комментарий тренера</h2><p>${trainerEscape(program.notes)}</p></section>` : ''}
    ${assigned.length ? `<section>${trainerSection('Назначена подопечным', assigned.length)}<div class="trainer-list">${assigned.map(client => trainerAction('client', `${trainerAvatar(client)}<span>${trainerEscape(trainerFullName(client))}</span>${trainerIcon('arrow')}`, { id: client.id }, 'trainer-card trainer-client-shortcut')).join('')}</div></section>` : ''}`;
}
function trainerField(label, name, value = '', options = {}) {
  const attrs = `name="${name}" ${options.required ? 'required' : ''} ${options.min != null ? `min="${options.min}"` : ''} ${options.max != null ? `max="${options.max}"` : ''} ${options.step ? `step="${options.step}"` : ''} ${options.extra || ''}`;
  return `<label class="trainer-field">${label}${options.multiline ? `<textarea ${attrs} rows="3" maxlength="${options.maxlength || 1000}">${trainerEscape(value)}</textarea>` : `<input type="${options.type || 'text'}" ${attrs} value="${trainerEscape(value)}" ${options.type === 'number' ? 'inputmode="decimal"' : `maxlength="${options.maxlength || 150}"`}>`}</label>`;
}
function trainerProgramNew() {
  const mode = trainerUI.route.mode;
  if (!mode) return `<div class="trainer-page-heading"><h1>Создать программу</h1><p>Выберите удобный способ начать.</p></div><div class="trainer-list">${[
    ['ai', 'Создать с TRENZO', 'Цель и контекст подопечного → черновик программы', 'ai'], ['manual', 'Создать вручную', 'Недели, тренировочные дни и упражнения', 'programs'], ['template', 'Использовать шаблон', 'Возьмите готовую структуру за основу', 'reviews']
  ].map(([mode, title, copy, icon]) => trainerAction('creation-mode', `<span class="trainer-program-symbol">${trainerIcon(icon)}</span><span><strong>${title}</strong><small>${copy}</small></span>${trainerIcon('arrow')}`, { mode }, 'trainer-card trainer-link-card')).join('')}</div>`;
  return `<div class="trainer-page-heading"><p class="trainer-kicker">${mode === 'ai' ? 'С TRENZO' : 'ВРУЧНУЮ'}</p><h1>Новая программа</h1><p>${mode === 'ai' ? 'Укажите контекст. TRENZO подготовит пример, который можно отредактировать.' : 'Соберите структуру и настройте каждое упражнение.'}</p></div>
    <form class="trainer-form" data-form="create-program">
      <label class="trainer-field">Для кого программа<select name="clientId" data-creation-client><option value="">Без назначения</option>${trainerStore.state.clients.map(client => `<option value="${client.id}" ${trainerUI.route.clientId === client.id ? 'selected' : ''}>${trainerEscape(trainerFullName(client))}</option>`).join('')}</select></label>
      ${trainerField('Название программы', 'title', '', { required: true, maxlength: 100 })}${trainerField('Цель', 'goal', trainerStore.client(trainerUI.route.clientId)?.goal || '', { required: true })}
      <div class="trainer-form-grid">${trainerField('Тренировок в неделю', 'days', 3, { type: 'number', min: 1, max: 6, step: 1, required: true })}${trainerField('Количество недель', 'weeks', 6, { type: 'number', min: 1, max: 12, step: 1, required: true })}${trainerField('Длительность, мин', 'duration', 45, { type: 'number', min: 10, max: 180, step: 5, required: true })}</div>
      ${trainerField('Оборудование', 'equipment', trainerStore.client(trainerUI.route.clientId)?.equipment || 'Тренажёрный зал', { required: true })}${trainerField('Ограничения', 'restrictions', trainerStore.client(trainerUI.route.clientId)?.restrictions || '', { multiline: true })}${trainerField('Дополнительные комментарии', 'notes', '', { multiline: true })}
      ${mode === 'ai' ? '<p class="trainer-muted">В демо используется пример программы. Ограничения сохраняются для проверки тренером; автоматическая проверка упражнений появится при подключении AI.</p>' : ''}
      <p class="trainer-form-error" role="alert"></p><button class="trainer-button" type="submit">${mode === 'ai' ? 'Собрать программу' : 'Перейти к упражнениям'}</button>
    </form>`;
}
function trainerEditorExercise(exercise, dayIndex, exerciseIndex) {
  const attrs = field => `data-exercise-field="${field}" data-day="${dayIndex}" data-exercise="${exerciseIndex}"`;
  return `<fieldset class="trainer-editor-exercise"><legend>Упражнение ${exerciseIndex + 1}</legend>
    ${trainerField('Название', 'name', exercise.name, { required: true, extra: attrs('name') })}
    <div class="trainer-form-grid">${trainerField('Подходы', 'sets', exercise.sets, { required: true, type: 'number', min: 1, max: 20, step: 1, extra: attrs('sets') })}${trainerField('Повторения / время', 'reps', exercise.reps, { required: true, extra: attrs('reps') })}${trainerField('Вес, кг', 'weightKg', exercise.weightKg, { required: true, type: 'number', min: 0, max: 1000, step: '0.25', extra: attrs('weightKg') })}
      <label class="trainer-field">Показатель<select ${attrs('effortType')}><option ${exercise.effortType === 'RIR' ? 'selected' : ''}>RIR</option><option ${exercise.effortType === 'RPE' ? 'selected' : ''}>RPE</option></select></label>
      ${trainerField('RPE / RIR', 'effort', exercise.effort, { required: true, type: 'number', min: 0, max: 10, step: '0.5', extra: attrs('effort') })}${trainerField('Отдых, сек', 'restSeconds', exercise.restSeconds, { required: true, type: 'number', min: 0, max: 900, step: 1, extra: attrs('restSeconds') })}
    </div>${trainerField('Комментарий тренера', 'notes', exercise.notes, { multiline: true, extra: attrs('notes') })}${trainerAction('remove-exercise', 'Убрать упражнение', { day: dayIndex, exercise: exerciseIndex }, 'trainer-text-button')}</fieldset>`;
}
function trainerProgramEditor() {
  const draft = trainerUI.draft;
  if (!draft) return trainerEmpty('Черновик недоступен', 'Создайте новую программу.', trainerAction('new-program', 'Создать программу'));
  const week = draft.weeks[trainerUI.editorWeek];
  return `<div class="trainer-page-heading"><h1>Конструктор</h1><p>${trainerEscape(draft.title)} · ${draft.weeks.length} недель</p></div>
    <form class="trainer-form" data-form="save-program" novalidate>${trainerField('Название программы', 'program-title', draft.title, { required: true, extra: 'data-draft-field="title"' })}${trainerField('Комментарий к программе', 'program-notes', draft.notes, { multiline: true, extra: 'data-draft-field="notes"' })}
    <div class="trainer-editor-week-row"><label class="trainer-field">Неделя<select data-editor-week>${draft.weeks.map((w, i) => `<option value="${i}" ${i === trainerUI.editorWeek ? 'selected' : ''}>Неделя ${i + 1}</option>`).join('')}</select></label>${trainerAction('add-week', '+ Неделя', {}, 'trainer-secondary-button')}</div>
    ${draft.restrictions ? `<div class="trainer-card"><strong>Учесть ограничения</strong><p>${trainerEscape(draft.restrictions)}</p></div>` : ''}
    ${week.sessions.map((session, index) => `<details class="trainer-card trainer-editor-day" ${index === 0 ? 'open' : ''}><summary><span><small>ДЕНЬ ${index + 1}</small><strong>${trainerEscape(session.title)}</strong></span>${trainerIcon('arrow')}</summary><div>${trainerField('Название тренировочного дня', `day-${index}`, session.title, { required: true, extra: `data-day-title="${index}"` })}${session.exercises.map((exercise, i) => trainerEditorExercise(exercise, index, i)).join('')}<div class="trainer-button-row">${trainerAction('add-exercise', '+ Упражнение', { day: index }, 'trainer-secondary-button')}${trainerAction('remove-day', 'Убрать день', { day: index }, 'trainer-text-button')}</div></div></details>`).join('')}
    ${trainerAction('add-day', '+ Тренировочный день', {}, 'trainer-secondary-button')}<p class="trainer-form-error" role="alert"></p><div class="trainer-editor-save"><button type="submit" class="trainer-button">Сохранить программу</button></div></form>`;
}
function trainerProfile() {
  const profile = trainerStore.state.trainer;
  return `<div class="trainer-page-heading"><h1>Профиль</h1><p>Твой кабинет и настройки.</p></div><section class="trainer-card trainer-profile-summary">${trainerAvatar({ name: profile.name, surname: profile.surname }, true)}<h2>${trainerEscape(profile.name)} ${trainerEscape(profile.surname)}</h2><span>${trainerEscape(profile.specialization || 'Специализация не указана')}</span><p>${trainerEscape(profile.description)}</p>${trainerAction('edit-profile', 'Редактировать профиль', {}, 'trainer-secondary-button')}</section>
    <section class="trainer-card trainer-settings"><h2>Настройки аккаунта</h2><label class="trainer-toggle"><span><strong>Уведомления</strong><small>Настройка для будущих событий подопечных</small></span><input type="checkbox" role="switch" data-notifications ${profile.notifications ? 'checked' : ''}></label>
      ${trainerAction('ai', `${trainerIcon('ai')}<span>TRENZO AI</span>${trainerIcon('arrow')}`, {}, 'trainer-settings-link')}${trainerAction('switch-role', `${trainerIcon('clients')}<span>Переключить роль</span>${trainerIcon('arrow')}`, {}, 'trainer-settings-link')}${trainerAction('exit', 'Выйти к заставке', {}, 'trainer-settings-link')}
    </section><section class="trainer-card trainer-demo-settings"><h2>Данные примера</h2><p>Для проверки прототипа. Изменения хранятся на этом устройстве и не затрагивают кабинет спортсмена.</p>${trainerAction('scenario', 'Обычный рабочий день', { mode: 'demo' }, 'trainer-settings-link')}${trainerAction('scenario', 'Сегодня всё спокойно', { mode: 'calm' }, 'trainer-settings-link')}${trainerAction('scenario', 'Без подопечных', { mode: 'empty' }, 'trainer-settings-link')}</section>`;
}
function trainerAIAnswer(question, clientId = null) {
  const query = question.toLocaleLowerCase('ru-RU');
  const client = trainerStore.client(clientId) || trainerStore.state.clients.find(c => query.includes(c.name.toLocaleLowerCase('ru-RU').slice(0, -1)));
  if (client) {
    const review = trainerStore.state.reviews.find(r => r.clientId === client.id && trainerStore.pending(r));
    const facts = review ? review.facts.slice() : [`Тренировки: ${client.metrics.workoutCompleted} из ${client.metrics.workoutTarget || 'план пока не назначен'}.`, `Последний вес: ${trainerLatestWeight(client) == null ? 'не внесён' : `${trainerNumber(trainerLatestWeight(client))} кг`}.`];
    if (query.includes('месяц') && client.weights.length > 1) facts.push(`Вес за четыре недели: ${trainerNumber(client.weights[0].weight_kg)} → ${trainerNumber(trainerLatestWeight(client))} кг.`);
    return { facts, conclusion: review ? `${review.analysis} ${review.hypothesis}` : 'По данным примера открытых вопросов нет. Перед изменением программы проверьте свежие отчёты.', action: review?.proposedAction || 'Сохранить текущий план и продолжить наблюдение.', reviewId: review?.id, clientId: client.id };
  }
  const attention = trainerStore.state.clients.filter(c => ['attention', 'inactive'].includes(trainerStore.status(c.id)));
  const relevant = query.includes('активност') ? attention.filter(c => trainerStore.status(c.id) === 'inactive') : attention;
  return { facts: relevant.length ? relevant.map(c => `${c.name}: ${trainerStore.state.reviews.find(r => r.clientId === c.id && trainerStore.pending(r))?.title}.`) : ['Открытых ситуаций, требующих внимания, в данных примера нет.'], conclusion: 'Это демонстрационный ответ по текущим данным примера. Связь между показателями требует проверки тренером.', action: relevant.length ? 'Начни с первого открытого разбора: там есть данные и предлагаемое действие.' : 'Проверь последние события подопечных.', reviewId: relevant.length ? trainerStore.state.reviews.find(r => r.clientId === relevant[0].id && trainerStore.pending(r))?.id : null };
}
const trainerAIQuestions = ['Кому сегодня нужно внимание?', 'Разбери неделю Александра', 'У кого снизилась тренировочная активность?', 'Что изменилось у Марии за месяц?', 'Предложи корректировку программы Ильи'];
function trainerAI() {
  return `<div class="trainer-ai-intro"><span>${trainerIcon('ai')}</span><h1>TRENZO AI</h1><p>Данные → контекст → решение</p><small>Демонстрационные ответы по данным примера.</small></div>
    ${!trainerUI.messages.length ? `<div class="trainer-ai-suggestions">${trainerAIQuestions.map((question, index) => trainerAction('ai-question', question, { index }, 'trainer-secondary-button')).join('')}</div>` : ''}
    <div class="trainer-ai-messages" aria-live="polite">${trainerUI.messages.map(message => message.role === 'user' ? `<div class="trainer-ai-user-message">${trainerEscape(message.text)}</div>` : `<section class="trainer-card trainer-ai-answer"><div class="trainer-ai-summary-heading">${trainerIcon('ai')}<strong>TRENZO</strong></div><span class="trainer-fact-label">Факты</span><ul class="trainer-reasons">${message.facts.map(fact => `<li>${trainerEscape(fact)}</li>`).join('')}</ul><span class="trainer-fact-label">Вывод TRENZO</span><p>${trainerEscape(message.conclusion)}</p><span class="trainer-fact-label">Предлагаемое действие</span><p>${trainerEscape(message.action)}</p>${message.reviewId ? trainerAction('review', 'Открыть разбор →', { id: message.reviewId }, 'trainer-text-button') : ''}</section>`).join('')}</div>
    <form class="trainer-ai-compose" data-form="ai"><label class="trainer-sr-only" for="trainerAIQuestion">Сообщение TRENZO AI</label><input id="trainerAIQuestion" name="question" placeholder="Спроси о подопечных…" maxlength="1000" required autocomplete="off"><button type="submit" aria-label="Отправить сообщение">${trainerIcon('arrow')}</button></form>`;
}
function trainerModalMarkup() {
  const modal = trainerUI.modal;
  if (!modal) return '';
  let title = '', content = '';
  if (modal.type === 'add-client') {
    title = 'Добавить подопечного'; content = `<p>Укажи имя и цель подопечного.</p><form class="trainer-form" data-form="add-client">${trainerField('Имя и фамилия', 'name', '', { required: true, maxlength: 100 })}${trainerField('Цель', 'goal', '', { required: true })}<p class="trainer-form-error" role="alert"></p><button type="submit" class="trainer-button">Добавить</button>${trainerAction('invite', 'Пригласить по ссылке', {}, 'trainer-secondary-button')}</form>`;
  } else if (modal.type === 'invite') {
    title = 'Пригласить по ссылке';
    const link = new URL(window.location.href); link.hash = ''; link.search = '?trainerInvite=demo-trenzo';
    content = `<p>В прототипе ссылка демонстрирует приглашение. Подключение реального аккаунта появится при подключении сервера.</p><label class="trainer-field">Ссылка-приглашение<input id="trainerInviteLink" readonly value="${trainerEscape(link.toString())}"></label>${trainerAction('copy-invite', 'Скопировать ссылку')}<p class="trainer-form-error" role="status"></p>`;
  } else if (modal.type === 'edit-review') {
    title = 'Изменить решение'; content = `<p>После сохранения решение останется на согласовании.</p><form class="trainer-form" data-form="edit-review" data-id="${modal.id}">${trainerField('Решение тренера', 'action', trainerStore.review(modal.id).proposedAction, { multiline: true, required: true, maxlength: 2000 })}<p class="trainer-form-error" role="alert"></p><button class="trainer-button" type="submit">Сохранить решение</button></form>`;
  } else if (modal.type === 'assign') {
    title = 'Назначить программу'; const client = trainerStore.client(modal.clientId);
    content = client ? `<p>Назначить программу «${trainerEscape(trainerStore.program(modal.id).title)}» подопечному ${trainerEscape(trainerFullName(client))}?</p><p class="trainer-muted">Текущая программа будет заменена. Решение сохранится в истории клиента.</p>${trainerAction('confirm-assign', 'Подтвердить назначение', { id: modal.id, client: client.id })}${trainerAction('assign-program', 'Выбрать другого', { id: modal.id, clear: 'true' }, 'trainer-secondary-button')}`
      : `<p>Программа: ${trainerEscape(trainerStore.program(modal.id).title)}</p><div class="trainer-list">${trainerStore.state.clients.map(c => trainerAction('assign-select', `${trainerAvatar(c)}<span>${trainerEscape(trainerFullName(c))}</span>${trainerIcon('arrow')}`, { id: modal.id, client: c.id }, 'trainer-card trainer-client-shortcut')).join('') || '<p>Сначала добавьте подопечного.</p>'}</div>`;
  } else if (modal.type === 'edit-profile') {
    title = 'Профиль тренера'; const p = trainerStore.state.trainer;
    content = `<form class="trainer-form" data-form="profile">${trainerField('Имя', 'name', p.name, { required: true, maxlength: 50 })}${trainerField('Фамилия', 'surname', p.surname, { maxlength: 50 })}${trainerField('Специализация', 'specialization', p.specialization)}${trainerField('Описание', 'description', p.description, { multiline: true })}<p class="trainer-form-error" role="alert"></p><button class="trainer-button" type="submit">Сохранить профиль</button></form>`;
  } else if (modal.type === 'scenario') {
    title = 'Загрузить данные примера?'; content = `<p>Изменения демо-кабинета будут заменены выбранным примером. Данные спортсмена сохранятся.</p>${trainerAction('confirm-scenario', 'Загрузить пример', { mode: modal.mode })}`;
  } else if (modal.type === 'leave-editor') {
    title = 'Выйти из конструктора?'; content = `<p>Несохранённые изменения черновика будут потеряны.</p>${trainerAction('discard-draft', 'Выйти без сохранения', {}, 'trainer-secondary-button')}${trainerAction('close-modal', 'Продолжить редактирование')}`;
  }
  return `<dialog class="trainer-dialog" id="trainerDialog" aria-labelledby="trainerDialogTitle"><div class="trainer-dialog-heading"><h2 id="trainerDialogTitle">${title}</h2>${trainerAction('close-modal', `${trainerIcon('close')}<span class="trainer-sr-only">Закрыть</span>`, {}, 'trainer-icon-button')}</div>${content}</dialog>`;
}
function trainerLoadWorkspace(storage, identity) {
  const key = `trenzo-trainer-workspace-v1:${identity}`;
  if (trainerUI.workspaceKey === key) return;
  trainerUI.workspaceKey = key; trainerUI.workspaceStorage = storage; trainerUI.tasks = []; trainerUI.chatMessages = {};
  try {
    const saved = JSON.parse(storage?.getItem(key) || 'null');
    if (saved?.version === 1 && Array.isArray(saved.tasks) && saved.chatMessages && typeof saved.chatMessages === 'object') {
      trainerUI.tasks = saved.tasks.filter(task => task && typeof task.id === 'string' && typeof task.title === 'string').slice(0, 200);
      trainerUI.chatMessages = Object.fromEntries(Object.entries(saved.chatMessages).filter(([clientId, messages]) => typeof clientId === 'string' && Array.isArray(messages)).map(([clientId, messages]) => [clientId, messages.filter(message => message && typeof message.text === 'string' && ['trainer'].includes(message.role)).slice(-300)]));
    }
  } catch { /* Разделы доступны в течение сессии, даже если хранилище повреждено. */ }
}
function trainerSaveWorkspace() {
  try { trainerUI.workspaceStorage?.setItem(trainerUI.workspaceKey, JSON.stringify({ version: 1, tasks: trainerUI.tasks, chatMessages: trainerUI.chatMessages })); }
  catch { trainerToast('Не удалось сохранить локально. Изменение доступно до закрытия приложения.'); }
}
function trainerStart() {
  let storage = null;
  try { storage = window.localStorage; } catch { /* Демо доступно и без хранилища. */ }
  const identity = tg?.initDataUnsafe?.user?.id || 'local';
  trainerStore.load(storage, identity); trainerLoadWorkspace(storage, identity);
  trainerUI.route = { page: 'today' }; trainerUI.history = []; trainerUI.modal = null;
  const root = document.getElementById('trainerScreen');
  if (!root.dataset.trainerBound) {
    root.dataset.trainerBound = 'true';
    root.addEventListener('click', trainerHandleClick);
    root.addEventListener('input', trainerHandleInput);
    root.addEventListener('change', trainerHandleChange);
    root.addEventListener('submit', trainerHandleSubmit);
    root.addEventListener('cancel', event => { if (event.target.id === 'trainerDialog') trainerUI.modal = null; }, true);
  }
  trainerRender();
}
function trainerRender() {
  const page = trainerUI.route.page;
  const renderers = { today: trainerToday, tasks: trainerTasks, chats: trainerChats, chat: trainerChat, income: trainerIncome, clients: trainerClients, client: trainerClient, memory: trainerMemory, reviews: trainerReviews, review: trainerReview, programs: trainerPrograms, program: trainerProgram, 'program-new': trainerProgramNew, 'program-edit': trainerProgramEditor, profile: trainerProfile, ai: trainerAI };
  const title = { tasks: 'Мои задачи', chats: 'Чаты с клиентами', chat: trainerStore.client(trainerUI.route.id)?.name || 'Диалог', income: 'Доходы', client: 'Подопечный', memory: 'Память TRENZO', review: 'Разбор', program: 'Программа', 'program-new': 'Новая программа', 'program-edit': 'Конструктор', ai: 'Личный ассистент' }[page];
  const hasNav = ['today', 'tasks', 'chats', 'income', 'clients', 'client', 'memory', 'reviews', 'programs', 'profile'].includes(page);
  const root = document.getElementById('trainerScreen');
  root.innerHTML = `<div class="trainer-app${hasNav ? ' has-navigation' : ''}${page === 'ai' ? ' is-ai' : ''}${page === 'clients' ? ' is-clients' : ''}">${trainerHeader(title)}<main class="trainer-main">${trainerStore.storageWarning ? `<p class="trainer-storage-warning" role="status">${trainerEscape(trainerStore.storageWarning)}</p>` : ''}${renderers[page]()}</main>${hasNav ? trainerNavigation() : ''}${trainerModalMarkup()}<div id="trainerToast" class="trainer-toast" role="status" aria-live="polite" hidden></div></div>`;
  root.querySelectorAll('.trainer-filter-tabs').forEach(tabs => {
    const selected = tabs.querySelector('[aria-pressed="true"]');
    if (selected) tabs.scrollLeft = Math.max(0, selected.getBoundingClientRect().left - tabs.getBoundingClientRect().left - tabs.clientWidth / 2 + selected.offsetWidth / 2);
  });
  if (trainerUI.modal) root.querySelector('#trainerDialog').showModal();
}
function trainerGo(page, params = {}, replace = false) {
  trainerUI.modal = null;
  if (!replace) trainerUI.history.push({ route: { ...trainerUI.route }, scroll: window.scrollY });
  trainerUI.route = { page, ...params }; trainerRender(); window.scrollTo(0, 0);
}
function trainerBack() {
  if (trainerUI.route.page === 'program-edit' && trainerUI.draft) { trainerUI.modal = { type: 'leave-editor' }; trainerRender(); return; }
  const previous = trainerUI.history.pop();
  trainerUI.route = previous?.route || { page: 'today' }; trainerUI.modal = null; trainerRender(); window.scrollTo(0, previous?.scroll || 0);
}
function trainerToast(message) {
  const toast = document.getElementById('trainerToast');
  if (!toast) return;
  clearTimeout(trainerUI.toastTimer); toast.textContent = message; toast.hidden = false;
  trainerUI.toastTimer = setTimeout(() => { if (toast.isConnected) toast.hidden = true; }, 3000);
}
function trainerOpenModal(type, values = {}) { trainerUI.modal = { type, ...values }; trainerRender(); }
function trainerOpenEditor(program, clientId = null) {
  trainerUI.draft = trainerCopy(program);
  if (program.source === 'template' || clientId) trainerUI.draft.id = null;
  trainerUI.editorWeek = 0; trainerGo('program-edit', { clientId });
}
function trainerAskAI(question, clientId = null) {
  trainerUI.messages.push({ role: 'user', text: question }, { role: 'assistant', ...trainerAIAnswer(question, clientId) });
  trainerRender(); document.getElementById('trainerAIQuestion')?.scrollIntoView({ block: 'nearest' });
}
function trainerHandleClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const { action, id, page, value, mode, client, day, exercise, index } = button.dataset;
  try {
    if (action === 'navigate') { trainerUI.history = []; trainerGo(page, {}, true); }
    else if (action === 'back') trainerBack();
    else if (action === 'client') trainerGo('client', { id, tab: 'overview' });
    else if (action === 'open-chat') trainerGo('chat', { id });
    else if (action === 'client-from-chat') trainerGo('client', { id, tab: 'overview' });
    else if (action === 'toggle-task') { const task = trainerUI.tasks.find(item => item.id === id); if (task) { task.done = !task.done; trainerSaveWorkspace(); trainerRender(); } }
    else if (action === 'delete-task') { trainerUI.tasks = trainerUI.tasks.filter(item => item.id !== id); trainerSaveWorkspace(); trainerRender(); }
    else if (action === 'memory') trainerGo('memory', { id });
    else if (action === 'review') trainerGo('review', { id });
    else if (action === 'client-tab') { trainerUI.route.tab = value; trainerRender(); }
    else if (action === 'client-filter') { trainerUI.clientFilter = value; trainerRender(); }
    else if (action === 'reset-client-filters') { trainerUI.search = ''; trainerUI.clientFilter = 'all'; trainerRender(); }
    else if (action === 'review-filter') { trainerUI.reviewFilter = value; trainerRender(); }
    else if (action === 'program-filter') { trainerUI.programFilter = value; trainerRender(); }
    else if (action === 'approve-review') { trainerStore.approveReview(id); trainerRender(); trainerToast('Решение подтверждено и сохранено в истории клиента.'); }
    else if (action === 'edit-review') trainerOpenModal('edit-review', { id });
    else if (action === 'add-client') trainerOpenModal('add-client');
    else if (action === 'invite') trainerOpenModal('invite');
    else if (action === 'copy-invite') trainerCopyInvite();
    else if (action === 'close-modal') { trainerUI.modal = null; document.getElementById('trainerDialog')?.close(); }
    else if (action === 'program') trainerGo('program', { id, assignClientId: trainerUI.route.clientId });
    else if (action === 'new-program') trainerGo('program-new', { clientId: trainerUI.route.clientId });
    else if (action === 'creation-mode') {
      if (mode === 'template') { trainerUI.programFilter = 'templates'; trainerGo('programs', { clientId: trainerUI.route.clientId }); }
      else trainerGo('program-new', { mode, clientId: trainerUI.route.clientId });
    }
    else if (action === 'client-programs') trainerGo('programs', { clientId: id });
    else if (action === 'client-program') trainerGo('program', { id: trainerStore.client(id).programId, clientId: id });
    else if (action === 'client-edit-program') trainerOpenEditor(trainerStore.clientProgram(id), id);
    else if (action === 'edit-program') trainerOpenEditor(trainerUI.route.clientId ? trainerStore.clientProgram(trainerUI.route.clientId) : trainerStore.program(id), trainerUI.route.clientId || null);
    else if (action === 'assign-program') trainerOpenModal('assign', { id, clientId: button.dataset.clear ? null : trainerUI.route.assignClientId || null });
    else if (action === 'assign-select') trainerOpenModal('assign', { id, clientId: client });
    else if (action === 'confirm-assign') { trainerStore.assignProgram(id, client); trainerUI.modal = null; trainerGo('client', { id: client, tab: 'training' }); trainerToast('Программа назначена. Решение сохранено в истории.'); }
    else if (action === 'add-week') {
      if (trainerUI.draft.weeks.length >= 12) throw new Error('В прототипе доступно до 12 недель.');
      const week = trainerCopy(trainerUI.draft.weeks[trainerUI.editorWeek]); week.number = trainerUI.draft.weeks.length + 1;
      trainerUI.draft.weeks.push(week); trainerUI.editorWeek = trainerUI.draft.weeks.length - 1; trainerRender();
    }
    else if (action === 'add-day') {
      const week = trainerUI.draft.weeks[trainerUI.editorWeek];
      if (week.sessions.length >= 6) throw new Error('В неделе доступно до 6 тренировок.');
      week.sessions.push({ title: `Тренировка ${week.sessions.length + 1}`, exercises: [{ name: '', sets: 3, reps: '8–10', weightKg: 0, effortType: 'RIR', effort: 2, restSeconds: 90, notes: '' }] }); trainerRender();
    }
    else if (action === 'remove-day') { const week = trainerUI.draft.weeks[trainerUI.editorWeek]; if (week.sessions.length === 1) throw new Error('Оставьте хотя бы одну тренировку в неделе.'); week.sessions.splice(Number(day), 1); trainerRender(); }
    else if (action === 'add-exercise') { trainerUI.draft.weeks[trainerUI.editorWeek].sessions[Number(day)].exercises.push({ name: '', sets: 3, reps: '8–10', weightKg: 0, effortType: 'RIR', effort: 2, restSeconds: 90, notes: '' }); trainerRender(); }
    else if (action === 'remove-exercise') { const exercises = trainerUI.draft.weeks[trainerUI.editorWeek].sessions[Number(day)].exercises; if (exercises.length === 1) throw new Error('Оставьте хотя бы одно упражнение.'); exercises.splice(Number(exercise), 1); trainerRender(); }
    else if (action === 'discard-draft') { trainerUI.draft = null; trainerUI.modal = null; trainerBack(); }
    else if (action === 'edit-profile') trainerOpenModal('edit-profile');
    else if (action === 'scenario') trainerOpenModal('scenario', { mode });
    else if (action === 'confirm-scenario') { trainerStore.reset(mode); trainerUI.history = []; trainerUI.messages = []; trainerGo('today', {}, true); }
    else if (action === 'switch-role' || action === 'exit') { trainerUI.modal = null; trainerUI.history = []; showScreen(action === 'exit' ? 'welcomeScreen' : 'roleScreen'); }
    else if (action === 'ai') trainerGo('ai');
    else if (action === 'ai-client') { trainerGo('ai'); trainerAskAI(`Разбери неделю ${trainerStore.client(id).name}`, id); }
    else if (action === 'ai-question') trainerAskAI(trainerAIQuestions[Number(index)]);
  } catch (error) { trainerToast(error.message); }
}
function trainerHandleInput(event) {
  const input = event.target;
  if (input.hasAttribute('data-search')) {
    trainerUI.search = input.value;
    document.getElementById('trainerClientList').innerHTML = trainerClientListMarkup();
    document.getElementById('trainerClientResults').textContent = `Найдено: ${trainerFilteredClients().length}`;
  }
  if (!trainerUI.draft) return;
  if (input.dataset.draftField) trainerUI.draft[input.dataset.draftField] = input.value;
  if (input.dataset.dayTitle != null) trainerUI.draft.weeks[trainerUI.editorWeek].sessions[Number(input.dataset.dayTitle)].title = input.value;
  if (input.dataset.exerciseField) {
    const exercise = trainerUI.draft.weeks[trainerUI.editorWeek].sessions[Number(input.dataset.day)].exercises[Number(input.dataset.exercise)];
    exercise[input.dataset.exerciseField] = ['sets', 'weightKg', 'effort', 'restSeconds'].includes(input.dataset.exerciseField) ? (input.value === '' ? NaN : Number(input.value)) : input.value;
  }
}
function trainerHandleChange(event) {
  const input = event.target; trainerHandleInput(event);
  if (input.hasAttribute('data-notifications')) { trainerStore.saveProfile({ ...trainerStore.state.trainer, notifications: input.checked }); trainerToast('Настройка уведомлений сохранена.'); }
  if (input.hasAttribute('data-editor-week')) { trainerUI.editorWeek = Number(input.value); trainerRender(); }
  if (input.hasAttribute('data-program-week')) { trainerUI.route.week = Number(input.value); trainerRender(); }
  if (input.hasAttribute('data-creation-client')) {
    const client = trainerStore.client(input.value), form = input.closest('form');
    if (client) {
      ['goal', 'equipment', 'restrictions'].forEach(field => { form.elements.namedItem(field).value = client[field]; });
      const plan = trainerStore.program(client.programId);
      if (plan) form.elements.namedItem('days').value = plan.weeks[Math.min(Math.max(client.currentWeek - 1, 0), plan.weeks.length - 1)].sessions.length;
    }
  }
}
async function trainerCopyInvite() {
  const input = document.getElementById('trainerInviteLink');
  try { await navigator.clipboard.writeText(input.value); document.querySelector('#trainerDialog .trainer-form-error').textContent = 'Ссылка скопирована.'; }
  catch { input.focus(); input.select(); document.querySelector('#trainerDialog .trainer-form-error').textContent = 'Ссылка выделена. Скопируйте её вручную.'; }
}
function trainerHandleSubmit(event) {
  const form = event.target;
  if (!form.dataset.form) return;
  event.preventDefault();
  if (form.dataset.form === 'save-program') {
    const invalid = form.querySelector('input:invalid, select:invalid, textarea:invalid');
    if (invalid?.closest('details')) invalid.closest('details').open = true;
  }
  if (!form.reportValidity()) return;
  const values = Object.fromEntries(new FormData(form));
  try {
    if (form.dataset.form === 'add-client') { const client = trainerStore.addClient(values); trainerGo('client', { id: client.id }); trainerToast('Карточка подопечного добавлена в демо-кабинет.'); }
    else if (form.dataset.form === 'create-task') {
      const title = values.title.trim();
      if (!title) throw new Error('Напиши название задачи.');
      trainerUI.tasks.unshift({ id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title, done: false });
      trainerSaveWorkspace(); trainerRender(); document.getElementById('trainerTaskTitle')?.focus();
    }
    else if (form.dataset.form === 'client-chat') {
      const clientId = form.dataset.clientId, message = values.message.trim();
      if (!trainerStore.client(clientId)) throw new Error('Клиент не найден.');
      if (!message) throw new Error('Напиши сообщение.');
      trainerUI.chatMessages[clientId] ||= [];
      trainerUI.chatMessages[clientId].push({ role: 'trainer', text: message, sentAt: new Date().toISOString() });
      trainerUI.chatMessages[clientId] = trainerUI.chatMessages[clientId].slice(-300);
      trainerSaveWorkspace(); trainerRender(); document.getElementById('trainerClientMessage')?.focus();
    }
    else if (form.dataset.form === 'edit-review') { trainerStore.editReview(form.dataset.id, values.action); trainerUI.modal = null; trainerRender(); trainerToast('Решение изменено. Подтвердите его после проверки.'); }
    else if (form.dataset.form === 'profile') { trainerStore.saveProfile(values); trainerUI.modal = null; trainerRender(); trainerToast('Профиль сохранён.'); }
    else if (form.dataset.form === 'ai') trainerAskAI(values.question);
    else if (form.dataset.form === 'create-program') {
      const draft = { title: values.title, goal: values.goal, duration: Number(values.duration), equipment: values.equipment, restrictions: values.restrictions, notes: values.notes, source: 'mine', weeks: trainerProgramWeeks(Number(values.weeks), Number(values.days)) };
      if (trainerUI.route.mode === 'manual') draft.weeks.forEach(week => week.sessions.forEach(session => { session.exercises = [{ name: '', sets: 3, reps: '8–10', weightKg: 0, effortType: 'RIR', effort: 2, restSeconds: 90, notes: '' }]; }));
      trainerOpenEditor(draft, values.clientId || null);
    }
    else if (form.dataset.form === 'save-program') {
      const clientId = trainerUI.route.clientId, saved = trainerStore.saveProgram(trainerUI.draft);
      trainerUI.draft = null; trainerGo('program', { id: saved.id }, true); trainerToast('Программа сохранена.');
      if (clientId) trainerOpenModal('assign', { id: saved.id, clientId });
    }
  } catch (error) { const slot = form.querySelector('.trainer-form-error'); if (slot) { slot.textContent = error.message; slot.scrollIntoView({ block: 'nearest' }); } else trainerToast(error.message); }
}
