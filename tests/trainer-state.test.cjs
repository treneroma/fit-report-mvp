const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const dataSource = fs.readFileSync(path.join(__dirname, '../screens/trainer-data.js'), 'utf8');
const uiSource = fs.readFileSync(path.join(__dirname, '../screens/trainer.js'), 'utf8');

function fixture() {
  const context = vm.createContext({ console, URL });
  vm.runInContext(dataSource, context);
  const store = vm.runInContext('createTrainerStore()', context);
  const records = new Map();
  const storage = { getItem: key => records.get(key) || null, setItem: (key, value) => records.set(key, value) };
  store.load(storage, 'test');
  return { context, store, storage, records };
}

test('демо содержит все состояния, а программы согласованы с частотой клиентов', () => {
  const { store } = fixture();
  assert.equal(store.state.clients.length, 7);
  assert.equal(store.state.clients.filter(c => ['attention', 'inactive'].includes(store.status(c.id))).length, 4);
  assert.equal(store.status('ilya'), 'waiting');
  assert.equal(store.status('anna'), 'ok');
  store.state.clients.forEach(c => assert.equal(store.clientProgram(c.id).weeks[0].sessions.length, c.metrics.workoutTarget));
  const split = store.program('upperlower').weeks[0].sessions;
  assert.ok(split[0].exercises.every(e => !e.name.includes('Присед')));
  assert.ok(split[1].exercises.some(e => e.name.includes('Присед')));
});

test('подтверждение убирает вопрос из очереди и один раз сохраняет решение', () => {
  const { store, storage, context } = fixture();
  const before = store.client('alexander').decisions.length;
  assert.equal(store.approveReview('recovery'), true);
  assert.equal(store.review('recovery').status, 'approved');
  assert.equal(store.status('alexander'), 'ok');
  assert.equal(store.client('alexander').decisions.length, before + 1);
  assert.equal(store.approveReview('recovery'), false);
  assert.equal(store.client('alexander').decisions.length, before + 1);
  const restored = vm.runInContext('createTrainerStore()', context);
  restored.load(storage, 'test');
  assert.equal(restored.review('recovery').status, 'approved');
  assert.equal(restored.client('alexander').decisions[0].reviewId, 'recovery');
});

test('нагрузка применяется только после согласования и только своему клиенту', () => {
  const { store } = fixture();
  const squat = p => p.weeks[0].sessions.flatMap(s => s.exercises).find(e => e.name === 'Присед со штангой').weightKg;
  assert.equal(squat(store.clientProgram('ilya')), 80);
  store.approveReview('squat');
  assert.equal(squat(store.clientProgram('ilya')), 82.5);
  assert.equal(squat(store.program('upperlower')), 80);
  assert.equal(squat(store.clientProgram('andrey')), 80);
});

test('ручное изменение предложения не применяет исходную скрытую корректировку', () => {
  const { store } = fixture();
  const before = store.client('ilya').decisions.length;
  store.editReview('squat', 'Оставить 80 кг и проверить технику.');
  assert.equal(store.review('squat').status, 'requires_action');
  assert.equal(store.client('ilya').decisions.length, before);
  assert.equal(store.review('squat').change, null);
  store.approveReview('squat');
  assert.equal(store.client('ilya').decisions[0].action, 'Оставить 80 кг и проверить технику.');
  assert.equal(store.clientProgram('ilya').weeks[0].sessions.flatMap(s => s.exercises).find(e => e.name === 'Присед со штангой').weightKg, 80);
});

test('конструктор создаёт независимую копию шаблона и валидирует упражнения', () => {
  const { store } = fixture();
  const draft = JSON.parse(JSON.stringify(store.program('template-fullbody')));
  draft.title = 'Моя программа'; draft.weeks[0].sessions[0].exercises[0].weightKg = 25;
  const saved = store.saveProgram(draft);
  assert.notEqual(saved.id, 'template-fullbody');
  assert.equal(saved.source, 'mine');
  assert.equal(store.program('template-fullbody').weeks[0].sessions[0].exercises[0].weightKg, 80);
  draft.weeks[0].sessions[0].exercises[0].name = '';
  assert.throws(() => store.saveProgram(draft), /Проверь/);
});

