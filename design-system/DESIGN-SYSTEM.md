# TRENZO — инвентаризация утверждённой дизайн-системы

Дата: **23 октября 2026 года**. Этап: **инвентаризация существующей реализации**, без проектирования новых правил.

## 0. Статус, область применения и источники

**Источник визуальной истины — текущий главный экран пользователя в коде проекта.** Его версия принята пользователем; подтверждение — `UI-BASELINE.md`, скриншот `../approved-baselines/home-2026-10-23/approved-home.jpg` относительно корня проекта. Все 64 файла из сохранённого `sha256-manifest.json` совпали с текущими файлами при этой инвентаризации. Git HEAD на момент чтения: `5ed3b88`.

Это документ существующей системы, а не внедрённая библиотека токенов. Названия ролей в таблицах описательные: новые CSS-переменные, компоненты и варианты не созданы. Значения не округлены в исходных формулах. Примеры измеренных размеров отдельно помечены и не заменяют формулы.

Область эталона: мужской вариант главного экрана, создаваемый `athleteRenderCabinet()`, включая шапку, KPI-круг, метрики, следующую тренировку, четыре карточки разделов и нижнюю навигацию. Правила других экранов упоминаются только как существующие общие примитивы; их внешний вид не считается автоматически утверждённым этим эталоном.

### Обозначения источников

| Сокращение | Файл / ресурс | Что определяет |
|---|---|---|
| **C** | `styles/main.css` | Основные переменные, общие примитивы, стили athlete, адаптивность, эффекты |
| **J** | `screens/athlete.js` | DOM, inline-стили, состояния, динамические SVG и геометрия |
| **A** | `app.js` | Запуск Telegram, переключение экранов, демо-данные |
| **H** | `index.html` | Viewport, порядок CSS/JS, подключение Telegram SDK |
| **PNG** | Указанный файл в `assets/` | Собственные пиксельные цвета, прозрачность, форма и поля изображения |

Запись `C:812, .athlete-dashboard-next` означает **файл `styles/main.css`, строка 812, селектор `.athlete-dashboard-next`**. Номера строк — навигационная подсказка для текущего состояния; при последующих правках искать также по селектору/имени функции.

### Как читать каскад

- H:16–19 подключает `main.css`, затем `trainer.css`, `reports.css`, `analytics.css`. При чтении последних трёх файлов не обнаружены переопределения компонентов утверждённой главной страницы; основные trainer-правила ограничены `#trainerScreen`.
- Базовый `.info-card` не равен финальной карточке главной страницы. Важны `#athleteScreen .info-card` (C:3748), scoped-стили `.athlete-cabinet-links` (C:1236) и блок `METRICS_POLISH_V124` (C:4025).
- Inline `display:block` у `.athlete-cabinet-page` в J:1887 меняет базовый flex-layout `.page`. Inline `gap:10px` списка в J:1948 перекрывается CSS с `!important` до **6px**, а на коротком экране — **4px**.
- Комментарии `TRIAL`, `TEMP`, `V124` не означают, что код не используется: эти блоки сейчас участвуют в утверждённом результате. Не удалять их при воспроизведении экрана на основании названия комментария.

## 1. Цветовая палитра

### 1.1. Реально используемые цвета главного экрана

| Роль | Значение | Где определено и применяется |
|---|---|---|
| Фон мужского главного экрана | `#000000` | C:893, `#athleteScreen.has-athlete-male-dashboard.active`; также фон его `::before` |
| Непрозрачная поверхность четырёх карточек | `#060809` | C:1241, `#athleteScreen .athlete-cabinet-links .cabinet-nav-button` |
| Поверхность нижней навигации | `#060809` | C:3434, `.athlete-bottom-nav`, первый `linear-gradient` в `padding-box` |
| Основа карточки тренировки | `#0D1011` | C:812, `.athlete-dashboard-next`; поверх основы — градиенты и фото, поэтому итоговый пиксель контекстный |
| Основные числа KPI и метрик | `#FBFBFB` | C:1192 и C:4087, `.athlete-dashboard-adherence-copy > strong`, scoped `.athlete-dashboard-stat-copy > strong` |
| Название тренировки, заголовки карточек | `#FFFFFF` | C:851, `.athlete-dashboard-next-copy > strong`; C:472, `.info-card strong`, переменная `--text` |
| Подписи метрик и «кг» | `#ABB2BD` | C:4116, scoped `.athlete-dashboard-stat-copy > span`; C:4123, `.athlete-dashboard-weight-unit` |
| Подзаголовки четырёх карточек, eyebrow тренировки | `#AAAAAA` | `--muted` в C:2; `.cabinet-nav-detail` C:610, `.athlete-dashboard-eyebrow` C:844 |
| Подпись KPI | `rgba(251, 251, 251, .9)` | C:1214, `.athlete-dashboard-adherence-copy > span` |
| Неактивные nav-иконки/подписи; стрелки карточек разделов | `#9399A3` | C:3517, `.athlete-bottom-nav-item`; C:1313, стрелки внутри `.athlete-cabinet-links` |
| Активная навигация, её индикатор, график веса, строка метаданных тренировки | `#FC6C17` | C:3541, C:3492, C:857; J:2063–2069 для графика |
| Стрелка следующей тренировки | `#FF7846` через `var(--accent)` | C:2243, `.nutrition-plan-link-arrow`; внутри карточки тренировки нет переопределения на `#FC6C17` |
| Центр / промежуточный цвет / края дуги KPI | `#F95D0F` / `#FC6C17` / `#FFA347` | J:1905–1908, SVG `#athleteAdherenceGradient`: stops `0% / 65% / 100%`; геометрия градиента динамическая |
| Неактивная дорожка круга | `#191C1E` | C:1161, `.gauge-track` внутри KPI SVG |
| Контур следующей тренировки | `#373737` | C:822, `.athlete-dashboard-next` |
| Контуры метрик и четырёх карточек | `rgba(171, 178, 189, .16)` | C:4028, inset-shadow метрик; C:1246, inset-shadow карточек; различается толщина |
| Разделитель метрик | `rgba(130, 140, 150, .3)` | C:4033, `.athlete-dashboard-summary::after` |
| Серебро двух PNG в метриках | `RGB(179, 191, 206)` = `#B3BFCE` | `assets/metric-kettlebell-matched-v156.png`, `assets/metric-scale-matched-v156.png`: проверка пикселей с alpha ≥250; CSS `filter:none` в C:4104–4113 |

Дополнительные определения, не самостоятельные цвета видимого рисунка: `.info-card` задаёт контейнерный `color:#d2d2d2` (C:461), но основные числа/подписи главной его перекрывают; кнопка профиля имеет `color:#e6e6e6` (C:668), который не перекрашивает `<img>`. Скрытый `.athlete-dashboard-progress-title` хранит `#c6c9ce` и `text-shadow:0 1px 8px rgba(0,0,0,.5)` (C:944), но не рисует видимый текст. Это не дополнительные утверждённые роли для новых экранов.

**Важное различие:** `#9399A3` контейнера `.cabinet-nav-icon` не перекрашивает четыре текущие PNG-картинки карточек. В scoped-правилах отключён `mask`, используется `background-image` с собственными цветами. Эти PNG имеют несколько оттенков серебристого; у тренировочной иконки дополнительно `brightness(1.05)` (C:1294). Утверждённые файлы — эталон; единый плоский цвет для всех этих PNG из CSS не следует.

### 1.2. Существующие глобальные переменные — не вся палитра эталона

Источник всех значений таблицы: **C:2, `:root`**.

