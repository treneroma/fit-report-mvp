/* Цикл отчёта. Доменная логика не отправляет HTTP-запросы и не зависит от DOM.
   Адаптер предоставляет клиентов, периоды, сохранение и атомарное закрытие. */
function createTrenzoReportService(adapter) {
  const copy = value => JSON.parse(JSON.stringify(value));
  const average = values => {
    const numbers = values.filter(Number.isFinite);
    return numbers.length ? Math.round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length * 10) / 10 : null;
  };
  const mean = (rows, key) => average(rows.map(row => row[key]));
  const labels = { progress: 'Прогресс', stable: 'Стабильно', plateau: 'Застой', off_plan: 'Сбился', overload: 'Перегруз', low_data: 'Мало данных' };
  const status = cycle => cycle.resolution ? 'reviewed' : cycle.submission ? 'submitted' : 'expected';
  const clients = () => adapter.clients();
  const cycles = () => adapter.cycles();
  const get = id => cycles().find(cycle => cycle.id === id);
  function period(now = Date.now()) {
    const schedule = adapter.schedule();
    const current = trainerWeeklyPeriod({ ...schedule, time: '00:00' }, now);
    return { start: current.start, end: current.end, dueOn: current.reviewDate, dueTime: schedule.time, timeZone: schedule.timeZone };
  }
  function ensure(now = Date.now()) {
    const current = period(now);
    clients().forEach(client => {
      const item = client.joinedOn && client.joinedOn > current.end
        ? { ...current, start: trainerShiftDate(current.start, 7), end: trainerShiftDate(current.end, 7), dueOn: trainerShiftDate(current.dueOn, 7) }
        : current;
      const latest = cycles().filter(cycle => cycle.clientId === client.id).sort((a, b) => b.start.localeCompare(a.start))[0];
      const distance = latest ? trainerDayDistance(latest.start, item.start) : 0;
      const first = distance > 7 && distance % 7 === 0 ? trainerShiftDate(latest.start, 7) : item.start;
      for (let start = first; start <= item.start; start = trainerShiftDate(start, 7)) {
        const end = trainerShiftDate(start, 6), dueOn = trainerShiftDate(end, 1);
        if (client.joinedOn && client.joinedOn > end) continue;
        const id = `period-report:${client.id}:${start}:${end}`;
        if (!get(id)) adapter.save({ id, kind: 'period-report', clientId: client.id, ...item, start, end, dueOn, version: 1, createdAt: new Date(now).toISOString() });
      }
    });
  }
  function overdue(cycle, now = Date.now()) {
    if (status(cycle) !== 'expected') return false;
    const clock = trainerScheduleClock({ timeZone: cycle.timeZone }, now);
    return clock.date > cycle.dueOn || (clock.date === cycle.dueOn && clock.time > cycle.dueTime);
  }
  function snapshot(cycle) {
    const client = adapter.client(cycle.clientId);
    if (!client) throw new Error('Клиент не найден.');
    const plan = adapter.plan(client.id, cycle.start);
    const collect = (start, end, periodPlan) => {
      const raw = trainerWeeklyData(client, { start, end, plan: periodPlan });
      const before = (client.weights || []).filter(row => row.measured_on < start).sort((a, b) => a.measured_on.localeCompare(b.measured_on)).pop();
      const currentWeight = raw.latestWeight?.measured_on >= start ? raw.latestWeight : null;
      const sessions = periodPlan?.sessions || [];
      const done = sessions.filter(session => raw.workouts.some(workout => session.id && workout.sessionId ? workout.sessionId === session.id : session.title === workout.title)).length;
      const target = periodPlan?.nutritionTarget;
      const nutritionScores = raw.nutrition.map(row => {
        if (!Number.isFinite(target?.calories) || target.calories <= 0 || !Number.isFinite(row.calories)) return null;
        return Math.max(0, 100 - Math.abs(row.calories - target.calories) / target.calories * 100);
      });
      const activity = (client.activityEntries || []).filter(row => row.date >= start && row.date <= end);
      return { raw, training: { completed: done, planned: sessions.length || null, recorded: raw.workouts.length },
        nutrition: { adherence: average(nutritionScores), days: raw.nutrition.length, tracked: !!target, target: copy(target || null) },
        weight: { before: before || null, current: currentWeight, delta: currentWeight && before ? Math.round((currentWeight.weight_kg - before.weight_kg) * 10) / 10 : null },
        rpe: mean(raw.workouts, 'rpe'), sleepMinutes: mean(activity, 'sleep_minutes'), steps: mean(activity, 'steps'), activityDays: activity.length };
    };
    const previousStart = trainerShiftDate(cycle.start, -7), previousEnd = trainerShiftDate(cycle.start, -1);
    const previousPlan = adapter.plan(client.id, previousStart);
    const previousDecision = cycles().filter(item => item.clientId === client.id && item.end < cycle.start && item.resolution).sort((a, b) => b.end.localeCompare(a.end))[0];
    return copy({ period: { start: cycle.start, end: cycle.end }, capturedAt: new Date(Date.now()).toISOString(),
      client: { id: client.id, name: client.name, surname: client.surname, goal: client.goal, targetWeight: client.targetWeight, questionnaire: client.questionnaire || client.athleteAnswers || client.profileAnswers || {} },
      plan, current: collect(cycle.start, cycle.end, plan), previous: collect(previousStart, previousEnd, previousPlan),
      previousDecision: previousDecision ? { id: previousDecision.id, period: { start: previousDecision.start, end: previousDecision.end }, resolution: previousDecision.resolution } : null,
      decisions: (client.decisions || []).filter(item => item.date <= cycle.end).slice(0, 5) });
  }
  function facts(id) {
    const cycle = get(id);
    if (!cycle) throw new Error('Отчёт не найден.');
    return copy(cycle.submission?.snapshot || snapshot(cycle));
  }
  function questions(id, answers = {}) {
    const data = facts(id), result = [
      { key: 'wellbeing', label: 'Как прошла неделя в целом?', type: 'scale', options: [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']], required: true },
      { key: 'energy', label: 'Энергия', options: [['low', 'Низкая'], ['normal', 'Нормальная'], ['high', 'Высокая']], required: true },
      { key: 'recovery', label: 'Восстановление', options: [['poor', 'Плохое'], ['normal', 'Нормальное'], ['good', 'Хорошее']], required: true }
    ];
    if (data.current.nutrition.tracked) result.push({ key: 'appetite', label: 'Голод / аппетит', options: [['comfortable', 'Комфортно'], ['hungry', 'Сильный голод'], ['low', 'Аппетит снижен']], required: true });
    result.push({ key: 'pain', label: 'Были боли или дискомфорт?', options: [['no', 'Нет'], ['yes', 'Да']], required: true });
    result.push({ key: 'soreness', label: 'Была крепатура после тренировок?', options: [['no', 'Нет'], ['yes', 'Да']] });
    if (answers.pain === 'yes') result.push({ key: 'painDetails', label: 'Где и когда возникал дискомфорт?', type: 'text', required: true });
    if (answers.energy === 'low' || answers.recovery === 'poor') result.push({ key: 'recoveryDetails', label: 'Что мешало восстановиться?', type: 'text' });
    if (data.current.training.planned && data.current.training.completed < data.current.training.planned) result.push({ key: 'trainingDifficulty', label: 'В плане остались тренировки без результата. Что помешало?', type: 'text' });
    if (data.previousDecision?.resolution.nextPlan.priority) result.push({ key: 'followUp', label: `Как удалось выполнить прошлый приоритет: «${data.previousDecision.resolution.nextPlan.priority}»?`, type: 'text' });
    result.push({ key: 'difficulty', label: 'Что было самым сложным на этой неделе?', type: 'text' }, { key: 'comment', label: 'Что ещё важно сказать тренеру?', type: 'text' });
    return result;
  }
  function submit(id, input, now = Date.now()) {
    const cycle = get(id);
    if (!cycle) throw new Error('Отчёт не найден.');
    if (cycle.submission) return copy(cycle);
    const today = trainerScheduleClock({ timeZone: cycle.timeZone }, now).date;
    if (cycle.end >= today) throw new Error('Период ещё не завершён. Можно сохранить черновик и вернуться позже.');
    const answers = {};
    questions(id, input).forEach(question => {
      const value = input[question.key];
      if (question.options) {
        if (!question.required && (value == null || value === '')) return;
        const normalized = question.type === 'scale' ? Number(value) : value;
        if (!question.options.some(([option]) => option === normalized)) throw new Error(`Ответьте на вопрос «${question.label}».`);
        answers[question.key] = normalized;
      } else {
        const text = typeof value === 'string' ? value.trim() : '';
        if (question.required && !text) throw new Error(`Заполните поле «${question.label}».`);
        if (text.length > 2000) throw new Error('В одном ответе допускается до 2000 символов.');
        if (text) answers[question.key] = text;
      }
    });
    cycle.submission = { submittedAt: new Date(now).toISOString(), answers, snapshot: snapshot(cycle) };
    cycle.submission.analysis = analyzeSnapshot(cycle, cycle.submission.snapshot);
    delete cycle.clientDraft;
    adapter.save(cycle);
    return copy(cycle);
  }
  function analyze(id) {
    const cycle = get(id);
    return copy(cycle.submission?.analysis || analyzeSnapshot(cycle, facts(id)));
  }
  function analyzeSnapshot(cycle, data) {
    const answers = cycle.submission?.answers || {};
    const current = data.current, previous = data.previous;
    const rpeUp = current.rpe != null && previous.rpe != null && current.rpe - previous.rpe >= 0.8;
    const sleepDown = current.sleepMinutes != null && previous.sleepMinutes != null && current.sleepMinutes < previous.sleepMinutes - 30;
    const hardRecovery = answers.recovery === 'poor' || answers.energy === 'low';
    let state = 'stable';
    if (!current.training.recorded && !current.nutrition.days && current.weight.delta == null) state = 'low_data';
    else if (rpeUp && (sleepDown || hardRecovery)) state = 'overload';
    else if (current.training.planned && current.training.completed < current.training.planned) state = 'off_plan';
    else if (current.weight.delta != null && /снижен|похуд/.test(String(data.client.goal || '').toLocaleLowerCase('ru-RU'))) state = current.weight.delta < -0.1 ? 'progress' : Math.abs(current.weight.delta) <= 0.1 ? 'plateau' : 'stable';
    const observations = [];
    if (current.rpe != null && previous.rpe != null) observations.push(`Средний RPE: ${previous.rpe} → ${current.rpe}. Это субъективная тяжесть записанных тренировок.`);
    if (current.sleepMinutes != null && previous.sleepMinutes != null) observations.push(`Средний сон изменился на ${Math.round(current.sleepMinutes - previous.sleepMinutes)} мин относительно прошлого периода.`);
    if (current.weight.delta != null) observations.push(`Изменение веса: ${current.weight.delta > 0 ? '+' : ''}${current.weight.delta} кг. Цель клиента: ${data.client.goal}${data.client.targetWeight != null ? `, ${data.client.targetWeight} кг` : ''}.`);
    observations.push(current.training.planned ? `Внесены результаты ${current.training.completed} из ${current.training.planned} тренировок плана.` : `Записано тренировок: ${current.training.recorded}. План на начало периода недоступен.`);
    if (data.previousDecision) observations.push(`На прошлом отчёте тренер решил: ${data.previousDecision.resolution.decision}`);
    if (!observations.length) observations.push('Недостаточно записей для сравнения периодов.');
    const recommendations = [
      { id: 'training', title: 'Тренировки', text: rpeUp || hardRecovery ? 'Сохранить рабочие веса без прогрессии и повторно оценить восстановление.' : 'Сохранить текущую структуру тренировок и оценить динамику в следующем периоде.', reason: rpeUp ? 'Субъективная тяжесть тренировок выросла.' : hardRecovery ? 'Клиент сообщил о сложностях с восстановлением.' : 'По имеющимся данным нет основания автоматически менять структуру плана.', action: { type: 'hold' } },
      { id: 'nutrition', title: 'Питание', text: current.nutrition.tracked ? 'Оставить текущие плановые значения питания.' : 'Уточнить питание при следующем контакте, без автоматического назначения новых целей.', reason: current.nutrition.days ? `Дневник заполнен за ${current.nutrition.days} из 7 дней.` : 'Записей питания недостаточно для корректировки.', action: { type: 'hold' } }
    ];
    if (answers.pain === 'yes') recommendations.unshift({ id: 'discomfort', title: 'Уточнить дискомфорт', text: 'Уточнить у клиента характер дискомфорта до решения о повышении нагрузки.', reason: 'Клиент сообщил о боли или дискомфорте. Причину нельзя установить по отчёту.', action: { type: 'hold' } });
    const improving = data.current.raw.comparisons.find(item => item.direction === 'up' && item.current.sets.every(set => Number.isFinite(set.weight_kg) && set.weight_kg > 0));
    if (improving && current.rpe != null && current.rpe <= 8 && !hardRecovery && answers.pain !== 'yes') {
      const weight = improving.current.sets[0].weight_kg;
      const session = data.plan?.sessions.find(item => item.exercises.some(exercise => exercise.name === improving.name && exercise.weightKg === weight));
      if (session) recommendations.push({ id: 'progression', title: improving.name, text: `Рассмотреть прогрессию ${weight} → ${weight + 2.5} кг после проверки техники тренером.`, reason: 'Сопоставимые записи упражнения улучшились без высокого среднего RPE.', action: { type: 'weight', sessionId: session.id, exercise: improving.name, from: weight, to: weight + 2.5 } });
    }
    return { engine: 'demo-rules-v1', state, label: labels[state], priority: answers.pain === 'yes' ? 100 : state === 'overload' ? 90 : state === 'off_plan' ? 75 : state === 'low_data' ? 50 : 20, observations, recommendations,
      priorityText: answers.pain === 'yes' ? 'Уточнить дискомфорт' : rpeUp || hardRecovery ? 'Восстановление и субъективная тяжесть тренировок' : 'Последовательно выполнять текущий план' };
  }
  function createTrainerDraft(id, mode = 'accept', previous = null) {
    const cycle = get(id);
    if (!cycle?.submission) throw new Error('Сначала нужен отчёт клиента.');
    const data = facts(id), analysis = analyze(id);
    const draft = { mode, choices: analysis.recommendations.map(item => ({ id: item.id, accepted: mode !== 'keep', text: item.text, action: copy(item.action) })),
      nextPlan: { training: `${data.current.training.planned || 'Текущее число'} занятий, структура текущей программы`, nutrition: data.current.nutrition.tracked ? 'Текущие плановые значения без изменений' : 'Без новых назначений', priority: mode === 'keep' ? 'Продолжить текущий план' : analysis.priorityText }, feedback: '' };
    if (previous && mode !== 'keep') draft.nextPlan = { ...draft.nextPlan, ...previous.nextPlan };
    if (previous && mode === 'edit') draft.choices = copy(previous.choices);
    draft.feedback = feedback(id, draft);
    return draft;
  }
  function feedback(id, draft) {
    const data = facts(id), accepted = draft.choices.filter(item => item.accepted);
    return `${data.client.name}, спасибо за отчёт. ${data.current.training.planned ? `Записаны ${data.current.training.completed} из ${data.current.training.planned} тренировок.` : 'Данные недели просмотрены.'} ${data.current.weight.delta != null ? `Изменение веса: ${data.current.weight.delta > 0 ? '+' : ''}${data.current.weight.delta} кг. ` : ''}${accepted.length ? accepted.map(item => item.text).join(' ') : 'На следующий период сохраняем текущий план без изменений.'} Приоритет: ${draft.nextPlan.priority}.`;
  }
  function saveDraft(id, draft) {
    const cycle = get(id);
    if (!cycle || cycle.resolution) throw new Error('Отчёт уже закрыт или не найден.');
    cycle.trainerDraft = copy(draft); adapter.save(cycle);
  }
  function nextEffectiveOn(cycle, now = Date.now()) {
    const today = trainerScheduleClock({ timeZone: cycle.timeZone }, now).date;
    const nextStart = trainerShiftDate(cycle.end, 1);
    const currentStart = trainerWeeklyPeriod({ ...adapter.schedule(), time: '00:00' }, now).reviewDate;
    return nextStart < today ? trainerShiftDate(currentStart, 7) : nextStart;
  }
  function proposal(id, keep = false) {
    const cycle = get(id), data = facts(id), answers = cycle.submission?.answers || {};
    const base = adapter.plan(cycle.clientId, nextEffectiveOn(cycle)) || data.plan;
    if (!base) return null;
    const plan = copy(base);
    const difficult = answers.pain === 'yes' || answers.recovery === 'poor' || answers.energy === 'low' || answers.soreness === 'yes' || (data.current.rpe != null && data.current.rpe >= 8);
    const logExercise = (raw, session, name) => raw.workouts.filter(item => item.sessionId ? item.sessionId === session.id : base.sessions.filter(day => day.title === session.title).length === 1 && item.title === session.title).flatMap(item => item.exercises.filter(exercise => exercise.name === name)).pop();
    plan.sessions.forEach(session => session.exercises.forEach(exercise => {
      const current = logExercise(data.current.raw, session, exercise.name), before = logExercise(data.previous.raw, session, exercise.name);
      const direction = current && before ? trainerWorkoutComparison(current, before) : 'unknown';
      const comparableWeight = current?.sets?.length && current.sets.every(set => set.weight_kg === exercise.weightKg && Number.isFinite(set.reps));
      exercise.reason = keep ? 'Тренер сохраняет параметры текущего плана.'
        : answers.pain === 'yes' ? 'Клиент сообщил о дискомфорте. Нагрузку не повышаем до уточнения состояния.'
        : difficult ? 'Тренировки ощущались тяжело или восстановление было неполным. Сохраняем нагрузку без прогрессии.'
        : !current ? 'Результат упражнения за период не внесён. Недостаточно данных для повышения нагрузки.'
        : direction === 'up' && comparableWeight && exercise.weightKg > 0 && data.current.rpe != null && data.current.rpe <= 8
          ? 'В сопоставимых подходах выросли вес или повторения, средняя тяжесть не выше 8 из 10. Предлагаем небольшой шаг веса после проверки техники.'
        : direction === 'down' || direction === 'mixed' ? 'Результат снизился или изменился неоднозначно. Повторяем параметры и проверяем динамику.'
        : direction === 'stable' ? 'В сопоставимых подходах результат не изменился. Повторяем нагрузку для закрепления.'
        : 'Нет сопоставимой записи за прошлый период. Оставляем параметры до следующего сравнения.';
      if (!keep && !difficult && current && before && ['up', 'down', 'mixed', 'stable'].includes(direction)) {
        const sets = entry => entry.sets.map(set => set.duration_seconds ? `${set.duration_seconds} сек` : `${set.weight_kg} кг × ${set.reps}`).join(' / ');
        const conclusion = direction === 'up' && comparableWeight && exercise.weightKg > 0 && data.current.rpe != null && data.current.rpe <= 8 ? 'Предлагаем +2,5 кг после проверки техники: нагрузка выросла без высокой субъективной тяжести.' : direction === 'stable' ? 'Результат стабилен, сохраняем параметры для закрепления.' : 'Повторяем параметры: для повышения нагрузки пока нет устойчивой положительной динамики.';
        exercise.reason = `Последняя запись: ${sets(current)}; ранее: ${sets(before)}. ${conclusion}`;
      }
      if (!keep && !difficult && direction === 'up' && comparableWeight && exercise.weightKg > 0 && data.current.rpe != null && data.current.rpe <= 8) exercise.weightKg += 2.5;
    }));
    const target = plan.nutritionTarget, current = data.current, previous = data.previous;
    const slower = current.weight.delta < 0 && previous.weight.delta < 0 && current.weight.delta - previous.weight.delta >= 0.2;
    const canAdjust = !keep && !difficult && /снижен|похуд/i.test(data.client.goal || '') && slower && current.nutrition.days >= 6 && current.nutrition.adherence >= 90 && Number.isFinite(target?.carbs_g) && target.carbs_g >= 40 && Number.isFinite(target.calories) && target.calories > 80;
    plan.nutritionReason = canAdjust ? `Темп снижения веса замедлился: ${previous.weight.delta} → ${current.weight.delta} кг при заполненном дневнике и соблюдении не ниже 90%. Предложение для проверки тренером: −20 г углеводов, −80 ккал в день.`
      : keep ? 'Тренер оставляет текущие плановые значения питания.'
      : !target ? 'План питания не назначен. Новые значения без решения тренера не придумываем.'
      : difficult ? 'Есть сложности с восстановлением. Не предлагаем дополнительно снижать питание по одному отчёту.'
      : current.nutrition.days < 6 ? 'Дневник заполнен не полностью. Для корректировки не хватает данных, текущие значения сохраняем.'
      : 'По имеющейся динамике нет достаточного основания менять КБЖУ. Сохраняем текущие значения и наблюдаем следующий период.';
    if (canAdjust) { target.carbs_g -= 20; target.calories -= 80; }
    return plan;
  }
  function close(id, input, now = Date.now()) {
    const cycle = get(id);
    if (!cycle?.submission) throw new Error('Отчёт клиента ещё не отправлен.');
    if (cycle.resolution) return copy(cycle);
    if (!input || !['accept', 'edit', 'keep'].includes(input.mode)) throw new Error('Примите решение по рекомендациям.');
    if (!Array.isArray(input.choices)) throw new Error('Проверьте рекомендации тренера.');
    const optionalComment = Object.prototype.hasOwnProperty.call(input, 'weeklyPlan') && input.responseGenerated === true;
    if (typeof input.feedback !== 'string' || (!optionalComment && !input.feedback.trim()) || input.feedback.length > 4000) throw new Error('Проверьте ответ клиенту: до 4000 символов.');
    const analysis = analyze(id), changes = [], choices = [];
    for (const proposed of analysis.recommendations) {
      const choice = input.choices.find(item => item.id === proposed.id);
      const accepted = input.mode !== 'keep' && choice?.accepted === true;
      const text = String(choice?.text || proposed.text).trim();
      if (!text || text.length > 2000) throw new Error('Проверьте текст рекомендаций.');
      choices.push({ id: proposed.id, accepted, text });
      if (!Object.prototype.hasOwnProperty.call(input, 'weeklyPlan') && accepted && proposed.action.type === 'weight') {
        if (choice.action?.to == null || choice.action.to === '') throw new Error('Проверьте рабочий вес в рекомендации.');
        const to = Number(choice.action.to);
        if (!Number.isFinite(to) || to < 0 || to > 1000) throw new Error('Проверьте рабочий вес в рекомендации.');
        changes.push({ ...proposed.action, to });
      }
    }
    const nextPlan = {};
    for (const field of ['training', 'nutrition', 'priority']) {
      const text = typeof input.nextPlan?.[field] === 'string' ? input.nextPlan[field].trim() : '';
      if (!text || text.length > 2000) throw new Error('Заполните план следующего периода.');
      nextPlan[field] = text;
    }
    nextPlan.effectiveOn = nextEffectiveOn(cycle, now);
    nextPlan.plan = copy(adapter.plan(cycle.clientId, nextPlan.effectiveOn) || facts(id).plan);
    if (Object.prototype.hasOwnProperty.call(input, 'weeklyPlan')) {
      const base = nextPlan.plan, edited = input.weeklyPlan;
      if (!!base !== !!edited || (base && (!Array.isArray(edited.sessions) || edited.sessions.length !== base.sessions.length))) throw new Error('Состав программы изменился. Откройте отчёт заново.');
      if (base) {
        base.sessions.forEach((session, day) => {
          const draftSession = edited.sessions[day];
          if (draftSession?.id !== session.id || draftSession.exercises?.length !== session.exercises.length) throw new Error('Состав тренировки изменился. Проверьте программу.');
          session.exercises.forEach((exercise, index) => {
            const draft = draftSession.exercises[index];
            if (draft.name !== exercise.name || !Number.isInteger(draft.sets) || draft.sets < 1 || draft.sets > 20 || typeof draft.reps !== 'string' || !draft.reps.trim() || draft.reps.length > 40 || !Number.isFinite(draft.weightKg) || draft.weightKg < 0 || draft.weightKg > 1000) throw new Error('Проверьте подходы, повторения и вес каждого упражнения.');
            const changed = ['sets', 'reps', 'weightKg'].some(key => draft[key] !== exercise[key]);
            if (input.mode === 'keep' && changed) throw new Error('Для изменения нагрузки выберите «Изменить».');
            if (draft.weightKg !== exercise.weightKg) changes.push({ type: 'weight', sessionId: session.id, exercise: exercise.name, from: exercise.weightKg, to: draft.weightKg });
            if (draft.sets !== exercise.sets || draft.reps !== exercise.reps) changes.push({ type: 'prescription', sessionId: session.id, exercise: exercise.name, from: `${exercise.sets} × ${exercise.reps}`, to: `${draft.sets} × ${draft.reps}` });
            Object.assign(exercise, { sets: draft.sets, reps: draft.reps.trim(), weightKg: draft.weightKg, reason: String(draft.reason || '').slice(0, 1000) });
          });
        });
        if (!!base.nutritionTarget !== !!edited.nutritionTarget) throw new Error('План питания изменился. Проверьте назначения.');
        if (base.nutritionTarget) {
          for (const key of ['calories', 'protein_g', 'fat_g', 'carbs_g']) {
            const value = edited.nutritionTarget[key], limit = key === 'calories' ? 10000 : 1500;
            if (!Number.isFinite(value) || value < 0 || value > limit || (key === 'calories' && value === 0)) throw new Error('Проверьте КБЖУ следующей недели.');
            if (input.mode === 'keep' && value !== base.nutritionTarget[key]) throw new Error('Для изменения питания выберите «Изменить».');
          }
          if (JSON.stringify(base.nutritionTarget) !== JSON.stringify(edited.nutritionTarget)) changes.push({ type: 'nutrition', from: copy(base.nutritionTarget), to: copy(edited.nutritionTarget) });
          base.nutritionTarget = copy(edited.nutritionTarget);
        }
        base.nutritionReason = String(edited.nutritionReason || '').slice(0, 1000);
      }
    }
    if (nextPlan.plan && !Object.prototype.hasOwnProperty.call(input, 'weeklyPlan')) changes.forEach(change => {
      const session = nextPlan.plan.sessions.find(item => item.id === change.sessionId);
      const exercise = session?.exercises.find(item => item.name === change.exercise && item.weightKg === change.from);
      if (!exercise) throw new Error('Упражнение изменилось. Проверьте план до отправки.');
      exercise.weightKg = change.to;
    });
    cycle.resolution = { decidedAt: new Date(now).toISOString(), mode: input.mode, choices, changes, decision: input.mode === 'keep' ? 'Сохранить текущий план без изменений.' : choices.filter(item => item.accepted).map(item => item.text).join(' ') || 'Сохранить текущий план без изменений.', nextPlan, feedback: input.feedback.trim() };
    if (Object.prototype.hasOwnProperty.call(input, 'weeklyPlan')) {
      const summary = changes.map(change => change.type === 'nutrition' ? `Питание: ${change.from.calories} → ${change.to.calories} ккал, углеводы ${change.from.carbs_g} → ${change.to.carbs_g} г.` : `${change.exercise}: ${change.from} → ${change.to}${change.type === 'weight' ? ' кг' : ''}.`).join(' ');
      cycle.resolution.decision = input.mode === 'keep' ? 'Сохранить текущие тренировки и питание.' : `Согласован тренировочный цикл: ${nextPlan.plan?.sessions.length || 0} тренировок и план питания. ${summary || 'Параметры без изменений.'}`;
      cycle.resolution.choices = [
        { id: 'weekly-training', accepted: true, text: `${nextPlan.plan?.sessions.length || 0} тренировок на неделю`, sessions: copy(nextPlan.plan?.sessions || []) },
        { id: 'weekly-nutrition', accepted: true, text: nextPlan.nutrition, target: copy(nextPlan.plan?.nutritionTarget || null), reason: nextPlan.plan?.nutritionReason || '' }
      ];
      cycle.resolution.delivery = { sessions: copy(nextPlan.plan?.sessions || []), nutrition: copy(nextPlan.plan?.nutritionTarget || null), clientComment: cycle.submission.answers.comment || cycle.submission.answers.difficulty || '', trainerComment: input.feedback.trim() };
    }
    delete cycle.trainerDraft;
    adapter.complete(cycle);
    return copy(cycle);
  }
  return { ensure, period, status, overdue, get, facts, questions, submit, analyze, createTrainerDraft, saveDraft, close, feedback, proposal,
    list: () => copy(cycles()), pending: () => cycles().filter(item => status(item) === 'submitted').length,
    saveClientDraft(id, answers) { const cycle = get(id); if (!cycle || cycle.submission) return; cycle.clientDraft = copy(answers); adapter.save(cycle); } };
}

function createTrainerDemoReportAdapter(store) {
  return {
    clients: () => store.state.clients,
    client: id => store.client(id),
    schedule: () => store.state.trainer.reviewSchedule,
    cycles: () => store.listReportCycles(),
    plan: (id, start) => {
      const client = store.client(id);
      const captured = (client.weekPlans || []).find(item => item.start === start);
      return captured ? trainerCopy(captured.plan) : trainerPlanAt(client, start);
    },
    save: cycle => store.saveReportCycle(cycle),
    complete: cycle => store.completeReportCycle(cycle)
  };
}
