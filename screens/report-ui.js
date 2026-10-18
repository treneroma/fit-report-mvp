/* Два интерфейса одного цикла. Сейчас используется только изолированный демо-адаптер. */
const trenzoReports = createTrenzoReportService(createTrainerDemoReportAdapter(trainerStore));
const trenzoReportUI = { filter: 'pending', historyPeriod: 'all' };
function trenzoEnsureReports() {
  trenzoReports.ensure();
  if (trainerStore.state.reportDemoVersion === 1) return;
  const now = Date.now(), current = trenzoReports.period(now);
  // Только отсутствующие записи локального примера. Уже введённый факт не заменяем.
  trainerStore.state.clients.filter(client => Object.prototype.hasOwnProperty.call(trainerDemoTenureDays, client.id)).forEach(client => {
    const inCurrent = date => date >= current.start && date <= current.end;
    const inPrevious = date => date >= trainerShiftDate(current.start, -7) && date < current.start;
    if (!client.workouts.some(row => inCurrent(row.workout_date))) {
      client.workouts.push(...client.workouts.filter(row => inPrevious(row.workout_date)).map(row => ({ ...trainerCopy(row), id: `report-demo:${row.id}`, workout_date: trainerShiftDate(row.workout_date, 7) })));
    }
    const previousNutrition = client.nutrition.filter(row => inPrevious(row.report_date));
    previousNutrition.forEach(row => {
      const date = trainerShiftDate(row.report_date, 7);
      if (!client.nutrition.some(entry => entry.report_date === date)) client.nutrition.push({ ...trainerCopy(row), id: `report-demo:${row.id}`, report_date: date });
    });
    const lastWeight = client.weights.filter(row => row.measured_on < current.start).sort((a, b) => a.measured_on.localeCompare(b.measured_on)).pop();
    if (lastWeight && !client.weights.some(row => inCurrent(row.measured_on))) client.weights.push({ id: `report-demo:${client.id}`, measured_on: current.end, weight_kg: Math.round((lastWeight.weight_kg + (client.metrics.weightDelta || 0)) * 10) / 10, source: 'report-demo' });
  });
  const alexander = trainerStore.client('alexander');
  if (alexander) {
    alexander.activityEntries ||= Array.from({ length: 14 }, (_, index) => ({ date: trainerShiftDate(current.start, index - 7), sleep_minutes: index < 7 ? 438 : 384, steps: index < 7 ? 7800 : 7200 }));
    alexander.workouts.filter(item => item.id.startsWith('workout-alexander')).forEach(item => {
      if (item.workout_date >= current.start && item.workout_date <= current.end) item.rpe = 8.8;
      else if (item.workout_date >= trainerShiftDate(current.start, -7) && item.workout_date < current.start) item.rpe = 7.4;
    });
  }
  const answers = { wellbeing: 4, energy: 'normal', recovery: 'good', appetite: 'comfortable', pain: 'no', difficulty: '', comment: '' };
  for (const clientId of ['anna', 'andrey']) {
    if (!trainerStore.client(clientId)) continue;
    const start = trainerShiftDate(current.start, -7), end = trainerShiftDate(current.end, -7), dueOn = trainerShiftDate(current.dueOn, -7);
    const cycle = { id: `period-report:${clientId}:${start}:${end}`, kind: 'period-report', version: 1, clientId, start, end, dueOn, dueTime: current.dueTime, timeZone: current.timeZone, createdAt: new Date(now).toISOString() };
    if (!trenzoReports.get(cycle.id)) trainerStore.saveReportCycle(cycle);
    trenzoReports.submit(cycle.id, answers, now - 7 * 86400000);
    const draft = trenzoReports.createTrainerDraft(cycle.id, 'keep');
    draft.feedback = 'Спасибо за отчёт. Продолжаем текущий план, отмечаем выполнение тренировок и самочувствие.';
    trenzoReports.close(cycle.id, draft, now - 7 * 86400000);
  }
  for (const clientId of ['alexander', 'anna', 'maxim', 'ekaterina', 'andrey']) {
    const cycle = trenzoReports.list().find(item => item.clientId === clientId && item.start === current.start);
    if (!cycle || cycle.submission) continue;
    const input = clientId === 'alexander' ? { ...answers, wellbeing: 3, energy: 'low', recovery: 'poor', recoveryDetails: 'Мало спал из-за работы.', difficulty: 'Последние тренировки дались тяжелее обычного.', comment: 'Боли нет.' }
      : clientId === 'maxim' ? { ...answers, wellbeing: 3, trainingDifficulty: 'На этой неделе не получалось выделить время.' } : answers;
    trenzoReports.submit(cycle.id, input);
    if (clientId === 'andrey') trenzoReports.close(cycle.id, trenzoReports.createTrainerDraft(cycle.id, 'keep'));
  }
  for (const clientId of ['maria', 'ilya']) {
    const cycle = trenzoReports.list().find(item => item.clientId === clientId && item.start === current.start);
    if (!cycle || cycle.submission) continue;
    const today = trainerScheduleClock({ timeZone: cycle.timeZone }).date;
    cycle.dueOn = clientId === 'maria' ? trainerShiftDate(today, 1) : today;
    cycle.dueTime = clientId === 'maria' ? '20:00' : '00:00';
    trainerStore.saveReportCycle(cycle);
  }
  trainerStore.markReportDemoReady();
}
function trenzoReportNumber(value, suffix = '') { return value == null ? 'Нет данных' : `${trainerNumber(value, Number.isInteger(value) ? 0 : 1)}${suffix}`; }
function trenzoReportTime(value) { return value == null ? 'Нет данных' : `${Math.floor(Math.round(value) / 60)}:${String(Math.round(value) % 60).padStart(2, '0')}`; }
function trenzoReportComparison(before, after, format) { return before == null ? format(after) : `${format(before)} → ${format(after)}`; }
function trenzoCurrentReport(clientId) {
  trenzoReports.ensure();
  return trenzoReports.list().filter(item => item.clientId === clientId).sort((a, b) => b.end.localeCompare(a.end))[0];
}
function trenzoReportPendingCount() { return trenzoReports.pending(); }
function trenzoReportCard(cycle) {
  const client = trainerStore.client(cycle.clientId), status = trenzoReports.status(cycle);
  if (status === 'expected') return `<article class="trainer-card report-expected-card"><div class="report-person-row">${trainerAvatar(client)}<div><strong>${trainerEscape(trainerFullName(client))}</strong><small>${trainerPeriodLabel(cycle)}</small></div></div><p class="${trenzoReports.overdue(cycle) ? 'report-overdue' : 'trainer-muted'}">${trenzoReports.overdue(cycle) ? 'Просрочен · ' : 'Ожидается · '}${trainerDateLabel(cycle.dueOn)} до ${trainerEscape(cycle.dueTime)}</p>${trainerAction('report-client', 'Экран клиента · демо', { id: cycle.id }, 'trainer-text-button')}</article>`;
  const facts = trenzoReports.facts(cycle.id), analysis = trenzoReports.analyze(cycle.id), data = facts.current;
  return trainerAction('report-review', `<span class="report-person-row">${trainerAvatar(client)}<span><strong>${trainerEscape(trainerFullName(client))}</strong><small>${trainerPeriodLabel(cycle)}</small></span>${trainerIcon('arrow')}</span><span class="report-card-facts"><span>${data.training.completed} / ${data.training.planned ?? '—'} тренировки</span><span>Вес ${data.weight.delta == null ? '—' : trainerOverviewWeightChange(data.weight.delta)}</span>${data.rpe != null && facts.previous.rpe != null && data.rpe > facts.previous.rpe ? '<span>RPE ↑</span>' : ''}</span><span class="report-card-bottom"><span class="trainer-client-status is-${analysis.state}">${status === 'reviewed' ? 'Разобран' : trainerEscape(analysis.label)}</span><span>${status === 'reviewed' ? 'Открыть' : 'Разобрать'} →</span></span>`, { id: cycle.id }, 'trainer-card report-inbox-card');
}
function trenzoReportsIndex() {
  trenzoEnsureReports();
  const all = trenzoReports.list();
  const latest = trainerStore.state.clients.map(client => trenzoCurrentReport(client.id)).filter(Boolean);
  const pending = all.filter(item => trenzoReports.status(item) === 'submitted').sort((a, b) => trenzoReports.analyze(b.id).priority - trenzoReports.analyze(a.id).priority || a.end.localeCompare(b.end));
  const expected = all.filter(item => trenzoReports.status(item) === 'expected').sort((a, b) => Number(trenzoReports.overdue(b)) - Number(trenzoReports.overdue(a)) || a.dueOn.localeCompare(b.dueOn));
  const history = all.filter(item => item.resolution).sort((a, b) => b.end.localeCompare(a.end));
  const periods = [...new Map(history.map(item => [item.start, item])).values()];
  const currentExpected = latest.filter(item => trenzoReports.status(item) === 'expected');
  const submitted = latest.filter(item => item.submission).length, late = currentExpected.filter(item => trenzoReports.overdue(item)).length;
  const filter = trenzoReportUI.filter;
  const list = filter === 'pending' ? pending : filter === 'expected' ? expected : history.filter(item => trenzoReportUI.historyPeriod === 'all' || item.start === trenzoReportUI.historyPeriod);
  return `<div class="trainer-page-heading"><div class="trainer-weekly-title-row"><h1>Отчёты</h1>${trainerAction('review-schedule', 'Расписание', {}, 'trainer-text-button')}</div><p>${latest.length} клиентов · ${submitted} сдали · ${currentExpected.length - late} ожидаются · ${late} просрочили</p><small>Сводка по последнему периоду. В списках — все неразобранные и ожидаемые периоды.</small><small class="report-demo-label">Демонстрация цикла: данные и отправка сохраняются только в этом демо-кабинете.</small></div>
    <div class="trainer-library-navigation">${trainerFilterTabs([['pending', `К разбору · ${pending.length}`], ['expected', 'Ожидаются'], ['history', 'История']], filter, 'report-filter')}</div>
    ${filter === 'history' && periods.length ? `<label class="trainer-field">Период<select data-report-archive-period><option value="all">Все периоды</option>${periods.map(item => `<option value="${item.start}" ${trenzoReportUI.historyPeriod === item.start ? 'selected' : ''}>${trainerPeriodLabel(item)}</option>`).join('')}</select></label>` : ''}
    <div class="trainer-list">${list.map(trenzoReportCard).join('') || trainerEmpty(filter === 'pending' ? 'Все поступившие отчёты разобраны' : filter === 'expected' ? 'Ожидаемых отчётов нет' : 'История пока пуста', 'Здесь появятся отчёты соответствующего состояния.')}</div>`;
}
function trenzoReportFactsMarkup(facts, compact = false) {
  const current = facts.current, previous = facts.previous;
  const training = `${current.training.completed} / ${current.training.planned ?? '—'}`;
  if (compact) return `<section class="trainer-card report-auto-facts"><h2>Уже собрано за неделю</h2><div class="report-facts-grid">${trainerMetric('Тренировки', training)}${trainerMetric('Питание', trenzoReportNumber(current.nutrition.adherence, '%'), `По калориям · дневник: ${current.nutrition.days} / 7 дней`)}${trainerMetric('Вес', current.weight.delta == null ? 'Нет данных' : trainerOverviewWeightChange(current.weight.delta))}${trainerMetric('Активность', current.steps == null ? 'Нет данных' : `${Math.round(current.steps).toLocaleString('ru-RU')} шагов/день`)}</div></section>`;
  return `<section class="trainer-card report-auto-facts"><h2>Что произошло</h2><div class="report-facts-grid">${trainerMetric('Тренировки', training, previous.training.planned ? `Прошлый период: ${previous.training.completed} / ${previous.training.planned}` : 'Нет прошлого плана для сравнения')}${trainerMetric('Питание', trenzoReportComparison(previous.nutrition.adherence, current.nutrition.adherence, value => trenzoReportNumber(value, '%')), `По калориям, только записанные дни: ${current.nutrition.days} / 7.`)}${trainerMetric('Вес', current.weight.current ? `${trenzoReportNumber(current.weight.before?.weight_kg)} → ${trenzoReportNumber(current.weight.current.weight_kg, ' кг')}` : 'Нет замера за период')}${trainerMetric('Средний RPE', trenzoReportComparison(previous.rpe, current.rpe, trenzoReportNumber))}${trainerMetric('Средний сон', trenzoReportComparison(previous.sleepMinutes, current.sleepMinutes, trenzoReportTime))}${trainerMetric('Активность', trenzoReportComparison(previous.steps, current.steps, value => trenzoReportNumber(value == null ? null : Math.round(value), ' шагов/день')))}</div></section>`;
}
function trenzoClientWords(cycle) {
  const answers = cycle.submission?.answers || {};
  const labels = { low: 'Низкая', normal: 'Нормальная', high: 'Высокая', poor: 'Плохое', good: 'Хорошее', comfortable: 'Комфортно', hungry: 'Сильный голод' };
  return `<section class="trainer-card report-client-words"><h2>Что сказал клиент</h2><dl class="report-answer-list"><div><dt>Самочувствие</dt><dd>${answers.wellbeing} / 5</dd></div><div><dt>Энергия</dt><dd>${labels[answers.energy] || 'Не указана'}</dd></div><div><dt>Восстановление</dt><dd>${answers.recovery === 'normal' ? 'Нормальное' : labels[answers.recovery] || 'Не указано'}</dd></div>${answers.appetite ? `<div><dt>Голод / аппетит</dt><dd>${answers.appetite === 'low' ? 'Аппетит снижен' : labels[answers.appetite]}</dd></div>` : ''}<div><dt>Боли или дискомфорт</dt><dd>${answers.pain === 'yes' ? 'Да' : 'Нет'}</dd></div></dl>${[['painDetails', 'Дискомфорт'], ['recoveryDetails', 'Восстановление'], ['trainingDifficulty', 'Тренировки'], ['difficulty', 'Сложности недели'], ['followUp', 'Прошлый приоритет'], ['comment', 'Комментарий']].filter(([key]) => answers[key]).map(([key, label]) => `<div class="report-client-quote"><small>${label}</small><p>${trainerEscape(answers[key])}</p></div>`).join('')}</section>`;
}
function trenzoClientReportScreen() {
  const cycle = trenzoReports.get(trainerUI.route.id);
  if (!cycle) return trainerEmpty('Отчёт не найден', 'Вернитесь в раздел «Отчёты».');
  const facts = trenzoReports.facts(cycle.id);
  const header = `<div class="trainer-page-heading"><p class="trainer-kicker">ЭКРАН КЛИЕНТА · ДЕМО</p><h1>Отчёт за ${trainerPeriodLabel(cycle)}</h1><p>${trainerEscape(trainerFullName(facts.client))}</p></div>`;
  const back = trainerAction('report-review', cycle.submission ? 'Открыть у тренера · демо' : 'Вернуться к тренеру', { id: cycle.id }, 'trainer-secondary-button');
  if (cycle.submission) return `${header}<section class="trainer-card report-delivery-state"><span class="trainer-kicker">Отчёт отправлен</span><h2>${cycle.resolution ? 'Есть ответ тренера' : 'Тренер ещё не посмотрел'}</h2><p>${cycle.resolution ? trainerEscape(cycle.resolution.feedback) : 'Все данные и ваши ответы сохранены. Ответ появится здесь после проверки.'}</p></section>${cycle.resolution ? trenzoNextPlanMarkup(cycle.resolution) : ''}${trenzoReportFactsMarkup(facts, true)}<details class="report-details"><summary>Мои ответы</summary>${trenzoClientWords(cycle)}</details>${back}`;
  const draft = cycle.clientDraft || {};
  return `${header}${trenzoReportFactsMarkup(facts, true)}<p class="report-client-intro">Мы уже собрали данные за неделю. Осталось рассказать, как ты себя чувствовал. Это займёт 1–5 минут.</p><form class="trainer-form report-client-form" data-form="period-client-report" data-id="${trainerEscape(cycle.id)}">${trenzoReports.questions(cycle.id, draft).map(question => question.options
    ? `<fieldset class="report-question"><legend>${trainerEscape(question.label)}</legend><div class="report-answer-options${question.type === 'scale' ? ' is-scale' : ''}">${question.options.map(([value, label]) => `<label><input type="radio" name="${question.key}" value="${value}" data-report-answer ${String(draft[question.key]) === String(value) ? 'checked' : ''} ${question.required ? 'required' : ''}><span>${label}</span></label>`).join('')}</div></fieldset>`
    : trainerField(trainerEscape(question.label), question.key, draft[question.key] || '', { multiline: true, required: question.required, maxlength: 2000 })).join('')}<p class="trainer-form-error" role="alert"></p><button type="submit" class="trainer-button">Отправить отчёт</button></form>${back}`;
}
function trenzoNextPlanMarkup(resolution) {
  const plan = resolution.nextPlan;
  return `<section class="trainer-card report-next-plan"><h2>Что меняется в следующем периоде</h2><p class="trainer-muted">План с ${plan.effectiveOn.split('-').reverse().join('.')}</p><dl class="report-answer-list"><div><dt>Тренировки</dt><dd>${trainerEscape(plan.training)}</dd></div><div><dt>Питание</dt><dd>${trainerEscape(plan.nutrition)}</dd></div><div><dt>Приоритет</dt><dd>${trainerEscape(plan.priority)}</dd></div></dl>${resolution.changes.length ? `<ul>${resolution.changes.map(change => `<li>${trainerEscape(change.exercise)}: ${change.from} → ${change.to} кг</li>`).join('')}</ul>` : '<p>Рабочие веса без численных изменений.</p>'}</section>`;
}
function trenzoTrainerReportScreen(cycle) {
  if (!cycle.submission) return `<div class="trainer-page-heading"><h1>${trainerEscape(trainerFullName(trainerStore.client(cycle.clientId)))}</h1><p>Отчёт ещё ожидается · ${trainerPeriodLabel(cycle)}</p></div>${trenzoReportCard(cycle)}`;
  const facts = trenzoReports.facts(cycle.id), analysis = trenzoReports.analyze(cycle.id);
  const draft = cycle.trainerDraft || trenzoReports.createTrainerDraft(cycle.id);
  const chosen = !!cycle.trainerDraft?.mode;
  return `<div class="trainer-page-heading"><p class="trainer-kicker">ОТЧЁТ · ${trainerPeriodLabel(cycle)}</p><h1>${trainerEscape(trainerFullName(facts.client))}</h1><span class="trainer-weekly-state${cycle.resolution ? ' is-complete' : ''}">${cycle.resolution ? 'Разобран' : 'К разбору'}</span>${trainerAction('report-client', 'Экран клиента · демо', { id: cycle.id }, 'trainer-text-button')}</div>
    <section class="trainer-card report-week-summary"><h2>Итог недели</h2><span class="trainer-client-status is-${analysis.state}">${analysis.label}</span><p>${trainerEscape(analysis.priorityText)}</p></section>
    ${trenzoReportFactsMarkup(facts)}${trenzoClientWords(cycle)}
    <section class="trainer-card trainer-ai-summary"><div class="trainer-ai-summary-heading">${trainerIcon('ai')}<strong>Что заметил TRENZO</strong><small>Демо-анализ данных</small></div>${analysis.observations.map(text => `<p>${trainerEscape(text)}</p>`).join('')}</section>
    ${cycle.resolution ? `<section class="trainer-card"><h2>Что решил тренер</h2><p>${trainerEscape(cycle.resolution.decision)}</p></section>${trenzoNextPlanMarkup(cycle.resolution)}<section class="trainer-card report-feedback"><h2>Отправленная обратная связь</h2><p>${trainerEscape(cycle.resolution.feedback)}</p></section>${trainerAction('memory', 'Память TRENZO · решения клиента', { id: cycle.clientId }, 'trainer-secondary-button')}` : `<form class="trainer-form report-trainer-form" data-form="period-trainer-report" data-id="${trainerEscape(cycle.id)}"><section class="trainer-card report-recommendations"><h2>Предложение TRENZO</h2><p class="trainer-muted">Проверьте причины и оставьте только нужные рекомендации.</p>${analysis.recommendations.map(item => {
      const choice = draft.choices.find(value => value.id === item.id);
      return `<div class="report-recommendation"><label class="report-recommendation-toggle"><input type="checkbox" name="choice-${item.id}" data-report-choice ${choice?.accepted ? 'checked' : ''}><strong>${trainerEscape(item.title)}</strong></label>${trainerField('Рекомендация', `recommendation-${item.id}`, choice?.text || item.text, { multiline: true, maxlength: 2000, extra: draft.mode === 'edit' && chosen ? '' : 'readonly' })}<small>Почему: ${trainerEscape(item.reason)}</small>${item.action.type === 'weight' ? trainerField('Предлагаемый рабочий вес, кг', `to-${item.id}`, choice?.action.to ?? item.action.to, { type: 'number', min: 0, max: 1000, step: '0.5', required: true, extra: 'data-report-number' }) : ''}</div>`;
    }).join('')}<div class="report-decision-actions">${trainerAction('report-decision', 'Принять всё', { id: cycle.id, mode: 'accept' }, 'trainer-button')}${trainerAction('report-decision', 'Изменить', { id: cycle.id, mode: 'edit' }, 'trainer-secondary-button')}${trainerAction('report-decision', 'Ничего не менять', { id: cycle.id, mode: 'keep' }, 'trainer-text-button')}</div>${chosen ? `<p class="report-decision-confirmation">Решение: ${draft.mode === 'keep' ? 'сохранить текущий план' : draft.mode === 'edit' ? 'изменения тренера' : 'рекомендации приняты'}.</p>` : ''}</section>
      <section class="trainer-card report-next-plan"><h2>План следующего периода</h2>${trainerField('Тренировки', 'nextTraining', draft.nextPlan.training, { multiline: true, required: true, maxlength: 2000 })}${trainerField('Питание', 'nextNutrition', draft.nextPlan.nutrition, { multiline: true, required: true, maxlength: 2000 })}${trainerField('Приоритет', 'nextPriority', draft.nextPlan.priority, { required: true, maxlength: 2000 })}</section>
      <section class="trainer-card report-feedback"><h2>Ответ клиенту</h2>${trainerField('Черновик обратной связи — можно отредактировать', 'feedback', draft.feedback, { multiline: true, required: true, maxlength: 4000 })}<p class="trainer-form-error" role="alert"></p><button type="submit" class="trainer-button" ${chosen ? '' : 'disabled'}>Отправить клиенту</button><small>Демо: ответ сохранится на этом устройстве, без отправки в Telegram.</small>${chosen ? '' : '<small>Сначала примите решение по рекомендациям.</small>'}</section></form>`}
    <details class="report-details"><summary>Все данные периода</summary>${trainerWeeklyTraining({ ...cycle, plan: facts.plan }, facts.current.raw)}${trainerWeeklyNutrition({ ...cycle, plan: facts.plan }, facts.current.raw)}${trainerWeeklyMedia(facts.current.raw, 'photo')}${trainerWeeklyMedia(facts.current.raw, 'video')}${facts.current.raw.measurements ? `<section class="trainer-card"><h2>Замеры на конец периода</h2><dl class="report-answer-list">${[['shoulders_cm', 'Плечи'], ['chest_cm', 'Грудь'], ['biceps_cm', 'Бицепс'], ['waist_cm', 'Талия'], ['hips_cm', 'Бёдра']].map(([key, label]) => `<div><dt>${label}</dt><dd>${trenzoReportNumber(facts.current.raw.measurements[key], ' см')}</dd></div>`).join('')}</dl></section>` : ''}</details>`;
}
function trenzoReadTrainerForm(form, forceEdit = false) {
  const cycle = trenzoReports.get(form.dataset.id), previous = cycle.trainerDraft;
  const draft = previous || { ...trenzoReports.createTrainerDraft(cycle.id), mode: null };
  const values = new FormData(form);
  if (forceEdit) draft.mode = 'edit';
  draft.choices.forEach(choice => { choice.accepted = values.has(`choice-${choice.id}`); choice.text = String(values.get(`recommendation-${choice.id}`) || choice.text); if (choice.action.type === 'weight') choice.action.to = values.get(`to-${choice.id}`) === '' ? null : Number(values.get(`to-${choice.id}`)); });
  draft.nextPlan = { training: String(values.get('nextTraining') || ''), nutrition: String(values.get('nextNutrition') || ''), priority: String(values.get('nextPriority') || '') };
  draft.feedback = String(values.get('feedback') || '');
  return draft;
}
function trenzoReportInput(input) {
  const form = input.closest?.('form');
  if (form?.dataset.form === 'period-client-report') { trenzoReports.saveClientDraft(form.dataset.id, Object.fromEntries(new FormData(form))); return true; }
  if (form?.dataset.form === 'period-trainer-report') {
    const draft = trenzoReadTrainerForm(form, input.hasAttribute('data-report-choice') || input.hasAttribute('data-report-number'));
    if (input.name === 'feedback') draft.feedbackEdited = true;
    if (input.hasAttribute('data-report-number')) {
      const choice = draft.choices.find(item => input.name === `to-${item.id}`);
      if (choice && Number.isFinite(choice.action.to)) {
        choice.text = `${choice.action.exercise}: ${choice.action.from} → ${choice.action.to} кг. Проверить технику и восстановление перед повышением нагрузки.`;
        const field = form.elements?.namedItem(`recommendation-${choice.id}`);
        if (field) field.value = choice.text;
      }
    }
    if (!draft.feedbackEdited) {
      draft.feedback = trenzoReports.feedback(form.dataset.id, draft);
      const field = form.elements?.namedItem('feedback');
      if (field) field.value = draft.feedback;
    }
    trenzoReports.saveDraft(form.dataset.id, draft); return true;
  }
  return false;
}
function trenzoReportClick(values) {
  const { action, id, mode, value } = values;
  if (action === 'report-filter') { trenzoReportUI.filter = value; trainerRender(); }
  if (action === 'report-client') trainerGo('client-report', { id });
  if (action === 'report-review') trainerGo('review', { id });
  if (action === 'report-decision') {
    const previous = trenzoReports.get(id).trainerDraft;
    const draft = trenzoReports.createTrainerDraft(id, mode, previous);
    if (previous?.feedbackEdited) { draft.feedback = previous.feedback; draft.feedbackEdited = true; }
    trenzoReports.saveDraft(id, draft); trainerRender();
  }
}
function trenzoReportSubmit(event) {
  const form = event.target;
  event.preventDefault();
  if (!form.reportValidity()) return;
  try {
    if (form.dataset.form === 'period-client-report') trenzoReports.submit(form.dataset.id, Object.fromEntries(new FormData(form)));
    else trenzoReports.close(form.dataset.id, trenzoReadTrainerForm(form));
    trainerRender();
  } catch (error) { form.querySelector('.trainer-form-error').textContent = error.message; }
}
function trenzoClientReports(client) {
  trenzoReports.ensure();
  const all = trenzoReports.list().filter(item => item.clientId === client.id).sort((a, b) => b.end.localeCompare(a.end));
  const pending = all.filter(item => trenzoReports.status(item) === 'submitted'), history = all.filter(item => item.resolution);
  const latest = all[0];
  const nextDate = latest && !latest.resolution ? latest.dueOn : trainerShiftDate(trenzoReports.period().dueOn, 7);
  const selected = history.find(item => item.start === trainerUI.reportHistoryWeeks[client.id]);
  return `${pending.length ? `<section>${trainerSection('Неразобранные отчёты', pending.length)}<div class="trainer-list">${pending.map(trenzoReportCard).join('')}</div></section>` : `<section class="trainer-card trainer-client-current-report"><span class="trainer-client-report-label">Следующий отчёт</span><strong>${nextDate.split('-').reverse().join('.')}</strong><small>Ожидаем субъективную часть от клиента.</small>${latest && !latest.resolution ? trenzoReportCard(latest) : ''}</section>`}<section>${trainerSection('История отчётов', history.length)}${history.length ? `<label class="trainer-field">Период<select data-report-history-week><option value="">Все периоды</option>${history.map(item => `<option value="${item.start}" ${item.start === selected?.start ? 'selected' : ''}>${trainerPeriodLabel(item)}</option>`).join('')}</select></label><div class="trainer-list">${(selected ? [selected] : history).map(trenzoReportCard).join('')}</div>` : '<p class="trainer-muted">История появится после проверки первого отчёта.</p>'}</section>`;
}
function trenzoClientOverviewReports(client) {
  const all = trenzoReports.list().filter(item => item.clientId === client.id), pending = all.filter(item => trenzoReports.status(item) === 'submitted');
  return `<section class="trainer-card trainer-ai-summary"><div class="trainer-ai-summary-heading">${trainerIcon('ai')}<strong>AI TRENZO</strong></div><p>${pending.length ? 'Недельный отчёт клиента получен: факты недели и субъективные ответы готовы к проверке.' : 'Нового отправленного отчёта от клиента пока нет. Следующий появится после отправки клиентом.'}</p>${pending.length ? trainerAction('report-review', 'Проверить отчёт', { id: pending[0].id }) : ''}</section><section>${trainerSection('Неразобранные отчёты', pending.length)}${pending.length ? `<div class="trainer-list">${pending.map(trenzoReportCard).join('')}</div>` : '<p class="trainer-muted">Новых отчётов от клиента пока нет.</p>'}</section>`;
}
