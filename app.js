
const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();
}


// Временные данные регистрации.
// Позже подключим сохранение в Supabase.

const registration = {
  role: null,
  athlete: {},
  trainer: {}
};


// Переключение экранов

function showScreen(screenId) {

  document.querySelectorAll(".screen").forEach(function(screen) {
    screen.classList.remove("active");
  });

  document.getElementById(screenId).classList.add("active");

  window.scrollTo(0, 0);

}


// Адрес серверной функции авторизации

const TELEGRAM_AUTH_URL =
  "https://hdxfmvewlpmknyysrpac.supabase.co/functions/v1/telegram-auth";

let authInProgress = false;


// Первый экран → проверка Telegram → выбор роли

async function openRoles() {

  // Защита от повторного нажатия

  if (authInProgress) return;


  // Проверяем, что TRENZO открыт через Telegram

  if (!tg || !tg.initData) {

    showMessage(
      "Открой TRENZO через кнопку меню в Telegram-боте."
    );

    return;
  }


  authInProgress = true;

  const loading = document.getElementById("authLoading");

  const startButton = document.querySelector(
    ".start-button-area"
  );


  // Показываем индикатор загрузки

  if (loading) {
    loading.hidden = false;
  }

  if (startButton) {
    startButton.disabled = true;
  }


  try {

    // Отправляем данные Telegram на сервер

    const response = await fetch(TELEGRAM_AUTH_URL, {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        initData: tg.initData
      })

    });


    const result = await response.json();


    // Проверяем ответ сервера

    if (!response.ok || result.ok !== true) {

      showMessage(
        "Не удалось выполнить вход в TRENZO. " +
        "Попробуй ещё раз."
      );

      return;
    }


    // Авторизация прошла успешно

    showScreen("roleScreen");


  } catch (error) {

    console.error("TRENZO authentication error:", error);

    showMessage(
      "Не удалось связаться с сервером TRENZO. " +
      "Проверь интернет и попробуй ещё раз."
    );


  } finally {

    // Убираем индикатор и снова включаем кнопку

    if (loading) {
      loading.hidden = true;
    }

    authInProgress = false;

    if (startButton) {
      startButton.disabled = false;
    }

  }

}


// Выбор сценария регистрации

function selectRole(role) {

  registration.role = role;

  if (role === "athlete") {

    showScreen("athleteScreen");
    athleteStart();

  } else if (role === "trainer") {

    showScreen("trainerScreen");
    trainerStart();

  }

}


// Сообщения внутри Telegram или обычного браузера

function showMessage(message) {

  if (tg && typeof tg.showAlert === "function") {

    tg.showAlert(message);

  } else {

    alert(message);

  }

}
