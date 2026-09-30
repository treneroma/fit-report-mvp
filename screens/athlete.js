/*
  TRENZO — регистрация пользователя «Мой прогресс»

  Разрешённые поля анкеты сохраняются в Supabase.
  Ограничения по здоровью не сохраняются в профиле; при явном запросе
  плана временно передаются ИИ-сервису. Программы, фотографии и имена
  файлов в профиль не отправляем.
*/

let athleteStep = 0;
let athleteSaving = false;
let athleteRestoreNotice = "";
let athleteTrainingSetupMode = null;
let athleteTrainingWorkoutCount = null;
let athleteTrainingUploadStateError = "";
// Body photos stay only in memory until the user explicitly starts AI analysis.
let athleteBodyPhotoFiles = [];
let athleteBodyPhotoConsent = false;
const athleteMaxBodyPhotos = 3;

// Должен совпадать со списком allowedFields в Edge Function.
const athleteServerFields = [
  "name", "age", "sex", "height", "weight", "goal", "targetWeight",
  "result", "months", "experience", "recentTraining", "frequency",
  "duration", "nutritionTracking", "nutritionWilling", "meals",
  "nutritionNotes", "trainingMode", "programStatus"
];

function athleteSafeAnswers() {
  const safe = {};
  for (const key of athleteServerFields) {
    if (typeof registration.athlete[key] === "string") {
      safe[key] = registration.athlete[key];
    }
  }
  return safe;
}

const athleteTotalSteps = 14;

const athleteTitles = [
  "Как тебя зовут?",
  "Расскажи немного о себе",
  "Твои параметры",
  "Какая у тебя цель?",
  "Какого результата<br>ты хочешь достичь?",
  "Твой тренировочный опыт",
  "Сколько времени ты готов уделять тренировкам?",
  "Что нам важно знать о твоём здоровье?",
  "Добавить фотографии тела?",
  "Следишь ли ты за питанием?",
  "Есть ли особенности питания?",
  "Как ты сейчас тренируешься?",
  "Есть ли у тебя тренировочная программа?",
  "Проверь свою анкету"
];

const athleteHints = [
  "",
  "Эти данные помогут настроить личный профиль.",
  "Укажи свои актуальные показатели.",
  "Выбери основное направление, над которым хочешь работать.",
  "",
  "",
  "Подберём формат, который впишется в твой график.",
  "Расскажи обо всём, что может повлиять на тренировки.",
  "Фото можно учесть при анализе анкеты. В TRENZO они не сохраняются.",
  "От этого зависит, как мы будем выстраивать работу с питанием.",
  "Учитываем твои привычки и ограничения.",
  "Это поможет выбрать дальнейший сценарий.",
  "По ответу выберем: загрузить текущие тренировки или начать адаптацию.",
  "Если нужно что-то исправить, вернись к соответствующему вопросу."
];


// Защита: ответы пользователя выводим только как текст.

function athleteEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, function(char) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char];
  });
}


// Вспомогательные элементы анкеты

function athleteInput(name, label, type, placeholder, extra = "") {
  const value = registration.athlete[name] ?? "";
  const hideVisibleLabel = ["height", "weight", "targetWeight"].includes(name);
  const inputMode = type === "number"
    ? (extra.includes('step="0.1"') ? "decimal" : "numeric")
    : "";

  return `
    <div class="field">
      <label class="field-title${hideVisibleLabel ? " visually-hidden" : ""}" for="${name}">
        ${label}
      </label>

      <input
        class="text-input"
        id="${name}"
        name="${name}"
        type="${type}"
        ${inputMode ? `inputmode="${inputMode}"` : ""}
        value="${athleteEscape(value)}"
        placeholder="${placeholder}"
        ${extra}
      >
    </div>
  `;
}


function athleteArea(name, label, placeholder, required = false, extra = "") {
  const value = registration.athlete[name] ?? "";

  return `
    <div class="field">
      <label class="field-title" for="${name}">
        ${label}
      </label>

      <textarea
        class="text-area"
        id="${name}"
        name="${name}"
        placeholder="${placeholder}"
        ${required ? "required" : ""}
        ${extra}
      >${athleteEscape(value)}</textarea>
    </div>
  `;
}


function athleteOptions(name, label, choices) {
  const current = registration.athlete[name];

  return `
    <div class="field">
      <div class="field-title">${label}</div>

      <div class="option-list" role="group" aria-label="${athleteEscape(label)}">

        ${choices.map(function(choice) {
          return `
            <label class="option">
              <input
                type="radio"
                name="${name}"
                value="${choice[0]}"
                ${current === choice[0] ? "checked" : ""}
                required
              >

              <span>${choice[1]}</span>
            </label>
          `;
        }).join("")}

      </div>
    </div>
  `;
}


// Запуск личной анкеты

function athleteStart(profile = null) {
  athleteRestoreNotice = "";

  if (profile?.status === "completed") {
    athleteStep = athleteTotalSteps;
    // Не показываем экран «Почти готово», пока проверяется статус в базе.
    const screen = document.getElementById("athleteScreen");
    screen.innerHTML = `
      <div class="page" style="display:block;min-height:0;">
        <div class="topbar"><div class="logo">TREN<span>ZO</span></div></div>
        <p class="hint" role="status">Загружаем личный кабинет...</p>
      </div>`;
    athleteOnboardingRequest("load").then(function(data) {
      // Пользователь мог уйти на другой экран, пока шёл запрос.
      if (document.getElementById("athleteScreen") !== screen ||
          athleteStep !== athleteTotalSteps || !screen.textContent.includes("Загружаем личный кабинет")) return;
      if (data.setupStatus === "ready") {
        athleteRenderCabinet();
      } else {
        athleteRenderComplete(data);
      }
    }).catch(function(error) {
      console.error("TRENZO cabinet load failed:", error);
      if (athleteStep !== athleteTotalSteps || !screen.isConnected ||
          !screen.textContent.includes("Загружаем личный кабинет")) return;
      screen.innerHTML = `<div class="page" style="display:block;min-height:0;">
        <div class="topbar"><div class="logo">TREN<span>ZO</span></div></div>
        <p class="hint" role="alert">Не удалось загрузить личный кабинет.</p>
        <button class="primary-btn" type="button"
          onclick="athleteStart({status:'completed'})">Попробовать снова</button>
      </div>`;
    });
    return;
  }

  athleteBodyPhotoFiles = [];
  athletePhotoConsent = false;
  athleteTrainingSetupMode = null;
  registration.athlete.photoNames = [];

  const savedStep = Number.isInteger(profile?.onboarding_step)
    ? profile.onboarding_step : 0;

  athleteStep = Math.min(Math.max(savedStep, 0), athleteTotalSteps - 1);

  // Ограничения по здоровью сознательно не храним на сервере.
  // Поэтому после перезапуска просим повторно заполнить этот шаг,
  // если пользователь уже прошёл его в прошлой сессии.
  if (athleteStep > 7 && !registration.athlete.restrictions) {
    athleteStep = 7;
    athleteRestoreNotice = "Основные ответы восстановлены. Ограничения по здоровью " +
      "в тестовой версии не сохраняются — заполни этот шаг повторно " +
      "или укажи «Нет».";
  }

  athleteRender();
}


// Содержимое каждого шага

function athleteFields() {
  const d = registration.athlete;

  switch (athleteStep) {

    // 1. ИМЯ

    case 0:
      return athleteInput(
        "name",
        "Твоё имя",
        "text",
        "Твоё имя",
        'required maxlength="60" autocomplete="given-name"'
      );


    // 2. ВОЗРАСТ И ПОЛ

    case 1:
      return `
        ${athleteInput(
          "age",
          "Возраст",
          "number",
          "Полных лет",
          'required min="1" max="110"'
        )}

        ${athleteOptions("sex", "Пол", [
          ["male", "Мужской"],
          ["female", "Женский"],
          ["unspecified", "Предпочитаю не указывать"]
        ])}
      `;


    // 3. РОСТ И ВЕС

    case 2:
      return `
        ${athleteInput(
          "height",
          "Рост, см",
          "number",
          "Рост, см",
          'required min="100" max="250"'
        )}

        ${athleteInput(
          "weight",
          "Текущий вес, кг",
          "number",
          "Текущий вес, кг",
          'required min="25" max="400" step="0.1"'
        )}
      `;


    // 4. ЦЕЛЬ

    case 3:
      return athleteOptions("goal", "Основная цель", [
        ["lose", "Снизить вес"],
        ["muscle", "Набрать мышечную массу"],
        ["recomp", "Изменить состав тела"],
        ["strength", "Увеличить силовые показатели"],
        ["fitness", "Улучшить физическую форму"],
        ["other", "Другая цель"]
      ]);


    // 5. ЖЕЛАЕМЫЙ РЕЗУЛЬТАТ И СРОК

    case 4: {
      const showTargetWeight =
        ["lose", "muscle", "recomp"].includes(d.goal);

      return `
        ${showTargetWeight ? athleteInput(
          "targetWeight",
          "Желаемый вес, кг",
          "number",
          "Желаемый вес, кг",
          'min="25" max="400" step="0.1"'
        ) : ""}

        ${athleteArea(
          "result",
          "Какой результат ты хочешь получить?",
          "Например: снизить вес, сохранить мышцы и улучшить выносливость",
          true
        )}

        ${athleteInput(
          "months",
          "За какой срок ты хочешь достичь цели?",
          "number",
          "Укажи срок в месяцах",
          'required min="1" max="60"'
        )}

        <div id="goalWarning" hidden></div>
      `;
    }


    // 6. ОПЫТ

    case 5:
      return `
        ${athleteOptions("experience", "Общий опыт тренировок", [
          ["new", "Только начинаю"],
          ["under1", "До 1 года"],
          ["1to3", "От 1 до 3 лет"],
          ["3to5", "От 3 до 5 лет"],
          ["5plus", "Более 5 лет"]
        ])}

        ${athleteOptions(
          "recentTraining",
          "Как ты тренировался последние 3 месяца?",
          [
            ["none", "Почти не тренировался"],
            ["irregular", "Нерегулярно"],
            ["1to2", "1–2 раза в неделю"],
            ["3plus", "3 и более раз в неделю"],
            ["program", "Регулярно по программе"]
          ]
        )}
      `;


    // 7. РЕЖИМ

    case 6:
      return `
        ${athleteOptions("frequency", "Тренировок в неделю", [
          ["2", "2 раза"],
          ["3", "3 раза"],
          ["4", "4 раза"],
          ["5", "5 раз"],
          ["6", "6 раз"]
        ])}

        ${athleteOptions("duration", "Длительность тренировки", [
          ["under45", "До 45 минут"],
          ["45to60", "45–60 минут"],
          ["60to90", "60–90 минут"],
          ["over90", "Более 90 минут"]
        ])}
      `;


    // 8. ОГРАНИЧЕНИЯ

    case 7:
      return `
        <div class="info-card">
          Укажи заболевания, травмы и операции в прошлом,
          проблемы со спиной или суставами, грыжи и протрузии,
          боли, ограничения движений и другие особенности,
          которые могут повлиять на тренировки.
        </div>

        ${athleteArea(
          "restrictions",
          "Расскажи о своих ограничениях",
          "Например: болит колено при приседаниях; была операция на плече...",
          true
        )}

        <p class="small-note">
          Если ограничений нет, напиши «Нет». Не указывай диагнозы
          и подробности медицинской истории, которыми не хочешь делиться.
        </p>
      `;


    // 9. ФОТОГРАФИИ

    case 8:
      if (!(Number(d.age) >= 18)) {
        return `
          <div class="info-card">
            Анализ фотографий доступен пользователям от 18 лет. Этот шаг можно пропустить.
          </div>
        `;
      }
      return `
        <div class="info-card">
          <strong>Фото добавлять необязательно.</strong><br>
          Можно выбрать до трёх снимков: спереди, сбоку и сзади.
          ИИ учтёт только общие визуальные особенности телосложения
          при анализе цели — без медицинских выводов и оценки процента жира.
        </div>

        <div class="field">
          <label class="field-title" for="bodyPhotos">
            Выбери фотографии
          </label>

          <input
            class="file-input"
            id="bodyPhotos"
            name="bodyPhotos"
            type="file"
            accept="image/*"
            multiple
            onchange="athleteHandleBodyPhotoSelection(this)"
          >

          <p class="field-hint" id="bodyPhotoStatus" role="status" aria-live="polite">
            ${athleteBodyPhotoFiles.length
              ? `Выбрано фото: ${athleteBodyPhotoFiles.length} из ${athleteMaxBodyPhotos}`
              : "Фото будут отправлены на анализ только после твоего подтверждения и не сохранятся в профиле TRENZO."}
          </p>
          <button class="secondary-btn" id="bodyPhotoClearButton" type="button"
            onclick="athleteClearBodyPhotos()"${athleteBodyPhotoFiles.length ? "" : " hidden"}>
            Удалить выбранные фото
          </button>
        </div>
      `;


    // 10. КОНТРОЛЬ ПИТАНИЯ

    case 9:
      return `
        ${athleteOptions(
          "nutritionTracking",
          "Следишь ли ты сейчас за питанием?",
          [
            ["regular", "Да, регулярно"],
            ["sometimes", "Иногда"],
            ["no", "Нет, не слежу"]
          ]
        )}

        ${athleteOptions(
          "nutritionWilling",
          "Готов ли ты отслеживать питание?",
          [
            ["yes", "Да"],
            ["maybe", "Скорее да"],
            ["no", "Пока нет"]
          ]
        )}
      `;


    // 11. ОСОБЕННОСТИ ПИТАНИЯ

    case 10:
      return `
        ${athleteOptions("meals", "Сколько раз в день ты обычно ешь?", [
          ["1to2", "1–2 раза"],
          ["3", "3 раза"],
          ["4", "4 раза"],
          ["5plus", "5 раз и более"],
          ["varies", "Каждый день по-разному"]
        ])}

        ${athleteArea(
          "nutritionNotes",
          "Особенности и ограничения питания",
          "Например: аллергии, продукты, которые не употребляешь, особенности режима. Если ничего нет, можно оставить поле пустым.",
          false,
          'maxlength="2000"'
        )}

        <p class="small-note">
          Эти сведения сохраняются в профиле и будут учитываться
          при анализе рациона и подготовке рекомендаций.
        </p>
      `;


    // 12. С ТРЕНЕРОМ ИЛИ САМОСТОЯТЕЛЬНО

    case 11:
      return athleteOptions(
        "trainingMode",
        "Как ты сейчас занимаешься?",
        [
          ["alone", "Самостоятельно"],
          ["coach", "С персональным тренером"],
          ["mixed", "Иногда с тренером, иногда самостоятельно"],
          ["starting", "Пока не занимаюсь, планирую начать"]
        ]
      );


    // 13. НАЛИЧИЕ ПРОГРАММЫ

    case 12:
      return athleteOptions(
        "programStatus",
        "Есть ли у тебя действующая тренировочная программа?",
        [
          ["yes", "Да, тренируюсь по программе"],
          ["partial", "Есть отдельные упражнения, но нет полной программы"],
          ["no", "Нет, программы пока нет"]
        ]
      );


    // 14. ПРОВЕРКА АНКЕТЫ

    case 13:
      return athleteSummary();


    default:
      return "";
  }
}


// Краткое отображение ответов

function athleteSummaryRow(label, value) {
  return `
    <div class="summary-row">
      <small>${label}</small>
      <strong>${athleteEscape(value || "Не указано")}</strong>
    </div>
  `;
}


function athleteSummary() {
  const d = registration.athlete;

  const goalNames = {
    lose: "Снизить вес",
    muscle: "Набрать мышечную массу",
    recomp: "Изменить состав тела",
    strength: "Увеличить силовые показатели",
    fitness: "Улучшить физическую форму",
    other: "Другая цель"
  };

  const programNames = {
    yes: "Есть действующая программа",
    partial: "Есть отдельные упражнения",
    no: "Нет программы — начать с адаптации"
  };

  const modeNames = {
    alone: "Самостоятельно",
    coach: "С персональным тренером",
    mixed: "Самостоятельно и с тренером",
    starting: "Планирую начать"
  };

  return `
    <div class="info-card">

      ${athleteSummaryRow("Имя", d.name)}

      ${athleteSummaryRow(
        "Возраст и пол",
        d.age + " лет · " +
        ({
          male: "Мужской",
          female: "Женский",
          unspecified: "Не указан"
        }[d.sex] || "")
      )}

      ${athleteSummaryRow(
        "Рост и текущий вес",
        d.height + " см · " + d.weight + " кг"
      )}

      ${athleteSummaryRow(
        "Цель",
        goalNames[d.goal]
      )}

      ${athleteSummaryRow(
        "Желаемый результат",
        d.result
      )}

      ${athleteSummaryRow(
        "Желаемый вес",
        d.targetWeight ? d.targetWeight + " кг" : "Не указан"
      )}

      ${athleteSummaryRow(
        "Срок",
        d.months + " мес."
      )}

      ${athleteSummaryRow(
        "Тренировок в неделю",
        d.frequency
      )}

      ${athleteSummaryRow(
        "Ограничения",
        d.restrictions
      )}

      ${athleteSummaryRow(
        "Фотографии",
        (d.photoNames || []).length
          ? "Выбрано: " + d.photoNames.length
          : "Не добавлены"
      )}

      ${athleteSummaryRow(
        "Формат тренировок",
        modeNames[d.trainingMode]
      )}

      ${athleteSummaryRow(
        "Программа",
        programNames[d.programStatus]
      )}

    </div>

    <p class="small-note">
      Дальнейший сценарий тренировок зависит от ответа о программе:
      с готовой программой можно загрузить тренировки, без неё — начать адаптацию.
      Фото и сведения о здоровье не сохраняются в профиле.
    </p>
  `;
}


// Отображаем текущий экран анкеты

function athleteRender() {
  document.getElementById("athleteScreen")?.classList.remove("has-athlete-bottom-nav");
  if (athleteStep === athleteTotalSteps) {
    athleteRenderComplete();
    return;
  }

  const progress =
    ((athleteStep + 1) / athleteTotalSteps) * 100;

  const lastStep = athleteStep === athleteTotalSteps - 1;

  document.getElementById("athleteScreen").innerHTML = `
    <div class="page athlete-onboarding-page${athleteStep === 0 ? " athlete-name-step" : ""}">

      <div class="topbar">
        <div class="logo">TREN<span>ZO</span></div>
        <button
          class="back-button"
          type="button"
          onclick="athleteBack()"
          aria-label="Назад"
        >←</button>

      </div>

      <div class="step-label">
        ШАГ ${athleteStep + 1} ИЗ ${athleteTotalSteps}
      </div>

      <div class="progress-track">
        <div
          class="progress-fill"
          style="width: ${progress}%"
        ></div>
      </div>

      <h1>${athleteTitles[athleteStep]}</h1>

      ${athleteRestoreNotice ? `
        <div class="info-card" role="status">
          ${athleteEscape(athleteRestoreNotice)}
        </div>` : ""}

      ${athleteHints[athleteStep] ? `<p class="hint">${athleteHints[athleteStep]}</p>` : ""}

      <form
        id="athleteForm"
        onsubmit="event.preventDefault(); athleteNext();"
      >

        ${athleteFields()}

        <div class="form-bottom">

          <button class="primary-btn" type="submit" id="athleteNextButton">
            ${lastStep
              ? "Подтвердить и завершить →"
              : "Продолжить"}
          </button>

        </div>

      </form>

    </div>
  `;

  window.scrollTo(0, 0);
}


// Забираем введённые ответы с текущего экрана

function athleteSaveCurrent(validate) {
  const form = document.getElementById("athleteForm");

  if (!form) return true;

  if (validate && !form.reportValidity()) {
    return false;
  }

  const d = registration.athlete;

  form.querySelectorAll(
    'input:not([type="file"]), textarea'
  ).forEach(function(input) {

    if (input.type === "radio" && !input.checked) {
      return;
    }

    d[input.name] = input.value.trim();
  });


  // Only an in-memory count is shown; image names and contents aren't persisted.
  d.photoNames = athleteBodyPhotoFiles.map(function() { return "Фото"; });

  return true;
}


// Предварительная проверка слишком быстрого снижения веса.
//
// Порог здесь — только продуктовый сигнал для ручной
// проверки цели, а НЕ медицинская норма или расчёт
// безопасного темпа похудения.

function athleteGoalNeedsReview() {
  const d = registration.athlete;

  if (d.goal !== "lose" || !d.targetWeight) {
    return false;
  }

  const current = Number(d.weight);
  const target = Number(d.targetWeight);
  const months = Number(d.months);

  if (!current || !target || !months) {
    return false;
  }

  const lossPerMonth = (current - target) / months;

  return lossPerMonth > Math.max(8, current * 0.08);
}


function athleteGoalKey() {
  const d = registration.athlete;

  return [
    d.weight,
    d.targetWeight,
    d.months
  ].join("|");
}


// Пользователь подтвердил, что увидел предупреждение.
function athleteAcknowledgeGoal() {
  if (athleteSaving || !athleteSaveCurrent(true)) return;
  registration.athlete.goalAcknowledgedFor = athleteGoalKey();
  athleteNext();
}

// Отправляем только разрешённые поля анкеты.
// При неудаче НЕ переходим дальше, чтобы не обещать ложное сохранение.
async function athletePersist(step, status = "draft") {
  return trenzoRequest("save_profile", {
    answers: athleteSafeAnswers(),
    onboardingStep: step,
    status: status
  });
}

function athleteSetSaving(saving) {
  athleteSaving = saving;
  const button = document.getElementById("athleteNextButton");
  if (button) {
    button.disabled = saving;
    button.textContent = saving ? "Сохраняем ответы..." :
      (athleteStep === athleteTotalSteps - 1
        ? "Подтвердить и завершить →" : "Продолжить");
  }
  const back = document.querySelector("#athleteScreen .back-button");
  if (back) back.disabled = saving;
}