test('назначение меняет только выбранного клиента и сохраняет историю', () => {
  const { store } = fixture();
  store.assignProgram('upperlower', 'anna');
  assert.equal(store.client('anna').programId, 'upperlower');
  assert.equal(store.client('anna').currentWeek, 1);
  assert.equal(store.client('anna').programCompleted, 0);
  assert.equal(store.client('anna').metrics.workoutTarget, 3);
  assert.equal(store.client('anna').metrics.workoutCompleted, 3);
  assert.equal(store.clientProgram('anna').weeks[0].sessions.length, 4);
  assert.equal(store.client('alexander').programId, 'fullbody');
  assert.match(store.client('anna').decisions[0].action, /Upper \/ Lower/);
});

test('пустое состояние, добавление клиента и спокойный день доступны', () => {
  const { store } = fixture();
  store.reset('empty');
  assert.equal(store.state.clients.length, 0);
  const client = store.addClient({ name: 'Тестовый Подопечный', goal: 'Базовая сила' });
  assert.equal(client.weights.length, 0);
  assert.equal(store.status(client.id), 'ok');
  assert.equal(store.clientProgram(client.id), null);
  store.reset('calm');
  assert.equal(store.state.reviews.filter(store.pending).length, 0);
  assert.ok(store.state.clients.every(c => store.status(c.id) === 'ok'));
});

test('поиск клиентов сочетается со статусом и учитывает имена в любом порядке', () => {
  const { context } = fixture();
  vm.runInContext(uiSource, context);
  const evaluate = expression => vm.runInContext(expression, context);
  const ids = () => Array.from(evaluate('trainerFilteredClients().map(client => client.id)'));
  evaluate("trainerUI.search = '  ИВАНОВ   Александр  '");
  assert.deepEqual(ids(), ['alexander']);
  evaluate("trainerUI.clientFilter = 'waiting'");
  assert.deepEqual(ids(), []);
  evaluate("trainerUI.search = ''; trainerUI.clientFilter = 'attention'");
  assert.equal(ids().length, 4);
  assert.ok(ids().includes('maxim'));
  evaluate("trainerStore.approveReview('recovery')");
  assert.equal(ids().length, 3);
  assert.ok(!ids().includes('alexander'));
  evaluate("trainerUI.clientFilter = 'waiting'; trainerUI.search = 'силовых'");
  assert.deepEqual(ids(), ['ilya']);
  const added = evaluate("trainerStore.addClient({ name: 'Семён Воробьёв', goal: 'Поддержание формы' })");
  evaluate("trainerUI.clientFilter = 'ok'; trainerUI.search = 'воробьев семен'");
  assert.deepEqual(ids(), [added.id]);
});

test('хранилище раздельно по пользователям и корректно переживает ошибки', () => {
  const { store, storage, context } = fixture();
  store.saveProfile({ name: 'Новый тренер' });
  const another = vm.runInContext('createTrainerStore()', context);
  another.load(storage, 'other-user');
  assert.equal(another.state.trainer.name, 'Роман');
  assert.equal(store.state.trainer.name, 'Новый тренер');
  const broken = vm.runInContext('createTrainerStore()', context);
  broken.load({ getItem: () => '{invalid', setItem: () => { throw new Error('Quota'); } }, 'broken');
  assert.equal(broken.state.clients.length, 7);
  broken.approveReview('recovery');
  assert.match(broken.storageWarning, /Не удалось сохранить/);
});

