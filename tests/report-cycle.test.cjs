const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function fixture({ demo = false } = {}) {
  const context = vm.createContext({ console, URL });
  vm.runInContext("Date.now = () => Date.parse('2026-10-18T09:00:00Z')", context);
  for (const name of ['trainer-data', 'report-cycle', 'trainer', 'report-ui']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, `../screens/${name}.js`), 'utf8'), context);
  }
  const run = source => vm.runInContext(source, context);
  const records = new Map();
  context.storage = { getItem: key => records.get(key) || null, setItem: (key, value) => records.set(key, value) };
  run(`trainerStore.load(storage, 'reports-test'); ${demo ? 'trenzoEnsureReports()' : 'trenzoReports.ensure()'}`);
  const service = run('trenzoReports'), store = run('trainerStore');
  const cycle = client => service.list().find(item => item.clientId === client && item.start === '2026-10-11');
  const answers = { wellbeing: 4, energy: 'normal', recovery: 'good', appetite: 'comfortable', pain: 'no' };
  return { context, run, service, store, cycle, answers, records };
}

test('ожидаемые периоды не считаются отправленными; отправка и закрытие меняют badge', () => {
  const { service, cycle, answers, run } = fixture();
  assert.equal(service.pending(), 0);
  assert.doesNotMatch(run('trainerNavigation()'), /report-navigation-count/);
  const report = service.submit(cycle('alexander').id, answers);
  assert.equal(service.pending(), 1);
  assert.match(run('trainerNavigation()'), /Ожидают проверки: 1/);
  service.close(report.id, service.createTrainerDraft(report.id, 'keep'));
  assert.equal(service.pending(), 0);
});

test('демо содержит четыре входящих, ожидаемые/просроченные и архив; повторный вход не дублирует', () => {
  const { service, run, cycle } = fixture({ demo: true });
  assert.equal(service.pending(), 4);
  assert.equal(service.overdue(cycle('maria')), false);
  assert.equal(service.overdue(cycle('ilya')), true);
  assert.equal(service.list().filter(item => item.resolution).length, 3);
  const before = JSON.stringify(service.list());
  run('trenzoEnsureReports(); trenzoEnsureReports()');
  assert.equal(JSON.stringify(service.list()), before);
  const index = run('trenzoReportsIndex()');
  assert.equal((index.match(/data-action="report-filter"/g) || []).length, 3);
  assert.match(index, /7 клиентов · 5 сдали · 1 ожидаются · 1 просрочили/);
  assert.match(index, /Демонстрация цикла/);
});

test('клиентские вопросы только субъективные и условные; скрытые ответы не отправляются', () => {
  const { service, store, cycle, answers } = fixture();
  const id = cycle('alexander').id;
  const keys = service.questions(id).map(item => item.key);
  assert.ok(keys.includes('appetite'));
  for (const key of ['weight', 'calories', 'steps', 'workouts', 'painDetails', 'recoveryDetails']) assert.ok(!keys.includes(key));
  const dynamic = service.questions(id, { pain: 'yes', energy: 'low' }).map(item => item.key);
  assert.ok(dynamic.includes('painDetails') && dynamic.includes('recoveryDetails'));
  assert.throws(() => service.submit(id, { ...answers, pain: 'yes' }), /дискомфорт/);
  const result = service.submit(id, { ...answers, painDetails: 'Скрытый старый ответ', calories: 9999, weight: 42 });
  assert.equal(result.submission.answers.painDetails, undefined);
  assert.equal(result.submission.answers.calories, undefined);
  const maria = store.client('maria');
  maria.weekPlans.push({ start: cycle('maria').start, plan: { ...service.facts(cycle('maria').id).plan, nutritionTarget: null } });
  assert.ok(!service.questions(cycle('maria').id).some(item => item.key === 'appetite'));
});