// Следующий шаг: валидация → сохранение → переход.
async function athleteNext() {
  if (athleteSaving || !athleteSaveCurrent(true)) return;
  const d = registration.athlete;

  if (
    athleteStep === 4 && d.goal === "lose" && d.targetWeight &&
    Number(d.targetWeight) >= Number(d.weight)
  ) {
    showMessage("Желаемый вес должен быть меньше текущего, " +
      "если твоя цель — снижение веса.");
    return;
  }

  if (
    athleteStep === 4 && athleteGoalNeedsReview() &&
    d.goalAcknowledgedFor !== athleteGoalKey()
  ) {
    const warning = document.getElementById("goalWarning");
    if (warning) {
      warning.hidden = false;
      warning.innerHTML = `
        <div class="warning-card">
          <strong>Проверь выбранный срок.</strong>
          <p>Для такого изменения веса срок выглядит очень коротким.
          TRENZO не может подтвердить его реалистичность по одной анкете.</p>
          <p>Пересмотри срок. При существенном изменении веса обсуди
          цель с квалифицированным специалистом.</p>
          <button class="secondary-btn" type="button"
            onclick="athleteAcknowledgeGoal()">
            Я понял, продолжить с этим сроком
          </button>
        </div>`;
      warning.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    return;
  }

  const nextStep = athleteStep + 1;
  const status = nextStep === athleteTotalSteps ? "completed" : "draft";
  athleteSetSaving(true);

  try {
    await athletePersist(nextStep, status);
    athleteStep = nextStep;
    athleteRestoreNotice = "";
    athleteRender();
  } catch (error) {
    console.error("TRENZO profile saving failed:", error);
    showMessage(error.message || "Не удалось сохранить анкету. Попробуй ещё раз.");
  } finally {
    athleteSetSaving(false);
  }
}

// Назад: сохраняем текущие значения, включая незаконченный ответ.
async function athleteBack() {
  if (athleteSaving) return;
  athleteSaveCurrent(false);

  // При возврате на выбор роли не теряем черновик.
  const previousStep = Math.max(athleteStep - 1, 0);
  athleteSetSaving(true);
  try {
    await athletePersist(previousStep, "draft");
    athleteRestoreNotice = "";

    if (athleteStep === 0) {
      showScreen("roleScreen");
    } else {
      athleteStep = previousStep;
      athleteRender();
    }
  } catch (error) {
    console.error("TRENZO profile saving failed:", error);
    showMessage(error.message || "Не удалось сохранить изменения.");
  } finally {
    athleteSetSaving(false);
  }
}

// Завершение знакомства. Вопросы и ответы загружаются только с сервера.
const ATHLETE_ONBOARDING_URL =
  "https://hdxfmvewlpmknyysrpac.supabase.co/functions/v1/finish-onboarding";

let athleteAiInProgress = false;
let athleteFinishInProgress = false;

function athleteHandleBodyPhotoSelection(input) {
  const selected = Array.from(input.files || []);
  const status = document.getElementById("bodyPhotoStatus");
  const clearButton = document.getElementById("bodyPhotoClearButton");
  input.value = "";

  if (!(Number(registration.athlete.age) >= 18)) {
    if (status) status.textContent = "Анализ фотографий доступен пользователям от 18 лет.";
    return;
  }

  if (selected.length > athleteMaxBodyPhotos) {
    if (status) status.textContent = `Можно выбрать не больше ${athleteMaxBodyPhotos} фото.`;
    return;
  }
  const tooLarge = selected.find(function(file) {
    return !file.type.startsWith("image/") || file.size > 20 * 1024 * 1024;
  });
  if (tooLarge) {
    if (status) status.textContent = tooLarge.size > 20 * 1024 * 1024
      ? "Размер одного фото не должен превышать 20 МБ."
      : "Выбери файл изображения.";
    return;
  }

  athleteBodyPhotoFiles = selected;
  athletePhotoConsent = false;
  registration.athlete.photoNames = selected.map(function() { return "Фото"; });
  if (status) status.textContent = selected.length
    ? `Выбрано фото: ${selected.length} из ${athleteMaxBodyPhotos}. Их можно будет удалить до анализа.`
    : "Фото будут отправлены на анализ только после твоего подтверждения и не сохранятся в профиле TRENZO.";
  if (clearButton) clearButton.hidden = selected.length === 0;
}

function athleteClearBodyPhotos() {
  athleteBodyPhotoFiles = [];
  athletePhotoConsent = false;
  registration.athlete.photoNames = [];
  const status = document.getElementById("bodyPhotoStatus");
  const clearButton = document.getElementById("bodyPhotoClearButton");
  if (status) status.textContent = "Фото не выбраны. Этот шаг можно пропустить.";
  if (clearButton) clearButton.hidden = true;
  const input = document.getElementById("bodyPhotos");
  if (input) input.value = "";
}

function athleteDecodePhoto(file) {
  return new Promise(function(resolve, reject) {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = function() {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = function() {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Не удалось открыть одно из фото. Попробуй JPEG или PNG."));
    };
    image.src = objectUrl;
  });
}

async function athletePrepareBodyPhoto(file) {
  const image = await athleteDecodePhoto(file);
  const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Не удалось подготовить фото к анализу.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let blob = await new Promise(function(resolve) {
    canvas.toBlob(resolve, "image/jpeg", 0.76);
  });
  if (!blob) throw new Error("Не удалось подготовить фото к анализу.");
  if (blob.size > 900 * 1024) {
    blob = await new Promise(function(resolve) {
      canvas.toBlob(resolve, "image/jpeg", 0.58);
    });
  }
  if (!blob || blob.size > 900 * 1024) {
    throw new Error("Фото получилось слишком большим. Попробуй выбрать снимок поменьше.");
  }
  return await new Promise(function(resolve, reject) {
    const reader = new FileReader();
    reader.onload = function() { resolve(String(reader.result || "")); };
    reader.onerror = function() { reject(new Error("Не удалось прочитать фото.")); };
    reader.readAsDataURL(blob);
  });
}

async function athleteOnboardingRequest(action, extra = {}) {
  if (!tg || !tg.initData) {
    throw new Error("Открой TRENZO через Telegram и попробуй снова.");
  }
  const response = await fetch(ATHLETE_ONBOARDING_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, initData: tg.initData, ...extra })
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("Сервер вернул некорректный ответ.");
  }
  if (!response.ok || result.ok !== true) {
    if (response.status === 401) {
      throw new Error("Сессия Telegram устарела. Закрой приложение и открой его заново.");
    }
    throw new Error("Не удалось загрузить или сохранить знакомство. Попробуй ещё раз.");
  }
  return result;
}

// Показываем экран знакомства. Само открытие экрана НЕ вызывает OpenAI.
function athleteRenderComplete(prefetched = null) {
  document.getElementById("athleteScreen")?.classList.remove("has-athlete-bottom-nav");
  const name = athleteEscape(registration.athlete.name || "Друг");

  document.getElementById("athleteScreen").innerHTML = `
    <div class="page">
      <div class="topbar"><div class="logo">TREN<span>ZO</span></div></div>
      <div class="step-label">ПОСЛЕДНИЙ ШАГ</div>
      <h1>${name}, почти готово!</h1>
      <p class="hint">Я изучу твою цель, уточню то, чего не хватает, —
        и мы завершим знакомство.</p>

      <div id="athleteOnboardingStatus" class="info-card" role="status">
        Загружаем сохранённые данные...
      </div>
      ${athleteBodyPhotoFiles.length ? `
        <div class="info-card athlete-photo-consent-card">
          <label class="option" for="athletePhotoConsent">
            <input id="athletePhotoConsent" type="checkbox"
              onchange="athletePhotoConsent = this.checked"${athletePhotoConsent ? " checked" : ""}>
            <span>Я согласен отправить выбранные фото в OpenAI вместе с анкетой для анализа.</span>
          </label>
          <p class="field-hint">TRENZO не сохранит фото в профиле, базе или хранилище. OpenAI может хранить запросы в журналах безопасности до 30 дней.</p>
        </div>
      ` : ""}
      <button id="athleteAnalyzeButton" class="primary-btn" type="button"
        onclick="athleteAnalyzeProfile()" hidden>
        ${athleteBodyPhotoFiles.length ? "Анализировать анкету и фото ✦" : "Анализировать анкету ✦"}
      </button>
      <div id="athleteAiResult" class="info-card"
        style="white-space: pre-wrap;" hidden></div>
      <div id="athleteOnboardingQuestions"></div>
      <div class="form-bottom">
        <button class="secondary-btn" type="button"
          onclick="athleteStep = 13; athleteRender();">
          Посмотреть исходную анкету
        </button>
      </div>
    </div>`;

  window.scrollTo(0, 0);
  athleteLoadOnboarding(prefetched);
}

async function athleteLoadOnboarding(prefetched = null) {
  const statusBox = document.getElementById("athleteOnboardingStatus");
  const introBox = document.getElementById("athleteAiResult");
  const questionsBox = document.getElementById("athleteOnboardingQuestions");
  const analyzeButton = document.getElementById("athleteAnalyzeButton");
  if (!statusBox || !introBox || !questionsBox || !analyzeButton) return;

  statusBox.hidden = false;
  statusBox.textContent = "Загружаем сохранённые данные...";
  analyzeButton.hidden = true;

  try {
    const data = prefetched || await athleteOnboardingRequest("load");
    // Экран могли закрыть, пока сервер отвечал.
    if (document.getElementById("athleteOnboardingStatus") !== statusBox) return;

    if (data.setupStatus === "ready") {
      athleteRenderCabinet();
      return;
    }

    if (typeof data.intro !== "string" || !data.intro.trim()) {
      statusBox.textContent = "Осталось познакомиться с твоей целью.";
      introBox.hidden = true;
      questionsBox.innerHTML = "";
      analyzeButton.hidden = false;
      return;
    }

    statusBox.hidden = true;
    introBox.hidden = false;
    introBox.textContent = data.intro;
    questionsBox.innerHTML = "";

    if (!Array.isArray(data.questions) || data.questions.length > 2) {
      throw new Error("Не удалось загрузить вопросы. Попробуй ещё раз.");
    }

    const items = data.questions;
    const fields = items.map(function(item, index) {
      if (!item || !Number.isSafeInteger(item.id) || item.id < 1 ||
          typeof item.question !== "string") {
        throw new Error("Некорректные данные вопроса.");
      }
      const answer = typeof item.answer === "string" ? item.answer : "";
      return `
        <div class="field">
          <label class="field-title" for="athleteAnswer${item.id}">
            ${index + 1}. ${athleteEscape(item.question)}
          </label>
          <textarea class="text-area" id="athleteAnswer${item.id}"
            data-question-id="${item.id}" maxlength="2000" required
            placeholder="Напиши свой ответ...">${athleteEscape(answer)}</textarea>
        </div>`;
    }).join("");

    questionsBox.innerHTML = `
      <form id="athleteOnboardingForm"
        onsubmit="event.preventDefault(); athleteFinishOnboarding();">
        ${fields}
        <p class="small-note">Ответы сохранятся в твоём профиле.
          На этом этапе не указывай сведения о здоровье и другие чувствительные данные.</p>
        <button type="submit" id="athleteFinishButton" class="primary-btn">
          Завершить знакомство →
        </button>
      </form>`;
  } catch (error) {
    console.error("TRENZO onboarding load failed:", error);
    statusBox.hidden = false;
    statusBox.textContent = error.message || "Не удалось загрузить знакомство.";
  }
}

// Отправляем ответы на сохранённые вопросы. Запроса к OpenAI здесь нет.
async function athleteFinishOnboarding() {
  if (athleteFinishInProgress) return;
  const form = document.getElementById("athleteOnboardingForm");
  const button = document.getElementById("athleteFinishButton");
  if (!form || !button || !form.reportValidity()) return;

  const answers = Array.from(form.querySelectorAll("textarea[data-question-id]"))
    .map(function(area) {
      return { id: Number(area.dataset.questionId), answer: area.value.trim() };
    });

  if (answers.some(function(item) {
    return !Number.isSafeInteger(item.id) || !item.answer ||
      item.answer.length > 2000;
  })) {
    showMessage("Ответь на каждый вопрос (не более 2000 символов).");
    return;
  }

  athleteFinishInProgress = true;
  button.disabled = true;
  button.textContent = "Сохраняем твой профиль...";
  try {
    const result = await athleteOnboardingRequest("finish", { answers });
    if (result.setupStatus !== "ready") {
      throw new Error("Не удалось завершить знакомство.");
    }
    athleteRenderCabinet();
  } catch (error) {
    console.error("TRENZO onboarding finish failed:", error);
    showMessage(error.message || "Не удалось сохранить ответы.");
    button.disabled = false;
    button.textContent = "Завершить знакомство →";
  } finally {
    athleteFinishInProgress = false;
  }
}

// Анализ анкеты выполняется только при первом явном нажатии.
// Если результат уже сохранён, analyze-profile возвращает его без OpenAI.
async function athleteAnalyzeProfile() {
  if (athleteAiInProgress) return;
  const button = document.getElementById("athleteAnalyzeButton");
  const statusBox = document.getElementById("athleteOnboardingStatus");
  if (!button || !statusBox) return;
  if (!tg || !tg.initData) {
    showMessage("Открой TRENZO через Telegram и попробуй снова.");
    return;
  }
  if (athleteBodyPhotoFiles.length && !athletePhotoConsent) {
    showMessage("Подтверди отправку фото для анализа или удали выбранные снимки.");
    return;
  }
  if (athleteBodyPhotoFiles.length && !(Number(registration.athlete.age) >= 18)) {
    showMessage("Анализ фотографий доступен пользователям от 18 лет.");
    return;
  }

  athleteAiInProgress = true;
  button.disabled = true;
  const photosForAnalysis = athleteBodyPhotoFiles.slice(0, athleteMaxBodyPhotos);
  button.textContent = photosForAnalysis.length
    ? "Анализирую анкету и фото..."
    : "Знакомлюсь с твоей целью...";
  statusBox.hidden = false;
  statusBox.textContent = photosForAnalysis.length
    ? "Подготавливаю фото и анализирую анкету."
    : "Смотрю твою анкету. Сейчас разберусь с целью.";

  let imagePayloads = [];
  let requestBody = "";
  try {
    imagePayloads = await Promise.all(photosForAnalysis.map(athletePrepareBodyPhoto));
    requestBody = JSON.stringify({ initData: tg.initData, images: imagePayloads });
    const response = await fetch(
      "https://hdxfmvewlpmknyysrpac.supabase.co/functions/v1/analyze-profile",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody
      }
    );
    imagePayloads.fill("");
    imagePayloads = [];
    requestBody = "";
    const result = await response.json();
    if (!response.ok || result.ok !== true) {
      if (response.status === 401) {
        throw new Error("Сессия Telegram устарела. Закрой приложение и открой его заново.");
      }
      if (response.status === 429) {
        throw new Error("Сервис ИИ временно перегружен. Попробуй ещё раз позже.");
      }
      if (response.status === 413) {
        throw new Error("Фото слишком большие для отправки. Выбери снимки меньшего размера.");
      }
      throw new Error("Не удалось выполнить анализ анкеты.");
    }
    // После успешного анализа очищаем все ссылки на оригиналы и подготовленные копии.
    athleteBodyPhotoFiles = [];
    athletePhotoConsent = false;
    registration.athlete.photoNames = [];
    // Запрашиваем сохранённые вопросы с их ID, чтобы привязать к ним ответы.
    await athleteLoadOnboarding();
  } catch (error) {
    console.error("TRENZO AI analysis failed:", error);
    statusBox.hidden = false;
    statusBox.textContent = error.message || "Не удалось выполнить анализ.";
    button.hidden = false;
  } finally {
    imagePayloads.fill("");
    imagePayloads = [];
    requestBody = "";
    athleteAiInProgress = false;
    button.disabled = false;
    button.textContent = athleteBodyPhotoFiles.length
      ? "Анализировать анкету и фото ✦"
      : "Анализировать анкету ✦";
  }
}

// TRENZO — постоянный личный кабинет после завершения знакомства.
// Пока работающие разделы показывают только сохранённые в анкете данные.
// Никаких вымышленных тренировок, рационов или результатов.

function athleteCabinetValue(value, labels = {}) {
  if (typeof value !== "string" || !value.trim()) return "Не указано";
  return athleteEscape(labels[value] || value);
}

function athleteCabinetRow(label, value, labels = {}) {
  return `<div class="summary-row">
    <small>${athleteEscape(label)}</small>
    <strong>${athleteCabinetValue(value, labels)}</strong>
  </div>`;
}

function athleteCabinetCard(title, rows) {
  return `<div class="info-card">
    <strong class="card-title">${athleteEscape(title)}</strong>
    <div style="margin-top: 14px;">${rows}</div>
  </div>`;
}

let athleteAccountDeleteInProgress = false;

function athleteOpenDeleteAccountDialog() {
  const dialog = document.getElementById("athleteDeleteAccountDialog");
  const phrase = document.getElementById("athleteDeleteAccountPhrase");
  const status = document.getElementById("athleteDeleteAccountStatus");
  if (!dialog || athleteAccountDeleteInProgress) return;
  if (phrase) phrase.value = "";
  if (status) status.textContent = "";
  athleteValidateDeleteAccountPhrase();
  dialog.showModal();
  window.setTimeout(() => phrase?.focus(), 0);
}

function athleteCloseDeleteAccountDialog() {
  if (athleteAccountDeleteInProgress) return;
  document.getElementById("athleteDeleteAccountDialog")?.close();
}

function athleteValidateDeleteAccountPhrase() {
  const phrase = document.getElementById("athleteDeleteAccountPhrase");
  const button = document.getElementById("athleteDeleteAccountSubmit");
  if (!button || athleteAccountDeleteInProgress) return;
  button.disabled = phrase?.value.trim().toLocaleUpperCase("ru-RU") !== "УДАЛИТЬ";
}

async function athleteDeleteAccount() {
  if (athleteAccountDeleteInProgress) return;
  const tg = window.Telegram?.WebApp;
  const phrase = document.getElementById("athleteDeleteAccountPhrase");
  const status = document.getElementById("athleteDeleteAccountStatus");
  const button = document.getElementById("athleteDeleteAccountSubmit");
  if (phrase?.value.trim().toLocaleUpperCase("ru-RU") !== "УДАЛИТЬ") return;
  if (!tg?.initData) {
    if (status) status.textContent = "Открой TRENZO через Telegram и попробуй снова.";
    return;
  }

  athleteAccountDeleteInProgress = true;
  if (button) {
    button.disabled = true;
    button.textContent = "Удаляем данные…";
  }
  if (status) status.textContent = "Проверяем сессию и удаляем связанные данные…";

  try {
    const response = await fetch(
      "https://hdxfmvewlpmknyysrpac.supabase.co/functions/v1/delete-account",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: tg.initData, confirmed: true })
      }
    );
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("Сервер вернул некорректный ответ. Попробуй позже.");
    }
    if (!response.ok || result?.ok !== true) {
      if (response.status === 401) {
        throw new Error("Сессия Telegram устарела. Закрой Mini App и открой его заново.");
      }
      throw new Error("Не удалось удалить аккаунт. Попробуй ещё раз позже.");
    }

    const restart = () => window.location.reload();
    if (tg && typeof tg.showAlert === "function") {
      tg.showAlert("Аккаунт и данные TRENZO удалены. После этого можно начать регистрацию заново.", restart);
    } else {
      alert("Аккаунт и данные TRENZO удалены. Сейчас страница перезагрузится.");
      restart();
    }
  } catch (error) {
    console.error("TRENZO account deletion failed:", error);
    athleteAccountDeleteInProgress = false;
    if (status) status.textContent = error?.message || "Не удалось удалить аккаунт. Попробуй ещё раз.";
    if (button) {
      button.textContent = "Удалить все данные";
      athleteValidateDeleteAccountPhrase();
    }
  }
}

function athleteCabinetHeader(label, title) {
  return `<div class="topbar">
      <div class="logo">TREN<span>ZO</span></div>
    </div>
    <h1 style="margin:0 0 14px;">
      ${athleteEscape(title)}
    </h1>`;
}

function athleteCabinetNavButton(section, symbol, title, detail) {
  // section, symbol и подписи заданы разработчиком, не приходят от пользователя.
  return `<button class="info-card cabinet-nav-button" type="button"
    onclick="athleteOpenCabinetSection('${section}')"
    >
      <span class="cabinet-nav-icon" aria-hidden="true">${symbol}</span>
      <span class="cabinet-nav-copy">
        <strong class="cabinet-nav-title">${title}</strong>
        <span class="cabinet-nav-detail">${detail}</span>
      </span>
      <span class="nutrition-plan-link-arrow" aria-hidden="true">›</span>
  </button>`;
}

function athleteHasUnsavedFormChanges() {
  return Array.from(document.querySelectorAll("#athleteScreen form")).some((form) =>
    Array.from(form.elements).some((field) => {
      if (!field || field.disabled || field.readOnly ||
          ["button", "submit", "reset", "file", "hidden"].includes(field.type)) return false;
      if (field.type === "checkbox" || field.type === "radio") {
        return field.checked !== field.defaultChecked;
      }
      if (field.type === "date") {
        return field.value !== (field.defaultValue || athleteLocalDate());
      }
      if (field.tagName === "SELECT") {
        const selected = Array.from(field.selectedOptions).map((option) => option.value).join("|");
        const original = Array.from(field.options).filter((option) => option.defaultSelected).map((option) => option.value).join("|");
        return selected !== original;
      }
      return field.value !== field.defaultValue;
    })
  );
}

function athleteNavigatePrimaryTab(tab) {
  if (athleteHasUnsavedFormChanges() &&
      !window.confirm("Есть незаполненные изменения. Перейти в другой раздел и потерять их?")) {
    return;
  }
  if (tab === "home") {
    athleteRenderCabinet();
    return;
  }
  athleteOpenCabinetSection(tab);
}

function athleteNavigateBack() {
  const screen = document.getElementById("athleteScreen");
  if (!screen || !screen.classList.contains("has-athlete-bottom-nav")) return;
  if (document.querySelector("#athleteScreen dialog[open]")) return;
  if (athleteHasUnsavedFormChanges() &&
      !window.confirm("Есть незаполненные изменения. Вернуться и потерять их?")) {
    return;
  }
  const target = screen.dataset.backSection || "home";
  if (target === "home") {
    athleteRenderCabinet();
    return;
  }
  athleteOpenCabinetSection(target);
}

let athleteBackSwipeStart = null;

document.addEventListener("touchstart", (event) => {
  const screen = document.getElementById("athleteScreen");
  const touch = event.changedTouches?.[0];
  if (!touch || event.touches.length !== 1 || touch.clientX > 28 ||
      !screen?.classList.contains("active") ||
      !screen.classList.contains("has-athlete-bottom-nav") ||
      document.querySelector("#athleteScreen dialog[open]")) {
    athleteBackSwipeStart = null;
    return;
  }
  athleteBackSwipeStart = { x: touch.clientX, y: touch.clientY, horizontal: false };
}, { passive: true });

document.addEventListener("touchmove", (event) => {
  if (!athleteBackSwipeStart || !event.changedTouches?.[0]) return;
  const touch = event.changedTouches[0];
  const deltaX = touch.clientX - athleteBackSwipeStart.x;
  const deltaY = touch.clientY - athleteBackSwipeStart.y;
  if (deltaX > 8 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
    athleteBackSwipeStart.horizontal = true;
    event.preventDefault();
  } else if (Math.abs(deltaY) > 10 && Math.abs(deltaY) > Math.abs(deltaX)) {
    athleteBackSwipeStart = null;
  }
}, { passive: false });

document.addEventListener("touchend", (event) => {
  if (!athleteBackSwipeStart || !event.changedTouches?.[0]) {
    athleteBackSwipeStart = null;
    return;
  }
  const touch = event.changedTouches[0];
  const deltaX = touch.clientX - athleteBackSwipeStart.x;
  const deltaY = touch.clientY - athleteBackSwipeStart.y;
  const shouldNavigateBack = athleteBackSwipeStart.horizontal &&
    deltaX >= 72 && deltaX > Math.abs(deltaY) * 1.2;
  athleteBackSwipeStart = null;
  if (shouldNavigateBack) athleteNavigateBack();
}, { passive: true });

document.addEventListener("touchcancel", () => {
  athleteBackSwipeStart = null;
}, { passive: true });

function athleteBottomNavigationMarkup(activeSection) {
  const section = String(activeSection || "");
  const activeTab = section === "home" ? "home"
    : section.startsWith("nutrition") ? "nutrition"
    : section.startsWith("training") ? "training"
    : section.startsWith("progress") ? "progress"
    : "";
  const tabs = [
    {
      id: "home",
      label: "Главная",
      action: "athleteNavigatePrimaryTab(\'home\')",
      icon: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" fill="currentColor" stroke="none"/>'
    },
    {
      id: "nutrition",
      label: "Питание",
      action: "athleteNavigatePrimaryTab(\'nutrition\')",
      icon: '<circle cx="14" cy="12" r="7"/><path d="M3 4v6m3-6v6M3 7h3m-1.5 3v10"/>'
    },
    {
      id: "training",
      label: "Тренировки",
      action: "athleteNavigatePrimaryTab(\'training\')",
      icon: '<path d="M3 9v6m3-9v12m2-6h8m2-6v12m3-9v6"/>'
    },
    {
      id: "progress",
      label: "Прогресс",
      action: "athleteNavigatePrimaryTab(\'progress\')",
      icon: '<path d="M4 20V12h4v8zm6 0V7h4v13zm6 0V3h4v17z" fill="currentColor" stroke="none"/>'
    }
  ];

  return `<nav class="athlete-bottom-nav" aria-label="Основные разделы">
    ${tabs.map((tab) => `<button class="athlete-bottom-nav-item${activeTab === tab.id ? " is-active" : ""}"
      type="button" onclick="${tab.action}"${activeTab === tab.id ? ' aria-current="page"' : ""}>
      <svg class="athlete-bottom-nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${tab.icon}</svg>
      <span class="athlete-bottom-nav-label">${tab.label}</span>
      <span class="athlete-bottom-nav-indicator" aria-hidden="true"></span>
    </button>`).join("")}
  </nav>`;
}