test('все экраны рендерятся на обычных и пустых данных; AI не меняет факты', () => {
  const { context } = fixture();
  vm.runInContext(uiSource, context);
  const evaluate = expression => vm.runInContext(expression, context);
  const pages = ['trainerToday()', 'trainerClients()', 'trainerReviews()', 'trainerPrograms()', 'trainerProfile()', 'trainerAI()'];
  for (const page of pages) assert.equal(typeof evaluate(page), 'string');
  for (const tab of ['overview', 'training', 'nutrition', 'progress', 'reports']) {
    evaluate(`trainerUI.route = {page: 'client', id: 'alexander', tab: '${tab}'}`);
    assert.equal(typeof evaluate('trainerClient()'), 'string');
  }
  evaluate("trainerUI.route = {page: 'review', id: 'recovery'}"); assert.match(evaluate('trainerReview()'), /Подтвердить/);
  evaluate("trainerUI.route = {page: 'memory', id: 'alexander'}"); assert.match(evaluate('trainerMemory()'), /Последние решения/);
  evaluate("trainerUI.route = {page: 'program', id: 'fullbody'}"); assert.match(evaluate('trainerProgram()'), /Жим лёжа/);
  evaluate("trainerUI.route = {page: 'program', id: 'fullbody', clientId: 'alexander'}");
  assert.match(evaluate('trainerProgram()'), /value="4" selected>Неделя 5/);
  evaluate("trainerStore.assignProgram('upperlower', 'anna'); trainerUI.route = {page: 'memory', id: 'anna'}");
  assert.match(evaluate('trainerMemory()'), /4 раза в неделю/);
  evaluate("trainerUI.route = {page: 'program-new', mode: 'ai'}"); assert.match(evaluate('trainerProgramNew()'), /Собрать программу/);
  evaluate("trainerUI.draft = trainerCopy(trainerStore.program('fullbody'))"); assert.match(evaluate('trainerProgramEditor()'), /Сохранить программу/);
  const factsCount = evaluate("trainerStore.review('plateau').facts.length");
  evaluate("trainerAIAnswer('Что изменилось у Марии за месяц?')");
  assert.equal(evaluate("trainerStore.review('plateau').facts.length"), factsCount);
  evaluate("trainerStore.reset('empty')");
  for (const page of pages) assert.equal(typeof evaluate(page), 'string');
});

test('недельные границы учитывают день, время, год и часовой пояс', () => {
  const { context } = fixture();
  const period = (schedule, date) => JSON.parse(JSON.stringify(vm.runInContext(`trainerWeeklyPeriod(${JSON.stringify(schedule)}, Date.parse('${date}'))`, context)));
  const monday = { day: 1, time: '09:00', timeZone: 'Europe/Moscow' };
  assert.deepEqual(period(monday, '2026-10-05T05:59:00Z'), { start: '2026-09-21', end: '2026-09-27', reviewDate: '2026-09-28' });
  assert.deepEqual(period(monday, '2026-10-05T06:00:00Z'), { start: '2026-09-28', end: '2026-10-04', reviewDate: '2026-10-05' });
  assert.deepEqual(period(monday, '2026-01-05T08:00:00Z'), { start: '2025-12-29', end: '2026-01-04', reviewDate: '2026-01-05' });
  assert.deepEqual(period({ day: 0, time: '09:00', timeZone: 'America/New_York' }, '2026-11-01T14:00:00Z'), { start: '2026-10-25', end: '2026-10-31', reviewDate: '2026-11-01' });
});

test('для каждого клиента создаётся один разбор, в том числе без записей; пропущенные недели догружаются', () => {
  const { store } = fixture();
  const batch = store.state.weeklyReviews;
  assert.equal(batch.length, 7);
  assert.equal(new Set(batch.map(item => item.clientId)).size, 7);
  assert.ok(batch.every(item => item.plan));
  assert.equal(store.weeklyData(batch.find(item => item.clientId === 'maxim').id).workouts.length, 0);
  assert.equal(store.weeklyData(batch.find(item => item.clientId === 'maxim').id).nutrition.length, 0);
  store.ensureWeeklyReviews(); store.ensureWeeklyReviews();
  assert.equal(batch.length, 7);
  const firstDate = batch[0].reviewDate;
  const next = new Date(`${firstDate}T20:00:00Z`); next.setUTCDate(next.getUTCDate() + 14);
  store.ensureWeeklyReviews(next.getTime());
  assert.equal(batch.length, 21);
  assert.equal(new Set(batch.map(item => item.id)).size, 21);
  assert.equal(new Set(batch.map(item => item.start)).size, 3);
});

test('исторический план не меняется после редактирования и нового назначения', () => {
  const { store } = fixture();
  const review = store.state.weeklyReviews.find(item => item.clientId === 'anna');
  const before = JSON.stringify(review.plan);
  const edited = JSON.parse(JSON.stringify(store.program('fullbody')));
  edited.weeks[4].sessions[0].exercises[0].weightKg = 120;
  store.saveProgram(edited); store.assignProgram('upperlower', 'anna');
  assert.equal(JSON.stringify(review.plan), before);
  assert.equal(store.clientProgram('anna').title, 'Upper / Lower');
  assert.ok(store.client('anna').planHistory.length >= 2);
});

