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