function athleteRenderCabinet() {
  const screen = document.getElementById("athleteScreen");
  screen.classList.add("has-athlete-bottom-nav");
  screen.dataset.backSection = "home";
  screen.innerHTML = `
    <div class="page athlete-cabinet-page" style="display:block;min-height:0;padding-bottom:24px;">
      <div class="topbar" style="margin-bottom:12px;"><div class="logo">TREN<span>ZO</span></div></div>
      <section class="info-card athlete-dashboard-summary" aria-label="Твои показатели">
        <h2>Твои показатели</h2>
        <div class="athlete-dashboard-metrics">
          <div><strong id="athleteDashboardWorkoutCount">—</strong><span>тренировок</span></div>
          <div><strong id="athleteDashboardWeight">—</strong><span>текущий вес</span></div>
          <div class="athlete-dashboard-adherence" id="athleteDashboardAdherence">
            <strong id="athleteDashboardAdherenceValue">—</strong><span>соблюдение плана</span>
          </div>
        </div>
        <div class="athlete-dashboard-adherence-hint" id="athleteDashboardAdherenceHint" hidden></div>
      </section>
      <button class="info-card athlete-dashboard-next" id="athleteDashboardNextWorkout" type="button" onclick="athleteOpenCabinetSection('training-plan')">
        <span class="athlete-dashboard-next-copy">
          <span class="athlete-dashboard-eyebrow">СЛЕДУЮЩАЯ ТРЕНИРОВКА</span>
          <strong>Загружаем план…</strong>
        </span>
        <span class="nutrition-plan-link-arrow" aria-hidden="true">›</span>
      </button>
      <div class="athlete-cabinet-links" style="display:flex;flex-direction:column;gap:10px;margin:12px 0 0;align-items:stretch;">
        ${athleteCabinetNavButton("profile", "◉", "Мой профиль",
          "Цель, анкета, данные")}
        ${athleteCabinetNavButton("nutrition", "✦", "Питание",
          "Рацион на неделю, отчёты")}
        ${athleteCabinetNavButton("training", "↗", "Тренировочный план",
          "Программа, отчёты")}
        ${athleteCabinetNavButton("progress", "▥", "Прогресс",
          "Динамика результатов")}
      </div>
    </div>
    ${athleteBottomNavigationMarkup("home")}`;
  window.scrollTo(0, 0);
  athleteLoadCabinetDashboard();
}

function athleteDashboardSetValue(id, value) {
  const slot = document.getElementById(id);
  if (slot) slot.textContent = value;
}

function athleteDashboardRenderAdherence(nutrition, training) {
  const value = document.getElementById("athleteDashboardAdherenceValue");
  const hint = document.getElementById("athleteDashboardAdherenceHint");
  if (!value || !hint) return;
  const missing = [];
  if (nutrition == null) missing.push(`<button type="button" onclick="athleteOpenCabinetSection('nutrition-diary')">Заполни питание</button>`);
  if (training == null) missing.push(`<button type="button" onclick="athleteOpenCabinetSection('training')">Добавь план тренировок</button>`);
  if (missing.length) {
    value.textContent = "—";
    hint.innerHTML = `Чтобы посчитать общий показатель: ${missing.join(" · ")}`;
    hint.hidden = false;
    return;
  }
  value.textContent = `${Math.max(1, Math.min(100, Math.round((nutrition + training) / 2)))}%`;
  hint.textContent = "Среднее выполнение плана питания и тренировок за эту неделю";
  hint.hidden = false;
}

function athleteDashboardNutritionPercent(plan, entries) {
  const days = plan && Array.isArray(plan.weekPlan) ? plan.weekPlan : [];
  if (plan?.reviewRequired || days.length !== 7 || !Array.isArray(entries)) return null;
  const targets = {
    calories: days.reduce((sum, day) => sum + Number(day.calories || 0), 0) / 7,
    protein_g: days.reduce((sum, day) => sum + Number(day.protein_g || 0), 0) / 7,
    fat_g: days.reduce((sum, day) => sum + Number(day.fat_g || 0), 0) / 7,
    carbs_g: days.reduce((sum, day) => sum + Number(day.carbs_g || 0), 0) / 7
  };
  if (Object.values(targets).some(target => !Number.isFinite(target) || target <= 0)) return null;
  const weekStart = athleteNutritionWeekStart(athleteLocalDate());
  const today = athleteLocalDate();
  const logged = entries.filter(entry => entry?.report_date >= weekStart && entry?.report_date <= today);
  if (!logged.length) return null;
  const percentages = Object.keys(targets).map(key => {
    const average = logged.reduce((sum, row) => sum + Math.max(0, Number(row[key]) || 0), 0) / logged.length;
    return Math.min(100, average / targets[key] * 100);
  });
  return percentages.every(Number.isFinite)
    ? percentages.reduce((sum, percent) => sum + percent, 0) / percentages.length
    : null;
}

function athleteDashboardTrainingPercent(plan) {
  const sessions = Array.isArray(plan?.sessions) ? plan.sessions : [];
  if (!sessions.length || plan?.reviewRequired) return null;
  return sessions.filter(session => session?.completed === true).length / sessions.length * 100;
}

async function athleteLoadCabinetDashboard() {
  const nextSlot = document.getElementById("athleteDashboardNextWorkout");
  if (!nextSlot) return;
  const weightSlot = document.getElementById("athleteDashboardWeight");
  const adherenceValue = document.getElementById("athleteDashboardAdherenceValue");
  if (adherenceValue) adherenceValue.textContent = "—";

  const results = await Promise.allSettled([
    athleteTrainingRequest("load_history"),
    athleteTrainingRequest("load_plan"),
    athleteNutritionRequest("load_plan"),
    athleteEnsureNutritionLoaded(),
    athleteEnsureWeightLoaded()
  ]);
  if (document.getElementById("athleteDashboardNextWorkout") !== nextSlot) return;

  const history = results[0].status === "fulfilled" ? results[0].value : null;
  const trainingPlan = results[1].status === "fulfilled" ? results[1].value.plan : null;
  const nutritionResult = results[2].status === "fulfilled" ? results[2].value : null;
  const nutritionEntries = results[3].status === "fulfilled" ? results[3].value : null;
  const weights = results[4].status === "fulfilled" ? results[4].value : [];

  if (history) {
    const workoutCount = history.totalWorkouts ?? (history.hasMore ? "50+" : history.workouts?.length ?? 0);
    athleteDashboardSetValue("athleteDashboardWorkoutCount", String(workoutCount));
  } else {
    athleteDashboardSetValue("athleteDashboardWorkoutCount", "—");
  }
  if (weightSlot) weightSlot.textContent = weights.length ? `${athleteFormatWeight(weights[weights.length - 1].kg)} кг` : "Не указан";

  const sessions = Array.isArray(trainingPlan?.sessions) ? trainingPlan.sessions : [];
  const nextSessionIndex = sessions.findIndex(session => session?.completed !== true);
  if (trainingPlan && nextSessionIndex >= 0) {
    const session = sessions[nextSessionIndex];
    const label = session.title || session.name || `Тренировка ${nextSessionIndex + 1}`;
    const exerciseCount = Array.isArray(session.exercises) ? session.exercises.length : 0;
    nextSlot.onclick = () => athleteOpenCabinetSection("training-plan");
    nextSlot.innerHTML = `<span class="athlete-dashboard-next-copy"><span class="athlete-dashboard-eyebrow">СЛЕДУЮЩАЯ ТРЕНИРОВКА</span><strong>${athleteEscape(label)}</strong><span class="athlete-dashboard-next-meta">${exerciseCount ? athleteTrainingCountLabel(exerciseCount, "упражнение", "упражнения", "упражнений") : "Тренировка по плану"}</span></span><span class="nutrition-plan-link-arrow" aria-hidden="true">›</span>`;
  } else {
    nextSlot.onclick = () => athleteOpenCabinetSection("training");
    nextSlot.innerHTML = `<span class="athlete-dashboard-next-copy"><span class="athlete-dashboard-eyebrow">СЛЕДУЮЩАЯ ТРЕНИРОВКА</span><strong>${trainingPlan && sessions.length ? "План на эту неделю завершён" : "Тренировка пока не запланирована"}</strong><span class="athlete-dashboard-next-meta">${trainingPlan && sessions.length ? "Открой план тренировок" : "Составь план тренировок"}</span></span><span class="nutrition-plan-link-arrow" aria-hidden="true">›</span>`;
  }

  athleteDashboardRenderAdherence(
    nutritionResult?.plan ? athleteDashboardNutritionPercent(nutritionResult.plan, nutritionEntries) : null,
    trainingPlan ? athleteDashboardTrainingPercent(trainingPlan) : null
  );
}

function athleteSkipTrainingUpload() {
  athleteAdaptationNextWeekRequested = false;
  return athleteRunAdaptationGeneration(null, false);
}

function athleteOpenTrainingEntryMethods() {
  athleteOpenCabinetSection("training-upload");
  requestAnimationFrame(() => {
    document.getElementById("athleteTrainingEntryMethodDialog")?.showModal();
  });
}