| Переменная | Значение | Статус на утверждённой главной |
|---|---|---|
| `--bg` | `#171717` | Базовый `html/body`; мужской главный экран перекрывает фон на `#000000` |
| `--surface` | `#262626` | База общих компонентов; четыре карточки и метрики имеют свои поверхности |
| `--border` | `#414141` | База `.info-card`/контролов; у главной контуры переопределены |
| `--text` | `#ffffff` | Основной текст |
| `--muted` | `#aaaaaa` | Вторичные подписи; метрики используют собственный `#ABB2BD` |
| `--accent` | `#ff7846` | В частности, стрелка тренировки; nav и график используют `#FC6C17` напрямую |
| `--progress-fill` | `#32d6a0` | Существует в проекте, не является цветом утверждённого KPI-круга |

Остальные используемые RGBA, включая цвета эффектов и интерактивных состояний, приведены в разделах 5 и 7 с точными определениями. Цвета фотографии и логотипа заданы внутри файлов; их полный набор не является CSS-палитрой.

## 2. Типографика

### 2.1. Семейства и наследование

- Основной интерфейс: **`Arial, sans-serif`**, `--font-ui` в C:10; применяется к `html, body` (C:34). Кнопки и поля получают `font:inherit` (C:48).
- Числа KPI и метрик: **`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`**, C:1050 и C:1192. Конкретный физический шрифт зависит от ОС/WebView; это не гарантированно Arial или один и тот же шрифт на iOS и Android.
- В изученных CSS нет `@font-face`/импорта веб-шрифтов. Базовый размер `body` явно не задан; в прочитанном Chrome он равен браузерному начальному **16px**, это **не** токен `--text-body`.
- Логотип — графический ресурс, не текст, набранный интерфейсным шрифтом: `.logo` имеет `font-size:0 !important`, C:129 и C:3709.
- Общий `strong, b` — `700` (C:56); отдельный KPI имеет собственный `600`.

### 2.2. Роли утверждённого экрана

| Роль | Размер / вес | Line-height, tracking и особенности | Источник |
|---|---|---|---|
| Главное число KPI | `clamp(38px, 10vw, 44px)` / `600` | `.98`; `letter-spacing:-.025em`; `tabular-nums`; baseline-flex, gap `3px` | C:1192, `.athlete-dashboard-adherence-copy > strong` |
| Знак `%` | `.48em` / `700` | tracking `0`; `translateY(-.08em)` | C:1206, `.athlete-dashboard-adherence-percent` |
| «Соблюдение / плана» | `clamp(12px, 3vw, 15px)` / `600` | `1.08`; две строки в grid, gap `0` | C:1221, `.athlete-dashboard-adherence-label`; J:1916 |
| `2/3` и число веса | `clamp(17.334px, 4.8195vw, 22.599px)` / `700` | line-height `1`; tracking `-.025em`; `tabular-nums`; `white-space:nowrap`; блок сохраняет высоту `clamp(21.4px, 5.95vw, 27.9px)`, число смещено `translateY(4px)` | C:1050 + C:4087, scoped `.athlete-dashboard-stat-copy > strong` |
| `кг` | `.62em` / `500` | tracking `0`; интервал от числа — flex-gap `4px`; цвет `#ABB2BD` | C:1050, C:1076, C:4123 |
| Запятая в числе веса | `.8em` | Отдельный span, не другое форматирование исходного числа | C:4128; J:2152, `athleteDashboardWeightNumberMarkup()`; J:5551, `athleteFormatWeightNumber()` |
| Подписи метрик | `calc(clamp(10px, 3vw, 13px) - 1px)` / `400` | line-height `calc(clamp(10px, 3vw, 13px) * 1.12)` — считается от исходного clamp, а не от уменьшенного размера; перенос разрешён | C:1068 + C:4116 |
| «СЛЕДУЮЩАЯ ТРЕНИРОВКА» | `11px` / `400` | tracking `.11em`; line-height наследует `1.45` от `#athleteScreen .info-card`, т.е. `15.95px`; uppercase уже в строке | C:844 + C:3748; J:2169/2200 |
| Название следующей тренировки | `18px` / `700` | `1.2`; без специального tracking; перенос явно не запрещён | C:851; C:56 |
| «5 упражнений · Силовая тренировка» | `13px` / `400` | `1.2`; inline-flex, gap `6px`; `nowrap` для варианта `--training`; точка — CSS-круг `3px`, выровнен по центру | C:857–876; J:2169/2200 |
| Заголовки четырёх карточек | `15px` / `700` | `1.18`; на коротком экране `14px / 1.18` | C:1317; C:3687; C:56 |
| Подзаголовки четырёх карточек | `12px` / `400` | `1.22`; margin-top `2px`; на коротком экране `11.5px / 1.2` | C:1322; C:3692 |
| Подпись nav, неактивная | `12.5px` / `400` | `1.15`, одна строка, ellipsis при переполнении; при ширине ≤360px размер `11.5px` | C:3582; C:3631 |
| Подпись nav, активная | Тот же размер / `500` | Наследует цвет активной кнопки | C:3593 |
| Стрелки `›` | `28px` / наследуемый `400` | line-height `1`; это текстовый глиф, а не SVG | C:2243; J:1585/1946 |

У текстов нет общей опубликованной модульной шкалы размеров/межстрочных интервалов. Существуют контекстные значения; применение рекомендуемой скиллом шкалы 12/14/16/… вместо них было бы изменением дизайна.

### 2.3. Глобальная шкала проекта

Источник: **C:13–23, `:root`**. Это уже объявленные переменные, но не все они используются на главной без переопределений.

| Переменная | Исходное значение |
|---|---|
| `--text-logo` | `28px` (фактический графический логотип имеет `font-size:0`) |
| `--text-page-title` | `clamp(27px, 7vw, 32px)` |
| `--text-caption` | `12px` |
| `--text-support` | `13px` |
| `--text-body` | `14px` |
| `--text-body-emphasis` | `15px` |
| `--text-button` | `16px` |
| `--text-card-title` | `18px` |
| `--text-subsection-title` | `16px` |
| `--text-section-title` | `20px` |
| `--text-metric` | `20px` |

## 3. Композиция, размеры и отступы

### 3.1. Оболочка и шапка

| Элемент | Итоговое определение | Источник |
|---|---|---|
| Корневая оболочка | `box-sizing:border-box` для всех элементов; `#athleteScreen.has-athlete-bottom-nav.active`: flex-column, `height:100dvh`, `min-height:0`, gap `6px`, `overflow:hidden` | C:30; C:3414 |
| Контентная `.page` | `width:100%`, `max-width:480px`, центр `margin:0 auto`; для главной `display:block` inline; в оболочке `flex:1 1 auto`, `min-height:0` | C:111; C:3424; J:1887 |
| Padding главной | Обычно `10px 14px 6px`: верх/бока из `.athlete-cabinet-page`, низ из оболочки с `!important`; на коротком экране верх `8px` | C:1333; C:3424; C:3636 |
| Скролл | Прокручивается `.page`, не nav: `overflow-y:auto`, `overflow-x:hidden`, `overscroll-behavior-y:contain`, `-webkit-overflow-scrolling:touch` | C:3424 |
| Шапка | Flex, `space-between`, center; gap `12px` от `#athleteScreen .topbar`; `translateY(-10px)`; margin-bottom `8px`, на коротком экране `6px` | C:121; C:639; C:1337; C:3700; C:3641 |
| Логотип шапки | `width:min(132px,36vw)`, flex-basis `132px`, height `20px`; background растянут `100% 100%`, left center | C:129 + C:645; C:3709 задаёт текущий SVG |
| Контейнер действий | Flex, gap `7.5px`, `margin-left:auto` | C:654, `.athlete-dashboard-header-actions` |
| Колокольчик | `<img> 24×27px`, `object-fit:contain`, `translateX(8px)`; декоративное изображение без собственного обработчика | C:651; J:1891 |
| Кнопка профиля | `46×46px`, grid-center, padding `0`, border `0`, radius `50%`, прозрачный фон, shadow `none` | C:668, `.athlete-dashboard-profile-shortcut` |
| Стандартная картинка профиля | `34×34px`, `object-fit:contain`, radius `0`, `translateY(-1px)` | C:692, `.athlete-dashboard-profile-placeholder`; J:1895 |
| Пользовательское фото профиля | `40×40px`, radius `50%`, `object-fit:cover`; источник динамический `athleteProfilePhotoDataUrl` | C:683; J:1893–1895 |

