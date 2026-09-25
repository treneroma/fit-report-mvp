/*
  TRENZO — регистрация пользователя «Мой прогресс»

  Разрешённые поля анкеты сохраняются в Supabase.
  Ограничения по здоровью, свободный текст программы,
  фотографии и имена файлов НЕ отправляем.
*/

let athleteStep = 0;
let athleteSaving = false;
let athleteRestoreNotice = "";

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

const athleteTotalSteps = 15;

const athleteTitles = [
  "Как тебя зовут?",
  "Расскажи немного о себе",
  "Твои параметры",
  "Какая у тебя цель?",
  "Какого результата ты хочешь достичь?",
  "Твой тренировочный опыт",
  "Сколько времени ты готов уделять тренировкам?",
  "Что нам важно знать о твоём здоровье?",
  "Добавить фотографии тела?",
  "Следишь ли ты за питанием?",
  "Есть ли особенности питания?",
  "Как ты сейчас тренируешься?",
  "Есть ли у тебя тренировочная программа?",
  "Подготовим твои тренировки",
  "Проверь свою анкету"
];

const athleteHints = [
  "Давай познакомимся. Как к тебе обращаться?",
  "Эти данные помогут настроить личный профиль.",
  "Укажи свои актуальные показатели.",
  "Выбери основное направление, над которым хочешь работать.",
  "Расскажи, к чему ты стремишься и за какой срок.",
  "Нам важно знать не только общий стаж, но и как ты тренировался в последнее время.",
  "Подберём формат, который впишется в твой график.",
  "Расскажи обо всём, что может повлиять на тренировки.",
  "Фотографии помогут сравнивать визуальные изменения со временем.",
  "От этого зависит, как мы будем выстраивать работу с питанием.",
  "Учитываем твои привычки и ограничения.",
  "Это поможет выбрать дальнейший сценарий.",
  "Можно начать с текущей программы или пройти адаптационный период.",
  "Последний шаг перед проверкой анкеты.",
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

  return `
    <div class="field">
      <label class="field-title" for="${name}">
        ${label}
      </label>

      <input
        class="text-input"
        id="${name}"
        name="${name}"
        type="${type}"
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

      <div class="option-list">

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
        "Например, Роман",
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
          "Например, 178",
          'required min="100" max="250"'
        )}

        ${athleteInput(
          "weight",
          "Текущий вес, кг",
          "number",
          "Например, 82.5",
          'required min="25" max="400" step="0.1"'
        )}

        <p class="small-note">
          Позже мы добавим историю взвешиваний,
          чтобы видеть изменения веса во времени.
        </p>
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
          "Если есть цель по весу",
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
          "За сколько месяцев ты хочешь достичь цели?",
          "number",
          "Например, 6",
          'required min="1" max="60"'
        )}

        <div id="goalWarning" hidden></div>

        <p class="small-note">
          Срок — твоё пожелание, а не обещание результата.
          Мы отдельно проверим, насколько он обоснован.
        </p>
      `;
    }


    // 6. ОПЫТ

    case 5:
      return `
        ${athleteOptions("experience", "Общий опыт", [
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
          Если ограничений нет, напиши «Нет».
          Это поле пока хранится только до закрытия приложения:
          мы НЕ отправляем его в Supabase. Анкета не заменяет
          медицинскую консультацию.
        </p>
      `;


    // 9. ФОТОГРАФИИ

    case 8:
      return `
        <div class="info-card">
          <strong>Фотографии необязательны.</strong><br>
          Можно добавить фотографии спереди, сбоку и сзади.
          Они нужны только для сравнения визуального прогресса,
          а не для диагностики или оценки техники упражнений.
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
          >

          <p class="field-hint">
            Пока файлы не загружаются на сервер.
            Мы подключим их сохранение позднее.
          </p>

          <p class="field-hint">
            Ранее выбрано:
            ${athleteEscape(
              (d.photoNames || []).join(", ") || "ничего"
            )}
          </p>
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


    // 14. ПРОГРАММА ИЛИ АДАПТАЦИЯ

    case 13: {
      if (d.programStatus === "no") {
        return `
          <div class="info-card">
            <strong>Начнём с адаптационного периода.</strong><br><br>

            После настройки тренировочного модуля ты сможешь
            начать с базовой программы. По результатам выполненных
            тренировок система будет собирать данные о нагрузках,
            переносимости упражнений и восстановлении.

            <br><br>

            Эти данные станут основой для дальнейшей корректировки
            тренировочной программы.
          </div>

          <p class="small-note">
            Пока это описание будущего сценария:
            сами тренировки ещё не сформированы.
          </p>
        `;
      }

      return `
        <div class="info-card">
          <strong>Добавь текущую программу.</strong><br><br>

          Можно описать её вручную или выбрать файл:
          PDF, фотографию либо скриншот.

          На следующем этапе подключим распознавание программы
          и перевод упражнений, подходов, повторений и весов
          в структурированные данные.
        </div>

        ${athleteArea(
          "programText",
          "Программа в текстовом виде",
          "Например:\nПонедельник\nПриседания — 3 × 10 × 60 кг\nЖим лёжа — 3 × 8 × 50 кг"
        )}

        <div class="field">
          <label class="field-title" for="programFile">
            Или выбери файл программы
          </label>

          <input
            class="file-input"
            id="programFile"
            name="programFile"
            type="file"
            accept=".pdf,image/*,text/plain"
          >

          <p class="field-hint">
            Выбранный файл:
            ${athleteEscape(d.programFileName || "нет")}
          </p>

          <p class="field-hint">
            Пока файл не отправляется на сервер и не анализируется.
          </p>
        </div>
      `;
    }


    // 15. ПРОВЕРКА АНКЕТЫ

    case 14:
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

      ${athleteSummaryRow(
        "Файл программы",
        d.programFileName
      )}

    </div>

    <p class="small-note">
      Это предварительная анкета. На сервер сохраняются только
      основные тестовые ответы. Ограничения по здоровью,
      свободный текст программы,
      фотографии и имена файлов НЕ сохраняются и после перезапуска
      будут недоступны. ИИ-анализ ещё не выполнялся.
    </p>
  `;
}


