const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const athleteSource = fs.readFileSync(path.join(__dirname, '../screens/athlete.js'), 'utf8');
const mainCss = fs.readFileSync(path.join(__dirname, '../styles/main.css'), 'utf8');
const helpersStart = athleteSource.indexOf('function athleteProfilePhotoCardMarkup()');
const helpersEnd = athleteSource.indexOf('\nfunction athleteAccountDeleteMarkup()', helpersStart);
const photoHelpers = athleteSource.slice(helpersStart, helpersEnd);

function fixture(initialPhoto = '') {
  const values = new Map();
  const elements = {
    athleteProfilePhotoInput: { files: [], value: '' },
    athleteProfilePhotoPreview: { innerHTML: '' },
    athleteProfilePhotoAdd: { textContent: '' },
    athleteProfilePhotoRemove: { hidden: true },
    athleteProfilePhotoStatus: {
      textContent: '',
      classList: { toggle(name, enabled) { this[name] = enabled; } }
    }
  };
  const canvasContext = {
    fillRect() {},
    drawImage(image, x, y, width, height) { canvasContext.size = { width, height }; }
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext() { return canvasContext; },
    toDataURL() { return 'data:image/jpeg;base64,compressed-photo'; }
  };
  class MockImage {
    naturalWidth = 1200;
    naturalHeight = 800;
    set src(value) {
      this.source = value;
      setImmediate(() => this.onload?.());
    }
  }
  const document = {
    getElementById(id) { return elements[id] || null; },
    createElement(name) { assert.equal(name, 'canvas'); return canvas; }
  };
  const sessionStorage = {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); }
  };
  const context = vm.createContext({
    document,
    window: { sessionStorage, Telegram: { WebApp: { initDataUnsafe: { user: { id: 42 } } } } },
    Image: MockImage,
    URL: { createObjectURL: () => 'blob:profile-photo', revokeObjectURL() {} },
    athleteEscape(value) {
      return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      })[char]);
    }
  });
  vm.runInContext(`
    const athleteProfilePhotoStorageKey = 'trenzo:athlete-profile-photo:v1:42';
    let athleteProfilePhotoDataUrl = ${JSON.stringify(initialPhoto)};
    ${photoHelpers}
  `, context);
  return { context, elements, values, canvas, canvasContext };
}

