const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  const context = vm.createContext({ console, URL });
  const run = source => vm.runInContext(source, context);
  run("Date.now = () => Date.parse('2026-10-18T09:00:00Z')");
  for (const name of ['trainer-data', 'report-cycle', 'analytics-data', 'trainer', 'report-ui', 'analytics-ui']) {
    run(fs.readFileSync(path.join(__dirname, `../screens/${name}.js`), 'utf8'));
  }
  return { context, run };
}

test('по умолчанию ровно четыре завершённые недели, текущая неделя не включается', () => {
  const { run } = fixture();
  const period = run('trainerAnalyticsPeriod()');
  assert.equal(period.start, '2026-09-20');
  assert.equal(period.end, '2026-10-17');
  assert.equal(run('trainerDayDistance(trainerAnalyticsPeriod().start, trainerAnalyticsPeriod().end)'), 27);
  const monday = run("trainerAnalyticsPeriod(Date.parse('2026-10-19T12:00:00Z'))");
  assert.equal(monday.start, period.start);
  assert.equal(monday.end, period.end);
});

test('границы периода меняются в полночь по Москве и корректны на границе года', () => {
  const { run } = fixture();
  assert.equal(run("trainerAnalyticsPeriod(Date.parse('2026-10-17T20:59:00Z')).end"), '2026-10-10');
  assert.equal(run("trainerAnalyticsPeriod(Date.parse('2026-10-17T21:00:00Z')).end"), '2026-10-17');
  const period = run("trainerAnalyticsPeriod(Date.parse('2027-01-03T10:00:00Z'))");
  assert.equal(period.start, '2026-12-06');
  assert.equal(period.end, '2027-01-02');
});

test('демо содержит только семь согласованных клиентов и сопоставимые периоды по четыре недели', () => {
  const { run } = fixture();
  const data = run('createTrainerAnalyticsDemo()');
  assert.equal(data.clientIds.length, 7);
  assert.equal(new Set(data.clientIds).size, 7);
  const existing = run('trainerStore.state.clients.map(client => client.id)');
  assert.deepEqual(Array.from(data.clientIds), Array.from(existing));
  assert.equal(data.weeks.length, 8);
  data.weeks.forEach(week => {
    assert.equal(week.clients.length, 7);
    week.clients.forEach(client => {
      assert.ok(client.workouts.length <= client.plannedSessionIds.length);
      client.workouts.forEach(workout => assert.ok(workout.date >= week.start && workout.date <= week.end));
    });
  });
  const summary = run('trainerAnalyticsSummary(createTrainerAnalyticsDemo())');
  assert.equal(summary.weeklyWorkoutData.length, 4);
  assert.equal(summary.previousPeriodData.weeklyWorkoutData.length, 4);
  assert.equal(summary.previousPeriodData.weeklyWorkoutData[3].end, '2026-09-19');
});

test('итоговые тренировки, объём и пропуски совпадают с недельными графиками', () => {
  const { run } = fixture();
  const summary = run('trainerAnalyticsSummary(createTrainerAnalyticsDemo())');
  assert.equal(summary.plannedWorkouts, 92);
  assert.equal(summary.completedWorkouts, 84);
  assert.equal(summary.missedWorkouts, 8);
  assert.equal(summary.unreportedWorkouts, 0);
  assert.equal(summary.weeklyWorkoutData.reduce((sum, week) => sum + week.completed, 0), summary.completedWorkouts);
  assert.equal(summary.weeklyWorkoutData.reduce((sum, week) => sum + week.planned, 0), summary.plannedWorkouts);
  assert.equal(summary.weeklyWorkoutData.reduce((sum, week) => sum + week.missed, 0), summary.missedWorkouts);
  assert.equal(summary.weeklyVolumeData.reduce((sum, week) => sum + week.volume, 0), summary.totalVolume);
  assert.equal(summary.workoutCompletionPercent, 84 / 92 * 100);
  assert.equal(summary.averageVolumePerClient, summary.totalVolume / 7);
  assert.equal(summary.averageVolumePerWorkout, summary.totalVolume / 84);
  assert.equal(summary.peakVolume.volume, Math.max(...summary.weeklyVolumeData.map(week => week.volume)));
});

