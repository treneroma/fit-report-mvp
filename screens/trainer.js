/* TRENZO — кабинет тренера. Навигация повторяет архитектуру athlete;
   доступ к данным изолирован за trainerStore. */
const trainerUI = {
  route: { page: 'today' }, history: [], search: '', clientFilter: 'all', reviewFilter: 'all',
  reviewPeriod: '', reviewNoteDrafts: {}, trainingHistoryWeeks: {}, nutritionHistoryWeeks: {}, reportHistoryWeeks: {}, programFilter: 'workouts', templateFilter: 'workouts', modal: null, draft: null, editorWeek: 0, messages: [], tasks: [], chatMessages: {}, workspaceStorage: null, workspaceKey: '', toastTimer: null, editingClientTag: null
};
let trainerTouchStart = null;
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
  plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="m5 12 4 4L19 6"/>', edit: '<path d="m15 5 4 4M4 20l4.3-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.3 16 4 20Z"/>',
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
function trainerOverviewWeightChange(value) {
  if (value == null || !Number.isFinite(Number(value))) return 'Нет данных';
  const amount = Number(value), sign = amount > 0 ? '+' : amount < 0 ? '−' : '';
  return Math.abs(amount) > 0 && Math.abs(amount) < 1
    ? `${sign}${Math.round(Math.abs(amount) * 1000)} г`
    : `${sign}${trainerNumber(Math.abs(amount))} кг`;
}
function trainerProgramSystem(program) {
  if (!program) return 'Не назначена';
  const title = String(program.title || '').toLocaleLowerCase('ru-RU');
  if (/full\s*body|фулл\s*боди|все тело|всё тело/.test(title)) return 'Full Body';
  if (/upper|lower|сплит/.test(title)) return 'Сплит';
  return 'Не определена';
}
function trainerFullName(client) { return `${client.name} ${client.surname || ''}`.trim(); }
function trainerLatestWeight(client) { return client.weights.length ? client.weights[client.weights.length - 1].weight_kg : null; }
function trainerClientTenure(client, today = trainerDemoDate()) {
  if (!client?.joinedOn) return 'Срок не указан';
  const totalDays = trainerDayDistance(client.joinedOn, today);
  if (!Number.isFinite(totalDays) || totalDays < 0) return 'Срок не указан';
  const totalWeeks = Math.round(totalDays / 7);
  if (totalWeeks < 1) return 'меньше 1 нед';
  const totalMonths = Math.floor(totalWeeks / 5);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const weeks = totalWeeks % 5;
  const parts = [];
  if (years) parts.push(`${years} г`);
  if (months) parts.push(`${months} мес`);
  if (weeks) parts.push(`${weeks} нед`);
  return parts.join(' ');
}
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
function trainerAvatar(client, large = false) {
  const answers = client.questionnaire || client.athleteAnswers || client.profileAnswers || {};
  const sex = answers.sex ?? client.sex;
  const placeholder = sex === 'male' ? 'assets/client-avatar-male.png' : sex === 'female' ? 'assets/client-avatar-female.png' : '';
  let photo = '';
  try {
    const url = new URL(client.avatarUrl || client.avatar_url);
    if (url.protocol === 'https:') photo = url.href;
  } catch { /* Без загруженного аватара показываем изображение по полу или инициалы. */ }
  const initials = `${client.name?.[0] || ''}${client.surname?.[0] || ''}`;
  const key = JSON.stringify([client.id || '', placeholder, photo, initials]);
  const image = source => `<img src="${trainerEscape(source)}" alt="" loading="eager" decoding="sync" onerror="trainerAvatarImageFailed(this)">`;
  return `<span class="trainer-avatar${large ? ' is-large' : ''}" data-trainer-avatar="${trainerEscape(key)}" aria-hidden="true"><span class="trainer-avatar-initials"${placeholder || photo ? ' hidden' : ''}>${trainerEscape(initials)}</span>${placeholder ? image(placeholder) : ''}${photo ? image(photo) : ''}</span>`;
}
function trainerAvatarImageFailed(image) {
  const avatar = image.parentElement;
  image.remove();
  if (avatar && !avatar.querySelector('img')) avatar.querySelector('.trainer-avatar-initials').hidden = false;
}
function trainerRenderPreservingAvatars(root, markup) {
  // Сохраняем декодированные изображения при обновлении вкладок и форм.
  const avatars = new Map();
  root.querySelectorAll('[data-trainer-avatar]').forEach(avatar => {
    const key = avatar.dataset.trainerAvatar;
    if (!avatars.has(key)) avatars.set(key, []);
    avatars.get(key).push(avatar);
  });
  root.innerHTML = markup;
  root.querySelectorAll('[data-trainer-avatar]').forEach(avatar => {
    const previous = avatars.get(avatar.dataset.trainerAvatar)?.shift();
    if (previous) {
      previous.className = avatar.className;
      avatar.replaceWith(previous);
    }
  });
}
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
  const profileShortcut = `<button type="button" class="trainer-profile-shortcut" data-action="navigate" data-page="profile" aria-label="Профиль тренера" title="Профиль">${trainerAvatar({ ...trainerStore.state.trainer, id: 'trainer-profile' })}</button>`;
  if (trainerUI.route.page === 'today') {
    return `<header class="trainer-header"><div class="trainer-header-brand"><div class="logo" aria-label="TRENZO">TREN<span>ZO</span></div></div><div class="trainer-header-actions">${profileShortcut}</div></header>`;
  }
  if (trainerUI.route.page === 'clients') {
    const count = trainerStore.state.clients.length;
    const plural = new Intl.PluralRules('ru-RU').select(count);
    return `<header class="trainer-header trainer-clients-header"><h1>В команде ${count} ${plural === 'few' ? 'человека' : 'человек'}</h1><div class="trainer-header-actions">${trainerAction('add-client', `${trainerIcon('plus')}<span class="trainer-sr-only">Добавить подопечного</span>`, {}, 'trainer-clients-add')}</div></header>`;
  }
  return '';
}
function trainerNavigation() {
  let active = trainerUI.route.page;
  if (['client', 'client-questionnaire', 'memory'].includes(active)) active = 'clients';
  if (['tasks', 'chats', 'chat', 'income'].includes(active)) active = 'today';
  if (active === 'review') active = 'reviews';
  if (['program', 'program-new', 'program-edit', 'library-workout'].includes(active)) active = trainerUI.route.clientId ? 'clients' : 'programs';
  return `<nav class="trainer-navigation" aria-label="Разделы тренера">${[['today', 'Главная', 'home'], ['clients', 'Клиенты', 'clients'], ['reviews', 'Отчёты', 'reviews'], ['programs', 'Схемы', 'programs'], ['analytics', 'Аналитика', 'analytics']].map(([page, label, icon]) => `<button type="button" data-action="navigate" data-page="${page}" ${active === page ? 'aria-current="page"' : ''}>${trainerIcon(icon)}<span>${label}</span>${page === 'reviews' && trenzoReportPendingCount() ? `<b class="report-navigation-count" aria-label="Ожидают проверки: ${trenzoReportPendingCount()}">${trenzoReportPendingCount()}</b>` : ''}</button>`).join('')}</nav>`;
}
function trainerFilterTabs(items, active, action) { return `<div class="trainer-filter-tabs" role="group" aria-label="Фильтр">${items.map(([value, label]) => `<button type="button" aria-pressed="${value === active}" data-action="${action}" data-value="${value}">${label}</button>`).join('')}</div>`; }
function trainerReviewCard(review, compact = false) {
  if (review.kind === 'weekly') return trainerWeeklyReviewCard(review);
  const client = trainerStore.client(review.clientId);
  return `<button type="button" class="trainer-card trainer-review-card${compact ? ' is-compact' : ''}" data-action="review" data-id="${review.id}" aria-label="${trainerStore.pending(review) ? 'Разобрать' : 'Открыть разбор'}: ${trainerEscape(client.name)}, ${trainerEscape(review.title)}">${trainerAvatar(client)}<span class="trainer-review-copy"><strong>${trainerEscape(client.name)}</strong><span>${trainerEscape(compact ? review.type : review.title)}</span><small>${compact ? trainerRelative(review.occurredAt) : trainerTimeLabel(review.occurredAt)}</small>${!compact ? trainerTags(review.tags) : ''}</span>${!compact ? trainerBadge(review.status, true) : trainerIcon('arrow')}</button>`;
}
function trainerPeriodLabel(review) {
  const date = value => value.split('-').reverse().join('.');
  return `${date(review.start)} — ${date(review.end)}`;
}
function trainerWeeklyProgress(data) {
  const directions = data.comparisons.filter(item => item.direction !== 'unknown').map(item => item.direction);
  if (!directions.length) return { direction: 'unknown', label: 'Нет сравнения' };
  if (directions.every(item => ['up', 'stable'].includes(item)) && directions.includes('up')) return { direction: 'up', label: 'Нагрузка ↑' };
  if (directions.every(item => ['down', 'stable'].includes(item)) && directions.includes('down')) return { direction: 'down', label: 'Нагрузка ↓' };
  if (directions.every(item => item === 'stable')) return { direction: 'stable', label: 'Без изменений' };
  return { direction: 'mixed', label: 'Разная динамика' };
}
function trainerWeeklyReviewCard(review) {
  const client = trainerStore.client(review.clientId), data = trainerStore.weeklyData(review.id), progress = trainerWeeklyProgress(data);
  return `<button type="button" class="trainer-card trainer-weekly-card" data-action="review" data-id="${trainerEscape(review.id)}" aria-label="Разбор: ${trainerEscape(trainerFullName(client))}, ${trainerPeriodLabel(review)}"><span class="trainer-weekly-card-head">${trainerAvatar(client)}<span><strong>${trainerEscape(trainerFullName(client))}</strong><small>Разбор за ${trainerPeriodLabel(review)}</small></span>${trainerIcon('arrow')}</span><span class="trainer-weekly-card-meta"><span class="trainer-weekly-state${trainerStore.pending(review) ? '' : ' is-complete'}">${trainerStore.pending(review) ? 'К разбору' : 'Разобрано'}</span><span>Тренировки ${data.workouts.length}${review.plan ? ` / ${review.plan.sessions.length}` : ' · без плана'}</span><span>Питание ${data.nutrition.length} / 7 дней</span><span class="trainer-weekly-trend is-${progress.direction}">${progress.label}</span></span></button>`;
}
const trainerWeekdays = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
function trainerReviewScheduleForm() {
  const schedule = trainerStore.state.trainer.reviewSchedule;
  return `<form class="trainer-form" data-form="review-schedule"><label class="trainer-field">День разбора<select name="day">${trainerWeekdays.map((label, day) => `<option value="${day}" ${day === schedule.day ? 'selected' : ''}>${label}</option>`).join('')}</select></label>${trainerField('Время', 'time', schedule.time, { type: 'time', required: true })}${trainerField('Часовой пояс', 'timeZone', schedule.timeZone, { required: true, maxlength: 80 })}<p class="trainer-muted">Разбираем семь полных дней перед выбранным днём. Новая настройка действует для будущих разборов; архив сохраняется.</p><p class="trainer-demo-note">В MVP очередь обновляется при открытии кабинета. Фоновая отправка уведомлений ещё не подключена.</p><p class="trainer-form-error" role="alert"></p><button type="submit" class="trainer-button">Сохранить расписание</button></form>`;
}
function trainerSetLabel(set) {
  if (Number.isFinite(set.duration_seconds)) return `${set.duration_seconds} сек`;
  return `${set.weight_kg == null ? '—' : trainerNumber(set.weight_kg)} кг × ${set.reps ?? '—'}`;
}
function trainerWeeklyTraining(review, data) {
  const sessions = review.plan?.sessions || [], assigned = new Set();
  const logsMarkup = logs => logs.map(workout => `<div class="trainer-weekly-workout-log"><small>${trainerDateLabel(workout.workout_date)}${workout.rpe != null ? ` · RPE ${trainerNumber(workout.rpe)}` : ''}</small>${workout.exercises.map(exercise => `<div class="trainer-weekly-exercise"><strong>${trainerEscape(exercise.name)}</strong><span>${exercise.sets.map(set => trainerEscape(trainerSetLabel(set))).join(' · ')}</span></div>`).join('')}</div>`).join('');
  const rows = sessions.map((session, index) => {
    // Если старый журнал не имеет sessionId, сопоставляем название только когда оно уникально.
    const uniqueTitle = sessions.filter(item => item.title === session.title).length === 1;
    const logs = data.workouts.filter(workout => (session.id && workout.sessionId ? session.id === workout.sessionId : uniqueTitle && session.title === workout.title));
    logs.forEach(item => assigned.add(item.id));
    return `<details class="trainer-card trainer-program-day trainer-weekly-session" ${index === 0 ? 'open' : ''}><summary><span><small>ДЕНЬ ${index + 1} · ${logs.length ? `Записано: ${logs.length}` : 'Нет записи'}</small><strong>${trainerEscape(session.title)}</strong></span>${trainerIcon('arrow')}</summary><div><h3>Назначено</h3>${session.exercises.map(exercise => `<div class="trainer-weekly-exercise"><strong>${trainerEscape(exercise.name)}</strong><span>${exercise.sets} × ${trainerEscape(exercise.reps)} · ${trainerNumber(exercise.weightKg)} кг</span></div>`).join('')}<h3>Факт из дневника</h3>${logs.length ? logsMarkup(logs) : '<p class="trainer-muted">Клиент не внёс результат этой тренировки. Это не подтверждённый пропуск.</p>'}</div></details>`;
  }).join('');
  const extra = data.workouts.filter(workout => !assigned.has(workout.id));
  return `<section>${trainerSection('Тренировки: план и факт')}<p class="trainer-muted trainer-weekly-section-note">${review.plan ? `${trainerEscape(review.plan.title)} · неделя программы ${review.plan.weekNumber}. План на начало периода сохранён отдельно.` : trainerEscape(review.planMissingReason)}</p><div class="trainer-list">${rows}${extra.map(workout => `<details class="trainer-card trainer-workout"><summary><span><strong>${trainerEscape(workout.title)}</strong><small>Запись вне сопоставленного плана</small></span>${trainerIcon('arrow')}</summary><div>${logsMarkup([workout])}</div></details>`).join('') || (!sessions.length ? '<p class="trainer-muted">Записей тренировок за период нет.</p>' : '')}</div><p class="trainer-muted">RPE — субъективная тяжесть тренировки, не повторы и не оценка прогресса.</p></section>`;
}
function trainerWeeklyNutrition(review, data) {
  const avg = key => { const values = data.nutrition.map(item => item[key]).filter(Number.isFinite); return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null; };
  const fields = [['calories', 'Калории', 'ккал'], ['protein_g', 'Белки', 'г'], ['fat_g', 'Жиры', 'г'], ['carbs_g', 'Углеводы', 'г']];
  const target = review.plan?.nutritionTarget;
  return `<section class="trainer-card">${trainerSection('Питание')}<p class="trainer-muted">Дневник заполнен за ${data.nutrition.length} из 7 дней. Среднее только по внесённым данным.</p><div class="trainer-metrics-grid">${fields.map(([key, label, unit]) => trainerMetric(label, avg(key) == null ? '—' : `${avg(key)} ${unit}`, target?.[key] != null ? `Цель на день: ${target[key]} ${unit}` : 'Цель на начало периода не сохранена')).join('')}</div><details class="trainer-weekly-nutrition"><summary>Дневник за неделю</summary><div class="trainer-nutrition-days">${Array.from({ length: 7 }, (_, index) => {
    const date = trainerShiftDate(review.start, index), entry = data.nutrition.find(item => item.report_date === date);
    return `<div><strong>${trainerDateLabel(date)}</strong><span>${entry ? `${entry.calories ?? '—'} ккал<small>Б ${entry.protein_g ?? '—'} · Ж ${entry.fat_g ?? '—'} · У ${entry.carbs_g ?? '—'} г</small>` : 'Нет записи'}</span></div>`;
  }).join('')}</div></details></section>`;
}
function trainerWeeklyMedia(data, type) {
  const title = type === 'photo' ? 'Фотоотчёт' : 'Видеоотчёты', items = data.media.filter(item => item.type === type);
  return `<section class="trainer-card">${trainerSection(title, items.length)}${items.length ? `<div class="trainer-weekly-media">${items.map(item => {
    let url = ''; try { const parsed = new URL(item.url); if (parsed.protocol === 'https:') url = parsed.href; } catch { /* Неверный URL не вставляется в DOM. */ }
    return `<figure>${url ? type === 'photo' ? `<img src="${trainerEscape(url)}" alt="${trainerEscape(item.caption || 'Фотоотчёт клиента')}" loading="lazy">` : `<video src="${trainerEscape(url)}" controls preload="metadata" playsinline aria-label="${trainerEscape(item.caption || 'Видеоотчёт клиента')}"></video>` : '<p class="trainer-muted">Файл недоступен: нет безопасной ссылки.</p>'}<figcaption>${trainerDateLabel(item.recorded_on)}${item.caption ? ` · ${trainerEscape(item.caption)}` : ''}</figcaption></figure>`;
  }).join('')}</div>` : `<p class="trainer-muted">${type === 'photo' ? 'Фото' : 'Видео'} за эту неделю не поступили. Загрузка клиентом ещё не подключена.</p>`}<small>Просматривает тренер. ИИ не анализирует фото и видео.</small></section>`;
}
function trainerWeeklyReview(review) {
  const client = trainerStore.client(review.clientId), data = trainerStore.weeklyData(review.id), pending = trainerStore.pending(review);
  const weight = data.latestWeight, measurements = data.measurements;
  const currentWeight = client.weights.slice().sort((a, b) => a.measured_on.localeCompare(b.measured_on)).pop();
  const noteValue = trainerUI.reviewNoteDrafts[review.id] ?? review.note;
  const measurementLabels = { waist_cm: 'Талия', chest_cm: 'Грудь', hips_cm: 'Бёдра' };
  return `<div class="trainer-page-heading trainer-weekly-heading"><p class="trainer-kicker">НЕДЕЛЬНЫЙ РАЗБОР</p><h1>${trainerEscape(trainerFullName(client))}</h1><p>${trainerPeriodLabel(review)} · ${trainerEscape(review.timeZone)}</p><span class="trainer-weekly-state${pending ? '' : ' is-complete'}">${pending ? 'К разбору' : 'Разобрано'}</span>${trainerAction('client', 'Карточка клиента →', { id: client.id }, 'trainer-text-button')}</div>
    <section class="trainer-card">${trainerSection('Вес и замеры')}<div class="trainer-metrics-grid">${trainerMetric('Текущий вес', currentWeight ? `${trainerNumber(currentWeight.weight_kg)} кг` : 'Нет данных', currentWeight ? trainerDateLabel(currentWeight.measured_on) : '')}${trainerMetric('Последний вес к концу недели', weight ? `${trainerNumber(weight.weight_kg)} кг` : 'Нет данных', weight ? trainerDateLabel(weight.measured_on) : '')}${trainerMetric('Изменение веса', trainerDelta(data.weightDelta), 'К последнему замеру до начала недели')}${measurements ? Object.entries(measurementLabels).filter(([key]) => measurements[key] != null).map(([key, label]) => trainerMetric(label, `${measurements[key]} см`, trainerDateLabel(measurements.measured_on))).join('') : ''}</div>${!measurements ? '<p class="trainer-muted">Датированных замеров к концу недели нет.</p>' : measurements.measured_on < review.start ? '<p class="trainer-muted">Показаны последние доступные замеры до этой недели.</p>' : ''}${weight?.measured_on < review.start ? '<p class="trainer-muted">Вес за эту неделю не внесён — показан предыдущий замер.</p>' : ''}</section>
    ${trainerWeeklyTraining(review, data)}<section class="trainer-card">${trainerSection('Динамика в упражнениях')}<p class="trainer-muted">Последнее выполнение упражнения в этой неделе сравниваем с последним в предыдущих семи днях — только в том же тренировочном дне и с тем же числом подходов. ↑ и ↓ показывают нагрузку, а не достижение цели.</p><div class="trainer-weekly-comparisons">${data.comparisons.map(item => `<details><summary><span><strong>${trainerEscape(item.name)}</strong><small>${trainerEscape(item.session)}</small></span><span class="trainer-weekly-trend is-${item.direction}">${{ up: '↑', down: '↓', stable: '=', mixed: '↕', unknown: 'Нет сравнения' }[item.direction]}</span></summary><p>${item.previous ? `Было (${trainerDateLabel(item.previousDate)}): ${item.previous.sets.map(set => trainerEscape(trainerSetLabel(set))).join(' · ')}<br>` : ''}Сейчас (${trainerDateLabel(item.date)}): ${item.current.sets.map(set => trainerEscape(trainerSetLabel(set))).join(' · ')}</p>${item.direction === 'unknown' ? '<small>Не хватает сопоставимых записей либо подходы измерены по времени.</small>' : ''}</details>`).join('') || '<p class="trainer-muted">Нет записей для сравнения.</p>'}</div></section>
    ${trainerWeeklyNutrition(review, data)}${trainerWeeklyMedia(data, 'photo')}${trainerWeeklyMedia(data, 'video')}
    <section class="trainer-card trainer-weekly-decision">${trainerSection('Итог и следующая неделя')}${pending ? `<form class="trainer-form" data-form="weekly-note" data-id="${trainerEscape(review.id)}">${trainerField('Решение тренера', 'note', noteValue, { multiline: true, maxlength: 2000, extra: 'placeholder="Что меняем или сохраняем в тренировках и питании?" data-weekly-note' })}<p class="trainer-muted">Завершение разбора сохраняет решение, но не меняет программу автоматически. Подготовить следующую неделю можно в программе клиента.</p><p class="trainer-form-error" role="alert"></p><div class="trainer-button-row"><button type="submit" name="intent" value="save" class="trainer-secondary-button">Сохранить черновик</button><button type="submit" name="intent" value="complete" class="trainer-button">Завершить разбор</button></div></form>` : `<p>${trainerEscape(review.note)}</p><small>Завершён ${trainerDateLabel(review.decidedAt)}. Данные недели зафиксированы.</small>`}${client.programId ? trainerAction('client-program', 'Открыть программу клиента →', { id: client.id }, 'trainer-text-button') : trainerAction('client-programs', 'Выбрать программу →', { id: client.id }, 'trainer-text-button')}</section>`;
}
function trainerToday() {
  const { clients } = trainerStore.state;
  const weekStart = trainerDemoDate(6);
  const activeClients = clients.filter(client => client.activityDate && client.activityDate >= weekStart).length;
  const completedWorkouts = clients.reduce((total, client) => total + (Number(client.metrics.workoutCompleted) || 0), 0);
  const submittedAnswers = trenzoReports.list().filter(report => report.submission?.submittedAt.slice(0, 10) >= weekStart).length;
  return `<section class="trainer-dashboard" aria-labelledby="trainerDashboardTitle"><h2 id="trainerDashboardTitle">Недельные показатели</h2><div class="trainer-dashboard-metrics">${trainerDashboardMetric('clients', activeClients, 'Активные|клиенты')}${trainerDashboardMetric('programs', completedWorkouts, 'Выполнено|тренировок', true)}${trainerDashboardMetric('reports', submittedAnswers, 'Сдано|отчетов')}</div></section>
    <section class="trainer-home-tools" aria-label="Инструменты тренера">
      ${trainerAction('navigate', `<span class="trainer-home-tool-icon">${trainerIcon('task')}</span><span class="trainer-home-tool-copy"><strong>Мои задачи</strong><small>Личные дела и задачи от TRENZO</small></span>${trainerIcon('arrow')}`, { page: 'tasks' }, 'trainer-card trainer-home-shortcut')}
      ${trainerAction('navigate', `<span class="trainer-home-tool-icon">${trainerIcon('chat')}</span><span class="trainer-home-tool-copy"><strong>Чаты с клиентами</strong><small>Переписки и карточки подопечных</small></span>${trainerIcon('arrow')}`, { page: 'chats' }, 'trainer-card trainer-home-shortcut')}
      ${trainerAction('navigate', `<span class="trainer-home-tool-icon">${trainerIcon('income')}</span><span class="trainer-home-tool-copy"><strong>Доходы</strong><small>Планирование и учёт</small></span>${trainerIcon('arrow')}`, { page: 'income' }, 'trainer-card trainer-home-shortcut')}
      ${trainerAction('navigate', `<span class="trainer-home-tool-icon is-ai">${trainerAssistantIcon()}</span><span class="trainer-home-tool-copy"><strong>Личный ассистент</strong><small>Помощь и разборы на основе данных</small></span>${trainerIcon('arrow')}`, { page: 'ai' }, 'trainer-card trainer-home-shortcut')}
    </section>`;
}

