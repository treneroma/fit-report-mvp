/*
  TRENZO — регистрация пользователя «Мой прогресс»

  Несекретные тестовые ответы сохраняются в Supabase.
  Ограничения по здоровью, особенности питания, свободный
  текст программы, фотографии и имена файлов НЕ отправляем.
*/

let athleteStep = 0;
let athleteSaving = false;
let athleteRestoreNotice = "";

// Должен совпадать со списком allowedFields в Edge Function.
const athleteServerFields = [
  "name", "age", "sex", "height", "weight", "goal", "targetWeight",
  "result", "months", "experience", "recentTraining", "frequency",
  "duration", "nutritionTracking", "nutritionWilling", "meals",
  "trainingMode", "programStatus"
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


function athleteArea(name, label, placeholder, required = false) {
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
          "Например: аллергии, продукты, которые не употребляешь, особенности режима. Если ничего нет, можно оставить поле пустым."
        )}
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
      особенности питания, свободный текст программы,
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
  return `<div class="topbar">
      <button class="back-button" type="button"
        onclick="athleteRenderCabinet()" aria-label="Вернуться в личный кабинет">←</button>
      <div class="logo">TREN<span>ZO</span></div>
    </div>
    <div class="step-label">${athleteEscape(label)}</div>
    <h1>${athleteEscape(title)}</h1>`;
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
        athleteCabinetRow("Программа тренировок", d.programStatus, {
          yes: "Есть программа", partial: "Есть отдельные упражнения", no: "Программы пока нет"
        })) +
      `<div id="athleteCabinetClarifications" class="info-card"
         role="status">Загружаем уточнения TRENZO...</div>` +
      `<p class="small-note">Здесь показаны сохранённые данные анкеты.
        Изменение ответов добавим отдельно. Сведения о здоровье,
        фотографии и файлы в тестовой версии не сохраняются.</p>`;
  } else if (section === "nutrition") {
    title = "Питание";
    content = athleteCabinetCard("Твои ответы из анкеты",
      athleteCabinetRow("Сейчас следишь за питанием", d.nutritionTracking, {
        regular: "Да, регулярно", sometimes: "Иногда", no: "Нет"
      }) +
      athleteCabinetRow("Готовность вести учёт", d.nutritionWilling, {
        yes: "Да", maybe: "Скорее да", no: "Пока нет"
      }) +
      athleteCabinetRow("Приёмов пищи в день", d.meals, {
        "1to2": "1–2", "3": "3", "4": "4", "5plus": "5 и более",
        varies: "Каждый день по-разному"
      })) +
      athleteCabinetCard("Рацион и отчёты",
        `<p>Пока не созданы. Здесь появятся твой рацион,
        дневник питания и история отчётов.</p>`);
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
    content = athleteCabinetCard("Исходные показатели",
      athleteCabinetRow("Вес при регистрации", d.weight ? d.weight + " кг" : "") +
      athleteCabinetRow("Желаемый вес", d.targetWeight ? d.targetWeight + " кг" : "") +
      athleteCabinetRow("Цель", d.result)) +
      `<div id="athleteWeightHistory" class="info-card" role="status">
        Загружаем историю веса...
      </div>` +
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
  } else {
    return;
  }

  screen.innerHTML = `<div class="page">
    ${athleteCabinetHeader("ЛИЧНЫЙ КАБИНЕТ", title)}
    ${content}
    <button class="secondary-btn" type="button"
      onclick="athleteRenderCabinet()">← В личный кабинет</button>
  </div>`;
  window.scrollTo(0, 0);

  if (section === "profile") {
    athleteLoadCabinetClarifications();
    athleteLoadProfileWeight();
  }
  if (section === "progress") {
    athleteLoadWeightHistory();
  }
}

// Уточняющие вопросы и ответы читаем из уже существующей защищённой
// функции finish-onboarding. Не записываем их в браузере и не зовём OpenAI.
async function athleteLoadCabinetClarifications() {
  const slot = document.getElementById("athleteCabinetClarifications");
  if (!slot) return;
  try {
    const data = await athleteOnboardingRequest("load");
    if (document.getElementById("athleteCabinetClarifications") !== slot) return;
    if (!Array.isArray(data.questions) || data.questions.length === 0) {
      slot.textContent = "Уточняющих вопросов не было.";
      return;
    }
    slot.innerHTML = `<strong>Дополнительные ответы</strong>` +
      data.questions.map(function(item) {
        return athleteCabinetRow(item.question, item.answer);
      }).join("");
  } catch (error) {
    if (document.getElementById("athleteCabinetClarifications") !== slot) return;
    slot.textContent = error.message || "Не удалось загрузить уточнения.";
  }
}

// История веса: отдельная защищённая Edge Function с проверкой Telegram.
// Вес из анкеты не перезаписываем. Все измерения читаем с сервера.
const ATHLETE_WEIGHT_URL =
  "https://hdxfmvewlpmknyysrpac.supabase.co/functions/v1/weight-history";
let athleteWeightEntries = [];
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

async function athleteLoadWeightSummary() {
  const slot = document.getElementById("athleteCabinetLatestWeight");
  if (!slot) return;
  try {
    const result = await athleteWeightRequest("load");
    if (document.getElementById("athleteCabinetLatestWeight") !== slot) return;
    const rows = athleteWeightPoints(result.entries);
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
    const result = await athleteWeightRequest("load");
    if (document.getElementById("athleteProfileWeight") !== slot) return;
    const rows = athleteWeightPoints(result.entries);
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
    const result = await athleteWeightRequest("load");
    if (document.getElementById("athleteWeightHistory") !== slot) return;
    athleteWeightEntries = athleteWeightPoints(result.entries);
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
    await athleteWeightRequest("save", { measuredOn, weightKg });
    await athleteLoadWeightHistory();
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