Горизонтальные размеры карточек зависят от внутренней ширины `.page`. При обычных боковых padding `14px` ширина стандартной карточки равна `min(viewport width,480px) - 28px`. Это производная от CSS, не отдельная переменная.

### 3.2. KPI-круг

Источник: **C:937, `.athlete-dashboard-hero`; C:1123–1227, `.athlete-dashboard-adherence*`; J:1899–1918**.

- Hero-блок имеет `margin:0 0 8px`, `translateY(-20px)`; сам gauge — `translate(7px,-8px)`.
- Gauge: `width:min(41vw,168px)`, `aspect-ratio:1`, circle-radius `50%`, border `0`, shadow `none`. При ширине ≤380px ограничение — `min(41vw,158px)` (C:1383).
- SVG занимает весь gauge: `position:absolute; inset:0; width/height:100%; overflow:visible` (C:1010).
- SVG `viewBox="0 0 100 100"`; оба circle имеют `cx=50, cy=50, r=43`; stroke-width `8` — **SVG-единиц, не 8 экранных px**. Видимая толщина масштабируется вместе с gauge; например, формула толщины — `8%` от его ширины (C:1156; J:1903–1912).
- Текстовый блок занимает `100%` круга, grid-center, gap `2px`, padding `12px`, `translateY(2px)` (C:1176).
- В DOM есть невидимый `<h1 class="athlete-dashboard-progress-title">`: height `20px`, `visibility:hidden`; он продолжает занимать место. Его margin-top `2px`, margin-bottom обычно `10px` из `#athleteScreen h1`, а на коротком экране `8px !important`. Не считать этот spacer видимым заголовком «Твой прогресс» (C:944; C:3736; C:3645; J:1900).

### 3.3. Блок метрик

| Параметр | Итоговое значение / зависимость | Источник |
|---|---|---|
| Контейнер | Стандартная ширина `.page`; padding `10px 10px 2px !important`; `translateY(-28px)`; radius `18px` | C:879; C:1345 |
| Высота | Нет фиксированного `height`; зависит от grid, текста, viewport и padding | C:955, C:981, C:1345, C:4136 |
| Внутренний grid | Width `100%`, min-height `76px`; при ширине ≤380px раннее правило даёт `62px`, при ≤372px позднее правило задаёт отдельную формулу ниже | C:955; C:1373; C:4136 |
| Колонки метрик | `minmax(0,calc(50% + 20px)) minmax(0,1fr)` | C:4046 |
| Левая группа | Grid `32px minmax(0,1fr)`; rows `minmax(0,1fr) 26px`; column-gap `7px`, row-gap `2px`; padding-right `7px !important`; `translateX(6px)` | C:981, C:991; C:4051 |
| Правая группа | Grid `minmax(0,1fr) 32px 7px max-content minmax(0,1fr)`; column-gap `0`; padding-left `9px !important`; старые translateX отменены | C:976; C:4055–4066 |
| Правая иконка / подписи | Grid-column `2` / `4`; обе `position:relative; left:-13px` | C:4069–4078 |
| Иконки метрик | Реальные layout-box `32×32px`, `object-fit:contain`, transform-origin center, `translateY(2px)`, filter `none`; старые меньшие размеры media-rule не побеждают более специфичные селекторы | C:1000; C:4081; C:4095–4113 |
| Блок текста | Grid, min-width `0`, align-content center, gap `2px` | C:1033 |
| Разделитель | `::after`, width `1px`, `left:calc(50% + 20px)`, top `50%`, `translateY(-50%)`; высота `calc(clamp(21.4px,5.95vw,27.9px) + clamp(10px,3vw,13px) * 1.12 + 28px)` | C:4033 |
| Старая граница правой группы | Сохраняет border-left `1px` в layout, но `border-left-color:transparent !important`; не является второй видимой линией | C:976; C:4061 |

При ширине ≤372px итоговый minimum внутреннего grid (C:4136):

```css
min-height: calc(clamp(21.4px, 5.95vw, 27.9px) + 35px + clamp(10px, 3vw, 13px) * 2.24 - .03125px);
```

**Семь дней:** `.athlete-dashboard-week-dots` — flex, grid-row `2`, span всех колонок, gap `7px`, margin-left `3px`, `translateY(-5px)`; диаметр каждого PNG-индикатора `clamp(12.41px,4.2761vw,17.93px)`, radius `50%` (C:1083–1105). JS создаёт ровно семь элементов ПН–ВС. Ширина контейнера вычисляется по отрезку от левого края иконки до правого края последней строки подписи через DOM Range и `getBoundingClientRect()`; это не фиксированное число (J:1972–2039).

**График:** `.athlete-dashboard-weight-sparkline` — width `100%`, height `26px`, grid-row `2`, align-self end, `overflow:visible`, итоговый `translate(-6px,-5px)` (C:1108 + C:4132). SVG `viewBox="0 0 150 34"` (J:1937). Последние максимум семь точек; линия `#FC6C17`, stroke-width `2` SVG-единицы, round caps/joins, конечный circle `r=3`. Есть вертикальный след последней точки с градиентом `#FC6C17` alpha `.28→0`, width `2`. Нет осей/подписей/заливки площади. Пустой график скрывается через `hidden`; координаты рассчитываются из данных, не являются токенами (J:2042–2069).

### 3.4. Карточка «Следующая тренировка»

Источник: **C:812–876; C:1349; J:1941, J:2169/2200/2203**.

- Карточка — целиком `<button class="info-card athlete-dashboard-next">`, flex, center по поперечной оси, `justify-content:space-between`, gap `12px`, `text-align:left`.
- Ширина **`calc(100% + 12px)`** относительно контентной ширины `.page`. Центрирование: `position:relative; left:50%; transform:translateX(-50%)`. Поэтому она на **6px с каждой стороны** шире стандартных карточек. Последняя принятая правка «+4px» была прибавкой к прежним `+8px`; итог — **+12px**, не +4px относительно остальных.
- **`min-height:110.125px`**, а не фиксированный `height`. Длинный контент может увеличить её; для утверждённой строки наблюдаемая высота равна этому minimum. Ранние `min-height:100px/88px` не являются итоговыми для главной.
- Padding **`10px 12px !important`**; border `1px solid #373737 !important`; radius **14px** наследуется из `#athleteScreen .info-card` (C:3748).
- Margin-top **`-30px !important`**, на коротком экране **`-27px !important`** (C:3667); margin-bottom **10px** (C:629). Это часть утверждённой компенсации потока рядом с трансформированным блоком метрик, а не общий spacing-токен.
- `.athlete-dashboard-next-copy` — grid, min-width `0`, gap **6px**. В заполненном состоянии три строки: eyebrow, название, inline-метаданные. Текст выравнен слева; весь текстовый блок центрируется **по вертикали** карточки.
- При утверждённых трёх строках измеренный верхний/нижний отступ до text-box равен **22.5px** в Chrome. Это результат line-height и flex-центрирования, не padding `22.5px` и не гарантия для другого контента.
- Третья строка состоит из двух текстовых span и центральной точки `3×3px`, без старой плашки и маленькой иконки гири. Стрелка `›` остаётся отдельным flex-элементом справа.
- Состояния загрузки/нет плана/план завершён используют ту же оболочку, но другое количество/длину строк (J:1941, J:2203); единая фиксированная композиция этих состояний отдельно не утверждена.

### 3.5. Четыре карточки разделов

Источник DOM: **J:1575, `athleteCabinetNavButton()`; J:1948–1956**. Итоговые CSS: **C:1236–1330**, общая оболочка **C:559–624**, поздние media-правила **C:3671–3697**.