function trainerTasks() {
  const aiTasks = trenzoReports.list().filter(report => trenzoReports.status(report) === 'submitted').sort((a, b) => trenzoReports.analyze(b.id).priority - trenzoReports.analyze(a.id).priority);
  const personalTasks = trainerUI.tasks;
  const personalMarkup = personalTasks.length ? personalTasks.map(task => `<article class="trainer-card trainer-task-row${task.done ? ' is-complete' : ''}"><button type="button" class="trainer-task-toggle" data-action="toggle-task" data-id="${trainerEscape(task.id)}" aria-pressed="${task.done}" aria-label="${task.done ? 'Отметить невыполненной' : 'Отметить выполненной'}: ${trainerEscape(task.title)}">${task.done ? trainerIcon('check') : ''}</button><span class="trainer-task-copy"><strong>${trainerEscape(task.title)}</strong><small>${task.done ? 'Выполнено' : 'Личная задача'}</small></span><button type="button" class="trainer-task-delete" data-action="delete-task" data-id="${trainerEscape(task.id)}" aria-label="Удалить задачу">${trainerIcon('close')}</button></article>`).join('') : '<p class="trainer-muted trainer-task-empty">Пока нет личных задач. Добавь первую — она сохранится на этом устройстве.</p>';
  const aiMarkup = aiTasks.length ? aiTasks.map(review => {
    const client = trainerStore.client(review.clientId);
    return `<button type="button" class="trainer-card trainer-ai-task" data-action="review" data-id="${trainerEscape(review.id)}"><span class="trainer-home-tool-icon is-ai">${trainerIcon('ai')}</span><span class="trainer-ai-task-copy"><small>TRENZO · ${trainerEscape(trainerFullName(client))}</small><strong>Провести недельный разбор</strong><span>${trainerPeriodLabel(review)}</span></span>${trainerIcon('arrow')}</button>`;
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
  const status = trainerStore.clientState(client.id);
  const label = trainerClientStateOptions.find(([value]) => value === status)?.[1] || 'Мало данных';
  const tag = String(client.tag || '').trim() || client.goal;
  return `<button type="button" class="trainer-card trainer-client-card" data-action="client" data-id="${client.id}" aria-label="Открыть подопечного ${trainerEscape(trainerFullName(client))}, статус: ${trainerEscape(label)}, тег: ${trainerEscape(tag)}">
    ${trainerAvatar(client)}<span class="trainer-client-copy"><strong>${trainerEscape(trainerFullName(client))}</strong><small>${trainerEscape(tag)}</small></span>
    <span class="trainer-client-status is-${status}">${label}</span>${trainerIcon('arrow')}</button>`;
}
function trainerFilteredClients() {
  const normalize = text => text.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');
  const words = normalize(trainerUI.search.trim()).split(/\s+/).filter(Boolean);
  return trainerStore.state.clients.filter(client => {
    const matches = trainerUI.clientFilter === 'all' || trainerStore.clientState(client.id) === trainerUI.clientFilter;
    const text = normalize(`${trainerFullName(client)} ${client.tag || ''} ${client.goal}`);
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
    <p class="trainer-clients-state-note">Статус считается автоматически по данным недели.</p>
    ${trainerFilterTabs([['all', 'Все'], ...trainerClientStateOptions], trainerUI.clientFilter, 'client-filter')}
    <p class="trainer-sr-only" id="trainerClientResults" role="status">Найдено: ${trainerFilteredClients().length}</p>
    <ul class="trainer-list trainer-clients-list" id="trainerClientList" aria-label="Клиенты">${trainerClientListMarkup()}</ul>`;
}
function trainerClientOverview(client, now = Date.now()) {
  const metrics = client.metrics;
  const program = trainerStore.clientProgram(client.id);
  const schedule = trainerStore.state.trainer.reviewSchedule;
  const lastScheduledReview = trainerWeeklyPeriod(schedule, now);
  const nextReportDate = trainerShiftDate(lastScheduledReview.reviewDate, 7);
  const currentWeek = { start: trainerShiftDate(nextReportDate, -7), end: trainerShiftDate(nextReportDate, -1) };
  const workouts = Number(metrics.workoutCompleted) || 0;
  const workoutPlan = Number(metrics.workoutTarget) > 0 ? `${metrics.workoutTarget}` : null;
  const clientState = trainerStore.clientState(client.id);
  const clientStateLabel = trainerClientStateOptions.find(([value]) => value === clientState)?.[1] || 'Мало данных';
  const weeklySummary = `<section class="trainer-card trainer-current-week"><div class="trainer-current-week-heading"><h2>Текущая неделя</h2><span class="trainer-current-week-range">${trainerPeriodLabel(currentWeek)}</span></div><div class="trainer-metrics-grid">
      ${trainerMetric('Тренировки', workoutPlan ? `${workouts} из ${workoutPlan}` : 'План не задан')}<div class="trainer-metric"><span>Статус</span><strong class="trainer-client-status trainer-current-week-status is-${clientState}">${trainerEscape(clientStateLabel)}</strong></div>
      ${trainerMetric('Соблюдение питания', metrics.nutritionPercent == null ? 'Нет данных' : `${metrics.nutritionPercent}%`)}${trainerMetric('Система тренировок', trainerProgramSystem(program))}
      ${trainerMetric('Изменение веса', trainerOverviewWeightChange(metrics.weightDelta))}${trainerMetric('Следующий отчёт', nextReportDate.split('-').reverse().join('.'))}
    </div></section>`;
  return `${weeklySummary}${trenzoClientOverviewReports(client)}`;
}
function trainerTrainingWeek(client, now = Date.now()) {
  const schedule = trainerStore.state.trainer.reviewSchedule;
  const start = trainerWeeklyPeriod(schedule, now).reviewDate;
  const end = trainerShiftDate(start, 6);
  const snapshot = (client.weekPlans || []).find(item => item.start === start)?.plan;
  const program = trainerStore.clientProgram(client.id);
  const weekIndex = program ? Math.max(0, Math.min(client.currentWeek - 1, program.weeks.length - 1)) : -1;
  const fallbackWeek = weekIndex >= 0 ? program.weeks[weekIndex] : null;
  const plan = snapshot?.sessions?.length ? snapshot : fallbackWeek ? { title: program.title, weekNumber: client.currentWeek, sessions: fallbackWeek.sessions } : null;
  const workouts = client.workouts.filter(workout => workout.workout_date >= start && workout.workout_date <= end).sort((a, b) => a.workout_date.localeCompare(b.workout_date));
  return { start, end, plan, workouts, program };
}
function trainerSessionWorkout(session, sessions, workouts) {
  const uniqueTitle = sessions.filter(item => item.title === session.title).length === 1;
  return workouts.find(workout => session.id && workout.sessionId && session.id === workout.sessionId)
    || (uniqueTitle ? workouts.find(workout => !workout.sessionId && session.title === workout.title) : null)
    || null;
}
function trainerPlannedExerciseValue(exercise) {
  return `${exercise.sets} × ${exercise.reps}${exercise.weightKg != null ? ` · ${trainerNumber(exercise.weightKg)} кг` : ''}`;
}
function trainerTrainingFactMarkup(exercise) {
  const sets = exercise?.sets || [];
  return sets.length ? sets.map(set => trainerEscape(trainerSetLabel(set))).join(' · ') : '—';
}
function trainerPlannedSessionMarkup(session, workout) {
  const actualExercises = workout?.exercises || [], matched = new Set();
  const planned = session.exercises.map(exercise => {
    const actualIndex = actualExercises.findIndex((item, index) => !matched.has(index) && (exercise.exerciseId && item.exerciseId ? exercise.exerciseId === item.exerciseId : exercise.name === item.name));
    const actual = actualIndex >= 0 ? actualExercises[actualIndex] : null;
    if (actualIndex >= 0) matched.add(actualIndex);
    return `<div class="trainer-training-exercise"><strong>${trainerEscape(exercise.name)}</strong>${workout ? '' : `<small>План: ${trainerEscape(trainerPlannedExerciseValue(exercise))}</small>`}<span class="trainer-training-fact${actual?.sets?.length ? ' is-recorded' : ''}">Факт клиента: ${trainerTrainingFactMarkup(actual)}</span></div>`;
  }).join('');
  const extra = actualExercises.filter((_, index) => !matched.has(index)).map(exercise => `<div class="trainer-training-exercise is-extra"><strong>${trainerEscape(exercise.name)}</strong><span class="trainer-training-fact is-recorded">Факт клиента: ${trainerTrainingFactMarkup(exercise)}</span></div>`).join('');
  return `${planned}${extra ? `<div class="trainer-training-extra"><small>Дополнительно записано</small>${extra}</div>` : ''}`;
}
function trainerTrainingHistory(client) {
  const today = trainerDemoDate(), firstDate = client.joinedOn || client.workouts.map(item => item.workout_date).sort()[0];
  if (!firstDate || firstDate > today) return { weeks: [], selected: null };
  const totalWeeks = Math.max(1, Math.ceil((trainerDayDistance(firstDate, today) + 1) / 7));
  const weeks = Array.from({ length: totalWeeks }, (_, index) => {
    const start = trainerShiftDate(firstDate, index * 7), end = [trainerShiftDate(start, 6), today].sort()[0];
    return { number: index + 1, start, end, workouts: client.workouts.filter(item => item.workout_date >= start && item.workout_date <= end).sort((a, b) => b.workout_date.localeCompare(a.workout_date)) };
  });
  const preferred = weeks.slice().reverse().find(week => week.workouts.length) || weeks[weeks.length - 1];
  const selected = weeks.find(week => week.start === trainerUI.trainingHistoryWeeks[client.id]) || preferred;
  return { weeks: weeks.slice().reverse(), selected };
}
function trainerWorkoutHistoryCard(workout) {
  return `<details class="trainer-card trainer-workout"><summary><span><strong>${trainerEscape(workout.title)}</strong><small>${trainerDateLabel(workout.workout_date)}${workout.rpe != null ? ` · RPE ${trainerNumber(workout.rpe)}` : ''}</small></span>${trainerIcon('arrow')}</summary><div>${workout.exercises.map(exercise => `<div class="trainer-training-exercise"><strong>${trainerEscape(exercise.name)}</strong><span class="trainer-training-fact is-recorded">${trainerTrainingFactMarkup(exercise)}</span></div>`).join('') || '<p class="trainer-muted">В тренировке нет записей упражнений.</p>'}</div></details>`;
}
function trainerClientTraining(client) {
  const current = trainerTrainingWeek(client), history = trainerTrainingHistory(client);
  const currentSessions = current.plan?.sessions || [];
  const sessionRows = currentSessions.map(session => {
    const workout = trainerSessionWorkout(session, currentSessions, current.workouts);
    return `<details class="trainer-card trainer-training-day"><summary><span><strong>${trainerEscape(session.title)}</strong><small>${session.exercises.length} упражнений · ${workout ? `Выполнена · ${trainerDateLabel(workout.workout_date)}` : 'Нет записи'}</small></span><span class="trainer-session-status${workout ? ' is-done' : ''}">${trainerIcon(workout ? 'check' : 'programs')}</span></summary><div class="trainer-training-content">${trainerPlannedSessionMarkup(session, workout)}</div></details>`;
  }).join('');
  const completedCount = currentSessions.filter(session => trainerSessionWorkout(session, currentSessions, current.workouts)).length;
  const currentProgram = current.program
    ? `<section class="trainer-card"><p class="trainer-kicker">ТЕКУЩАЯ ПРОГРАММА</p><h2>${trainerEscape(current.program.title)}</h2><p>Неделя ${client.currentWeek} из ${current.program.weeks.length}</p><div class="trainer-button-row">${trainerAction('client-program', 'Открыть программу', { id: client.id }, 'trainer-secondary-button')}</div></section>`
    : trainerEmpty('Программа ещё не назначена', 'Выберите программу из своих или создайте новую.', trainerAction('client-programs', 'Выбрать программу', { id: client.id }));
  const currentWeekCount = currentSessions.length ? `${completedCount} из ${currentSessions.length}` : null;
  const currentWeekMarkup = `<section><div class="trainer-section-heading trainer-training-week-heading"><h2>Текущая неделя${currentWeekCount ? `<span class="trainer-count">${trainerEscape(currentWeekCount)}</span>` : ''}</h2><span class="trainer-muted trainer-training-period">${trainerPeriodLabel({ start: current.start, end: current.end })}</span></div><div class="trainer-list">${sessionRows || '<p class="trainer-muted">На эту неделю тренировки не запланированы.</p>'}</div></section>`;
  const selectedHistory = history.selected;
  const weekOptions = history.weeks.map(week => `<option value="${week.start}" ${week.start === selectedHistory?.start ? 'selected' : ''}>Неделя ${week.number} · ${trainerPeriodLabel(week)}</option>`).join('');
  const historyMarkup = `<section>${trainerSection('История тренировок')}${history.weeks.length ? `<label class="trainer-field trainer-training-history-filter">Неделя<select data-training-history-week aria-label="Неделя истории тренировок">${weekOptions}</select></label><div class="trainer-list">${selectedHistory?.workouts.length ? selectedHistory.workouts.map(trainerWorkoutHistoryCard).join('') : '<p class="trainer-muted">За эту неделю записей тренировок нет.</p>'}</div>` : '<p class="trainer-muted">История появится после первой записи тренировки.</p>'}</section>`;
  return `${currentProgram}${currentWeekMarkup}${historyMarkup}`;
}
function trainerClientNutrition(client) {
  const currentWeek = trainerTrainingWeek(client);
  const targets = client.nutritionTarget || {};
  const entries = new Map(client.nutrition.map(entry => [entry.report_date, entry]));
  const currentEntries = client.nutrition.filter(entry => entry.report_date >= currentWeek.start && entry.report_date <= currentWeek.end);
  const currentCompliance = currentEntries.length ? client.metrics.nutritionPercent : null;
  const targetValue = (key, unit) => targets[key] != null && Number.isFinite(Number(targets[key])) ? `${Math.round(targets[key])} ${unit}` : '—';
  const diaryRows = Array.from({ length: 7 }, (_, index) => {
    const date = trainerShiftDate(currentWeek.start, index), entry = entries.get(date);
    return `<div class="trainer-nutrition-day${entry ? ' is-recorded' : ' is-empty'}"><strong>${trainerDateLabel(date)}</strong><span>${entry ? `${Math.round(entry.calories)} ккал<small>Б ${Math.round(entry.protein_g)} · Ж ${Math.round(entry.fat_g)} · У ${Math.round(entry.carbs_g)} г</small>` : '<small>Нет записи</small>'}</span></div>`;
  }).join('');
  const history = trainerNutritionHistory(client, currentWeek);
  const selectedHistory = history.selected;
  const historyOptions = history.weeks.map(week => `<option value="${week.start}" ${week.start === selectedHistory?.start ? 'selected' : ''}>Неделя ${week.number} · ${trainerPeriodLabel(week)}</option>`).join('');
  const historyRows = selectedHistory?.entries.map(entry => `<div class="trainer-nutrition-day is-recorded"><strong>${trainerDateLabel(entry.report_date)}</strong><span>${Math.round(entry.calories)} ккал<small>Б ${Math.round(entry.protein_g)} · Ж ${Math.round(entry.fat_g)} · У ${Math.round(entry.carbs_g)} г</small></span></div>`).join('');
  return `<section class="trainer-card trainer-nutrition-plan">${trainerSection('Ежедневный план на неделю')}<div class="trainer-metrics-grid">${trainerMetric('Калории', targetValue('calories', 'ккал'))}${trainerMetric('Белки', targetValue('protein_g', 'г'))}${trainerMetric('Жиры', targetValue('fat_g', 'г'))}${trainerMetric('Углеводы', targetValue('carbs_g', 'г'))}${trainerMetric('Выполнение цели', currentCompliance == null ? '—' : `${Math.round(currentCompliance)}%`, currentCompliance == null ? 'Нет данных за текущую неделю' : 'За текущую неделю')}</div></section>
    <section>${trainerSection('Дневник питания')}<p class="trainer-muted trainer-nutrition-period">${trainerPeriodLabel(currentWeek)}</p><div class="trainer-card trainer-nutrition-days">${diaryRows}</div></section>
    <section>${trainerSection('История питания')}${history.weeks.length ? `<label class="trainer-field trainer-training-history-filter">Неделя<select data-nutrition-history-week aria-label="Неделя истории питания">${historyOptions}</select></label><div class="trainer-card trainer-nutrition-days">${historyRows || '<p class="trainer-muted">За эту неделю записей питания нет.</p>'}</div>` : '<p class="trainer-muted">История появится после первой записи питания.</p>'}</section>`;
}
function trainerNutritionHistory(client, currentWeek = trainerTrainingWeek(client)) {
  const recordedDates = client.nutrition.map(entry => entry.report_date).filter(Boolean).sort();
  if (!recordedDates.length) return { weeks: [], selected: null };
  const firstDate = [recordedDates[0], client.joinedOn].filter(Boolean).sort()[0];
  const oldestStart = trainerDayDistance(firstDate, currentWeek.start) > 0 ? firstDate : currentWeek.start;
  const totalWeeks = Math.max(1, Math.ceil(trainerDayDistance(oldestStart, currentWeek.start) / 7));
  const weeks = Array.from({ length: totalWeeks }, (_, index) => {
    const start = trainerShiftDate(currentWeek.start, -(index + 1) * 7), end = trainerShiftDate(start, 6);
    return { number: totalWeeks - index, start, end, entries: client.nutrition.filter(entry => entry.report_date >= start && entry.report_date <= end).sort((a, b) => a.report_date.localeCompare(b.report_date)) };
  }).filter(week => week.entries.length);
  const preferred = weeks.find(week => week.entries.length);
  const selected = weeks.find(week => week.start === trainerUI.nutritionHistoryWeeks[client.id]) || preferred;
  return { weeks, selected };
}
function trainerWeightChart(client) {
  if (client.weights.length < 2) return '<p class="trainer-muted">График появится после двух взвешиваний.</p>';
  const values = client.weights.map(point => Number(point.weight_kg)), min = Math.min(...values) - 0.3, max = Math.max(...values) + 0.3;
  const points = values.map((value, i) => [26 + i / (values.length - 1) * 272, 120 - (value - min) / (max - min) * 88]);
  return `<svg class="trainer-weight-chart" viewBox="0 0 324 160" role="img" aria-label="Вес: ${trainerNumber(values[0])} → ${trainerNumber(values[values.length - 1])} килограмма за четыре недели"><path class="trainer-chart-grid" d="M26 32H298M26 76H298M26 120H298"/><polyline points="${points.map(p => p.join(',')).join(' ')}"/>${points.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4"/>`).join('')}<text x="26" y="149">${trainerDateLabel(client.weights[0].measured_on)}</text><text x="298" y="149" text-anchor="end">${trainerDateLabel(client.weights[client.weights.length - 1].measured_on)}</text><text x="298" y="22" text-anchor="end">${trainerNumber(values[values.length - 1])} кг</text></svg>`;
}
function trainerClientProgress(client) {
  const measurementKeys = [['shoulders_cm', 'Плечи'], ['chest_cm', 'Грудь'], ['biceps_cm', 'Бицепс'], ['waist_cm', 'Талия'], ['hips_cm', 'Бёдра']];
  const measurementHistory = (client.measurementHistory || []).slice().sort((a, b) => b.measured_on.localeCompare(a.measured_on));
  const latestMeasurements = measurementKeys.map(([key, label]) => {
    const source = measurementHistory.find(entry => entry[key] != null && Number.isFinite(Number(entry[key]))) || client.measurements || {};
    return { label, value: source[key], date: source.measured_on };
  });
  const measurementMarkup = `<div class="trainer-measurement-list">${latestMeasurements.map(item => `<div><span>${item.label}</span><strong>${item.value != null && item.value !== '' && Number.isFinite(Number(item.value)) ? `${trainerNumber(item.value)} см` : '—'}</strong>${item.date ? `<small>${trainerDateLabel(item.date)}</small>` : ''}</div>`).join('')}</div>`;
  const personalRecords = (client.records || []).slice(0, 5);
  const recordMarkup = personalRecords.length
    ? `<div class="trainer-facts trainer-record-list">${personalRecords.map(record => `<div><span>${trainerEscape(record.exercise)}</span><strong>${trainerEscape(record.value)}</strong></div>`).join('')}</div>`
    : '<p class="trainer-muted">Рекорды появятся после тренировок.</p>';
  const streak = trainerWorkoutStreak(client);
  const streakWord = streak.count % 10 === 1 && streak.count % 100 !== 11 ? 'неделя' : streak.count % 10 >= 2 && streak.count % 10 <= 4 && (streak.count % 100 < 12 || streak.count % 100 > 14) ? 'недели' : 'недель';
  return `<section class="trainer-card">${trainerSection('Динамика веса')}<div class="trainer-metric-inline"><strong>${trainerLatestWeight(client) == null ? '—' : `${trainerNumber(trainerLatestWeight(client))} кг`}</strong><span>${trainerDelta(client.metrics.weightDelta)} за неделю</span></div>${trainerWeightChart(client)}</section>
    <section class="trainer-card">${trainerSection('Последние замеры')}<div>${measurementMarkup}</div></section>
    <section class="trainer-card">${trainerSection('Топ-5 личных рекордов')}<div>${recordMarkup}</div></section>
    <section class="trainer-card">${trainerSection('Недели без пропусков')}<p class="trainer-metric-inline"><strong>${streak.hasData ? streak.count : '—'}</strong><span>${streak.hasData ? `${streakWord} подряд` : 'Нет завершённых недель'}</span></p>${streak.hasData ? '<p class="trainer-muted trainer-streak-note">Все запланированные тренировки выполнены</p>' : ''}</section>`;
}
function trainerWorkoutStreak(client, now = Date.now()) {
  const schedule = trainerStore.state.trainer.reviewSchedule;
  const activeStart = trainerWeeklyPeriod(schedule, now).reviewDate;
  let count = 0, checkedWeeks = 0;
  for (let offset = 1; offset <= 520; offset += 1) {
    const start = trainerShiftDate(activeStart, -offset * 7), end = trainerShiftDate(start, 6);
    // Первая неделя учитывается только если клиент был в команде с её начала;
    // частичная неделя после подключения не должна давать ложную серию.
    if (client.joinedOn && client.joinedOn > start) break;
    const savedPlan = (client.weekPlans || []).find(item => item.start === start)?.plan;
    const plan = savedPlan || trainerPlanAt(client, start);
    const sessions = plan?.sessions || [];
    if (!sessions.length) break;
    checkedWeeks += 1;
    const workouts = client.workouts.filter(workout => workout.workout_date >= start && workout.workout_date <= end);
    if (!sessions.every(session => trainerSessionWorkout(session, sessions, workouts))) break;
    count += 1;
  }
  return { count, hasData: checkedWeeks > 0 };
}
function trainerClientReportHistory(client) {
  const reports = trainerStore.state.weeklyReviews.filter(review => review.clientId === client.id).sort((a, b) => a.start.localeCompare(b.start));
  const periods = [...new Map(reports.map(review => [review.start, { start: review.start, end: review.end, reports: [] }])).values()];
  periods.forEach((period, index) => {
    period.number = index + 1;
    period.reports = reports.filter(report => report.start === period.start);
  });
  return periods.reverse();
}
function trainerClientReportCard(review) {
  const label = trainerStore.pending(review) ? 'Не разобран' : 'Проверен';
  return trainerAction('review', `<span class="trainer-client-report-copy"><strong>Отчёт за ${trainerPeriodLabel(review)}</strong><small>${label}</small></span>${trainerIcon('arrow')}`, { id: review.id }, 'trainer-card trainer-client-report-item');
}
function trainerClientReports(client) { return trenzoClientReports(client); }
function trainerQuestionnaireValue(field, value) {
  const labels = {
    sex: { male: 'Мужской', female: 'Женский', unspecified: 'Предпочитаю не указывать' },
    goal: { lose: 'Снизить вес', muscle: 'Набрать мышечную массу', recomp: 'Изменить состав тела', strength: 'Увеличить силовые показатели', fitness: 'Улучшить физическую форму', other: 'Другая цель' },
    experience: { new: 'Только начинаю', under1: 'До 1 года', '1to3': 'От 1 до 3 лет', '3to5': 'От 3 до 5 лет', '5plus': 'Более 5 лет' },
    recentTraining: { none: 'Почти не тренировался', irregular: 'Нерегулярно', '1to2': '1–2 раза в неделю', '3plus': '3 и более раз в неделю', program: 'Регулярно по программе' },
    duration: { under45: 'До 45 минут', '45to60': '45–60 минут', '60to90': '60–90 минут', over90: 'Более 90 минут' },
    nutritionTracking: { regular: 'Да, регулярно', sometimes: 'Иногда', no: 'Нет, не слежу' },
    nutritionWilling: { yes: 'Да', maybe: 'Скорее да', no: 'Пока нет' },
    meals: { '1to2': '1–2 раза', '3': '3 раза', '4': '4 раза', '5plus': '5 раз и более', varies: 'Каждый день по-разному' },
    trainingMode: { coach: 'С тренером', alone: 'Самостоятельно', none: 'Пока не тренируюсь' },
    programStatus: { has: 'Есть программа', no: 'Программы нет', create: 'Хочу составить программу' }
  };
  if (labels[field]?.[value]) return labels[field][value];
  if (field === 'frequency' && /^\d+$/.test(String(value))) return `${value} ${Number(value) === 1 ? 'раз' : 'раза'} в неделю`;
  if (field === 'age') return `${value} лет`;
  if (field === 'height') return `${value} см`;
  if (['weight', 'targetWeight'].includes(field)) return `${trainerNumber(value)} кг`;
  if (field === 'months') return `${value} мес.`;
  return String(value);
}
function trainerClientQuestionnaire(client) {
  if (!client) return trainerEmpty('Анкета недоступна', 'Клиент не найден.');
  const answers = client.questionnaire || client.athleteAnswers || client.profileAnswers || {};
  const groups = [
    ['О клиенте', [['name', 'Имя'], ['age', 'Возраст'], ['sex', 'Пол'], ['height', 'Рост'], ['weight', 'Вес']]],
    ['Цель и результат', [['goal', 'Основная цель'], ['targetWeight', 'Желаемый вес'], ['result', 'Желаемый результат'], ['months', 'Срок достижения']]],
    ['Тренировки', [['experience', 'Опыт тренировок'], ['recentTraining', 'Тренировки за последние 3 месяца'], ['frequency', 'Тренировок в неделю'], ['duration', 'Длительность тренировки'], ['trainingMode', 'Формат занятий'], ['programStatus', 'Тренировочная программа']]],
    ['Питание', [['nutritionTracking', 'Трекинг питания'], ['nutritionWilling', 'Готовность вести дневник'], ['meals', 'Приёмов пищи в день'], ['nutritionNotes', 'Особенности питания']]],
    ['Ограничения', [['restrictions', 'Здоровье и ограничения']]]
  ];
  const knownAnswers = groups.flatMap(([, fields]) => fields).filter(([field]) => answers[field] != null && String(answers[field]).trim());
  const sections = groups.map(([title, fields]) => {
    const rows = fields.filter(([field]) => answers[field] != null && String(answers[field]).trim()).map(([field, label]) => `<div><dt>${label}</dt><dd>${trainerEscape(trainerQuestionnaireValue(field, answers[field]))}</dd></div>`).join('');
    return rows ? `<section class="trainer-card trainer-questionnaire-section">${trainerSection(title)}<dl class="trainer-facts">${rows}</dl></section>` : '';
  }).join('');
  const available = [['Цель в карточке', client.goal], ['Место тренировок', client.equipment], ['Предпочтения', client.preferences], ['Ограничения в карточке', client.restrictions]].filter(([, value]) => value && !['Не указано', 'Не указаны', 'Без специальных предпочтений'].includes(value));
  const clientContext = available.length ? `<section class="trainer-card trainer-questionnaire-section">${trainerSection('Дополнительно в карточке')}<dl class="trainer-facts">${available.map(([label, value]) => `<div><dt>${label}</dt><dd>${trainerEscape(value)}</dd></div>`).join('')}</dl></section>` : '';
  return `<div class="trainer-page-heading"><p class="trainer-kicker">${trainerEscape(trainerFullName(client))}</p><h1>Анкета клиента</h1><p>Ответы, сохранённые в профиле клиента.</p></div>${knownAnswers.length ? sections : trainerEmpty('Ответы анкеты не подключены', 'В этой демо-карточке пока нет сохранённых ответов клиента.')}${clientContext}`;
}
function trainerClient() {
  const client = trainerStore.client(trainerUI.route.id);
  if (!client) return trainerEmpty('Подопечный не найден', 'Вернитесь к списку подопечных.', trainerAction('navigate', 'Подопечные', { page: 'clients' }));
  const tab = trainerUI.route.tab || 'overview', weight = trainerLatestWeight(client);
  const tag = String(client.tag || '').trim() || client.goal;
  const editingTag = trainerUI.editingClientTag === client.id;
  const tagMarkup = editingTag
    ? `<div class="trainer-client-tag-row"><span class="trainer-client-tag-label"># Тег:</span><form class="trainer-client-tag-edit" data-form="edit-client-tag" data-id="${trainerEscape(client.id)}"><input name="tag" data-client-tag-input maxlength="${trainerClientTagMaxLength}" value="${trainerEscape(tag)}" placeholder="до ${trainerClientTagMaxLength} символов" aria-label="Тег клиента"><button type="submit" aria-label="Сохранить тег">${trainerIcon('check')}</button><button type="button" data-action="cancel-client-tag" aria-label="Отменить изменение тега">${trainerIcon('close')}</button></form></div>`
    : `<div class="trainer-client-tag-row"><span class="trainer-client-tag-label"># Тег:</span><span class="trainer-client-tag-value">${trainerEscape(tag)}</span><button type="button" data-action="edit-client-tag" data-id="${trainerEscape(client.id)}" aria-label="Изменить тег">${trainerIcon('edit')}</button></div>`;
  const weightSummary = weight == null ? 'Вес не внесён' : `${trainerNumber(weight)} кг`;
  const targetSummary = client.targetWeight != null ? ` → цель ${trainerNumber(client.targetWeight)} кг` : '';
  return `<section class="trainer-client-heading"><div class="trainer-client-identity">${trainerAvatar(client, true)}${trainerAction('client-questionnaire', `${trainerIcon('reviews')}<span>Анкета</span>`, { id: client.id }, 'trainer-questionnaire-button')}</div><div class="trainer-client-heading-copy"><h1>${trainerEscape(trainerFullName(client))}</h1>${tagMarkup}<div class="trainer-client-meta"><span>${weightSummary}${targetSummary}</span><span>Занимается: ${trainerClientTenure(client)}</span></div></div></section>
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
function trainerReviews() { return trenzoReportsIndex(); }
function trainerReview() {
  const review = trainerStore.review(trainerUI.route.id);
  if (!review) return trainerEmpty('Разбор не найден', 'Вернитесь к списку разборов.', trainerAction('navigate', 'Все разборы', { page: 'reviews' }));
  if (review.kind === 'period-report') return trenzoTrainerReportScreen(review);
  if (review.kind === 'weekly') return trainerWeeklyReview(review);
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
  const tab = trainerUI.programFilter;
  const templates = tab === 'templates';
  const workouts = tab === 'workouts' || (templates && trainerUI.templateFilter === 'workouts');
  const items = (workouts ? trainerStore.state.workoutLibrary : trainerStore.state.programs).filter(item => item.source === (templates ? 'template' : 'mine'));
  const heading = templates ? (workouts ? 'Шаблоны тренировок' : 'Шаблоны схем тренировок') : workouts ? 'Созданные тренировки' : 'Созданные схемы';
  const selectedClient = trainerStore.client(trainerUI.route.clientId);
  const compose = !templates && workouts && items.length ? trainerAction('compose-scheme', 'В схему', {}, 'trainer-text-button') : '';
  return `<div class="trainer-title-row trainer-library-title"><div><h1>Схемы тренировок</h1>${trainerUI.route.clientId ? `<p>Выбор для ${selectedClient ? trainerEscape(trainerFullName(selectedClient)) : 'подопечного'}</p>` : ''}</div>${trainerAction('create-training-menu', `${trainerIcon('plus')}<span class="trainer-sr-only">Создать тренировку или схему</span>`, {}, 'trainer-icon-button is-accent')}</div>
    <div class="trainer-library-navigation">${trainerFilterTabs([['workouts', 'Тренировки'], ['schemes', 'Схемы тренировок'], ['templates', 'Шаблоны']], tab, 'program-filter')}</div>
    ${templates ? `<div class="trainer-library-subfilters" role="group" aria-label="Тип шаблонов">${[['workouts', 'Шаблоны тренировок'], ['schemes', 'Шаблоны схем тренировок']].map(([value, label]) => `<button type="button" data-action="template-filter" data-value="${value}" aria-pressed="${trainerUI.templateFilter === value}">${label}</button>`).join('')}</div>` : ''}
    <section class="trainer-library-section">${trainerSection(heading, items.length, compose)}<div class="trainer-list">${items.map(workouts ? trainerLibraryWorkoutCard : trainerProgramCard).join('') || trainerEmpty('Здесь пока пусто', 'Создайте тренировку или схему, либо используйте шаблон.', trainerAction('create-training-menu', 'Создать'))}</div></section>`;
}
function trainerLibraryWorkoutCard(workout) {
  return trainerAction('library-workout', `<span class="trainer-program-symbol">${trainerIcon('programs')}</span><span><strong>${trainerEscape(workout.title)}</strong><small>Упражнений: ${workout.exercises.length} · ${workout.duration} мин</small><span>${workout.source === 'template' ? 'Шаблон TRENZO · ' : ''}${trainerEscape(workout.equipment)}</span></span>${trainerIcon('arrow')}`, { id: workout.id }, 'trainer-card trainer-program-card');
}
function trainerLibraryWorkout() {
  const workout = trainerStore.libraryWorkout(trainerUI.route.id);
  if (!workout) return trainerEmpty('Тренировка не найдена', 'Вернитесь в раздел «Схемы».');
  return `<div class="trainer-page-heading"><p class="trainer-kicker">${workout.source === 'template' ? 'ШАБЛОН ТРЕНИРОВКИ' : 'ТРЕНИРОВКА'}</p><h1>${trainerEscape(workout.title)}</h1><p>${workout.duration} мин · ${trainerEscape(workout.equipment)}</p></div>
    <div class="trainer-button-row">${trainerAction('edit-library-workout', workout.source === 'template' ? 'Создать копию' : 'Редактировать', { id: workout.id }, 'trainer-secondary-button')}${workout.source === 'template' ? '' : trainerAction('compose-scheme', 'Добавить в схему', { id: workout.id }, 'trainer-secondary-button')}</div>
    <section class="trainer-card trainer-library-exercises"><h2>Упражнения</h2>${workout.exercises.map(exercise => `<div class="trainer-exercise"><strong>${trainerEscape(exercise.name)}</strong><p>${exercise.sets} × ${trainerEscape(exercise.reps)} <span>· ${trainerNumber(exercise.weightKg)} кг</span></p><small>${trainerEscape(exercise.effortType)} ${exercise.effort} · Отдых ${exercise.restSeconds} сек${exercise.notes ? `<br>${trainerEscape(exercise.notes)}` : ''}</small></div>`).join('')}</section>
    ${workout.notes ? `<section class="trainer-card"><h2>Комментарий тренера</h2><p>${trainerEscape(workout.notes)}</p></section>` : ''}`;
}
function trainerCreationOptions() {
  return `<div class="trainer-list trainer-creation-options">${[
    ['creation-mode', 'Создать с TRENZO', 'Черновик схемы с помощью ассистента', 'ai', { mode: 'ai' }],
    ['new-library-workout', 'Создать тренировку', 'Одна тренировка на один день', 'programs', {}],
    ['new-training-scheme', 'Создать схему тренировок', 'Несколько тренировок на одну или несколько недель', 'reviews', {}]
  ].map(([action, title, description, icon, values]) => trainerAction(action, `<span class="trainer-program-symbol">${trainerIcon(icon)}</span><span><strong>${title}</strong><small>${description}</small></span>${trainerIcon('arrow')}`, values, 'trainer-card trainer-link-card')).join('')}</div>`;
}
function trainerComposeScheme() {
  const workouts = trainerStore.state.workoutLibrary.filter(item => item.source === 'mine');
  if (!workouts.length) return trainerEmpty('Нет созданных тренировок', 'Сначала сохраните отдельную тренировку или копию шаблона.', trainerAction('new-library-workout', 'Создать тренировку'));
  return `<div class="trainer-page-heading"><h1>Собрать схему</h1><p>Выберите от 1 до 6 тренировок для каждой недели.</p></div><form class="trainer-form" data-form="compose-scheme">
    ${trainerField('Название схемы', 'title', '', { required: true, maxlength: 100 })}
    <div class="trainer-form-grid">${trainerField('Количество недель', 'weeks', 6, { type: 'number', min: 1, max: 12, step: 1, required: true })}${trainerField('Длительность тренировки, мин', 'duration', 45, { type: 'number', min: 10, max: 180, step: 5, required: true })}</div>
    ${trainerField('Место проведения', 'equipment', 'Тренажёрный зал', { required: true })}
    <fieldset class="trainer-workout-selection"><legend>Тренировки схемы</legend>${workouts.map(workout => `<label class="trainer-card trainer-workout-option"><input type="checkbox" name="workoutIds" value="${trainerEscape(workout.id)}" ${trainerUI.route.workoutId === workout.id ? 'checked' : ''}><span><strong>${trainerEscape(workout.title)}</strong><small>Упражнений: ${workout.exercises.length} · ${workout.duration} мин</small></span></label>`).join('')}</fieldset>
    <p class="trainer-form-error" role="alert"></p><button type="submit" class="trainer-button">Перейти к схеме</button></form>`;
}
function trainerProgram() {
  const isClientProgram = Boolean(trainerUI.route.clientId);
  const program = isClientProgram ? trainerStore.clientProgram(trainerUI.route.clientId) : trainerStore.program(trainerUI.route.id);
  if (!program) return trainerEmpty('Программа не найдена', 'Вернитесь к списку программ.');
  const currentWeek = trainerUI.route.clientId ? trainerStore.client(trainerUI.route.clientId).currentWeek - 1 : 0;
  const weekIndex = Math.max(0, Math.min(trainerUI.route.week ?? currentWeek, program.weeks.length - 1)), week = program.weeks[weekIndex];
  const assigned = isClientProgram ? [] : trainerStore.state.clients.filter(client => client.programId === program.id);
  const programMeta = `${program.weeks.length} недель · ${program.duration} мин на тренировку · ${trainerEscape(program.equipment)}`;
  return `<div class="trainer-page-heading"><p class="trainer-kicker">${program.source === 'template' ? 'ШАБЛОН TRENZO' : 'ПРОГРАММА'}${isClientProgram ? ` · ${trainerEscape(trainerStore.client(trainerUI.route.clientId).name)}` : ''}</p><h1>${trainerEscape(program.title)}</h1><p>${programMeta}</p></div>
    <div class="trainer-button-row">${trainerAction('edit-program', program.source === 'template' && !isClientProgram ? 'Создать копию' : 'Редактировать', { id: program.id }, 'trainer-secondary-button')}${isClientProgram ? '' : trainerAction('assign-program', 'Назначить подопечному', { id: program.id })}</div>
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
  if (!mode) return `<div class="trainer-page-heading"><h1>Создать:</h1></div>${trainerCreationOptions()}`;
  if (mode === 'compose') return trainerComposeScheme();
  return `<div class="trainer-page-heading"><p class="trainer-kicker">${mode === 'ai' ? 'С TRENZO' : 'ВРУЧНУЮ'}</p><h1>Новая схема тренировок</h1><p>${mode === 'ai' ? 'Укажите контекст. TRENZO подготовит пример, который можно отредактировать.' : 'Соберите структуру и настройте каждое упражнение.'}</p></div>
    ${mode === 'manual' ? trainerAction('compose-scheme', 'Собрать из созданных тренировок', {}, 'trainer-secondary-button') : ''}
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
  const single = trainerUI.route.libraryKind === 'workout';
  const week = draft.weeks[trainerUI.editorWeek];
  return `<div class="trainer-page-heading"><h1>${single ? (draft.id ? 'Редактировать тренировку' : 'Новая тренировка') : 'Конструктор'}</h1>${single ? '' : `<p>${trainerEscape(draft.title)} · ${draft.weeks.length} недель</p>`}</div>
    <form class="trainer-form" data-form="${single ? 'save-library-workout' : 'save-program'}" novalidate>${trainerField(single ? 'Название тренировки' : 'Название схемы', 'program-title', draft.title, { required: true, maxlength: 100, extra: 'data-draft-field="title"' })}
    ${single ? `<div class="trainer-form-grid">${trainerField('Длительность, мин', 'duration', draft.duration, { type: 'number', min: 10, max: 180, step: 5, required: true, extra: 'data-draft-field="duration"' })}${trainerField('Место проведения', 'equipment', draft.equipment, { required: true, extra: 'data-draft-field="equipment"' })}</div>` : ''}
    ${trainerField('Комментарий тренера', 'program-notes', draft.notes, { multiline: true, extra: 'data-draft-field="notes"' })}
    ${single ? '' : `<div class="trainer-editor-week-row"><label class="trainer-field">Неделя<select data-editor-week>${draft.weeks.map((w, i) => `<option value="${i}" ${i === trainerUI.editorWeek ? 'selected' : ''}>Неделя ${i + 1}</option>`).join('')}</select></label>${trainerAction('add-week', '+ Неделя', {}, 'trainer-secondary-button')}</div>`}
    ${draft.restrictions ? `<div class="trainer-card"><strong>Учесть ограничения</strong><p>${trainerEscape(draft.restrictions)}</p></div>` : ''}
    ${week.sessions.map((session, index) => `<details class="trainer-card trainer-editor-day" ${index === 0 ? 'open' : ''}><summary><span>${single ? '' : `<small>ДЕНЬ ${index + 1}</small>`}<strong>${single ? 'Упражнения' : trainerEscape(session.title)}</strong></span>${trainerIcon('arrow')}</summary><div>${single ? '' : trainerField('Название тренировочного дня', `day-${index}`, session.title, { required: true, extra: `data-day-title="${index}"` })}${session.exercises.map((exercise, i) => trainerEditorExercise(exercise, index, i)).join('')}<div class="trainer-button-row">${trainerAction('add-exercise', '+ Упражнение', { day: index }, 'trainer-secondary-button')}${single ? '' : trainerAction('remove-day', 'Убрать день', { day: index }, 'trainer-text-button')}</div></div></details>`).join('')}
    ${single ? '' : trainerAction('add-day', '+ Тренировочный день', {}, 'trainer-secondary-button')}<p class="trainer-form-error" role="alert"></p><div class="trainer-editor-save"><button type="submit" class="trainer-button">${single ? 'Сохранить тренировку' : 'Сохранить программу'}</button></div></form>`;
}
function trainerProfileEntries(value, emptyText) {
  const entries = String(value || '').split(/\r?\n/).map(item => item.trim()).filter(Boolean);
  return entries.length
    ? `<ul class="trainer-profile-items">${entries.map(item => `<li>${trainerEscape(item)}</li>`).join('')}</ul>`
    : `<p class="trainer-profile-empty">${trainerEscape(emptyText)}</p>`;
}
function trainerSpecializationMarkup(values = []) {
  return values.length
    ? `<div class="trainer-profile-specialization-tags">${values.map(value => `<span>${trainerEscape(value)}</span>`).join('')}</div>`
    : '<p class="trainer-profile-empty">Не указана.</p>';
}
function trainerProfile() {
  const profile = trainerStore.state.trainer;
  const fullName = [profile.name, profile.surname].filter(Boolean).join(' ');
  return `<div class="trainer-page-heading"><h1>Профиль тренера</h1></div>
    <section class="trainer-card trainer-profile-summary">
      <div class="trainer-profile-identity">${trainerAvatar({ ...profile, id: 'trainer-profile' }, true)}<div><h2>${trainerEscape(fullName)}</h2></div></div>
      <dl class="trainer-profile-facts"><div><dt>Формат работы</dt><dd>${trainerEscape(profile.trainingFormat || 'Не указан')}</dd></div><div><dt>Опыт</dt><dd>${trainerEscape(profile.experience || 'Не указан')}</dd></div></dl>
      <div class="trainer-profile-specializations"><span>Специализация</span>${trainerSpecializationMarkup(profile.specializations || [])}</div>
      ${trainerAction('edit-profile', 'Редактировать профиль', {}, 'trainer-secondary-button')}
    </section>
    <section class="trainer-card trainer-profile-section"><h2>Образование</h2>${trainerProfileEntries(profile.education, 'Пока не добавлено.')}</section>
    <section class="trainer-card trainer-profile-section"><h2>Регалии</h2>${trainerProfileEntries(profile.regalia, 'Пока не добавлены.')}</section>`;
}
function trainerAnalytics() {
  return `<div class="trainer-page-heading"><h1>Аналитика</h1><p>Раздел в разработке.</p></div>${trainerEmpty('Здесь будет аналитика', 'Позже добавим графики и динамику результатов клиентов.')}`;
}
function trainerAIAnswer(question, clientId = null) {
  const query = question.toLocaleLowerCase('ru-RU');
  const client = trainerStore.client(clientId) || trainerStore.state.clients.find(c => query.includes(c.name.toLocaleLowerCase('ru-RU').slice(0, -1)));
  if (client) {
    const review = trainerStore.state.weeklyReviews.filter(r => r.clientId === client.id).sort((a, b) => b.end.localeCompare(a.end))[0];
    const data = review ? trainerStore.weeklyData(review.id) : null;
    const facts = review ? [`Период: ${trainerPeriodLabel(review)}.`, `Записано тренировок: ${data.workouts.length}; план: ${review.plan?.sessions.length ?? 'не сохранён'}.`, `Питание: записи за ${data.nutrition.length} из 7 дней.`] : [`Последний вес: ${trainerLatestWeight(client) == null ? 'не внесён' : `${trainerNumber(trainerLatestWeight(client))} кг`}.`];
    if (query.includes('месяц') && client.weights.length > 1) facts.push(`Вес за четыре недели: ${trainerNumber(client.weights[0].weight_kg)} → ${trainerNumber(trainerLatestWeight(client))} кг.`);
    return { facts, conclusion: review ? 'Недельные данные собраны для проверки тренером. Отсутствие записи не доказывает пропуск, а динамика нагрузки не равна достижению цели.' : 'Недельный разбор ещё не сформирован.', action: review?.note || 'Просмотреть тренировки, питание и материалы. Затем записать решение на следующую неделю.', reviewId: review?.id, clientId: client.id };
  }
  const relevant = trainerStore.state.weeklyReviews.filter(trainerStore.pending).filter(review => !query.includes('активност') || !trainerStore.weeklyData(review.id).workouts.length);
  return { facts: relevant.length ? relevant.map(review => `${trainerFullName(trainerStore.client(review.clientId))}: разбор ${trainerPeriodLabel(review)}.`) : ['Незавершённых недельных разборов по запросу нет.'], conclusion: 'Это демонстрационный ответ по записям недельных разборов, а не самостоятельная оценка результата клиента.', action: relevant.length ? 'Открой разбор, проверь данные и запиши решение.' : 'Дождись следующей очереди по расписанию.', reviewId: relevant[0]?.id || null };
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
  if (modal.type === 'create-training') {
    title = 'Создать:'; content = trainerCreationOptions();
  } else if (modal.type === 'add-client') {
    title = 'Добавить подопечного'; content = `<p>Укажи имя, цель и короткий тег для карточки.</p><form class="trainer-form" data-form="add-client">${trainerField('Имя и фамилия', 'name', '', { required: true, maxlength: 100 })}${trainerField('Цель', 'goal', '', { required: true })}${trainerField('Тег карточки · необязательно', 'tag', '', { maxlength: trainerClientTagMaxLength, extra: `placeholder="Например, К свадьбе · до ${trainerClientTagMaxLength} символов"` })}<p class="trainer-form-error" role="alert"></p><button type="submit" class="trainer-button">Добавить</button>${trainerAction('invite', 'Пригласить по ссылке', {}, 'trainer-secondary-button')}</form>`;
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
    content = `<form class="trainer-form" data-form="profile">
      <fieldset class="trainer-profile-edit-group"><legend>Личные данные</legend>
        <div class="trainer-form-grid">${trainerField('Имя', 'name', p.name, { required: true, maxlength: 50 })}${trainerField('Фамилия', 'surname', p.surname, { maxlength: 50 })}</div>
        <label class="trainer-field">Пол<select name="sex"><option value="male" ${p.sex === 'male' ? 'selected' : ''}>Мужской</option><option value="female" ${p.sex === 'female' ? 'selected' : ''}>Женский</option><option value="unspecified" ${!p.sex || p.sex === 'unspecified' ? 'selected' : ''}>Не указан</option></select></label>
        <label class="trainer-field">Формат работы<select name="trainingFormat"><option value="" ${!p.trainingFormat ? 'selected' : ''}>Не указан</option><option value="Онлайн" ${p.trainingFormat === 'Онлайн' ? 'selected' : ''}>Онлайн</option><option value="Офлайн" ${p.trainingFormat === 'Офлайн' ? 'selected' : ''}>Офлайн</option><option value="Онлайн и офлайн" ${p.trainingFormat === 'Онлайн и офлайн' ? 'selected' : ''}>Онлайн и офлайн</option></select></label>
        ${trainerField('Опыт', 'experience', p.experience, { maxlength: 120, extra: 'placeholder="Например, 5 лет"' })}
      </fieldset>
      <fieldset class="trainer-profile-edit-group trainer-specialization-group"><legend>Специализация</legend>${trainerField('На чём специализируется тренер', 'specializations', (p.specializations || []).join('\n'), { multiline: true, maxlength: 1000, extra: 'placeholder="Каждый пункт — с новой строки"' })}</fieldset>
      <fieldset class="trainer-profile-edit-group"><legend>Образование</legend>${trainerField('Учебные заведения, курсы, квалификация', 'education', p.education, { multiline: true, maxlength: 2000, extra: 'placeholder="Каждый пункт — с новой строки"' })}</fieldset>
      <fieldset class="trainer-profile-edit-group"><legend>Регалии</legend>${trainerField('Достижения, звания, награды', 'regalia', p.regalia, { multiline: true, maxlength: 2000, extra: 'placeholder="Каждый пункт — с новой строки"' })}</fieldset>
      <p class="trainer-form-error" role="alert"></p><button class="trainer-button" type="submit">Сохранить профиль</button></form>`;
  } else if (modal.type === 'review-schedule') {
    title = 'Расписание разборов'; content = trainerReviewScheduleForm();
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
  trenzoEnsureReports();
  trainerUI.route = { page: 'today' }; trainerUI.history = []; trainerUI.modal = null;
  const root = document.getElementById('trainerScreen');
  if (!root.dataset.trainerBound) {
    root.dataset.trainerBound = 'true';
    root.addEventListener('click', trainerHandleClick);
    root.addEventListener('input', trainerHandleInput);
    root.addEventListener('change', trainerHandleChange);
    root.addEventListener('submit', trainerHandleSubmit);
    root.addEventListener('touchstart', trainerHandleTouchStart, { passive: true });
    root.addEventListener('touchend', trainerHandleTouchEnd, { passive: true });
    root.addEventListener('cancel', event => { if (event.target.id === 'trainerDialog') trainerUI.modal = null; }, true);
  }
  trainerRender();
}
function trainerRender() {
  trainerStore.ensureWeeklyReviews();
  trenzoEnsureReports();
  const page = trainerUI.route.page;
  const renderers = { today: trainerToday, tasks: trainerTasks, chats: trainerChats, chat: trainerChat, income: trainerIncome, clients: trainerClients, client: trainerClient, 'client-questionnaire': () => trainerClientQuestionnaire(trainerStore.client(trainerUI.route.id)), memory: trainerMemory, reviews: trainerReviews, review: trainerReview, 'client-report': trenzoClientReportScreen, programs: trainerPrograms, program: trainerProgram, 'program-new': trainerProgramNew, 'program-edit': trainerProgramEditor, 'library-workout': trainerLibraryWorkout, profile: trainerProfile, analytics: trainerAnalytics, ai: trainerAI };
  const title = { tasks: 'Мои задачи', chats: 'Чаты с клиентами', chat: trainerStore.client(trainerUI.route.id)?.name || 'Диалог', income: 'Доходы', client: 'Подопечный', 'client-questionnaire': 'Анкета клиента', memory: 'Память TRENZO', review: 'Отчёт', program: 'Программа', 'program-new': 'Новая программа', 'program-edit': 'Конструктор', ai: 'Личный ассистент' }[page];
  const hasNav = page !== 'client-report';
  const root = document.getElementById('trainerScreen');
  trainerRenderPreservingAvatars(root, `<div class="trainer-app${hasNav ? ' has-navigation' : ''}${page === 'ai' ? ' is-ai' : ''}${page === 'clients' ? ' is-clients' : ''}">${trainerHeader(title)}<main class="trainer-main">${trainerStore.storageWarning ? `<p class="trainer-storage-warning" role="status">${trainerEscape(trainerStore.storageWarning)}</p>` : ''}${renderers[page]()}</main>${hasNav ? trainerNavigation() : ''}${trainerModalMarkup()}<div id="trainerToast" class="trainer-toast" role="status" aria-live="polite" hidden></div></div>`);
  root.querySelectorAll('.trainer-filter-tabs').forEach(tabs => {
    const selected = tabs.querySelector('[aria-pressed="true"]');
    if (selected) tabs.scrollLeft = Math.max(0, selected.getBoundingClientRect().left - tabs.getBoundingClientRect().left - tabs.clientWidth / 2 + selected.offsetWidth / 2);
  });
  if (trainerUI.modal) root.querySelector('#trainerDialog').showModal();
}
function trainerGo(page, params = {}, replace = false) {
  trainerUI.modal = null;
  trainerUI.editingClientTag = null;
  if (!replace) trainerUI.history.push({ route: { ...trainerUI.route }, scroll: window.scrollY });
  trainerUI.route = { page, ...params }; trainerRender(); window.scrollTo(0, 0);
}
function trainerBack() {
  if (trainerUI.route.page === 'program-edit' && trainerUI.draft) { trainerUI.modal = { type: 'leave-editor' }; trainerRender(); return; }
  const previous = trainerUI.history.pop();
  trainerUI.route = previous?.route || { page: 'today' }; trainerUI.modal = null; trainerUI.editingClientTag = null; trainerRender(); window.scrollTo(0, previous?.scroll || 0);
}
function trainerShouldHandleBackSwipe(startX, startY, endX, endY, historyLength, blocked = false) {
  return !blocked && historyLength > 0 && startX <= 36 && endX - startX >= 72 && Math.abs(endY - startY) <= 64;
}
function trainerHandleTouchStart(event) {
  trainerTouchStart = null;
  if (trainerUI.modal || event.touches?.length !== 1) return;
  if (event.target.closest?.('button, a, input, textarea, select, [role="button"], .trainer-filter-tabs, [data-no-back-swipe]')) return;
  const touch = event.touches[0];
  if (touch.clientX <= 36) trainerTouchStart = { x: touch.clientX, y: touch.clientY };
}
function trainerHandleTouchEnd(event) {
  const start = trainerTouchStart;
  trainerTouchStart = null;
  const touch = event.changedTouches?.[0];
  if (!start || !touch || trainerUI.modal) return;
  if (trainerShouldHandleBackSwipe(start.x, start.y, touch.clientX, touch.clientY, trainerUI.history.length)) trainerBack();
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
function trainerOpenWorkoutEditor(workout = null) {
  const title = workout?.title || '';
  trainerUI.draft = { id: workout?.source === 'mine' ? workout.id : null, title, source: 'mine', duration: workout?.duration || 45, equipment: workout?.equipment || 'Тренажёрный зал', notes: workout?.notes || '',
    weeks: [{ number: 1, sessions: [{ id: 'day-1', title: title || 'Тренировка', exercises: workout ? trainerCopy(workout.exercises) : [{ name: '', sets: 3, reps: '8–10', weightKg: 0, effortType: 'RIR', effort: 2, restSeconds: 90, notes: '' }] }] }] };
  trainerUI.editorWeek = 0; trainerGo('program-edit', { libraryKind: 'workout' });
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
    if (action.startsWith('report-')) {
      if (action === 'report-edit-block') { event.preventDefault?.(); event.stopPropagation?.(); }
      trenzoReportClick(button.dataset, button.closest?.('form')); return;
    }
    if (action === 'navigate') { trainerUI.history = []; trainerGo(page, {}, true); }
    else if (action === 'back') trainerBack();
    else if (action === 'client') trainerGo('client', { id, tab: 'overview' });
    else if (action === 'client-questionnaire') trainerGo('client-questionnaire', { id });
    else if (action === 'edit-client-tag') { trainerUI.editingClientTag = id; trainerRender(); document.querySelector('[data-client-tag-input]')?.focus(); }
    else if (action === 'cancel-client-tag') { trainerUI.editingClientTag = null; trainerRender(); }
    else if (action === 'open-chat') trainerGo('chat', { id });
    else if (action === 'client-from-chat') trainerGo('client', { id, tab: 'overview' });
    else if (action === 'toggle-task') { const task = trainerUI.tasks.find(item => item.id === id); if (task) { task.done = !task.done; trainerSaveWorkspace(); trainerRender(); } }
    else if (action === 'delete-task') { trainerUI.tasks = trainerUI.tasks.filter(item => item.id !== id); trainerSaveWorkspace(); trainerRender(); }
    else if (action === 'memory') trainerGo('memory', { id });
    else if (action === 'review') trainerGo('review', { id });
    else if (action === 'review-schedule') trainerOpenModal('review-schedule');
    else if (action === 'client-tab') { trainerUI.route.tab = value; trainerRender(); }
    else if (action === 'client-filter') { trainerUI.clientFilter = value; trainerRender(); }
    else if (action === 'reset-client-filters') { trainerUI.search = ''; trainerUI.clientFilter = 'all'; trainerRender(); }
    else if (action === 'review-filter') { trainerUI.reviewFilter = value; trainerRender(); }
    else if (action === 'program-filter') { trainerUI.programFilter = value; trainerRender(); }
    else if (action === 'template-filter') { trainerUI.templateFilter = value; trainerRender(); }
    else if (action === 'create-training-menu') trainerOpenModal('create-training');
    else if (action === 'new-library-workout') trainerOpenWorkoutEditor();
    else if (action === 'new-training-scheme') trainerGo('program-new', { mode: 'manual', clientId: trainerUI.route.clientId });
    else if (action === 'compose-scheme') trainerGo('program-new', { mode: 'compose', workoutId: id, clientId: trainerUI.route.clientId });
    else if (action === 'library-workout') trainerGo('library-workout', { id });
    else if (action === 'edit-library-workout') trainerOpenWorkoutEditor(trainerStore.libraryWorkout(id));
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
    else if (action === 'client-programs') { trainerUI.programFilter = 'schemes'; trainerUI.templateFilter = 'schemes'; trainerGo('programs', { clientId: id }); }
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
    else if (action === 'confirm-scenario') { trainerStore.reset(mode); trainerUI.history = []; trainerUI.messages = []; trainerUI.reviewNoteDrafts = {}; trainerUI.reviewPeriod = ''; trainerGo('today', {}, true); }
    else if (action === 'switch-role' || action === 'exit') { trainerUI.modal = null; trainerUI.history = []; showScreen(action === 'exit' ? 'welcomeScreen' : 'roleScreen'); }
    else if (action === 'ai') trainerGo('ai');
    else if (action === 'ai-client') { trainerGo('ai'); trainerAskAI(`Разбери неделю ${trainerStore.client(id).name}`, id); }
    else if (action === 'ai-question') trainerAskAI(trainerAIQuestions[Number(index)]);
  } catch (error) { trainerToast(error.message); }
}
function trainerHandleInput(event) {
  const input = event.target;
  if (trenzoReportInput(input)) return;
  if (input.hasAttribute('data-weekly-note')) trainerUI.reviewNoteDrafts[input.closest('form').dataset.id] = input.value;
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
  if (input.hasAttribute('data-report-answer') || input.hasAttribute('data-report-choice') || input.hasAttribute('data-report-number')) { trainerRender(); return; }
  if (input.hasAttribute('data-report-archive-period')) { trenzoReportUI.historyPeriod = input.value; trainerRender(); return; }
  if (input.hasAttribute('data-notifications')) { trainerStore.saveProfile({ ...trainerStore.state.trainer, notifications: input.checked }); trainerToast('Настройка уведомлений сохранена.'); }
  if (input.hasAttribute('data-editor-week')) { trainerUI.editorWeek = Number(input.value); trainerRender(); }
  if (input.hasAttribute('data-program-week')) { trainerUI.route.week = Number(input.value); trainerRender(); }
  if (input.hasAttribute('data-review-period')) { trainerUI.reviewPeriod = input.value; trainerUI.reviewFilter = 'all'; trainerRender(); }
  if (input.hasAttribute('data-training-history-week')) { trainerUI.trainingHistoryWeeks[trainerUI.route.id] = input.value; trainerRender(); }
  if (input.hasAttribute('data-nutrition-history-week')) { trainerUI.nutritionHistoryWeeks[trainerUI.route.id] = input.value; trainerRender(); }
  if (input.hasAttribute('data-report-history-week')) { trainerUI.reportHistoryWeeks[trainerUI.route.id] = input.value; trainerRender(); }
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
  if (['period-client-report', 'period-trainer-report'].includes(form.dataset.form)) return trenzoReportSubmit(event);
  event.preventDefault();
  if (['save-program', 'save-library-workout'].includes(form.dataset.form)) {
    const invalid = form.querySelector('input:invalid, select:invalid, textarea:invalid');
    if (invalid?.closest('details')) invalid.closest('details').open = true;
  }
  if (!form.reportValidity()) return;
  const formData = new FormData(form);
  const values = Object.fromEntries(formData);
  try {
    if (form.dataset.form === 'add-client') { const client = trainerStore.addClient(values); trainerGo('client', { id: client.id }); trainerToast('Карточка подопечного добавлена в демо-кабинет.'); }
    else if (form.dataset.form === 'edit-client-tag') { trainerStore.saveClientTag(form.dataset.id, values.tag); trainerUI.editingClientTag = null; trainerRender(); trainerToast(values.tag.trim() ? 'Тег сохранён.' : 'В карточке снова показывается цель клиента.'); }
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
    else if (form.dataset.form === 'review-schedule') { trainerStore.saveReviewSchedule(values); trainerUI.modal = null; trainerRender(); trainerToast('Расписание сохранено. Архив разборов не изменён.'); }
    else if (form.dataset.form === 'weekly-note') {
      const complete = event.submitter?.value === 'complete';
      trainerStore.saveWeeklyNote(form.dataset.id, values.note, complete);
      delete trainerUI.reviewNoteDrafts[form.dataset.id];
      trainerRender();
      trainerToast(complete ? 'Разбор завершён. Решение сохранено в истории клиента.' : 'Черновик решения сохранён.');
    }
    else if (form.dataset.form === 'profile') { trainerStore.saveProfile(values); trainerUI.modal = null; trainerRender(); trainerToast('Профиль сохранён.'); }
    else if (form.dataset.form === 'ai') trainerAskAI(values.question);
    else if (form.dataset.form === 'create-program') {
      const draft = { title: values.title, goal: values.goal, duration: Number(values.duration), equipment: values.equipment, restrictions: values.restrictions, notes: values.notes, source: 'mine', weeks: trainerProgramWeeks(Number(values.weeks), Number(values.days)) };
      if (trainerUI.route.mode === 'manual') draft.weeks.forEach(week => week.sessions.forEach(session => { session.exercises = [{ name: '', sets: 3, reps: '8–10', weightKg: 0, effortType: 'RIR', effort: 2, restSeconds: 90, notes: '' }]; }));
      trainerOpenEditor(draft, values.clientId || null);
    }
    else if (form.dataset.form === 'compose-scheme') {
      const draft = trainerStore.draftProgramFromWorkouts({ ...values, workoutIds: formData.getAll('workoutIds') });
      trainerOpenEditor(draft, trainerUI.route.clientId || null);
    }
    else if (form.dataset.form === 'save-library-workout') {
      const draft = trainerUI.draft;
      const saved = trainerStore.saveLibraryWorkout({ id: draft.id, title: draft.title, duration: draft.duration, equipment: draft.equipment, notes: draft.notes, exercises: draft.weeks[0].sessions[0].exercises });
      trainerUI.draft = null; trainerUI.programFilter = 'workouts';
      trainerGo('library-workout', { id: saved.id }, true);
      trainerToast('Тренировка сохранена.');
    }
    else if (form.dataset.form === 'save-program') {
      const clientId = trainerUI.route.clientId;
      const saved = clientId ? trainerStore.saveProgramForClient(trainerUI.draft, clientId) : trainerStore.saveProgram(trainerUI.draft);
      trainerUI.draft = null; trainerUI.programFilter = 'schemes';
      trainerGo('program', { id: saved.id, ...(clientId ? { clientId } : {}) }, true);
      trainerToast(clientId ? 'Программа обновлена для клиента.' : 'Программа сохранена.');
    }
  } catch (error) { const slot = form.querySelector('.trainer-form-error'); if (slot) { slot.textContent = error.message; slot.scrollIntoView({ block: 'nearest' }); } else trainerToast(error.message); }
}