test('валидация ответов не теряет черновик; нельзя отправить незавершённую неделю', () => {
  const { service, cycle, answers } = fixture();
  const id = cycle('maria').id;
  service.saveClientDraft(id, { comment: 'Сохранить меня' });
  assert.throws(() => service.submit(id, { ...answers, wellbeing: 6 }), /Ответьте/);
  assert.equal(service.get(id).clientDraft.comment, 'Сохранить меня');
  assert.throws(() => service.submit(id, { ...answers, comment: 'x'.repeat(2001) }), /2000/);
  assert.throws(() => service.submit(id, answers, Date.parse('2026-10-17T09:00:00Z')), /не завершён/);
  service.submit(id, answers);
  assert.equal(service.get(id).clientDraft, undefined);
});

test('снимок фактов и демо-анализа неизменен после отправки, повторная отправка идемпотентна', () => {
  const { service, cycle, answers, store } = fixture();
  const id = cycle('alexander').id;
  const sent = service.submit(id, answers), before = JSON.stringify(service.facts(id));
  const analysis = JSON.stringify(service.analyze(id));
  store.client('alexander').weights.push({ measured_on: '2026-10-17', weight_kg: 50 });
  store.client('alexander').goal = 'Другая цель';
  store.client('alexander').workouts = [];
  assert.equal(JSON.stringify(service.facts(id)), before);
  assert.equal(JSON.stringify(service.analyze(id)), analysis);
  assert.equal(JSON.stringify(service.submit(id, { ...answers, pain: 'yes' })), JSON.stringify(sent));
  const tampered = service.get(id); tampered.submission.answers.wellbeing = 1;
  assert.throws(() => store.saveReportCycle(tampered), /нельзя переписать/);
  const detached = service.facts(id); detached.client.name = 'Другое имя';
  assert.notEqual(service.facts(id).client.name, detached.client.name);
});

test('питание оценивается по записанным дням; старый вес не подменяет замер недели', () => {
  const { service, store, cycle } = fixture();
  const client = store.client('alexander'), report = cycle('alexander');
  client.weights = [{ measured_on: '2026-10-10', weight_kg: 83 }, { measured_on: '2026-10-18', weight_kg: 80 }];
  client.nutrition = [{ report_date: '2026-10-12', calories: 2500 }, { report_date: '2026-10-12', calories: 2000 }];
  const data = service.facts(report.id).current;
  assert.equal(data.weight.current, null);
  assert.equal(data.weight.delta, null);
  assert.equal(data.nutrition.days, 1);
  assert.equal(data.nutrition.adherence, 80);
  assert.equal(data.sleepMinutes, null);
});

test('закрыть можно только отправленный отчёт с явным решением и ответом', () => {
  const { service, cycle, answers } = fixture();
  const id = cycle('alexander').id;
  assert.throws(() => service.close(id, {}), /не отправлен/);
  service.submit(id, answers);
  assert.throws(() => service.close(id, {}), /Примите решение/);
  const draft = service.createTrainerDraft(id, 'accept');
  assert.throws(() => service.close(id, { ...draft, feedback: ' ' }), /ответ клиенту/);
  assert.throws(() => service.close(id, { ...draft, nextPlan: {} }), /план следующего/);
  assert.equal(service.status(service.get(id)), 'submitted');
});

test('закрытие сохраняет план, ответ и память ровно один раз; архив нельзя переписать', () => {
  const { service, cycle, answers, store } = fixture();
  const id = cycle('alexander').id;
  service.submit(id, answers);
  const programBefore = JSON.stringify(store.program('fullbody'));
  const draft = service.createTrainerDraft(id, 'keep');
  draft.feedback = 'Продолжаем план. Спасибо!';
  const result = service.close(id, draft);
  assert.equal(result.resolution.changes.length, 0);
  assert.equal(result.resolution.nextPlan.effectiveOn, '2026-10-18');
  assert.equal(result.resolution.feedback, draft.feedback);
  service.close(id, { ...draft, feedback: 'Дубликат' });
  assert.equal(store.client('alexander').decisions.filter(item => item.reviewId === id).length, 1);
  assert.equal(store.client('alexander').nextPeriodPlans.filter(item => item.reportId === id).length, 1);
  assert.equal(JSON.stringify(store.program('fullbody')), programBefore);
  assert.throws(() => store.saveReportCycle(result), /Закрытый/);
});

