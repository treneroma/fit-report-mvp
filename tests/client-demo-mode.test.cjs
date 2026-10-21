const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');

function fixture(telegram = null) {
  const screens = ['welcomeScreen', 'roleScreen', 'athleteScreen', 'trainerScreen']
    .map(id => ({ id, classList: { active: false, add(name) { this[name] = true; }, remove(name) { this[name] = false; } } }));
  const calls = { athlete: [], trainer: 0, fetch: 0 };
  const context = vm.createContext({
    window: {
      scrollTo() {},
      ...(telegram ? { Telegram: { WebApp: { ready() {}, expand() {}, ...telegram } } } : {})
    },
    document: {
      querySelectorAll(selector) { assert.equal(selector, '.screen'); return screens; },
      getElementById(id) { return screens.find(screen => screen.id === id) || null; }
    },
    fetch() { calls.fetch += 1; throw new Error('The local demo must not use fetch.'); },
    athleteStart(profile) { calls.athlete.push(profile); },
    trainerStart() { calls.trainer += 1; },
    console,
    alert() {}
  });
  vm.runInContext(appSource, context);
  return { context, calls, screens };
}

test('client opens a local demo dashboard without Telegram or server requests', async () => {
  const { context, calls, screens } = fixture();
  await vm.runInContext("selectRole('athlete')", context);

  assert.equal(calls.fetch, 0);
  assert.equal(calls.athlete.length, 1);
  assert.equal(calls.athlete[0].demoMode, true);
  assert.equal(calls.athlete[0].answers.weight, '88.0');
  assert.equal(vm.runInContext('registration.demoMode', context), true);
  assert.equal(screens.find(screen => screen.id === 'athleteScreen').classList.active, true);
});

test('client opens a local demo without checking valid Telegram initData', async () => {
  const { context, calls } = fixture({ initData: 'valid-telegram-session' });
  await vm.runInContext("selectRole('athlete')", context);

  assert.equal(calls.fetch, 0);
  assert.equal(calls.athlete.length, 1);
  assert.equal(calls.athlete[0].demoMode, true);
  assert.equal(vm.runInContext('registration.demoMode', context), true);
});

test('a server request is blocked while the client is in demo mode', async () => {
  const { context, calls } = fixture();
  await vm.runInContext("selectRole('athlete')", context);
  const message = await vm.runInContext("trenzoRequest('load_profile').catch(error => error.message)", context);

  assert.match(message, /демо-режиме/);
  assert.equal(calls.fetch, 0);
});

test('trainer entry leaves the client demo mode', async () => {
  const { context, calls } = fixture();
  await vm.runInContext("selectRole('athlete')", context);
  await vm.runInContext("selectRole('trainer')", context);

  assert.equal(calls.trainer, 1);
  assert.equal(vm.runInContext('registration.demoMode', context), false);
});