test('пропуск появляется только при сдаче отчёта; поздняя запись не переписывает снимок', () => {
  const { run } = fixture();
  run(`const data = createTrainerAnalyticsDemo(); const week = data.weeks[7];
    const client = week.clients[0]; week.clients = [client]; const sent = client.report; client.report = null;`);
  assert.equal(run('trainerAnalyticsAggregate([week]).missedWorkouts'), 0);
  assert.equal(run('trainerAnalyticsAggregate([week]).unreportedWorkouts'), 1);
  run('client.report = sent');
  assert.equal(run('trainerAnalyticsAggregate([week]).missedWorkouts'), 1);
  run(`client.workouts.push({ ...trainerCopy(client.workouts[0]), id: 'late', sessionId: client.plannedSessionIds[2] })`);
  assert.equal(run('trainerAnalyticsAggregate([week]).missedWorkouts'), 1);
  assert.equal(run('trainerAnalyticsAggregate([week]).completedWorkouts'), 2);
});

test('повторения сравниваются с точной целью и включительным диапазоном', () => {
  const { run } = fixture();
  for (const [reps, expected] of [[10, 'below'], [12, 'target'], [14, 'above']]) {
    assert.equal(run(`trainerAnalyticsSetResult({ reps: ${reps} }, { unit: 'reps', min: 12, max: 12 })`), expected);
  }
  for (const [reps, expected] of [[7, 'below'], [8, 'target'], [10, 'target'], [12, 'target'], [13, 'above']]) {
    assert.equal(run(`trainerAnalyticsSetResult({ reps: ${reps} }, { unit: 'reps', min: 8, max: 12 })`), expected);
  }
});

test('упражнения на время сравниваются в секундах, без плана попадают в Без сравнения', () => {
  const { run } = fixture();
  for (const [seconds, expected] of [[25, 'below'], [30, 'target'], [45, 'target'], [50, 'above']]) {
    assert.equal(run(`trainerAnalyticsSetResult({ duration_seconds: ${seconds} }, { unit: 'seconds', min: 30, max: 45 })`), expected);
  }
  assert.equal(run("trainerAnalyticsSetResult({ reps: 10 }, null)"), 'uncompared');
  assert.equal(run("trainerAnalyticsSetResult({ duration_seconds: 40 }, { unit: 'reps', min: 8, max: 12 })"), 'uncompared');
  assert.equal(run("trainerAnalyticsSetResult({ reps: 10 }, { unit: 'reps', min: 12, max: 8 })"), 'uncompared');
  assert.equal(run("trainerAnalyticsSetResult({ reps: 0 }, null)"), null);
  assert.equal(run("trainerAnalyticsSetResult({}, null)"), null);
});

test('все категории подходов покрывают итог, проценты вычисляются от всех выполненных', () => {
  const { run } = fixture();
  const summary = run('trainerAnalyticsSummary(createTrainerAnalyticsDemo())');
  assert.equal(summary.completedSets, summary.targetSets + summary.belowTargetSets + summary.aboveTargetSets + summary.uncomparedSets);
  assert.ok(summary.uncomparedSets > 0);
  assert.equal(summary.setPercentages.target, summary.targetSets / summary.completedSets * 100);
  assert.ok(Math.abs(Object.values(summary.setPercentages).reduce((sum, value) => sum + value, 0) - 100) < 0.000001);
});

test('тоннаж считается только для внешнего положительного веса и повторений', () => {
  const { run } = fixture();
  assert.equal(run('trainerAnalyticsSetVolume({ weight_kg: 80, reps: 10 })'), 800);
  for (const set of [{ weight_kg: 0, reps: 12 }, { reps: 12 }, { weight_kg: -10, reps: 10 }, { weight_kg: 20, duration_seconds: 40 }, { weight_kg: 20, reps: 10, duration_seconds: 40 }, { weight_kg: 20, reps: 0 }]) {
    assert.equal(run(`trainerAnalyticsSetVolume(${JSON.stringify(set)})`), 0);
  }
});