function progressionFixture() {
  const f = fixture(), client = f.store.client('alexander'), cycle = f.cycle('alexander');
  const plan = f.service.facts(cycle.id).plan;
  const session = plan.sessions[0], exercise = session.exercises[0];
  client.workouts = [
    { workout_date: '2026-10-05', title: session.title, sessionId: session.id, rpe: 7, exercises: [{ name: exercise.name, sets: [{ weight_kg: exercise.weightKg - 2.5, reps: 8 }] }] },
    { workout_date: '2026-10-12', title: session.title, sessionId: session.id, rpe: 7, exercises: [{ name: exercise.name, sets: [{ weight_kg: exercise.weightKg, reps: 8 }] }] }
  ];
  f.service.submit(cycle.id, f.answers);
  return { ...f, id: cycle.id, exercise };
}

test('принятая численная рекомендация меняет только следующий план своего клиента', () => {
  const { service, store, id, exercise } = progressionFixture();
  const draft = service.createTrainerDraft(id, 'edit');
  const choice = draft.choices.find(item => item.id === 'progression');
  assert.ok(choice);
  choice.action.to = exercise.weightKg + 1;
  const beforeOther = JSON.stringify(store.client('maria'));
  const result = service.close(id, draft);
  assert.equal(result.resolution.changes[0].to, exercise.weightKg + 1);
  const next = store.client('alexander').weekPlans.find(item => item.start === '2026-10-18');
  assert.equal(next.plan.sessions[0].exercises[0].weightKg, exercise.weightKg + 1);
  assert.equal(service.facts(id).plan.sessions[0].exercises[0].weightKg, exercise.weightKg);
  assert.equal(JSON.stringify(store.client('maria')), beforeOther);
});

test('отклонённая рекомендация и «ничего не менять» не меняют рабочие веса', () => {
  for (const mode of ['edit', 'keep']) {
    const { service, id } = progressionFixture();
    const draft = service.createTrainerDraft(id, mode);
    draft.choices.find(item => item.id === 'progression').accepted = mode === 'keep';
    assert.equal(service.close(id, draft).resolution.changes.length, 0);
  }
});

test('некорректный вес не закрывает отчёт и не делает частичных изменений', () => {
  const { service, store, id } = progressionFixture();
  const draft = service.createTrainerDraft(id, 'edit');
  draft.choices.find(item => item.id === 'progression').action.to = 1001;
  const before = JSON.stringify(store.state);
  assert.throws(() => service.close(id, draft), /рабочий вес/);
  assert.equal(JSON.stringify(store.state), before);
});

test('позднее решение применяется к будущему периоду, а не переписывает прошедшие тренировки', () => {
  const { service, cycle, answers } = fixture();
  const id = cycle('alexander').id;
  service.submit(id, answers);
  const result = service.close(id, service.createTrainerDraft(id, 'keep'), Date.parse('2026-10-21T09:00:00Z'));
  assert.equal(result.resolution.nextPlan.effectiveOn, '2026-10-25');
});

test('следующий отчёт знает прошлое решение и задаёт вопрос о прошлом приоритете', () => {
  const { service, cycle, answers, run } = fixture();
  const id = cycle('alexander').id;
  service.submit(id, answers);
  const draft = service.createTrainerDraft(id, 'edit');
  draft.nextPlan.priority = 'Наладить сон';
  service.close(id, draft);
  run("Date.now = () => Date.parse('2026-10-25T09:00:00Z'); trenzoReports.ensure()");
  const next = service.list().find(item => item.clientId === 'alexander' && item.start === '2026-10-18');
  assert.equal(service.facts(next.id).previousDecision.id, id);
  assert.ok(service.questions(next.id).some(item => item.key === 'followUp' && item.label.includes('Наладить сон')));
});