function athleteOpenCabinetSection(section) {
  const d = athleteSafeAnswers();
  const screen = document.getElementById("athleteScreen");
  if (!screen) return;
  let title = "";
  let content = "";

  if (section === "profile") {
    title = "Мой профиль";
    const goals = {
      lose: "Снизить вес", muscle: "Набрать мышечную массу",
      recomp: "Изменить состав тела", strength: "Увеличить силовые показатели",
      fitness: "Улучшить физическую форму", other: "Другая цель"
    };
    const sexes = {
      male: "Мужской", female: "Женский",
      unspecified: "Предпочитаю не указывать"
    };
    content = athleteCabinetCard("Личные данные",
      athleteCabinetRow("Имя", d.name) +
      athleteCabinetRow("Возраст", d.age ? d.age + " лет" : "") +
      athleteCabinetRow("Пол", d.sex, sexes) +
      athleteCabinetRow("Рост", d.height ? d.height + " см" : "") +
      athleteCabinetRow("Вес при регистрации", d.weight ? d.weight + " кг" : "")) +
      `<div id="athleteProfileWeight" class="info-card" role="status">
        Загружаем последний зафиксированный вес...
      </div>` +
      athleteCabinetCard("Цель",
        athleteCabinetRow("Направление", d.goal, goals) +
        athleteCabinetRow("Желаемый результат", d.result) +
        athleteCabinetRow("Желаемый вес", d.targetWeight ? d.targetWeight + " кг" : "") +
        athleteCabinetRow("Желаемый срок", d.months ? d.months + " мес." : "")) +
      athleteCabinetCard("Тренировки и питание",
        athleteCabinetRow("Тренировочный опыт", d.experience, {
          new: "Только начинаю", under1: "До 1 года", "1to3": "От 1 до 3 лет",
          "3to5": "От 3 до 5 лет", "5plus": "Более 5 лет"
        }) +
        athleteCabinetRow("Последние 3 месяца", d.recentTraining, {
          none: "Почти не тренировался", irregular: "Нерегулярно",
          "1to2": "1–2 раза в неделю", "3plus": "3 и более раз в неделю",
          program: "Регулярно по программе"
        }) +
        athleteCabinetRow("Тренировок в неделю", d.frequency) +
        athleteCabinetRow("Длительность тренировки", d.duration, {
          under45: "До 45 минут", "45to60": "45–60 минут",
          "60to90": "60–90 минут", over90: "Более 90 минут"
        }) +
        athleteCabinetRow("Формат занятий", d.trainingMode, {
          alone: "Самостоятельно", coach: "С тренером",
          mixed: "Самостоятельно и с тренером", starting: "Планирую начать"
        }) +
        athleteCabinetRow("Питание", d.nutritionTracking, {
          regular: "Слежу регулярно", sometimes: "Иногда слежу", no: "Пока не слежу"
        }) +
        athleteCabinetRow("Готовность вести учёт", d.nutritionWilling, {
          yes: "Да", maybe: "Скорее да", no: "Пока нет"
        }) +
        athleteCabinetRow("Приёмов пищи в день", d.meals, {
          "1to2": "1–2", "3": "3", "4": "4", "5plus": "5 и более",
          varies: "Каждый день по-разному"
        }) +
        athleteCabinetRow("Особенности питания", d.nutritionNotes) +
        athleteCabinetRow("Программа тренировок", d.programStatus, {
          yes: "Есть программа", partial: "Есть отдельные упражнения", no: "Программы пока нет"
        })) +
      `<p class="small-note">Здесь показаны сохранённые данные анкеты.
        Изменение ответов добавим отдельно. Сведения о здоровье,
        фотографии и файлы в тестовой версии не сохраняются.</p>` +
      `<section class="account-delete-zone" aria-labelledby="athleteDeleteAccountTitle">
        <h2 id="athleteDeleteAccountTitle">Удаление аккаунта</h2>
        <p>Удалить профиль TRENZO и связанные с ним данные, чтобы пройти регистрацию заново.</p>
        <button class="account-delete-button" type="button"
          onclick="athleteOpenDeleteAccountDialog()">Удалить аккаунт</button>
      </section>
      <dialog id="athleteDeleteAccountDialog" class="nutrition-help-dialog account-delete-dialog"
        aria-labelledby="athleteDeleteAccountDialogTitle"
        oncancel="if (athleteAccountDeleteInProgress) event.preventDefault()">
        <div class="nutrition-help-dialog-heading">
          <h3 id="athleteDeleteAccountDialogTitle">Удалить аккаунт?</h3>
          <button class="secondary-btn nutrition-help-close" type="button"
            aria-label="Закрыть" onclick="athleteCloseDeleteAccountDialog()">×</button>
        </div>
        <p>Это безвозвратно удалит из TRENZO профиль и ответы анкеты, вес и замеры,
          записи питания, планы, историю тренировок и подключение FatSecret.</p>
        <p>Сам аккаунт Telegram не затрагивается. Чтобы подтвердить удаление,
          введи слово <strong>УДАЛИТЬ</strong>.</p>
        <label class="account-delete-confirm-label" for="athleteDeleteAccountPhrase">Подтверждение</label>
        <input id="athleteDeleteAccountPhrase" class="account-delete-confirm-input"
          type="text" autocomplete="off" autocapitalize="characters" spellcheck="false"
          oninput="athleteValidateDeleteAccountPhrase()">
        <p id="athleteDeleteAccountStatus" class="account-delete-status" role="status" aria-live="polite"></p>
        <div class="account-delete-actions">
          <button id="athleteDeleteAccountSubmit" class="account-delete-confirm" type="button"
            disabled onclick="athleteDeleteAccount()">Удалить все данные</button>
          <button class="secondary-btn" type="button"
            onclick="athleteCloseDeleteAccountDialog()">Отмена</button>
        </div>
      </dialog>`;
  } else if (section === "nutrition") {
  title = "Питание";

  content = `
    <div class="info-card nutrition-control-card" style="margin-bottom:16px;">
      <button class="nutrition-help-button" type="button" aria-label="Как считаются шкалы питания?" onclick="document.getElementById('athleteNutritionHelpDialog').showModal()"><span>?</span></button>
      <div class="nutrition-control-heading">
        <h3 style="margin:0;">Контроль питания</h3>
        <p class="nutrition-control-subtitle">Твоя дневная цель на эту неделю</p>
      </div>
      <div id="athleteNutritionOverviewTargets">
        <p style="color:#aaa;margin:0;">Показатели появятся после анализа питания.</p>
      </div>
    </div>
    ${athleteNutritionProgressHelpMarkup()}
    <button
      class="info-card nutrition-plan-link"
      type="button"
      onclick="athleteOpenCabinetSection('nutrition-diary')"
      aria-label="Открыть дневник питания"
    >
      <span class="nutrition-plan-link-copy">
        <strong>Дневник питания</strong>
        <span>Загрузка питания и история по дням</span>
      </span>
      <span class="nutrition-plan-link-arrow" aria-hidden="true">›</span>
    </button>

    <button class="info-card nutrition-plan-link" type="button"
      onclick="athleteOpenCabinetSection('nutrition-plan')"
      aria-label="Открыть план питания и рекомендации">
      <span class="nutrition-plan-link-copy">
        <strong>План питания</strong>
        <span id="athleteNutritionPlanCardStatus">Цели на неделю и рекомендации</span>
      </span>
      <span class="nutrition-plan-link-arrow" aria-hidden="true">›</span>
    </button>
  `;

} else if (section === "nutrition-plan") {
  title = "План питания";
  content = `
    <p id="athleteNutritionPlanStatus" class="nutrition-plan-status" role="status">
      Загружаем план питания...
    </p>
    <div id="athleteNutritionPlanOutput"></div>
    <button id="athleteNutritionAnalyzeButton" class="primary-btn"
      type="button" onclick="athleteGenerateNutritionPlan()" disabled>
      Сформировать план питания
    </button>
  `;

} else if (section === "nutrition-diary") {
  title = "Дневник питания";

  content = `
    <div id="athleteNutritionIntroCard" class="info-card" style="margin-bottom:16px;">
      <div style="color:#ff7846;font-weight:700;letter-spacing:2px;margin-bottom:12px;">
        ЭТАП 1 · ЗНАКОМСТВО С РАЦИОНОМ
      </div>

      <h3 style="margin:0 0 16px;">
        Сначала узнаем, как ты питаешься
      </h3>

      <p>
        В течение первых 7 дней не нужно специально менять привычное питание.
        Наша задача — собрать данные о твоём текущем рационе.
      </p>

      <p>
        Установи удобное приложение для учёта питания. Взвешивай продукты,
        записывай всё, что ешь и пьёшь, а в конце каждого дня загружай
        итоговый скриншот с калориями, белками, жирами и углеводами.
      </p>
    </div>

<div id="athleteNutritionProgressCard" class="info-card" style="margin-bottom:16px;">
  <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
    <strong>Добавлено дней</strong>
    <strong id="athleteNutritionDaysCount" style="color:#ff7846;">0 из 7</strong>
  </div>

  <div
  id="athleteNutritionDaysProgress"
  style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;margin-top:16px;"
>
    <span style="height:10px;border-radius:4px;background:#414141;"></span>
    <span style="height:10px;border-radius:4px;background:#414141;"></span>
    <span style="height:10px;border-radius:4px;background:#414141;"></span>
    <span style="height:10px;border-radius:4px;background:#414141;"></span>
    <span style="height:10px;border-radius:4px;background:#414141;"></span>
    <span style="height:10px;border-radius:4px;background:#414141;"></span>
    <span style="height:10px;border-radius:4px;background:#414141;"></span>
  </div>

  <p style="color:#aaa;margin:16px 0 0;">
    После семи заполненных дней мы сможем оценить твой привычный рацион.
  </p>
</div>

<div
  id="athleteNutritionCompletionMessage"
  class="info-card"
  role="status"
  hidden
  style="position:relative;margin-bottom:16px;padding-right:56px;"
>
  <button
    type="button"
    onclick="athleteDismissNutritionCompletion()"
    aria-label="Закрыть сообщение"
    style="
      position:absolute;
      top:12px;
      right:12px;
      width:36px;
      height:36px;
      border:1px solid #484848;
      border-radius:10px;
      background:#303030;
      color:#fff;
      font-size:24px;
      line-height:1;
      cursor:pointer;
    "
  >×</button>

  <strong style="display:block;margin:0 0 10px;">
    Отлично, этап знакомства с рационом пройден.
  </strong>
  <p style="color:#aaa;margin:0;">
    Мы собрали достаточно данных, чтобы проанализировать твой текущий рацион.
  </p>
</div>

<div class="info-card nutrition-control-card" style="margin-bottom:16px;">
  <button class="nutrition-help-button" type="button" aria-label="Как считаются шкалы питания?" onclick="document.getElementById('athleteNutritionHelpDialog').showModal()"><span>?</span></button>
  <div class="nutrition-control-heading">
    <h3 style="margin:0;">Контроль питания</h3>
    <p class="nutrition-control-subtitle">Твоя дневная цель на эту неделю</p>
  </div>

  <div id="athleteNutritionDiaryTargets">
    <p style="color:#aaa;margin:0;">
      Показатели появятся после анализа питания.
    </p>
  </div>
</div>
${athleteNutritionProgressHelpMarkup()}

  <button
  class="primary-btn"
  type="button"
  style="margin-bottom:16px;"
  onclick="document.getElementById('nutritionEntryMethodSheet').showModal()"
>
  + Внести КБЖУ
</button>

<dialog
  id="nutritionEntryMethodSheet"
  class="nutrition-help-dialog nutrition-entry-method-dialog"
  aria-labelledby="nutritionEntryMethodTitle"
>
  <div class="nutrition-help-dialog-heading">
    <h3 id="nutritionEntryMethodTitle">Как внести КБЖУ?</h3>
    <button class="nutrition-help-close" type="button"
      onclick="this.closest('dialog').close()" aria-label="Закрыть">
      ×
    </button>
  </div>

  <div class="nutrition-entry-method-options">
    <button class="info-card" type="button"
      onclick="this.closest('dialog').close();document.getElementById('nutritionFatSecretSheet').showModal()"
    >
      <strong>FatSecret</strong>
      <p style="color:#aaa;margin:6px 0 0;">
        Подключить аккаунт или импортировать данные за месяц
      </p>
    </button>

    <button class="info-card" type="button"
      onclick="this.closest('dialog').close();athleteOpenNutritionUpload()"
    >
      <strong>Загрузить скриншот</strong>
      <p style="color:#aaa;margin:6px 0 0;">
        Распознать итоговые калории и БЖУ за день
      </p>
    </button>

    <button class="info-card" type="button"
      onclick="this.closest('dialog').close();athleteOpenManualNutrition()"
    >
      <strong>Внести вручную</strong>
      <p style="color:#aaa;margin:6px 0 0;">
        Указать дату, калории, белки, жиры и углеводы
      </p>
    </button>
  </div>
</dialog>

<dialog
  id="nutritionFatSecretSheet"
  style="
    position:fixed;
    inset:auto 0 calc(env(safe-area-inset-bottom, 0px) + 16px);
    width:100%;
    max-width:520px;
    box-sizing:border-box;
    max-height:calc(100vh - 32px);
    max-height:calc(100dvh - 32px);
    overflow-y:auto;
    overscroll-behavior:contain;
    -webkit-overflow-scrolling:touch;
    margin:0 auto;
    padding:24px;
    padding-bottom:24px;
    border:1px solid #414141;
    border-radius:24px;
    background:#262626;
    color:#fff;
    box-shadow:0 -12px 50px #0008;
  "
>
  <div style="
    width:44px;
    height:5px;
    margin:0 auto 24px;
    border-radius:999px;
    background:#555;
  "></div>

  <div style="display:flex;align-items:center;justify-content:space-between;
    gap:12px;margin-bottom:20px;">
    <h3 style="margin:0;">FatSecret</h3>
    <button type="button" onclick="this.closest('dialog').close()"
      aria-label="Закрыть"
      style="width:36px;height:36px;flex-shrink:0;border:1px solid #484848;
        border-radius:10px;background:#303030;color:#fff;font-size:24px;cursor:pointer;">
      ×
    </button>
  </div>

  <button id="athleteFatSecretConnectButton"
    class="secondary-btn" type="button"
    onclick="athleteConnectFatSecret()" style="margin:0 0 20px;">
    Подключить FatSecret
  </button>

  <label class="field-title" for="athleteFatSecretTestDate">
    Месяц импорта
  </label>
  <input class="text-input" id="athleteFatSecretTestDate"
    type="month" style="color-scheme:dark;">

  <button class="primary-btn" type="button"
    onclick="athleteTestFatSecretDay()" style="width:100%;margin-top:20px;">
    Импортировать данные за месяц
  </button>
</dialog>

<dialog
  id="nutritionUploadSheet"
  style="
    position:fixed;
    inset:auto 0 calc(env(safe-area-inset-bottom, 0px) + 16px);
    width:100%;
    max-width:520px;
    box-sizing:border-box;
    max-height:calc(100vh - 32px);
    max-height:calc(100dvh - 32px);
    overflow-y:auto;
    overscroll-behavior:contain;
    -webkit-overflow-scrolling:touch;
    margin:0 auto;
    padding:24px;
    padding-bottom:24px;
    border:1px solid #414141;
    border-radius:24px;
    background:#262626;
    color:#fff;
    box-shadow:0 -12px 50px #0008;
  "
>
  <div style="
    width:44px;
    height:5px;
    margin:0 auto 24px;
    border-radius:999px;
    background:#555;
  "></div>

  <div style="
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    margin-bottom:24px;
  ">
    <h3 style="margin:0;">Отчёт питания</h3>

    <button
      type="button"
      onclick="this.closest('dialog').close()"
      style="
        width:36px;
        height:36px;
        flex-shrink:0;
        border:1px solid #484848;
        border-radius:10px;
        background:#303030;
        color:#fff;
        font-size:24px;
        cursor:pointer;
      "
    >×</button>
  </div>

  <label
    for="nutritionReportDate"
    style="display:block;margin-bottom:10px;font-weight:600;"
  >
    Дата отчёта
  </label>

  <input
    id="nutritionReportDate"
    type="date"
    required
    style="
      display:block;
      width:100%;
      box-sizing:border-box;
      padding:14px;
      margin-bottom:24px;
      border:1px solid #484848;
      border-radius:12px;
      background:#303030;
      color:#fff;
      font:inherit;
      color-scheme:dark;
    "
  >

  <label
    for="nutritionReportImage"
    style="display:block;margin-bottom:10px;font-weight:600;"
  >
    Скриншот питания
  </label>

  <label
    for="nutritionReportImage"
    style="
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      gap:10px;
      min-height:120px;
      padding:16px;
      border:1px dashed #ff7846;
      border-radius:14px;
      background:#332d29;
      text-align:center;
      cursor:pointer;
    "
  >
    <span style="font-size:32px;color:#ff7846;">＋</span>
    <strong style="color:#fff;">Выбрать скриншот</strong>
    <span style="color:#aaa;font-size:13px;">
      Итоги дня с калориями и БЖУ
    </span>
  </label>

  <input
  id="nutritionReportImage"
  type="file"
  accept="image/*"
  style="display:none;"
  onchange="
    const file = this.files[0];
    const sheet = this.closest('dialog');
    const label = this.previousElementSibling.querySelector('strong');
    const button = sheet.querySelector('button.primary-btn');

    label.textContent = file ? '✓ ' + file.name : 'Выбрать скриншот';
    label.style.overflowWrap = 'anywhere';

    button.disabled = !file;
    button.style.opacity = file ? '1' : '0.5';
  "
>

  <button
    class="primary-btn"
    type="button"
    onclick="athleteSaveNutritionReport()"
    disabled
    style="width:100%;margin-top:24px;opacity:0.5;"
  >
    Распознать и сохранить
  </button>
</dialog>

<dialog
  id="nutritionManualSheet"
  style="
    position:fixed;
    inset:auto 0 calc(env(safe-area-inset-bottom, 0px) + 16px);
    width:100%;
    max-width:520px;
    box-sizing:border-box;
    max-height:calc(100vh - 32px);
    max-height:calc(100dvh - 32px);
    overflow-y:auto;
    overscroll-behavior:contain;
    -webkit-overflow-scrolling:touch;
    margin:0 auto;
    padding:24px;
    padding-bottom:24px;
    border:1px solid #414141;
    border-radius:24px;
    background:#262626;
    color:#fff;
    box-shadow:0 -12px 50px #0008;
  "
>
  <div style="
    width:44px;
    height:5px;
    margin:0 auto 24px;
    border-radius:999px;
    background:#555;
  "></div>

  <div style="
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    margin-bottom:24px;
  ">
    <h3 style="margin:0;">Внести КБЖУ вручную</h3>

    <button
      type="button"
      onclick="this.closest('dialog').close()"
      aria-label="Закрыть"
      style="
        width:36px;
        height:36px;
        flex-shrink:0;
        border:1px solid #484848;
        border-radius:10px;
        background:#303030;
        color:#fff;
        font-size:24px;
        cursor:pointer;
      "
    >×</button>
  </div>

  <form id="athleteNutritionManualForm"
    onsubmit="event.preventDefault();athleteSaveManualNutrition();">
    <div class="field">
      <label class="field-title" for="nutritionManualDate">
        Дата
      </label>
      <input class="text-input" id="nutritionManualDate"
        type="date" required style="color-scheme:dark;">
    </div>

    <div class="field">
      <label class="field-title" for="nutritionManualCalories">
        Калории, ккал
      </label>
      <input class="text-input" id="nutritionManualCalories"
        type="number" inputmode="decimal" min="0" max="10000"
        step="1" required placeholder="Например, 2100">
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;">
      <div>
        <label class="field-title" for="nutritionManualProtein">
          Белки, г
        </label>
        <input class="text-input" id="nutritionManualProtein"
          type="number" inputmode="decimal" min="0" max="1000"
          step="0.1" required placeholder="120">
      </div>
      <div>
        <label class="field-title" for="nutritionManualFat">
          Жиры, г
        </label>
        <input class="text-input" id="nutritionManualFat"
          type="number" inputmode="decimal" min="0" max="1000"
          step="0.1" required placeholder="70">
      </div>
      <div>
        <label class="field-title" for="nutritionManualCarbs">
          Углеводы, г
        </label>
        <input class="text-input" id="nutritionManualCarbs"
          type="number" inputmode="decimal" min="0" max="1000"
          step="0.1" required placeholder="240">
      </div>
    </div>

    <button class="primary-btn" type="submit"
      style="width:100%;margin-top:24px;">
      Сохранить
    </button>
  </form>
</dialog>

    <div class="info-card" style="margin-top:16px;">
      <h3 style="margin-top:0;">История питания</h3>
      <div id="athleteNutritionHistory">
  <p style="color:#aaa;margin-bottom:0;">
    Пока нет сохранённых отчётов.
  </p>
</div>
    </div>
  `;
  } else if (section === "training") {
    if (athleteTrainingSetupMode === null) {
      athleteTrainingSetupMode = d.programStatus === "yes" ? "upload" : "adaptation";
    }
    title = "Тренировочный план";
    content = `
      <section class="info-card nutrition-control-card training-control-card" aria-labelledby="trainingControlTitle">
        <button class="nutrition-help-button" type="button" aria-label="Как считаются шкалы тренировок?" onclick="document.getElementById('athleteTrainingHelpDialog').showModal()"><span>?</span></button>
        <div class="nutrition-control-heading">
          <h3 id="trainingControlTitle" style="margin:0;">Контроль тренировок</h3>
          <p class="nutrition-control-subtitle">Твоя тренировочная цель на эту неделю</p>
        </div>
        ${athleteTrainingControlMarkup()}
      </section>
      ${d.programStatus === "yes"
          ? `<button class="info-card nutrition-plan-link training-upload-card" type="button" onclick="athleteOpenCabinetSection('training-upload')">
            <span class="training-module-card-copy">
              <strong>Загрузить тренировки</strong>
              <span>Добавь занятия из своей программы — это будет первым шагом к её анализу</span>
            </span>
            <span class="nutrition-plan-link-arrow" aria-hidden="true">›</span>
          </button>`
          : `<button class="info-card nutrition-plan-link training-upload-card" type="button" onclick="athleteOpenTrainingEntryMethods()">
            <span class="training-module-card-copy">
              <strong>Добавить тренировку</strong>
              <span>Введи её вручную или распознай по фото — запись сохранится в истории</span>
            </span>
            <span class="nutrition-plan-link-arrow" aria-hidden="true">›</span>
          </button>`}
      ${athleteTrainingPlan
        ? `<button class="info-card training-module-card training-plan-module-card" type="button" onclick="athleteOpenCabinetSection('training-plan')">
            <strong>План тренировок</strong><span>Открыть план на неделю</span><span class="nutrition-plan-link-arrow" aria-hidden="true">›</span>
          </button>`
        : d.programStatus !== "yes"
          ? `<section class="info-card training-module-card training-adaptation-module-card">
            <strong>План тренировок</strong>
            <span>${athleteTrainingSetupMode === "adaptation_selected"
              ? `Адаптация · неделя ${athleteTrainingPlan?.adaptationWeek || 1} из 3`
              : "Подготовим первую неделю по твоей анкете. Тренировки можно проходить в удобные дни."}</span>
            ${athleteTrainingSetupMode === "adaptation_selected"
              ? `<button class="training-adaptation-start" type="button" onclick="athleteOpenCabinetSection('training-plan')">Открыть план</button>`
              : `<button class="training-adaptation-start" type="button" onclick="athleteSkipTrainingUpload()" ${athleteAdaptationGenerationLoading ? "disabled" : ""}>${athleteAdaptationGenerationLoading ? "Составляем план…" : "Начать адаптацию"}</button>`}
          </section>`
          : `<section class="info-card training-module-card training-module-card-disabled" aria-disabled="true">
            <strong>План тренировок</strong>
            <span>${athleteTrainingPlanLoading
              ? "Загружаем сохранённый план…"
              : athleteEscape(athleteTrainingPlanError || (
                  athleteTrainingSetupMode === "adaptation_selected"
                    ? "Появится после генерации адаптационного плана"
                    : d.programStatus === "yes"
                      ? "Появится после анализа загруженных тренировок"
                      : "Начни с адаптации, чтобы подготовить план"
                ))}</span>
          </section>`}
      <button class="info-card training-history-card" type="button" onclick="athleteOpenCabinetSection('training-history')">
        <span class="training-module-card-copy">
          <strong>История тренировок</strong>
          <span>Сохранённые тренировки, упражнения и подходы</span>
        </span>
        <span class="nutrition-plan-link-arrow" aria-hidden="true">›</span>
      </button>
      <dialog id="athleteTrainingHelpDialog" class="nutrition-help-dialog" aria-labelledby="athleteTrainingHelpTitle">
        <div class="nutrition-help-dialog-heading">
          <h3 id="athleteTrainingHelpTitle">Как считаются шкалы?</h3>
          <button class="nutrition-help-close" type="button" onclick="this.closest('dialog').close()" aria-label="Закрыть">×</button>
        </div>
      </dialog>`;
  } else if (section === "training-upload") {
    title = "Загрузка тренировок";
    content = `
      <div id="athleteTrainingUploadPaths" class="training-upload-paths">
        ${athleteTrainingUploadPathsMarkup()}
      </div>
      <dialog id="athleteTrainingProgramHelpDialog" class="nutrition-help-dialog" aria-labelledby="athleteTrainingProgramHelpTitle">
        <div class="nutrition-help-dialog-heading">
          <h3 id="athleteTrainingProgramHelpTitle">Загрузка тренировок</h3>
          <button class="nutrition-help-close" type="button" onclick="this.closest('dialog').close()" aria-label="Закрыть">×</button>
        </div>
        <p>Добавь минимум 3 тренировки из своей актуальной программы. Чем больше занятий ты загрузишь, тем точнее мы сможем оценить упражнения и нагрузку и составить план тренировок на неделю.</p>
      </dialog>
      <dialog id="athleteTrainingEntryMethodDialog" class="nutrition-help-dialog nutrition-entry-method-dialog" aria-labelledby="athleteTrainingEntryMethodTitle">
        <div class="nutrition-help-dialog-heading">
          <h3 id="athleteTrainingEntryMethodTitle">Как добавить тренировки?</h3>
          <button class="nutrition-help-close" type="button" onclick="this.closest('dialog').close()" aria-label="Закрыть">×</button>
        </div>
        <div class="nutrition-entry-method-options">
          <button class="info-card" type="button"
            onclick="this.closest('dialog').close();athleteOpenManualTraining()">
            <strong>Ввести вручную</strong>
            <p>Указать дату, упражнения, подходы и повторения</p>
          </button>
          <button class="info-card" type="button"
            onclick="this.closest('dialog').close();athleteOpenTrainingPhoto()">
            <strong>Скриншот или фото</strong>
            <p>Распознать, проверить и при необходимости исправить перед сохранением</p>
          </button>
        </div>
      </dialog>
      <input id="athleteTrainingImageInput" class="visually-hidden" type="file" accept="image/*" onchange="athleteSelectTrainingPhoto(this)">
      <dialog id="athleteTrainingPhotoDialog" class="nutrition-help-dialog training-photo-dialog" aria-labelledby="athleteTrainingPhotoTitle" oncancel="if (athleteTrainingPhotoSaving) event.preventDefault()">
        <div class="nutrition-help-dialog-heading">
          <h3 id="athleteTrainingPhotoTitle">Добавить тренировку по фото</h3>
          <button class="nutrition-help-close" type="button" onclick="athleteCloseTrainingPhotoDialog()" aria-label="Закрыть">×</button>
        </div>
        <label class="training-manual-date-label" for="athleteTrainingPhotoDate">Дата тренировки</label>
        <input class="text-input training-manual-date" id="athleteTrainingPhotoDate" type="date" required style="color-scheme:dark;">
        <button class="training-adaptation-start training-photo-add" type="button" onclick="athleteChooseTrainingPhoto()">Добавить фото</button>
        <p class="training-photo-source-hint">Сфотографируй тренировку или выбери готовое фото или скриншот.</p>
        <p id="athleteTrainingPhotoFilename" class="training-photo-filename">Фото ещё не выбрано</p>
        <p class="training-photo-note">Фото используется только для распознавания. После сохранения в истории останутся данные тренировки, не изображение.</p>
        <p id="athleteTrainingPhotoError" class="training-manual-error" role="alert" hidden></p>
        <button id="athleteTrainingPhotoRecognize" class="primary-btn training-manual-save" type="button" onclick="athleteParseTrainingPhoto()" disabled>Распознать и продолжить</button>
      </dialog>
      <dialog id="athleteTrainingManualDialog" class="nutrition-help-dialog training-manual-dialog" aria-labelledby="athleteTrainingManualTitle">
        <div class="nutrition-help-dialog-heading">
          <h3 id="athleteTrainingManualTitle">Новая тренировка</h3>
          <button class="nutrition-help-close" type="button" onclick="this.closest('dialog').close()" aria-label="Закрыть">×</button>
        </div>
        <form id="athleteTrainingManualForm" onsubmit="event.preventDefault();athleteSaveManualTraining();">
          <p id="athleteTrainingReviewNote" class="training-review-note" hidden>Проверь распознанные данные. Нераспознанные поля оставлены пустыми — заполни их перед сохранением.</p>
          <label class="training-manual-date-label" for="athleteTrainingManualDate">Дата тренировки</label>
          <input class="text-input training-manual-date" id="athleteTrainingManualDate" name="workoutDate" type="date" required style="color-scheme:dark;">
          <div id="athleteTrainingExercises" class="training-exercise-list"></div>
          <button class="training-add-exercise" type="button" onclick="athleteAddTrainingExercise()">＋ Добавить упражнение <span>1 из 15</span></button>
          <p id="athleteTrainingManualError" class="training-manual-error" role="alert" hidden></p>
          <button id="athleteTrainingManualSave" class="primary-btn training-manual-save" type="submit">Сохранить тренировку</button>
        </form>
      </dialog>
      `;
  } else if (section === "training-history") {
    title = "История тренировок";
    content = `
      <div id="athleteTrainingHistory" class="training-history-list" aria-live="polite">
        <p class="training-history-status">Загружаем тренировки…</p>
      </div>`;
  } else if (section === "training-plan") {
    title = "План тренировок";
    content = `<div id="athleteTrainingPlanContent" class="training-plan-content" aria-live="polite">
      ${athleteTrainingPlan ? athleteTrainingPlanMarkup(athleteTrainingPlan) : `<p class="training-history-status">${athleteTrainingPlanLoading ? "Загружаем план…" : athleteEscape(athleteTrainingPlanError || "План пока не создан.")}</p>`}
    </div>`;
  } else if (section === "progress") {
    title = "Прогресс";
    content = `
      <div class="info-card cabinet-history-card" style="margin:0 !important;">
        <div class="step-label" style="margin:0 0 8px;">ТВОЯ ИСТОРИЯ</div>
        <strong class="card-title">Каждая тренировка — часть прогресса</strong>
        <p class="card-copy" style="margin:8px 0 0;">
          Вес уже сохраняется. Силовые результаты и тренировки появятся здесь,
          когда подключим тренировочные отчёты.
        </p>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;margin:12px 0 0;align-items:stretch;">
        <button class="info-card cabinet-nav-button cabinet-nav-button-comfortable" type="button" onclick="athleteOpenCabinetSection('progress-body')">
          <span class="cabinet-nav-icon cabinet-nav-icon-large" aria-hidden="true">↗</span>
          <span class="cabinet-nav-copy">
            <strong class="cabinet-nav-title">Вес и тело</strong>
            <span id="athleteProgressWeightPreview" role="status"
              class="cabinet-nav-detail cabinet-nav-detail-compact">
              История измерений и график
            </span>
          </span>
          <span class="nutrition-plan-link-arrow" aria-hidden="true">›</span>
        </button>
        ${athleteCabinetNavButton("progress-strength", "↗", "Силовые показатели",
          "Результаты и личные рекорды по упражнениям")}
        ${athleteCabinetNavButton("progress-workouts", "▦", "Тренировки",
          "Календарь, количество занятий и регулярность")}
        ${athleteCabinetNavButton("progress-volume", "≋", "Тренировочный объём",
          "Рабочие подходы, повторения и нагрузка")}
        ${athleteCabinetNavButton("progress-achievements", "★", "Мои достижения",
          "Личные рекорды и важные этапы")}
      </div>`;
  } else if (section === "progress-body") {
  title = "Вес и тело";

  content = `
    <div style="display:flex;flex-direction:column;gap:10px;margin:0;align-items:stretch;">

      ${athleteCabinetNavButton(
        "progress-weight",
        "↗",
        "Вес",
        "История веса, график и новые записи"
      )}

      ${athleteCabinetNavButton(
        "progress-measurements",
        "↔",
        "Замеры тела",
        "Объёмы и изменения тела"
      )}

    </div>`;

  } else if (section === "progress-weight") {
title = "Вес";
    content = `<div id="athleteWeightHistory" class="info-card" role="status"
        style="margin:0 !important;">Загружаем историю веса...</div>` +
      athleteCabinetCard("Записать вес",
        `<form id="athleteWeightForm" onsubmit="event.preventDefault(); athleteSaveWeight();">
          <div class="field">
            <label class="field-title" for="athleteWeightDate">Дата взвешивания</label>
            <input class="text-input" id="athleteWeightDate" type="date" required
              value="${athleteLocalDate()}" max="${athleteLocalDate()}">
          </div>
          <div class="field">
            <label class="field-title" for="athleteWeightKg">Вес, кг</label>
            <input class="text-input" id="athleteWeightKg" type="number" required
              min="25" max="400" step="0.1" placeholder="Например, 89.2">
          </div>
          <p class="small-note">Если за эту дату уже есть ручная запись,
            мы обновим её. Вес при регистрации останется прежним.</p>
          <button id="athleteWeightSaveButton" class="primary-btn" type="submit">
            Сохранить вес →
          </button>
        </form>`);
} else if (section === "progress-measurements") {
  title = "Замеры тела";

  content = `
    <div class="info-card"
      style="margin:0 !important;padding:0;overflow:hidden;">

     <div style="width:100%;overflow:hidden;">
  <table style="
    width:calc(100% - 16px);
    table-layout:fixed;
    border-collapse:collapse;
    font-size:11px;
    text-align:center;
  ">
<colgroup>
  <col style="width:22%;">
  <col style="width:13%;">
  <col style="width:13%;">
  <col style="width:13%;">
  <col style="width:13%;">
  <col style="width:13%;">
  <col style="width:13%;">
</colgroup>
          <thead>
            <tr style="color:#aaa;">
              <th style="padding:14px 10px;text-align:left;">Дата</th>
              <th style="padding:14px 10px;">Плечи</th>
              <th style="padding:14px 10px;">Грудь</th>
              <th style="padding:14px 10px;">Талия</th>
              <th style="padding:14px 10px;">Бёдра</th>
              <th style="padding:14px 10px;">Бицепс</th>
              <th style="padding:14px 10px;">Бедро</th>
            </tr>
          </thead>

          <tbody id="athleteMeasurementsTable">
            <tr>
              <td colspan="7"
                style="padding:28px 16px;color:#888;text-align:center;
                border-top:1px solid #414141;">
                Пока нет сохранённых замеров
              </td>
            </tr>
          </tbody>

        </table>
      </div>

   </div>
<div class="info-card"
  style="margin:16px 0 0 !important;padding:16px;">

  <strong class="card-title">
    Динамика изменений
  </strong>

  <p class="card-copy card-copy-support" style="margin:6px 0 16px;">
    Сравнение с первым замером
  </p>

  <div id="athleteMeasurementsDynamics"
    role="status"
    class="card-copy">

    Для сравнения нужны минимум два замера.

  </div>

</div>
<button class="primary-btn" type="button"
  style="margin-top:16px;"
 onclick="athleteOpenCabinetSection('progress-measurements-form')">
  Записать замеры →
</button>`;

 } else if (section === "progress-measurements-form") {
  title = "Новые замеры";

  content = `
    <form id="athleteMeasurementsForm">

      <div class="field">
        <label class="field-title" for="athleteMeasurementDate">
          Дата замера
        </label>

        <input class="text-input"
          id="athleteMeasurementDate"
          type="date"
          value="${athleteLocalDate()}"
          max="${athleteLocalDate()}"
          required>
      </div>

      <div class="field">
        <label class="field-title" for="athleteShoulders">
          Плечи, см
        </label>
        <input class="text-input"
          id="athleteShoulders"
          type="number"
          min="1"
          step="0.1"
          placeholder="Например, 120">
      </div>

      <div class="field">
        <label class="field-title" for="athleteChest">
          Грудь, см
        </label>
        <input class="text-input"
          id="athleteChest"
          type="number"
          min="1"
          step="0.1"
          placeholder="Например, 98">
      </div>

      <div class="field">
        <label class="field-title" for="athleteWaist">
          Талия, см
        </label>
        <input class="text-input"
          id="athleteWaist"
          type="number"
          min="1"
          step="0.1"
          placeholder="Например, 76">
      </div>

      <div class="field">
        <label class="field-title" for="athleteHips">
          Бёдра, см
        </label>
        <input class="text-input"
          id="athleteHips"
          type="number"
          min="1"
          step="0.1"
          placeholder="Например, 102">
      </div>

      <div class="field">
        <label class="field-title" for="athleteBiceps">
          Бицепс, см
        </label>
        <input class="text-input"
          id="athleteBiceps"
          type="number"
          min="1"
          step="0.1"
          placeholder="Например, 34">
      </div>

      <div class="field">
        <label class="field-title" for="athleteThigh">
          Бедро, см
        </label>
        <input class="text-input"
          id="athleteThigh"
          type="number"
          min="1"
          step="0.1"
          placeholder="Например, 58">
      </div>

      <button class="primary-btn" type="button"
  onclick="athleteSaveMeasurements()">
  Сохранить замеры →
</button>

    </form>`;
  } else if (["progress-strength", "progress-workouts", "progress-volume", "progress-achievements"].includes(section)) {
    const pending = {
      "progress-strength": ["Силовые показатели", "Здесь появятся результаты по каждому упражнению, рабочие веса, повторения и личные рекорды."],
      "progress-workouts": ["Тренировки", "Здесь появятся количество выполненных занятий, календарь и регулярность тренировок."],
      "progress-volume": ["Тренировочный объём", "Здесь будут подсчитываться рабочие подходы, повторения и объём нагрузки по упражнениям."],
      "progress-achievements": ["Мои достижения", "Здесь будут отмечаться подтверждённые личные рекорды и важные этапы тренировок."]
    }[section];
    title = pending[0];
    content = `<div class="info-card" style="margin:0 !important;">
      <strong>Пока нет данных для этого раздела</strong>
      <p style="margin-bottom:0;">${pending[1]}</p>
      <p class="small-note">Подключим данные из сохранённых тренировочных отчётов.
        Заполнять их повторно в «Прогрессе» не придётся.</p>
    </div>`;
  } else {
    return;
  }

  const progressSubpage = section.startsWith("progress-");

let backSection = "home";
if (section === "nutrition-diary") {
  backSection = "nutrition";

} else if (section === "nutrition-plan") {
  backSection = "nutrition";

} else if (section === "training-upload") {
  backSection = "training";

} else if (section === "training-history") {
  backSection = "training";

} else if (section === "training-plan") {
  backSection = "training";

} else if (section === "progress-measurements-form") {
  backSection = "progress-measurements";

} else if (
  section === "progress-weight" ||
  section === "progress-measurements"
) {
  backSection = "progress-body";

} else if (progressSubpage) {
  backSection = "progress";
}
  screen.classList.add("has-athlete-bottom-nav");
  screen.dataset.backSection = backSection;
  screen.innerHTML = `<div class="page" style="display:block;min-height:0;padding-bottom:24px;">
    <div class="topbar" style="margin-bottom:12px;justify-content:space-between;">
  <div class="logo">TREN<span>ZO</span></div>
  <button class="back-button athlete-desktop-back-button" type="button"
    onclick="athleteNavigateBack()" aria-label="Назад" title="Назад">←</button>
</div>
    <h1 style="margin:0 0 16px;">${athleteEscape(title)}</h1>
    ${content}
  </div>
  ${athleteBottomNavigationMarkup(section)}`;
  window.scrollTo(0, 0);

  if (section === "profile") {
    athleteLoadProfileWeight();
  }
  if (section === "progress") {
    athleteLoadProgressWeightPreview();
  }
  if (section === "progress-weight") {
    if (athleteWeightLoaded) athleteRenderWeightHistory();
    else athleteLoadWeightHistory();
  }
  if (section === "progress-measurements") {
  athleteLoadMeasurementsTable();
}
  if (section === "nutrition-diary") {
  athleteLoadNutritionHistory();
  athleteLoadNutritionPlan();
}
  if (section === "nutrition" || section === "nutrition-plan") {
  athleteLoadNutritionPlan();
  }
  if (section === "training-history") {
    athleteLoadTrainingHistory();
  }
  if (section === "training" || section === "training-plan") {
    athleteLoadTrainingPlan();
  }
  if (section === "training-upload") {
    athleteRefreshTrainingUploadState();
  }
}