// Отображаем текущий экран анкеты

function athleteRender() {
  if (athleteStep === athleteTotalSteps) {
    athleteRenderComplete();
    return;
  }

  const progress =
    ((athleteStep + 1) / athleteTotalSteps) * 100;

  const lastStep = athleteStep === athleteTotalSteps - 1;

  document.getElementById("athleteScreen").innerHTML = `
    <div class="page">

      <div class="topbar">

        <button
          class="back-button"
          type="button"
          onclick="athleteBack()"
          aria-label="Назад"
        >←</button>

        <div class="logo">TREN<span>ZO</span></div>

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

      <p class="hint">
        ${athleteHints[athleteStep]}
      </p>

      <form
        id="athleteForm"
        onsubmit="event.preventDefault(); athleteNext();"
      >

        ${athleteFields()}

        <div class="form-bottom">

          <button class="primary-btn" type="submit" id="athleteNextButton">
            ${lastStep
              ? "Подтвердить и завершить →"
              : "Продолжить →"}
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


  // Имена выбранных фотографий.
  // Содержимое файлов не сохраняем и не загружаем.

  const photos = document.getElementById("bodyPhotos");

  if (photos && photos.files.length) {
    d.photoNames = Array.from(photos.files).map(
      function(file) {
        return file.name;
      }
    );
  }


  const programFile = document.getElementById("programFile");

  if (programFile && programFile.files.length) {
    d.programFileName = programFile.files[0].name;
  }

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
        ? "Подтвердить и завершить →" : "Продолжить →");
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
      <button id="athleteAnalyzeButton" class="primary-btn" type="button"
        onclick="athleteAnalyzeProfile()" hidden>
        Анализировать анкету ✦
      </button>
      <div id="athleteAiResult" class="info-card"
        style="white-space: pre-wrap;" hidden></div>
      <div id="athleteOnboardingQuestions"></div>
      <div class="form-bottom">
        <button class="secondary-btn" type="button"
          onclick="athleteStep = 14; athleteRender();">
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

  athleteAiInProgress = true;
  button.disabled = true;
  button.textContent = "Знакомлюсь с твоей целью...";
  statusBox.hidden = false;
  statusBox.textContent = "Смотрю твою анкету. Сейчас разберусь с целью.";

  try {
    const response = await fetch(
      "https://hdxfmvewlpmknyysrpac.supabase.co/functions/v1/analyze-profile",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: tg.initData })
      }
    );
    const result = await response.json();
    if (!response.ok || result.ok !== true) {
      if (response.status === 401) {
        throw new Error("Сессия Telegram устарела. Закрой приложение и открой его заново.");
      }
      if (response.status === 429) {
        throw new Error("Дневной лимит ИИ-анализов исчерпан. Попробуй завтра.");
      }
      throw new Error("Не удалось выполнить анализ анкеты.");
    }
    // Запрашиваем сохранённые вопросы с их ID, чтобы привязать к ним ответы.
    await athleteLoadOnboarding();
  } catch (error) {
    console.error("TRENZO AI analysis failed:", error);
    statusBox.hidden = false;
    statusBox.textContent = error.message || "Не удалось выполнить анализ.";
    button.hidden = false;
  } finally {
    athleteAiInProgress = false;
    button.disabled = false;
    button.textContent = "Анализировать анкету ✦";
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
    <strong>${athleteEscape(title)}</strong>
    <div style="margin-top: 14px;">${rows}</div>
  </div>`;
}

