
/*
  TRENZO — сценарий тренера.
  Полную анкету добавим следующим этапом.
*/

function trainerStart() {
  document.getElementById("trainerScreen").innerHTML = `
    <div class="page">

      <div class="topbar">

        <button
          class="back-button"
          onclick="showScreen('roleScreen')"
          aria-label="Назад"
        >←</button>

        <div class="logo">TREN<span>ZO</span></div>

      </div>

      <div class="step-label">
        ПРОФИЛЬ ТРЕНЕРА
      </div>

      <h1>Привет, тренер!</h1>

      <p class="hint">
        Здесь будет твоя отдельная регистрация
        и настройка работы с подопечными.
      </p>

      <div class="info-card">

        В этом сценарии мы настроим профиль тренера,
        добавление подопечных, получение отчётов
        и рабочий кабинет.

        <br><br>

        Пока эта ветка находится в разработке.

      </div>

      <div class="form-bottom">

        <button
          class="secondary-btn"
          onclick="showScreen('roleScreen')"
        >
          Вернуться к выбору роли
        </button>

      </div>

    </div>
  `;
}