function athleteTrainingUploadPathsMarkup() {
  const enoughWorkouts = athleteTrainingWorkoutCount !== null && athleteTrainingWorkoutCount >= 3;
  const workoutCount = athleteTrainingWorkoutCount || 0;
  const uploadDescription = enoughWorkouts
    ? `Загружено тренировок: ${workoutCount}. Можно добавить ещё — это поможет точнее оценить упражнения и нагрузку.`
    : `Добавь минимум 3 тренировки — мы учтём упражнения и нагрузку.${workoutCount ? ` Сейчас загружено: ${workoutCount}.` : ""}`;

  return `<section class="info-card training-upload-path${enoughWorkouts ? " training-upload-path-ready" : ""}">
      <div class="training-upload-path-heading">
        <strong>Есть актуальная программа тренировок?</strong>
        <button class="nutrition-help-button training-upload-help" type="button" aria-label="Зачем загружать тренировки?" onclick="document.getElementById('athleteTrainingProgramHelpDialog').showModal()"><span>?</span></button>
      </div>
      <div class="training-upload-path-copy"><p>${uploadDescription}</p></div>
      ${enoughWorkouts
        ? `<button class="primary-btn training-upload-start" type="button" onclick="athleteGenerateTrainingPlan()" ${athleteTrainingPlanLoading ? "disabled" : ""}>${athleteTrainingPlanLoading ? "Анализируем тренировки…" : "Анализировать тренировочный план"}</button>
           <p class="training-analysis-hint">Ответ об ограничениях будет временно передан ИИ-сервису для анализа и не сохранится в профиле.</p>
           <button class="training-adaptation-start training-upload-add-more" type="button" onclick="document.getElementById('athleteTrainingEntryMethodDialog').showModal()">Добавить ещё тренировки</button>`
        : `<button class="primary-btn training-upload-start" type="button" onclick="document.getElementById('athleteTrainingEntryMethodDialog').showModal()">Загрузить программу</button>`}
    </section>
    ${athleteTrainingUploadStateError || (enoughWorkouts && athleteTrainingPlanError)
      ? `<p class="training-upload-state-error" role="status">${athleteEscape(athleteTrainingUploadStateError || athleteTrainingPlanError)}</p>`
      : ""}`;
}

async function athleteRefreshTrainingUploadState() {
  try {
    const result = await athleteTrainingRequest("load_history");
    athleteTrainingWorkoutCount = Array.isArray(result.workouts) ? result.workouts.length : 0;
    if (result.hasMore === true) athleteTrainingWorkoutCount = Math.max(51, athleteTrainingWorkoutCount);
    athleteTrainingUploadStateError = "";
  } catch (error) {
    console.error("TRENZO training upload status failed:", error);
    athleteTrainingWorkoutCount = null;
    athleteTrainingUploadStateError = "Не удалось проверить загруженные тренировки. Попробуй обновить экран.";
  }

  const slot = document.getElementById("athleteTrainingUploadPaths");
  if (slot) slot.innerHTML = athleteTrainingUploadPathsMarkup();
}

// История веса: отдельная защищённая Edge Function с проверкой Telegram.
// Вес из анкеты не перезаписываем. Все измерения читаем с сервера.
const ATHLETE_WEIGHT_URL =
  "https://hdxfmvewlpmknyysrpac.supabase.co/functions/v1/weight-history";
const ATHLETE_MEASUREMENTS_URL =
  "https://hdxfmvewlpmknyysrpac.supabase.co/functions/v1/body-measurements";
const ATHLETE_TRAINING_URL =
  "https://hdxfmvewlpmknyysrpac.supabase.co/functions/v1/training-report";
let athleteWeightEntries = [];
let athleteWeightLoaded = false;
let athleteWeightPending = null;
let athleteWeightPeriod = "all";
let athleteWeightSaving = false;

function athleteLocalDate() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")].join("-");
}

async function athleteWeightRequest(action, extra = {}) {
  if (!tg || !tg.initData) {
    throw new Error("Открой TRENZO через Telegram и попробуй снова.");
  }
  const response = await fetch(ATHLETE_WEIGHT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, initData: tg.initData, ...extra })
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("Сервер вернул некорректный ответ.");
  }
  if (!response.ok || result.ok !== true) {
    if (response.status === 401) {
      throw new Error("Сессия Telegram устарела. Закрой Mini App и открой заново.");
    }
    if (response.status === 400) {
      throw new Error("Проверь дату и вес: от 25 до 400 кг, точность до 0,1 кг.");
    }
    throw new Error("Не удалось загрузить или сохранить вес. Попробуй ещё раз.");
  }
  return result;
}

async function athleteMeasurementsRequest(action, extra = {}) {
  if (!tg || !tg.initData) {
    throw new Error("Открой TRENZO через Telegram и попробуй снова.");
  }

  const response = await fetch(ATHLETE_MEASUREMENTS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action,
      initData: tg.initData,
      ...extra
    })
  });

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("Сервер вернул некорректный ответ.");
  }

  if (!response.ok || result.ok !== true) {
    if (response.status === 401) {
      throw new Error("Сессия Telegram устарела. Закрой Mini App и открой заново.");
    }

    if (response.status === 400) {
      throw new Error("Проверь дату и значения замеров.");
    }

    throw new Error("Не удалось загрузить или сохранить замеры. Попробуй ещё раз.");
  }

  return result;
}
async function athleteNutritionRequest(action, extra = {}) {
  if (!tg || !tg.initData) {
    throw new Error("Открой TRENZO через Telegram и попробуй снова.");
  }

  const response = await fetch(
    "https://hdxfmvewlpmknyysrpac.supabase.co/functions/v1/nutrition-report",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        initData: tg.initData,
        ...extra
      })
    }
  );

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("Сервер вернул некорректный ответ.");
  }

  if (!response.ok || result.ok !== true) {
    if (response.status === 401) {
      throw new Error("Сессия Telegram устарела. Закрой Mini App и открой заново.");
    }

    if (response.status === 403) {
      throw new Error("Сначала заверши анкету в TRENZO, затем попробуй снова.");
    }

    if (response.status === 409) {
      throw new Error(
        "За эту дату данные уже сохранены. Выбери другую дату."
      );
    }

    if (response.status === 413) {
      throw new Error("Изображение слишком большое. Выбери скриншот меньшего размера.");
    }

    if (response.status === 422) {
      if (action === "generate_plan") {
        throw new Error(result.message || "Для анализа не хватает данных анкеты или дневника.");
      }
      throw new Error(
        "Не удалось распознать все показатели. Проверь, что на скриншоте видны итоговые калории и БЖУ за день."
      );
    }

    if (response.status === 429) {
      throw new Error("Сервис ИИ временно перегружен. Попробуй ещё раз позже.");
    }

    if (response.status === 400) {
      if (action === "save_manual") {
        throw new Error("Проверь дату и значения КБЖУ.");
      }

      throw new Error("Проверь дату отчёта и формат изображения.");
    }

    throw new Error("Не удалось обработать отчёт питания. Попробуй ещё раз.");
  }

  return result;
}

let athleteTrainingSaving = false;
let athleteTrainingPhotoFile = null;
let athleteTrainingPhotoSaving = false;
let athleteTrainingPlan = null;
let athleteTrainingPlanLoading = false;
let athleteTrainingPlanError = "";
let athleteAdaptationGenerationLoading = false;
let athleteTrainingPlanLoaded = false;

async function athleteTrainingRequest(action, extra = {}) {
  if (!tg || !tg.initData) {
    throw new Error("Открой TRENZO через Telegram и попробуй снова.");
  }

  const response = await fetch(ATHLETE_TRAINING_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, initData: tg.initData, ...extra })
  });

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("Сервер вернул некорректный ответ.");
  }

  if (!response.ok || result.ok !== true) {
    if (response.status === 401) {
      throw new Error("Сессия Telegram устарела. Закрой Mini App и открой его заново.");
    }
    if (response.status === 400) {
      throw new Error(result.message || result.error || "Проверь дату и данные тренировки.");
    }
    if (response.status === 413) {
      throw new Error("Изображение слишком большое. Выбери файл до 4 МБ.");
    }
    if (response.status === 422) {
      if (action === "generate_plan" || action === "generate_adaptation_plan") {
        throw new Error(result.message || "Для анализа пока не хватает данных тренировок.");
      }
      throw new Error(result.message || "Не удалось распознать упражнения и подходы. Попробуй более чёткое фото.");
    }
    if (response.status === 403 && (action === "generate_plan" || action === "generate_adaptation_plan" || action === "load_plan")) {
      throw new Error(result.message || "Сначала заверши анкету в TRENZO, затем попробуй снова.");
    }
    if (response.status === 409 && (action === "generate_plan" || action === "generate_adaptation_plan" || action === "complete_plan_session" || action === "complete_adaptation_session")) {
      throw new Error(result.message || "План уже обновился. Обнови экран и попробуй снова.");
    }
    if (response.status === 429) {
      throw new Error("Сервис ИИ временно перегружен. Попробуй ещё раз позже.");
    }
    if (action === "load_history") {
      throw new Error(result.message || "Не удалось загрузить историю тренировок. Попробуй ещё раз.");
    }
    if (action === "parse_image" && result.message) {
      throw new Error(result.message);
    }
    if (action === "generate_plan" || action === "generate_adaptation_plan") {
      throw new Error(result.message || "Не удалось составить план тренировок. Попробуй ещё раз.");
    }
    if (action === "load_plan") {
      throw new Error(result.message || "Не удалось загрузить план тренировок.");
    }
    if (action === "complete_plan_session" || action === "complete_adaptation_session") {
      throw new Error(result.message || "Не удалось сохранить тренировку. Попробуй ещё раз.");
    }
    throw new Error(action === "parse_image"
      ? "Не удалось распознать фото тренировки. Попробуй другое изображение."
      : "Не удалось сохранить тренировку. Попробуй ещё раз.");
  }

  return result;
}

function athleteTrainingPlanMarkup(plan) {
  if (!plan || typeof plan !== "object") return "<p>План пока недоступен.</p>";
  if (plan.reviewRequired) {
    return `<section class="info-card training-plan-review"><strong>Нужна индивидуальная оценка специалиста</strong>
      <p>${athleteEscape(plan.reviewReason || "По указанным ограничениям нельзя безопасно автоматически составить план.")}</p>
      <p>Не выполняй упражнения, которые вызывают боль или противоречат рекомендациям врача.</p></section>`;
  }
  const sessions = Array.isArray(plan.sessions) ? plan.sessions : [];
  const hasCompletedSession = sessions.some((session) => session.completed === true);
  const allSessionsCompleted = sessions.length > 0 && sessions.every((session) => session.completed === true);
  const isAdaptation = plan.sourceType === "adaptation";
  const adaptationWeek = Math.max(1, Math.min(3, Number(plan.adaptationWeek) || 1));
  const sessionCards = sessions.map((session, index) => {
    const exercises = Array.isArray(session.exercises) ? session.exercises : [];
    const completed = session.completed === true;
    const exerciseCount = exercises.length;
    const setCount = exercises.reduce((total, exercise) =>
      total + Math.max(1, Math.min(20, Number.parseInt(exercise.sets, 10) || 1)), 0);
    const repetitionTotal = athleteTrainingPlanRepetitionTotal(exercises);
    const sessionMetrics = [
      athleteTrainingCountLabel(exerciseCount, "упражнение", "упражнения", "упражнений"),
      athleteTrainingCountLabel(setCount, "подход", "подхода", "подходов"),
      repetitionTotal === null
        ? "повторения уточняются"
        : repetitionTotal.min === repetitionTotal.max
          ? athleteTrainingCountLabel(repetitionTotal.min, "повторение", "повторения", "повторений")
          : `${repetitionTotal.min}–${repetitionTotal.max} повторений`
    ].join(" · ");
    const fields = exercises.map((exercise, exerciseIndex) => {
      const setCount = Math.max(1, Math.min(20, Number.parseInt(exercise.sets, 10) || 1));
      const weight = exercise.weightKg === null || exercise.weightKg === undefined
        ? null
        : Number(exercise.weightKg);
      const weightLabel = weight === null
        ? plan.sourceType === "adaptation" ? "подбери нагрузку" : "привычный вес"
        : weight === 0 ? "без доп. веса" : `${athleteEscape(weight)} кг`;
      return `<section class="training-plan-exercise">
        <div class="training-plan-exercise-heading">
          <strong>${athleteEscape(exercise.name || "Упражнение")}</strong>
          <span>${athleteTrainingCountLabel(setCount, "подход", "подхода", "подходов")}</span>
        </div>
        <div class="training-plan-set-list">
          ${Array.from({ length: setCount }, (_, setIndex) => `<div class="training-plan-set-row">
            <span class="training-plan-set-number">Подход ${setIndex + 1}</span>
            <span class="training-plan-set-target"><strong>${athleteEscape(exercise.reps || "по плану")}</strong><small>${weightLabel}</small></span>
            ${completed
              ? `<span class="training-plan-set-completed" aria-label="Подход выполнен">✓</span>`
              : isAdaptation
                ? `<span class="training-plan-adaptation-inputs">
                    <input class="training-plan-reps-input training-plan-weight-input" type="number" name="weight-${index}-${exerciseIndex}-${setIndex}" min="0" max="1000" step="0.25" inputmode="decimal" required value="${weight === null ? "" : athleteEscape(weight)}" placeholder="кг" aria-label="Фактический вес в килограммах, подход ${setIndex + 1}, ${athleteEscape(exercise.name || "упражнение")}">
                    <input class="training-plan-reps-input" type="number" name="reps-${index}-${exerciseIndex}-${setIndex}" min="1" max="300" step="1" inputmode="numeric" required placeholder="повторы" aria-label="Фактические повторения, подход ${setIndex + 1}, ${athleteEscape(exercise.name || "упражнение")}">
                  </span>`
                : `<input class="training-plan-reps-input" type="number" name="reps-${index}-${exerciseIndex}-${setIndex}" min="1" max="300" step="1" inputmode="numeric" required placeholder="—" aria-label="Фактические повторения, подход ${setIndex + 1}, ${athleteEscape(exercise.name || "упражнение")}">`}
          </div>`).join("")}
        </div>
        ${exercise.restSeconds ? `<p class="training-plan-exercise-note">Отдых между подходами: ${athleteEscape(exercise.restSeconds)} сек.</p>` : ""}
        ${exercise.notes ? `<p class="training-plan-exercise-note">${athleteEscape(exercise.notes)}</p>` : ""}
      </section>`;
    }).join("");
    return `<details class="info-card training-plan-session${completed ? " is-completed" : ""}">
      <summary class="training-plan-session-summary">
        <span class="training-plan-session-copy">
          <span class="training-plan-session-day">Тренировка ${index + 1}</span>
          <strong>${athleteEscape(session.title || session.type || `Тренировка ${index + 1}`)}</strong>
          <small>${sessionMetrics}${completed ? " · Выполнена" : ""}</small>
        </span>
        <span class="training-plan-session-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div class="training-plan-session-body">
        ${session.focus ? `<p class="training-plan-focus">${athleteEscape(session.focus)}</p>` : ""}
        ${completed
          ? `<p class="training-plan-completed-note">✓ Тренировка сохранена в истории.</p>`
          : `<form class="training-plan-session-form${isAdaptation ? " is-adaptation" : ""}" onsubmit="event.preventDefault();athleteCompletePlannedSession(event, ${index})">
              <p class="training-plan-entry-hint">${isAdaptation
                ? "Для адаптации запиши фактические килограммы и повторы в каждом подходе. Если упражнение без дополнительного веса, укажи 0 кг. Начинай осторожно; добавляй только минимальный шаг и не повышай вес через боль или нарушение техники."
                : "В каждом подходе указан вес и диапазон повторений. После подхода впиши, сколько повторов сделал."}</p>
              <div class="training-plan-exercises">${fields}</div>
              ${session.notes ? `<p class="training-plan-session-note">${athleteEscape(session.notes)}</p>` : ""}
              <p class="training-plan-form-error" role="alert" hidden></p>
              <button class="primary-btn training-plan-complete-button" type="submit">Завершить и сохранить</button>
            </form>`}
      </div>
    </details>`;
  }).join("");
  return `<section class="training-plan-intro info-card">
    <span class="step-label">${isAdaptation ? `АДАПТАЦИЯ · НЕДЕЛЯ ${adaptationWeek} ИЗ 3` : "ПЛАН НА НЕДЕЛЮ"}</span><h2>${athleteEscape(plan.title || "Тренировочный план")}</h2>
    <p>${athleteEscape(plan.summary || "План составлен на основе анкеты и журнала тренировок.")}</p>
    ${plan.dataQuality ? `<p class="training-plan-quality">${athleteEscape(plan.dataQuality)}</p>` : ""}
  </section>
  ${sessionCards || `<section class="info-card">Тренировки на эту неделю не добавлены.</section>`}
  ${plan.progression ? `<section class="info-card training-plan-guidance"><strong>Как прогрессировать</strong><p>${athleteEscape(plan.progression)}</p></section>` : ""}
  ${plan.recovery ? `<section class="info-card training-plan-guidance"><strong>Восстановление</strong><p>${athleteEscape(plan.recovery)}</p></section>` : ""}
  ${plan.coachNote ? `<p class="small-note">${athleteEscape(plan.coachNote)}</p>` : ""}
  ${isAdaptation
    ? adaptationWeek < 3
      ? allSessionsCompleted
        ? `<button class="primary-btn training-plan-next-adaptation" type="button" onclick="athleteOpenNextAdaptationDialog()" ${athleteTrainingPlanLoading ? "disabled" : ""}>${athleteTrainingPlanLoading ? "Готовим следующую неделю…" : `Перейти к неделе ${adaptationWeek + 1}`}</button>`
        : `<p class="training-plan-locked-note">Следующая неделя откроется после завершения всех тренировок этой недели. Дни выбирай сам.</p>`
      : allSessionsCompleted
        ? `<p class="training-plan-locked-note">Адаптационный период завершён. Фактические веса и повторы сохранены в истории тренировок.</p>`
        : `<p class="training-plan-locked-note">После завершения всех тренировок завершится адаптационный период.</p>`
    : hasCompletedSession
      ? `<p class="training-plan-locked-note">План уже начат. Его можно пересоставить на следующей неделе.</p>`
      : `<button class="training-plan-refresh" type="button" onclick="athleteRegenerateTrainingPlan()" ${athleteTrainingPlanLoading ? "disabled" : ""}>${athleteTrainingPlanLoading ? "Обновляем план…" : "Пересоставить план"}</button>`}
  ${athleteTrainingPlanError ? `<p class="training-upload-state-error" role="alert">${athleteEscape(athleteTrainingPlanError)}</p>` : ""}`;
}

async function athleteCompletePlannedSession(event, sessionIndex) {
  if (athleteTrainingSaving) return;
  const form = event.currentTarget;
  const error = form.querySelector(".training-plan-form-error");
  const submit = form.querySelector(".training-plan-complete-button");
  if (!form.reportValidity() || !error || !submit) return;

  const session = athleteTrainingPlan?.sessions?.[sessionIndex];
  if (!session || session.completed === true) return;
  const isAdaptation = athleteTrainingPlan.sourceType === "adaptation";
  const exercises = (Array.isArray(session.exercises) ? session.exercises : []).map((exercise, exerciseIndex) => {
    const setCount = Math.max(1, Math.min(20, Number.parseInt(exercise.sets, 10) || 1));
    const weight = exercise.weightKg === null || exercise.weightKg === undefined
      ? null
      : Number(exercise.weightKg);
    return {
      name: String(exercise.name || "").trim(),
      superset_with_previous: Boolean(exercise.supersetWithPrevious),
      sets: Array.from({ length: setCount }, (_, setIndex) => ({
        weight_kg: isAdaptation
          ? Number(form.elements.namedItem(`weight-${sessionIndex}-${exerciseIndex}-${setIndex}`)?.value)
          : weight,
        reps: Number(form.elements.namedItem(`reps-${sessionIndex}-${exerciseIndex}-${setIndex}`)?.value),
        is_failure: false,
      })),
    };
  });
  if (!exercises.length || exercises.some((exercise) => !exercise.name || exercise.sets.some((set) => !Number.isInteger(set.reps) || set.reps < 1 || set.reps > 300 || (isAdaptation && (!Number.isFinite(set.weight_kg) || set.weight_kg < 0 || set.weight_kg > 1000))))) {
    error.textContent = isAdaptation ? "Укажи фактический вес и повторы в каждом подходе. Для упражнения без дополнительного веса введи 0 кг." : "Проверь количество повторений в каждом подходе.";
    error.hidden = false;
    return;
  }

  athleteTrainingSaving = true;
  error.hidden = true;
  submit.disabled = true;
  submit.textContent = "Сохраняем тренировку…";
  form.querySelectorAll("input").forEach((input) => { input.disabled = true; });
  try {
    const completionResult = await athleteTrainingRequest(isAdaptation ? "complete_adaptation_session" : "complete_plan_session", {
      workoutDate: athleteLocalDate(),
      exercises,
      weekStart: athleteTrainingPlan.weekStart,
      sessionIndex,
      adaptationWeek: athleteTrainingPlan.adaptationWeek,
    });
    session.completed = true;
    session.completedAt = new Date().toISOString();
    session.workout_id = completionResult.workoutId;
    athleteTrainingPlanLoaded = true;
    athleteOpenCabinetSection("training-plan");
    showMessage("Тренировка сохранена в истории.");
  } catch (saveError) {
    console.error("TRENZO planned workout completion failed:", saveError);
    error.textContent = saveError.message || "Не удалось сохранить тренировку. Повторы остались на экране — попробуй ещё раз.";
    error.hidden = false;
    form.querySelectorAll("input").forEach((input) => { input.disabled = false; });
    submit.disabled = false;
    submit.textContent = "Завершить и сохранить";
  } finally {
    athleteTrainingSaving = false;
  }
}

async function athleteLoadTrainingPlan(force = false) {
  if (athleteTrainingPlanLoading || (athleteTrainingPlanLoaded && !force)) return;
  athleteTrainingPlanLoading = true;
  athleteTrainingPlanError = "";
  try {
    const result = await athleteTrainingRequest("load_plan");
    athleteTrainingPlan = result.plan || null;
    if (athleteTrainingPlan?.sourceType === "adaptation") athleteTrainingSetupMode = "adaptation_selected";
    athleteTrainingPlanLoaded = true;
  } catch (error) {
    console.error("TRENZO training plan load failed:", error);
    athleteTrainingPlanError = error.message || "Не удалось загрузить план тренировок.";
  } finally {
    athleteTrainingPlanLoading = false;
    const adaptationCard = document.querySelector(".training-adaptation-module-card");
    if (adaptationCard && athleteTrainingPlan) {
      adaptationCard.outerHTML = `<button class="info-card training-module-card training-plan-module-card" type="button" onclick="athleteOpenCabinetSection('training-plan')"><strong>План тренировок</strong><span>Адаптация · неделя ${athleteTrainingPlan.adaptationWeek || 1} из 3</span><span class="nutrition-plan-link-arrow" aria-hidden="true">›</span></button>`;
    }
    const moduleCard = document.querySelector(".training-module-card-disabled");
    if (moduleCard) {
      moduleCard.outerHTML = athleteTrainingPlan
        ? `<button class="info-card training-module-card training-plan-module-card" type="button" onclick="athleteOpenCabinetSection('training-plan')"><strong>План тренировок</strong><span>Открыть план на неделю</span><span class="nutrition-plan-link-arrow" aria-hidden="true">›</span></button>`
        : `<section class="info-card training-module-card training-module-card-disabled" aria-disabled="true"><strong>План тренировок</strong><span>${athleteEscape(athleteTrainingPlanError || "Появится после анализа загруженных тренировок")}</span></section>`;
    }
    const planSlot = document.getElementById("athleteTrainingPlanContent");
    if (planSlot) planSlot.innerHTML = athleteTrainingPlan
      ? athleteTrainingPlanMarkup(athleteTrainingPlan)
      : `<p class="training-history-status">${athleteEscape(athleteTrainingPlanError || "План пока не создан.")}</p>`;
  }
}

