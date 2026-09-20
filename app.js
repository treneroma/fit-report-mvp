
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



/*
  Проверка входа через Telegram.
  Адрес функции Supabase.
*/

const TELEGRAM_AUTH_URL = "https://hdxfmvewlpmknyysrpac.supabase.co/functions/v1/telegram-auth";

let authInProgress = false;


// Первый экран → проверка Telegram → выбор роли

async function openRoles() {

  // Не отправляем несколько запросов одновременно.

  if (authInProgress) return;

  // Проверяем, что приложение открыто через Telegram.

  if (!tg || !tg.initData) {
    showMessage(
      "Открой TRENZO через кнопку меню в Telegram-боте."
    );
    return;
  }

  authInProgress = true;

  try {

    // Отправляем данные Telegram на серверную проверку.

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


    // Если проверка не прошла — не открываем анкету.

    if (!response.ok || result.ok !== true) {
      showMessage(
        "Не удалось подтвердить вход через Telegram. " +
        "Закрой приложение и открой его заново."
      );
      return;
    }


    // Telegram подтвердил подлинность пользователя.

    showScreen("roleScreen");

  } catch (error) {

    showMessage(
      "Не удалось связаться с сервером TRENZO. " +
      "Проверь интернет и попробуй ещё раз."
    );

  } finally {

    authInProgress = false;

  }
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
