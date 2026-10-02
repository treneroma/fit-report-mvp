const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();
}

// Эти данные находятся в памяти открытого приложения.
// На сервер отправляются только разрешённые поля анкеты.
const registration = {
  role: null,
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
  registration.athlete = profile?.answers &&
    typeof profile.answers === 'object' &&
    !Array.isArray(profile.answers)
    ? { ...profile.answers }
    : {};
  athleteStart(profile);
  showScreen('athleteScreen');
}

// После приветственного экрана роль выбирается при каждом запуске.
// Данные спортсмена загружаются только после явного выбора этой роли.
function openRoles() {
  showScreen('roleScreen');
}

// Выбор роли определяет ветку приложения; анкета спортсмена восстанавливается с сервера.
async function selectRole(role) {
  if (roleLoading) return;
  registration.role = role;

  if (role === 'trainer') {
    showScreen('trainerScreen');
    trainerStart();
    return;
  }

  if (role !== 'athlete') return;

  roleLoading = true;
  setTrenzoLoading(true, 'Загружаем анкету', 'Восстанавливаем твои ответы...');

  try {
    const result = await trenzoRequest('load_profile');
    const profile = result.profile;
    openAthleteProfile(profile);
  } catch (error) {
    console.error('TRENZO profile loading failed:', error);
    showMessage(error.message || 'Не удалось загрузить анкету.');
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