| Параметр | Обычный режим | Ширина ≤380px без короткого режима | Короткий режим: height ≤760px и width ≤600px |
|---|---|---|---|
| Список | Flex-column, align-items stretch; gap `6px` | То же | gap `4px` |
| Верхний margin списка | `10px !important` от прямого дочернего селектора C:1364 | То же | `10px !important` |
| Кнопка | Width `100%`, height auto, min-height `0`, flex-center | То же | То же |
| Padding кнопки | `6px 10px` (C:1241) | `5px 8px` (C:1387) | `4px 8px` (C:3675) |
| Gap между частями кнопки | `9px` (C:1241) | `9px` | `8px` (C:3675) |
| Контейнер иконки | `32×32px`, flex-basis `32px`, radius `10px`, transparent | То же | `30×30px`, flex-basis `30px` (C:3681) |
| Рисунок иконки | CSS-slot `23×23px`; собственные crop/scale PNG | То же | Тот же slot; контейнер становится меньше |
| Текстовый контейнер | `flex:1; min-width:0; padding-block:1px` | То же | То же |
| Заголовок / подзаголовок | `15px/700/1.18`, `12px/400/1.22`, margin между ними `2px` | То же | `14px/700/1.18`, `11.5px/400/1.2`, margin `2px` |
| Контур / поверхность | Radius `14px`; border `0`; inset-shadow `.5px rgba(171,178,189,.16)`; background `#060809` | То же | То же |

Высота карточки **автоматическая**: текст, иконка и padding определяют её совместно. Для текущей двухстрочной подписи примеры — 48.3125px / 46.3125px / 42.3125px в разных режимах; это измерения, не зафиксированные высоты компонента.

### 3.6. Фактические интервалы между блоками

Из-за отрицательных margin, transform и схлопывания соседних margin нельзя трактовать все `10px` в исходнике как одинаковый видимый gap.

| Пара блоков | Измеренный видимый зазор | Объясняющие определения |
|---|---|---|
| Метрики → следующая тренировка, обычный режим | **8px** | C:629, margin-bottom `10px`; C:879, summary translateY `-28px`; C:1349, следующий margin-top `-30px` |
| То же, короткий режим | **11px** | Вместо `-30px` действует `-27px`, C:3667 |
| Следующая тренировка → первая карточка разделов | **10px** | C:629 и C:1364, в текущем block-потоке margin не складываются в 20px |
| Между четырьмя карточками | **6px**, короткий режим **4px** | C:1236 и C:3671, flex gap |
| Скроллируемая `.page` → нижняя nav | **6px** между layout-box | C:3414, flex gap; не означает 6px от последней карточки, которая находится внутри scroll-контента |

Это зафиксированная реализация, а не предложение исправить расстояния. Единой общей сетки отступов из кода главного экрана не следует.

## 4. Скругления, контуры и формы

| Элемент | Скругление | Граница / способ рисования | Источник |
|---|---|---|---|
| KPI, его чёрная подложка | `50%` | Border `0`, box-shadow `none`; круглая форма из aspect-ratio и SVG | C:1129, C:1144 |
| Метрики | `18px !important` | Border `0 !important`; **inset** `0 0 0 1px rgba(171,178,189,.16)` | C:879; C:4026 |
| Следующая тренировка | `14px` | Настоящий border `1px solid #373737` | C:3748 + C:822 |
| Карточки разделов | `14px` | Border `0`; **inset** `0 0 0 .5px rgba(171,178,189,.16)` | C:3748 + C:1241 |
| Подложка icon-slot карточек | `10px` | Прозрачна; не рисует отдельную плитку | C:1249 |
| Нижняя nav | `28px` | Border `1px solid transparent`; нейтральный border-box gradient и отдельная masked подсветка | C:3434–3471 |
| Nav item | `15px` | Border `0`, прозрачный фон до pressed-state | C:3517 |
| Индикатор nav | `99px` | Полоска `44×3px`, фон `#FC6C17` | C:3492; слот C:3597 |
| Кнопка профиля / пользовательское фото | `50%` | Кнопка без границы; стандартный placeholder не получает круглую CSS-обрезку | C:668–706 |
| Дни недели / разделительная точка | `50%` | PNG-индикаторы дней; CSS-фон `currentColor` у точки | C:1096; C:870 |

Толщина inset-контура `.5px` — CSS-значение. Его видимая резкость зависит от DPR и антиалиасинга. «Одинаковый цвет контура» не делает метрики и четыре карточки одинаковыми по визуальному весу: у первых 1px, у вторых .5px.

## 5. Градиенты, blur, затемнение и глубина

### 5.1. Главная фотография и переход в чёрный

Источник: **C:899, `#athleteScreen.has-athlete-male-dashboard.active::before`**. Три фоновых слоя сверху вниз:

```css
linear-gradient(90deg, rgba(5, 6, 7, .12), rgba(5, 6, 7, 0) 62%),
linear-gradient(180deg, rgba(5, 6, 7, .02) 0%, rgba(5, 6, 7, .04) 66%, #000000 100%),
url("../assets/hero-man-portrait.png?v=5")
```

`::before`: absolute, top/right/left `0`, height **`min(142.2vw,740px)`**, z-index `0`, pointer-events none, repeat none; background positions `center, center, calc(50% + 5px) calc(0% - 39vw)`; sizes `100% 100%,100% 100%,108% auto`; background-color `#000000`. Сама `.page` имеет relative/z-index `1` (C:932). `vw` здесь относится к viewport, не к ограниченной 480px `.page`.

Холодный свет над логотипом содержится **в фотографии**, отдельный CSS-синий glow для этой области не найден. Поэтому у него нет независимого CSS-HEX/интенсивности. Не превращать произвольную пипеточную пробу из фото в общий токен.

Дополнительная маска включена `ATHLETE_DASHBOARD_HERO_FADE_ENABLED = true` в **J:1816**. В **J:1822–1843**:

- `origin = screen.getBoundingClientRect().top - page.scrollTop`;
- `start = max(0, summaryBounds.top - origin)`;
- `end = max(start + 1, labelBounds.top + labelBounds.height/2 - origin)`;
- значения записываются как CSS px с двумя знаками в `--athlete-hero-fade-start/end`.

Маска C:919 — вертикальный gradient: alpha `1` до start, затем `.85/.5/.15` на 25/50/75% интервала и `0` к end. Начинается у верха карточки метрик и заканчивается на середине строки «Тренировок на неделе», независимо от inset Telegram. Использует `mask-image` и `-webkit-mask-image`. Пересчитывается через ResizeObserver, window/visualViewport resize, события Telegram `safeAreaChanged`, `contentSafeAreaChanged`, `viewportChanged`, `fullscreenChanged` (J:1852–1877). Фиксированного общего Y или высоты fade в px нет.

### 5.2. KPI: чёрная подложка и оранжевая шкала

- Подложка `::before`: **`rgba(0,0,0,.71)`**, `inset:calc(3% - 2px)`, **`filter:blur(1.7px)`** (C:1144). Это непрозрачность чёрного слоя 71%, а не «blur 71%». `backdrop-filter` для самого круга не задан.
- Внешняя граница SVG-дорожки находится на radius `47%` (`43 + 8/2` SVG-единиц), а подложка выступает ещё на **2 CSS px до фильтра**. У размытия нет жёсткой конечной границы; нельзя трактовать результат как точную внешнюю ширину «3.7px».
- Оранжевая дуга не имеет собственного `box-shadow`/glow. Наружная мягкость создаётся подложкой; дорожка `#191C1E` не оранжевая тень (C:1129, C:1144, C:1161).
- SVG radial-gradient имеет stops `#F95D0F` → `#FC6C17` → `#FFA347` (J:1905). Его центр переносится в середину фактической дуги: в `athleteDashboardSetAdherenceProgress()` (J:2072) `halfAngle = π × progress/100`, центр `circleCenter + radius × (cos(halfAngle),sin(halfAngle))`, radius градиента `2 × circleRadius × sin(halfAngle/2)`. Следовательно, яркая середина не фиксирована на координате 74%.
- Дуга повёрнута `-90deg`, round cap, dasharray — `2πr`, dashoffset — `circumference × (1-progress/100)`; при 0 скрыта. CSS transition `stroke-dashoffset 400ms ease-out`, reduced-motion отключает её (C:1165, C:1230; J:2072–2098).