async function athleteGenerateTrainingPlan() {
  if (athleteTrainingPlanLoading) return;
  const restrictions = String(registration?.athlete?.restrictions || "").trim().slice(0, 1500);
  athleteTrainingPlanLoading = true;
  athleteTrainingPlanError = "";
  const uploadSlot = document.getElementById("athleteTrainingUploadPaths");
  if (uploadSlot) uploadSlot.innerHTML = athleteTrainingUploadPathsMarkup();
  try {
    const result = await athleteTrainingRequest("generate_plan", { restrictions });
    athleteTrainingPlan = result.plan || null;
    athleteTrainingPlanLoaded = true;
    if (!athleteTrainingPlan) throw new Error("Сервер не вернул тренировочный план.");
    athleteOpenCabinetSection("training-plan");
  } catch (error) {
    athleteTrainingPlanError = error.message || "Не удалось составить план тренировок.";
    console.error("TRENZO training plan generation failed:", error);
    const slot = document.getElementById("athleteTrainingUploadPaths");
    if (slot) slot.innerHTML = athleteTrainingUploadPathsMarkup();
    const planSlot = document.getElementById("athleteTrainingPlanContent");
    if (planSlot) planSlot.innerHTML = `<p class="training-upload-state-error" role="alert">${athleteEscape(athleteTrainingPlanError)}</p>`;
  } finally {
    athleteTrainingPlanLoading = false;
    const slot = document.getElementById("athleteTrainingUploadPaths");
    if (slot && !athleteTrainingPlan) slot.innerHTML = athleteTrainingUploadPathsMarkup();
    const planSlot = document.getElementById("athleteTrainingPlanContent");
    if (planSlot && athleteTrainingPlan) planSlot.innerHTML = athleteTrainingPlanMarkup(athleteTrainingPlan);
  }
}

function athleteRegenerateTrainingPlan() {
  if (athleteTrainingPlan?.sourceType === "adaptation") {
    athleteSkipTrainingUpload();
    return;
  }
  athleteGenerateTrainingPlan();
}

async function athleteGenerateAdaptationPlan(event) {
  return athleteRunAdaptationGeneration(event, athleteAdaptationNextWeekRequested);
}

let athleteAdaptationNextWeekRequested = false;

function athleteOpenNextAdaptationDialog() {
  athleteAdaptationNextWeekRequested = true;
  return athleteRunAdaptationGeneration(null, true);
}

async function athleteRunAdaptationGeneration(event, nextWeek) {
  if (athleteTrainingPlanLoading) return;
  const restrictions = nextWeek
    ? ""
    : String(registration?.athlete?.restrictions || "").trim().slice(0, 1500);
  const submit = document.querySelector(nextWeek
    ? ".training-plan-next-adaptation"
    : ".training-adaptation-start");

  athleteTrainingPlanLoading = true;
  athleteAdaptationGenerationLoading = true;
  athleteTrainingPlanError = "";
  if (submit) {
    submit.disabled = true;
    submit.textContent = nextWeek ? "Готовим следующую неделю…" : "Составляем план…";
  }
  try {
    const result = await athleteTrainingRequest("generate_adaptation_plan", {
      restrictions,
      nextWeek,
    });
    athleteTrainingPlan = result.plan || null;
    athleteTrainingPlanLoaded = true;
    if (!athleteTrainingPlan) throw new Error("Сервер не вернул адаптационный план.");
    athleteTrainingSetupMode = "adaptation_selected";
    athleteAdaptationNextWeekRequested = false;
    athleteOpenCabinetSection("training-plan");
  } catch (generationError) {
    const message = generationError.message || "Не удалось составить адаптационный план. Попробуй ещё раз.";
    athleteTrainingPlanError = message;
    const planSlot = document.getElementById("athleteTrainingPlanContent");
    if (planSlot) planSlot.innerHTML = athleteTrainingPlan
      ? athleteTrainingPlanMarkup(athleteTrainingPlan)
      : `<p class="training-upload-state-error" role="alert">${athleteEscape(message)}</p>`;
    showMessage(message);
    console.error("TRENZO adaptation plan generation failed:", generationError);
  } finally {
    athleteTrainingPlanLoading = false;
    athleteAdaptationGenerationLoading = false;
    if (submit) {
      submit.disabled = false;
      submit.textContent = nextWeek ? "Перейти к следующей неделе" : "Начать адаптацию";
    }
    if (!athleteTrainingPlan && document.getElementById("athleteScreen")?.textContent.includes("Тренировочный план")) {
      athleteOpenCabinetSection("training");
    }
  }
}

function athleteTrainingDateLabel(value) {
  const parts = String(value || "").split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return athleteEscape(value || "Дата не указана");
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(parts[0], parts[1] - 1, parts[2], 12));
}

function athleteTrainingCountLabel(count, one, few, many) {
  const lastTwo = count % 100;
  const last = count % 10;
  const word = lastTwo >= 11 && lastTwo <= 14 ? many :
    last === 1 ? one : last >= 2 && last <= 4 ? few : many;
  return `${count} ${word}`;
}

function athleteTrainingPlanRepetitionTotal(exercises) {
  let min = 0;
  let max = 0;
  for (const exercise of exercises) {
    const setCount = Math.max(1, Math.min(20, Number.parseInt(exercise.sets, 10) || 1));
    const reps = String(exercise.reps ?? "").trim();
    const range = reps.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
    const exact = reps.match(/^(\d+)$/);
    if (!range && !exact) return null;
    const low = Number(range ? range[1] : exact[1]);
    const high = Number(range ? range[2] : exact[1]);
    if (!Number.isInteger(low) || !Number.isInteger(high) || low < 1 || high < low) return null;
    min += low * setCount;
    max += high * setCount;
  }
  return { min, max };
}

function athleteRenderTrainingHistory(slot, workouts, hasMore = false) {
  if (!workouts.length) {
    slot.innerHTML = `<section class="info-card training-history-empty">
      <strong>Пока нет сохранённых тренировок</strong>
      <p>Добавленные тренировки появятся здесь вместе с упражнениями и подходами.</p>
      <button class="primary-btn" type="button" onclick="athleteOpenCabinetSection('training-upload')">Добавить тренировку</button>
    </section>`;
    return;
  }

  const cards = workouts.map(function(workout) {
    const exercises = Array.isArray(workout.athlete_training_exercises)
      ? workout.athlete_training_exercises.slice().sort((a, b) => Number(a.exercise_order) - Number(b.exercise_order))
      : [];
    const setsCount = exercises.reduce((total, exercise) =>
      total + (Array.isArray(exercise.athlete_training_sets) ? exercise.athlete_training_sets.length : 0), 0);

    const exerciseMarkup = exercises.map(function(exercise, index) {
      const sets = Array.isArray(exercise.athlete_training_sets)
        ? exercise.athlete_training_sets.slice().sort((a, b) => Number(a.set_number) - Number(b.set_number))
        : [];
      const nextExercise = exercises[index + 1];
      const inSuperset = exercise.superset_with_previous === true || nextExercise?.superset_with_previous === true;
      const setMarkup = sets.map(function(set, setIndex) {
        const weight = set.weight_kg === null || set.weight_kg === undefined || set.weight_kg === ""
          ? "Свой вес"
          : `${athleteFormatTrainingNumber(set.weight_kg)} кг`;
        return `<li>
          <span>Подход ${set.set_number || setIndex + 1}</span>
          <strong>${weight} × ${athleteEscape(set.reps)} повт.</strong>
          ${set.is_failure ? "<small>Отказ</small>" : ""}
        </li>`;
      }).join("");

      return `<section class="training-history-exercise${inSuperset ? " is-superset" : ""}">
        <div class="training-history-exercise-heading">
          <strong>${athleteEscape(exercise.name || "Упражнение без названия")}</strong>
          ${inSuperset ? "<span>Сет</span>" : ""}
        </div>
        <ol>${setMarkup}</ol>
      </section>`;
    }).join("");

    return `<details class="training-history-workout">
      <summary class="training-history-summary">
        <span class="training-history-summary-copy">
          <strong>${athleteTrainingDateLabel(workout.workout_date)}</strong>
          <small>${athleteTrainingCountLabel(exercises.length, "упражнение", "упражнения", "упражнений")} · ${athleteTrainingCountLabel(setsCount, "подход", "подхода", "подходов")}</small>
        </span>
        <span class="training-history-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div class="training-history-details">${exerciseMarkup}</div>
    </details>`;
  }).join("");

  slot.innerHTML = `${cards}${hasMore ? '<p class="training-history-status">Показаны последние 50 тренировок.</p>' : ""}`;
}

async function athleteLoadTrainingHistory() {
  const slot = document.getElementById("athleteTrainingHistory");
  if (!slot) return;

  try {
    const result = await athleteTrainingRequest("load_history");
    if (document.getElementById("athleteTrainingHistory") !== slot) return;
    athleteRenderTrainingHistory(slot, Array.isArray(result.workouts) ? result.workouts : [], result.hasMore === true);
  } catch (error) {
    console.error("TRENZO training history failed:", error);
    if (document.getElementById("athleteTrainingHistory") !== slot) return;
    slot.innerHTML = `<section class="info-card training-history-empty" role="alert">
      <strong>Не удалось загрузить тренировки</strong>
      <p>${athleteEscape(error.message || "Попробуй ещё раз.")}</p>
      <button class="training-history-retry" type="button" onclick="athleteLoadTrainingHistory()">Повторить</button>
    </section>`;
  }
}

function athleteFormatTrainingNumber(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString("ru-RU", { maximumFractionDigits: 1 })
    : athleteEscape(value);
}

function athleteTrainingSetMarkup(number) {
  return `<div class="training-set-row">
    <div class="training-set-heading"><strong>Подход ${number}</strong><button class="training-remove-set" type="button" onclick="athleteRemoveTrainingSet(this)" aria-label="Удалить подход">×</button></div>
    <div class="training-set-fields">
      <label>Вес, кг<input class="text-input training-set-weight" type="number" inputmode="decimal" min="0" max="1000" step="0.1" placeholder="Свой вес" aria-label="Вес, килограммы, необязательно"></label>
      <label>Повторения<input class="text-input training-set-reps" type="number" inputmode="numeric" min="1" max="300" step="1" required placeholder="Например, 12"></label>
      <label class="training-failure-toggle"><input class="training-set-failure" type="checkbox"><span>Отказ</span></label>
    </div>
  </div>`;
}

function athleteTrainingExerciseMarkup(number) {
  return `<section class="training-exercise-card">
    <div class="training-exercise-heading"><h4>Упражнение ${number}</h4><button class="training-remove-exercise" type="button" onclick="athleteRemoveTrainingExercise(this)" aria-label="Удалить упражнение">×</button></div>
    <label class="training-exercise-name-label">Название упражнения<input class="text-input training-exercise-name" type="text" maxlength="120" required autocomplete="off" placeholder="Например, тяга верхнего блока"></label>
    <div class="training-sets-list">${athleteTrainingSetMarkup(1)}</div>
    <button class="training-add-set" type="button" onclick="athleteAddTrainingSet(this)">＋ Добавить подход</button>
    <label class="training-superset-toggle"><input class="training-exercise-superset" type="checkbox" onchange="athleteUpdateTrainingExerciseControls()"><span>В сет с предыдущим</span></label>
  </section>`;
}

function athleteUpdateTrainingExerciseControls() {
  const list = document.getElementById("athleteTrainingExercises");
  if (!list) return;
  const cards = [...list.querySelectorAll(".training-exercise-card")];
  const addButton = document.querySelector(".training-add-exercise");
  const countLabel = addButton?.querySelector("span");
  if (countLabel) countLabel.textContent = `${cards.length} из 15`;
  if (addButton) addButton.disabled = cards.length >= 15;

  cards.forEach(function(card, index) {
    card.querySelector(".training-exercise-heading h4").textContent = `Упражнение ${index + 1}`;
    card.querySelector(".training-remove-exercise").hidden = cards.length === 1;
    const supersetToggle = card.querySelector(".training-exercise-superset");
    const previousToggle = cards[index - 1]?.querySelector(".training-exercise-superset");
    const nextToggle = cards[index + 1]?.querySelector(".training-exercise-superset");
    if (supersetToggle) {
      // A superset is a pair of neighboring exercises. The first has no previous
      // exercise; prevent overlapping pairs such as A-B-C in this first version.
      supersetToggle.disabled = index === 0 || Boolean(previousToggle?.checked) || Boolean(nextToggle?.checked);
      if (index === 0) supersetToggle.checked = false;
      card.querySelector(".training-superset-toggle")?.classList.toggle("is-disabled", supersetToggle.disabled);
    }
    const setRows = [...card.querySelectorAll(".training-set-row")];
    const addSetButton = card.querySelector(".training-add-set");
    if (addSetButton) addSetButton.disabled = setRows.length >= 50;
    setRows.forEach(function(row, setIndex) {
      row.querySelector(".training-set-heading strong").textContent = `Подход ${setIndex + 1}`;
      row.querySelector(".training-remove-set").hidden = setRows.length === 1;
    });
  });

  cards.forEach(function(card, index) {
    const currentToggle = card.querySelector(".training-exercise-superset");
    const nextToggle = cards[index + 1]?.querySelector(".training-exercise-superset");
    const isPair = Boolean(currentToggle?.checked || nextToggle?.checked);
    card.classList.toggle("is-superset", isPair);
  });
}

function athleteOpenManualTraining(recognizedWorkout = null, recognizedDate = "") {
  const dialog = document.getElementById("athleteTrainingManualDialog");
  const dateInput = document.getElementById("athleteTrainingManualDate");
  const exerciseList = document.getElementById("athleteTrainingExercises");
  const error = document.getElementById("athleteTrainingManualError");
  const reviewNote = document.getElementById("athleteTrainingReviewNote");
  const title = document.getElementById("athleteTrainingManualTitle");
  if (!dialog || !dateInput || !exerciseList) return;

  const isRecognized = recognizedWorkout && Array.isArray(recognizedWorkout.exercises);
  if (title) title.textContent = isRecognized ? "Проверь тренировку" : "Новая тренировка";
  if (reviewNote) reviewNote.hidden = !isRecognized;
  dateInput.value = recognizedDate || athleteLocalDate();
  dateInput.max = athleteLocalDate();
  exerciseList.innerHTML = athleteTrainingExerciseMarkup(1);
  if (error) {
    error.hidden = true;
    error.textContent = "";
  }

  if (isRecognized) {
    const exercises = recognizedWorkout.exercises.slice(0, 15);
    exerciseList.innerHTML = exercises.length
      ? exercises.map((_, index) => athleteTrainingExerciseMarkup(index + 1)).join("")
      : athleteTrainingExerciseMarkup(1);

    [...exerciseList.querySelectorAll(".training-exercise-card")].forEach(function(card, index) {
      const exercise = exercises[index] || {};
      const nameInput = card.querySelector(".training-exercise-name");
      nameInput.value = typeof exercise.name === "string" ? exercise.name.slice(0, 120) : "";

      const parsedSets = Array.isArray(exercise.sets) ? exercise.sets.slice(0, 50) : [];
      const setsList = card.querySelector(".training-sets-list");
      if (parsedSets.length) {
        setsList.innerHTML = parsedSets.map((_, setIndex) => athleteTrainingSetMarkup(setIndex + 1)).join("");
        [...setsList.querySelectorAll(".training-set-row")].forEach(function(row, setIndex) {
          const set = parsedSets[setIndex] || {};
          const weightInput = row.querySelector(".training-set-weight");
          const repsInput = row.querySelector(".training-set-reps");
          weightInput.value = set.weight_kg == null ? "" : String(set.weight_kg);
          repsInput.value = set.reps == null ? "" : String(set.reps);
          row.querySelector(".training-set-failure").checked = set.is_failure === true;
        });
      }
    });
  }

  athleteUpdateTrainingExerciseControls();
  dialog.showModal();
}

function athleteOpenTrainingPhoto() {
  const dialog = document.getElementById("athleteTrainingPhotoDialog");
  const dateInput = document.getElementById("athleteTrainingPhotoDate");
  const error = document.getElementById("athleteTrainingPhotoError");
  const button = document.getElementById("athleteTrainingPhotoRecognize");
  const filename = document.getElementById("athleteTrainingPhotoFilename");
  if (!dialog || !dateInput || !error || !button) return;

  dateInput.value = athleteLocalDate();
  dateInput.max = athleteLocalDate();
  error.hidden = true;
  error.textContent = "";
  button.disabled = true;
  button.textContent = "Распознать и продолжить";
  if (filename) filename.textContent = "Фото ещё не выбрано";
  athleteTrainingPhotoFile = null;
  dialog.showModal();
}

function athleteChooseTrainingPhoto() {
  const input = document.getElementById("athleteTrainingImageInput");
  if (input) {
    input.value = "";
    input.click();
  }
}

function athleteSelectTrainingPhoto(input) {
  const file = input?.files?.[0];
  if (!file) return;
  const dateInput = document.getElementById("athleteTrainingPhotoDate");
  const filename = document.getElementById("athleteTrainingPhotoFilename");
  const error = document.getElementById("athleteTrainingPhotoError");
  const recognize = document.getElementById("athleteTrainingPhotoRecognize");
  if (!dateInput || !filename || !error || !recognize) return;

  athleteTrainingPhotoFile = null;
  error.hidden = true;
  error.textContent = "";

  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    error.textContent = "Подойдут PNG, JPG или WEBP. Если фото в HEIC, сделай скриншот или выбери изображение в другом формате.";
    error.hidden = false;
  } else if (file.size > 4000000) {
    error.textContent = "Файл слишком большой. Выбери изображение до 4 МБ.";
    error.hidden = false;
  } else {
    athleteTrainingPhotoFile = file;
    filename.textContent = file.name;
    recognize.disabled = false;
    return;
  }

  filename.textContent = "Фото ещё не выбрано";
  recognize.disabled = true;
}

function athleteCloseTrainingPhotoDialog(force = false) {
  if (athleteTrainingPhotoSaving && !force) return;
  document.getElementById("athleteTrainingPhotoDialog")?.close();
  document.getElementById("athleteTrainingImageInput").value = "";
  athleteTrainingPhotoFile = null;
}

async function athleteParseTrainingPhoto() {
  if (athleteTrainingPhotoSaving) return;
  const dialog = document.getElementById("athleteTrainingPhotoDialog");
  const dateInput = document.getElementById("athleteTrainingPhotoDate");
  const recognize = document.getElementById("athleteTrainingPhotoRecognize");
  const error = document.getElementById("athleteTrainingPhotoError");
  if (!dialog || !dateInput || !recognize || !error || !athleteTrainingPhotoFile) return;
  if (!dateInput.value) {
    dateInput.reportValidity();
    return;
  }

  athleteTrainingPhotoSaving = true;
  recognize.disabled = true;
  recognize.textContent = "Распознаём…";
  const addPhotoButton = document.querySelector("#athleteTrainingPhotoDialog .training-photo-add");
  if (addPhotoButton) addPhotoButton.disabled = true;
  error.hidden = true;

  try {
    const imageDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("Не удалось прочитать изображение."));
      reader.readAsDataURL(athleteTrainingPhotoFile);
    });

    const result = await athleteTrainingRequest("parse_image", {
      workoutDate: dateInput.value,
      imageDataUrl
    });

    const workout = result.draft || result.workout || result;
    const workoutDate = dateInput.value;
    athleteCloseTrainingPhotoDialog(true);
    athleteOpenManualTraining(workout, workoutDate);
  } catch (parseError) {
    console.error("TRENZO training photo recognition failed:", parseError);
    error.textContent = parseError.message || "Не удалось распознать тренировку.";
    error.hidden = false;
  } finally {
    athleteTrainingPhotoSaving = false;
    if (dialog.open) {
      recognize.disabled = !athleteTrainingPhotoFile;
      recognize.textContent = "Распознать и продолжить";
      if (addPhotoButton) addPhotoButton.disabled = false;
    }
  }
}

function athleteAddTrainingExercise() {
  const list = document.getElementById("athleteTrainingExercises");
  if (!list || list.querySelectorAll(".training-exercise-card").length >= 15) return;
  list.insertAdjacentHTML("beforeend", athleteTrainingExerciseMarkup(list.children.length + 1));
  athleteUpdateTrainingExerciseControls();
  list.lastElementChild?.querySelector(".training-exercise-name")?.focus();
}

function athleteRemoveTrainingExercise(button) {
  button.closest(".training-exercise-card")?.remove();
  athleteUpdateTrainingExerciseControls();
}

function athleteAddTrainingSet(button) {
  const card = button.closest(".training-exercise-card");
  const list = card?.querySelector(".training-sets-list");
  if (!list || list.children.length >= 50) return;
  list.insertAdjacentHTML("beforeend", athleteTrainingSetMarkup(list.children.length + 1));
  athleteUpdateTrainingExerciseControls();
  list.lastElementChild?.querySelector(".training-set-weight")?.focus();
}

function athleteRemoveTrainingSet(button) {
  button.closest(".training-set-row")?.remove();
  athleteUpdateTrainingExerciseControls();
}

async function athleteSaveManualTraining() {
  if (athleteTrainingSaving) return;
  const form = document.getElementById("athleteTrainingManualForm");
  const dialog = document.getElementById("athleteTrainingManualDialog");
  const dateInput = document.getElementById("athleteTrainingManualDate");
  const submit = document.getElementById("athleteTrainingManualSave");
  const error = document.getElementById("athleteTrainingManualError");
  const exerciseCards = [...document.querySelectorAll("#athleteTrainingExercises .training-exercise-card")];
  if (!form || !dialog || !dateInput || !submit || !error) return;

  if (!form.reportValidity()) return;
  if (!exerciseCards.length || exerciseCards.length > 15) return;

  const exercises = exerciseCards.map(function(card) {
    return {
      name: card.querySelector(".training-exercise-name").value.trim(),
      superset_with_previous: card.querySelector(".training-exercise-superset").checked,
      sets: [...card.querySelectorAll(".training-set-row")].map(function(row) {
        const weightValue = row.querySelector(".training-set-weight").value;
        return {
          weight_kg: weightValue === "" ? null : Number(weightValue),
          reps: Number(row.querySelector(".training-set-reps").value),
          is_failure: row.querySelector(".training-set-failure").checked
        };
      })
    };
  });

  if (exercises.some(function(exercise) { return !exercise.name || !exercise.sets.length; })) {
    error.textContent = "Укажи название упражнения и хотя бы один заполненный подход для каждого упражнения.";
    error.hidden = false;
    return;
  }

  athleteTrainingSaving = true;
  error.hidden = true;
  submit.disabled = true;
  submit.textContent = "Сохраняем…";

  try {
    await athleteTrainingRequest("save_manual", {
      workoutDate: dateInput.value,
      exercises
    });
    form.reset();
    dialog.close();
    showMessage("Тренировка сохранена.");
    if (document.getElementById("athleteTrainingUploadPaths")) {
      await athleteRefreshTrainingUploadState();
    }
  } catch (saveError) {
    console.error("TRENZO manual training save failed:", saveError);
    error.textContent = saveError.message || "Не удалось сохранить тренировку. Попробуй ещё раз.";
    error.hidden = false;
  } finally {
    athleteTrainingSaving = false;
    submit.disabled = false;
    submit.textContent = "Сохранить тренировку";
  }
}

let athleteNutritionCache = null;
let athleteNutritionPlanCache = null;
let athleteNutritionPlanResultCache = null;
let athleteNutritionPlanLoadedWeek = "";
let athleteNutritionPlanLoadPending = null;
let athleteNutritionPending = null;

function athleteNutritionDayCount(entries) {
  return new Set(
    (Array.isArray(entries) ? entries : [])
      .map(function(entry) { return entry && entry.report_date; })
      .filter(Boolean)
  ).size;
}

function athleteNutritionCompletionStorageKey() {
  const telegramUserId = tg?.initDataUnsafe?.user?.id;
  return `trenzo:nutrition-completion-dismissed:${telegramUserId || "current"}`;
}

function athleteNutritionCompletionDismissed() {
  try {
    return localStorage.getItem(athleteNutritionCompletionStorageKey()) === "1";
  } catch {
    return false;
  }
}

function athleteDismissNutritionCompletion() {
  try {
    localStorage.setItem(athleteNutritionCompletionStorageKey(), "1");
  } catch {
    // Если хранилище недоступно, сообщение всё равно закрывается до перерисовки.
  }

  const message = document.getElementById(
    "athleteNutritionCompletionMessage"
  );
  if (message) message.hidden = true;
}

function athleteUpdateNutritionIntroduction(entries) {
  const completed = athleteNutritionDayCount(entries) >= 7;
  const intro = document.getElementById("athleteNutritionIntroCard");
  const progress = document.getElementById("athleteNutritionProgressCard");
  const message = document.getElementById(
    "athleteNutritionCompletionMessage"
  );

  if (athleteNutritionPlanCache) {
    if (intro) intro.hidden = true;
    if (progress) progress.hidden = true;
    if (message) message.hidden = true;
    return;
  }

  if (intro) intro.hidden = completed;
  if (progress) progress.hidden = completed;
  if (message) {
    message.hidden = !completed || athleteNutritionCompletionDismissed();
  }
}