function athleteCabinetHeader(label, title) {
  return `<div class="topbar" style="justify-content:space-between;">
      <div class="logo">TREN<span>ZO</span></div>
      <button class="back-button" type="button"
        onclick="athleteRenderCabinet()"
        aria-label="Вернуться в личный кабинет">←</button>
    </div>
    <h1 style="margin:0 0 14px;">
      ${athleteEscape(title)}
    </h1>`;
}

function athleteCabinetNavButton(section, symbol, title, detail) {
  // section, symbol и подписи заданы разработчиком, не приходят от пользователя.
  return `<button class="info-card" type="button"
    onclick="athleteOpenCabinetSection('${section}')"
    style="display:flex;width:100%;align-items:center;gap:12px;
      margin:0 !important;min-height:0 !important;height:auto !important;
      padding:12px 14px;text-align:left;color:inherit;
      font:inherit;cursor:pointer;box-sizing:border-box;">
      <span aria-hidden="true" style="display:flex;align-items:center;
        justify-content:center;flex:none;width:40px;height:40px;
        border-radius:12px;background:#39302b;color:#ff7846;
        font-weight:700;font-size:18px;">${symbol}</span>
      <span style="flex:1;min-width:0;">
        <strong style="display:block;font-size:18px;">${title}</strong>
        <span style="display:block;margin-top:6px;font-size:13px;
          line-height:1.45;color:#aaa;">${detail}</span>
      </span>
      <span aria-hidden="true" style="color:#ff7846;font-size:24px;">›</span>
    </button>`;
}

