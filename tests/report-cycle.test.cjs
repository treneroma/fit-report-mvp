const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function fixture({ demo = false } = {}) {
  const context = vm.createContext({ console, URL });
  vm.runInContext("Date.now = () => Date.parse('2026-10-18T09:00:00Z')", context);
  for (const name of ['trainer-data', 'report-cycle', 'analytics-data', 'trainer', 'report-ui', 'analytics-ui']) {
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
  assert.match(index, /data-value="overdue">Просрочили/);
  assert.doesNotMatch(index, /7 клиентов|5 сдали|ожидаются|Расписание|Сводка|Демонстрация|Разобрать/);
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
  for (const title of ['Что произошло', 'Состояние клиента', 'Питание', 'Тренировки', 'Что заметил TRENZO', 'Предложение TRENZO', 'Следующий тренировочный цикл', 'Сформировать ответ клиенту']) assert.ok(markup.includes(title));
  assert.doesNotMatch(markup, /Итог недели|План следующего периода|Экран клиента|Прошлый период:|Средний сон|>Активность</);
  assert.match(markup, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(markup, /<img src=x/);
  assert.match(markup, /data-action="report-generate-response"[^>]*disabled/);
  assert.doesNotMatch(markup, /type="submit"/);
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
  assert.ok(run('trenzoReportsIndex()').includes('Отчёт не поступил'));
  assert.equal(service.overdue(service.get(oldId)), true);
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
  const form = { dataset: { form: 'period-client-report', id }, values: { ...answers, pain: 'yes' }, reportValidity: () => true, querySelector: selector => selector.includes('trainer-form-error') ? error : null };
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
  run(`trenzoReportClick({ action: 'report-decision', id: '${id}', mode: 'accept' }, trainerForm); trenzoReportClick({ action: 'report-generate-response', id: '${id}' }, trainerForm)`);
  run('trainerHandleSubmit({ target: trainerForm, preventDefault() {} })');
  assert.equal(service.status(service.get(id)), 'reviewed');
  assert.equal(service.get(id).resolution.feedback, values.feedback);
});

test('в просрочивших только неотправленные отчёты с истёкшим сроком, без ожидаемых и демо-ссылок', () => {
  const { run } = fixture({ demo: true });
  const markup = run("trenzoReportUI.filter = 'overdue'; trenzoReportsIndex()");
  assert.match(markup, /Илья Морозов/);
  assert.doesNotMatch(markup, /Мария Петрова|Александр Иванов|report-client|Расписание|Демонстрация/);
});

test('открытый отчёт: четыре показателя, семь дней питания и свёрнутые тренировки в нужном порядке', () => {
  const { run, cycle } = fixture({ demo: true });
  run(`trainerUI.route = { page: 'review', id: '${cycle('alexander').id}' }`);
  const markup = run('trainerReview()');
  const titles = ['Что произошло', 'Состояние клиента', 'Питание', 'Тренировки', 'Что заметил TRENZO', 'Предложение TRENZO'];
  const positions = titles.map(title => markup.search(new RegExp('<(?:h2|strong)[^>]*>' + title + '<')));
  assert.ok(positions.every(value => value >= 0));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  const facts = markup.slice(markup.indexOf('report-auto-facts'), markup.indexOf('report-client-words'));
  assert.equal((facts.match(/class="trainer-metric"/g) || []).length, 4);
  assert.match(facts, /Внесено 7 дней из 7/);
  assert.doesNotMatch(facts, /Прошлый период|Средний сон|Активность/);
  const diary = markup.slice(markup.indexOf('<tbody>'), markup.indexOf('</tbody>'));
  assert.equal((diary.match(/<tr>/g) || []).length, 7);
  const training = markup.slice(markup.indexOf('report-training'), markup.indexOf('Что заметил TRENZO'));
  assert.equal((training.match(/<details /g) || []).length, 3);
  assert.doesNotMatch(training, /<details[^>]*\sopen/);
  assert.match(training, /Нет результата в дневнике/);
});

test('предложение содержит все упражнения с причинами и не увеличивает нагрузку при плохом восстановлении', () => {
  const { service, cycle } = fixture({ demo: true });
  const id = cycle('alexander').id, plan = service.proposal(id), base = service.proposal(id, true);
  assert.equal(plan.sessions.length, 3);
  plan.sessions.forEach((session, day) => session.exercises.forEach((exercise, index) => {
    assert.ok(exercise.reason.length > 20);
    assert.equal(exercise.weightKg, base.sessions[day].exercises[index].weightKg);
  }));
  assert.equal(plan.nutritionTarget.calories, base.nutritionTarget.calories);
  assert.ok(plan.nutritionReason.includes('восстановлением'));
});

test('согласованный пакет содержит упражнения, питание, комментарии и не меняет архивный снимок', () => {
  const { service, id, store } = progressionFixture();
  const before = JSON.stringify(service.facts(id));
  const draft = service.createTrainerDraft(id, 'edit');
  draft.weeklyPlan = service.proposal(id);
  draft.weeklyPlan.sessions[1].exercises[1].weightKg += 1;
  draft.weeklyPlan.sessions[1].exercises[1].reps = '10–12';
  draft.weeklyPlan.nutritionTarget.carbs_g -= 10;
  draft.weeklyPlan.nutritionTarget.calories -= 40;
  draft.feedback = 'Комментарии к следующей неделе';
  const closed = service.close(id, draft);
  assert.equal(closed.resolution.delivery.sessions.length, 3);
  assert.equal(closed.resolution.delivery.trainerComment, draft.feedback);
  assert.equal(closed.resolution.delivery.nutrition.carbs_g, draft.weeklyPlan.nutritionTarget.carbs_g);
  assert.ok(closed.resolution.changes.some(item => item.type === 'nutrition'));
  assert.ok(closed.resolution.changes.some(item => item.type === 'prescription'));
  assert.equal(store.client('alexander').weekPlans.find(item => item.start === '2026-10-18').plan.nutritionTarget.calories, draft.weeklyPlan.nutritionTarget.calories);
  assert.equal(JSON.stringify(service.facts(id)), before);
});

test('ошибки в плане не делают частичных изменений, режим без изменений не пропускает скрытые правки', () => {
  const { service, store, id } = progressionFixture();
  const draft = service.createTrainerDraft(id, 'edit');
  draft.weeklyPlan = service.proposal(id);
  draft.weeklyPlan.sessions[2].exercises[0].sets = 0;
  const before = JSON.stringify(store.state);
  assert.throws(() => service.close(id, draft), /Проверьте подходы/);
  assert.equal(JSON.stringify(store.state), before);
  draft.mode = 'keep'; draft.weeklyPlan = service.proposal(id, true);
  draft.weeklyPlan.nutritionTarget.carbs_g -= 10;
  assert.throws(() => service.close(id, draft), /Для изменения питания/);
  assert.equal(JSON.stringify(store.state), before);
});

test('крепатура сохраняется отдельно; для старых отправленных отчётов ответ не выдумывается', () => {
  const { service, cycle, answers, run } = fixture();
  const id = cycle('maria').id;
  const sent = service.submit(id, { ...answers, soreness: 'yes' });
  assert.equal(sent.submission.answers.soreness, 'yes');
  assert.match(run(`trenzoClientWords(trenzoReports.get('${id}'))`), /Крепатура<\/dt><dd>Да/);
  const old = service.submit(cycle('alexander').id, answers);
  assert.equal(old.submission.answers.soreness, undefined);
  assert.match(run(`trenzoClientWords(trenzoReports.get('${old.id}'))`), /Крепатура<\/dt><dd>Не указано/);
});

test('изменённые поля нового редактора попадают в отправленные тренировки и питание', () => {
  const { context, run, service, id } = progressionFixture();
  run('trainerStore.state.reportDemoVersion = 1');
  const root = { innerHTML: '', querySelectorAll: () => [] };
  context.document = { getElementById: () => root };
  context.window = { scrollY: 0, scrollTo() {} };
  context.FormData = class extends Map { constructor(form) { super(Object.entries(form.values)); } };
  run(`trainerUI.route = { page: 'review', id: '${id}' }; trenzoReportClick({ action: 'report-decision', id: '${id}', mode: 'edit' })`);
  const draft = service.get(id).trainerDraft, values = { feedback: 'Проверенный комментарий тренера' };
  draft.weeklyPlan.sessions.forEach((session, day) => session.exercises.forEach((exercise, index) => {
    values[`report-weight-${day}-${index}`] = String(exercise.weightKg);
    values[`report-sets-${day}-${index}`] = String(exercise.sets);
    values[`report-reps-${day}-${index}`] = exercise.reps;
  }));
  for (const key of ['calories', 'protein_g', 'fat_g', 'carbs_g']) values['report-' + key] = String(draft.weeklyPlan.nutritionTarget[key]);
  values['report-weight-1-0'] = '81'; values['report-reps-1-0'] = '6–8'; values['report-calories'] = '2400';
  const error = { textContent: '' };
  context.form = { dataset: { form: 'period-trainer-report', id }, values, reportValidity: () => true, querySelector: selector => selector.includes('trainer-form-error') ? error : null };
  context.input = { name: 'report-weight-1-0', closest: selector => selector === 'form' ? context.form : null, hasAttribute: key => key === 'data-report-prescription' };
  run(`trainerHandleInput({ target: input }); trenzoReportClick({ action: 'report-decision', id: '${id}', mode: 'accept' }, form); trenzoReportClick({ action: 'report-generate-response', id: '${id}' }, form); trainerHandleSubmit({ target: form, preventDefault() {} })`);
  assert.equal(error.textContent, '');
  const delivery = service.get(id).resolution.delivery;
  assert.equal(delivery.sessions[1].exercises[0].weightKg, 81);
  assert.equal(delivery.sessions[1].exercises[0].reps, '6–8');
  assert.equal(delivery.nutrition.calories, 2400);
  assert.equal(delivery.trainerComment, values.feedback);
});

test('предложение питания учитывает замедление веса и полноту дневника без изменения исходных целей', () => {
  const { service, store, cycle, answers } = fixture();
  const client = store.client('maria'), id = cycle('maria').id;
  client.weights = [{ measured_on: '2026-10-03', weight_kg: 67 }, { measured_on: '2026-10-10', weight_kg: 66 }, { measured_on: '2026-10-17', weight_kg: 65.7 }];
  client.nutrition = Array.from({ length: 7 }, (_, day) => ({ report_date: '2026-10-' + String(11 + day), calories: 2500 }));
  service.submit(id, answers);
  const before = JSON.stringify(service.facts(id)), base = service.proposal(id, true), proposed = service.proposal(id);
  assert.equal(proposed.nutritionTarget.carbs_g, base.nutritionTarget.carbs_g - 20);
  assert.equal(proposed.nutritionTarget.calories, base.nutritionTarget.calories - 80);
  assert.match(proposed.nutritionReason, /Темп снижения веса замедлился/);
  assert.equal(JSON.stringify(service.facts(id)), before);
});

test('статус в карточке стоит рядом с именем, питание подписывает соблюдение плана отдельной строкой', () => {
  const { run, cycle } = fixture({ demo: true });
  const id = cycle('alexander').id;
  const card = run(`trenzoReportCard(trenzoReports.get('${id}'))`);
  assert.match(card, /report-name-row"><strong>Александр Иванов<\/strong><span class="trainer-client-status is-overload">Перегруз<\/span><\/span><small>/);
  assert.match(card, /report-card-end"><svg/);
  assert.equal((card.match(/trainer-client-status/g) || []).length, 1);
  assert.ok(card.indexOf('Перегруз') < card.indexOf('report-card-facts'));
  const nutrition = run(`trenzoReportNutrition(trenzoReports.facts('${id}'))`);
  assert.match(nutrition, /<h2>Питание<\/h2><p class="report-nutrition-adherence">Соблюдение плана <strong>[\d,]+%<\/strong><\/p><p class="trainer-muted">Внесено 7 дней из 7/);
});

test('ответ формируется отдельным действием, а отправка без комментария сохраняет весь план', () => {
  const { run, context, service, cycle } = fixture({ demo: true });
  const id = cycle('alexander').id;
  const root = { innerHTML: '', querySelectorAll: () => [] };
  context.document = { getElementById: () => root };
  context.FormData = class extends Map { constructor(form) { super(Object.entries(form.values)); } };
  const error = { textContent: '' };
  context.form = { dataset: { form: 'period-trainer-report', id }, values: {}, reportValidity: () => true, querySelector: selector => selector.includes('trainer-form-error') ? error : null };
  run(`trainerUI.route = { page: 'review', id: '${id}' }; trainerRender()`);
  assert.match(root.innerHTML, /report-proposal-heading">Предложение TRENZO/);
  assert.match(root.innerHTML, /report-proposal-training/);
  assert.match(root.innerHTML, /report-proposal-nutrition/);
  assert.doesNotMatch(root.innerHTML, /Ничего не менять|name="feedback"|type="submit"/);
  run(`trenzoReportClick({ action: 'report-decision', id: '${id}', mode: 'accept' })`);
  run('trainerHandleSubmit({ target: form, preventDefault() {} })');
  assert.match(error.textContent, /Сначала сформируйте/);
  assert.equal(service.status(service.get(id)), 'submitted');
  run(`trenzoReportClick({ action: 'report-decision', id: '${id}', mode: 'accept' }, form); trenzoReportClick({ action: 'report-generate-response', id: '${id}' }, form)`);
  assert.equal(service.status(service.get(id)), 'submitted');
  assert.match(root.innerHTML, /Согласованные тренировки · 3/);
  assert.match(root.innerHTML, /Согласованное питание/);
  assert.match(root.innerHTML, /Комментарий тренера — необязательно/);
  assert.doesNotMatch(root.innerHTML, /name="feedback" required/);
  context.form.values.feedback = '';
  run('trainerHandleSubmit({ target: form, preventDefault() {} })');
  const closed = service.get(id);
  assert.equal(service.status(closed), 'reviewed');
  assert.equal(closed.resolution.delivery.sessions.length, 3);
  assert.equal(closed.resolution.delivery.trainerComment, '');
  run("const emptyCommentStore = createTrainerStore(); emptyCommentStore.load(storage, 'reports-test')");
  assert.equal(run(`emptyCommentStore.review('${id}').resolution.delivery.trainerComment`), '');
});

test('изменение после формирования требует пересобрать ответ, сохраняя комментарий тренера', () => {
  const { run, context, service, id } = progressionFixture();
  run('trainerStore.state.reportDemoVersion = 1');
  const root = { innerHTML: '', querySelectorAll: () => [] };
  context.document = { getElementById: () => root };
  context.FormData = class extends Map { constructor(form) { super(Object.entries(form.values)); } };
  const error = { textContent: '' }, generation = { hidden: true }, response = { hidden: false };
  const form = { dataset: { form: 'period-trainer-report', id }, values: {}, reportValidity: () => true, querySelector: selector => selector === '.report-generation-step' ? generation : selector === '.report-response-draft' ? response : selector.includes('trainer-form-error') ? error : null };
  context.form = form;
  run(`trainerUI.route = { page: 'review', id: '${id}' }; trenzoReportClick({ action: 'report-decision', id: '${id}', mode: 'edit' }); trenzoReportClick({ action: 'report-decision', id: '${id}', mode: 'accept' }, form); trenzoReportClick({ action: 'report-generate-response', id: '${id}' }, form)`);
  form.values.feedback = 'Сохранить мой комментарий';
  form.values['report-weight-0-0'] = '83';
  context.input = { name: 'report-weight-0-0', hasAttribute: attr => attr === 'data-report-prescription', closest: selector => selector === 'form' ? form : null };
  run('trainerHandleInput({ target: input })');
  assert.equal(service.get(id).trainerDraft.responseGenerated, false);
  assert.equal(response.hidden, true);
  assert.equal(generation.hidden, false);
  run('trainerHandleSubmit({ target: form, preventDefault() {} })');
  assert.match(error.textContent, /примите план/);
  assert.equal(service.status(service.get(id)), 'submitted');
  run(`trenzoReportClick({ action: 'report-decision', id: '${id}', mode: 'accept' }, form); trenzoReportClick({ action: 'report-generate-response', id: '${id}' }, form)`);
  assert.equal(service.get(id).trainerDraft.feedback, form.values.feedback);
  run('trainerHandleSubmit({ target: form, preventDefault() {} })');
  assert.equal(service.get(id).resolution.delivery.sessions[0].exercises[0].weightKg, 83);
  assert.equal(service.get(id).resolution.delivery.trainerComment, form.values.feedback);
});

test('карандаши включают редактирование нужной тренировки и питания прямо в предложении TRENZO', () => {
  const { run, context, service, cycle } = fixture({ demo: true });
  const id = cycle('alexander').id;
  const disclosures = [0, 1, 2].map(day => ({ dataset: { reportDisclosure: 'proposal-' + day }, open: false }));
  const root = { innerHTML: '', querySelectorAll: selector => selector === 'details[data-report-disclosure][open]' ? disclosures.filter(item => item.open) : selector === 'details[data-report-disclosure]' ? disclosures : [] };
  context.document = { getElementById: () => root };
  run(`trainerUI.route = { page: 'review', id: '${id}' }; trainerRender()`);
  assert.equal((root.innerHTML.match(/data-action="report-edit-block"/g) || []).length, 4);
  assert.equal((root.innerHTML.match(/class="report-inline-edit is-text"/g) || []).length, 3);
  assert.match(root.innerHTML, /report-workout-title"><strong>Full Body · A<\/strong><button[^>]*data-day="0"[^>]*>Изменить<\/button>/);
  assert.match(root.innerHTML, /report-proposal-heading">Предложение TRENZO/);
  assert.doesNotMatch(root.innerHTML, /Предложение тренера/);
  run(`trenzoReportClick({ action: 'report-edit-block', id: '${id}', block: 'training', day: '0' })`);
  assert.equal(disclosures[0].open, true);
  assert.match(root.innerHTML, /name="report-weight-0-3"[^>]*data-report-prescription/);
  assert.match(root.innerHTML, /name="report-weight-1-3"[^>]*readonly/);
  assert.match(root.innerHTML, /name="report-calories"[^>]*readonly/);
  assert.match(root.innerHTML, /data-action="report-generate-response"[^>]*disabled/);
  assert.equal(service.get(id).trainerDraft.planAccepted, false);
  run(`trenzoReportClick({ action: 'report-edit-block', id: '${id}', block: 'nutrition' })`);
  assert.equal(disclosures[0].open, true);
  assert.match(root.innerHTML, /name="report-carbs_g"[^>]*data-report-prescription/);
  assert.equal(service.get(id).trainerDraft.editingBlocks.nutrition, true);
});

test('принятие сохраняет локальные правки, только затем разрешает сформировать и отправить ответ', () => {
  const { run, context, service, cycle } = fixture({ demo: true });
  const id = cycle('alexander').id;
  const root = { innerHTML: '', querySelectorAll: () => [] };
  context.document = { getElementById: () => root };
  context.FormData = class extends Map { constructor(form) { super(Object.entries(form.values)); } };
  const error = { textContent: '' };
  context.form = { dataset: { form: 'period-trainer-report', id }, values: { 'report-weight-0-3': '55' }, reportValidity: () => true, querySelector: selector => selector.includes('trainer-form-error') ? error : null };
  context.input = { name: 'report-weight-0-3', closest: selector => selector === 'form' ? context.form : null, hasAttribute: attr => attr === 'data-report-prescription' };
  run(`trainerUI.route = { page: 'review', id: '${id}' }; trenzoReportClick({ action: 'report-edit-block', id: '${id}', block: 'training', day: '0' }); trainerHandleInput({ target: input })`);
  assert.throws(() => run(`trenzoReportClick({ action: 'report-generate-response', id: '${id}' }, form)`), /Принять/);
  run(`trenzoReportClick({ action: 'report-decision', id: '${id}', mode: 'accept' }, form)`);
  let draft = service.get(id).trainerDraft;
  assert.equal(draft.planAccepted, true);
  assert.equal(draft.weeklyPlan.sessions[0].exercises[3].weightKg, 55);
  assert.doesNotMatch(root.innerHTML, /data-action="report-generate-response"[^>]*disabled/);
  run(`trenzoReportClick({ action: 'report-edit-block', id: '${id}', block: 'nutrition' }, form)`);
  assert.equal(service.get(id).trainerDraft.planAccepted, false);
  context.form.values['report-carbs_g'] = '280';
  run(`trenzoReportClick({ action: 'report-decision', id: '${id}', mode: 'accept' }, form); trenzoReportClick({ action: 'report-generate-response', id: '${id}' }, form)`);
  draft = service.get(id).trainerDraft;
  assert.equal(draft.weeklyPlan.sessions[0].exercises[3].weightKg, 55);
  assert.equal(draft.weeklyPlan.nutritionTarget.carbs_g, 280);
  run("const acceptedStore = createTrainerStore(); acceptedStore.load(storage, 'reports-test')");
  assert.equal(run(`acceptedStore.review('${id}').trainerDraft.planAccepted`), true);
  run('trainerHandleSubmit({ target: form, preventDefault() {} })');
  const delivery = service.get(id).resolution.delivery;
  assert.equal(delivery.sessions[0].exercises[3].weightKg, 55);
  assert.equal(delivery.nutrition.carbs_g, 280);
});

test('таблица и карточки используют фиксированную сетку и центрированную правую область', () => {
  const css = fs.readFileSync(path.join(__dirname, '../styles/reports.css'), 'utf8');
  assert.match(css, /\.report-card-end\s*\{[^}]*align-items: center;[^}]*align-self: stretch;/);
  assert.match(css, /\.report-name-row\s*\{[^}]*justify-content: flex-start;[^}]*gap: 8px;/);
  assert.match(css, /\.report-name-row \.trainer-client-status\s*\{[^}]*flex-shrink: 0;[^}]*max-width: none;[^}]*white-space: nowrap;/);
  assert.match(css, /\.report-nutrition-table\s*\{[^}]*table-layout: fixed;/);
  assert.match(css, /\.report-prescription-fields\.is-nutrition\s*\{[^}]*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.report-trainer-form \.report-proposal-training\s*\{\s*gap: 0;/);
});

test('карточки сохраняют статус рядом с именем, полную дату и короткую подпись Сбился', () => {
  const { run } = fixture({ demo: true });
  for (const clientId of ['alexander', 'maxim', 'ekaterina', 'anna']) {
    const card = run(`trenzoReportCard(trenzoReports.list().find(item => item.clientId === '${clientId}' && item.start === '2026-10-11'))`);
    assert.match(card, /report-name-row"><strong>[^<]+<\/strong><span class="trainer-client-status [^"]+">[^<]+<\/span><\/span><small>11\.10\.2026 — 17\.10\.2026<\/small>/);
    assert.doesNotMatch(card, /report-period-compact|Сбился с плана/);
    if (['maxim', 'ekaterina'].includes(clientId)) assert.match(card, /is-off_plan">Сбился<\/span>/);
  }
  const css = fs.readFileSync(path.join(__dirname, '../styles/reports.css'), 'utf8');
  assert.doesNotMatch(css, /report-period-compact|report-name-row\s*\{\s*display: contents/);
});

test('старые сохранённые отчёты показывают актуальную подпись без изменения снимка разбора', () => {
  const { run, service, cycle, records } = fixture({ demo: true });
  const storageKey = Array.from(records.keys()).find(key => key.endsWith('reports-test'));
  const legacyState = JSON.parse(records.get(storageKey));
  legacyState.reportCycles.filter(report => ['maxim', 'ekaterina'].includes(report.clientId) && report.submission).forEach(report => { report.submission.analysis.label = 'Сбился с плана'; });
  records.set(storageKey, JSON.stringify(legacyState));
  run("trainerStore.load(storage, 'legacy-switch'); trainerStore.load(storage, 'reports-test')");
  for (const clientId of ['maxim', 'ekaterina']) {
    const report = service.get(cycle(clientId).id);
    assert.equal(report.submission.analysis.label, 'Сбился с плана');
    const saved = JSON.stringify(service.get(report.id));
    assert.equal(service.analyze(report.id).label, 'Сбился');
    const card = run(`trenzoReportCard(trenzoReports.get('${report.id}'))`);
    assert.match(card, /is-off_plan">Сбился<\/span>/);
    assert.doesNotMatch(card, /Сбился с плана/);
    assert.equal(JSON.stringify(service.get(report.id)), saved);
  }
  run("const restoredReportStore = createTrainerStore(); restoredReportStore.load(storage, 'reports-test'); const restoredReportService = createTrenzoReportService(createTrainerDemoReportAdapter(restoredReportStore))");
  assert.equal(run(`restoredReportService.analyze('${cycle('maxim').id}').label`), 'Сбился');
});