test('карточка профиля показывает кнопку, состояние выбранного фото и временное хранение', () => {
  const empty = fixture();
  const emptyMarkup = vm.runInContext('athleteProfilePhotoCardMarkup()', empty.context);
  assert.match(emptyMarkup, /Добавить фото/);
  assert.match(emptyMarkup, /исчезнет после её завершения/);
  assert.match(emptyMarkup, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(athleteSource, /athleteProfilePhotoDataUrl\s*\?\s*`<img src=/);
  assert.match(mainCss, /\.athlete-dashboard-profile-shortcut\.has-photo::before/);
  const headerActions = athleteSource.match(/<div class="athlete-dashboard-header-actions">([\s\S]*?)<\/div>/)?.[1] || "";
  assert.match(headerActions, /<img class="athlete-dashboard-notification-icon" src="assets\/notification-bell-trim\.png"[^>]*width="24" height="27">/);
  assert.match(mainCss, /#athleteScreen \.athlete-dashboard-header \.logo\s*\{[^}]*width:\s*min\(132px, 36vw\);[^}]*height:\s*20px;/);
  assert.match(mainCss, /\.athlete-dashboard-notification-icon\s*\{[^}]*width:\s*24px;[^}]*height:\s*27px;/);
  assert.match(mainCss, /\.athlete-dashboard-header-actions\s*\{[^}]*gap:\s*7\.5px;/);
  assert.match(mainCss, /\.athlete-dashboard-profile-shortcut\s*\{[^}]*width:\s*46px;[^}]*height:\s*46px;/);
  assert.match(mainCss, /\.athlete-dashboard-profile-shortcut::before\s*\{[^}]*width:\s*40px;[^}]*height:\s*40px;/);
  assert.ok(headerActions.indexOf("notification-bell-trim.png") < headerActions.indexOf("athlete-dashboard-profile-shortcut"));
  assert.ok(fs.existsSync(path.join(__dirname, '../assets/notification-bell-trim.png')));
  assert.match(athleteSource, /registration\.athlete\.sex === "male" \? " athlete-cabinet-page--male"/);
  assert.match(mainCss, /\.athlete-cabinet-page--male::before\s*\{[^}]*url\("\.\.\/assets\/hero-man\.png\?v=1"\)/);
  assert.match(mainCss, /background-size:\s*100% 100%, 100% 100%, 110% auto;/);
  const heroIndex = athleteSource.indexOf('class="athlete-dashboard-hero"');
  const metricsIndex = athleteSource.indexOf('class="info-card athlete-dashboard-summary"');
  const workoutsIndex = athleteSource.indexOf('class="athlete-dashboard-workouts"', metricsIndex);
  const weightIndex = athleteSource.indexOf('class="athlete-dashboard-weight"', metricsIndex);
  assert.ok(heroIndex >= 0 && heroIndex < metricsIndex);
  assert.ok(athleteSource.indexOf('id="athleteDashboardAdherence"', heroIndex) < metricsIndex);
  assert.ok(workoutsIndex > metricsIndex && weightIndex > workoutsIndex);
  assert.match(athleteSource.slice(metricsIndex, athleteSource.indexOf('id="athleteDashboardNextWorkout"')), /aria-label="Тренировки и текущий вес"/);
  assert.match(athleteSource, /id="athleteDashboardAdherenceValue"[^>]*>0<\/span><span class="athlete-dashboard-adherence-percent">%/);
  assert.doesNotMatch(athleteSource, /athlete-dashboard-adherence-icon/);
  assert.match(mainCss, /\.athlete-dashboard-adherence-gauge\s*\{[^}]*width:\s*min\(41vw, 168px\)/);
  assert.ok(fs.existsSync(path.join(__dirname, '../assets/hero-man.png')));
  assert.doesNotMatch(athleteSource, /Демо-режим · данные не загружаются и не сохраняются на сервере/);
  assert.doesNotMatch(mainCss, /\.athlete-demo-mode-note/);
  assert.match(headerActions, /athlete-dashboard-profile-shortcut/);

  const selected = fixture('data:image/jpeg;base64,existing');
  const selectedMarkup = vm.runInContext('athleteProfilePhotoCardMarkup()', selected.context);
  assert.match(selectedMarkup, /Заменить фото/);
  assert.match(selectedMarkup, /Удалить/);
  assert.match(selectedMarkup, /data:image\/jpeg;base64,existing/);
});

test('выбранное изображение уменьшается и сохраняется только в sessionStorage', async () => {
  const { context, elements, values, canvas, canvasContext } = fixture();
  elements.athleteProfilePhotoInput.files = [{ type: 'image/png', size: 3_000_000 }];
  vm.runInContext('athleteHandleProfilePhoto({ currentTarget: document.getElementById("athleteProfilePhotoInput") })', context);
  await new Promise(resolve => setImmediate(resolve));

  assert.deepEqual(canvasContext.size, { width: 512, height: 341 });
  assert.equal(vm.runInContext('athleteProfilePhotoDataUrl', context), 'data:image/jpeg;base64,compressed-photo');
  assert.equal(values.get('trenzo:athlete-profile-photo:v1:42'), 'data:image/jpeg;base64,compressed-photo');
  assert.match(elements.athleteProfilePhotoPreview.innerHTML, /data:image\/jpeg;base64,compressed-photo/);
  assert.equal(elements.athleteProfilePhotoAdd.textContent, 'Заменить фото');
  assert.equal(elements.athleteProfilePhotoRemove.hidden, false);
  assert.match(elements.athleteProfilePhotoStatus.textContent, /до конца сессии/);

  vm.runInContext('athleteRemoveProfilePhoto()', context);
  assert.equal(values.has('trenzo:athlete-profile-photo:v1:42'), false);
  assert.equal(elements.athleteProfilePhotoRemove.hidden, true);
  assert.equal(elements.athleteProfilePhotoAdd.textContent, 'Добавить фото');
  assert.match(elements.athleteProfilePhotoStatus.textContent, /удалено/);
  assert.equal(canvas.width, 512);
});

test('неподдерживаемый формат и слишком большой файл дают понятную ошибку', () => {
  const unsupported = fixture();
  unsupported.elements.athleteProfilePhotoInput.files = [{ type: 'image/gif', size: 1000 }];
  vm.runInContext('athleteHandleProfilePhoto({ currentTarget: document.getElementById("athleteProfilePhotoInput") })', unsupported.context);
  assert.match(unsupported.elements.athleteProfilePhotoStatus.textContent, /JPG, PNG или WEBP/);
  assert.equal(unsupported.values.size, 0);

  const tooLarge = fixture();
  tooLarge.elements.athleteProfilePhotoInput.files = [{ type: 'image/jpeg', size: 13 * 1024 * 1024 }];
  vm.runInContext('athleteHandleProfilePhoto({ currentTarget: document.getElementById("athleteProfilePhotoInput") })', tooLarge.context);
  assert.match(tooLarge.elements.athleteProfilePhotoStatus.textContent, /больше 12 МБ/);
  assert.equal(tooLarge.values.size, 0);
});