### 5.3. Метрики

Итоговый фон **`rgba(0,0,0,.67)`**, `backdrop-filter:blur(2px)` плюс prefixed-вариант; тонкий inset-контур вместо внешней тени — **C:4026**. Раннее `rgba(0,0,0,.8)` / `blur(1px)` из C:879 переопределено. Это другой слой и другая alpha, чем подложка KPI **71%**.

### 5.4. Следующая тренировка — текущий принятый холодный свет

Источник всех значений: **C:812, `.athlete-dashboard-next`**. Три слоя, от верхнего к нижнему:

```css
radial-gradient(ellipse 80% 160% at 0% 0%,
  rgba(22, 35, 53, .42) 0%,
  rgba(22, 35, 53, .196) 45%,
  rgba(22, 35, 53, 0) 82%),
linear-gradient(90deg,
  rgba(13.24, 16.64, 18.2, .96) 0%,
  rgba(13.12, 16.32, 17.6, .90) 38%,
  rgba(13, 16, 17, .66) 60%,
  rgba(13, 16, 17, .16) 78%,
  rgba(13, 16, 17, .02) 100%),
url("../assets/next-workout-kettlebell.png")
```

- Radial RGB `(22,35,53)` = **`#162335`**; максимальная alpha `.42`, затем `.196`, затем `0`. Это финальная принятая версия после уменьшения интенсивности свечения на30%, не предыдущие `.60/.28`.
- Fractional RGB в линейном слое сохранены буквально; не заменять их округлённым HEX без отдельного решения.
- `background-position: center, center, calc(100% + 8px) calc(100% + 16px)`.
- `background-size:100% 100%,100% 100%,auto 134%`; `background-repeat:no-repeat`; фон-основа `#0D1011`.
- Отдельных CSS blur, backdrop-filter или внешнего glow у этой карточки нет. Мягкость получается за счёт градиентов и исходной фотографии; оттенок максимален сверху слева и растворяется вправо/вниз.

### 5.5. Навигация: материалы, состояния и движение

Источники: **C:3434–3619; J:1735–1813**.

| Слой / состояние | Реализация |
|---|---|
| Нейтральная оболочка | `linear-gradient(#060809,#060809) padding-box`, `linear-gradient(115deg,rgba(150,160,170,.12),rgba(150,160,170,.05)) border-box`; border `1px transparent`, shadow `none` |
| Цветное поле | `.athlete-bottom-nav-wash-light`: `linear-gradient(90deg,transparent 0%,rgba(252,108,23,.1) 50%,transparent 100%)` |
| Подсвеченный участок контура | `.athlete-bottom-nav-ring-light`: такой же симметричный gradient, но alpha `.7` в центре |
| Обрезка поля | Абсолютная `.athlete-bottom-nav-wash`: inset `0`, overflow hidden, radius inherit |
| Обрезка контура | `.athlete-bottom-nav-ring`: inset `-1px`, padding `1px`, две белые mask; WebKit `xor`, стандартный `mask-composite:exclude` |
| Изначально / нет active tab | Подсветки и общий индикатор opacity `0`; `data-has-active-tab="true"` включает `1` |
| Перемещение | `transform var(--duration-navigation) var(--ease-in-out)`; токены C:11–12: **220ms**, **`cubic-bezier(.77,0,.175,1)`**; opacity `140ms ease` |
| Цвет/pressed кнопки | Transition color/background-color `140ms ease`; `:active` фон `rgba(255,255,255,.04)` |
| Клавиатурный focus | `outline:2px solid #FC6C17; outline-offset:-2px` |
| Reduced motion | У кнопки transition none; у движущихся слоёв только `opacity 140ms ease`, без transform transition |

Начальная CSS-ширина света `100px` **переопределяется JS**. Центр берётся по `getBoundingClientRect()` активной **иконки**, не по длине подписи. Для всех вкладок в данном viewport используется одинаковая `glowWidth = max(100,2 × edgeReach + 16)`, где `edgeReach` — больший отступ центра крайней иконки до края nav. Это обеспечивает симметричность и достижение крайнего скругления. Позиция общего индикатора берётся из slot выбранной кнопки (J:1758–1774).

DOM самой nav сохраняется при замене содержимого страницы, чтобы анимация могла перенаправляться при быстрых нажатиях (`athleteRenderWithBottomNavigation`, J:1782). Первый показ, resize и клавиатурное переключение (`event.detail===0`, J:1613) позиционируются сразу; дальнейшие переключения анимируются. Анимация управляется JS и data-атрибутами, не одним классом `.is-active`.

## 6. Иконки и графические ресурсы

Пути ниже даны **от корня `fit-report-mvp`**. Размеры файлов прочитаны из PNG/SVG. Размер файла и размер CSS-box — разные параметры.

### 6.1. Активные ресурсы главного экрана

| Ресурс | Файл, исходный размер | Использование / источник подключения |
|---|---|---|
| Логотип | `assets/trenzo-logo-client.svg`, `viewBox 0 0 2935 437` | C:3709, `#athleteScreen .logo`. SVG содержит **встроенное PNG 791×315** через pattern/image, это не чистые векторные контуры логотипа |
| Главная фотография | `assets/hero-man-portrait.png`, **1024×1536 RGB** | C:899, background `::before`, URL имеет `?v=5`; активна только при `registration.athlete.sex === "male"`, J:1884 |
| Гиря и бутылка | `assets/next-workout-kettlebell.png`, **1672×941 RGB** | C:827, третий слой фона карточки |
| Колокольчик | `assets/notification-bell-trim.png`, **696×769 RGBA** | J:1891; CSS 24×27px |
| Placeholder профиля | `assets/profile-icon.png`, **942×942 RGBA** | J:1895; CSS 34×34px; меняется на пользовательский data URL при наличии фото |
| Гиря метрик | `assets/metric-kettlebell-matched-v156.png`, **512×512 RGBA** | J:1924; CSS-box 32×32px, центрированный рисунок, C:4104 |
| Весы метрик | `assets/metric-scale-matched-v156.png`, **512×512 RGBA** | J:1932; CSS-box 32×32px, C:4110 |
| Профиль в карточке | `assets/cabinet-profile-uniform-stroke.png`, **1254×1254 RGBA** | C:1272, scoped `.athlete-cabinet-icon--profile` |
| Питание в карточке | `assets/cabinet-nutrition-uniform-stroke.png`, **1254×1254 RGBA** | C:1283, scoped `.athlete-cabinet-icon--nutrition` |
| План в карточке | `assets/cabinet-training-uniform-stroke.png`, **1254×1254 RGBA** | C:1294, scoped `.athlete-cabinet-icon--training`, brightness 1.05 |
| Прогресс в карточке | `assets/cabinet-progress-uniform-stroke.png`, **1254×1254 RGBA** | C:1306, scoped `.athlete-cabinet-icon--progress` |
| День отдыха / завершённой тренировки | `assets/workout-dot-rest.png`, **334×334 RGBA** / `assets/workout-dot-complete.png`, **376×378 RGBA** | C:1096/1104; PNG меняется классом `.is-complete` |
| Домик nav | `assets/nav-home.png`, **225×211 RGBA** | C:3566; mask + currentColor |
| Питание nav | `assets/nav-nutrition.png`, **195×233 RGBA** | C:3570; mask + currentColor |
| Тренировки nav | `assets/nav-kettlebell.png`, **191×236 RGBA** | C:3574; mask + currentColor; используется **гиря** |
| Прогресс nav | `assets/nav-progress.png`, **227×225 RGBA** | C:3578; mask + currentColor |