test('план текущей недели фиксируется до изменений и попадёт неизменным в будущий разбор', () => {
  const { store } = fixture();
  const client = store.client('anna'), current = client.weekPlans[client.weekPlans.length - 1];
  const before = JSON.stringify(current.plan);
  const edited = JSON.parse(JSON.stringify(store.program('fullbody')));
  edited.weeks.forEach(week => week.sessions.forEach(session => session.exercises.forEach(exercise => { exercise.weightKg = 120; })));
  store.saveProgram(edited);
  assert.equal(JSON.stringify(current.plan), before);
  const due = new Date(`${current.start}T20:00:00Z`); due.setUTCDate(due.getUTCDate() + 7);
  store.ensureWeeklyReviews(due.getTime());
  const nextReview = store.state.weeklyReviews.find(item => item.clientId === client.id && item.start === current.start);
  assert.equal(JSON.stringify(nextReview.plan), before);
});

test('разбор фильтрует даты и дубли питания; не использует сегодняшний вес как итог прошлой недели', () => {
  const { store } = fixture();
  const review = store.state.weeklyReviews.find(item => item.clientId === 'alexander'), client = store.client('alexander');
  client.weights.push({ measured_on: review.reviewDate, weight_kg: 100 });
  client.nutrition.push({ report_date: review.start, calories: 2000, protein_g: 150, fat_g: 70, carbs_g: 220 });
  const data = store.weeklyData(review.id);
  assert.equal(data.workouts.length, 3);
  assert.equal(data.nutrition.length, 7);
  assert.equal(data.nutrition[0].calories, 2000);
  assert.equal(data.latestWeight.weight_kg, 82.4);
  assert.equal(data.weightDelta, -0.4);
});

test('сравнение упражнений не смешивает ноги и грудь, разные подходы, время и RPE', () => {
  const { context, store } = fixture();
  const compare = (now, before) => vm.runInContext(`trainerWorkoutComparison(${JSON.stringify(now)}, ${JSON.stringify(before)})`, context);
  const exercise = sets => ({ name: 'Жим', sets });
  const before = exercise([{ weight_kg: 60, reps: 8 }]);
  assert.equal(compare(exercise([{ weight_kg: 60, reps: 9 }]), before), 'up');
  assert.equal(compare(exercise([{ weight_kg: 62.5, reps: 7 }]), before), 'mixed');
  assert.equal(compare(exercise([{ weight_kg: 60, reps: 8 }, { weight_kg: 60, reps: 8 }]), before), 'unknown');
  assert.equal(compare(exercise([{ weight_kg: 0, duration_seconds: 40 }]), exercise([{ weight_kg: 0, duration_seconds: 30 }])), 'unknown');
  const review = store.state.weeklyReviews.find(item => item.clientId === 'ilya');
  assert.ok(store.weeklyData(review.id).comparisons.some(item => item.direction === 'up'));
  const client = store.client('ilya');
  client.workouts.filter(item => item.workout_date < review.start).forEach(item => { item.title = 'Другая тренировка'; });
  assert.ok(store.weeklyData(review.id).comparisons.every(item => item.direction === 'unknown'));
});

test('черновик и завершение сохраняются; завершение идемпотентно и не меняет программу', () => {
  const { store, storage, context } = fixture();
  const review = store.state.weeklyReviews.find(item => item.clientId === 'alexander'), client = store.client('alexander');
  const beforePlan = JSON.stringify(store.clientProgram(client.id)), beforeDecisions = client.decisions.length;
  assert.throws(() => store.saveWeeklyNote(review.id, '', true), /Запиши/);
  store.saveWeeklyNote(review.id, 'Проверить питание');
  assert.equal(review.status, 'new');
  assert.equal(client.decisions.length, beforeDecisions);
  store.saveWeeklyNote(review.id, 'Сохранить нагрузку. Уточнить дневник.', true);
  assert.equal(review.status, 'approved');
  assert.equal(client.decisions.length, beforeDecisions + 1);
  assert.equal(store.saveWeeklyNote(review.id, 'Повторно', true), false);
  const snapshot = JSON.stringify(store.weeklyData(review.id));
  client.workouts = []; client.nutrition = [];
  assert.equal(JSON.stringify(store.weeklyData(review.id)), snapshot);
  assert.equal(JSON.stringify(store.clientProgram(client.id)), beforePlan);
  const restored = vm.runInContext('createTrainerStore()', context); restored.load(storage, 'test');
  assert.equal(restored.review(review.id).status, 'approved');
  assert.equal(JSON.stringify(restored.weeklyData(review.id)), snapshot);
});

