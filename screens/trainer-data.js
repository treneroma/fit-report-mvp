/* Frontend-прототип тренера. Все примеры и изменения хранятся отдельно от
   реальных данных спортсмена. Здесь позже подключается серверный адаптер.
   Вес, питание и журнал используют поля существующих athlete API. */

function trainerDemoDate(daysAgo = 0, now = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date(now - daysAgo * 86400000));
}

function trainerCopy(value) { return JSON.parse(JSON.stringify(value)); }

const trainerDefaultReviewSchedule = { day: 0, time: '18:00', timeZone: 'Europe/Moscow' };
function trainerShiftDate(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
function trainerDayDistance(start, end) { return Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86400000); }
function trainerScheduleClock(schedule, now = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: schedule.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(now));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` };
}
// Семь календарных дат, а не 168 часов: границы не ломаются при смене часового пояса/DST.
function trainerWeeklyPeriod(schedule = trainerDefaultReviewSchedule, now = Date.now()) {
  const clock = trainerScheduleClock(schedule, now);
  const weekday = new Date(`${clock.date}T12:00:00Z`).getUTCDay();
  let reviewDate = trainerShiftDate(clock.date, -((weekday - schedule.day + 7) % 7));
  if (reviewDate === clock.date && clock.time < schedule.time) reviewDate = trainerShiftDate(reviewDate, -7);
  return { start: trainerShiftDate(reviewDate, -7), end: trainerShiftDate(reviewDate, -1), reviewDate };
}
function trainerPlanAt(client, date) {
  const assignment = (client.planHistory || []).filter(entry => entry.effectiveOn <= date).sort((a, b) => b.effectiveOn.localeCompare(a.effectiveOn))[0];
  if (!assignment?.program) return null;
  const weekIndex = (assignment.startWeek || 1) - 1 + Math.floor(trainerDayDistance(assignment.effectiveOn, date) / 7);
  const week = assignment.program.weeks[weekIndex];
  if (!week) return null;
  return trainerCopy({ title: assignment.program.title, weekNumber: weekIndex + 1, sessions: week.sessions, nutritionTarget: assignment.nutritionTarget });
}
function trainerWorkoutComparison(current, previous) {
  if (!previous || current.sets.length !== previous.sets.length || !current.sets.length) return 'unknown';
  const valid = set => Number.isFinite(set.weight_kg) && set.weight_kg >= 0 && Number.isFinite(set.reps) && set.reps > 0 && !set.duration_seconds;
  if (![...current.sets, ...previous.sets].every(valid)) return 'unknown';
  const changes = current.sets.flatMap((set, i) => [set.weight_kg - previous.sets[i].weight_kg, set.reps - previous.sets[i].reps]);
  if (changes.every(value => value === 0)) return 'stable';
  if (changes.every(value => value >= 0)) return 'up';
  if (changes.every(value => value <= 0)) return 'down';
  return 'mixed';
}
function trainerWeeklyData(client, review) {
  if (review.reportSnapshot) return trainerCopy(review.reportSnapshot);
  const inPeriod = date => date >= review.start && date <= review.end;
  const workouts = client.workouts.filter(item => inPeriod(item.workout_date)).sort((a, b) => a.workout_date.localeCompare(b.workout_date));
  const previous = client.workouts.filter(item => item.workout_date >= trainerShiftDate(review.start, -7) && item.workout_date < review.start).sort((a, b) => a.workout_date.localeCompare(b.workout_date));
  const key = (workout, exercise) => `${workout.title}\u0000${workout.sessionId || ''}\u0000${exercise.exerciseId || exercise.name}`;
  const before = new Map(), after = new Map();
  previous.forEach(workout => workout.exercises.forEach(exercise => before.set(key(workout, exercise), { exercise, date: workout.workout_date })));
  workouts.forEach(workout => {
    const dayIndex = review.plan?.sessions.findIndex(session => session.id && session.id === workout.sessionId) ?? -1;
    const sessionLabel = dayIndex >= 0 ? `${workout.title} · день ${dayIndex + 1}` : workout.title;
    workout.exercises.forEach(exercise => after.set(key(workout, exercise), { exercise, date: workout.workout_date, session: sessionLabel }));
  });
  const comparisons = [...after].map(([id, entry]) => ({ name: entry.exercise.name, session: entry.session, date: entry.date, previousDate: before.get(id)?.date || null, previous: before.get(id)?.exercise || null, current: entry.exercise, direction: trainerWorkoutComparison(entry.exercise, before.get(id)?.exercise) }));
  const weights = client.weights.filter(item => item.measured_on <= review.end).sort((a, b) => a.measured_on.localeCompare(b.measured_on));
  const latestWeight = weights[weights.length - 1] || null;
  const baseline = weights.filter(item => item.measured_on < review.start).pop();
  const measurements = (client.measurementHistory || []).filter(item => item.measured_on <= review.end).sort((a, b) => a.measured_on.localeCompare(b.measured_on)).pop() || null;
  // Последняя запись дня, не сумма повторно отправленных дневников.
  const nutrition = [...new Map(client.nutrition.filter(item => inPeriod(item.report_date)).map(item => [item.report_date, item])).values()].sort((a, b) => a.report_date.localeCompare(b.report_date));
  return trainerCopy({ workouts, nutrition, latestWeight, measurements, comparisons,
    weightDelta: latestWeight && inPeriod(latestWeight.measured_on) && baseline ? Number((latestWeight.weight_kg - baseline.weight_kg).toFixed(1)) : null,
    media: (client.mediaReports || []).filter(item => inPeriod(item.recorded_on) && ['photo', 'video'].includes(item.type)) });
}

function trainerProgramWeeks(count = 6, days = 3) {
  const exercises = [
    { name: 'Присед со штангой', sets: 3, reps: '8–10', weightKg: 80, effortType: 'RIR', effort: 2, restSeconds: 120, notes: 'Сохраняй устойчивую технику.' },
    { name: 'Жим лёжа', sets: 3, reps: '8–10', weightKg: 60, effortType: 'RIR', effort: 2, restSeconds: 120, notes: '' },
    { name: 'Тяга верхнего блока', sets: 3, reps: '10–12', weightKg: 45, effortType: 'RIR', effort: 2, restSeconds: 90, notes: '' },
    { name: 'Румынская тяга', sets: 3, reps: '10–12', weightKg: 50, effortType: 'RIR', effort: 3, restSeconds: 120, notes: '' },
    { name: 'Планка', sets: 3, reps: '30–45 сек', weightKg: 0, effortType: 'RPE', effort: 7, restSeconds: 60, notes: 'Без дополнительного веса.' }
  ];
  return Array.from({ length: count }, (_, week) => ({
    number: week + 1,
    sessions: Array.from({ length: days }, (_, day) => ({
      id: `day-${day + 1}`,
      title: days === 4 ? (day % 2 ? 'Lower · Низ тела' : 'Upper · Верх тела') : `Full Body · ${['A', 'B', 'C', 'D', 'E', 'F'][day]}`,
      exercises: trainerCopy(days === 4 ? exercises.filter((_, i) => day % 2 ? [0, 3, 4].includes(i) : [1, 2, 4].includes(i)) : exercises)
    }))
  }));
}

function trainerCreateDemoData(now = Date.now()) {
  const period = trainerWeeklyPeriod(trainerDefaultReviewSchedule, now);
  const specs = [
    ['alexander', 'Александр', 'Иванов', 'Снижение веса', 82.4, 79, -0.4, 3, 3, 91, 8.8, 'fullbody'],
    ['maria', 'Мария', 'Петрова', 'Снижение веса', 65.2, 62, 0, 2, 2, 97, 7.1, 'fullbody-two'],
    ['maxim', 'Максим', 'Соколов', 'Набор мышечной массы', 76.8, 80, 0.1, 0, 3, null, null, 'fullbody'],
    ['anna', 'Анна', 'Орлова', 'Изменение состава тела', 59.6, 59, -0.2, 3, 3, 94, 7.2, 'fullbody'],
    ['ilya', 'Илья', 'Морозов', 'Рост силовых показателей', 88.5, 89, 0.2, 4, 4, 96, 7, 'upperlower'],
    ['ekaterina', 'Екатерина', 'Волкова', 'Снижение веса', 71.1, 68, -0.3, 2, 3, 86, 7.6, 'fullbody'],
    ['andrey', 'Андрей', 'Козлов', 'Поддержание формы', 81.3, 81, 0, 4, 4, 98, 7.3, 'upperlower']
  ];
  const clients = specs.map(([id, name, surname, goal, weight, target, delta, completed, planned, nutrition, rpe, programId], index) => ({
    id, name, surname, goal, targetWeight: target, currentWeek: 5, totalWeeks: programId.startsWith('fullbody') ? 6 : 8,
    activityDate: trainerDemoDate(id === 'maxim' ? 8 : 0, now),
    metrics: { workoutCompleted: completed, workoutTarget: planned, weightDelta: delta, nutritionPercent: nutrition, rpe },
    programId, programCompleted: completed, programOverrides: {}, equipment: 'Тренажёрный зал',
    restrictions: id === 'alexander' ? 'Дискомфорт плеча при вертикальном жиме' : 'Не указаны',
    preferences: id === 'maria' ? 'Предпочитает тренировки без выпадов' : 'Без специальных предпочтений',
    // Совместимый формат существующих weight-history и nutrition-report.
    weights: Array.from({ length: 5 }, (_, point) => ({
      id: index * 10 + point + 1, measured_on: trainerShiftDate(period.end, -(4 - point) * 7),
      weight_kg: Number((weight - delta * (4 - point)).toFixed(1)), source: 'manual'
    })),
    nutrition: nutrition === null ? [] : Array.from({ length: 7 }, (_, day) => ({
      id: index * 10 + day + 1, report_date: trainerShiftDate(period.start, day),
      calories: 2280 + day * 15, protein_g: 142 + day, fat_g: 70, carbs_g: 275 + day
    })),
    nutritionTarget: { calories: 2500, protein_g: 160, fat_g: 75, carbs_g: 295 },
    workouts: Array.from({ length: completed }, (_, day) => ({
      id: `workout-${id}-${day}`, workout_date: trainerDemoDate(day * 2, now), title: programId === 'upperlower' ? (day % 2 ? 'Lower · Низ тела' : 'Upper · Верх тела') : `Full Body · ${['A', 'B', 'C', 'D'][day]}`, rpe,
      exercises: [{ name: 'Жим лёжа', sets: [{ weight_kg: id === 'alexander' ? 80 : 60, reps: 9 }, { weight_kg: id === 'alexander' ? 80 : 60, reps: 8 }, { weight_kg: id === 'alexander' ? 75 : 60, reps: 8 }] }]
    })),
    measurements: { waist_cm: id === 'alexander' ? 86 : 78 + index, chest_cm: 100 + index, hips_cm: 96 + index },
    records: [{ exercise: 'Присед со штангой', value: '80 кг × 10' }, { exercise: 'Жим лёжа', value: id === 'alexander' ? '80 кг × 9' : '60 кг × 10' }],
    decisions: [
      { id: `seed-${id}-1`, date: trainerDemoDate(15, now), action: 'Зафиксирована программа и согласована частота тренировок.' },
      ...(id === 'alexander' ? [{ id: 'seed-shoulder', date: trainerDemoDate(9, now), action: 'Вертикальный жим заменён после сообщения о дискомфорте плеча.' }] : []),
      ...(id === 'andrey' ? [{ id: 'seed-nutrition', date: trainerDemoDate(0, now), action: 'Сохранить текущие цели питания.', reviewId: 'nutrition' }] : [])
    ].sort((a, b) => b.date.localeCompare(a.date))
  }));
  const reviews = [
    { id: 'recovery', clientId: 'alexander', type: 'Тренировка', title: 'Восстановление ухудшается', kind: 'attention', status: 'requires_action', priority: 95, minutesAgo: 12,
      tags: ['RPE ↑', '3 тренировки подряд'], note: 'TRENZO заметил изменение',
      event: 'Жим лёжа: 80 кг × 9 · 80 кг × 8 · 80 кг × 7 · 75 кг × 8',
      context: [{ label: 'RPE', value: '9 ↑' }, { label: 'Прошлая тренировка', value: 'RPE 7,5' }],
      facts: ['RPE вырос с 7,5 до 9.', 'Повторы снижаются в сопоставимых подходах жима лёжа.'],
      analysis: 'В записи жима лёжа снизились повторения и выросла субъективная тяжесть.',
      hypothesis: 'Причину изменения нужно уточнить у подопечного; RPE не является количеством повторений.',
      proposedAction: 'Не увеличивать нагрузку. Сохранить 80 кг в жиме лёжа и повторно оценить восстановление через 48 часов.' },
    { id: 'plateau', clientId: 'maria', type: 'Итоги недели', title: 'Вес без изменений 16 дней', kind: 'attention', status: 'requires_action', priority: 80, minutesAgo: 46,
      tags: ['Питание 97%', 'Тренировки 8/8', 'Активность стабильна'], note: 'Есть вариант корректировки', event: 'Средний вес за последние две недели: 65,2 кг → 65,2 кг.',
      context: [{ label: 'Вес', value: '65,2 кг' }, { label: 'Питание', value: '97%' }, { label: 'Тренировки за 4 недели', value: '8 / 8' }],
      facts: ['Средний вес не меняется 16 дней.', 'Запланированные тренировки выполнены.', 'Активность по отчётам стабильна.'],
      analysis: 'Вес перестал снижаться при стабильной активности.', hypothesis: 'Нужно проверить полноту дневника и условия взвешивания перед корректировкой.',
      proposedAction: 'Уточнить дневник питания и условия взвешивания. После проверки данных обсудить небольшую корректировку целевой калорийности.' },
    { id: 'inactive', clientId: 'maxim', type: 'Активность', title: 'Нет тренировок 8 дней', kind: 'inactive', status: 'requires_action', priority: 70, minutesAgo: 90,
      tags: [`Последняя активность: ${trainerDemoDate(8, now).split('-').reverse().join('.')}`], note: 'Нужна обратная связь', event: 'За последние 8 дней не поступило ни одной записи о тренировке.',
      context: [{ label: 'План', value: '3 раза в неделю' }, { label: 'Последняя активность', value: trainerDemoDate(8, now).split('-').reverse().join('.') }],
      facts: ['Новых записей о тренировках нет 8 дней.'], analysis: 'В дневнике появился перерыв в тренировочной активности.',
      hypothesis: 'Отсутствие записи не подтверждает пропуск тренировки. Максим мог не внести данные.', proposedAction: 'Связаться с Максимом и уточнить, тренируется ли он и нужна ли помощь с возвращением к плану.' },
    { id: 'weekly', clientId: 'ekaterina', type: 'Отчёт недели', title: 'Новый отчёт недели', kind: 'attention', status: 'new', priority: 40, minutesAgo: 34,
      tags: ['Тренировки 2/3', 'Вес −0,3 кг'], note: 'Отчёт готов к разбору', event: 'Екатерина прислала отчёт: две тренировки выполнены, третья перенесена. Средний вес снизился на 0,3 кг.',
      context: [{ label: 'Тренировки', value: '2 / 3' }, { label: 'Питание', value: '86%' }],
      facts: ['Выполнено 2 из 3 тренировок.', 'Вес снизился на 0,3 кг за неделю.'], analysis: 'Динамика веса сохраняется, но одна тренировка пока не отмечена.',
      hypothesis: 'Перенос одной тренировки сам по себе не требует изменения программы.', proposedAction: 'Согласовать удобный день перенесённой тренировки и сохранить текущую программу.' },
    { id: 'squat', clientId: 'ilya', type: 'Прогрессия нагрузки', title: 'Изменить рабочий вес в приседе', kind: 'decision', status: 'requires_action', priority: 60, minutesAgo: 70,
      tags: ['80 кг → 82,5 кг'], note: 'Решение на согласование', event: 'Присед со штангой: 80 кг × 10 · 80 кг × 10 · 80 кг × 10.',
      context: [{ label: 'RPE', value: '7' }, { label: 'Техника', value: 'По отчёту стабильна' }],
      facts: ['В трёх подходах достигнута верхняя граница повторений.', 'Рабочий вес 80 кг, субъективная нагрузка RPE 7.'],
      analysis: 'Показатели позволяют рассмотреть минимальное повышение нагрузки.', hypothesis: 'Повышение уместно, если техника и восстановление действительно сохраняются.',
      proposedAction: 'На следующей тренировке повысить вес в приседе со штангой с 80 до 82,5 кг.', change: { exercise: 'Присед со штангой', weightKg: 82.5 } },
    { id: 'nutrition', clientId: 'andrey', type: 'Питание', title: 'Дневник питания разобран', kind: 'report', status: 'approved', priority: 0, minutesAgo: 120,
      tags: ['Цель выполнена'], note: 'Разобрано тренером', event: 'КБЖУ за неделю внесены за 7 дней. Средняя калорийность близка к целевой.', context: [{ label: 'Выполнение цели', value: '98%' }],
      facts: ['Есть записи питания за все 7 дней.'], analysis: 'Рацион стабилен относительно плана.', hypothesis: '', proposedAction: 'Сохранить текущие цели питания.' }
  ].map(review => ({ ...review, occurredAt: new Date(now - review.minutesAgo * 60000).toISOString() }));
  const data = {
    version: 1,
    trainer: { name: 'Роман', surname: '', description: 'Помогаю выстроить устойчивые привычки и прогрессировать в тренировках.', specialization: 'Силовые тренировки · Онлайн-ведение', notifications: true, reviewSchedule: trainerCopy(trainerDefaultReviewSchedule) },
    clients, reviews, weeklyReviews: [], firstReviewStart: period.start,
    programs: [
      { id: 'fullbody', title: 'Full Body · Начальный', goal: 'Базовая сила и состав тела', source: 'mine', duration: 45, equipment: 'Тренажёрный зал', notes: '', weeks: trainerProgramWeeks(6, 3) },
      { id: 'fullbody-two', title: 'Full Body · Два дня', goal: 'Базовая сила и состав тела', source: 'mine', duration: 45, equipment: 'Тренажёрный зал', notes: '', weeks: trainerProgramWeeks(6, 2) },
      { id: 'upperlower', title: 'Upper / Lower', goal: 'Рост силовых показателей', source: 'mine', duration: 60, equipment: 'Тренажёрный зал', notes: '', weeks: trainerProgramWeeks(8, 4) },
      { id: 'template-fullbody', title: 'Full Body · Базовый', goal: 'Общая физическая подготовка', source: 'template', duration: 45, equipment: 'Тренажёрный зал', notes: '', weeks: trainerProgramWeeks(6, 3) },
      { id: 'template-upperlower', title: 'Upper / Lower · Сила', goal: 'Рост силы', source: 'template', duration: 60, equipment: 'Тренажёрный зал', notes: '', weeks: trainerProgramWeeks(8, 4) }
    ]
  };
  clients.forEach(client => {
    const program = data.programs.find(item => item.id === client.programId);
    client.joinedOn = trainerShiftDate(period.start, -35);
    client.planHistory = [{ effectiveOn: trainerShiftDate(period.start, -28), startWeek: 1, program: trainerCopy(program), nutritionTarget: trainerCopy(client.nutritionTarget) }];
    client.measurementHistory = [{ measured_on: period.end, ...client.measurements }];
    client.mediaReports = [];
    const sessions = program.weeks[4].sessions;
    client.workouts = Array.from({ length: client.metrics.workoutCompleted }, (_, day) => {
      const session = sessions[day];
      return { id: `workout-${client.id}-${day}`, sessionId: session.id, workout_date: trainerShiftDate(period.start, Math.min(6, day * 2)), title: session.title, rpe: client.metrics.rpe,
        exercises: session.exercises.map(exercise => ({ name: exercise.name, sets: Array.from({ length: exercise.sets }, () => exercise.reps.includes('сек') ? { weight_kg: 0, duration_seconds: 35 } : { weight_kg: exercise.weightKg, reps: client.id === 'ilya' ? 10 : 9 }) })) };
    });
    const previous = client.workouts.map(workout => ({ ...trainerCopy(workout), id: `${workout.id}-previous`, workout_date: trainerShiftDate(workout.workout_date, -7), exercises: workout.exercises.map(exercise => ({ ...trainerCopy(exercise), sets: exercise.sets.map(set => ({ ...set, ...(set.reps ? { reps: client.id === 'ilya' ? 9 : set.reps } : {}) })) })) }));
    client.workouts.unshift(...previous);
  });
  return data;
}

function createTrainerStore() {
  let state = trainerCreateDemoData();
  let storage = null;
  let storageKey = '';
  let loadedKey = null;
  let storageWarning = '';
  const pending = review => ['new', 'requires_action'].includes(review.status);
  const client = id => state.clients.find(item => item.id === id);
  const review = id => state.weeklyReviews.find(item => item.id === id) || state.reviews.find(item => item.id === id);
  const program = id => state.programs.find(item => item.id === id);
  function persist() {
    if (!storage) { storageWarning = 'Изменения сохраняются до закрытия приложения.'; return; }
    try { storage.setItem(storageKey, JSON.stringify(state)); storageWarning = ''; }
    catch { storageWarning = 'Не удалось сохранить изменения на этом устройстве. Они доступны до закрытия приложения.'; }
  }
  function decision(clientId, action, reviewId = null) {
    const item = client(clientId);
    if (!item) throw new Error('Подопечный не найден.');
    item.decisions.unshift({ id: `decision-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, date: trainerDemoDate(), action, reviewId });
  }
  function status(clientId) {
    const reviews = state.reviews.filter(item => item.clientId === clientId && pending(item));
    if (reviews.some(item => item.kind === 'inactive')) return 'inactive';
    if (reviews.some(item => item.kind === 'attention')) return 'attention';
    if (reviews.length) return 'waiting';
    return 'ok';
  }
  function captureAssignment(item, now = Date.now()) {
    ensureWeeklyReviews(now, false);
    const source = program(item.programId);
    if (!source) return;
    const plan = trainerCopy(source);
    plan.weeks.forEach(week => week.sessions.forEach(session => session.exercises.forEach(exercise => {
      if (Object.prototype.hasOwnProperty.call(item.programOverrides || {}, exercise.name)) exercise.weightKg = item.programOverrides[exercise.name];
    })));
    item.planHistory ||= [];
    const effectiveOn = trainerScheduleClock(state.trainer.reviewSchedule, now).date;
    // Изменения внутри дня заменяют назначение этого дня, но не более ранние назначения.
    item.planHistory = item.planHistory.filter(entry => entry.effectiveOn !== effectiveOn);
    item.planHistory.push({ effectiveOn, startWeek: item.currentWeek || 1, program: plan, nutritionTarget: trainerCopy(item.nutritionTarget) });
  }
  function ensureWeeklyReviews(now = Date.now(), save = true) {
    const latest = trainerWeeklyPeriod(state.trainer.reviewSchedule, now);
    let changed = false;
    for (let start = state.firstReviewStart; start <= latest.start; start = trainerShiftDate(start, 7)) {
      const end = trainerShiftDate(start, 6);
      state.clients.filter(item => !item.joinedOn || item.joinedOn <= end).forEach(item => {
        const id = `weekly:${item.id}:${start}:${end}`;
        if (state.weeklyReviews.some(entry => entry.id === id)) return;
        const captured = (item.weekPlans || []).find(entry => entry.start === start);
        state.weeklyReviews.push({ id, clientId: item.id, start, end, reviewDate: trainerShiftDate(start, 7), kind: 'weekly', status: 'new', title: 'Недельный разбор',
          plan: trainerCopy(captured ? captured.plan : trainerPlanAt(item, start)), planMissingReason: 'План на начало этой недели не сохранён, не был назначен либо программа завершена. Текущая программа не подставляется вместо исторической.',
          note: '', timeZone: state.trainer.reviewSchedule.timeZone, createdAt: new Date(now).toISOString() });
        changed = true;
      });
    }
    // Фиксируем план уже в текущей неделе, до будущих изменений конструктора.
    const currentStart = trainerWeeklyPeriod({ ...state.trainer.reviewSchedule, time: '00:00' }, now).reviewDate;
    state.clients.forEach(item => {
      item.weekPlans ||= [];
      if (item.weekPlans.some(entry => entry.start === currentStart)) return;
      item.weekPlans.push({ start: currentStart, plan: trainerPlanAt(item, currentStart) }); changed = true;
    });
    if (changed && save) persist();
    return changed;
  }
  ensureWeeklyReviews(Date.now(), false);
  return {
    get state() { return state; }, get storageWarning() { return storageWarning; },
    client, review, program, pending, status, ensureWeeklyReviews,
    weeklyData(id) { const item = review(id); if (!item || item.kind !== 'weekly') throw new Error('Недельный разбор не найден.'); return trainerWeeklyData(client(item.clientId), item); },
    saveWeeklyNote(id, note, complete = false) {
      const item = review(id);
      if (!item || item.kind !== 'weekly') throw new Error('Недельный разбор не найден.');
      if (!pending(item)) return false;
      if (typeof note !== 'string' || note.length > 2000 || (complete && !note.trim())) throw new Error('Запиши итог и решение на следующую неделю (до 2000 символов).');
      item.note = note.trim();
      if (complete) {
        item.reportSnapshot = trainerWeeklyData(client(item.clientId), item);
        item.status = 'approved'; item.decidedAt = new Date().toISOString();
        decision(item.clientId, `Разбор ${item.start} — ${item.end}: ${item.note}`, item.id);
      }
      persist(); return true;
    },
    saveReviewSchedule(values, now = Date.now()) {
      const day = Number(values.day), time = values.time, timeZone = values.timeZone;
      if (!Number.isInteger(day) || day < 0 || day > 6 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Выбери день и время разбора.');
      try { new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(now)); } catch { throw new Error('Укажи корректный часовой пояс, например Europe/Moscow.'); }
      if (!timeZone) throw new Error('Укажи часовой пояс.');
      ensureWeeklyReviews(now, false);
      const old = state.trainer.reviewSchedule;
      if (day !== old.day || timeZone !== old.timeZone) {
        const next = trainerWeeklyPeriod({ day, time, timeZone }, now);
        // Не создаём задним числом новую очередь после смены дня. Архив не переписывается.
        state.firstReviewStart = trainerShiftDate(next.start, 7);
      }
      state.trainer.reviewSchedule = { day, time, timeZone }; persist();
    },
    load(browserStorage, identity = 'local') {
      const nextKey = `trenzo-trainer-demo-v1:${identity}`;
      if (loadedKey === nextKey) { ensureWeeklyReviews(); return; }
      storage = browserStorage; storageKey = nextKey; loadedKey = nextKey;
      state = trainerCreateDemoData();
      try {
        const saved = JSON.parse(storage?.getItem(storageKey) || 'null');
        if (saved?.version === 1 && saved.trainer && Array.isArray(saved.clients) && Array.isArray(saved.reviews) && Array.isArray(saved.programs) &&
            saved.clients.every(item => item.id && Array.isArray(item.decisions) && Array.isArray(item.weights) && Array.isArray(item.nutrition) && Array.isArray(item.workouts) && item.metrics) &&
            saved.reviews.every(item => item.id && saved.clients.some(c => c.id === item.clientId) && Array.isArray(item.facts) && Array.isArray(item.tags) && Array.isArray(item.context)) &&
            saved.programs.every(item => item.id && Array.isArray(item.weeks) && item.weeks.length && item.weeks.every(week => Array.isArray(week.sessions)))) {
          state = saved;
        }
      } catch { storageWarning = 'Сохранённый пример недоступен. Загружены исходные демо-данные.'; }
      state.trainer.reviewSchedule ||= trainerCopy(trainerDefaultReviewSchedule);
      state.weeklyReviews ||= [];
      state.firstReviewStart ||= trainerWeeklyPeriod(state.trainer.reviewSchedule).start;
      state.clients.forEach(item => {
        delete item.metrics.sleep;
        item.measurementHistory ||= []; item.mediaReports ||= [];
        // Старый прототип не сохранял историю назначений: не выдаём текущий план за прошлый.
        if (!item.planHistory) { item.planHistory = []; captureAssignment(item); }
      });
      state.reviews.forEach(item => {
        const excluded = text => /(^|\s)(сон|сна|вода|воды|воду)(\s|[↓↑.,]|$)/i.test(text);
        item.tags = item.tags.filter(text => !excluded(text));
        item.context = item.context.filter(entry => !excluded(entry.label));
        item.facts = item.facts.filter(text => !excluded(text));
        if (excluded(item.analysis)) item.analysis = 'Нужно проверить записи тренировок и питания.';
        if (excluded(item.hypothesis)) item.hypothesis = 'Причину изменений уточняет тренер.';
      });
      ensureWeeklyReviews();
      if (!storage) storageWarning = 'Изменения сохраняются до закрытия приложения.';
    },
    approveReview(id) {
      const item = review(id);
      if (!item || !client(item.clientId)) throw new Error('Разбор не найден.');
      if (item.kind === 'weekly') throw new Error('Запиши итог недели и заверши недельный разбор.');
      if (!pending(item)) return false;
      item.status = 'approved'; item.decidedAt = new Date().toISOString();
      decision(item.clientId, item.proposedAction, item.id);
      if (item.change) {
        // Индивидуальная нагрузка хранится в назначении клиента, а не меняет
        // общую программу остальных подопечных.
        client(item.clientId).programOverrides[item.change.exercise] = item.change.weightKg;
        captureAssignment(client(item.clientId));
      }
      persist(); return true;
    },
    editReview(id, action) {
      const item = review(id);
      if (!item || !pending(item)) throw new Error('Этот разбор уже завершён.');
      if (!action.trim() || action.length > 2000) throw new Error('Опиши решение тренера (до 2000 символов).');
      item.proposedAction = action.trim(); item.change = null; item.editedByTrainer = true;
      persist();
    },
    clientProgram(id) {
      const item = client(id), source = program(item?.programId);
      if (!source) return null;
      const result = trainerCopy(source);
      result.weeks.forEach(week => week.sessions.forEach(session => session.exercises.forEach(exercise => {
        if (Object.prototype.hasOwnProperty.call(item.programOverrides, exercise.name)) exercise.weightKg = item.programOverrides[exercise.name];
      })));
      return result;
    },
    saveProgram(draft) {
      if (!draft.title?.trim() || draft.title.length > 100 || !Array.isArray(draft.weeks) || !draft.weeks.length || draft.weeks.length > 12) throw new Error('Укажи название и от 1 до 12 недель программы.');
      draft.weeks.forEach(week => {
        if (!week.sessions.length || week.sessions.length > 6) throw new Error('В неделе должно быть от 1 до 6 тренировок.');
        week.sessions.forEach(session => {
          if (!session.title.trim() || !session.exercises.length) throw new Error('Добавь название дня и хотя бы одно упражнение.');
          session.exercises.forEach(e => {
            if (!e.name.trim() || !e.reps.trim() || !Number.isInteger(e.sets) || e.sets < 1 || e.sets > 20 ||
                !Number.isFinite(e.weightKg) || e.weightKg < 0 || e.weightKg > 1000 ||
                !Number.isFinite(e.effort) || e.effort < 0 || e.effort > 10 ||
                !Number.isInteger(e.restSeconds) || e.restSeconds < 0 || e.restSeconds > 900) throw new Error('Проверь название, подходы, повторы, вес, RPE/RIR и отдых каждого упражнения.');
          });
        });
      });
      const result = trainerCopy(draft); result.title = result.title.trim(); result.source = 'mine';
      if (!result.id || program(result.id)?.source === 'template') result.id = `program-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const index = state.programs.findIndex(item => item.id === result.id);
      if (index === -1) state.programs.unshift(result); else state.programs[index] = result;
      state.clients.filter(item => item.programId === result.id).forEach(item => captureAssignment(item));
      persist(); return result;
    },
    assignProgram(programId, clientId) {
      const item = client(clientId), plan = program(programId);
      if (!item || !plan) throw new Error('Выбери программу и подопечного.');
      item.programId = plan.id; item.currentWeek = 1; item.totalWeeks = plan.weeks.length;
      // Новое назначение не переписывает статистику уже прошедших семи дней.
      item.programOverrides = {}; item.programCompleted = 0;
      captureAssignment(item);
      decision(clientId, `Назначена программа «${plan.title}» на ${plan.weeks.length} недель.`);
      persist();
    },
    addClient(values) {
      if (!values.name?.trim() || !values.goal?.trim()) throw new Error('Укажи имя и цель подопечного.');
      const [name, ...surname] = values.name.trim().split(/\s+/);
      const id = `client-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const item = { id, name, surname: surname.join(' '), goal: values.goal.trim(), targetWeight: null, currentWeek: 0, totalWeeks: 0, activityDate: null,
        joinedOn: trainerScheduleClock(state.trainer.reviewSchedule).date,
        metrics: { workoutCompleted: 0, workoutTarget: 0, weightDelta: null, nutritionPercent: null, rpe: null },
        programId: null, programCompleted: 0, programOverrides: {}, equipment: 'Не указано', restrictions: 'Не указаны', preferences: 'Не указаны',
        weights: [], nutrition: [], nutritionTarget: null, workouts: [], measurements: {}, measurementHistory: [], mediaReports: [], planHistory: [], records: [], decisions: [] };
      state.clients.push(item); persist(); return item;
    },
    saveProfile(values) {
      if (!values.name?.trim()) throw new Error('Укажи имя тренера.');
      state.trainer = { ...state.trainer, ...values, name: values.name.trim() }; persist();
    },
    reset(mode = 'demo') {
      state = trainerCreateDemoData();
      if (mode === 'empty') { state.clients = []; state.reviews = []; }
      ensureWeeklyReviews(Date.now(), false);
      if (mode === 'calm') state.reviews.filter(pending).forEach(item => this.approveReview(item.id));
      if (mode === 'calm') state.weeklyReviews.filter(pending).forEach(item => this.saveWeeklyNote(item.id, 'Неделя просмотрена. Сохранить действующий план.', true));
      persist();
    }
  };
}

const trainerStore = createTrainerStore();