Для двух метрик сплошной цвет пикселей совпадает: `#B3BFCE`. У четырёх карточек цвет неоднородный и закодирован в PNG; цвет границы/иконки нельзя полностью воспроизвести через `color:#9399A3`.

**Stroke PNG:** CSS не задаёт `stroke-width` ни для метрик, ни для четырёх card-иконок. Контур и антиалиасинг находятся в alpha PNG и дополнительно масштабируются. Поэтому общего числового CSS-токена толщины этих шести иконок **нет**; утверждённые файлы и их правила показа — источник истины. Для будущих новых рисунков нужна отдельная спецификация, см. раздел 11. SVG-width круга/графика не переносится на эти PNG.

### 6.2. Точное отображение PNG четырёх карточек

Общий slot `23×23px`, background-repeat no-repeat, `mask:none; -webkit-mask:none`. Источник: **C:1259–1310**.

| Селектор внутри `.athlete-cabinet-links` | Background-position | Background-size | Filter |
|---|---|---|---|
| `.athlete-cabinet-icon--profile` | `-7.8332px -9.2062px` | `38.7282px 38.6104px` | Не задан специальный |
| `.athlete-cabinet-icon--nutrition` | `-8.8587px -9.6338px` | `39.8903px 40.0028px` | Не задан специальный |
| `.athlete-cabinet-icon--training` | `-4.6245px -4.5330px` | `32.2490px 32.2979px` | `brightness(1.05)` |
| `.athlete-cabinet-icon--progress` | `-11.0733px -11.8366px` | `44.9316px 44.8492px` | Не задан специальный |

Эти значения компенсируют поля конкретных PNG. Это не универсальные icon-size/offset-токены для новых ресурсов.

### 6.3. SVG, генерируемые кодом

- KPI-circle и его radial-gradient: J:1903–1912; оформление C:1010, C:1156–1173; прогресс и центр градиента J:2072.
- Sparkline веса: контейнер J:1937 и SVG-разметка J:2063–2069; стили C:1108, C:4132.
- Стрелки разделов/тренировки — **глиф `›`**, центральная точка — **CSS-круг**, а не файлы и не SVG.

### 6.4. Ресурсы, которые не следует путать с текущими

В `assets/` остаются предыдущие варианты: `hero-man.png`, `next-workout-dumbbells.png`, `profile-metal-avatar.png`, `notification-bell.png`, `nav-training.png`, `metric-*-uniform-stroke.png`, `cabinet-*-silver-outline.png`, различные `dashboard-*.png`. Их наличие в папке не делает их эталоном текущей главной.

Глобальные `.athlete-cabinet-icon--*` по-прежнему объявляют `--athlete-cabinet-icon` на `nav-profile.png`, `nav-nutrition.png`, `nav-kettlebell.png`, `nav-progress.png` (C:1268/1279/1290/1302). **В четырёх карточках главной** более специфичные PNG background-правила выключают эти masks. Не копировать только глобальную часть, ожидая тот же результат.

## 7. Система карточек, навигации и переиспользуемых компонентов

### 7.1. Семейства утверждённой главной

1. **KPI** — отдельный SVG + чёрная круглая подложка; не `.info-card`. Крупное число и двухстрочная подпись, без прямоугольной карточки (J:1899; C:1129).
2. **Метрики** — общий горизонтальный контейнер `.info-card.athlete-dashboard-summary` с двумя группами, центральным разделителем и нижней зоной dots/chart (J:1921; C:4026).
3. **Следующая тренировка** — одна фотографическая CTA-карточка `.info-card.athlete-dashboard-next`, шире обычных, три строки слева и стрелка справа; без отдельного вложенного бейджа (J:1941/2169; C:812/1349).
4. **Карточки разделов** — четыре `.info-card.cabinet-nav-button`: контурный рисунок, заголовок, подзаголовок, нейтральная стрелка, непрозрачный почти чёрный фон (J:1575/1948; C:1241).
5. **Нижняя nav** — единый capsule-контейнер с четырьмя равными колонками и общим движущимся светом/индикатором, не набор отдельных оранжевых плиток (J:1688/1735; C:3434).

### 7.2. Геометрия и семантика нижней nav

Источник: **C:3434–3633; J:1688–1813**.

- Nav — **сосед** `.page` в flex-оболочке, `position:relative`, z-index `1000`, `align-self:center`, не `position:fixed`.
- Width `calc(100% - 20px)`, max-width `480px`, height обеспечивается `min-height:64px` и `flex:0 0 64px`; padding `5px 6px 3px`; gap `2px`; grid `repeat(4,minmax(0,1fr))`.
- При width ≤360px: width `calc(100% - 14px)`, padding-right/left `4px`; высота остаётся `64px` (C:3622).
- Каждая кнопка: min-height `54px`, grid-rows `28px 15px 3px`, gap `3px`, padding `2px 1px 0`, center по обеим осям; radius `15px`; border `0`.
- Nav icon-box **25.5×23.8px** (C:3554). PNG используется как mask `center / contain no-repeat`; currentColor перекрашивает силуэт и активное состояние.
- Layout-slot индикатора каждой кнопки **44×3px** прозрачен. Видимая полоска — одна `.athlete-bottom-nav-active-indicator`; её перемещает JS. Не рисовать обе одновременно (C:3492, C:3597; J:1773).
- Порядок: **Главная / Питание / Тренировки / Прогресс**. Главная активна также для `account` и `profile`; nutrition/training/progress сопоставляются по префиксу раздела (J:1688).
- Активная кнопка имеет `.is-active` и `aria-current="page"`; nav — `aria-label="Основные разделы"`; изображения/подсветки декоративны `aria-hidden="true"` (J:1722–1730). Touch-action manipulation и user-select none заданы кнопке (C:3517).
- Основные состояния и анимация — раздел 5.5. У четырёх карточек и следующей тренировки отдельных scoped hover/pressed/disabled-вариантов, сопоставимых с nav, не найдено; browser-native focus остаётся зависимым от контекста. Не придумывать для них утверждённый hover/glow.

### 7.3. Уже существующие переиспользуемые CSS-примитивы

| CSS / функция | Что реально существует | Граница применимости |
|---|---|---|
| `.screen`, `.screen.active` | Скрытие/показ и safe-top, C:65; переключение A:28 `showScreen()` | Общая оболочка; athlete с nav меняет display/layout |
| `.page`, `.topbar`, `.logo` | Контейнер, flex-шапка, ресурсный логотип, C:111–147 | Главная использует scoped-размеры/inline display; база не воспроизводит её автоматически |
| `.info-card` | Базовый фон `var(--surface)`, border `1px var(--border)`, radius `16px`, padding `18px`, font `14px`, line-height `1.6`, C:461 | `#athleteScreen .info-card` C:3748 задаёт radius `14px`, line-height `1.45`, padding `14px`; home-версии переопределяют ещё раз |
| `.card-title`, `.card-copy`, `.card-copy-support` | Общие текстовые роли, C:476–490 | Не равны автоматически заголовкам/подзаголовкам nav-карточек 15/12px |
| `.cabinet-nav-button`, `.cabinet-nav-icon`, `.cabinet-nav-copy`, `.cabinet-nav-title`, `.cabinet-nav-detail` | Flex-композиция «иконка + текст + стрелка», C:559–624 | Для эталона необходим scoped-слой C:1236, иначе вернутся другие размеры/цветные подложки |
| `athleteCabinetNavButton(section,symbol,title,detail)` | Реальный HTML-renderer карточек разделов, J:1575 | Получает HTML иконки, статические подписи и section; не новая компонентная библиотека |
| `.nutrition-plan-link-arrow` | Общий текстовый шеврон, C:2243 | Scoped-цвет серый только внутри списка главной; у следующей тренировки остаётся accent |
| `.athlete-dashboard-stat-copy`, `.athlete-dashboard-stat-icon` | Повторяемая пара число/подпись/иконка, C:1000/1033 + C:4087 | Сильная зависимость от grid и scoped CSS метрик |
| `athleteBottomNavigationMarkup`, `athleteRenderWithBottomNavigation`, `athletePositionBottomNavigation` | Общая nav, сохранение её DOM, позиционирование света, J:1688/1735/1782 | Работают совместно с CSS/data-атрибутами и shell, не только генератором кнопок |
| `athleteCabinetCard`, `athleteCabinetRow` | Общая `.info-card` с `.card-title`/`.summary-row`, J:1315/1322 | Существуют в других разделах, не являются renderer четырёх утверждённых кнопок |
| `.primary-btn`, `.secondary-btn`, `.text-input`, `.text-area`, `.file-input`, `.option` | Реальные общие контроли C:373–458 | На главной не показаны; нельзя считать их визуально утверждёнными через этот экран |