test('прогрессии и рекорды считаются по упражнениям, дубли записей не раздувают показатели', () => {
  const { run } = fixture();
  run(`const data = createTrainerAnalyticsDemo(); const week = data.weeks[7]; const workout = week.clients[0].report.workouts[0];
    workout.achievements = [{ exerciseId: 'squat', type: 'weight', personalRecord: true }, { exerciseId: 'squat', type: 'reps', personalRecord: true }];
    const baseline = trainerAnalyticsAggregate([week]);
    week.clients[0].report.workouts.push(trainerCopy(workout));
    workout.achievements.push({ exerciseId: 'absent', type: 'weight', personalRecord: true });`);
  const before = run('baseline'), after = run('trainerAnalyticsAggregate([week])');
  assert.equal(after.completedWorkouts, before.completedWorkouts);
  assert.equal(after.completedSets, before.completedSets);
  assert.equal(after.progressions, before.progressions);
  assert.equal(after.personalRecords, before.personalRecords);
  const summary = run('trainerAnalyticsSummary(createTrainerAnalyticsDemo())');
  assert.equal(summary.progressionChange, summary.progressions - summary.previousPeriodData.progressions);
  assert.equal(summary.personalRecordChange, summary.personalRecords - summary.previousPeriodData.personalRecords);
  assert.equal(summary.volumeChangePercent, (summary.totalVolume / summary.previousPeriodData.totalVolume - 1) * 100);
});

test('нулевые данные не дают NaN, Infinity или выдуманных процентов', () => {
  const { run } = fixture();
  run("const empty = { source: 'demo', period: trainerAnalyticsPeriod(), clientIds: [], weeks: [] }; const summary = trainerAnalyticsSummary(empty)");
  const summary = run('summary');
  assert.equal(summary.workoutCompletionPercent, null);
  assert.equal(summary.averageVolumePerClient, null);
  assert.equal(summary.averageVolumePerWorkout, null);
  assert.equal(summary.volumeChangePercent, null);
  assert.equal(summary.peakVolume, null);
  assert.doesNotMatch(run('trainerAnalyticsDashboard(summary)'), /NaN|Infinity|undefined|null/);
});