test('черновик клиента, решение тренера и архив переживают перезагрузку localStorage', () => {
  const { service, store, cycle, answers, run } = fixture();
  const maria = cycle('maria').id, alexander = cycle('alexander').id;
  service.saveClientDraft(maria, { comment: 'Продолжу позже' });
  service.submit(alexander, answers);
  const draft = service.createTrainerDraft(alexander, 'edit');
  draft.feedback = 'Мой черновик';
  service.saveDraft(alexander, draft);
  run("const restoredStore = createTrainerStore(); restoredStore.load(storage, 'reports-test'); const restoredReports = createTrenzoReportService(createTrainerDemoReportAdapter(restoredStore))");
  assert.equal(run(`restoredReports.get('${maria}').clientDraft.comment`), 'Продолжу позже');
  assert.equal(run(`restoredReports.get('${alexander}').trainerDraft.feedback`), 'Мой черновик');
  service.close(alexander, draft);
  assert.equal(store.client('alexander').decisions[0].feedback, draft.feedback);
  run("const archiveStore = createTrainerStore(); archiveStore.load(storage, 'reports-test')");
  assert.equal(run(`archiveStore.review('${alexander}').resolution.feedback`), 'Мой черновик');
});

test('клиентский и тренерский интерфейсы разделены; небезопасный текст экранируется', () => {
  const { run, service, cycle, answers, context } = fixture();
  const id = cycle('maria').id;
  run(`trainerUI.route = { page: 'client-report', id: '${id}' }`);
  let markup = run('trenzoClientReportScreen()');
  assert.match(markup, /Уже собрано за неделю/);
  assert.match(markup, /data-form="period-client-report"/);
  assert.doesNotMatch(markup, /name="(?:calories|weight|steps)"/);
  service.submit(id, { ...answers, comment: '<img src=x onerror=alert(1)>' });
  run(`trainerUI.route = { page: 'review', id: '${id}' }`);
  markup = run('trainerReview()');
  for (const title of ['Итог недели', 'Что произошло', 'Что сказал клиент', 'Что заметил TRENZO', 'Предложение TRENZO', 'План следующего периода']) assert.ok(markup.includes(title));
  assert.match(markup, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(markup, /<img src=x/);
  assert.match(markup, /type="submit"[^>]*disabled/);
  const root = { innerHTML: '', querySelectorAll: () => [] };
  context.document = { getElementById: () => root };
  run(`trainerUI.route = { page: 'client-report', id: '${id}' }; trainerRender()`);
  assert.doesNotMatch(root.innerHTML, /class="trainer-navigation"/);
  service.close(id, service.createTrainerDraft(id, 'keep'));
  assert.match(run('trenzoClientReportScreen()'), /Есть ответ тренера/);
});

test('отсутствие хранилища явно отмечается и не блокирует локальный цикл', () => {
  const { run, cycle, service, answers, store } = fixture();
  run("trainerStore.load({ getItem: () => null, setItem: () => { throw Error('Quota') } }, 'quota')");
  service.ensure();
  service.submit(cycle('alexander').id, answers);
  assert.match(store.storageWarning, /Не удалось сохранить/);
});

test('после отсутствия пропущенные периоды догружаются и старые ожидания остаются видимы', () => {
  const { run, service, cycle } = fixture();
  const oldId = cycle('maria').id;
  run("Date.now = () => Date.parse('2026-11-08T09:00:00Z'); trenzoReports.ensure(); trainerStore.state.reportDemoVersion = 1; trenzoReportUI.filter = 'expected'");
  const reports = service.list().filter(item => item.clientId === 'maria');
  assert.equal(reports.length, 4);
  assert.ok(reports.some(item => item.start === '2026-10-18'));
  assert.ok(reports.some(item => item.start === '2026-10-25'));
  assert.ok(run('trenzoReportsIndex()').includes(`data-id="${oldId}"`));
});

test('старый отчёт не перезаписывает более новое решение для той же будущей недели', () => {
  const { service, store, cycle, answers, run } = fixture();
  const newer = cycle('alexander').id, older = 'period-report:alexander:2026-10-04:2026-10-10';
  store.saveReportCycle({ id: older, clientId: 'alexander', kind: 'period-report', version: 1, start: '2026-10-04', end: '2026-10-10', dueOn: '2026-10-11', dueTime: '18:00', timeZone: 'Europe/Moscow' });
  service.submit(older, answers); service.submit(newer, answers);
  run("Date.now = () => Date.parse('2026-10-21T09:00:00Z')");
  service.close(newer, service.createTrainerDraft(newer, 'keep'));
  const before = JSON.stringify(store.state);
  assert.throws(() => service.close(older, service.createTrainerDraft(older, 'keep')), /более новый план/);
  assert.equal(JSON.stringify(store.state), before);
});

test('делегированные обработчики проводят клиентскую форму, решение и ответ без ручного вызова close', () => {
  const { context, run, service, cycle, answers } = fixture();
  run('trainerStore.state.reportDemoVersion = 1');
  const id = cycle('maria').id;
  const root = { innerHTML: '', querySelectorAll: () => [] };
  context.document = { getElementById: () => root };
  context.window = { scrollY: 0, scrollTo() {} };
  context.FormData = class extends Map { constructor(form) { super(Object.entries(form.values)); } };
  const error = { textContent: '' };
  const form = { dataset: { form: 'period-client-report', id }, values: { ...answers, pain: 'yes' }, reportValidity: () => true, querySelector: () => error };
  context.clientForm = form;
  context.answerInput = { closest: () => form, hasAttribute: key => key === 'data-report-answer' };
  run(`trainerUI.route = { page: 'client-report', id: '${id}' }; trainerHandleChange({ target: answerInput })`);
  assert.match(root.innerHTML, /name="painDetails"/);
  run('trainerHandleSubmit({ target: clientForm, preventDefault() {} })');
  assert.match(error.textContent, /дискомфорт/);
  form.values.painDetails = 'Дискомфорт в колене после приседаний';
  run('trainerHandleSubmit({ target: clientForm, preventDefault() {} })');
  assert.equal(service.status(service.get(id)), 'submitted');
  const draft = service.createTrainerDraft(id);
  const values = { nextTraining: draft.nextPlan.training, nextNutrition: draft.nextPlan.nutrition, nextPriority: draft.nextPlan.priority, feedback: draft.feedback };
  draft.choices.forEach(item => { values[`choice-${item.id}`] = 'on'; values[`recommendation-${item.id}`] = item.text; });
  context.trainerForm = { ...form, dataset: { form: 'period-trainer-report', id }, values };
  run('trainerHandleSubmit({ target: trainerForm, preventDefault() {} })');
  assert.match(error.textContent, /Примите решение/);
  context.button = { dataset: { action: 'report-decision', id, mode: 'edit' } };
  run(`trainerUI.route = { page: 'review', id: '${id}' }; trainerHandleClick({ target: { closest: () => button } })`);
  values.feedback = 'Получил сообщение о колене. До уточнения не повышаем нагрузку.';
  context.feedbackInput = { name: 'feedback', closest: () => context.trainerForm, hasAttribute: () => false };
  run('trainerHandleInput({ target: feedbackInput })');
  assert.equal(service.get(id).trainerDraft.feedbackEdited, true);
  run('trainerHandleSubmit({ target: trainerForm, preventDefault() {} })');
  assert.equal(service.status(service.get(id)), 'reviewed');
  assert.equal(service.get(id).resolution.feedback, values.feedback);
});
