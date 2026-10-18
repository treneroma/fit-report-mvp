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
  const answers = { wellbeing: 4, energy: 'normal', recovery: 'good', appetite: 'comfortable', pain: 'no', soreness: 'no', difficulty: '', comment: '' };
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
    const input = clientId === 'alexander' ? { ...answers, wellbeing: 3, energy: 'low', recovery: 'poor', soreness: 'yes', recoveryDetails: 'Мало спал из-за работы.', difficulty: 'Последние тренировки дались тяжелее обычного.', comment: 'Боли нет.' }
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
  const analysis = status === 'expected' ? null : trenzoReports.analyze(cycle.id);
  const badge = analysis ? '<span class="trainer-client-status is-' + analysis.state + '">' + (status === 'reviewed' ? 'Разобран' : trainerEscape(analysis.label)) + '</span>' : '';
  const person = '<span class="report-person-row">' + trainerAvatar(client) + '<span class="report-person-copy"><span class="report-name-row"><strong>' + trainerEscape(trainerFullName(client)) + '</strong>' + badge + '</span><small>' + trainerPeriodLabel(cycle) + '</small></span></span>';
  const end = '<span class="report-card-end">' + trainerIcon('arrow') + '</span>';
  if (status === 'expected') return trainerAction('client', '<span class="report-card-main">' + person + '<span class="' + (trenzoReports.overdue(cycle) ? 'report-overdue' : 'trainer-muted') + '">Отчёт не поступил · срок ' + trainerDateLabel(cycle.dueOn) + ' до ' + trainerEscape(cycle.dueTime) + '</span></span>' + end, { id: client.id }, 'trainer-card report-inbox-card');
  const facts = trenzoReports.facts(cycle.id), data = facts.current;
  const training = data.training.planned == null && data.training.recorded ? data.training.recorded + ' записей · план не сохранён' : data.training.completed ? data.training.completed + ' из ' + (data.training.planned ?? '—') + ' тренировок' : 'Нет записей тренировок' + (data.training.planned ? ' · план ' + data.training.planned : '');
  return trainerAction('report-review', '<span class="report-card-main">' + person + '<span class="report-card-facts"><span>' + training + '</span><span>Вес ' + (data.weight.delta == null ? '—' : trainerOverviewWeightChange(data.weight.delta)) + '</span>' + (data.rpe != null ? '<span>RPE ' + trenzoReportNumber(data.rpe) + (facts.previous.rpe != null && data.rpe > facts.previous.rpe ? ' ↑' : '') + '</span>' : '') + '</span></span>' + end, { id: cycle.id }, 'trainer-card report-inbox-card');
}
function trenzoReportsIndex() {
  trenzoEnsureReports();
  const all = trenzoReports.list(), filter = trenzoReportUI.filter === 'expected' ? 'overdue' : trenzoReportUI.filter;
  const pending = all.filter(item => trenzoReports.status(item) === 'submitted').sort((a, b) => trenzoReports.analyze(b.id).priority - trenzoReports.analyze(a.id).priority || a.end.localeCompare(b.end));
  const late = all.filter(item => trenzoReports.overdue(item)).sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const history = all.filter(item => item.resolution).sort((a, b) => b.end.localeCompare(a.end));
  const periods = [...new Map(history.map(item => [item.start, item])).values()];
  const list = filter === 'pending' ? pending : filter === 'overdue' ? late : history.filter(item => trenzoReportUI.historyPeriod === 'all' || item.start === trenzoReportUI.historyPeriod);
  return '<div class="trainer-page-heading"><h1>Отчёты</h1></div><div class="trainer-library-navigation">' +
    trainerFilterTabs([['pending', 'К разбору'], ['overdue', 'Просрочили'], ['history', 'История']], filter, 'report-filter') + '</div>' +
    (filter === 'history' && periods.length ? '<label class="trainer-field">Период<select data-report-archive-period><option value="all">Все периоды</option>' + periods.map(item => '<option value="' + item.start + '" ' + (trenzoReportUI.historyPeriod === item.start ? 'selected' : '') + '>' + trainerPeriodLabel(item) + '</option>').join('') + '</select></label>' : '') +
    '<div class="trainer-list">' + (list.map(trenzoReportCard).join('') || '<p class="trainer-muted">' + (filter === 'pending' ? 'Все поступившие отчёты разобраны.' : filter === 'overdue' ? 'Просроченных отчётов нет.' : 'История пока пуста.') + '</p>') + '</div>';
}
function trenzoReportFactsMarkup(facts, compact = false) {
  const current = facts.current, previous = facts.previous;
  return '<section class="trainer-card report-auto-facts"><h2>' + (compact ? 'Уже собрано за неделю' : 'Что произошло') + '</h2><div class="report-facts-grid">' +
    trainerMetric('Тренировки', current.training.planned == null ? (current.training.recorded ? 'Записано ' + current.training.recorded : 'План не задан') : current.training.completed + ' из ' + current.training.planned) +
    trainerMetric('Питание', trenzoReportNumber(current.nutrition.adherence, '%'), 'Внесено ' + current.nutrition.days + ' дней из 7') +
    trainerMetric('Вес', current.weight.current ? trenzoReportNumber(current.weight.before?.weight_kg) + ' → ' + trenzoReportNumber(current.weight.current.weight_kg, ' кг') : 'Нет замера за период') +
    trainerMetric('Средний RPE', trenzoReportComparison(previous.rpe, current.rpe, trenzoReportNumber), 'Тяжесть тренировки · шкала 1–10') + '</div></section>';
}
function trenzoClientWords(cycle) {
  const answers = cycle.submission?.answers || {};
  const labels = { low: 'Низкая', normal: 'Нормальная', high: 'Высокая', poor: 'Плохое', good: 'Хорошее', comfortable: 'Комфортно', hungry: 'Сильный голод' };
  const yesNo = value => value === 'yes' ? 'Да' : value === 'no' ? 'Нет' : 'Не указано';
  return '<section class="trainer-card report-client-words"><h2>Состояние клиента</h2><dl class="report-answer-list">' +
    [['Самочувствие', answers.wellbeing ? answers.wellbeing + ' / 5' : 'Не указано'], ['Энергия', labels[answers.energy] || 'Не указана'], ['Восстановление', answers.recovery === 'normal' ? 'Нормальное' : labels[answers.recovery] || 'Не указано'], ...(answers.appetite ? [['Голод / аппетит', answers.appetite === 'low' ? 'Аппетит снижен' : labels[answers.appetite]]] : []), ['Боли или дискомфорт', yesNo(answers.pain)], ['Крепатура', yesNo(answers.soreness)]].map(([label, value]) => '<div><dt>' + label + '</dt><dd>' + trainerEscape(value) + '</dd></div>').join('') +
    '</dl>' + [['painDetails', 'Дискомфорт'], ['recoveryDetails', 'Восстановление'], ['trainingDifficulty', 'Тренировки'], ['difficulty', 'Сложности недели'], ['followUp', 'Прошлый приоритет'], ['comment', 'Комментарий']].filter(([key]) => answers[key]).map(([key, label]) => '<div class="report-client-quote"><small>' + label + '</small><p>' + trainerEscape(answers[key]) + '</p></div>').join('') + '</section>';
}
function trenzoClientReportScreen() {
  const cycle = trenzoReports.get(trainerUI.route.id);
  if (!cycle) return trainerEmpty('Отчёт не найден', 'Вернитесь в раздел «Отчёты».');
  const facts = trenzoReports.facts(cycle.id);
  const header = `<div class="trainer-page-heading"><p class="trainer-kicker">ЭКРАН КЛИЕНТА · ДЕМО</p><h1>Отчёт за ${trainerPeriodLabel(cycle)}</h1><p>${trainerEscape(trainerFullName(facts.client))}</p></div>`;
  const back = trainerAction('report-review', cycle.submission ? 'Открыть у тренера · демо' : 'Вернуться к тренеру', { id: cycle.id }, 'trainer-secondary-button');
  if (cycle.submission) return `${header}<section class="trainer-card report-delivery-state"><span class="trainer-kicker">Отчёт отправлен</span><h2>${cycle.resolution ? 'Есть ответ тренера' : 'Тренер ещё не посмотрел'}</h2><p>${cycle.resolution ? 'Тренер проверил отчёт и подготовил план на неделю.' : 'Все данные и ваши ответы сохранены. Ответ появится здесь после проверки.'}</p></section>${cycle.resolution ? trenzoReportDelivery(cycle.resolution, cycle.submission.answers) : ''}${trenzoReportFactsMarkup(facts, true)}<details class="report-details"><summary>Мои ответы</summary>${trenzoClientWords(cycle)}</details>${back}`;
  const draft = cycle.clientDraft || {};
  return `${header}${trenzoReportFactsMarkup(facts, true)}<p class="report-client-intro">Мы уже собрали данные за неделю. Осталось рассказать, как ты себя чувствовал. Это займёт 1–5 минут.</p><form class="trainer-form report-client-form" data-form="period-client-report" data-id="${trainerEscape(cycle.id)}">${trenzoReports.questions(cycle.id, draft).map(question => question.options
    ? `<fieldset class="report-question"><legend>${trainerEscape(question.label)}</legend><div class="report-answer-options${question.type === 'scale' ? ' is-scale' : ''}">${question.options.map(([value, label]) => `<label><input type="radio" name="${question.key}" value="${value}" data-report-answer ${String(draft[question.key]) === String(value) ? 'checked' : ''} ${question.required ? 'required' : ''}><span>${label}</span></label>`).join('')}</div></fieldset>`
    : trainerField(trainerEscape(question.label), question.key, draft[question.key] || '', { multiline: true, required: question.required, maxlength: 2000 })).join('')}<p class="trainer-form-error" role="alert"></p><button type="submit" class="trainer-button">Отправить отчёт</button></form>${back}`;
}
function trenzoNextPlanMarkup(resolution) {
  const plan = resolution.nextPlan;
  return `<section class="trainer-card report-next-plan"><h2>Что меняется в следующем периоде</h2><p class="trainer-muted">План с ${plan.effectiveOn.split('-').reverse().join('.')}</p><dl class="report-answer-list"><div><dt>Тренировки</dt><dd>${trainerEscape(plan.training)}</dd></div><div><dt>Питание</dt><dd>${trainerEscape(plan.nutrition)}</dd></div><div><dt>Приоритет</dt><dd>${trainerEscape(plan.priority)}</dd></div></dl>${resolution.changes.length ? `<ul>${resolution.changes.map(change => `<li>${trainerEscape(change.exercise)}: ${change.from} → ${change.to} кг</li>`).join('')}</ul>` : '<p>Рабочие веса без численных изменений.</p>'}</section>`;
}
function trenzoReportMacroText(target) {
  return target ? `${trenzoReportNumber(target.calories)} ккал · Б ${trenzoReportNumber(target.protein_g)} · Ж ${trenzoReportNumber(target.fat_g)} · У ${trenzoReportNumber(target.carbs_g)} г` : 'План питания не назначен';
}
function trenzoReportNutrition(facts) {
  const current = facts.current, target = current.nutrition.target;
  return `<section class="trainer-card report-nutrition"><h2>Питание</h2><p class="report-nutrition-adherence">Соблюдение плана <strong>${trenzoReportNumber(current.nutrition.adherence, '%')}</strong></p><p class="trainer-muted">Внесено ${current.nutrition.days} дней из 7</p><div class="report-nutrition-target"><small>Ежедневный план недели</small><strong>${trenzoReportMacroText(target)}</strong></div><div class="report-table-wrap"><table class="report-nutrition-table"><caption class="trainer-sr-only">Дневник питания за семь дней. Процент — соответствие калорий плану.</caption><thead><tr><th>Дата</th><th>Ккал</th><th>Б</th><th>Ж</th><th>У</th><th title="Соответствие калорий плану">%</th></tr></thead><tbody>${Array.from({ length: 7 }, (_, day) => {
    const date = trainerShiftDate(facts.period.start, day), row = current.raw.nutrition.find(item => item.report_date === date);
    const score = row && target?.calories > 0 && Number.isFinite(row.calories) ? Math.round(Math.max(0, 100 - Math.abs(row.calories - target.calories) / target.calories * 100)) : null;
    return `<tr><th scope="row">${date.slice(5).split('-').reverse().join('.')}</th>${['calories', 'protein_g', 'fat_g', 'carbs_g'].map(key => `<td>${Number.isFinite(row?.[key]) ? trainerNumber(row[key], 0) : '—'}</td>`).join('')}<td>${score == null ? '—' : score + '%'}</td></tr>`;
  }).join('')}</tbody></table></div></section>`;
}
function trenzoReportSessionLogs(raw, session, sessions) {
  const uniqueTitle = sessions.filter(item => item.title === session.title).length === 1;
  return raw.workouts.filter(item => session.id && item.sessionId ? session.id === item.sessionId : uniqueTitle && item.title === session.title);
}
function trenzoReportTraining(facts) {
  const sessions = facts.plan?.sessions || [], current = facts.current.raw, previous = facts.previous.raw;
  const used = new Set();
  const rows = sessions.map(session => {
    const logs = trenzoReportSessionLogs(current, session, sessions), earlier = trenzoReportSessionLogs(previous, session, sessions);
    logs.forEach(log => used.add(log.id));
    const last = logs[logs.length - 1], before = earlier[earlier.length - 1];
    const directions = (last?.exercises || []).map(exercise => trainerWorkoutComparison(exercise, before?.exercises.find(item => item.name === exercise.name)));
    const counts = direction => directions.filter(item => item === direction).length;
    const summary = !last ? 'Нет результата в дневнике' : [counts('up') ? `Нагрузка выросла: ${counts('up')}` : '', counts('down') ? `Нагрузка снизилась: ${counts('down')}` : '', counts('stable') ? `Без изменений: ${counts('stable')}` : '', counts('mixed') ? 'Есть разнонаправленные изменения' : '', directions.every(item => item === 'unknown') ? 'Нет сопоставимой прошлой записи' : ''].filter(Boolean).join(' · ');
    const body = logs.length ? logs.map(log => '<small>' + trainerDateLabel(log.workout_date) + ' · результат клиента</small>' + log.exercises.map(exercise => {
      const prior = before?.exercises.find(item => item.name === exercise.name);
      return '<div class="report-exercise"><strong>' + trainerEscape(exercise.name) + '</strong><p>' + exercise.sets.map(set => trainerEscape(trainerSetLabel(set))).join(' · ') + '</p>' + (prior ? '<small>Ранее: ' + prior.sets.map(set => trainerEscape(trainerSetLabel(set))).join(' · ') + '</small>' : '<small>Нет прошлой записи для сравнения.</small>') + '</div>';
    }).join('')).join('') : '<p class="trainer-muted">Результат не внесён. Это не подтверждённый пропуск.</p>' + session.exercises.map(exercise => '<div class="report-exercise"><strong>' + trainerEscape(exercise.name) + '</strong><small>План: ' + exercise.sets + ' × ' + trainerEscape(exercise.reps) + ' · ' + trenzoReportNumber(exercise.weightKg, ' кг') + '</small></div>').join('');
    return '<details class="report-session"><summary><span><strong>' + trainerEscape(session.title) + '</strong><small>' + summary + (last?.rpe != null ? ' · RPE ' + (before?.rpe != null ? trenzoReportNumber(before.rpe) + ' → ' : '') + trenzoReportNumber(last.rpe) : '') + '</small></span>' + trainerIcon('arrow') + '</summary><div class="report-session-body">' + body + '</div></details>';
  }).join('');
  const extra = current.workouts.filter(log => !used.has(log.id)).map(log => `<details class="report-session"><summary><span><strong>${trainerEscape(log.title)}</strong><small>Запись вне сопоставленного плана</small></span>${trainerIcon('arrow')}</summary><div class="report-session-body">${log.exercises.map(exercise => `<div class="report-exercise"><strong>${trainerEscape(exercise.name)}</strong><p>${exercise.sets.map(set => trainerEscape(trainerSetLabel(set))).join(' · ')}</p></div>`).join('')}</div></details>`).join('');
  return `<section class="trainer-card report-training"><div class="report-section-title"><h2>Тренировки</h2><strong>${facts.current.training.completed} из ${facts.current.training.planned ?? '—'}</strong></div>${!current.workouts.length ? '<p class="trainer-muted">За период нет записанных результатов тренировок. Объяснение клиента — в блоке состояния.</p>' : ''}${rows}${extra}${!rows && !extra ? '<p class="trainer-muted">План тренировок не назначен.</p>' : ''}</section>`;
}
function trenzoReportProposal(plan, facts, editing = {}) {
  if (!plan) return '<p class="trainer-muted">Нет назначенной программы. Тренировочный цикл и КБЖУ не формируем без исходного плана.</p>';
  const original = trenzoReports.proposal(trainerUI.route.id, true);
  const id = trainerUI.route.id;
  const editButton = (block, day, label) => '<button type="button" class="report-inline-edit' + (block === 'training' ? ' is-text' : '') + '" data-action="report-edit-block" data-id="' + trainerEscape(id) + '" data-block="' + block + '"' + (day == null ? '' : ' data-day="' + day + '"') + ' aria-label="' + trainerEscape(label) + '" title="' + trainerEscape(label) + '">' + (block === 'training' ? 'Изменить' : trainerIcon('edit')) + '</button>';
  return '<section class="trainer-card report-proposal-training"><h3>Следующий тренировочный цикл · ' + plan.sessions.length + ' тренировок</h3>' + plan.sessions.map((session, day) => {
    const attrs = editing.sessions?.includes(day) ? 'data-report-prescription' : 'readonly';
    return '<div class="report-proposal-workout"><details class="report-session report-proposal-session" data-report-disclosure="proposal-' + day + '"><summary><span><span class="report-workout-title"><strong>' + trainerEscape(session.title) + '</strong>' + editButton('training', day, 'Изменить тренировку ' + session.title) + '</span><small>' + session.exercises.length + ' упражнений · параметры и причины</small></span>' + trainerIcon('arrow') + '</summary><div class="report-session-body">' + session.exercises.map((exercise, index) => {
      const before = original?.sessions[day]?.exercises[index];
      const changed = before && ['sets', 'reps', 'weightKg'].some(key => exercise[key] !== before[key]);
      return '<div class="report-exercise"><strong>' + trainerEscape(exercise.name) + '</strong><small class="report-prescription-state">' + (changed ? 'Изменение: ' + before.sets + ' × ' + trainerEscape(before.reps) + ', ' + trenzoReportNumber(before.weightKg) + ' → ' + exercise.sets + ' × ' + trainerEscape(exercise.reps) + ', ' + trenzoReportNumber(exercise.weightKg) + ' кг' : 'Без изменений') + '</small><div class="report-prescription-fields">' +
        trainerField('Подходы', 'report-sets-' + day + '-' + index, exercise.sets, { type: 'number', min: 1, max: 20, step: 1, required: true, extra: attrs }) +
        trainerField('Повторения', 'report-reps-' + day + '-' + index, exercise.reps, { required: true, maxlength: 40, extra: attrs }) +
        trainerField('Вес, кг', 'report-weight-' + day + '-' + index, exercise.weightKg, { type: 'number', min: 0, max: 1000, step: '0.5', required: true, extra: attrs }) +
        '</div><p class="report-reason">' + trainerEscape(exercise.reason || 'Параметры согласовываются тренером.') + '</p></div>';
    }).join('') + '</div></details></div>';
  }).join('') + '</section><section class="trainer-card report-proposal-nutrition"><div class="report-block-heading"><h3>Питание на следующую неделю</h3>' + (plan.nutritionTarget ? editButton('nutrition', null, 'Изменить питание на следующую неделю') : '') + '</div>' +
    (plan.nutritionTarget ? '<div class="report-prescription-fields is-nutrition">' + [['calories', 'Ккал'], ['protein_g', 'Белки, г'], ['fat_g', 'Жиры, г'], ['carbs_g', 'Угл., г']].map(([key, label]) => trainerField(label, 'report-' + key, plan.nutritionTarget[key], { type: 'number', min: key === 'calories' ? 1 : 0, max: key === 'calories' ? 10000 : 1500, step: 1, required: true, extra: editing.nutrition ? 'data-report-prescription' : 'readonly' })).join('') + '</div>' : '<p class="trainer-muted">План питания не назначен.</p>') +
    '<p class="report-reason">' + trainerEscape(plan.nutritionReason) + '</p></section>';
}
function trenzoReportDelivery(resolution, answers) {
  const delivery = resolution.delivery || { sessions: resolution.nextPlan.plan?.sessions || [], nutrition: resolution.nextPlan.plan?.nutritionTarget, clientComment: answers.comment || answers.difficulty || '', trainerComment: resolution.feedback };
  return '<section class="trainer-card report-delivery"><h2>Ответ клиенту</h2>' + trenzoReportAgreedPlan(delivery) +
    '<div class="report-client-quote"><small>Комментарий клиента</small><p>' + trainerEscape(delivery.clientComment || 'Комментарий не добавлен.') + '</p></div>' +
    '<div class="report-client-quote"><small>Комментарий тренера</small><p>' + trainerEscape(delivery.trainerComment || 'Без комментария.') + '</p></div></section>';
}
function trenzoTrainerReportScreen(cycle) {
  const client = trainerStore.client(cycle.clientId);
  if (!cycle.submission) return '<div class="trainer-page-heading"><h1>' + trainerEscape(trainerFullName(client)) + '</h1><p>Отчёт не поступил · ' + trainerPeriodLabel(cycle) + '</p></div>';
  const facts = trenzoReports.facts(cycle.id), analysis = trenzoReports.analyze(cycle.id);
  const draft = cycle.trainerDraft || trenzoReports.createTrainerDraft(cycle.id);
  draft.weeklyPlan = Object.prototype.hasOwnProperty.call(draft, 'weeklyPlan') ? draft.weeklyPlan : trenzoReports.proposal(cycle.id, draft.mode === 'keep');
  const chosen = draft.planAccepted === true;
  const editing = draft.editingBlocks || { sessions: [], nutrition: false };
  return '<div class="trainer-page-heading"><p class="trainer-kicker">ОТЧЁТ · ' + trainerPeriodLabel(cycle) + '</p><h1>' + trainerEscape(trainerFullName(facts.client)) + '</h1>' + (cycle.resolution ? '<small>Разобран</small>' : '') + '</div>' +
    trenzoReportFactsMarkup(facts) + trenzoClientWords(cycle) + trenzoReportNutrition(facts) + trenzoReportTraining(facts) +
    '<section class="trainer-card trainer-ai-summary"><div class="trainer-ai-summary-heading">' + trainerIcon('ai') + '<strong>Что заметил TRENZO</strong></div>' + analysis.observations.map(text => '<p>' + trainerEscape(text) + '</p>').join('') + '</section>' +
    (cycle.resolution ? trenzoReportDelivery(cycle.resolution, cycle.submission.answers) :
      '<form class="trainer-form report-trainer-form" novalidate data-form="period-trainer-report" data-id="' + trainerEscape(cycle.id) + '"><section class="report-recommendations"><h2 class="report-proposal-heading">Предложение TRENZO</h2>' +
      trenzoReportProposal(draft.weeklyPlan, facts, editing) +
      '<div class="report-decision-actions">' + trainerAction('report-decision', 'Принять', { id: cycle.id, mode: 'accept' }, 'trainer-button') + trainerAction('report-decision', 'Изменить', { id: cycle.id, mode: 'edit' }, 'trainer-secondary-button') + '</div>' +
      (chosen ? '<small class="report-plan-confirmation">План принят.</small>' : '<small class="report-plan-confirmation">После проверки и правок нажмите «Принять».</small>') + '</section>' +
      '<div class="report-generation-step"' + (chosen && draft.responseGenerated ? ' hidden' : '') + '><p class="trainer-form-error" role="alert"></p><button type="button" class="trainer-button report-generate-response" data-action="report-generate-response" data-id="' + trainerEscape(cycle.id) + '" ' + (chosen ? '' : 'disabled') + '>Сформировать ответ клиенту</button></div>' +
      (chosen && draft.responseGenerated ? trenzoReportResponseDraft(cycle, draft) : '') + '</form>');
}
function trenzoReportResponseDraft(cycle, draft) {
  const delivery = { sessions: draft.weeklyPlan?.sessions || [], nutrition: draft.weeklyPlan?.nutritionTarget };
  return '<section class="trainer-card report-response-draft report-feedback"><h2>Ответ клиенту</h2>' + trenzoReportAgreedPlan(delivery) +
    '<div class="report-client-quote"><small>Комментарий клиента</small><p>' + trainerEscape(cycle.submission.answers.comment || cycle.submission.answers.difficulty || 'Комментарий не добавлен.') + '</p></div>' +
    trainerField('Комментарий тренера — необязательно', 'feedback', draft.feedback || '', { multiline: true, maxlength: 4000 }) +
    '<p class="trainer-form-error" role="alert"></p><button type="submit" class="trainer-button">Отправить клиенту</button></section>';
}
function trenzoReportAgreedPlan(delivery) {
  return '<h3>Согласованные тренировки · ' + delivery.sessions.length + '</h3>' + delivery.sessions.map(session => '<details class="report-session" data-report-disclosure="response-' + trainerEscape(session.id) + '"><summary><span><strong>' + trainerEscape(session.title) + '</strong><small>' + session.exercises.length + ' упражнений</small></span>' + trainerIcon('arrow') + '</summary><div class="report-session-body">' + session.exercises.map(exercise => '<div class="report-exercise"><strong>' + trainerEscape(exercise.name) + '</strong><p>' + exercise.sets + ' × ' + trainerEscape(exercise.reps) + ' · ' + trenzoReportNumber(exercise.weightKg, ' кг') + '</p></div>').join('') + '</div></details>').join('') +
    '<h3>Согласованное питание</h3><p>' + trenzoReportMacroText(delivery.nutrition) + '</p>';
}
function trenzoReadTrainerForm(form, forceEdit = false) {
  const cycle = trenzoReports.get(form.dataset.id), previous = cycle.trainerDraft;
  const draft = previous || { ...trenzoReports.createTrainerDraft(cycle.id), mode: null };
  if (forceEdit) draft.mode = 'edit';
  if (!Object.prototype.hasOwnProperty.call(draft, 'weeklyPlan')) draft.weeklyPlan = trenzoReports.proposal(cycle.id, draft.mode === 'keep');
  const previousPlan = JSON.stringify(draft.weeklyPlan);
  const values = new FormData(form), numeric = name => values.get(name) === '' ? null : Number(values.get(name));
  draft.weeklyPlan?.sessions.forEach((session, day) => session.exercises.forEach((exercise, index) => {
    for (const [field, prefix] of [['weightKg', 'weight'], ['sets', 'sets'], ['reps', 'reps']]) {
      const key = 'report-' + prefix + '-' + day + '-' + index;
      if (values.has(key)) {
        const value = field === 'reps' ? String(values.get(key)) : numeric(key);
        if (exercise[field] !== value) exercise.editedByTrainer = true;
        exercise[field] = value;
      }
    }
  }));
  if (draft.weeklyPlan?.nutritionTarget) for (const key of ['calories', 'protein_g', 'fat_g', 'carbs_g']) {
    if (values.has('report-' + key)) draft.weeklyPlan.nutritionTarget[key] = numeric('report-' + key);
  }
  draft.nextPlan = { training: (draft.weeklyPlan?.sessions.length || 0) + ' тренировок на неделю', nutrition: trenzoReportMacroText(draft.weeklyPlan?.nutritionTarget), priority: trenzoReports.analyze(cycle.id).priorityText };
  if (values.has('feedback')) {
    const feedback = String(values.get('feedback') || '');
    if (feedback !== draft.feedback) draft.feedbackEdited = true;
    draft.feedback = feedback;
  }
  if (JSON.stringify(draft.weeklyPlan) !== previousPlan) {
    draft.planAccepted = false;
    draft.responseGenerated = false;
    trenzoReportInvalidateResponse(form);
  }
  return draft;
}
function trenzoReportInvalidateResponse(form) {
  const response = form.querySelector?.('.report-response-draft');
  const generation = form.querySelector?.('.report-generation-step');
  const generateButton = form.querySelector?.('.report-generate-response');
  const confirmation = form.querySelector?.('.report-plan-confirmation');
  if (response) response.hidden = true;
  if (generation) generation.hidden = false;
  if (generateButton) generateButton.disabled = true;
  if (confirmation) confirmation.textContent = 'После правок нажмите «Принять».';
}
function trenzoReportInput(input) {
  const form = input.closest?.('form');
  if (form?.dataset.form === 'period-client-report') { trenzoReports.saveClientDraft(form.dataset.id, Object.fromEntries(new FormData(form))); return true; }
  if (form?.dataset.form === 'period-trainer-report') {
    const draft = trenzoReadTrainerForm(form, input.hasAttribute('data-report-prescription'));
    if (input.name === 'feedback') draft.feedbackEdited = true;
    if (input.hasAttribute('data-report-prescription')) {
      draft.planAccepted = false;
      draft.responseGenerated = false;
      const status = input.closest?.('.report-exercise')?.querySelector('.report-prescription-state');
      if (status) status.textContent = 'Изменено тренером';
      trenzoReportInvalidateResponse(form);
    }
    trenzoReports.saveDraft(form.dataset.id, draft); return true;
  }
  return false;
}
function trenzoReportClick(values, form = null) {
  const { action, id, mode, value } = values;
  if (action === 'report-filter') { trenzoReportUI.filter = value; trainerRender(); }
  if (action === 'report-client') trainerGo('client-report', { id });
  if (action === 'report-review') trainerGo('review', { id });
  if (action === 'report-decision' || action === 'report-edit-block') {
    if (action === 'report-decision' && mode === 'accept' && form && !trenzoReportValidForm(form)) return;
    const root = typeof document === 'undefined' ? null : document.getElementById('trainerScreen');
    const opened = new Set([...(root?.querySelectorAll('details[data-report-disclosure][open]') || [])].map(item => item.dataset.reportDisclosure));
    const draft = form ? trenzoReadTrainerForm(form) : trenzoReports.get(id).trainerDraft || { ...trenzoReports.createTrainerDraft(id), mode: null };
    if (!Object.prototype.hasOwnProperty.call(draft, 'weeklyPlan')) draft.weeklyPlan = trenzoReports.proposal(id);
    if (action === 'report-edit-block' || mode === 'edit') {
      draft.mode = 'edit'; draft.planAccepted = false;
      draft.editingBlocks ||= { sessions: [], nutrition: false };
      if (action === 'report-edit-block' && values.block === 'training') {
        const day = Number(values.day);
        if (!Number.isInteger(day) || !draft.weeklyPlan?.sessions[day]) throw new Error('Тренировка не найдена.');
        if (!draft.editingBlocks.sessions.includes(day)) draft.editingBlocks.sessions.push(day);
        opened.add('proposal-' + day);
      } else if (action === 'report-edit-block' && values.block === 'nutrition') {
        if (!draft.weeklyPlan?.nutritionTarget) throw new Error('План питания не назначен.');
        draft.editingBlocks.nutrition = true;
      } else if (action === 'report-decision') {
        draft.editingBlocks = { sessions: (draft.weeklyPlan?.sessions || []).map((_, day) => day), nutrition: !!draft.weeklyPlan?.nutritionTarget };
      } else throw new Error('Блок не найден.');
    } else if (mode === 'accept') {
      draft.mode = draft.mode === 'edit' ? 'edit' : 'accept'; draft.planAccepted = true;
      draft.editingBlocks = { sessions: [], nutrition: false };
    } else throw new Error('Неизвестное действие.');
    draft.responseGenerated = false;
    if (!draft.feedbackEdited) draft.feedback = '';
    trenzoReports.saveDraft(id, draft); trainerRender();
    root?.querySelectorAll('details[data-report-disclosure]').forEach(item => { item.open = opened.has(item.dataset.reportDisclosure); });
  }
  if (action === 'report-generate-response') {
    if (form && !trenzoReportValidForm(form)) return;
    const draft = form ? trenzoReadTrainerForm(form) : trenzoReports.get(id)?.trainerDraft;
    if (!draft?.planAccepted) throw new Error('Сначала примите план кнопкой «Принять».');
    if (!draft.feedbackEdited) draft.feedback = '';
    draft.responseGenerated = true;
    trenzoReports.saveDraft(id, draft);
    trainerRender();
    document.getElementById('trainerScreen')?.querySelector?.('.report-response-draft')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }
}
function trenzoReportValidForm(form) {
  const invalid = form.querySelector('input:invalid, textarea:invalid, select:invalid');
  const details = invalid?.closest?.('details');
  if (details) details.open = true;
  return form.reportValidity();
}
function trenzoReportSubmit(event) {
  const form = event.target;
  event.preventDefault();
  if (!trenzoReportValidForm(form)) return;
  try {
    if (form.dataset.form === 'period-client-report') trenzoReports.submit(form.dataset.id, Object.fromEntries(new FormData(form)));
    else {
      const draft = trenzoReadTrainerForm(form);
      if (!draft.mode) throw new Error('Примите решение по предложению.');
      if (!draft.planAccepted) {
        trenzoReports.saveDraft(form.dataset.id, draft);
        throw new Error('После правок примите план кнопкой «Принять».');
      }
      if (!draft.responseGenerated) {
        trenzoReports.saveDraft(form.dataset.id, draft);
        throw new Error('Сначала сформируйте ответ клиенту.');
      }
      trenzoReports.close(form.dataset.id, draft);
    }
    trainerRender();
  } catch (error) { (form.querySelector('.report-response-draft:not([hidden]) .trainer-form-error') || form.querySelector('.trainer-form-error')).textContent = error.message; }
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
