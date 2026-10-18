/* Изолированный пример аналитики: не читает и не меняет дневники, отчёты или Supabase.
   Будущий адаптер передаёт такие же недельные записи в trainerAnalyticsSummary(). */
const trainerAnalyticsDemoClients = ['alexander', 'maria', 'maxim', 'anna', 'ilya', 'ekaterina', 'andrey'];
const trainerAnalyticsPeriods = [
  { key: '7d', label: '7 дней', days: 7, chart: 'days', comparison: 'к прошлым 7 дням' },
  { key: '4w', label: '4 недели', days: 28, chart: 'weeks', comparison: 'к прошлым 4 неделям' },
  { key: '3m', label: '3 месяца', months: 3, chart: 'months', comparison: 'к прошлым 3 месяцам' },
  { key: '6m', label: '6 месяцев', months: 6, chart: 'months', comparison: 'к прошлым 6 месяцам' },
  { key: '1y', label: 'Год', months: 12, chart: 'months', comparison: 'к прошлому году' }
];

function trainerAnalyticsShiftMonths(date, months) {
  const value = new Date(`${date}T12:00:00Z`), day = value.getUTCDate();
  value.setUTCDate(1);
  value.setUTCMonth(value.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate();
  value.setUTCDate(Math.min(day, lastDay));
  return value.toISOString().slice(0, 10);
}

function trainerAnalyticsPeriod(now = Date.now(), key = '4w') {
  const option = trainerAnalyticsPeriods.find(period => period.key === key) || trainerAnalyticsPeriods[1];
  const last = trainerWeeklyPeriod({ ...trainerDefaultReviewSchedule, time: '00:00' }, now);
  const boundary = trainerShiftDate(last.end, 1);
  const start = option.months ? trainerAnalyticsShiftMonths(boundary, -option.months) : trainerShiftDate(boundary, -option.days);
  const previousStart = option.months ? trainerAnalyticsShiftMonths(start, -option.months) : trainerShiftDate(start, -option.days);
  return { ...option, start, end: last.end, previousStart, previousEnd: trainerShiftDate(start, -1) };
}

// Невнесённый подход не равен выполненному. Вес не обязателен для учёта повторений.
function trainerAnalyticsValidSet(set) {
  return Number.isFinite(set.duration_seconds) && set.duration_seconds > 0 ||
    Number.isFinite(set.reps) && set.reps > 0;
}

function trainerAnalyticsSetResult(set, target) {
  if (!trainerAnalyticsValidSet(set)) return null;
  if (!target || !Number.isFinite(target.min) || !Number.isFinite(target.max) || target.min > target.max ||
      !['reps', 'seconds'].includes(target.unit)) return 'uncompared';
  const value = target.unit === 'seconds' ? set.duration_seconds : set.reps;
  if (!Number.isFinite(value) || value <= 0) return 'uncompared';
  return value < target.min ? 'below' : value > target.max ? 'above' : 'target';
}

function trainerAnalyticsSetVolume(set) {
  return Number.isFinite(set.weight_kg) && set.weight_kg > 0 && Number.isFinite(set.reps) && set.reps > 0 &&
    !set.duration_seconds ? set.weight_kg * set.reps : 0;
}

function createTrainerAnalyticsDemo(now = Date.now(), key = '4w') {
  const period = trainerAnalyticsPeriod(now, key);
  const lastWeekStart = trainerShiftDate(period.end, -6);
  const weekCount = Math.max(8, Math.ceil((trainerDayDistance(period.previousStart, period.end) + 1) / 7));
  const frequencies = [3, 3, 3, 3, 4, 3, 4];
  const completion = [
    [2, 2, 1, 3, 3, 2, 3], [3, 2, 2, 3, 3, 2, 4],
    [2, 3, 2, 3, 4, 2, 3], [3, 3, 2, 3, 3, 2, 4],
    [3, 2, 2, 3, 4, 2, 4], [3, 3, 2, 3, 4, 2, 4],
    [3, 3, 3, 3, 4, 2, 4], [2, 3, 2, 3, 4, 3, 4]
  ];
  const weeks = Array.from({ length: weekCount }, (_, index) => {
    const weekIndex = index - weekCount + 8, phase = (weekIndex % 8 + 8) % 8;
    const start = trainerShiftDate(lastWeekStart, (index - weekCount + 1) * 7), end = trainerShiftDate(start, 6);
    const clients = trainerAnalyticsDemoClients.map((clientId, clientIndex) => {
      const plannedSessionIds = Array.from({ length: frequencies[clientIndex] }, (_, day) => `${clientId}:${start}:${day}`);
      const plannedSessions = plannedSessionIds.map((id, day) => ({ id, date: trainerShiftDate(start, day * 2) }));
      const workouts = plannedSessionIds.slice(0, completion[phase][clientIndex]).map((sessionId, day) => {
        const id = `analytics:${sessionId}`, seed = clientIndex * 7 + phase * 3 + day;
        const exercises = [
          { id: 'squat', target: { unit: 'reps', min: 8, max: 10 }, weight: Math.max(10, 40 + clientIndex * 5 + Math.floor(weekIndex / 2) * 2.5) },
          { id: 'press', target: { unit: 'reps', min: 8, max: 10 }, weight: Math.max(10, 30 + clientIndex * 5 + Math.floor(weekIndex / 3) * 2.5) },
          { id: 'row', target: seed % 7 === 0 ? null : { unit: 'reps', min: 10, max: 12 }, weight: 25 + clientIndex * 5 },
          { id: 'plank', target: { unit: 'seconds', min: 30, max: 45 }, weight: 0 }
        ].map((exercise, exerciseIndex) => ({
          exerciseId: exercise.id, target: exercise.target,
          sets: Array.from({ length: 3 }, (_, setIndex) => {
            const variation = (seed + exerciseIndex + setIndex * 3) % 12;
            if (exercise.id === 'plank') return { duration_seconds: variation === 0 ? 25 : variation === 1 ? 50 : 35, weight_kg: 0 };
            const base = exercise.id === 'row' ? 10 : 8;
            return { weight_kg: exercise.weight, reps: variation === 0 ? base - 1 : variation === 1 ? base + 3 : base + 1 };
          })
        }));
        // События прогрессии/рекорда — отдельная часть mock-модели, не оценка реальных клиентов.
        // Одно событие = одно упражнение в тренировке, не отдельный подход.
        const achievements = seed % 3 === 0 ? [{ exerciseId: 'squat', type: 'weight', personalRecord: seed % 4 === 0 }] :
          seed % 4 === 0 ? [{ exerciseId: 'press', type: 'reps', personalRecord: seed % 5 === 0 }] : [];
        return { id, sessionId, date: trainerShiftDate(start, day * 2), exercises, achievements };
      });
      return { clientId, plannedSessionIds, plannedSessions, workouts,
        report: { submittedAt: `${trainerShiftDate(end, 1)}T08:00:00Z`, workouts: trainerCopy(workouts) } };
    });
    return { start, end, clients };
  });
  return { source: 'demo', period, clientIds: [...trainerAnalyticsDemoClients], weeks };
}

function trainerAnalyticsAggregate(weeks) {
  const total = { plannedWorkouts: 0, completedWorkouts: 0, missedWorkouts: 0, unreportedWorkouts: 0,
    completedSets: 0, targetSets: 0, belowTargetSets: 0, aboveTargetSets: 0, uncomparedSets: 0,
    progressions: 0, personalRecords: 0, totalVolume: 0, activeClientsWithData: 0,
    weeklyWorkoutData: [], weeklyVolumeData: [] };
  const activeClients = new Set();
  weeks.forEach(week => {
    const weekly = { start: week.start, end: week.end, planned: 0, completed: 0, missed: 0, unreported: 0, volume: 0 };
    week.clients.forEach(client => {
      const planned = new Set(client.plannedSessionIds);
      // После сдачи отчёта используем зафиксированный факт, а не поздние правки дневника.
      const submitted = !!client.report?.submittedAt;
      const workouts = [...new Map((submitted ? client.report.workouts : client.workouts).map(row => [row.id, row])).values()];
      const recorded = new Set(workouts.map(row => row.sessionId));
      const absent = [...planned].filter(id => !recorded.has(id)).length;
      weekly.planned += planned.size;
      weekly.completed += workouts.length;
      weekly.missed += submitted ? absent : 0;
      weekly.unreported += submitted ? 0 : absent;
      workouts.forEach(workout => {
        const exercisesWithData = new Set();
        workout.exercises.forEach(exercise => {
          exercise.sets.forEach(set => {
            const result = trainerAnalyticsSetResult(set, exercise.target);
            if (!result) return;
            activeClients.add(client.clientId);
            exercisesWithData.add(exercise.exerciseId);
            total.completedSets++;
            total[{ target: 'targetSets', below: 'belowTargetSets', above: 'aboveTargetSets', uncompared: 'uncomparedSets' }[result]]++;
            weekly.volume += trainerAnalyticsSetVolume(set);
          });
        });
        const events = new Set();
        (workout.achievements || []).forEach(event => {
          if (!exercisesWithData.has(event.exerciseId) || !['weight', 'reps', 'duration'].includes(event.type)) return;
          // Вес и повторения могут вырасти одновременно — всё равно одна прогрессия упражнения.
          const previous = events.has(event.exerciseId);
          if (!previous) total.progressions++;
          events.add(event.exerciseId);
        });
        total.personalRecords += new Set((workout.achievements || []).filter(event => events.has(event.exerciseId) && ['weight', 'reps', 'duration'].includes(event.type) && event.personalRecord).map(event => event.exerciseId)).size;
      });
    });
    total.plannedWorkouts += weekly.planned;
    total.completedWorkouts += weekly.completed;
    total.missedWorkouts += weekly.missed;
    total.unreportedWorkouts += weekly.unreported;
    total.totalVolume += weekly.volume;
    total.weeklyWorkoutData.push({ start: week.start, end: week.end, planned: weekly.planned, completed: weekly.completed, missed: weekly.missed });
    total.weeklyVolumeData.push({ start: week.start, end: week.end, volume: weekly.volume });
  });
  const percent = (value, denominator) => denominator ? value / denominator * 100 : null;
  total.activeClientsWithData = activeClients.size;
  total.workoutCompletionPercent = percent(total.completedWorkouts, total.plannedWorkouts);
  total.setPercentages = { target: percent(total.targetSets, total.completedSets), below: percent(total.belowTargetSets, total.completedSets), above: percent(total.aboveTargetSets, total.completedSets), uncompared: percent(total.uncomparedSets, total.completedSets) };
  total.averageVolumePerClient = activeClients.size ? total.totalVolume / activeClients.size : null;
  total.averageVolumePerWorkout = total.completedWorkouts ? total.totalVolume / total.completedWorkouts : null;
  total.peakVolume = total.weeklyVolumeData.reduce((peak, week, index) => week.volume > (peak?.volume || 0) ? { ...week, weekNumber: index + 1 } : peak, null);
  return total;
}

function trainerAnalyticsSummary(data) {
  const period = data.period;
  const previousStart = period.previousStart || trainerShiftDate(period.start, -28);
  const current = trainerAnalyticsAggregate(trainerAnalyticsSlice(data.weeks, period.start, period.end));
  const previousPeriodData = trainerAnalyticsAggregate(trainerAnalyticsSlice(data.weeks, previousStart, trainerShiftDate(period.start, -1)));
  const chartData = trainerAnalyticsBuckets(period).map(bucket => ({ ...bucket,
    ...trainerAnalyticsAggregate(trainerAnalyticsSlice(data.weeks, bucket.start, bucket.end)) }));
  return { ...current, period: { ...period }, source: data.source, clientCount: data.clientIds.length,
    previousPeriodData, chartData,
    progressionChange: current.progressions - previousPeriodData.progressions,
    personalRecordChange: current.personalRecords - previousPeriodData.personalRecords,
    volumeChangePercent: previousPeriodData.totalVolume ? (current.totalVolume / previousPeriodData.totalVolume - 1) * 100 : null };
}

// Месяц может начинаться посреди недели: включаем только назначения и факты в границах дат.
function trainerAnalyticsSlice(weeks, start, end) {
  const within = date => date >= start && date <= end;
  return weeks.filter(week => week.end >= start && week.start <= end).map(week => ({
    ...week, start: week.start < start ? start : week.start, end: week.end > end ? end : week.end,
    clients: week.clients.map(client => ({
      ...client,
      plannedSessionIds: client.plannedSessions ? client.plannedSessions.filter(session => within(session.date)).map(session => session.id) : client.plannedSessionIds,
      workouts: client.workouts.filter(workout => within(workout.date)),
      report: client.report ? { ...client.report, workouts: client.report.workouts.filter(workout => within(workout.date)) } : null
    }))
  }));
}

function trainerAnalyticsBuckets(period) {
  const result = [], shortDate = date => date.slice(5).split('-').reverse().join('.');
  let start = period.start;
  while (start <= period.end) {
    let end, label;
    if (period.chart === 'days') {
      end = start;
      label = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${start}T12:00:00Z`));
    } else if (period.chart === 'months') {
      end = trainerShiftDate(trainerAnalyticsShiftMonths(start.slice(0, 7) + '-01', 1), -1);
      label = new Intl.DateTimeFormat('ru-RU', { month: 'short', timeZone: 'UTC' }).format(new Date(`${start}T12:00:00Z`)).replace('.', '');
    } else {
      end = trainerShiftDate(start, 6);
      label = `${result.length + 1}-я неделя`;
    }
    if (end > period.end) end = period.end;
    result.push({ start, end, label, dateLabel: start === end ? shortDate(start) : `${shortDate(start)}–${shortDate(end)}` });
    start = trainerShiftDate(end, 1);
  }
  return result;
}