async function athleteEnsureNutritionLoaded() {
  if (Array.isArray(athleteNutritionCache)) {
    return athleteNutritionCache;
  }

  if (!athleteNutritionPending) {
    athleteNutritionPending = athleteNutritionRequest("load")
      .then(function(result) {
        athleteNutritionCache = Array.isArray(result.entries)
          ? result.entries.slice()
          : [];

        return athleteNutritionCache;
      })
      .finally(function() {
        athleteNutritionPending = null;
      });
  }

  return athleteNutritionPending;
}
function athleteNutritionFormat(value, digits = 0) {
  return Number(value).toLocaleString("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function athleteNutritionWeekStart(dateValue) {
  const parts = String(dateValue || "").split("-").map(Number);
  if (parts.length !== 3 || parts.some(function(part) { return !Number.isFinite(part); })) {
    return "";
  }

  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const offsetFromMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offsetFromMonday);
  return date.toISOString().slice(0, 10);
}

function athleteNutritionWeekDates(weekStart) {
  const start = new Date(`${weekStart}T12:00:00Z`);
  return Array.from({ length: 7 }, function(_, index) {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

let athleteNutritionSelectedWeek = "";

function athleteSelectNutritionWeek(weekStart) {
  athleteNutritionSelectedWeek = weekStart;
  const slot = document.getElementById("athleteNutritionHistory");
  if (slot) athleteRenderNutritionHistoryWeeks(slot, athleteNutritionCache || []);
}

function athleteRenderNutritionHistoryWeeks(slot, entries) {
  const today = athleteLocalDate();
  const currentWeekStart = athleteNutritionWeekStart(today);
  const weeks = new Map([[currentWeekStart, new Map()]]);

  (Array.isArray(entries) ? entries : []).forEach(function(entry) {
    const weekStart = athleteNutritionWeekStart(entry && entry.report_date);
    if (!weekStart) return;
    if (!weeks.has(weekStart)) weeks.set(weekStart, new Map());
    weeks.get(weekStart).set(entry.report_date, entry);
  });

  const weekStarts = Array.from(weeks.keys()).sort(function(a, b) {
    return b.localeCompare(a);
  });
  if (!weekStarts.includes(athleteNutritionSelectedWeek)) {
    athleteNutritionSelectedWeek = currentWeekStart;
  }
  const selectedWeekStart = athleteNutritionSelectedWeek;
  const selectedWeekEntries = weeks.get(selectedWeekStart) || new Map();
  const selectedDates = athleteNutritionWeekDates(selectedWeekStart);
  const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const monthDay = function(dateValue) {
    const [, month, day] = dateValue.split("-");
    return `${day}.${month}`;
  };
  const weekLabel = function(weekStart) {
    const dates = athleteNutritionWeekDates(weekStart);
    const end = dates[6];
    const startYear = dates[0].slice(0, 4);
    const endYear = end.slice(0, 4);
    const prefix = weekStart === currentWeekStart ? "Эта неделя · " : "";
    const range = `${monthDay(dates[0])}${startYear !== endYear ? `.${startYear}` : ""}–${monthDay(end)}.${endYear}`;
    return `${prefix}${range}`;
  };
  const formatValue = function(value) {
    return Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 1 });
  };

  slot.innerHTML = `
    <div class="nutrition-history-week-picker">
      <label class="visually-hidden" for="athleteNutritionWeekPicker">Выбрать неделю</label>
      <span class="nutrition-history-week-control">
        <span class="nutrition-history-week-icon" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="none" focusable="false">
            <rect x="3" y="5" width="14" height="12" rx="2" />
            <path d="M7 3v4M13 3v4M3 9h14" />
          </svg>
        </span>
        <select id="athleteNutritionWeekPicker" class="nutrition-history-week-select"
          aria-label="Выбрать неделю" onchange="athleteSelectNutritionWeek(this.value)">
          ${weekStarts.map(function(weekStart) {
            return `<option value="${weekStart}" ${weekStart === selectedWeekStart ? "selected" : ""}>${athleteEscape(weekLabel(weekStart))}</option>`;
          }).join("")}
        </select>
        <span class="nutrition-history-week-chevron" aria-hidden="true"></span>
      </span>
    </div>
    <div style="overflow-x:auto;">
      <table class="nutrition-history-table">
        <thead><tr>
          <th>День</th><th>ккал</th><th>Б</th><th>Ж</th><th>У</th>
        </tr></thead>
        <tbody>${selectedDates.map(function(dateValue, index) {
          const entry = selectedWeekEntries.get(dateValue);
          const color = entry ? "#ddd" : "#777";
          return `<tr style="color:${color};">
            <td>${weekdays[index]} ${monthDay(dateValue)}</td>
            <td>${entry ? formatValue(entry.calories) : "—"}</td>
            <td>${entry ? formatValue(entry.protein_g) : "—"}</td>
            <td>${entry ? formatValue(entry.fat_g) : "—"}</td>
            <td>${entry ? formatValue(entry.carbs_g) : "—"}</td>
          </tr>`;
        }).join("")}</tbody>
      </table>
    </div>
  `;
}

function athleteNutritionProgressHelpMarkup() {
  return `
    <dialog id="athleteNutritionHelpDialog" class="nutrition-help-dialog" aria-labelledby="athleteNutritionHelpTitle">
      <div class="nutrition-help-dialog-heading">
        <h3 id="athleteNutritionHelpTitle">Как считаются шкалы?</h3>
        <button class="nutrition-help-close" type="button" aria-label="Закрыть" onclick="this.closest('dialog').close()">×</button>
      </div>
      <p>Здесь показывается средний процент выполнения норм по заданным показателям.</p>
      <p>Среднее считается за дни этой недели, за которые ты уже внёс данные. Например, если по белкам получилось 90%, 100% и 75%, среднее за эти три дня — 88%.</p>
      <button class="primary-btn nutrition-help-done" type="button" onclick="this.closest('dialog').close()">Понятно</button>
    </dialog>
  `;
}

function athleteTrainingControlMarkup(metrics) {
  const source = metrics && typeof metrics === "object" ? metrics : {};
  const items = [
    {
      key: "exercises",
      label: "Упражнения",
      color: "#ff806d",
      background: "#3b292b",
      icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6m4-9v12m8-12v12m4-9v6M8 12h8"/></svg>`
    },
    {
      key: "sets",
      label: "Подходы",
      color: "#69aaff",
      background: "#223247",
      icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/></svg>`
    },
    {
      key: "repetitions",
      label: "Повторения",
      color: "#43d082",
      background: "#213a2d",
      icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2"/></svg>`
    }
  ];
  const metricValues = {};
  items.forEach(function(item) {
    const value = source[item.key] || {};
    const completed = Number(value.completed);
    const target = Number(value.target);
    const valid = Number.isFinite(completed) && Number.isFinite(target) && target > 0;
    metricValues[item.key] = {
      valid: valid,
      completed: valid ? Math.max(0, completed) : null,
      target: valid ? target : null,
      percent: valid ? Math.min(100, Math.max(0, completed / target * 100)) : 0
    };
  });

  const workoutValue = source.workouts || {};
  const workoutCompleted = Number(workoutValue.completed);
  const workoutTarget = Number(workoutValue.target);
  const workoutValid = Number.isFinite(workoutCompleted) && Number.isFinite(workoutTarget) && workoutTarget > 0;
  const workoutPercent = workoutValid
    ? Math.min(100, Math.max(0, workoutCompleted / workoutTarget * 100))
    : 0;
  const radius = 51;
  const circumference = 2 * Math.PI * radius;
  const circleOffset = circumference * (1 - workoutPercent / 100);
  const workoutAria = workoutValid
    ? `role="progressbar" aria-label="Выполнено тренировок за неделю" aria-valuemin="0" aria-valuemax="${workoutTarget}" aria-valuenow="${Math.min(workoutTarget, workoutCompleted)}"`
    : `aria-label="Цель по тренировкам появится после загрузки тренировок"`;

  const metricCards = items.map(function(item) {
    const value = metricValues[item.key];
    const progressRole = value.valid
      ? `role="progressbar" aria-label="Выполнено: ${item.label.toLowerCase()} за неделю" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(value.percent)}"`
      : `aria-hidden="true"`;
    const ratio = value.valid
      ? `${athleteNutritionFormat(value.completed)} / ${athleteNutritionFormat(value.target)}`
      : "— / —";
    return `<div class="training-metric-card">
      <span class="training-metric-icon" style="--training-icon-color:${item.color};--training-icon-background:${item.background};" aria-hidden="true">${item.icon}</span>
      <span class="training-metric-label">${item.label}</span>
      <strong class="training-metric-value">${ratio}</strong>
      <div class="training-metric-track" ${progressRole}>
        <div class="training-metric-progress" style="width:${value.percent}%;"></div>
      </div>
    </div>`;
  }).join("");

  const workoutRatio = workoutValid
    ? `${athleteNutritionFormat(workoutCompleted)} / ${athleteNutritionFormat(workoutTarget)}`
    : "— / —";
  return `<div class="training-targets-layout">
    <div class="nutrition-calorie-ring training-workout-ring" ${workoutAria}>
      <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <circle class="nutrition-calorie-track" cx="60" cy="60" r="${radius}"></circle>
        <circle class="nutrition-calorie-progress" cx="60" cy="60" r="${radius}" stroke-dasharray="${circumference}" stroke-dashoffset="${circleOffset}"></circle>
      </svg>
      <div class="nutrition-calorie-value">
        <strong>${workoutRatio}</strong>
        <span>тренировки</span>
      </div>
    </div>
    <div class="training-metric-grid">${metricCards}</div>
  </div>`;
}

function athleteRenderNutritionTargets(plan) {
  const slots = [
    document.getElementById("athleteNutritionOverviewTargets"),
    document.getElementById("athleteNutritionDiaryTargets")
  ].filter(Boolean);
  if (!slots.length) return;

  const days = plan && Array.isArray(plan.weekPlan) ? plan.weekPlan : [];
  const values = days.map(function(day) {
    return {
      calories: Number(day.calories),
      protein: Number(day.protein_g),
      fat: Number(day.fat_g),
      carbs: Number(day.carbs_g)
    };
  });
  const hasTargets = !plan?.reviewRequired && values.length === 7 && values.every(function(day) {
    return Object.values(day).every(Number.isFinite);
  });

  if (!hasTargets) {
    const message = plan?.reviewRequired
      ? "Числовые цели пока не сформированы — нужна проверка специалиста."
      : "Показатели появятся после анализа питания.";
    slots.forEach(function(slot) {
      slot.innerHTML = `<p style="color:#aaa;margin:0;">${athleteEscape(message)}</p>`;
    });
    return;
  }

  const average = {
    calories: values.reduce((sum, day) => sum + day.calories, 0) / values.length,
    protein: values.reduce((sum, day) => sum + day.protein, 0) / values.length,
    fat: values.reduce((sum, day) => sum + day.fat, 0) / values.length,
    carbs: values.reduce((sum, day) => sum + day.carbs, 0) / values.length
  };
  const today = athleteLocalDate();
  const nutritionLoaded = Array.isArray(athleteNutritionCache);
  const weekStart = athleteNutritionWeekStart(today);
  const weekDates = athleteNutritionWeekDates(weekStart);
  const currentWeekEntriesByDate = new Map();
  if (nutritionLoaded) {
    athleteNutritionCache.forEach(function(row) {
      if (
        row &&
        row.report_date >= weekStart &&
        row.report_date <= today &&
        row.report_date <= weekDates[6]
      ) {
        currentWeekEntriesByDate.set(row.report_date, row);
      }
    });
  }
  const weekEntries = Array.from(currentWeekEntriesByDate.values());
  const goals = [
    { key: "protein_g", label: "Белки", unit: "г", goal: average.protein, color: "#ff806d", bg: "#3b292b", icon: "🥩" },
    { key: "fat_g", label: "Жиры", unit: "г", goal: average.fat, color: "#ffc54f", bg: "#393326", icon: "💧" },
    { key: "carbs_g", label: "Углеводы", unit: "г", goal: average.carbs, color: "#b77aff", bg: "#30283d", icon: "🌾" }
  ];
  const averagePercentFor = function(key, goal) {
    if (!weekEntries.length || goal <= 0) return 0;
    const averageIntake = weekEntries.reduce(function(sum, row) {
      return sum + Math.max(0, Number(row[key]) || 0);
    }, 0) / weekEntries.length;
    return averageIntake / goal * 100;
  };
  const caloriesPercent = averagePercentFor("calories", average.calories);
  const radius = 51;
  const circumference = 2 * Math.PI * radius;
  const caloriesWidth = Math.min(100, caloriesPercent);
  const circleOffset = circumference * (1 - caloriesWidth / 100);
  const macroMarkup = goals.map(function(item) {
    const percent = averagePercentFor(item.key, item.goal);
    const width = Math.min(100, percent);
    return `<div class="nutrition-macro-card">
      <span class="nutrition-macro-icon" style="color:${item.color};background:${item.bg};">${item.icon}</span>
      <span class="nutrition-macro-label">${item.label}</span>
      <strong class="nutrition-macro-target">${athleteNutritionFormat(item.goal)} ${item.unit}</strong>
      <div class="nutrition-macro-track" role="progressbar" aria-label="Среднее выполнение цели по показателю «${item.label.toLowerCase()}» за неделю" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(width)}">
        <div class="nutrition-macro-progress" style="width:${width}%;"></div>
      </div>
    </div>`;
  }).join("");
  const markup = `
    <div class="nutrition-targets-layout">
      <div class="nutrition-calorie-ring" role="progressbar" aria-label="Среднее выполнение цели по калориям за неделю" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(caloriesWidth)}">
        <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
          <circle class="nutrition-calorie-track" cx="60" cy="60" r="${radius}"></circle>
          <circle class="nutrition-calorie-progress" cx="60" cy="60" r="${radius}" stroke-dasharray="${circumference}" stroke-dashoffset="${circleOffset}"></circle>
        </svg>
        <div class="nutrition-calorie-value">
          <strong>${athleteNutritionFormat(average.calories)}</strong>
          <span>ккал</span>
        </div>
      </div>
      <div class="nutrition-macro-grid">${macroMarkup}</div>
    </div>`;

  slots.forEach(function(slot) {
    slot.innerHTML = markup;
  });
}

function athleteRenderNutritionPlan(result) {
  athleteNutritionPlanResultCache = result;
  athleteNutritionPlanLoadedWeek = athleteNutritionWeekStart(athleteLocalDate());

  const cardStatus = document.getElementById("athleteNutritionPlanCardStatus");
  const output = document.getElementById("athleteNutritionPlanOutput");
  const status = document.getElementById("athleteNutritionPlanStatus");
  const button = document.getElementById("athleteNutritionAnalyzeButton");
  const plan = result && result.plan;

  if (!plan) {
    if (cardStatus) cardStatus.textContent = "Недельный план ещё не сформирован";
    if (status) status.textContent = "";
    if (output) {
      output.innerHTML = `
        <div class="info-card nutrition-plan-empty">
          <strong>План пока не сформирован</strong>
          <p>Добавь записи за 7 разных дней, чтобы получить цели и рекомендации.</p>
        </div>
      `;
    }
    if (button) {
      button.hidden = false;
      button.disabled = false;
      button.textContent = "Сформировать план питания";
    }
    athleteNutritionPlanCache = null;
    athleteRenderNutritionTargets(null);
    return;
  }

  athleteNutritionPlanCache = plan;
  athleteRenderNutritionTargets(plan);
  ["athleteNutritionIntroCard", "athleteNutritionProgressCard", "athleteNutritionCompletionMessage"]
    .forEach(function(id) {
      const element = document.getElementById(id);
      if (element) element.hidden = true;
    });

  const hasWeekPlan = Array.isArray(plan.weekPlan);
  if (cardStatus) {
    cardStatus.textContent = plan.reviewRequired
      ? "Нужна проверка специалиста"
      : hasWeekPlan && plan.weekPlan.length === 7
        ? "Ежедневные цели и рекомендации на эту неделю"
        : "Недельный план ещё не сформирован";
  }

  if (!output || !status || !button) return;

  const dailyValues = (hasWeekPlan ? plan.weekPlan : []).map(function(day) {
    return {
      calories: Number(day.calories),
      protein: Number(day.protein_g),
      fat: Number(day.fat_g),
      carbs: Number(day.carbs_g)
    };
  });
  const hasDailyValues = !plan.reviewRequired && dailyValues.length === 7 &&
    dailyValues.every(function(day) {
      return Object.values(day).every(Number.isFinite);
    });

  if (plan.reviewRequired) {
    if (cardStatus) cardStatus.textContent = "Нужна проверка специалиста";
    status.textContent = "";
    output.innerHTML = `
      <div class="info-card nutrition-plan-detail">
        <strong>Нужна проверка специалиста</strong>
        <p class="nutrition-plan-review-reason">${athleteEscape(plan.reviewReason || "По имеющимся данным нельзя безопасно рассчитать числовые цели.")}</p>
      </div>
    `;
    button.hidden = true;
    return;
  }

  if (!hasDailyValues) {
    if (cardStatus) cardStatus.textContent = "Недельный план ещё не сформирован";
    status.textContent = "Не удалось получить числовые цели. Попробуй сформировать план ещё раз.";
    output.innerHTML = "";
    button.hidden = false;
    button.disabled = false;
    button.textContent = "Сформировать план питания";
    return;
  }

  if (cardStatus) cardStatus.textContent = "Ежедневные цели и рекомендации на эту неделю";
  status.textContent = "";

  const dailyTarget = hasDailyValues
    ? {
      calories: dailyValues.reduce((sum, day) => sum + day.calories, 0) / 7,
      protein: dailyValues.reduce((sum, day) => sum + day.protein, 0) / 7,
      fat: dailyValues.reduce((sum, day) => sum + day.fat, 0) / 7,
      carbs: dailyValues.reduce((sum, day) => sum + day.carbs, 0) / 7
    }
    : null;
  const dailyTargetMarkup = dailyTarget
    ? `<div style="padding:12px 0;border-top:1px solid #414141;">
        <strong class="nutrition-plan-section-title">Твои цели на каждый день этой недели</strong>
        <div class="nutrition-daily-targets">
          <span><small>Калории</small><b>${athleteNutritionFormat(dailyTarget.calories)} ккал</b></span>
          <span><small>Белки</small><b>${athleteNutritionFormat(dailyTarget.protein, 1)} г</b></span>
          <span><small>Жиры</small><b>${athleteNutritionFormat(dailyTarget.fat, 1)} г</b></span>
          <span><small>Углеводы</small><b>${athleteNutritionFormat(dailyTarget.carbs, 1)} г</b></span>
        </div>
      </div>`
    : "";

  const recommendations = Array.isArray(plan.recommendations)
    ? plan.recommendations.slice(0, 5)
    : [];

  output.innerHTML = `
    <div class="info-card nutrition-plan-detail">
      <p class="nutrition-plan-context">
        По итогам анализа прошлых данных и с учётом твоей цели мы скорректировали питание на эту неделю.
      </p>
      ${dailyTargetMarkup}
      ${recommendations.length ? `<div class="nutrition-plan-recommendations">
        <strong class="nutrition-plan-section-title">Рекомендации</strong>
        <ul>
          ${recommendations.map(function(item) {
            return `<li>${athleteEscape(item)}</li>`;
          }).join("")}
        </ul>
      </div>` : ""}
    </div>
  `;

  button.hidden = true;
}

async function athleteLoadNutritionPlan() {
  const status = document.getElementById("athleteNutritionPlanStatus");
  const currentWeek = athleteNutritionWeekStart(athleteLocalDate());

  if (
    athleteNutritionPlanResultCache &&
    athleteNutritionPlanLoadedWeek === currentWeek
  ) {
    if (athleteNutritionPlanResultCache.plan && athleteNutritionCache === null) {
      try {
        await athleteEnsureNutritionLoaded();
      } catch (nutritionError) {
        console.error("TRENZO nutrition progress load failed:", nutritionError);
      }
    }
    athleteRenderNutritionPlan(athleteNutritionPlanResultCache);
    return;
  }

  if (athleteNutritionPlanLoadPending) {
    return athleteNutritionPlanLoadPending;
  }

  const loadPromise = (async function() {
    try {
      const result = await athleteNutritionRequest("load_plan");

      if (result.plan) {
        try {
          await athleteEnsureNutritionLoaded();
        } catch (nutritionError) {
          console.error("TRENZO nutrition progress load failed:", nutritionError);
        }
      }

      athleteRenderNutritionPlan(result);
    } catch (error) {
      console.error("TRENZO nutrition plan load failed:", error);
      if (status && document.getElementById("athleteNutritionPlanStatus") === status) {
        status.textContent = "Не удалось загрузить план. Попробуй открыть раздел позже.";
      }
      const cardStatus = document.getElementById("athleteNutritionPlanCardStatus");
      if (cardStatus) cardStatus.textContent = "Не удалось загрузить план";
      const button = document.getElementById("athleteNutritionAnalyzeButton");
      if (button) {
        button.hidden = false;
        button.disabled = false;
        button.textContent = "Сформировать план питания";
      }
    }
  })();

  athleteNutritionPlanLoadPending = loadPromise;
  try {
    await loadPromise;
  } finally {
    if (athleteNutritionPlanLoadPending === loadPromise) {
      athleteNutritionPlanLoadPending = null;
    }
  }
}

async function athleteGenerateNutritionPlan() {
  const button = document.getElementById("athleteNutritionAnalyzeButton");
  const status = document.getElementById("athleteNutritionPlanStatus");
  if (!button || !status) return;

  try {
    const entries = await athleteEnsureNutritionLoaded();
    if (athleteNutritionDayCount(entries) < 7) {
      showMessage("Чтобы сформировать план, добавь данные минимум за 7 разных дней.");
      return;
    }

    button.disabled = true;
    button.textContent = "Анализируем рацион...";
    status.textContent = "Учитываем записи дневника, анкету, цель и доступную историю веса.";

    const result = await athleteNutritionRequest("generate_plan");
    athleteRenderNutritionPlan(result);

  } catch (error) {
    console.error("TRENZO nutrition plan generation failed:", error);
    status.textContent = error.message || "Не удалось сформировать план питания.";
    showMessage(error.message || "Не удалось сформировать план питания.");

  } finally {
    button.disabled = false;
    if (button.textContent === "Анализируем рацион...") {
      button.textContent = "Сформировать план питания";
    }
  }
}

async function athleteLoadNutritionHistory() {
  const slot = document.getElementById("athleteNutritionHistory");

  if (!slot) return;

  if (athleteNutritionCache === null) {
    slot.innerHTML = `<p style="color:#aaa;">Загружаем историю питания...</p>`;
  }

  try {
    const entries = await athleteEnsureNutritionLoaded();
    athleteRenderNutritionTargets(athleteNutritionPlanCache);

    if (document.getElementById("athleteNutritionHistory") !== slot) {
      return;
    }

    const reversedEntries = entries.slice().reverse();
    athleteUpdateNutritionIntroduction(reversedEntries);
    const daysCount = document.getElementById("athleteNutritionDaysCount");

    if (daysCount) {
      const count = Math.min(athleteNutritionDayCount(reversedEntries), 7);
      daysCount.textContent = `${count} из 7`;
    }
    const daysProgress = document.getElementById("athleteNutritionDaysProgress");

    if (daysProgress) {
      const count = Math.min(athleteNutritionDayCount(reversedEntries), 7);

      Array.from(daysProgress.children).forEach(function(segment, index) {
        segment.style.background =
          index < count ? "#ff7846" : "#414141";
      });
    }
    athleteRenderNutritionHistoryWeeks(slot, reversedEntries);

  } catch (error) {
    console.error("TRENZO nutrition history failed:", error);

    if (document.getElementById("athleteNutritionHistory") === slot) {
      slot.innerHTML = `
        <p style="color:#aaa;margin-bottom:0;">
          Не удалось загрузить историю питания.
        </p>
      `;
    }
  }
}
async function athleteConnectFatSecret() {
  if (!tg || !tg.initData) {
    showMessage("Открой TRENZO через Telegram и попробуй снова.");
    return;
  }

  const button = document.getElementById(
    "athleteFatSecretConnectButton"
  );

  if (button) button.disabled = true;

  try {
    const response = await fetch(
      "https://hdxfmvewlpmknyysrpac.supabase.co/functions/v1/fatsecret-connect",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          initData: tg.initData
        })
      }
    );

    const result = await response.json();

    if (!response.ok || result.ok !== true) {
      throw new Error(
        result.error || "Не удалось начать подключение FatSecret."
      );
    }

    const url = new URL(result.authorizationUrl);

    if (
      url.protocol !== "https:" ||
      url.hostname !== "authentication.fatsecret.com"
    ) {
      throw new Error("Получена некорректная ссылка FatSecret.");
    }

    tg.openLink(url.href);

  } catch (error) {
    console.error("TRENZO FatSecret connection failed:", error);

    showMessage("Не удалось открыть подключение FatSecret. Попробуй ещё раз.");

  } finally {
    if (button) button.disabled = false;
  }
}
async function athleteTestFatSecretDay() {
  const dateInput = document.getElementById("athleteFatSecretTestDate");

  if (!dateInput || !dateInput.value) {
    showMessage("Выбери месяц, за который нужно загрузить питание.");
    return;
  }

  if (!tg || !tg.initData) {
    showMessage("Открой TRENZO через Telegram.");
    return;
  }

  const button = document.querySelector(
    'button[onclick="athleteTestFatSecretDay()"]'
  );

  if (button) {
    button.disabled = true;
    button.textContent = "Загружаем питание...";
  }

  try {
    const response = await fetch(
      "https://hdxfmvewlpmknyysrpac.supabase.co/functions/v1/fatsecret-connect",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "read-day",
          initData: tg.initData,
          reportDate: `${dateInput.value}-01`
        })
      }
    );

    const result = await response.json();

    if (!response.ok || result.ok !== true) {
      throw new Error(
        result.error || "Не удалось загрузить питание из FatSecret."
      );
    }

    // Сбрасываем кеш, чтобы дневник получил новые записи из Supabase.
    athleteNutritionCache = null;

    // Открываем дневник: он заново загрузит историю и обновит показатели.
    athleteOpenCabinetSection("nutrition-diary");

    showMessage(
      `Импорт FatSecret за ${result.month} завершён.\n` +
      `Добавлено дней: ${result.imported}\n` +
      `Уже были в дневнике: ${result.skipped}`
    );

  } catch (error) {
    console.error("FatSecret nutrition import failed:", error);

    showMessage(
      "Не удалось загрузить питание из FatSecret. Проверим логи."
    );

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Импортировать данные за месяц";
    }
  }
}

