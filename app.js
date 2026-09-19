
const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();
}

// Временные данные текущей регистрации.
// После закрытия или перезагрузки приложения они исчезнут.

const registration = {
  role: null,
  athlete: {},
  trainer: {}
};


// Переключение основных экранов

function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach(function(screen) {
    screen.classList.remove("active");
  });

  document.getElementById(screenId).classList.add("active");

  window.scrollTo(0, 0);
}


// Первый экран → выбор роли

function openRoles() {
  showScreen("roleScreen");
}


// Выбор сценария регистрации

function selectRole(role) {
  registration.role = role;

  if (role === "athlete") {
    showScreen("athleteScreen");
    athleteStart();
  }

  if (role === "trainer") {
    showScreen("trainerScreen");
    trainerStart();
  }
}


// Сообщения внутри Telegram или обычного браузера

function showMessage(message) {
  if (tg) {
    tg.showAlert(message);
  } else {
    alert(message);
  }
}