Для ориентирования в уже существующих athlete-контролах: scoped primary имеет min-height `50px`, padding `13px`, radius `13px` (C:3827); secondary — `44px`, padding `11px`, radius `12px` (C:3834); input/textarea padding `13px 14px`, radius `12px` (C:3801); option min-height `50px`, padding `12px 13px`, radius `12px` (C:3816). Это **инвентаризация соседних примитивов**, не решение распространить их внешний вид на будущие экраны.

## 8. Адаптивность и Telegram

### 8.1. Safe areas и высота оболочки

Источник: **C:24–27, `:root`**:

```css
--app-safe-top: calc(max(env(safe-area-inset-top, 0px), var(--tg-safe-area-inset-top, 0px)) + var(--tg-content-safe-area-inset-top, 0px));
--app-safe-bottom: calc(max(env(safe-area-inset-bottom, 0px), var(--tg-safe-area-inset-bottom, 0px)) + var(--tg-content-safe-area-inset-bottom, 0px));
--app-content-height: calc(100dvh - var(--app-safe-top));
```

`.screen` добавляет padding-top `var(--app-safe-top)` (C:65). Но нижний отступ athlete-nav использует **другую формулу**, C:3405:

```css
--athlete-bottom-nav-offset: max(8px, env(safe-area-inset-bottom, 0px), var(--tg-safe-area-inset-bottom, 0px), var(--tg-content-safe-area-inset-bottom, 0px));
```

Здесь берётся максимум, не сумма. Именно он становится padding-bottom shell. Нельзя заменять его значением `--app-safe-bottom`, ожидая тот же результат.

H:7 задаёт `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover`. A:1–17 вызывает Telegram `ready()`, `expand()`, при поддержке версии ≥8.0 — `requestFullscreen()`. SDK подключён внешним script в H:14; локального кода, явно записывающего все `--tg-…-inset` переменные, в изученных A/J не найдено. Их получение зависит от среды Telegram SDK, `env()` и fallback `0px`.

Кнопки «Закрыть», системная строка и меню Telegram не нарисованы HTML главного экрана. Их размеры не являются CSS-токенами TRENZO. При отсутствии Telegram локальный браузер не воспроизводит реальный safe-top автоматически.

### 8.2. Применимые breakpoint-правила

| Условие | Фактическое влияние на главную | Источник |
|---|---|---|
| Базовый режим | Max-width page `480px`; обычные значения компонентов из предыдущих разделов | C:111, scoped home CSS |
| Width ≤380px | KPI max `158px`; grid метрик min-height `62px`; padding карточек разделов `5px 8px` | C:1368–1389 |
| То же: ранние размеры метрик | В media есть `.athlete-dashboard-stat-icon` 28×26px и summary padding 8px 7px, но итог на главной — **32×32px**, padding **10px 10px 2px** из более специфичных правил | C:1369–1380 против C:1000/C:1345 |
| Width ≤372px | Поздняя формула min-height внутреннего grid метрик; оставляет место под узкую подпись | C:4136 |
| Width ≤360px | Nav шире относительно viewport (`100% - 14px`), боковые padding `4px`, label `11.5px` | C:3622 |
| Height ≤760px **и** width ≤600px | Page top `8px`; шапка margin-bottom `6px`; следующий margin-top `-27px`; список gap `4px`, карточки/иконки/тексты компактнее | C:3636–3697 |
| Ранний короткий media-блок | Его page top `6px`, topbar margin `5px` заменены поздним блоком на `8px/6px`; next min-height `88px` проигрывает scoped `110.125px` | C:1392 против C:1349 и C:3636 |
| `prefers-reduced-motion:reduce` | KPI transition none; nav без перемещения, остаётся opacity-переход | C:1230, C:3610 |
| `(hover:hover) and (pointer:fine)` | Может показываться `.athlete-desktop-back-button`, если он есть в DOM; на главной `athleteRenderCabinet()` такой кнопки нет | C:3721–3728; J:1881 |

`vw`/clamp-масштабирование продолжает зависеть от viewport даже после достижения `.page` max-width480px. Отдельная утверждённая desktop/landscape-композиция из кода не следует. Отсутствие нового breakpoint не означает утверждения всех широких вариантов.

### 8.3. Контрольные измерения, не новые токены

Прочитаны computed styles текущего приложения в Chrome: mobile/touch emulation, DPR2; вручную подставлены top-safe `59px`, content-safe-top `44px`, bottom-safe `34px`, прочие inset0. Демо `openAthleteDemo()`, шрифт Arial/system-ui на macOS. Это **не измерения реального iPhone/Telegram**. Все размеры ниже — CSS px; auto-размеры округлены здесь до двух знаков только для чтения.

| Viewport | `.page` width | KPI width | Метрики W×H | Следующая W×H | Первая карточка W×H | Nav W×H |
|---|---:|---:|---:|---:|---:|---:|
| 360×740 | 360 | 147.59 | 332×92.58 | 344×110.125 | 332×42.31 | 346×64 |
| 375×812 | 375 | 153.75 | 347×81.91 | 359×110.125 | 347×46.31 | 355×64 |
| 393×852 | 393 | 161.125 | 365×88 | 377×110.125 | 365×48.31 | 373×64 |
| 430×932 | 430 | 168 | 402×88 | 414×110.125 | 402×48.31 | 410×64 |
| 768×1024 | 480 | 168 | 452×89.45 | 464×110.125 | 452×48.31 | 480×64 |

На 393px: KPI number `39.3px`, его label `12px`; числа метрик примерно `18.9406px`, подписи `10.79px` при line-height `13.2048px`. Источник — формулы раздела2 и computed styles, а не отдельная версия типографики для 393px. Высоты метрик отличаются не только из-за текста, но и из-за условий ≤380/≤372px и auto-grid.

Небольшая высота viewport может требовать прокрутки списка, чтобы увидеть «Прогресс». Shell сохраняет nav отдельным элементом; утверждённый код не гарантирует размещение всех карточек без скролла на каждом телефоне (C:3414–3431).

## 9. Динамические значения и границы визуального эталона

| Значение / состояние | Где вычисляется | Что важно не считать постоянным дизайн-токеном |
|---|---|---|
| Hero и маска | J:1884, J:1822–1877 | Мужская фотография условна; координаты fade зависят от метрик и inset/скролла |
| KPI74% | `athleteDashboardApplyAdherenceVisualPreview()`, J:2101; вызывается в render и после расчёта, J:1963/J:2108–2120 | В текущем коде preview принудительно показывает **74**; это не порог, целевой KPI или правило бизнес-данных дизайн-системы |
| `2/3`, ПН/СР | `athleteDashboardApplyWorkoutVisualPreview()`, J:2011; вызывается после рендера недели | Сейчас preview принудительно заменяет счётчик и состояния дней; последовательность ПН–ВС и семь кружков — структура компонента |
| Вес `87,0` | Демо в `athleteLoadCabinetDashboard()` J:2157; при загруженных данных — последний вес; формат J:5551 | Число не постоянный текст; десятичная запятая/один знак и меньший comma-span — существующее представление |
| Название/число упражнений | J:2193–2203 | Загружается из следующей незавершённой сессии, склонение числа через helper; «Силовая тренировка» сейчас добавлена строкой, без отдельного поля типа в этом фрагменте |
| График веса | J:2042 | Диапазон и точки из последних максимум7 измерений; при отсутствии данных скрыт |
| Фото профиля | J:1892–1895 | PNG-placeholder или пользовательский data URL, с разным CSS object-fit/размером |
| Active nav и ширина света | J:1688/1735 | Зависят от section и фактической геометрии; CSS100px только начальное значение |

