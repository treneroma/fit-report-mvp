const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const dataSource = fs.readFileSync(path.join(__dirname, '../screens/trainer-data.js'), 'utf8');
const uiSource = fs.readFileSync(path.join(__dirname, '../screens/trainer.js'), 'utf8');

function fixture() {
  const context = vm.createContext({ console, URL });
  // UI-снимки используют демо 18 октября; дата сценариев хранилища — 17 октября.
  vm.runInContext("Date.now = () => Date.parse('2026-10-18T09:00:00Z')", context);
  vm.runInContext(dataSource, context);
  vm.runInContext("Date.now = () => Date.parse('2026-10-17T09:00:00Z')", context);
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

test('раздел схем разделяет созданные тренировки, схемы и два типа шаблонов', () => {
  const { context } = fixture();
  vm.runInContext(uiSource, context);
  const evaluate = expression => vm.runInContext(expression, context);
  evaluate("trainerUI.route = {page:'programs'}");
  const workouts = evaluate('trainerPrograms()');
  assert.match(workouts, /<h1>Схемы тренировок<\/h1>/);
  assert.match(workouts, /Созданные тренировки/);
  assert.match(workouts, /data-action="create-training-menu"/);
  assert.equal((workouts.match(/data-action="library-workout"/g) || []).length, 3);
  assert.doesNotMatch(workouts, /От первого плана|>Мои<|>Назначенные<|data-action="program"/);
  evaluate("trainerUI.programFilter='schemes'");
  const schemes = evaluate('trainerPrograms()');
  assert.match(schemes, /Созданные схемы/);
  assert.equal((schemes.match(/data-action="program"/g) || []).length, 3);
  assert.doesNotMatch(schemes, /data-action="library-workout"/);
  evaluate("trainerUI.programFilter='templates'; trainerUI.templateFilter='workouts'");
  const workoutTemplates = evaluate('trainerPrograms()');
  assert.match(workoutTemplates, /aria-label="Тип шаблонов"/);
  assert.match(workoutTemplates, /Шаблоны схем тренировок/);
  assert.equal((workoutTemplates.match(/data-action="library-workout"/g) || []).length, 3);
  evaluate("trainerUI.templateFilter='schemes'");
  const schemeTemplates = evaluate('trainerPrograms()');
  assert.equal((schemeTemplates.match(/data-action="program"/g) || []).length, 2);
  assert.doesNotMatch(schemeTemplates, /data-action="library-workout"/);
});

test('отдельная тренировка сохраняется независимо, а шаблон копируется без изменения оригинала', () => {
  const { context, store, storage } = fixture();
  const source = store.libraryWorkout('template-workout-fullbody');
  const before = JSON.stringify(source), programs = store.state.programs.length;
  const draft = JSON.parse(before);
  draft.title = 'Моя адаптация'; draft.exercises[0].weightKg = 25;
  const saved = store.saveLibraryWorkout(draft);
  assert.notEqual(saved.id, source.id);
  assert.equal(saved.source, 'mine');
  assert.equal(saved.exercises[0].weightKg, 25);
  assert.equal(JSON.stringify(source), before);
  assert.equal(store.state.programs.length, programs);
  draft.exercises[0].weightKg = 30;
  assert.equal(saved.exercises[0].weightKg, 25);
  assert.equal(store.saveLibraryWorkout({ ...saved, title: 'Обновлённая тренировка' }).id, saved.id);
  const restored = vm.runInContext('createTrainerStore()', context);
  restored.load(storage, 'test');
  assert.equal(restored.libraryWorkout(saved.id).title, 'Обновлённая тренировка');
  assert.throws(() => store.saveLibraryWorkout({ ...saved, title: '' }), /название тренировки/);
  assert.throws(() => store.saveLibraryWorkout({ ...saved, exercises: [] }), /хотя бы одно упражнение/);
  assert.throws(() => store.saveLibraryWorkout({ ...saved, duration: NaN }), /длительность/);
});

test('схема собирается из независимых копий тренировок и недель без изменения назначений', () => {
  const { store } = fixture();
  const ids = ['workout-upper', 'workout-lower'];
  const assignments = store.state.clients.map(client => client.programId);
  const draft = store.draftProgramFromWorkouts({ title: 'Верх / низ · Моя схема', weeks: 4, workoutIds: ids, duration: 45 });
  assert.equal(draft.weeks.length, 4);
  assert.equal(draft.weeks[0].sessions.length, 2);
  assert.equal(draft.weeks[0].sessions[0].title, store.libraryWorkout(ids[0]).title);
  const original = store.libraryWorkout(ids[0]).exercises[0].weightKg;
  draft.weeks[0].sessions[0].exercises[0].weightKg = original + 5;
  assert.equal(store.libraryWorkout(ids[0]).exercises[0].weightKg, original);
  assert.equal(draft.weeks[1].sessions[0].exercises[0].weightKg, original);
  const saved = store.saveProgram(draft);
  assert.equal(saved.source, 'mine');
  assert.deepEqual(store.state.clients.map(client => client.programId), assignments);
  store.saveLibraryWorkout({ ...store.libraryWorkout(ids[0]), title: 'Другое название' });
  assert.notEqual(saved.weeks[0].sessions[0].title, 'Другое название');
  assert.throws(() => store.draftProgramFromWorkouts({ title:'Схема', weeks:2, workoutIds:[] }), /от 1 до 6 тренировок/);
  assert.throws(() => store.draftProgramFromWorkouts({ title:'Схема', weeks:0, workoutIds:ids }), /от 1 до 12 недель/);
  assert.throws(() => store.draftProgramFromWorkouts({ title:'Схема', weeks:2, workoutIds:['missing'] }), /не найдена/);
});

test('старый кабинет получает библиотеку тренировок без сброса программ и назначений', () => {
  const { context, store, storage, records } = fixture();
  const legacy = JSON.parse(JSON.stringify(store.state));
  delete legacy.workoutLibrary;
  legacy.programs[0].title = 'Сохранённая программа';
  records.set('trenzo-trainer-demo-v1:test', JSON.stringify(legacy));
  const restored = vm.runInContext('createTrainerStore()', context);
  restored.load(storage, 'test');
  assert.equal(restored.state.workoutLibrary.length, 6);
  assert.equal(restored.state.programs[0].title, 'Сохранённая программа');
  assert.deepEqual(Array.from(restored.state.clients, client => client.programId), Array.from(legacy.clients, client => client.programId));
  assert.equal(JSON.parse(storage.getItem('trenzo-trainer-demo-v1:test')).workoutLibrary.length, 6);
});

test('меню создания открывает рабочий редактор тренировки и сборку схемы', () => {
  const { context } = fixture();
  vm.runInContext(uiSource, context);
  const evaluate = expression => vm.runInContext(expression, context);
  const dialog = { showModal() {}, close() {} }, toast = {};
  const root = { innerHTML: '', querySelectorAll: () => [], querySelector: () => dialog };
  context.document = { getElementById: id => id === 'trainerToast' ? toast : root };
  context.window = { scrollY: 0, scrollTo() {} };
  context.setTimeout = () => 0; context.clearTimeout = () => {};
  context.FormData = class {
    constructor(form) { this.entries = form.entries || []; }
    [Symbol.iterator]() { return this.entries[Symbol.iterator](); }
    getAll(name) { return this.entries.filter(([key]) => key === name).map(([, value]) => value); }
  };
  const click = (action, values = {}) => {
    context.clickEvent = { target: { closest: () => ({ dataset: { action, ...values } }) } };
    evaluate('trainerHandleClick(clickEvent)');
  };
  const submit = (form, entries = []) => {
    context.submitEvent = { preventDefault() {}, target: { dataset: { form }, entries, reportValidity: () => true, querySelector: () => null } };
    evaluate('trainerHandleSubmit(submitEvent)');
  };
  evaluate("trainerUI.route = {page:'programs'}");
  click('create-training-menu');
  assert.match(root.innerHTML, /Создать:<\/h2>/);
  assert.match(root.innerHTML, /Создать с TRENZO/);
  assert.match(root.innerHTML, /Создать тренировку/);
  assert.match(root.innerHTML, /Создать схему тренировок/);
  click('new-library-workout');
  assert.match(root.innerHTML, /data-form="save-library-workout"/);
  assert.doesNotMatch(root.innerHTML, /data-editor-week|data-action="add-day"/);
  evaluate("trainerUI.draft.title='Новая силовая'; trainerUI.draft.weeks[0].sessions[0].exercises=trainerCopy(trainerStore.libraryWorkout('workout-upper').exercises)");
  submit('save-library-workout');
  const workoutId = evaluate('trainerUI.route.id');
  assert.equal(evaluate('trainerUI.route.page'), 'library-workout');
  assert.match(root.innerHTML, /Новая силовая/);
  click('compose-scheme', { id: workoutId });
  assert.match(root.innerHTML, /data-form="compose-scheme"/);
  assert.match(root.innerHTML, new RegExp(`value="${workoutId}" checked`));
  submit('compose-scheme', [['title','Моя схема'],['weeks','3'],['duration','45'],['equipment','Зал'],['workoutIds',workoutId],['workoutIds','workout-lower']]);
  assert.equal(evaluate('trainerUI.route.page'), 'program-edit');
  assert.equal(evaluate('trainerUI.draft.weeks[0].sessions.length'), 2);
  submit('save-program');
  assert.equal(evaluate('trainerUI.route.page'), 'program');
  assert.match(root.innerHTML, /Моя схема/);
  assert.equal(evaluate('trainerUI.programFilter'), 'schemes');
});

test('редактирование из карточки клиента сохраняет персональную копию без сброса недели', () => {
  const { store } = fixture();
  const alexander = store.client('alexander'), currentWeek = alexander.currentWeek;
  const originalProgramId = alexander.programId;
  const draft = JSON.parse(JSON.stringify(store.clientProgram('alexander')));
  draft.id = null; draft.title = 'Full Body · Персональный';
  const saved = store.saveProgramForClient(draft, 'alexander');
  assert.equal(alexander.programId, saved.id);
  assert.notEqual(saved.id, originalProgramId);
  assert.equal(alexander.currentWeek, currentWeek);
  assert.equal(store.client('anna').programId, originalProgramId);
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

test('состояния клиентов вычисляются по данным недели и фильтры работают по состояниям', () => {
  const { context } = fixture();
  vm.runInContext(uiSource, context);
  const evaluate = expression => vm.runInContext(expression, context);
  const ids = () => Array.from(evaluate('trainerFilteredClients().map(client => client.id)'));
  evaluate("trainerUI.search = '  ИВАНОВ   Александр  '");
  assert.deepEqual(ids(), ['alexander']);
  assert.deepEqual(Array.from(evaluate("trainerStore.state.clients.map(client => trainerStore.clientState(client.id))")), ['overload', 'plateau', 'off_plan', 'stable', 'stable', 'slump', 'stable']);
  const progressing = evaluate("trainerStore.client('anna')");
  progressing.goal = 'Снижение веса';
  progressing.metrics.weightDelta = -0.3;
  progressing.metrics.nutritionPercent = 95;
  assert.equal(evaluate("trainerStore.clientState('anna')"), 'progress');
  progressing.paused = true;
  assert.equal(evaluate("trainerStore.clientState('anna')"), 'paused');
  progressing.paused = false;
  progressing.goal = 'Изменение состава тела';
  progressing.metrics.weightDelta = -0.2;
  evaluate("trainerUI.clientFilter = 'plateau'");
  assert.deepEqual(ids(), []);
  evaluate("trainerUI.search = ''; trainerUI.clientFilter = 'off_plan'");
  assert.deepEqual(ids(), ['maxim']);
  evaluate("trainerUI.clientFilter = 'stable'; trainerUI.search = 'орлов'");
  assert.deepEqual(ids(), ['anna']);
  const added = evaluate("trainerStore.addClient({ name: 'Семён Воробьёв', goal: 'Поддержание формы' })");
  assert.equal(evaluate(`trainerStore.clientState('${added.id}')`), 'low_data');
  evaluate("trainerUI.clientFilter = 'low_data'; trainerUI.search = 'воробьев семен'");
  assert.deepEqual(ids(), [added.id]);
});

test('карточка клиента показывает один тег, допускает ручную замену и использует цель по умолчанию', () => {
  const { context, storage } = fixture();
  vm.runInContext(uiSource, context);
  context.clientTagStorage = storage;
  vm.runInContext("trainerStore.load(clientTagStorage, 'test')", context);
  const evaluate = expression => vm.runInContext(expression, context);
  const initialCard = evaluate("trainerClientCard(trainerStore.client('alexander'))");
  assert.match(initialCard, /Александр Иванов/);
  assert.match(initialCard, /Снижение веса/);
  assert.match(initialCard, /Перегруз/);
  assert.equal((initialCard.match(/class="trainer-client-status/g) || []).length, 1);
  assert.doesNotMatch(initialCard, /Требует внимания|Всё хорошо|Ждёт решения/);
  assert.doesNotMatch(initialCard, /Занимается/);
  evaluate("trainerUI.modal = { type: 'add-client' }");
  assert.match(evaluate('trainerModalMarkup()'), /maxlength="24"/);
  const added = evaluate("trainerStore.addClient({ name: 'Новый Клиент', goal: 'Набор массы', tag: 'Старт в ноябре' })");
  assert.match(added.joinedOn, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(added.tag, 'Старт в ноябре');
  assert.equal(evaluate(`trainerStore.clientState('${added.id}')`), 'low_data');
  evaluate(`trainerUI.route = { page: 'client', id: '${added.id}' }; trainerUI.editingClientTag = '${added.id}'`);
  const editingClient = evaluate('trainerClient()');
  assert.match(editingClient, /data-form="edit-client-tag"/);
  assert.match(editingClient, /value="Старт в ноябре"/);
  assert.match(editingClient, /maxlength="24"/);
  evaluate(`trainerStore.saveClientTag('${added.id}', '')`);
  assert.equal(added.tag, '');
  assert.match(evaluate(`trainerClientCard(trainerStore.client('${added.id}'))`), /Набор массы/);
  evaluate(`trainerStore.saveClientTag('${added.id}', 'К свадьбе')`);
  assert.equal(added.tag, 'К свадьбе');
  assert.match(evaluate(`trainerClientCard(trainerStore.client('${added.id}'))`), /К свадьбе/);
  assert.throws(() => vm.runInContext(`trainerStore.saveClientTag('${added.id}', 'Подготовка к соревнованиям')`, context), /не длиннее 24 символов/);
  assert.throws(() => vm.runInContext("trainerStore.addClient({ name: 'Слишком ДлинныйТег', goal: 'Цель', tag: 'x'.repeat(25) })", context), /не длиннее 24 символов/);
});

test('аватар клиента выбирается по полу анкеты и сохраняет загруженное фото поверх заглушки', () => {
  const { context } = fixture();
  vm.runInContext(uiSource, context);
  const evaluate = expression => vm.runInContext(expression, context);
  const male = evaluate("trainerAvatar(trainerStore.client('alexander'))");
  const female = evaluate("trainerAvatar(trainerStore.client('maria'))");
  assert.match(male, /src="assets\/client-avatar-male\.png"/);
  assert.match(female, /src="assets\/client-avatar-female\.png"/);
  assert.match(male, /class="trainer-avatar-initials" hidden/);
  assert.doesNotMatch(male, /loading="lazy"|decoding="async"/);
  assert.ok(fs.existsSync(path.join(__dirname, '../assets/client-avatar-male.png')));
  assert.ok(fs.existsSync(path.join(__dirname, '../assets/client-avatar-female.png')));

  // Пол берётся из данных, а не из имени; неизвестный пол не подменяется догадкой.
  assert.match(evaluate("trainerAvatar({name:'Александр', questionnaire:{sex:'female'}})"), /client-avatar-female\.png/);
  assert.match(evaluate("trainerAvatar({name:'Мария', athleteAnswers:{sex:'male'}})"), /client-avatar-male\.png/);
  assert.match(evaluate("trainerAvatar({name:'Мария', profileAnswers:{sex:'female'}})"), /client-avatar-female\.png/);
  for (const sex of ['unspecified', 'unknown', 'constructor']) {
    const neutral = evaluate(`trainerAvatar({name:'Клиент', surname:'Тестовый', questionnaire:{sex:${JSON.stringify(sex)}}})`);
    assert.doesNotMatch(neutral, /<img/);
    assert.match(neutral, /class="trainer-avatar-initials">КТ<\/span>/);
  }

  const photo = evaluate("trainerAvatar({name:'Клиент', questionnaire:{sex:'male'}, avatar_url:'https://example.com/avatar.jpg?a=1&b=2'})");
  assert.match(photo, /src="https:\/\/example\.com\/avatar\.jpg\?a=1&amp;b=2"/);
  assert.ok(photo.indexOf('client-avatar-male.png') < photo.indexOf('https://example.com/avatar.jpg'));
  assert.match(photo, /onerror="trainerAvatarImageFailed\(this\)"/);
  assert.doesNotMatch(evaluate("trainerAvatar({name:'Клиент', avatarUrl:'javascript:alert(1)'})"), /<img|javascript:/);
});

test('обновление экрана сохраняет загруженные элементы аватаров и меняет их размер без замены фото', () => {
  const { context } = fixture();
  vm.runInContext(uiSource, context);
  const image = { complete: true };
  const first = { dataset: { trainerAvatar: 'same-photo' }, className: 'trainer-avatar', image };
  const duplicate = { dataset: { trainerAvatar: 'same-photo' }, className: 'trainer-avatar' };
  const outdated = { dataset: { trainerAvatar: 'old-photo-url' }, className: 'trainer-avatar' };
  let avatars = [first, duplicate, outdated];
  const replacements = ['same-photo', 'same-photo', 'new-photo-url'].map((key, index) => ({
    dataset: { trainerAvatar: key }, className: `trainer-avatar${index === 0 ? ' is-large' : ''}`,
    replaceWith(previous) { avatars[avatars.indexOf(this)] = previous; }
  }));
  const root = {
    querySelectorAll() { return avatars.slice(); },
    set innerHTML(value) { this.markup = value; avatars = replacements.slice(); }
  };
  context.avatarRoot = root;
  vm.runInContext("trainerRenderPreservingAvatars(avatarRoot, 'new screen')", context);
  assert.equal(root.markup, 'new screen');
  assert.equal(avatars[0], first);
  assert.equal(avatars[0].image, image);
  assert.equal(avatars[0].className, 'trainer-avatar is-large');
  assert.equal(avatars[1], duplicate);
  assert.equal(avatars[2], replacements[2]);
  assert.notEqual(avatars[2], outdated);
});

test('инициалы появляются только если недоступны и фото, и дефолтное изображение', () => {
  const { context } = fixture();
  vm.runInContext(uiSource, context);
  const initials = { hidden: true };
  const images = [];
  const avatar = { querySelector: selector => selector === 'img' ? images[0] : initials };
  for (let index = 0; index < 2; index++) images.push({
    parentElement: avatar,
    remove() { images.splice(images.indexOf(this), 1); }
  });
  context.failedAvatarImage = images[1];
  vm.runInContext('trainerAvatarImageFailed(failedAvatarImage)', context);
  assert.equal(initials.hidden, true);
  context.failedAvatarImage = images[0];
  vm.runInContext('trainerAvatarImageFailed(failedAvatarImage)', context);
  assert.equal(initials.hidden, false);
});

test('сохранённое демо получает пол для аватаров без перезаписи ответов и фотографий', () => {
  const { context, store, storage, records } = fixture();
  delete store.client('alexander').questionnaire;
  store.client('maria').questionnaire = { sex: 'unspecified', age: '29' };
  store.client('maria').avatarUrl = 'https://example.com/maria.jpg';
  records.set('trenzo-trainer-demo-v1:test', JSON.stringify(store.state));
  const restored = vm.runInContext('createTrainerStore()', context);
  restored.load(storage, 'test');
  assert.equal(restored.client('alexander').questionnaire.sex, 'male');
  assert.equal(restored.client('maria').questionnaire.sex, 'unspecified');
  assert.equal(restored.client('maria').questionnaire.age, '29');
  assert.equal(restored.client('maria').avatarUrl, 'https://example.com/maria.jpg');
});

test('шапка клиента показывает тег, вес и срок занятий; срок форматируется календарно', () => {
  const { context } = fixture();
  vm.runInContext(uiSource, context);
  const evaluate = expression => vm.runInContext(expression, context);
  evaluate("trainerUI.route = { page: 'client', id: 'alexander' }");
  const card = evaluate('trainerClient()');
  assert.match(card, /Александр Иванов/);
  const profileHeader = card.slice(0, card.indexOf('</section>'));
  assert.doesNotMatch(profileHeader, /trainer-client-status|Перегруз/);
  assert.match(card, /# Тег:/);
  assert.match(card, /Снижение веса/);
  assert.match(card, /Изменить тег/);
  assert.match(card, /82,4 кг → цель 79,0 кг/);
  assert.match(card, /Занимается: 1 нед/);
  assert.doesNotMatch(card, /data-action="back"/);
  assert.match(card, /Обзор/);
  assert.equal(evaluate("trainerClientTenure({ joinedOn: '2026-10-10' }, '2026-10-17')"), '1 нед');
  assert.equal(evaluate("trainerClientTenure({ joinedOn: '2026-09-12' }, '2026-10-17')"), '1 мес');
  assert.equal(evaluate("trainerClientTenure({ joinedOn: '2026-08-17' }, '2026-10-17')"), '1 мес 4 нед');
  assert.equal(evaluate("trainerClientTenure({ joinedOn: '2025-08-09' }, '2026-10-17')"), '1 г 2 нед');
  assert.equal(evaluate("trainerClientTenure({ joinedOn: '2026-10-06' }, '2026-10-17')"), '2 нед');
  assert.doesNotMatch(evaluate("trainerClientTenure({ joinedOn: '2026-10-08' }, '2026-10-17')"), /дн/);
});

test('свайп назад с левого края срабатывает только для горизонтального жеста при наличии истории', () => {
  const { context } = fixture();
  vm.runInContext(uiSource, context);
  const evaluate = expression => vm.runInContext(expression, context);
  assert.equal(evaluate('trainerShouldHandleBackSwipe(20, 100, 100, 120, 1)'), true);
  assert.equal(evaluate('trainerShouldHandleBackSwipe(40, 100, 130, 100, 1)'), false);
  assert.equal(evaluate('trainerShouldHandleBackSwipe(20, 100, 100, 180, 1)'), false);
  assert.equal(evaluate('trainerShouldHandleBackSwipe(20, 100, 100, 100, 0)'), false);
  assert.equal(evaluate('trainerShouldHandleBackSwipe(20, 100, 100, 100, 1, true)'), false);
});

test('обзор клиента сводит тренировки, питание, вес, систему и дату следующего отчёта', () => {
  const { context } = fixture();
  vm.runInContext(uiSource, context);
  const evaluate = expression => vm.runInContext(expression, context);
  const summary = evaluate("trainerClientOverview(trainerStore.client('alexander'), Date.parse('2026-10-16T09:00:00Z'))");
  assert.match(summary, /<strong>AI TRENZO<\/strong>/);
  assert.match(summary, /недельный отчёт/);
  assert.match(summary, /Проверить отчёт/);
  assert.doesNotMatch(summary, /Разобрать неделю|недельный разбор/);
  assert.match(summary, /Текущая неделя/);
  assert.match(summary, /11\.10\.2026 — 17\.10\.2026/);
  assert.match(summary, /Текущая неделя[\s\S]*?trainer-current-week-range/);
  const metricOrder = ['Тренировки', 'Статус', 'Соблюдение питания', 'Система тренировок', 'Изменение веса', 'Следующий отчёт'];
  const metricPositions = metricOrder.map(label => summary.indexOf(`>${label}<`));
  assert.ok(metricPositions.every(position => position >= 0));
  assert.deepEqual(metricPositions, [...metricPositions].sort((a, b) => a - b));
  assert.match(summary, /Тренировки[\s\S]*?3 из 3/);
  assert.match(summary, /Статус[\s\S]*?Перегруз/);
  assert.match(summary, /Соблюдение питания[\s\S]*?91%/);
  assert.match(summary, /Изменение веса[\s\S]*?−400 г/);
  assert.match(summary, /Система тренировок[\s\S]*?Full Body/);
  assert.match(summary, /Следующий отчёт[\s\S]*?18\.10\.2026/);
  assert.doesNotMatch(summary, /Средний RPE/);
  assert.equal(evaluate("trainerProgramSystem(trainerStore.clientProgram('ilya'))"), 'Сплит');
  assert.equal(evaluate("trainerOverviewWeightChange(1.2)"), '+1,2 кг');
  assert.equal(evaluate("trainerOverviewWeightChange(-0.9)"), '−900 г');
  const noNutrition = evaluate("trainerClientOverview(trainerStore.client('maxim'), Date.parse('2026-10-16T09:00:00Z'))");
  assert.match(noNutrition, /Соблюдение питания[\s\S]*?Нет данных/);
});

test('навигация показывает Отчёты, а обзор клиента отдельно считает входящие отчёты', () => {
  const { context } = fixture();
  vm.runInContext(uiSource, context);
  const evaluate = expression => vm.runInContext(expression, context);
  const nav = evaluate("trainerUI.route = { page: 'reviews' }; trainerNavigation()");
  assert.match(nav, />Отчёты</);
  assert.doesNotMatch(nav, />Разборы</);

  evaluate("trainerUI.route = { page: 'client', id: 'alexander', tab: 'overview' }");
  const alexander = evaluate('trainerClient()');
  assert.match(alexander, /Неразобранные отчёты<span class="trainer-count">0<\/span>/);
  assert.match(alexander, /Новых отчётов от клиента пока нет/);
  assert.doesNotMatch(alexander, /trainer-link-card[\s\S]*?Память TRENZO/);

  evaluate("trainerUI.route = { page: 'client', id: 'ekaterina', tab: 'overview' }");
  const ekaterina = evaluate('trainerClient()');
  assert.match(ekaterina, /Неразобранные отчёты<span class="trainer-count">1<\/span>/);
  assert.match(ekaterina, /Отчёт недели/);

  evaluate("trainerUI.route = { page: 'client', id: 'alexander', tab: 'reports' }");
  const reports = evaluate('trainerClient()');
  assert.match(reports, /Следующий отчёт[\s\S]*?18\.10\.2026/);
  assert.match(reports, /История отчётов/);
  assert.doesNotMatch(reports, /Память TRENZO/);
});

test('анкета открывается из шапки клиента, а отчёты переключаются на ожидающий и архивный режимы', () => {
  const { context, store } = fixture();
  vm.runInContext(uiSource, context);
  const evaluate = expression => vm.runInContext(expression, context);

  evaluate("trainerUI.route = { page: 'client', id: 'alexander', tab: 'overview' }");
  const clientHeader = evaluate('trainerClient()');
  assert.match(clientHeader, /data-action="client-questionnaire"[^>]*>[^<]*<svg/);
  evaluate("trainerUI.route = { page: 'client-questionnaire', id: 'alexander' }");
  const answers = evaluate(`(() => {
    const client = trainerStore.client('alexander');
    client.questionnaire = { age: '29', sex: 'male', height: '178', weight: '82.4', goal: 'lose', targetWeight: '79', experience: '1to3', frequency: '3', nutritionTracking: 'regular', meals: '4', nutritionNotes: 'Не ем рыбу' };
    return trainerClientQuestionnaire(client);
  })()`);
  assert.match(answers, /Анкета клиента/);
  assert.match(answers, /29 лет/);
  assert.match(answers, /Мужской/);
  assert.match(answers, /Снизить вес/);
  assert.match(answers, /3 раза в неделю/);
  assert.match(answers, /Не ем рыбу/);
  assert.doesNotMatch(answers, /data-action="memory"/);

  evaluate(`trainerStore.state.weeklyReviews.push(
    { id: 'client-report-old', clientId: 'alexander', start: '2026-09-27', end: '2026-10-03', status: 'approved' },
    { id: 'client-report-new', clientId: 'alexander', start: '2026-10-04', end: '2026-10-10', status: 'new' }
  )`);
  evaluate("trainerUI.route = { page: 'client', id: 'alexander', tab: 'reports' }");
  const reportMarkup = evaluate('trainerClient()');
  assert.match(reportMarkup, /Неразобранные отчёты<span class="trainer-count">1<\/span>/);
  assert.match(reportMarkup, /data-action="review" data-id="client-report-new"/);
  assert.match(reportMarkup, /data-report-history-week/);
  assert.match(reportMarkup, /Неделя 2 · 04\.10\.2026 — 10\.10\.2026/);
  assert.doesNotMatch(reportMarkup, /Память TRENZO/);
  vm.runInContext("trainerUI.reportHistoryWeeks.alexander = '2026-09-27'", context);
  assert.match(evaluate('trainerClient()'), /Неделя 1 · 27\.09\.2026 — 03\.10\.2026/);
});

test('демо тренировок показывает две выполненные сессии и заполненную историю', () => {
  const { context } = fixture();
  vm.runInContext(uiSource, context);
  const evaluate = expression => vm.runInContext(expression, context);
  const demo = evaluate(`(() => {
    const client = trainerStore.client('alexander');
    const week = trainerTrainingWeek(client);
    const history = trainerTrainingHistory(client);
    return { markup: trainerClientTraining(client), week, history };
  })()`);
  assert.equal(demo.week.workouts.length, 2);
  assert.match(demo.markup, /Текущая неделя[\s\S]*?2 из 3/);
  assert.match(demo.markup, /11\.10\.2026 — 17\.10\.2026/);
  assert.ok(demo.history.selected.workouts.length > 0);
  assert.match(demo.markup, /Факт клиента: 80,0 кг ×/);
  assert.doesNotMatch(demo.markup, /Изменить программу/);
});

test('прогресс показывает пять нужных замеров, до пяти рекордов и серию полных недель', () => {
  const { context } = fixture();
  vm.runInContext(uiSource, context);
  const evaluate = expression => vm.runInContext(expression, context);
  const measurements = evaluate(`(() => {
    const client = trainerStore.client('anna');
    client.measurements.neck_cm = 32;
    client.measurementHistory.push({ measured_on: '2026-10-16', chest_cm: 102 });
    return trainerClientProgress(client);
  })()`);
  assert.match(measurements, /Последние замеры/);
  assert.match(measurements, /Плечи/);
  assert.match(measurements, /Бицепс/);
  assert.match(measurements, /Талия/);
  assert.match(measurements, /Грудь[\s\S]*?102,0 см/);
  assert.match(measurements, /Бёдра/);
  assert.doesNotMatch(measurements, /Бедро|thigh_cm|Шея|neck_cm|trainer-metrics-grid/);

  const records = evaluate(`(() => {
    const client = trainerStore.client('anna');
    client.records = Array.from({ length: 7 }, (_, index) => ({ exercise: 'Упражнение ' + index, value: (50 + index) + ' кг × 8' }));
    return trainerClientProgress(client);
  })()`);
  assert.match(records, /Топ-5 личных рекордов/);
  assert.equal((records.match(/Упражнение \d/g) || []).length, 5);
  assert.match(records, /Недели без пропусков/);
  assert.match(records, /Все запланированные тренировки выполнены|Нет завершённых недель/);

  const streak = evaluate(`(() => {
    const client = trainerStore.client('alexander');
    client.joinedOn = '2026-09-01';
    client.workouts = [];
    const activeStart = trainerTrainingWeek(client).start;
    for (const start of ['2026-10-04', '2026-09-27']) {
      const plan = trainerPlanAt(client, start);
      client.weekPlans.push({ start, plan });
      plan.sessions.forEach((session, index) => client.workouts.push({ id: start + '-' + index, sessionId: session.id, workout_date: trainerShiftDate(start, index + 1), title: session.title, exercises: [] }));
    }
    const count = trainerWorkoutStreak(client).count;
    client.workouts = client.workouts.filter(workout => !workout.workout_date.startsWith('2026-10'));
    return { count, afterMissedWeek: trainerWorkoutStreak(client).count, activeStart };
  })()`);
  assert.equal(streak.count, 2);
  assert.equal(streak.afterMissedWeek, 0);
  assert.equal(streak.activeStart, '2026-10-11');

  const partialTenure = evaluate("(() => { const client = trainerStore.client('alexander'); client.joinedOn = '2026-10-10'; return trainerWorkoutStreak(client).count; })()");
  assert.equal(partialTenure, 0);
});

test('питание разделяет недельный план, дневник текущей недели и историю', () => {
  const { context } = fixture();
  vm.runInContext(uiSource, context);
  const result = vm.runInContext(`(() => {
    const client = trainerStore.client('alexander');
    const markup = trainerClientNutrition(client);
    const history = trainerNutritionHistory(client);
    return { markup, history, targets: client.nutritionTarget };
  })()`, context);
  assert.match(result.markup, /Ежедневный план на неделю/);
  assert.match(result.markup, /Калории[\s\S]*?2500 ккал/);
  assert.match(result.markup, /Белки[\s\S]*?160 г/);
  assert.match(result.markup, /Жиры[\s\S]*?75 г/);
  assert.match(result.markup, /Углеводы[\s\S]*?295 г/);
  assert.match(result.markup, /Выполнение цели[\s\S]*?Нет данных за текущую неделю/);
  assert.equal((result.markup.match(/class="trainer-nutrition-day/g) || []).length, 14);
  assert.equal((result.markup.match(/Нет записи/g) || []).length, 7);
  assert.match(result.markup, /11\.10\.2026 — 17\.10\.2026/);
  assert.match(result.markup, /История питания/);
  assert.match(result.markup, /data-nutrition-history-week/);
  assert.match(result.markup, /Неделя 1 · 04\.10\.2026 — 10\.10\.2026/);
  assert.match(result.markup, /Б 142 · Ж 70 · У 275 г/);
  assert.doesNotMatch(result.markup, /Память TRENZO|Недельные отчёты|Первый отчёт по неделе/);

  vm.runInContext("trainerUI.nutritionHistoryWeeks.alexander = '2026-10-04'", context);
  assert.equal(vm.runInContext("trainerNutritionHistory(trainerStore.client('alexander')).selected.entries.length", context), 7);
  const emptyClient = vm.runInContext("trainerClientNutrition(trainerStore.client('maxim'))", context);
  assert.match(emptyClient, /История появится после первой записи питания/);
  assert.match(emptyClient, /7/);
});

test('старое сохранённое демо без тренировок получает демонстрационные записи', () => {
  const { context, store, storage, records } = fixture();
  vm.runInContext(uiSource, context);
  const client = store.client('alexander');
  const weekStart = vm.runInContext('trainerWeeklyPeriod(trainerDefaultReviewSchedule).reviewDate', context);
  const weekEnd = vm.runInContext('trainerShiftDate(trainerWeeklyPeriod(trainerDefaultReviewSchedule).reviewDate, 6)', context);
  client.workouts = client.workouts.filter(item => item.workout_date < weekStart || item.workout_date > weekEnd);
  records.set('trenzo-trainer-demo-v1:test', JSON.stringify(store.state));
  const restored = vm.runInContext('createTrainerStore()', context);
  restored.load(storage, 'test');
  context.restoredStore = restored;
  assert.equal(vm.runInContext('trainerTrainingWeek(restoredStore.client("alexander")).workouts.length', context), 2);
});

test('тренировки показывают текущий план с фактом клиента и историю с фильтром по неделям', () => {
  const { context } = fixture();
  vm.runInContext(uiSource, context);
  const evaluate = expression => vm.runInContext(expression, context);
  const weekBoundary = evaluate(`(() => {
    const client = trainerStore.client('alexander');
    return JSON.stringify([
      trainerTrainingWeek(client, Date.parse('2026-10-18T11:50:00Z')).start,
      trainerTrainingWeek(client, Date.parse('2026-10-18T15:30:00Z')).start
    ]);
  })()`);
  assert.deepEqual(JSON.parse(weekBoundary), ['2026-10-11', '2026-10-18']);
  const current = evaluate(`(() => {
    const client = trainerStore.client('alexander');
    client.joinedOn = '2026-10-04';
    const week = trainerTrainingWeek(client);
    client.workouts = client.workouts.filter(item => item.workout_date < week.start || item.workout_date > week.end);
    week.plan.sessions.slice(0, 2).forEach((session, index) => {
      const exercise = session.exercises[0];
      client.workouts.push({ id: 'current-' + index, sessionId: session.id, title: session.title, workout_date: index ? '2026-10-14' : '2026-10-12', rpe: 7,
        exercises: [{ name: exercise.name, sets: [{ weight_kg: exercise.weightKg, reps: 8 }] }] });
    });
    return trainerClientTraining(client);
  })()`);
  assert.match(current, /Текущая неделя[\s\S]*?2 из 3/);
  assert.equal((current.match(/class="trainer-card trainer-training-day"/g) || []).length, 3);
  assert.match(current, /Выполнена · 12 окт\./);
  assert.match(current, /Факт клиента: 80,0 кг × 8/);
  assert.match(current, /План: [^<]+/);
  assert.equal((current.match(/<small>План:/g) || []).length, 5);
  assert.match(current, /Факт клиента: —/);
  assert.match(current, /История тренировок/);
  assert.match(current, /data-training-history-week/);
  assert.match(current, /Неделя 1 · 04\.10\.2026 — 10\.10\.2026/);

  evaluate("trainerUI.trainingHistoryWeeks.alexander = '2026-10-04'");
  const firstWeek = evaluate("trainerTrainingHistory(trainerStore.client('alexander'))");
  assert.equal(firstWeek.selected.start, '2026-10-04');
  assert.equal(firstWeek.selected.workouts.length, 3);
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
  const pages = ['trainerToday()', 'trainerClients()', 'trainerReviews()', 'trainerPrograms()', 'trainerProfile()', 'trainerAnalytics()', 'trainerAI()'];
  for (const page of pages) assert.equal(typeof evaluate(page), 'string');
  for (const tab of ['overview', 'training', 'nutrition', 'progress', 'reports']) {
    evaluate(`trainerUI.route = {page: 'client', id: 'alexander', tab: '${tab}'}`);
    assert.equal(typeof evaluate('trainerClient()'), 'string');
  }
  evaluate("trainerUI.route = {page: 'review', id: 'recovery'}"); assert.match(evaluate('trainerReview()'), /Подтвердить/);
  evaluate("trainerUI.route = {page: 'memory', id: 'alexander'}"); assert.match(evaluate('trainerMemory()'), /Последние решения/);
  evaluate("trainerUI.route = {page: 'program', id: 'fullbody'}"); assert.match(evaluate('trainerProgram()'), /Жим лёжа/);
  evaluate("trainerUI.route = {page: 'program', id: 'fullbody', clientId: 'alexander'}");
  const clientProgram = evaluate('trainerProgram()');
  assert.match(clientProgram, /value="4" selected>Неделя 5/);
  assert.match(clientProgram, /6 недель · 45 мин на тренировку · Тренажёрный зал/);
  assert.match(clientProgram, /Редактировать/);
  assert.doesNotMatch(clientProgram, /Назначить подопечному|Назначена подопечным|Базовая сила и состав тела/);
  assert.match(evaluate('trainerNavigation()'), /data-page="clients" aria-current="page"/);
  const root = { innerHTML: '', querySelectorAll: () => [] };
  context.document = { getElementById: () => root };
  context.window = { scrollY: 0, scrollTo() {} };
  evaluate('trainerRender()');
  assert.match(root.innerHTML, /class="trainer-navigation"/);
  evaluate("trainerUI.route = {page: 'program', id: 'fullbody'}");
  assert.match(evaluate('trainerProgram()'), /Назначить подопечному/);
  assert.match(evaluate('trainerNavigation()'), /data-page="programs" aria-current="page"/);
  evaluate("trainerStore.assignProgram('upperlower', 'anna'); trainerUI.route = {page: 'memory', id: 'anna'}");
  assert.match(evaluate('trainerMemory()'), /4 раза в неделю/);
  evaluate("trainerUI.route = {page: 'program-new', mode: 'ai'}"); assert.match(evaluate('trainerProgramNew()'), /Собрать программу/);
  evaluate("trainerUI.draft = trainerCopy(trainerStore.program('fullbody'))"); assert.match(evaluate('trainerProgramEditor()'), /Сохранить программу/);
  evaluate("trainerUI.route = {page: 'today'}");
  assert.match(evaluate('trainerHeader()'), /class="logo"/);
  assert.match(evaluate('trainerHeader()'), /class="trainer-profile-shortcut"/);
  evaluate("trainerUI.route = {page: 'clients'}");
  assert.match(evaluate('trainerHeader()'), /trainer-clients-add/);
  assert.doesNotMatch(evaluate('trainerHeader()'), /class="logo"|trainer-profile-shortcut/);
  evaluate("trainerUI.route = {page: 'reviews'}");
  assert.equal(evaluate('trainerHeader()'), '');
  evaluate("trainerUI.route = {page: 'profile'}");
  assert.equal(evaluate('trainerHeader()'), '');
  evaluate("trainerUI.route = {page: 'client', id: 'alexander'}");
  assert.equal(evaluate('trainerHeader(\'Подопечный\')'), '');
  assert.match(evaluate('trainerNavigation()'), /data-page="analytics"/);
  assert.doesNotMatch(evaluate('trainerNavigation()'), /data-page="analytics"[^>]*aria-current/);
  assert.doesNotMatch(evaluate('trainerNavigation()'), /data-page="profile"/);
  evaluate("trainerUI.route = {page: 'analytics'}");
  assert.match(evaluate('trainerNavigation()'), /data-page="analytics" aria-current="page"/);
  assert.match(evaluate('trainerAnalytics()'), /Здесь будет аналитика/);
  const factsCount = evaluate("trainerStore.review('plateau').facts.length");
  evaluate("trainerAIAnswer('Что изменилось у Марии за месяц?')");
  assert.equal(evaluate("trainerStore.review('plateau').facts.length"), factsCount);
  evaluate("trainerStore.reset('empty')");
  for (const page of pages) assert.equal(typeof evaluate(page), 'string');
});

test('профиль тренера показывает личные данные, специализацию, образование и регалии', () => {
  const { context, storage } = fixture();
  vm.runInContext(uiSource, context);
  const evaluate = expression => vm.runInContext(expression, context);
  context.profileStorage = storage;
  evaluate("trainerStore.load(profileStorage, 'test')");
  const initial = evaluate('trainerProfile()');
  assert.match(initial, /client-avatar-male\.png/);
  assert.doesNotMatch(initial, /Ответы из анкеты/);
  assert.match(initial, /Формат работы/);
  assert.match(initial, /Специализация/);
  assert.match(initial, /Не указана\./);
  assert.match(initial, /Образование/);
  assert.match(initial, /Регалии/);
  assert.doesNotMatch(initial, /Настройки аккаунта|Расписание разборов|Данные примера|TRENZO AI/);

  evaluate("trainerUI.modal = { type: 'edit-profile' }");
  const editModal = evaluate('trainerModalMarkup()');
  assert.doesNotMatch(editModal, /Ответы из анкеты/);
  assert.match(editModal, /На чём специализируется тренер/);
  assert.match(editModal, /Каждый пункт — с новой строки/);
  assert.match(editModal, /textarea[^>]*name="specializations"/);
  assert.match(editModal, /select name="sex"/);
  assert.doesNotMatch(editModal, /type="checkbox"/);

  evaluate("trainerStore.saveProfile({ name: 'Анна', surname: 'Тренерова', sex: 'female', trainingFormat: 'Онлайн и офлайн', experience: '7 лет', specializations: 'Реабилитация\\nПохудение\\n\\nПодготовка к выступлению', education: 'Университет\\nКурс тренеров', regalia: 'КМС\\nЧемпион региона' })");
  const updated = evaluate('trainerProfile()');
  assert.match(updated, /Анна Тренерова/);
  assert.match(updated, /client-avatar-female\.png/);
  evaluate("trainerUI.route = {page: 'today'}");
  assert.match(evaluate('trainerHeader()'), /client-avatar-female\.png/);
  assert.match(updated, /Онлайн и офлайн/);
  assert.match(updated, /7 лет/);
  assert.match(updated, /Реабилитация/);
  assert.match(updated, /Похудение/);
  assert.match(updated, /Курс тренеров/);
  assert.match(updated, /Чемпион региона/);

  const restored = vm.runInContext('createTrainerStore()', context);
  restored.load(storage, 'test');
  assert.equal(restored.state.trainer.sex, 'female');
  assert.equal(restored.state.trainer.education, 'Университет\nКурс тренеров');
  assert.equal(restored.state.trainer.regalia, 'КМС\nЧемпион региона');
  assert.deepEqual(Array.from(restored.state.trainer.specializations), ['Реабилитация', 'Похудение', 'Подготовка к выступлению']);
  assert.throws(() => restored.saveProfile({ name: 'Анна', specializations: 'x'.repeat(1001) }), /длину специализаций/);
  assert.throws(() => restored.saveProfile({ name: 'Анна', sex: 'unknown' }), /Выбери пол/);
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
