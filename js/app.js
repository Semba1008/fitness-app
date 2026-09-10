let currentSets = [];
let currentExercise = null;
let editingSessionId = null;
let editingExerciseId = null;
let calendarYear = null;
let calendarMonth = null;
let calendarSelectedDate = null;

function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function todayDateStr() {
  return toDateStr(new Date());
}

function switchView(viewId, title) {
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === viewId));
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === viewId));
  document.getElementById('page-title').textContent = title;
  if (viewId === 'view-home') renderHome();
  if (viewId === 'view-workout') {
    renderWorkoutMenu();
    renderExerciseHistory();
    renderExerciseChart();
  }
  if (viewId === 'view-weight') {
    renderWeightChart();
    renderWeightHistory();
    renderBmrCard();
  }
  if (viewId === 'view-calorie') populateCalorieOptions();
}

function setupNav() {
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view, btn.dataset.title));
  });
  document.querySelectorAll('[data-goto]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = document.querySelector(`.nav-btn[data-view="${btn.dataset.goto}"]`);
      switchView(btn.dataset.goto, target ? target.dataset.title : '');
    });
  });
}

function renderHome() {
  const profile = Storage.getProfile();
  const card = document.getElementById('home-calorie-card');
  if (profile) {
    const summary = Calorie.summarize(profile);
    card.innerHTML = `
      <h2>今日の目標カロリー</h2>
      <div class="row-between">
        <span>${summary.target} kcal</span>
        <button class="btn-secondary" data-goto="view-calorie">詳細</button>
      </div>`;
    card.querySelector('[data-goto]').addEventListener('click', () => switchView('view-calorie', 'カロリー'));
  } else {
    card.innerHTML = `
      <h2>今日の目標カロリー</h2>
      <p class="empty-hint">プロフィールが未設定です。「カロリー」タブで設定してください。</p>`;
  }

  const log = Storage.getWeightLog();
  const latestEl = document.getElementById('home-latest-weight');
  latestEl.textContent = log.length
    ? `${log[log.length - 1].weightKg} kg (${formatDateLabel(log[log.length - 1].date)})`
    : '記録なし';

  renderCalendar();
  renderCalendarDayDetail();
}

const WEEKDAY_LABELS_SHORT = ['日', '月', '火', '水', '木', '金', '土'];

function formatDateLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${m}/${d}(${WEEKDAY_LABELS_SHORT[date.getDay()]})`;
}

function repRangeText(exercise) {
  return exercise.repMin === exercise.repMax
    ? `${exercise.repMin}回`
    : `${exercise.repMin}〜${exercise.repMax}回`;
}

function populateCategorySelect(selectId) {
  const select = document.getElementById(selectId);
  const previous = select.value;
  const categories = [...new Set(Storage.getExercises().map((ex) => ex.category))];
  select.innerHTML =
    '<option value="">部位で選ぶ</option>' + categories.map((c) => `<option value="${c}">${c}</option>`).join('');
  select.value = categories.includes(previous) ? previous : '';
}

function renderMenuItemsInto(listId, exercises, emptyMessage, onSelect) {
  const list = document.getElementById(listId);
  if (!exercises.length) {
    list.innerHTML = `<p class="empty-hint">${emptyMessage}</p>`;
    return;
  }
  list.innerHTML = exercises
    .map(
      (ex) => `
      <button type="button" class="today-menu-item" data-exercise-id="${ex.id}">
        <span>${ex.name}</span>
        <span class="muted">${ex.targetSets || 3}セット×${repRangeText(ex)}</span>
      </button>`
    )
    .join('');
  list.querySelectorAll('[data-exercise-id]').forEach((btn) => {
    btn.addEventListener('click', () => onSelect(btn.dataset.exerciseId));
  });
}

function initCalendarState() {
  const now = new Date();
  calendarYear = now.getFullYear();
  calendarMonth = now.getMonth();
  calendarSelectedDate = todayDateStr();
}

function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  document.getElementById('calendar-month-label').textContent = `${calendarYear}年${calendarMonth + 1}月`;

  const firstWeekday = new Date(calendarYear, calendarMonth, 1).getDay();
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const sessionDates = new Set(Storage.getWorkoutLog().map((s) => s.date));
  const today = todayDateStr();

  let html = '';
  for (let i = 0; i < firstWeekday; i++) {
    html += '<span class="calendar-day empty"></span>';
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const classes = ['calendar-day'];
    if (dateStr === today) classes.push('today');
    if (dateStr === calendarSelectedDate) classes.push('selected');
    const dot = sessionDates.has(dateStr) ? '<span class="dot"></span>' : '';
    html += `<button type="button" class="${classes.join(' ')}" data-date="${dateStr}">${day}${dot}</button>`;
  }
  grid.innerHTML = html;

  grid.querySelectorAll('[data-date]').forEach((btn) => {
    btn.addEventListener('click', () => {
      calendarSelectedDate = btn.dataset.date;
      renderCalendar();
      renderCalendarDayDetail();
    });
  });
}

function renderCalendarDayDetail() {
  const title = document.getElementById('calendar-day-title');
  const detail = document.getElementById('calendar-day-detail');
  const label = formatDateLabel(calendarSelectedDate);
  title.textContent = calendarSelectedDate === todayDateStr() ? `今日の記録(${label})` : `${label}の記録`;

  const sessions = Storage.getWorkoutLog().filter((s) => s.date === calendarSelectedDate);
  if (!sessions.length) {
    detail.innerHTML = '<p class="empty-hint">この日の記録はありません。</p>';
    return;
  }
  const exercises = Storage.getExercises();
  detail.innerHTML = sessions
    .map((session) => {
      const exercise = exercises.find((ex) => ex.id === session.exerciseId);
      const name = exercise ? exercise.name : '(削除済みの種目)';
      let badge;
      let pillsHtml;
      if (session.cardio) {
        badge = `${Math.round(session.cardio.calories)}kcal`;
        pillsHtml = `
          <span class="set-pill">${session.cardio.durationMin}分</span>
          <span class="set-pill">${session.cardio.speedKmh}km/h</span>
          <span class="set-pill">傾斜${session.cardio.inclinePercent}%</span>`;
      } else {
        badge = `最大${Math.max(...session.sets.map((s) => s.weight))}kg`;
        pillsHtml = session.sets
          .map(
            (s) =>
              `<span class="set-pill">${s.weight}kg × ${s.reps}回${
                s.rpe ? `<span class="pill-rpe">RPE${s.rpe}</span>` : ''
              }</span>`
          )
          .join('');
      }
      return `
      <div class="history-entry">
        <div class="history-date">
          <strong>${name}</strong>
          <span class="muted">${badge}</span>
        </div>
        <div class="set-pills">${pillsHtml}</div>
      </div>`;
    })
    .join('');
}

function renderWorkoutMenu() {
  const title = document.getElementById('workout-menu-title');
  const saveDayBtn = document.getElementById('btn-save-day-workout');
  const categoryValue = document.getElementById('workout-menu-category-select').value;
  const dayKey = document.getElementById('workout-menu-day-select').value;
  const selectHere = (exerciseId) => {
    document.getElementById('exercise-select').value = exerciseId;
    onExerciseChange(exerciseId);
  };

  if (categoryValue) {
    const exercises = Storage.getExercises().filter((ex) => ex.category === categoryValue);
    title.textContent = `${categoryValue}のいつものセット`;
    renderMenuItemsInto('workout-menu-list', exercises, 'この部位の種目がまだ登録されていません。', selectHere);
    saveDayBtn.hidden = true;
    return;
  }

  if (dayKey) {
    const dayInfo = ROUTINE_DAYS[dayKey];
    const exercises = Storage.getExercises().filter((ex) => ex.day === dayKey);
    title.textContent = `${dayInfo.label}のメニュー`;
    renderMenuItemsInto('workout-menu-list', exercises, 'この曜日の種目がまだ登録されていません。', selectHere);
    saveDayBtn.hidden = exercises.length === 0;
    saveDayBtn.dataset.day = dayKey;
    return;
  }

  title.textContent = 'いつものメニュー';
  document.getElementById('workout-menu-list').innerHTML =
    '<p class="empty-hint">曜日または部位を選ぶと、いつものセットからすぐに選べます。</p>';
  saveDayBtn.hidden = true;
}

function bulkLogDay(dayKey) {
  const dayInfo = ROUTINE_DAYS[dayKey];
  const exercises = Storage.getExercises().filter((ex) => ex.day === dayKey && ex.type !== 'cardio');
  if (!exercises.length) return;

  const today = todayDateStr();
  exercises.forEach((ex) => {
    const suggestion = Workout.suggestNext(ex);
    const sets = Array.from({ length: suggestion.sets }, () => ({
      weight: suggestion.weight === null ? 0 : suggestion.weight,
      reps: suggestion.targetReps,
      rpe: null,
    }));
    Storage.addWorkoutSession({
      id: `session_${Date.now()}_${ex.id}`,
      date: today,
      exerciseId: ex.id,
      sets,
    });
  });

  renderWorkoutMenu();
  renderExerciseHistory();
  renderExerciseChart();
}

function populateExerciseSelect() {
  const select = document.getElementById('exercise-select');
  const exercises = Storage.getExercises();
  select.innerHTML = exercises
    .map((ex) => `<option value="${ex.id}">${ex.name}(${ex.category})</option>`)
    .join('');
  if (exercises.length) {
    onExerciseChange(exercises[0].id);
  } else {
    currentExercise = null;
    currentSets = [];
    cancelEditSession();
    document.getElementById('suggestion-card').hidden = true;
    document.getElementById('cardio-card').hidden = true;
    document.getElementById('strength-log-card').hidden = false;
    renderSetRows();
    document.getElementById('exercise-history').innerHTML =
      '<p class="empty-hint">種目がありません。追加してください。</p>';
    drawLineChart(document.getElementById('exercise-chart'), []);
  }
}

function getUserWeightKg() {
  const profile = Storage.getProfile();
  if (profile && profile.weightKg) return profile.weightKg;
  const log = Storage.getWeightLog();
  if (log.length) return log[log.length - 1].weightKg;
  return 60;
}

function updateCardioCalories() {
  if (!currentExercise || currentExercise.type !== 'cardio') return;
  const duration = Number(document.getElementById('cardio-duration').value) || 0;
  const speed = Number(document.getElementById('cardio-speed').value) || 0;
  const incline = Number(document.getElementById('cardio-incline').value) || 0;
  const calories = Cardio.caloriesBurned(currentExercise.cardioMode, speed, incline, duration, getUserWeightKg());
  document.getElementById('cardio-calories').textContent = `${Math.round(calories)} kcal`;
}

function onExerciseChange(exerciseId) {
  const exercises = Storage.getExercises();
  currentExercise = exercises.find((ex) => ex.id === exerciseId);
  if (!currentExercise) return;
  cancelEditSession();

  if (currentExercise.type === 'cardio') {
    document.getElementById('suggestion-card').hidden = true;
    document.getElementById('strength-log-card').hidden = true;
    document.getElementById('cardio-card').hidden = false;

    const last = Storage.lastSessionFor(currentExercise.id);
    document.getElementById('cardio-duration').value = last ? last.cardio.durationMin : 30;
    document.getElementById('cardio-speed').value = last
      ? last.cardio.speedKmh
      : currentExercise.cardioMode === 'run'
      ? 8
      : 5;
    document.getElementById('cardio-incline').value = last
      ? last.cardio.inclinePercent
      : currentExercise.cardioMode === 'walk'
      ? 5
      : 0;
    updateCardioCalories();
    renderExerciseHistory();
    renderExerciseChart();
    return;
  }

  document.getElementById('cardio-card').hidden = true;
  document.getElementById('strength-log-card').hidden = false;

  const suggestion = Workout.suggestNext(currentExercise);
  const suggestionCard = document.getElementById('suggestion-card');
  suggestionCard.hidden = false;
  document.getElementById('suggestion-text').textContent = suggestion.note;
  document.getElementById('suggestion-weight').textContent =
    suggestion.weight === null ? '自重' : `${suggestion.weight} kg`;
  document.getElementById('suggestion-reps').textContent = `${suggestion.targetReps} 回`;
  document.getElementById('suggestion-sets').textContent = `${suggestion.sets} セット`;

  currentSets = Array.from({ length: suggestion.sets }, () => ({
    weight: suggestion.weight === null ? '' : suggestion.weight,
    reps: suggestion.targetReps,
    rpe: '',
  }));
  renderSetRows();
  renderExerciseHistory();
  renderExerciseChart();
}

function renderExerciseChart() {
  const canvas = document.getElementById('exercise-chart');
  const titleEl = document.getElementById('exercise-chart-title');
  if (!currentExercise) {
    drawLineChart(canvas, []);
    return;
  }
  const history = Storage.historyFor(currentExercise.id);
  if (currentExercise.type === 'cardio') {
    titleEl.textContent = '消費カロリー推移';
    const points = history.map((session) => ({
      label: session.date.slice(5),
      value: Math.round(session.cardio.calories),
    }));
    drawLineChart(canvas, points);
    return;
  }
  titleEl.textContent = '重量推移';
  const points = history.map((session) => ({
    label: session.date.slice(5),
    value: Math.max(...session.sets.map((s) => s.weight)),
  }));
  drawLineChart(canvas, points);
}

function renderSetRows() {
  const container = document.getElementById('set-rows');
  container.innerHTML = currentSets
    .map(
      (set, i) => `
    <div class="set-row" data-index="${i}">
      <span>${i + 1}</span>
      <input type="number" class="set-weight" placeholder="重量kg" step="0.5" value="${set.weight}" />
      <input type="number" class="set-reps" placeholder="回数" value="${set.reps}" />
      <input type="number" class="set-rpe" placeholder="RPE" min="1" max="10" value="${set.rpe}" />
    </div>`
    )
    .join('');

  container.querySelectorAll('.set-row').forEach((row) => {
    const i = Number(row.dataset.index);
    row.querySelector('.set-weight').addEventListener('input', (e) => {
      currentSets[i].weight = e.target.value === '' ? '' : Number(e.target.value);
    });
    row.querySelector('.set-reps').addEventListener('input', (e) => {
      currentSets[i].reps = e.target.value === '' ? '' : Number(e.target.value);
    });
    row.querySelector('.set-rpe').addEventListener('input', (e) => {
      currentSets[i].rpe = e.target.value === '' ? '' : Number(e.target.value);
    });
  });
}

function renderExerciseHistory() {
  if (!currentExercise) return;
  const container = document.getElementById('exercise-history');
  const history = Storage.historyFor(currentExercise.id).slice(-5).reverse();
  if (!history.length) {
    container.innerHTML = '<p class="empty-hint">まだ記録がありません。</p>';
    return;
  }

  if (currentExercise.type === 'cardio') {
    container.innerHTML = history
      .map(
        (session) => `
      <div class="history-entry" data-id="${session.id}">
        <div class="row-between">
          <div class="history-date">
            <strong>${formatDateLabel(session.date)}</strong>
            <span class="muted">${Math.round(session.cardio.calories)}kcal</span>
          </div>
          <div class="history-actions">
            <button class="btn-secondary btn-sm" data-action="edit">編集</button>
            <button class="btn-danger btn-sm" data-action="delete">削除</button>
          </div>
        </div>
        <div class="set-pills">
          <span class="set-pill">${session.cardio.durationMin}分</span>
          <span class="set-pill">${session.cardio.speedKmh}km/h</span>
          <span class="set-pill">傾斜${session.cardio.inclinePercent}%</span>
        </div>
      </div>`
      )
      .join('');
    return;
  }

  container.innerHTML = history
    .map((session) => {
      const maxWeight = Math.max(...session.sets.map((s) => s.weight));
      const setsHtml = session.sets
        .map(
          (s) =>
            `<span class="set-pill">${s.weight}kg × ${s.reps}回${
              s.rpe ? `<span class="pill-rpe">RPE${s.rpe}</span>` : ''
            }</span>`
        )
        .join('');
      return `
      <div class="history-entry" data-id="${session.id}">
        <div class="row-between">
          <div class="history-date">
            <strong>${formatDateLabel(session.date)}</strong>
            <span class="muted">最大${maxWeight}kg</span>
          </div>
          <div class="history-actions">
            <button class="btn-secondary btn-sm" data-action="edit">編集</button>
            <button class="btn-danger btn-sm" data-action="delete">削除</button>
          </div>
        </div>
        <div class="set-pills">${setsHtml}</div>
      </div>`;
    })
    .join('');
}

function startEditSession(sessionId) {
  const session = Storage.getWorkoutLog().find((s) => s.id === sessionId);
  if (!session) return;
  editingSessionId = session.id;
  currentSets = session.sets.map((s) => ({
    weight: s.weight,
    reps: s.reps,
    rpe: s.rpe === null || s.rpe === undefined ? '' : s.rpe,
  }));
  renderSetRows();
  document.getElementById('btn-save-session').textContent = '更新する';
  document.getElementById('btn-cancel-edit-session').hidden = false;
  const hint = document.getElementById('edit-session-hint');
  hint.hidden = false;
  hint.textContent = `${formatDateLabel(session.date)} の記録を編集中です。`;
}

function startEditCardio(sessionId) {
  const session = Storage.getWorkoutLog().find((s) => s.id === sessionId);
  if (!session || !session.cardio) return;
  editingSessionId = session.id;
  document.getElementById('cardio-duration').value = session.cardio.durationMin;
  document.getElementById('cardio-speed').value = session.cardio.speedKmh;
  document.getElementById('cardio-incline').value = session.cardio.inclinePercent;
  updateCardioCalories();
  document.getElementById('btn-save-cardio').textContent = '更新する';
  document.getElementById('btn-cancel-edit-cardio').hidden = false;
  const hint = document.getElementById('cardio-edit-hint');
  hint.hidden = false;
  hint.textContent = `${formatDateLabel(session.date)} の記録を編集中です。`;
}

function cancelEditSession() {
  editingSessionId = null;
  document.getElementById('btn-save-session').textContent = 'この内容を保存';
  document.getElementById('btn-cancel-edit-session').hidden = true;
  document.getElementById('edit-session-hint').hidden = true;
  document.getElementById('btn-save-cardio').textContent = 'この内容を保存';
  document.getElementById('btn-cancel-edit-cardio').hidden = true;
  document.getElementById('cardio-edit-hint').hidden = true;
}

function deleteSession(sessionId) {
  if (!confirm('この記録を削除しますか?この操作は取り消せません。')) return;
  Storage.deleteWorkoutSession(sessionId);
  if (editingSessionId === sessionId) cancelEditSession();
  renderExerciseHistory();
  renderExerciseChart();
}

function openExerciseForm(mode, exercise) {
  editingExerciseId = mode === 'edit' && exercise ? exercise.id : null;
  document.getElementById('exercise-form-title').textContent =
    mode === 'edit' ? '種目を編集' : '種目を追加';
  document.getElementById('ex-name').value = mode === 'edit' ? exercise.name : '';
  document.getElementById('ex-category').value = mode === 'edit' ? exercise.category : '';
  document.getElementById('ex-type').value =
    mode === 'edit'
      ? exercise.type === 'cardio'
        ? `cardio_${exercise.cardioMode}`
        : exercise.type
      : 'barbell';
  document.getElementById('ex-rep-min').value = mode === 'edit' ? exercise.repMin : 8;
  document.getElementById('ex-rep-max').value = mode === 'edit' ? exercise.repMax : 12;
  document.getElementById('ex-target-sets').value = mode === 'edit' ? exercise.targetSets || 3 : 3;
  document.getElementById('ex-day').value = mode === 'edit' && exercise.day ? exercise.day : '';
  document.getElementById('btn-delete-exercise').hidden = mode !== 'edit';
  document.getElementById('exercise-form-card').hidden = false;
}

function closeExerciseForm() {
  editingExerciseId = null;
  document.getElementById('exercise-form-card').hidden = true;
}

function saveExerciseForm() {
  const name = document.getElementById('ex-name').value.trim();
  if (!name) {
    alert('種目名を入力してください。');
    return;
  }
  const dayValue = document.getElementById('ex-day').value;
  const typeValue = document.getElementById('ex-type').value;
  const isCardio = typeValue === 'cardio_walk' || typeValue === 'cardio_run';
  const fields = {
    name,
    category: document.getElementById('ex-category').value.trim() || 'その他',
    type: isCardio ? 'cardio' : typeValue,
    cardioMode: isCardio ? typeValue.replace('cardio_', '') : undefined,
    repMin: Number(document.getElementById('ex-rep-min').value) || 8,
    repMax: Number(document.getElementById('ex-rep-max').value) || 12,
    targetSets: Number(document.getElementById('ex-target-sets').value) || 3,
    day: isCardio ? undefined : dayValue || undefined,
  };

  let targetId;
  if (editingExerciseId) {
    Storage.updateExercise(editingExerciseId, fields);
    targetId = editingExerciseId;
  } else {
    targetId = `custom_${Date.now()}`;
    Storage.addExercise({ id: targetId, ...fields });
  }
  closeExerciseForm();
  populateExerciseSelect();
  populateCategorySelect('workout-menu-category-select');
  renderWorkoutMenu();
  document.getElementById('exercise-select').value = targetId;
  onExerciseChange(targetId);
}

function deleteExerciseForm() {
  if (!editingExerciseId) return;
  if (!confirm('この種目を削除しますか?この操作は取り消せません。')) return;
  Storage.deleteExercise(editingExerciseId);
  closeExerciseForm();
  populateExerciseSelect();
  populateCategorySelect('workout-menu-category-select');
  renderWorkoutMenu();
}

function saveSession() {
  if (!currentExercise) return;
  const sets = currentSets.filter((s) => s.weight !== '' && s.reps !== '');
  if (!sets.length) {
    alert('少なくとも1セットは重量と回数を入力してください。');
    return;
  }
  const cleanSets = sets.map((s) => ({ weight: s.weight, reps: s.reps, rpe: s.rpe === '' ? null : s.rpe }));

  if (editingSessionId) {
    Storage.updateWorkoutSession(editingSessionId, { sets: cleanSets });
  } else {
    Storage.addWorkoutSession({
      id: `session_${Date.now()}`,
      date: todayDateStr(),
      exerciseId: currentExercise.id,
      sets: cleanSets,
    });
  }
  onExerciseChange(currentExercise.id);
}

function saveCardio() {
  if (!currentExercise || currentExercise.type !== 'cardio') return;
  const durationMin = Number(document.getElementById('cardio-duration').value);
  const speedKmh = Number(document.getElementById('cardio-speed').value);
  const inclinePercent = Number(document.getElementById('cardio-incline').value) || 0;
  if (!durationMin || !speedKmh) {
    alert('時間と速度を入力してください。');
    return;
  }
  const met = Cardio.metFor(currentExercise.cardioMode, speedKmh, inclinePercent);
  const calories = met * getUserWeightKg() * (durationMin / 60);
  const cardio = {
    durationMin,
    speedKmh,
    inclinePercent,
    met: Math.round(met * 10) / 10,
    calories: Math.round(calories),
  };

  if (editingSessionId) {
    Storage.updateWorkoutSession(editingSessionId, { cardio });
  } else {
    Storage.addWorkoutSession({
      id: `session_${Date.now()}`,
      date: todayDateStr(),
      exerciseId: currentExercise.id,
      cardio,
    });
  }
  onExerciseChange(currentExercise.id);
}

function saveWeight() {
  const date = document.getElementById('weight-date').value;
  const value = Number(document.getElementById('weight-value').value);
  if (!date || !value) {
    alert('日付と体重を入力してください。');
    return;
  }
  Storage.addWeightEntry({ date, weightKg: value });

  const profile = Storage.getProfile();
  if (profile) {
    profile.weightKg = value;
    Storage.saveProfile(profile);
  }

  renderWeightChart();
  renderWeightHistory();
  renderBmrCard();
  renderHome();
}

function renderBmrCard() {
  const profile = Storage.getProfile();
  const emptyHint = document.getElementById('bmr-empty-hint');
  const result = document.getElementById('bmr-result');
  if (!profile) {
    emptyHint.hidden = false;
    result.hidden = true;
    return;
  }
  const summary = Calorie.summarize(profile);
  emptyHint.hidden = true;
  result.hidden = false;
  document.getElementById('bmr-value').textContent = `${summary.bmr} kcal`;
  document.getElementById('bmr-tdee-value').textContent = `${summary.tdee} kcal`;
}

function renderWeightChart() {
  const canvas = document.getElementById('weight-chart');
  const log = Storage.getWeightLog();
  const points = log.map((e) => ({ label: e.date.slice(5), value: e.weightKg }));
  drawLineChart(canvas, points);
}

function renderWeightHistory() {
  const container = document.getElementById('weight-history');
  const log = Storage.getWeightLog().slice().reverse();
  if (!log.length) {
    container.innerHTML = '<p class="empty-hint">まだ記録がありません。</p>';
    return;
  }
  container.innerHTML = log
    .map(
      (entry) => `
      <div class="history-entry" data-date="${entry.date}">
        <div class="row-between">
          <div class="history-date">
            <strong>${entry.weightKg}kg</strong>
            <span class="muted">${formatDateLabel(entry.date)}</span>
          </div>
          <div class="history-actions">
            <button class="btn-secondary btn-sm" data-action="edit">編集</button>
            <button class="btn-danger btn-sm" data-action="delete">削除</button>
          </div>
        </div>
      </div>`
    )
    .join('');
}

function editWeightEntry(date) {
  const entry = Storage.getWeightLog().find((e) => e.date === date);
  if (!entry) return;
  document.getElementById('weight-date').value = entry.date;
  document.getElementById('weight-value').value = entry.weightKg;
  document.getElementById('weight-value').focus();
}

function deleteWeightEntry(date) {
  if (!confirm('この体重記録を削除しますか?この操作は取り消せません。')) return;
  Storage.deleteWeightEntry(date);
  renderWeightChart();
  renderWeightHistory();
  renderBmrCard();
  renderHome();
}

function populateCalorieOptions() {
  const activitySelect = document.getElementById('p-activity');
  activitySelect.innerHTML = Object.entries(ACTIVITY_FACTORS)
    .map(([key, v]) => `<option value="${key}">${v.label}</option>`)
    .join('');

  const goalSelect = document.getElementById('p-goal');
  goalSelect.innerHTML = Object.entries(GOAL_ADJUST)
    .map(([key, v]) => `<option value="${key}">${v.label}</option>`)
    .join('');

  const profile = Storage.getProfile();
  if (profile) {
    document.getElementById('p-gender').value = profile.gender;
    document.getElementById('p-age').value = profile.age;
    document.getElementById('p-height').value = profile.heightCm;
    document.getElementById('p-weight').value = profile.weightKg;
    document.getElementById('p-activity').value = profile.activityLevel;
    document.getElementById('p-goal').value = profile.goal;
    renderCalorieResult(profile);
  }
}

function saveProfile() {
  const profile = {
    gender: document.getElementById('p-gender').value,
    age: Number(document.getElementById('p-age').value),
    heightCm: Number(document.getElementById('p-height').value),
    weightKg: Number(document.getElementById('p-weight').value),
    activityLevel: document.getElementById('p-activity').value,
    goal: document.getElementById('p-goal').value,
  };
  if (!profile.age || !profile.heightCm || !profile.weightKg) {
    alert('年齢・身長・体重を入力してください。');
    return;
  }
  Storage.saveProfile(profile);
  renderCalorieResult(profile);
  renderBmrCard();
  renderHome();
}

function renderCalorieResult(profile) {
  const summary = Calorie.summarize(profile);
  document.getElementById('calorie-result').hidden = false;
  document.getElementById('r-bmi').textContent = summary.bmi;
  document.getElementById('r-bmr').textContent = `${summary.bmr} kcal`;
  document.getElementById('r-tdee').textContent = `${summary.tdee} kcal`;
  document.getElementById('r-target').textContent = `${summary.target} kcal`;
  document.getElementById('r-protein').textContent = `${summary.macros.protein} g`;
  document.getElementById('r-fat').textContent = `${summary.macros.fat} g`;
  document.getElementById('r-carb').textContent = `${summary.macros.carb} g`;
}

function exportData() {
  const data = Storage.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `training-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      Storage.importAll(data);
      alert('インポートしました。');
      location.reload();
    } catch {
      alert('ファイルの読み込みに失敗しました。');
    }
  };
  reader.readAsText(file);
}