function athleteOpenNutritionUpload() {
  const sheet = document.getElementById("nutritionUploadSheet");
  const dateInput = document.getElementById("nutritionReportDate");

  if (!sheet || !dateInput) return;

  const today = athleteLocalDate();
  dateInput.max = today;
  if (!dateInput.value) dateInput.value = today;
  sheet.showModal();
}

function athleteOpenManualNutrition() {
  const sheet = document.getElementById("nutritionManualSheet");
  const dateInput = document.getElementById("nutritionManualDate");

  if (!sheet || !dateInput) return;

  const today = athleteLocalDate();
  dateInput.max = today;
  if (!dateInput.value) dateInput.value = today;
  sheet.showModal();
}

function athleteRememberNutritionEntry(entry) {
  if (!entry || !Array.isArray(athleteNutritionCache)) {
    athleteNutritionCache = null;
    athleteRenderNutritionTargets(athleteNutritionPlanCache);
    return;
  }

  athleteNutritionCache = athleteNutritionCache
    .filter(function(row) {
      return row.report_date !== entry.report_date;
    })
    .concat(entry)
    .sort(function(a, b) {
      return a.report_date.localeCompare(b.report_date);
    });
  athleteRenderNutritionTargets(athleteNutritionPlanCache);
}

async function athleteSaveManualNutrition() {
  const sheet = document.getElementById("nutritionManualSheet");
  const form = document.getElementById("athleteNutritionManualForm");

  if (!sheet || !form || !form.reportValidity()) return;

  const button = form.querySelector('button[type="submit"]');
  const dateInput = document.getElementById("nutritionManualDate");
  const caloriesInput = document.getElementById("nutritionManualCalories");
  const proteinInput = document.getElementById("nutritionManualProtein");
  const fatInput = document.getElementById("nutritionManualFat");
  const carbsInput = document.getElementById("nutritionManualCarbs");

  if (
    !button || !dateInput || !caloriesInput || !proteinInput ||
    !fatInput || !carbsInput
  ) return;

  button.disabled = true;
  button.textContent = "Сохраняем...";

  try {
    const saved = await athleteNutritionRequest("save_manual", {
      reportDate: dateInput.value,
      nutrition: {
        calories: Number(caloriesInput.value),
        protein_g: Number(proteinInput.value),
        fat_g: Number(fatInput.value),
        carbs_g: Number(carbsInput.value)
      }
    });

    athleteRememberNutritionEntry(saved.entry);
    form.reset();
    sheet.close();
    athleteOpenCabinetSection("nutrition-diary");
    showMessage("Данные КБЖУ сохранены.");

  } catch (error) {
    console.error("TRENZO manual nutrition save failed:", error);
    showMessage(error.message || "Не удалось сохранить данные КБЖУ.");

  } finally {
    button.disabled = false;
    button.textContent = "Сохранить";
  }
}

async function athleteSaveNutritionReport() {
  const sheet = document.getElementById("nutritionUploadSheet");
  const dateInput = document.getElementById("nutritionReportDate");
  const imageInput = document.getElementById("nutritionReportImage");

  if (!sheet || !dateInput || !imageInput) return;

  const file = imageInput.files[0];

  if (!dateInput.value) {
    showMessage("Выбери дату отчёта.");
    return;
  }

  if (!file) {
    showMessage("Выбери скриншот питания.");
    return;
  }

  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    showMessage("Выбери изображение PNG, JPG или WEBP.");
    return;
  }

  if (file.size > 4000000) {
    showMessage("Скриншот слишком большой. Выбери файл до 4 МБ.");
    return;
  }

  const button = sheet.querySelector("button.primary-btn");

  button.disabled = true;
  button.textContent = "Распознаём отчёт...";

  try {
    const imageDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Не удалось прочитать изображение."));

      reader.readAsDataURL(file);
    });

    const saved = await athleteNutritionRequest("save", {
      reportDate: dateInput.value,
      imageDataUrl
    });

    athleteRememberNutritionEntry(saved.entry);

    sheet.close();
    imageInput.value = "";
    athleteOpenCabinetSection("nutrition-diary");
    showMessage("Отчёт питания сохранён.");

  } catch (error) {
    console.error("TRENZO nutrition save failed:", error);

    showMessage(
      error.message || "Не удалось сохранить отчёт питания."
    );

  } finally {
    button.textContent = "Распознать и сохранить";
    button.disabled = !imageInput.files.length;
    button.style.opacity = button.disabled ? "0.5" : "1";
  }
}
async function athleteSaveMeasurements() {
  const form = document.getElementById("athleteMeasurementsForm");
  const dateInput = document.getElementById("athleteMeasurementDate");

  if (!form || !dateInput || !form.reportValidity()) return;

  function readCm(id) {
    const input = document.getElementById(id);

    if (!input || input.value.trim() === "") {
      return null;
    }

    return Number(input.value);
  }

  const measuredOn = dateInput.value;

  const data = {
    shouldersCm: readCm("athleteShoulders"),
    chestCm: readCm("athleteChest"),
    waistCm: readCm("athleteWaist"),
    hipsCm: readCm("athleteHips"),
    bicepsCm: readCm("athleteBiceps"),
    thighCm: readCm("athleteThigh")
  };

  const hasMeasurement = Object.values(data).some(function(value) {
    return value !== null;
  });

  if (!hasMeasurement) {
    showMessage("Укажи хотя бы один замер.");
    return;
  }

  try {
    const saved = await athleteMeasurementsRequest("save", {
  measuredOn,
  ...data
});

if (saved.entry && Array.isArray(athleteMeasurementsCache)) {
  athleteMeasurementsCache = athleteMeasurementsCache
    .filter(function(row) {
      return row.id !== saved.entry.id &&
        row.measured_on !== saved.entry.measured_on;
    })
    .concat(saved.entry);
} else {
  athleteMeasurementsCache = null;
}

    showMessage("Замеры сохранены.");

    athleteOpenCabinetSection("progress-measurements");

  } catch (error) {
    console.error("TRENZO body measurements save failed:", error);

    showMessage(
      error.message ||
      "Не удалось сохранить замеры."
    );
  }
}
function athleteFormatCm(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const n = Number(value);

  if (!Number.isFinite(n)) {
    return "—";
  }

  return Number.isInteger(n)
    ? String(n)
    : n.toFixed(1).replace(".", ",");
}

let athleteMeasurementsCache = null;
async function athleteLoadMeasurementsTable() {
  const slot = document.getElementById("athleteMeasurementsTable");

  if (!slot) return;

if (athleteMeasurementsCache === null) {
  slot.innerHTML = `
    <tr>
      <td colspan="7"
        style="padding:28px 16px;color:#888;text-align:center;
        border-top:1px solid #414141;">
        Загружаем замеры...
      </td>
    </tr>`;
}

  try {
    const result = athleteMeasurementsCache === null
  ? await athleteMeasurementsRequest("load")
  : { entries: athleteMeasurementsCache };

if (
  athleteMeasurementsCache === null &&
  Array.isArray(result.entries)
) {
  athleteMeasurementsCache = result.entries.slice();
}

    if (
      document.getElementById("athleteMeasurementsTable") !== slot
    ) {
      return;
    }

    const rows = Array.isArray(result.entries)
      ? result.entries.slice().reverse()
      : [];
const dynamicsSlot = document.getElementById(
  "athleteMeasurementsDynamics"
);

if (dynamicsSlot) {

  if (rows.length < 2) {

    dynamicsSlot.textContent =
      "Для сравнения нужны минимум два замера.";

  } else {

    const first = rows[rows.length - 1];
    const latest = rows[0];

    const measurements = [
      ["Плечи", "shoulders_cm"],
      ["Грудь", "chest_cm"],
      ["Талия", "waist_cm"],
      ["Бёдра", "hips_cm"],
      ["Бицепс", "biceps_cm"],
      ["Бедро", "thigh_cm"]
    ];

    dynamicsSlot.innerHTML = measurements.map(function(item) {

      const label = item[0];
      const field = item[1];

      const firstValue = first[field];
      const latestValue = latest[field];

      let change = "—";

      if (
        firstValue !== null &&
        firstValue !== undefined &&
        latestValue !== null &&
        latestValue !== undefined &&
        firstValue !== "" &&
        latestValue !== "" &&
        Number.isFinite(Number(firstValue)) &&
        Number.isFinite(Number(latestValue))
      ) {

        const difference =
          Number(latestValue) - Number(firstValue);

        const formatted = Math.abs(difference)
          .toFixed(1)
          .replace(".", ",")
          .replace(/,0$/, "");

        change = difference > 0
          ? "+" + formatted + " см ↑"
          : difference < 0
            ? "−" + formatted + " см ↓"
            : "0 см";

      }

      return `
        <div style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:12px;
          padding:12px 0;
          border-bottom:1px solid #414141;
        ">

          <span style="color:#ccc;">
            ${label}
          </span>

          <strong style="
            color:#ff7846;
            font-size:14px;
            white-space:nowrap;
          ">
            ${change}
          </strong>

        </div>`;

    }).join("");

  }

}
    if (!rows.length) {
      slot.innerHTML = `
        <tr>
          <td colspan="8"
            style="padding:28px 16px;color:#888;text-align:center;
            border-top:1px solid #414141;">
            Пока нет сохранённых замеров
          </td>
        </tr>`;
      return;
    }

    slot.innerHTML = rows.map(function(row) {
     const date = typeof row.measured_on === "string"
  ? row.measured_on.slice(8, 10) + "." +
    row.measured_on.slice(5, 7) + "." +
    row.measured_on.slice(2, 4)
  : "—";

      return `
        <tr>
          <td style="padding:14px 10px;text-align:left;
            border-top:1px solid #414141;">
            ${athleteEscape(date)}
          </td>

          <td style="padding:14px 10px;border-top:1px solid #414141;">
            ${athleteFormatCm(row.shoulders_cm)}
          </td>

          <td style="padding:14px 10px;border-top:1px solid #414141;">
            ${athleteFormatCm(row.chest_cm)}
          </td>

          <td style="padding:14px 10px;border-top:1px solid #414141;">
            ${athleteFormatCm(row.waist_cm)}
          </td>

          <td style="padding:14px 10px;border-top:1px solid #414141;">
            ${athleteFormatCm(row.hips_cm)}
          </td>

          <td style="padding:14px 10px;border-top:1px solid #414141;">
            ${athleteFormatCm(row.biceps_cm)}
          </td>

          <td style="padding:14px 10px;border-top:1px solid #414141;">
            ${athleteFormatCm(row.thigh_cm)}
          </td>
        </tr>`;
    }).join("");

  } catch (error) {
    console.error("TRENZO body measurements load failed:", error);

    if (
      document.getElementById("athleteMeasurementsTable") === slot
    ) {
      slot.innerHTML = `
        <tr>
          <td colspan="7"
            style="padding:28px 16px;color:#888;text-align:center;
            border-top:1px solid #414141;">
            Не удалось загрузить замеры
          </td>
        </tr>`;
    }
  }
}
function athleteFormatWeight(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(1).replace(".", ",") + " кг" : "—";
}

function athleteWeightPoints(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.filter(function(row) {
    return row && Number.isSafeInteger(row.id) &&
      /^\d{4}-\d{2}-\d{2}$/.test(row.measured_on || "") &&
      Number.isFinite(Number(row.weight_kg)) &&
      Number(row.weight_kg) >= 25 && Number(row.weight_kg) <= 400;
  }).map(function(row) {
    return { id: row.id, date: row.measured_on,
      kg: Number(row.weight_kg), source: row.source };
  }).sort(function(a, b) { return a.date.localeCompare(b.date) || a.id - b.id; });
}

// Одна загрузка истории для всего кабинета. Повторные переходы
// используют уже полученные данные, а не отправляют запрос заново.
async function athleteEnsureWeightLoaded() {
  if (athleteWeightLoaded) return athleteWeightEntries;
  if (athleteWeightPending) return athleteWeightPending;
  athleteWeightPending = (async function() {
    const result = await athleteWeightRequest("load");
    athleteWeightEntries = athleteWeightPoints(result.entries);
    athleteWeightLoaded = true;
    return athleteWeightEntries;
  })();
  try {
    return await athleteWeightPending;
  } finally {
    athleteWeightPending = null;
  }
}

// При первом открытии вес уже может подгружаться из личного кабинета.
// Не показываем внутри страницы пустой график, который потом её сдвигает.
async function athleteOpenWeightSection() {
  const marker = document.getElementById("athleteProgressWeightPreview");
  if (marker && !athleteWeightLoaded) {
    marker.textContent = "Открываем историю веса...";
  }
  try {
    await athleteEnsureWeightLoaded();
  } catch (error) {
    if (marker && document.getElementById("athleteProgressWeightPreview") === marker) {
      marker.textContent = "Не удалось загрузить вес · Нажми, чтобы попробовать снова";
    }
    showMessage(error.message || "Не удалось загрузить историю веса.");
    return;
  }
  // Если пользователь уже покинул экран, не перебиваем его навигацию.
  if (marker && document.getElementById("athleteProgressWeightPreview") !== marker) return;
  athleteOpenCabinetSection("progress-weight");
}

// Компактная карточка веса на главной странице «Прогресс».
// Берём реальные измерения из той же истории, что и полный график.
async function athleteLoadProgressWeightPreview() {
  const slot = document.getElementById("athleteProgressWeightPreview");
  if (!slot) return;
  try {
    const rows = await athleteEnsureWeightLoaded();
    if (document.getElementById("athleteProgressWeightPreview") !== slot) return;
    const baseline = rows.find(row => row.source === "onboarding") || rows[0];
    const latest = rows[rows.length - 1];
    slot.textContent = latest
      ? (baseline ? athleteFormatWeight(baseline.kg) + " → " : "") +
        athleteFormatWeight(latest.kg) + " · " + rows.length +
        (rows.length === 1 ? " запись" : " записей")
      : "Пока нет взвешиваний · Нажми, чтобы записать вес";
  } catch (error) {
    if (document.getElementById("athleteProgressWeightPreview") === slot) {
      slot.textContent = "Не удалось загрузить вес · Нажми, чтобы попробовать снова";
    }
  }
}

async function athleteLoadWeightSummary() {
  const slot = document.getElementById("athleteCabinetLatestWeight");
  if (!slot) return;
  try {
    const rows = await athleteEnsureWeightLoaded();
    if (document.getElementById("athleteCabinetLatestWeight") !== slot) return;
    slot.textContent = rows.length
      ? "Последний зафиксированный вес: " + athleteFormatWeight(rows[rows.length - 1].kg)
      : "История веса пока пуста";
  } catch (error) {
    if (document.getElementById("athleteCabinetLatestWeight") === slot) {
      slot.textContent = error.message || "Не удалось загрузить вес.";
    }
  }
}

async function athleteLoadProfileWeight() {
  const slot = document.getElementById("athleteProfileWeight");
  if (!slot) return;
  try {
    const rows = await athleteEnsureWeightLoaded();
    if (document.getElementById("athleteProfileWeight") !== slot) return;
    const latest = rows[rows.length - 1];
    slot.innerHTML = `<strong>Актуальные измерения</strong>` +
      athleteCabinetRow("Последний зафиксированный вес",
        latest ? athleteFormatWeight(latest.kg) : "") +
      athleteCabinetRow("Дата последнего взвешивания",
        latest ? latest.date.split("-").reverse().join(".") : "");
  } catch (error) {
    if (document.getElementById("athleteProfileWeight") === slot) {
      slot.textContent = error.message || "Не удалось загрузить вес.";
    }
  }
}

function athleteWeightChart(points) {
  if (!points.length) return "<p>Пока нет измерений для выбранного периода.</p>";
  const values = points.map(p => p.kg);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const min = Math.max(0, Math.floor((low - 0.5) * 2) / 2);
  const max = Math.ceil((high + 0.5) * 2) / 2;
  const range = Math.max(1, max - min);
  const coords = points.map(function(p, i) {
    const x = points.length === 1 ? 160 : 35 + (270 * i / (points.length - 1));
    const y = 126 - (p.kg - min) / range * 106;
    return { x: x.toFixed(2), y: y.toFixed(2) };
  });
  const path = coords.map(p => p.x + "," + p.y).join(" ");
  const dots = coords.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3.2" fill="#ff7846"/>`).join("");
  const start = points[0].date.slice(5).split("-").reverse().join(".");
  const end = points[points.length - 1].date.slice(5).split("-").reverse().join(".");
  return `<svg viewBox="0 0 320 161" role="img"
      aria-label="График веса по датам" style="display:block;width:100%;max-width:480px;height:auto;">
      <line x1="35" y1="20" x2="35" y2="126" stroke="#666"/>
      <line x1="35" y1="126" x2="305" y2="126" stroke="#666"/>
      <text x="31" y="20" text-anchor="end" fill="#aaa" font-size="9">${max.toFixed(1)}</text>
      <text x="31" y="126" text-anchor="end" fill="#aaa" font-size="9">${min.toFixed(1)}</text>
      <polyline points="${path}" fill="none" stroke="#ff7846"
        stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
      <text x="35" y="146" fill="#aaa" font-size="10">${start}</text>
      <text x="305" y="146" text-anchor="end" fill="#aaa" font-size="10">${end}</text>
    </svg>`;
}

function athleteRenderWeightHistory() {
  const slot = document.getElementById("athleteWeightHistory");
  if (!slot) return;
  const rows = athleteWeightEntries;
  const baseline = rows.find(p => p.source === "onboarding");
  const latest = rows[rows.length - 1];
  const since = new Date();
  if (athleteWeightPeriod === "month") since.setDate(since.getDate() - 30);
  if (athleteWeightPeriod === "quarter") since.setDate(since.getDate() - 90);
  const from = [since.getFullYear(), String(since.getMonth() + 1).padStart(2, "0"),
    String(since.getDate()).padStart(2, "0")].join("-");
  const graphRows = athleteWeightPeriod === "all"
    ? rows : rows.filter(p => p.date >= from);
  const difference = baseline && latest
    ? (latest.kg - baseline.kg) : null;
  const delta = difference === null ? "" :
    ` · Изменение: ${difference > 0 ? "+" : ""}${difference.toFixed(1).replace(".", ",")} кг`;
  const history = rows.slice(-30).reverse().map(function(row) {
    const source = row.source === "onboarding" ? " · начало" : "";
    return `<div class="summary-row">
      <small>${row.date.split("-").reverse().join(".")}${source}</small>
      <strong>${athleteFormatWeight(row.kg)}</strong>
    </div>`;
  }).join("");
  slot.innerHTML = `<strong>История веса</strong>
    <p>Первый вес: ${baseline ? athleteFormatWeight(baseline.kg) : "—"}</p>
    <p>Последний вес: ${latest ? athleteFormatWeight(latest.kg) : "—"}${delta}</p>
    <div class="field"><label class="field-title" for="athleteWeightPeriod">Период графика</label>
      <select id="athleteWeightPeriod" class="text-input"
        onchange="athleteWeightPeriod=this.value;athleteRenderWeightHistory();">
        <option value="month" ${athleteWeightPeriod === "month" ? "selected" : ""}>30 дней</option>
        <option value="quarter" ${athleteWeightPeriod === "quarter" ? "selected" : ""}>90 дней</option>
        <option value="all" ${athleteWeightPeriod === "all" ? "selected" : ""}>Всё время</option>
      </select></div>
    ${athleteWeightChart(graphRows)}
    <strong style="display:block;margin-top:14px;">Все взвешивания</strong>
    ${history || "<p>Пока нет записей о весе.</p>"}
    ${rows.length > 30 ? "<p class=\"small-note\">Показаны последние 30 записей, на графике — все.</p>" : ""}
    <p class="small-note">Вес может колебаться от дня к дню. Для сравнения недель
      позднее добавим средние значения по неделям.</p>`;
}

async function athleteLoadWeightHistory() {
  const slot = document.getElementById("athleteWeightHistory");
  if (!slot) return;
  try {
    await athleteEnsureWeightLoaded();
    if (document.getElementById("athleteWeightHistory") !== slot) return;
    athleteRenderWeightHistory();
  } catch (error) {
    if (document.getElementById("athleteWeightHistory") === slot) {
      slot.textContent = error.message || "Не удалось загрузить историю веса.";
    }
  }
}

async function athleteSaveWeight() {
  if (athleteWeightSaving) return;
  const form = document.getElementById("athleteWeightForm");
  const button = document.getElementById("athleteWeightSaveButton");
  const dateInput = document.getElementById("athleteWeightDate");
  const weightInput = document.getElementById("athleteWeightKg");
  if (!form || !button || !dateInput || !weightInput || !form.reportValidity()) return;
  const weightKg = Number(weightInput.value);
  const measuredOn = dateInput.value;
  if (!Number.isFinite(weightKg) || weightKg < 25 || weightKg > 400 ||
      Math.round(weightKg * 10) !== weightKg * 10 || !measuredOn ||
      measuredOn > athleteLocalDate()) {
    showMessage("Укажи дату не позже сегодняшней и вес от 25 до 400 кг с точностью до 0,1 кг.");
    return;
  }
  athleteWeightSaving = true;
  button.disabled = true;
  button.textContent = "Сохраняем...";
  try {
    // Дожидаемся предыдущей загрузки, если она ещё выполняется.
    await athleteEnsureWeightLoaded();
    const saved = await athleteWeightRequest("save", { measuredOn, weightKg });
    const entry = athleteWeightPoints([saved.entry])[0];
    if (!entry) throw new Error("Сервер не вернул сохранённое измерение.");
    athleteWeightEntries = athleteWeightEntries
      .filter(function(row) { return row.id !== entry.id; })
      .concat(entry)
      .sort(function(a, b) { return a.date.localeCompare(b.date) || a.id - b.id; });
    athleteWeightLoaded = true;
    athleteRenderWeightHistory();
    if (document.getElementById("athleteWeightKg") === weightInput) {
      weightInput.value = "";
      showMessage("Вес сохранён.");
    }
  } catch (error) {
    showMessage(error.message || "Не удалось сохранить вес.");
  } finally {
    athleteWeightSaving = false;
    if (document.getElementById("athleteWeightSaveButton") === button) {
      button.disabled = false;
      button.textContent = "Сохранить вес →";
    }
  }
}