test('расписание валидируется, сохраняется и не переписывает архив', () => {
  const { store, storage, context } = fixture();
  const before = JSON.stringify(store.state.weeklyReviews);
  assert.throws(() => store.saveReviewSchedule({ day: 7, time: '09:00', timeZone: 'Europe/Moscow' }), /день/);
  assert.throws(() => store.saveReviewSchedule({ day: 1, time: '25:00', timeZone: 'Europe/Moscow' }), /день/);
  assert.throws(() => store.saveReviewSchedule({ day: 1, time: '09:00', timeZone: 'Invalid/TimeZone' }), /пояс/);
  store.saveReviewSchedule({ day: 1, time: '09:30', timeZone: 'Europe/Moscow' });
  store.ensureWeeklyReviews();
  assert.equal(JSON.stringify(store.state.weeklyReviews), before);
  const restored = vm.runInContext('createTrainerStore()', context); restored.load(storage, 'test');
  assert.equal(restored.state.trainer.reviewSchedule.day, 1);
  assert.equal(restored.state.trainer.reviewSchedule.time, '09:30');
});

test('миграция старого кабинета сохраняет данные и не выдумывает исторический план', () => {
  const { store, storage, context } = fixture();
  const saved = JSON.parse(JSON.stringify(store.state));
  delete saved.weeklyReviews; delete saved.firstReviewStart; delete saved.trainer.reviewSchedule;
  saved.clients.forEach(client => { delete client.planHistory; delete client.measurementHistory; client.metrics.sleep = '7 часов'; });
  storage.setItem('trenzo-trainer-demo-v1:old', JSON.stringify(saved));
  const restored = vm.runInContext('createTrainerStore()', context); restored.load(storage, 'old');
  assert.equal(restored.state.clients.length, 7);
  assert.equal(restored.client('alexander').weights.length, 5);
  assert.equal(restored.state.weeklyReviews.length, 7);
  assert.ok(restored.state.weeklyReviews.every(item => item.plan === null));
  assert.equal(restored.client('alexander').metrics.sleep, undefined);
});

test('новый клиент не добавляется задним числом в разбор завершившейся недели', () => {
  const { store } = fixture();
  const added = store.addClient({ name: 'Новый Клиент', goal: 'Рост силы' });
  store.ensureWeeklyReviews();
  assert.ok(!store.state.weeklyReviews.some(item => item.clientId === added.id));
  const nextDate = new Date(`${added.joinedOn}T20:00:00Z`); nextDate.setUTCDate(nextDate.getUTCDate() + 8);
  store.ensureWeeklyReviews(nextDate.getTime());
  assert.ok(store.state.weeklyReviews.some(item => item.clientId === added.id));
});

test('недельный UI содержит все разделы, нет сна/воды; небезопасное медиа не вставляется', () => {
  const { context } = fixture(); vm.runInContext(uiSource, context);
  const evaluate = expression => vm.runInContext(expression, context);
  evaluate("trainerUI.route = { page: 'review', id: trainerStore.state.weeklyReviews[0].id }");
  const html = evaluate('trainerReview()');
  for (const label of ['Вес и замеры', 'Назначено', 'Факт из дневника', 'Питание', 'Фотоотчёт', 'Видеоотчёты', 'Итог и следующая неделя', 'Завершить разбор']) assert.ok(html.includes(label));
  assert.ok(!html.includes('Сон')); assert.ok(!html.includes('Вода'));
  const media = evaluate("trainerWeeklyMedia({media:[{type:'photo',recorded_on:'2026-10-01',url:'javascript:alert(1)'},{type:'video',recorded_on:'2026-10-01',url:'https://example.com/report.mp4',caption:'Видео'}]}, 'video')");
  assert.ok(media.includes('<video')); assert.ok(media.includes('controls'));
  assert.ok(!evaluate("trainerWeeklyMedia({media:[{type:'photo',recorded_on:'2026-10-01',url:'javascript:alert(1)'}]}, 'photo')").includes('src='));
});
