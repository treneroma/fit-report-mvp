const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();

  if (
    typeof tg.isVersionAtLeast === 'function' &&
    tg.isVersionAtLeast('8.0') &&
    typeof tg.requestFullscreen === 'function'
  ) {
    try {
      tg.requestFullscreen();
    } catch (e) {
      console.warn('Fullscreen is unavailable:', e);
    }
  }
}

// Состояние выбранного раздела; локальный демо-режим не отправляет его на сервер.
const registration = {
  role: null,
  demoMode: false,
  athlete: {},
  trainer: {}
};

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(function (screen) {
    screen.classList.remove('active');
  });

  const screen = document.getElementById(screenId);
  if (!screen) {
    throw new Error('Screen not found: ' + screenId);
  }

  screen.classList.add('active');
  window.scrollTo(0, 0);
}

// Публичный адрес функции, не секретный ключ.
const TELEGRAM_AUTH_URL =
  'https://hdxfmvewlpmknyysrpac.supabase.co/functions/v1/telegram-auth';

let roleLoading = false;

function setTrenzoLoading(visible, title, message) {
  const loading = document.getElementById('authLoading');
  if (!loading) return;

  const titleElement = loading.querySelector('.auth-loading-title');
  const messageElement = loading.querySelector('.auth-loading-text');

  if (titleElement && title) titleElement.textContent = title;
  if (messageElement && message) messageElement.textContent = message;

  loading.hidden = !visible;
}

// Сервер заново проверяет подпись Telegram при КАЖДОМ запросе.
// userId из интерфейса не используется как доказательство личности.
async function trenzoRequest(action, extra = {}) {
  if (registration.demoMode) {
    throw new Error('В демо-режиме серверные данные и действия недоступны.');
  }
  if (!tg || !tg.initData) {
    throw new Error('Открой TRENZO через Telegram и попробуй снова.');
  }

  const response = await fetch(TELEGRAM_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, initData: tg.initData, ...extra })
  });

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('Сервер вернул некорректный ответ. Попробуй позже.');
  }

  if (!response.ok || result.ok !== true) {
    if (response.status === 401) {
      throw new Error('Сессия Telegram устарела. Закрой Mini App и открой его заново.');
    }
    throw new Error('Не удалось выполнить запрос к TRENZO. Попробуй ещё раз.');
  }

  return result;
}

function openAthleteProfile(profile) {
  registration.role = 'athlete';
  registration.demoMode = profile?.demoMode === true;
  registration.athlete = profile?.answers &&
    typeof profile.answers === 'object' &&
    !Array.isArray(profile.answers)
    ? { ...profile.answers }
    : {};
  athleteStart(profile);
  showScreen('athleteScreen');
}

function openAthleteDemo() {
  openAthleteProfile({
    demoMode: true,
    status: 'completed',
    answers: {
      name: 'Алексей',
      age: '30',
      sex: 'male',
      height: '180',
      weight: '88.0',
      goal: 'gain',
      targetWeight: '90',
      result: 'Стать сильнее и набрать мышечную массу',
      months: '6',
      experience: 'Средний',
      recentTraining: 'Тренируюсь регулярно',
      frequency: '3',
      duration: '60',
      nutritionTracking: 'no',
      nutritionWilling: 'yes',
      meals: '3',
      nutritionNotes: '',
      trainingMode: 'gym',
      programStatus: 'current'
    }
  });
}

// После приветственного экрана роль выбирается при каждом запуске.
// Данные спортсмена загружаются только после явного выбора этой роли.
function openRoles() {
  showScreen('roleScreen');
}

// У клиента есть локальный fallback, если Telegram недоступен.
async function selectRole(role) {
  if (roleLoading) return;
  registration.role = role;
  registration.demoMode = false;

  if (role === 'trainer') {
    showScreen('trainerScreen');
    trainerStart();
    return;
  }

  if (role !== 'athlete') return;

  if (!tg || !tg.initData) {
    openAthleteDemo();
    return;
  }

  roleLoading = true;
  setTrenzoLoading(true, 'Загружаем анкету', 'Проверяем вход и загружаем твои ответы...');
  try {
    const result = await trenzoRequest('load_profile');
    openAthleteProfile(result.profile);
  } catch (error) {
    console.error('TRENZO profile loading failed; opening local demo:', error);
    openAthleteDemo();
  } finally {
    setTrenzoLoading(false);
    roleLoading = false;
  }
}

function showMessage(message) {
  if (tg && typeof tg.showAlert === 'function') {
    tg.showAlert(message);
  } else {
    alert(message);
  }
}