function setupEventListeners() {
  document.getElementById('btn-cal-prev').addEventListener('click', () => {
    calendarMonth -= 1;
    if (calendarMonth < 0) {
      calendarMonth = 11;
      calendarYear -= 1;
    }
    renderCalendar();
  });
  document.getElementById('btn-cal-next').addEventListener('click', () => {
    calendarMonth += 1;
    if (calendarMonth > 11) {
      calendarMonth = 0;
      calendarYear += 1;
    }
    renderCalendar();
  });

  document.getElementById('workout-menu-day-select').addEventListener('change', () => {
    document.getElementById('workout-menu-category-select').value = '';
    renderWorkoutMenu();
  });
  document.getElementById('workout-menu-category-select').addEventListener('change', () => {
    document.getElementById('workout-menu-day-select').value = '';
    renderWorkoutMenu();
  });
  document.getElementById('btn-save-day-workout').addEventListener('click', () => {
    const dayKey = document.getElementById('btn-save-day-workout').dataset.day;
    if (dayKey) bulkLogDay(dayKey);
  });

  document.getElementById('exercise-select').addEventListener('change', (e) => onExerciseChange(e.target.value));
  document.getElementById('btn-add-exercise').addEventListener('click', () => openExerciseForm('add'));
  document.getElementById('btn-edit-exercise').addEventListener('click', () => {
    if (!currentExercise) return;
    openExerciseForm('edit', currentExercise);
  });
  document.getElementById('btn-save-exercise').addEventListener('click', saveExerciseForm);
  document.getElementById('btn-cancel-exercise').addEventListener('click', closeExerciseForm);
  document.getElementById('btn-delete-exercise').addEventListener('click', deleteExerciseForm);

  document.getElementById('btn-add-set').addEventListener('click', () => {
    const last = currentSets[currentSets.length - 1] || { weight: '', reps: '', rpe: '' };
    currentSets.push({ ...last });
    renderSetRows();
  });
  document.getElementById('btn-save-session').addEventListener('click', saveSession);
  document.getElementById('btn-cancel-edit-session').addEventListener('click', () => {
    cancelEditSession();
    onExerciseChange(currentExercise.id);
  });

  ['cardio-duration', 'cardio-speed', 'cardio-incline'].forEach((id) => {
    document.getElementById(id).addEventListener('input', updateCardioCalories);
  });
  document.getElementById('btn-save-cardio').addEventListener('click', saveCardio);
  document.getElementById('btn-cancel-edit-cardio').addEventListener('click', () => {
    cancelEditSession();
    onExerciseChange(currentExercise.id);
  });

  document.getElementById('exercise-history').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const entry = e.target.closest('.history-entry');
    const id = entry.dataset.id;
    if (btn.dataset.action === 'edit') {
      if (currentExercise && currentExercise.type === 'cardio') startEditCardio(id);
      else startEditSession(id);
    }
    if (btn.dataset.action === 'delete') deleteSession(id);
  });

  document.getElementById('weight-history').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const entry = e.target.closest('.history-entry');
    const date = entry.dataset.date;
    if (btn.dataset.action === 'edit') editWeightEntry(date);
    if (btn.dataset.action === 'delete') deleteWeightEntry(date);
  });

  document.getElementById('weight-date').valueAsDate = new Date();
  document.getElementById('btn-save-weight').addEventListener('click', saveWeight);

  document.getElementById('btn-save-profile').addEventListener('click', saveProfile);

  document.getElementById('btn-export').addEventListener('click', exportData);
  document.getElementById('import-file').addEventListener('change', (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
  });
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm('本当に全データを削除しますか?この操作は取り消せません。')) {
      Storage.resetAll();
      location.reload();
    }
  });
}

function init() {
  setupNav();
  setupEventListeners();
  populateExerciseSelect();
  populateCalorieOptions();
  populateCategorySelect('workout-menu-category-select');
  document.getElementById('workout-menu-day-select').value = routineDayForWeekday(new Date().getDay()) || '';
  renderWorkoutMenu();
  initCalendarState();
  renderHome();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
    navigator.serviceWorker
      .register('service-worker.js')
      .then((reg) => reg.update())
      .catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