Эти наблюдения не являются предложением изменить расчёты. При этой задаче данные, preview-поведение и бизнес-логика оставлены без изменений.

## 10. Правила визуальной иерархии, подтверждённые эталоном

Ниже — выводы из действующих компонентов, а не новые общеобязательные нормы для ещё не созданных экранов.

| Наблюдаемое правило | Доказательство / граница применения |
|---|---|
| Главное процентное число крупнее вспомогательных метрик | KPI `clamp(38px,10vw,44px)` против metric `clamp(17.334px,4.8195vw,22.599px)`, C:1192/C:4087 |
| У числа и подписи разные уровни контраста и веса | Числа `#FBFBFB`, подписи метрик `#ABB2BD`, 700 против400; единица `.62em`, C:1050/C:1076/C:4087/C:4116 |
| Оранжевый обозначает активность и тренировочный контекст | Дуга, завершённые дни, sparkline, metadata, active nav; C:1104, C:3541, C:857; J:1905/2068. Это не означает, что весь оранжевый в проекте имеет один HEX |
| Карточки разделов тише фотографической CTA | 15px titles, серые стрелки и нейтральные контуры против18px названия тренировки и оранжевой строки; C:1313/C:1317/C:851/C:857 |
| Содержание CTA собрано слева, объект фото — справа | Text-align left, grid-copy, background-position/size, затемняющие градиенты; C:812/C:838. Не центрировать строки по горизонтали |
| Фоновая фотография отделена от нижнего списка | Чёрная основа и fade к середине метрик; непрозрачные `#060809` карточки, C:893/C:919/C:1241; J:1822 |
| Контур сдержанный, не основной цветовой акцент | Низкая alpha `.16`, inset `.5px/1px`, нейтральная граница `#373737`; C:1246/C:4028/C:822 |
| Иконографика зависит от уровня интерфейса | Контурные PNG в карточках/метриках, силуэтные masks в nav; конкретные файлы и способы окраски раздела6 |
| Активная nav поддержана тремя согласованными признаками | Оранжевые icon+label, световой участок поля/контура и общая полоска; C:3484/C:3492/C:3541; J:1735 |
| Расстояния внутри смысловых групп меньше некоторых межблочных | Copy gap2/6px, отдельный list gap6px; но полной единой spacing-шкалы нет, C:1033/C:838/C:1236 |

Для дальнейшей разработки сначала различать **компонентные** правила (например, ширина фото-CTA) и **повторяемые** правила (слои текста, нейтральная поверхность, active-state nav). Копирование позиционных поправок `-28px`, `left:-13px` или crop-offsets в другой контекст не подтверждено эталоном.

## 11. Требует уточнения

Здесь нет придуманных числовых значений. Это границы того, что можно однозначно восстановить из утверждённой главной.

| Вопрос | Что уже известно | Что требуется определить для следующих экранов |
|---|---|---|
| Единая семантическая палитра | Root и home одновременно используют `#FF7846`, `#FC6C17`, три цвета KPI, разные поверхности/серые | Как распределять роли accent/action/status между экранами; какие значения станут общими токенами. Нельзя молча выбрать один orange |
| Общая шкала spacing | Есть конкретные padding/gap и локальные компенсации | Какие из них системные, какие остаются исключением главной; единой 4/8px шкалы сейчас нет |
| Радиусы для новых компонентов | Утверждены14px карточек,18px метрик,28px nav, круговые формы | Нет общей именованной шкалы радиусов и правил выбора для модалок/полей/новых поверхностей |
| Единый icon-мастер | Точные PNG и CSS-показ известны; часть PNG текстурная; nav использует masks | Численный master-stroke для новых иконок, правила optical-size, цветовая нормализация, формат исходника. Общего CSS stroke для шести PNG нет |
| Физические шрифты и масштабирование текста | Arial/system-ui stacks, размеры, viewport zoom disabled | Поддержка iOS/Android text scaling, масштабирования/локализаций и закрепление physical font, если нужно |
| Мобильные крайние режимы | Известны существующие media, min-width не задан; content scrollable | Поддерживаемые минимальные размеры, landscape, большие accessibility fonts, длинные названия; отдельное утверждение этих состояний |
| Tablet/desktop | Есть max-width480px; фото и vw продолжают масштабироваться по viewport | Является ли текущий wide-layout допустимым продуктовым вариантом; отдельный эталон не найден |
| Женский вариант / отсутствие фотографии | Male-класс зависит от sex, без него не включён hero-фон | Утверждённый внешний вид других вариантов и фон; текущий мужской эталон не устанавливает их правила |
| Safe-area SDK | Формулы известны; отдельной записи --tg-inset в локальном JS не найдено | Матрица версий Telegram/WebView, поведение SDK и режимы fullscreen/non-fullscreen на целевых устройствах |
| Состояния компонентов | Nav имеет active/pressed/focus/reduced-motion; next имеет loading/no-plan/completed | Внешний вид disabled/error/empty/loading/skeleton для остальных компонентов и CTA, правила нескольких строк/типов тренировки |
| Содержимое vs preview | 74% и2/3 сейчас форсируются preview-функциями | Когда и как прекращается preview при подключении реальных данных; это будущая функциональная задача, не часть инвентаризации |
| Формы и прочие экраны | CSS-контроли существуют, перечислены в7.3 | Принять или адаптировать их внешний вид относительно home; не выдавать их существование за визуальное утверждение |
| Статусные цвета | Глобальный зелёный progress существует, другие экраны имеют свои стили | Значения и роли success/error/warning/info в общей системе на основе будущих продуктовых случаев |
| Доступность | Реальные aria/клавиатурные nav-состояния описаны; размеры некоторых карточек auto и могут быть ниже44px | Контраст на всех фото, размеры touch-target, focus карточек, zoom и screen-reader-сценарии требуют отдельной проверки/решений; соответствие стандарту из одних CSS не следует |
| Design-token architecture | Сейчас смесь :root, scoped literals, inline/JS-геометрии и PNG | Будущая структура primitive/semantic/component-токенов, соглашения именования и компоненты. Их внедрение — отдельный этап, здесь не выполнено |

## 12. Метод и результат этой инвентаризации

- UI/UX Pro Max использован как список областей проверки и для узкого поиска consistency/typography; его рекомендуемые размеры, палитры и библиотеки **не подставлялись** вместо реализации.
- Impeccable использован в scan/document-подходе: сначала действующие CSS, компоненты и ресурсы. Его context подтвердил существующую реализацию и отсутствие `PRODUCT.md`/корневого `DESIGN.md`; придумывать brand-метафору, проходить новый дизайн-воркшоп, создавать sidecar/новые компоненты для этой задачи не требовалось. По ограничению пользователя результат — этот документ.
- Прочитаны исходные CSS/JS/HTML, SVG логотипа и размеры/пиксели используемых PNG; computed styles проверены на пяти viewport для разрешения каскада. Новые изображения не создавались, существующие не редактировались.
- Все источники чисел — код, файл ресурса или явно обозначенное computed-измерение. Исторические сообщения/промежуточные screenshots не использованы вместо текущего кода.
- Код приложения, ассеты, API, данные, расчёты и CSS не изменены. Рефакторинг и создание библиотеки компонентов не выполнялись.

**Единственный результат задачи:** `design-system/DESIGN-SYSTEM.md`.
