/* Только представление аналитики. Данные и расчёты находятся в analytics-data.js. */
function trainerAnalyticsNumber(value, digits = 0) {
  return value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('ru-RU', { maximumFractionDigits: digits });
}
function trainerAnalyticsChange(value, percent = false, comparison = 'к прошлым 4 неделям') {
  if (value == null) return 'Нет сравнения с прошлым периодом';
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${trainerAnalyticsNumber(Math.abs(rounded))}${percent ? '%' : ''} ${comparison}`;
}
function trainerAnalyticsChart(summary, volume = false) {
  const rows = summary.chartData, num = trainerAnalyticsNumber;
  const max = Math.max(1, ...rows.map(row => volume ? row.totalVolume : Math.max(row.plannedWorkouts, row.completedWorkouts)));
  const height = value => Math.max(0, Math.min(100, value / max * 100));
  const peak = volume ? rows.findIndex(row => row.totalVolume === max) : -1;
  return `<div class="${volume ? 'analytics-volume-chart' : 'analytics-workout-chart'}${rows.length > 4 ? ' is-dense' : ''}${rows.length > 7 ? ' is-long' : ''}" style="--analytics-columns:${Math.max(1, rows.length)}" role="list" aria-label="${volume ? 'Тренировочный объём' : 'Выполненные и запланированные тренировки'} ${summary.period.chart === 'days' ? 'по дням' : summary.period.chart === 'months' ? 'по месяцам' : 'по неделям'}">${rows.map((row, index) => {
    const description = trainerEscape(`${trainerPeriodLabel(row)}: ${volume ? `${num(row.totalVolume, 1)} кг` : `${num(row.completedWorkouts)} из ${num(row.plannedWorkouts)} тренировок`}`);
    return `<div class="analytics-week${peak === index ? ' is-peak' : ''}" role="listitem" aria-label="${description}" title="${description}">
      <strong>${volume ? `${num(row.totalVolume / 1000, 1)} <span>т</span>` : `${num(row.completedWorkouts)}<span> / ${num(row.plannedWorkouts)}</span>`}</strong>
      <div class="analytics-bar-space" aria-hidden="true">${volume ? `<div class="analytics-volume-fill" style="height:${height(row.totalVolume)}%"></div>` : `<div class="analytics-workout-track" style="height:${height(row.plannedWorkouts)}%"></div><div class="analytics-workout-fill" style="height:${height(row.completedWorkouts)}%"></div>`}</div>
      <small>${trainerEscape(row.label)}</small>
    </div>`;
  }).join('')}</div>`;
}
function trainerAnalyticsDashboard(summary = trainerAnalyticsSummary(createTrainerAnalyticsDemo())) {
  const num = trainerAnalyticsNumber;
  const chartHeading = summary.period.chart === 'days' ? 'По дням' : summary.period.chart === 'months' ? 'По месяцам' : 'По неделям';
  const comparison = summary.period.comparison;
  const sets = [
    { key: 'target', label: 'По плану', count: summary.targetSets },
    { key: 'below', label: 'Ниже плана', count: summary.belowTargetSets },
    { key: 'above', label: 'Выше плана', count: summary.aboveTargetSets },
    { key: 'uncompared', label: 'Без сравнения', count: summary.uncomparedSets }
  ];
  const safePercent = value => Math.max(0, Math.min(100, Number(value) || 0));
  const setRows = sets.filter(row => row.count || row.key !== 'uncompared');
  return `<div class="analytics-dashboard">
    <header class="analytics-heading">
      <div class="analytics-heading-row"><h1>Аналитика</h1><label class="analytics-period-control"><span class="trainer-sr-only">Период аналитики</span><select class="analytics-period" data-analytics-period>${trainerAnalyticsPeriods.map(period => `<option value="${period.key}"${summary.period.key === period.key ? ' selected' : ''}>${trainerEscape(period.label)}</option>`).join('')}</select></label></div>
      <p>${trainerPeriodLabel(summary.period)}</p>
      ${summary.source === 'demo' ? `<small>Демо-данные · ${num(summary.clientCount)} клиентов</small>` : ''}
    </header>

    <section class="trainer-card analytics-card" aria-labelledby="analytics-workouts-title">
      <h2 id="analytics-workouts-title">Тренировки</h2>
      <div class="analytics-workouts-main">
        <div class="analytics-key-metric"><strong>${num(summary.completedWorkouts)}<span> / ${num(summary.plannedWorkouts)}</span></strong><span>выполнено</span></div>
        <div class="analytics-completion"><strong>${num(summary.workoutCompletionPercent)}${summary.workoutCompletionPercent == null ? '' : '%'}</strong><span>выполнение плана</span></div>
      </div>
      <dl class="analytics-workout-facts"><div><dt>Запланировано</dt><dd>${num(summary.plannedWorkouts)}</dd></div><div><dt>Проведено</dt><dd>${num(summary.completedWorkouts)}</dd></div><div><dt>Пропущено</dt><dd>${num(summary.missedWorkouts)}</dd></div></dl>
      ${summary.unreportedWorkouts ? `<p class="analytics-note">Ещё ${num(summary.unreportedWorkouts)} без записи — отчёт не сдан, пропуск не зафиксирован.</p>` : ''}
      <div class="analytics-chart-heading"><span>${chartHeading}</span><span>выполнено / план</span></div>
      ${trainerAnalyticsChart(summary)}
      <p class="analytics-note">Пропуски фиксируются при сдаче отчёта.</p>
    </section>

    <section class="trainer-card analytics-card" aria-labelledby="analytics-sets-title">
      <h2 id="analytics-sets-title">Подходы</h2>
      <div class="analytics-key-metric"><strong>${num(summary.completedSets)}</strong><span>выполнено всего</span></div>
      <div class="analytics-set-bar" aria-hidden="true">${setRows.map(row => `<span class="analytics-set-segment is-${row.key}" style="width:${safePercent(summary.setPercentages[row.key])}%"></span>`).join('')}</div>
      <dl class="analytics-set-list">${setRows.map(row => `<div><dt><i class="analytics-dot is-${row.key}" aria-hidden="true"></i>${row.label}</dt><dd><strong>${num(row.count)}</strong><span>${num(summary.setPercentages[row.key])}${summary.setPercentages[row.key] == null ? '' : '%'}</span></dd></div>`).join('')}</dl>
      <p class="analytics-note">Повторения и время сравниваются с назначенной целью.</p>
    </section>

    <div class="analytics-pair">
      <section class="trainer-card analytics-card analytics-small-card"><h2>Прогрессии</h2><div class="analytics-key-metric"><strong>${num(summary.progressions)}</strong><span>за ${trainerEscape(summary.period.label.toLocaleLowerCase('ru-RU'))}</span></div><p class="analytics-change">${trainerAnalyticsChange(summary.progressionChange, false, comparison)}</p></section>
      <section class="trainer-card analytics-card analytics-small-card"><h2>Личные рекорды</h2><div class="analytics-key-metric"><strong>${num(summary.personalRecords)}</strong><span>за ${trainerEscape(summary.period.label.toLocaleLowerCase('ru-RU'))}</span></div><p class="analytics-change">${trainerAnalyticsChange(summary.personalRecordChange, false, comparison)}</p></section>
    </div>

    <section class="trainer-card analytics-card" aria-labelledby="analytics-volume-title">
      <h2 id="analytics-volume-title">Тренировочный объём</h2>
      <div class="analytics-key-metric"><strong class="analytics-volume-total">${num(summary.totalVolume, 1)} <span>кг</span></strong><span>общий объём</span></div>
      <p class="analytics-change">${trainerAnalyticsChange(summary.volumeChangePercent, true, comparison)}</p>
      <dl class="analytics-volume-facts"><div><dt>На клиента</dt><dd>${num(summary.averageVolumePerClient)} <span>кг</span></dd></div><div><dt>На тренировку</dt><dd>${num(summary.averageVolumePerWorkout)} <span>кг</span></dd></div></dl>
      <div class="analytics-peak"><span>Максимальный недельный объём</span><strong>${summary.peakVolume ? `${num(summary.peakVolume.volume, 1)} кг <span>· ${summary.period.key === '4w' ? `${summary.peakVolume.weekNumber}-я неделя` : trainerPeriodLabel(summary.peakVolume)}</span>` : 'Нет данных'}</strong></div>
      <div class="analytics-chart-heading"><span>${chartHeading}</span><span>объём, т</span></div>
      ${trainerAnalyticsChart(summary, true)}
      <p class="analytics-note">Сумма веса × повторений. Упражнения без внешнего веса и на время не входят в тоннаж.</p>
    </section>
  </div>`;
}