test('экран содержит только согласованные блоки и доступный выбор пяти периодов', () => {
  const { run } = fixture();
  const html = run('trainerAnalytics()');
  const headings = [...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map(match => match[1]);
  assert.deepEqual(headings, ['Тренировки', 'Подходы', 'Прогрессии', 'Личные рекорды', 'Тренировочный объём']);
  assert.match(html, /20\.09\.2026 — 17\.10\.2026/);
  assert.match(html, /Демо-данные · 7 клиентов/);
  assert.match(html, /Максимальный недельный объём/);
  assert.match(html, /Без сравнения/);
  assert.match(html, /<select class="analytics-period" data-analytics-period>/);
  assert.equal((html.match(/<option /g) || []).length, 5);
  assert.match(html, /<option value="4w" selected>4 недели/);
  assert.doesNotMatch(html, /<button|Раздел в разработке|AI|Питание|Сон|Доход/);
});

test('рендер аналитики сохраняет существующую навигацию и не меняет данные кабинета', () => {
  const { run, context } = fixture();
  run('trenzoEnsureReports(); trainerStore.ensureWeeklyReviews()');
  const before = run('JSON.stringify(trainerStore.state)');
  const root = { innerHTML: '', querySelectorAll: () => [] };
  context.document = { getElementById: () => root };
  run("trainerUI.route = { page: 'analytics' }; trainerRender()");
  assert.match(root.innerHTML, /class="trainer-app has-navigation"/);
  assert.match(root.innerHTML, /data-page="analytics" aria-current="page"/);
  assert.equal((root.innerHTML.match(/class="trainer-navigation"/g) || []).length, 1);
  assert.match(root.innerHTML, /analytics-dashboard/);
  assert.equal(run('JSON.stringify(trainerStore.state)'), before);
});

test('длинные числа форматируются без экспоненты, стили изолированы и используют гибкие колонки', () => {
  const { run } = fixture();
  const formatted = run('trainerAnalyticsNumber(1824500000.5, 1)');
  assert.match(formatted.replace(/\s/g, ''), /^1824500000,5$/);
  const css = fs.readFileSync(path.join(__dirname, '../styles/analytics.css'), 'utf8');
  assert.match(css, /grid-template-columns: repeat\(var\(--analytics-columns, 4\), minmax\(0, 1fr\)\)/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /overflow-wrap: anywhere/);
  for (const selector of css.matchAll(/(?:^|\n)([^@\s/][^{]+)\{/g)) assert.ok(selector[1].startsWith('#trainerScreen .analytics-'));
  const scripts = fs.readFileSync(path.join(__dirname, '../screens/analytics-data.js'), 'utf8');
  assert.doesNotMatch(scripts, /localStorage|fetch\(|supabase|trainerStore\./);
});

test('все периоды заканчиваются до текущей недели, месяцы не подменяются фиксированным числом дней', () => {
  const { run } = fixture();
  const expected = { '7d': ['2026-10-11', '2026-10-04'], '4w': ['2026-09-20', '2026-08-23'], '3m': ['2026-07-18', '2026-04-18'], '6m': ['2026-04-18', '2025-10-18'], '1y': ['2025-10-18', '2024-10-18'] };
  for (const [key, [start, previousStart]] of Object.entries(expected)) {
    const period = run(`trainerAnalyticsPeriod(Date.now(), '${key}')`);
    assert.equal(period.start, start);
    assert.equal(period.previousStart, previousStart);
    assert.equal(period.end, '2026-10-17');
    assert.equal(run(`trainerShiftDate('${period.previousEnd}', 1)`), start);
  }
  assert.equal(run("trainerAnalyticsShiftMonths('2024-03-31', -1)"), '2024-02-29');
  assert.equal(run("trainerAnalyticsShiftMonths('2025-03-31', -1)"), '2025-02-28');
  assert.equal(run("trainerAnalyticsShiftMonths('2024-02-29', -12)"), '2023-02-28');
});

test('длинные периоды обеспечены демо-историей и совпадают с короткими в пересекающихся датах', () => {
  const { run } = fixture();
  run("const short = createTrainerAnalyticsDemo(); const year = createTrainerAnalyticsDemo(Date.now(), '1y')");
  assert.equal(run('JSON.stringify(short.weeks)'), run('JSON.stringify(year.weeks.slice(-8))'));
  assert.ok(run('year.weeks[0].start <= year.period.previousStart'));
  assert.equal(run('year.weeks[year.weeks.length - 1].end'), '2026-10-17');
  assert.ok(run('year.weeks.length >= 104'));
});

test('каждый период пересчитывает все показатели и сравнение, графики не теряют пограничные дни', () => {
  const { run } = fixture();
  const summaries = [];
  for (const key of ['7d', '4w', '3m', '6m', '1y']) {
    const summary = run(`trainerAnalyticsSummary(createTrainerAnalyticsDemo(Date.now(), '${key}'))`);
    summaries.push(summary);
    assert.ok(summary.completedWorkouts > 0);
    assert.ok(summary.previousPeriodData.completedWorkouts > 0);
    for (const field of ['plannedWorkouts', 'completedWorkouts', 'missedWorkouts', 'completedSets', 'targetSets', 'belowTargetSets', 'aboveTargetSets', 'uncomparedSets', 'progressions', 'personalRecords', 'totalVolume']) {
      assert.equal(summary.chartData.reduce((sum, bucket) => sum + bucket[field], 0), summary[field], `${key}: ${field}`);
    }
    assert.equal(summary.missedWorkouts + summary.completedWorkouts, summary.plannedWorkouts);
    assert.equal(summary.volumeChangePercent, (summary.totalVolume / summary.previousPeriodData.totalVolume - 1) * 100);
    assert.equal(summary.chartData[0].start, summary.period.start);
    assert.equal(summary.chartData.at(-1).end, summary.period.end);
    assert.equal(summary.averageVolumePerClient, summary.totalVolume / 7);
  }
  for (let index = 1; index < summaries.length; index++) {
    assert.ok(summaries[index].plannedWorkouts > summaries[index - 1].plannedWorkouts);
    assert.ok(summaries[index].totalVolume > summaries[index - 1].totalVolume);
  }
});

test('7 дней разбиваются по дням, 4 недели по неделям, месяцы по календарным месяцам без разрывов', () => {
  const { run } = fixture();
  for (const [key, expectedCount] of [['7d', 7], ['4w', 4], ['3m', 4], ['6m', 7], ['1y', 13]]) {
    const buckets = run(`trainerAnalyticsBuckets(trainerAnalyticsPeriod(Date.now(), '${key}'))`);
    assert.equal(buckets.length, expectedCount);
    for (let index = 1; index < buckets.length; index++) {
      assert.equal(run(`trainerShiftDate('${buckets[index - 1].end}', 1)`), buckets[index].start);
    }
    if (['3m', '6m', '1y'].includes(key)) {
      buckets.forEach(bucket => assert.equal(bucket.start.slice(0, 7), bucket.end.slice(0, 7)));
    }
  }
});

test('пограничная часть недели считает только попавшие в период назначения и факты', () => {
  const { run } = fixture();
  run(`const data = createTrainerAnalyticsDemo(); const week = data.weeks[7]; const start = trainerShiftDate(week.start, 4);
    const clipped = trainerAnalyticsSlice([week], start, week.end);`);
  assert.equal(run('trainerAnalyticsAggregate(clipped).plannedWorkouts'), 9);
  assert.equal(run('trainerAnalyticsAggregate(clipped).completedWorkouts'), 7);
  assert.equal(run('trainerAnalyticsAggregate(clipped).missedWorkouts'), 2);
});

test('переключение через штатный обработчик обновляет экран, подписи и сохраняется при навигации', () => {
  const { run, context } = fixture();
  const root = { innerHTML: '', querySelectorAll: () => [], querySelector: () => ({ focus: () => {} }) };
  context.document = { getElementById: () => root };
  context.window = { scrollTo() {}, scrollY: 0 };
  context.input = { dataset: {}, value: '3m', hasAttribute: attr => attr === 'data-analytics-period', closest: () => null };
  run("trainerUI.route = { page: 'analytics' }; trainerHandleChange({ target: input })");
  assert.equal(run('trainerUI.analyticsPeriod'), '3m');
  assert.match(root.innerHTML, /<option value="3m" selected>3 месяца/);
  assert.match(root.innerHTML, /18\.07\.2026 — 17\.10\.2026/);
  assert.match(root.innerHTML, /за 3 месяца/);
  assert.match(root.innerHTML, /к прошлым 3 месяцам/);
  assert.match(root.innerHTML, /По месяцам/);
  assert.doesNotMatch(root.innerHTML, /за 4 недели|к прошлым 4 неделям|NaN|Infinity/);
  run("trainerGo('clients'); trainerGo('analytics')");
  assert.match(root.innerHTML, /<option value="3m" selected>/);
  context.input.value = '1y';
  run('trainerHandleChange({ target: input })');
  assert.match(root.innerHTML, /за год/);
  assert.match(root.innerHTML, /к прошлому году/);
  assert.match(root.innerHTML, /--analytics-columns:13/);
  context.input.value = '7d';
  run('trainerHandleChange({ target: input })');
  assert.match(root.innerHTML, /за 7 дней/);
  assert.match(root.innerHTML, /к прошлым 7 дням/);
  assert.match(root.innerHTML, /По дням/);
  const before = root.innerHTML;
  context.input.value = 'invalid';
  run('trainerHandleChange({ target: input })');
  assert.equal(root.innerHTML, before);
});