function athleteRenderCabinet() {
  const d = athleteSafeAnswers();
  const goalLabels = {
    lose: "Снижение веса", muscle: "Набор мышечной массы",
    recomp: "Изменение состава тела", strength: "Развитие силы",
    fitness: "Улучшение формы", other: "Индивидуальная цель"
  };
  const goal = athleteCabinetValue(d.goal, goalLabels);
  const weights = d.weight
    ? `Вес при регистрации: ${athleteEscape(d.weight)} кг`
    : "Вес при регистрации не указан";
  const target = d.targetWeight
    ? ` · Цель: ${athleteEscape(d.targetWeight)} кг`
    : "";

  document.getElementById("athleteScreen").innerHTML = `
    <div class="page" style="display:block;min-height:0;padding-bottom:24px;">
      <div class="topbar" style="margin-bottom:12px;"><div class="logo">TREN<span>ZO</span></div></div>
      <h1 style="margin:0 0 16px;">Личный кабинет</h1>
      <div class="info-card" style="margin:0 !important;">
        <div class="step-label">ТВОЯ ЦЕЛЬ</div>
        <strong style="display:block;font-size:20px;margin:8px 0;">${goal}</strong>
        <p style="margin:0;">${weights}${target}</p>
        <p id="athleteCabinetLatestWeight" style="margin:6px 0 0;color:#bbb;">Последний вес: загружаем...</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;margin:12px 0 0;align-items:stretch;">
        ${athleteCabinetNavButton("profile", "◉", "Мой профиль",
          "Анкета, личные данные и твоя цель")}
        ${athleteCabinetNavButton("nutrition", "✦", "Питание",
          "Твои привычки, будущий рацион и отчёты")}
        ${athleteCabinetNavButton("training", "↗", "Тренировочный план",
          "Текущий режим, будущие тренировки и отчёты")}
        ${athleteCabinetNavButton("progress", "▥", "Прогресс",
          "Исходные показатели и динамика результатов")}
      </div>
    </div>`;
  window.scrollTo(0, 0);
  athleteLoadWeightSummary();
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
        фотографии и файлы в тестовой версии не сохраняются.</p>`;
  } else if (section === "nutrition") {
  title = "Питание";

  content = `
    <div class="info-card" style="margin-bottom:16px;">
      <h3 style="margin:0 0 18px;">Контроль питания</h3>

      <p style="color:#aaa;margin:0;">
        Собираем данные для расчёта твоего плана питания.
      </p>

      <p
  id="athleteNutritionOverviewDaysCount"
  style="color:#ff7846;font-weight:700;margin:12px 0 0;"
>
  Добавлено дней: 0 из 7
</p>
    </div>
    <button
      class="info-card"
      type="button"
      onclick="athleteOpenCabinetSection('nutrition-diary')"
      style="display:block;width:100%;margin-bottom:16px;text-align:left;cursor:pointer;color:#fff;"
    >
      <strong>Дневник питания</strong>
      <p style="color:#aaa;margin:8px 0 0;">
        Загрузка питания и история по дням
      </p>
    </button>

    <div class="info-card">
      <h3 style="margin:0 0 8px;">План питания</h3>
      <p style="color:#aaa;margin:0 0 14px;">
        ИИ учтёт дневник питания, вес, цель, особенности питания и доступные сведения о тренировках.
      </p>
      <p id="athleteNutritionPlanStatus" role="status"
        style="color:#aaa;margin:0 0 12px;">
        Проверяем сохранённый план...
      </p>
      <div id="athleteNutritionPlanOutput"></div>
      <button id="athleteNutritionAnalyzeButton" class="primary-btn"
        type="button" onclick="athleteGenerateNutritionPlan()"
        style="width:100%;">
        Анализ питания
      </button>
      <p class="small-note">
        Это предварительный ориентир по КБЖУ. Обсуди изменения с тренером и соблюдай назначения врача.
      </p>
    </div>
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

<div class="info-card" style="margin-bottom:16px;">
  <h3 style="margin:0 0 8px;">Текущие показатели</h3>

  <p style="color:#aaa;margin:0 0 20px;">
    Среднее по добавленным дням
  </p>

  <div id="athleteNutritionCurrentStats">
    <p style="color:#aaa;margin:0;">
      Пока нет данных.
    </p>
  </div>
</div>

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
    margin-bottom:20px;
  ">
    <h3 style="margin:0;">Как внести КБЖУ?</h3>
    <button type="button" onclick="this.closest('dialog').close()"
      aria-label="Закрыть"
      style="width:36px;height:36px;flex-shrink:0;border:1px solid #484848;
        border-radius:10px;background:#303030;color:#fff;font-size:24px;cursor:pointer;">
      ×
    </button>
  </div>

  <div style="display:flex;flex-direction:column;gap:10px;">
    <button class="info-card" type="button"
      onclick="this.closest('dialog').close();document.getElementById('nutritionFatSecretSheet').showModal()"
      style="display:block;width:100%;margin:0;text-align:left;color:#fff;cursor:pointer;">
      <strong>FatSecret</strong>
      <p style="color:#aaa;margin:6px 0 0;">
        Подключить аккаунт или импортировать данные за месяц
      </p>
    </button>

    <button class="info-card" type="button"
      onclick="this.closest('dialog').close();athleteOpenNutritionUpload()"
      style="display:block;width:100%;margin:0;text-align:left;color:#fff;cursor:pointer;">
      <strong>Загрузить скриншот</strong>
      <p style="color:#aaa;margin:6px 0 0;">
        Распознать итоговые калории и БЖУ за день
      </p>
    </button>

    <button class="info-card" type="button"
      onclick="this.closest('dialog').close();athleteOpenManualNutrition()"
      style="display:block;width:100%;margin:0;text-align:left;color:#fff;cursor:pointer;">
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
    title = "Тренировочный план";
    content = athleteCabinetCard("Твой режим из анкеты",
      athleteCabinetRow("Опыт", d.experience, {
        new: "Только начинаю", under1: "До 1 года", "1to3": "От 1 до 3 лет",
        "3to5": "От 3 до 5 лет", "5plus": "Более 5 лет"
      }) +
      athleteCabinetRow("Последние 3 месяца", d.recentTraining, {
        none: "Почти не тренировался", irregular: "Нерегулярно",
        "1to2": "1–2 раза в неделю", "3plus": "3 и более раз в неделю",
        program: "Регулярно по программе"
      }) +
      athleteCabinetRow("Тренировок в неделю", d.frequency) +
      athleteCabinetRow("Длительность", d.duration, {
        under45: "До 45 минут", "45to60": "45–60 минут",
        "60to90": "60–90 минут", over90: "Более 90 минут"
      }) +
      athleteCabinetRow("Формат занятий", d.trainingMode, {
        alone: "Самостоятельно", coach: "С тренером",
        mixed: "Самостоятельно и с тренером", starting: "Планирую начать"
      }) +
      athleteCabinetRow("Наличие программы", d.programStatus, {
        yes: "Есть действующая программа", partial: "Есть отдельные упражнения",
        no: "Программы пока нет"
      })) +
      athleteCabinetCard("Тренировки и отчёты",
        `<p>Расписание, предстоящие и прошедшие тренировки,
        программа и отчёты появятся здесь после настройки модуля.</p>`);
  } else if (section === "progress") {
    title = "Прогресс";
    content = `
      <div class="info-card" style="margin:0 !important;padding:16px;">
        <div class="step-label" style="margin:0 0 8px;">ТВОЯ ИСТОРИЯ</div>
        <strong style="display:block;font-size:18px;">Каждая тренировка — часть прогресса</strong>
        <p style="margin:8px 0 0;color:#aaa;font-size:14px;line-height:1.45;">
          Вес уже сохраняется. Силовые результаты и тренировки появятся здесь,
          когда подключим тренировочные отчёты.
        </p>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;margin:12px 0 0;align-items:stretch;">
<button class="info-card" type="button" onclick="athleteOpenCabinetSection('progress-body')"
          style="display:flex;width:100%;align-items:center;gap:12px;margin:0 !important;
          min-height:0 !important;height:auto !important;padding:14px;text-align:left;
          color:inherit;font:inherit;cursor:pointer;box-sizing:border-box;">
          <span aria-hidden="true" style="flex:none;width:40px;height:40px;
            display:flex;align-items:center;justify-content:center;border-radius:12px;
            background:#39302b;color:#ff7846;font-size:22px;">↗</span>
          <span style="flex:1;min-width:0;">
            <strong style="display:block;font-size:18px;">Вес и тело</strong>
            <span id="athleteProgressWeightPreview" role="status"
              style="display:block;margin-top:4px;color:#aaa;font-size:13px;line-height:1.4;">
              История измерений и график
            </span>
          </span>
          <span aria-hidden="true" style="color:#ff7846;font-size:24px;">›</span>
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

  <strong style="display:block;font-size:18px;">
    Динамика изменений
  </strong>

  <p style="margin:6px 0 16px;color:#aaa;font-size:13px;">
    Сравнение с первым замером
  </p>

  <div id="athleteMeasurementsDynamics"
    role="status"
    style="color:#aaa;font-size:14px;line-height:1.5;">

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

let backAction = "athleteRenderCabinet()";
  let backLabel = "В личный кабинет";

if (section === "nutrition-diary") {
  backAction = "athleteOpenCabinetSection('nutrition')";

} else if (section === "progress-measurements-form") {
  backAction = "athleteOpenCabinetSection('progress-measurements')";
  backLabel = "В замеры тела";

} else if (
  section === "progress-weight" ||
  section === "progress-measurements"
) {
  backAction = "athleteOpenCabinetSection('progress-body')";
  backLabel = "В вес и тело";

} else if (progressSubpage) {
  backAction = "athleteOpenCabinetSection('progress')";
  backLabel = "В прогресс";
}
  screen.innerHTML = `<div class="page" style="display:block;min-height:0;padding-bottom:24px;">
    <div class="topbar" style="margin-bottom:12px;justify-content:space-between;">
  <div class="logo">TREN<span>ZO</span></div>
  <button class="back-button" type="button"
    onclick="${backAction}"
    aria-label="Назад">←</button>
</div>
    <h1 style="margin:0 0 16px;">${athleteEscape(title)}</h1>
    ${content}
    <button class="secondary-btn" type="button" style="margin-top:16px;"
onclick="athleteRenderCabinet()">← В личный кабинет</button>
  </div>`;
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
}
  if (section === "nutrition") {
  athleteRenderNutritionOverview();
  athleteLoadNutritionPlan();
  }
}

// История веса: отдельная защищённая Edge Function с проверкой Telegram.
// Вес из анкеты не перезаписываем. Все измерения читаем с сервера.
const ATHLETE_WEIGHT_URL =
  "https://hdxfmvewlpmknyysrpac.supabase.co/functions/v1/weight-history";
const ATHLETE_MEASUREMENTS_URL =
  "https://hdxfmvewlpmknyysrpac.supabase.co/functions/v1/body-measurements";
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
      if (action === "generate_plan" || action === "load_plan") {
        throw new Error("Анализ питания пока доступен только тестовому аккаунту.");
      }
      throw new Error("Доступ к дневнику питания пока не открыт.");
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
      throw new Error("Дневной лимит ИИ-анализов исчерпан. Попробуй завтра.");
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
let athleteNutritionCache = null;
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
async function athleteRenderNutritionOverview() {
  const daysCount = document.getElementById(
    "athleteNutritionOverviewDaysCount"
  );

  if (!daysCount) return;

  try {
    await athleteEnsureNutritionLoaded();

    // За время запроса пользователь мог уйти с экрана.
    if (
      document.getElementById("athleteNutritionOverviewDaysCount") !== daysCount
    ) {
      return;
    }

    const count = Math.min(athleteNutritionDayCount(athleteNutritionCache), 7);

    daysCount.textContent = `Добавлено дней: ${count} из 7`;

  } catch (error) {
    console.error("TRENZO nutrition overview failed:", error);

    if (
      document.getElementById("athleteNutritionOverviewDaysCount") === daysCount
    ) {
      daysCount.textContent = "Добавлено дней: — из 7";
    }
  }
}

function athleteNutritionFormat(value, digits = 0) {
  return Number(value).toLocaleString("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function athleteRenderNutritionPlan(result) {
  const output = document.getElementById("athleteNutritionPlanOutput");
  const status = document.getElementById("athleteNutritionPlanStatus");
  const button = document.getElementById("athleteNutritionAnalyzeButton");
  if (!output || !status || !button) return;

  const plan = result && result.plan;
  if (!plan || !Array.isArray(plan.weekPlan)) {
    status.textContent = "Сохранённого плана пока нет. Добавь данные минимум за 7 дней и запусти анализ.";
    button.textContent = "Анализ питания";
    return;
  }

  const dayNames = [
    "Понедельник", "Вторник", "Среда", "Четверг",
    "Пятница", "Суббота", "Воскресенье"
  ];
  const week = plan.weekPlan.map(function(day) {
    const dayName = dayNames[Number(day.dayIndex) - 1];
    if (!dayName) return "";

    return `<div style="padding:12px 0;border-top:1px solid #414141;">
      <strong>${dayName}</strong>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 12px;margin-top:8px;">
        <span><small style="display:block;color:#aaa;">ккал</small><b>${athleteNutritionFormat(day.calories)}</b></span>
        <span><small style="display:block;color:#aaa;">Белки</small><b>${athleteNutritionFormat(day.protein_g, 1)} г</b></span>
        <span><small style="display:block;color:#aaa;">Жиры</small><b>${athleteNutritionFormat(day.fat_g, 1)} г</b></span>
        <span><small style="display:block;color:#aaa;">Углеводы</small><b>${athleteNutritionFormat(day.carbs_g, 1)} г</b></span>
      </div>
    </div>`;
  }).join("");

  const recommendations = Array.isArray(plan.recommendations)
    ? plan.recommendations.slice(0, 5)
    : [];
  const needsReview = plan.reviewRequired === true;
  const formattedDate = result.sourceReportThrough
    ? result.sourceReportThrough.split("-").reverse().join(".")
    : "";

  output.innerHTML = `
    <div style="margin:12px 0;padding:14px;border:1px solid #414141;border-radius:14px;background:#202020;">
      <strong>${needsReview ? "Нужна проверка специалиста" : "Твой план на неделю"}</strong>
      <p style="color:#ccc;margin:8px 0 14px;">${athleteEscape(plan.summary || "План сформирован по данным анкеты и дневника.")}</p>
      ${needsReview ? `<p style="color:#ff8959;margin:8px 0 14px;">${athleteEscape(plan.reviewReason || "По имеющимся данным нельзя безопасно рассчитать числовые цели. Обсуди их с тренером или медицинским специалистом.")}</p>` : week}
      ${recommendations.length ? `<div style="margin-top:16px;">
        <strong>Рекомендации</strong>
        <ul style="padding-left:20px;margin:8px 0 0;color:#ccc;">
          ${recommendations.map(function(item) {
            return `<li style="margin:0 0 7px;">${athleteEscape(item)}</li>`;
          }).join("")}
        </ul>
      </div>` : ""}
    </div>
  `;

  const count = Number(result.sourceReportCount) || 0;
  status.textContent = needsReview
    ? `Анализ основан на ${count} днях дневника${formattedDate ? ` · данные по ${formattedDate}` : ""}; числовой план пока не сформирован.`
    : `Основан на ${count} днях дневника${formattedDate ? ` · данные по ${formattedDate}` : ""}.`;
  button.textContent = "Обновить план питания";
}

async function athleteLoadNutritionPlan() {
  const status = document.getElementById("athleteNutritionPlanStatus");
  if (!status) return;

  try {
    const result = await athleteNutritionRequest("load_plan");
    if (document.getElementById("athleteNutritionPlanStatus") !== status) return;

    if (result.plan) athleteRenderNutritionPlan(result);
    else {
      status.textContent = "После 7 дней записей можно сформировать недельный план КБЖУ.";
    }
  } catch (error) {
    console.error("TRENZO nutrition plan load failed:", error);
    if (document.getElementById("athleteNutritionPlanStatus") === status) {
      status.textContent = "Не удалось загрузить план. Попробуй открыть раздел позже.";
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
      showMessage("Для анализа добавь данные минимум за 7 разных дней.");
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
      button.textContent = "Анализ питания";
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
    const result = athleteNutritionCache === null
  ? await athleteNutritionRequest("load")
  : { entries: athleteNutritionCache };

if (
  athleteNutritionCache === null &&
  Array.isArray(result.entries)
) {
  athleteNutritionCache = result.entries.slice();
}

    if (document.getElementById("athleteNutritionHistory") !== slot) {
      return;
    }

    const entries = Array.isArray(result.entries)
      ? result.entries.slice().reverse()
      : [];
athleteUpdateNutritionIntroduction(entries);
const daysCount = document.getElementById("athleteNutritionDaysCount");

if (daysCount) {
  const count = Math.min(athleteNutritionDayCount(entries), 7);
  daysCount.textContent = `${count} из 7`;
}
    const daysProgress = document.getElementById("athleteNutritionDaysProgress");

if (daysProgress) {
  const count = Math.min(athleteNutritionDayCount(entries), 7);

  Array.from(daysProgress.children).forEach(function(segment, index) {
    segment.style.background =
      index < count ? "#ff7846" : "#414141";
  });
}
    const statsSlot = document.getElementById("athleteNutritionCurrentStats");

if (statsSlot && entries.length) {
  const totals = entries.reduce(function(sum, entry) {
    sum.calories += Number(entry.calories) || 0;
    sum.protein += Number(entry.protein_g) || 0;
    sum.fat += Number(entry.fat_g) || 0;
    sum.carbs += Number(entry.carbs_g) || 0;

    return sum;
  }, {
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0
  });

  const count = entries.length;

  const calories = totals.calories / count;
  const protein = totals.protein / count;
  const fat = totals.fat / count;
  const carbs = totals.carbs / count;

  statsSlot.innerHTML = `
    <div style="
      display:grid;
      grid-template-columns:1.35fr repeat(3,minmax(0,1fr));
      gap:8px;
    ">
      <div>
        <div style="color:#aaa;font-size:12px;margin-bottom:6px;">Калории</div>
        <div style="white-space:nowrap;">
          <strong style="font-size:22px;">${Math.round(calories)}</strong>
          <span style="color:#aaa;font-size:11px;"> ккал</span>
        </div>
      </div>

      <div>
        <div style="color:#aaa;font-size:12px;margin-bottom:6px;">Белки</div>
        <div style="white-space:nowrap;">
          <strong>${protein.toFixed(1).replace(".", ",")}</strong>
          <span style="color:#aaa;font-size:11px;"> г</span>
        </div>
      </div>

      <div>
        <div style="color:#aaa;font-size:12px;margin-bottom:6px;">Жиры</div>
        <div style="white-space:nowrap;">
          <strong>${fat.toFixed(1).replace(".", ",")}</strong>
          <span style="color:#aaa;font-size:11px;"> г</span>
        </div>
      </div>

      <div>
        <div style="color:#aaa;font-size:12px;margin-bottom:6px;">Углеводы</div>
        <div style="white-space:nowrap;">
          <strong>${carbs.toFixed(1).replace(".", ",")}</strong>
          <span style="color:#aaa;font-size:11px;"> г</span>
        </div>
      </div>
    </div>
  `;
}
    if (!entries.length) {
      slot.innerHTML = `
        <p style="color:#aaa;margin-bottom:0;">
          Пока нет сохранённых отчётов.
        </p>
      `;
      return;
    }

    function formatValue(value) {
      return Number(value).toLocaleString("ru-RU", {
        maximumFractionDigits: 1
      });
    }

    slot.innerHTML = `
      <div style="overflow-x:auto;">
        <table style="
          width:100%;
          border-collapse:collapse;
          text-align:center;
          font-size:12px;
          white-space:nowrap;
        ">
          <thead>
            <tr style="color:#aaa;">
              <th style="padding:10px 3px;">Дата</th>
              <th style="padding:10px 3px;">ккал</th>
              <th style="padding:10px 3px;">Б, г</th>
              <th style="padding:10px 3px;">Ж, г</th>
              <th style="padding:10px 3px;">У, г</th>
            </tr>
          </thead>

          <tbody>
            ${entries.map(function(entry) {
              const dateParts = entry.report_date.split("-");
              const date = dateParts[2] + "." + dateParts[1];

              return `
                <tr style="border-top:1px solid #414141;">
                  <td style="padding:12px 3px;">${date}</td>
                  <td style="padding:12px 3px;">${formatValue(entry.calories)}</td>
                  <td style="padding:12px 3px;">${formatValue(entry.protein_g)}</td>
                  <td style="padding:12px 3px;">${formatValue(entry.fat_g)}</td>
                  <td style="padding:12px 3px;">${formatValue(entry.carbs_g)}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;

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
