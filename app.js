
const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();
}

// Здесь временно храним данные пользователя.
// Позже подключим базу данных.
const registration = {
  role: null,
  name: ""
};

// Показываем нужный экран
function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach(function(screen) {
    screen.classList.remove("active");
  });

  document.getElementById(screenId).classList.add("active");

  window.scrollTo(0, 0);
}

// Нажатие «Начать» на приветственном экране
function openRoles() {
  showScreen("roleScreen");
}

// Выбор роли
function selectRole(role) {
  registration.role = role;

  if (role === "trainer") {
    showScreen("trainerScreen");
  }

  if (role === "athlete") {
    showScreen("athleteScreen");
  }
}

// Показываем сообщение
function showMessage(message) {
  if (tg) {
    tg.showAlert(message);
  } else {
    alert(message);
  }
}

// Сохраняем имя в рамках текущего открытия приложения
function saveName(role) {
  const inputId = role === "trainer"
    ? "trainerName"
    : "athleteName";

  const name = document.getElementById(inputId).value.trim();

  if (!name) {
    showMessage("Пожалуйста, введи имя");
    return;
  }

  registration.role = role;
  registration.name = name;

  if (role === "trainer") {
    showMessage("Приятно познакомиться, " + name +
      "! Далее настроим твой профиль тренера.");
  } else {
    showMessage("Приятно познакомиться, " + name +
      "! Далее настроим твой личный профиль.");
  }
}
