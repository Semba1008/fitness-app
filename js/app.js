let currentSets = [];
let currentExercise = null;
let editingSessionId = null;
let editingExerciseId = null;
let editingRoutineId = null;
let editingWeightDate = null;
let calendarYear = null;
let calendarMonth = null;
let calendarSelectedDate = null;

function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function todayDateStr() {
  return toDateStr(new Date());
}

function jumpToExercise(exerciseId) {
  document.getElementById('exercise-select').value = exerciseId;
  onExerciseChange(exerciseId);
  document.getElementById('exercise-log-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function historyForCurrentType(exercise) {
  const history = Storage.historyFor(exercise.id);
  return exercise.type === 'cardio'
    ? history.filter((s) => !!s.cardio)
    : history.filter((s) => Array.isArray(s.sets));
}

function sessionMaxWeight(session) {
  return Math.max(...session.sets.map((s) => s.weight));
}

let toastTimer = null;

function showToast(message) {
  if (navigator.vibrate) navigator.vibrate(30);
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.hidden = true;
    }, 200);
  }, 1400);
}

function switchView(viewId, title) {
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === viewId));
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === viewId));
  document.getElementById('page-title').textContent = title;
  if (viewId === 'view-home') renderHome();
  if (viewId === 'view-workout') {
    renderWorkoutMenu();
    renderMyRoutines();
    renderExerciseHistory();
    renderExerciseChart();
    renderWorkoutDayLog();
  }
  if (viewId === 'view-weight') {
    renderWeightChart();
    renderWeightHistory();
    populateCalorieOptions();
    renderWeightForecast();
  }
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
    const summary = Calorie.summarize(getCalorieProfile());
    card.innerHTML = `
      <h2>今日の目標カロリー</h2>
      <div class="row-between">
        <span>${summary.target} kcal</span>
        <button class="btn-secondary" data-goto="view-weight">詳細</button>
      </div>`;
    card.querySelector('[data-goto]').addEventListener('click', () => switchView('view-weight', '体重'));
  } else {
    card.innerHTML = `
      <h2>今日の目標カロリー</h2>
      <p class="empty-hint">プロフィールが未設定です。「体重」タブで設定してください。</p>`;
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
        <span class="muted">${ex.type === 'cardio' ? '有酸素運動' : `${ex.targetSets || 3}セット×${repRangeText(ex)}`}</span>
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
    const dateStr = toDateStr(new Date(calendarYear, calendarMonth, day));
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
        <p class="ai-eval">${exercise ? evaluateSession(exercise, session) : ''}</p>
      </div>`;
    })
    .join('');
}

function renderWorkoutMenu() {
  const title = document.getElementById('workout-menu-title');
  const saveDayBtn = document.getElementById('btn-save-day-workout');
  const categoryValue = document.getElementById('workout-menu-category-select').value;
  const dayKey = document.getElementById('workout-menu-day-select').value;
  const selectHere = (exerciseId) => jumpToExercise(exerciseId);

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

function logExercisesWithSuggestions(exercises) {
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
}

function bulkLogDay(dayKey) {
  const dayInfo = ROUTINE_DAYS[dayKey];
  const exercises = Storage.getExercises().filter((ex) => ex.day === dayKey && ex.type !== 'cardio');
  if (!exercises.length) return;

  logExercisesWithSuggestions(exercises);
  showToast(`${dayInfo.label}の記録をまとめて保存しました`);
  renderWorkoutMenu();
  renderExerciseHistory();
  renderExerciseChart();
  renderWorkoutDayLog();
}

function renderMyRoutines() {
  const list = document.getElementById('my-routines-list');
  const routines = Storage.getRoutines();
  if (!routines.length) {
    list.innerHTML = '<p class="empty-hint">まだメニューがありません。「+ 新しいメニューを追加」から作成できます。</p>';
    return;
  }
  const exercises = Storage.getExercises();
  list.innerHTML = routines
    .map((routine) => {
      const items = routine.exerciseIds.map((id) => exercises.find((ex) => ex.id === id)).filter(Boolean);
      const pills = items
        .map((ex) => `<span class="set-pill set-pill--clickable" data-exercise-id="${ex.id}">${ex.name}</span>`)
        .join('');
      const logAllButton = items.length
        ? `<button type="button" class="btn-primary btn-sm" data-action="log-all">まとめて記録</button>`
        : `<p class="empty-hint">登録されていた種目がすべて削除されました。編集して種目を選び直してください。</p>`;
      return `
      <div class="history-entry" data-id="${routine.id}">
        <div class="row-between">
          <div class="history-date">
            <strong>${routine.name}</strong>
            <span class="muted">${items.length}種目</span>
          </div>
          <div class="history-actions">
            <button class="btn-secondary btn-sm" data-action="edit">編集</button>
            <button class="btn-danger btn-sm" data-action="delete">削除</button>
          </div>
        </div>
        <div class="set-pills">${pills}</div>
        ${logAllButton}
      </div>`;
    })
    .join('');
}

function populateRoutineChecklist(selectedIds) {
  const container = document.getElementById('routine-exercise-checklist');
  const exercises = Storage.getExercises().filter((ex) => ex.type !== 'cardio');
  container.innerHTML = exercises
    .map(
      (ex) => `
      <label class="checklist-item">
        <input type="checkbox" value="${ex.id}" ${selectedIds.includes(ex.id) ? 'checked' : ''} />
        ${ex.name}(${ex.category})
      </label>`
    )
    .join('');
}

function openRoutineForm(mode, routineId) {
  const routine = mode === 'edit' ? Storage.getRoutines().find((r) => r.id === routineId) : null;
  editingRoutineId = mode === 'edit' && routine ? routine.id : null;
  document.getElementById('routine-form-title').textContent = mode === 'edit' ? 'メニューを編集' : 'メニューを追加';
  document.getElementById('routine-name').value = mode === 'edit' && routine ? routine.name : '';
  populateRoutineChecklist(mode === 'edit' && routine ? routine.exerciseIds : []);
  document.getElementById('btn-delete-routine').hidden = mode !== 'edit';
  document.getElementById('routine-form-card').hidden = false;
}

function closeRoutineForm() {
  editingRoutineId = null;
  document.getElementById('routine-form-card').hidden = true;
}

function saveRoutineForm() {
  const name = document.getElementById('routine-name').value.trim();
  if (!name) {
    alert('メニュー名を入力してください。');
    return;
  }
  const exerciseIds = Array.from(document.querySelectorAll('#routine-exercise-checklist input:checked')).map(
    (el) => el.value
  );
  if (!exerciseIds.length) {
    alert('種目を1つ以上選んでください。');
    return;
  }
  if (editingRoutineId) {
    Storage.updateRoutine(editingRoutineId, { name, exerciseIds });
  } else {
    Storage.addRoutine({ id: `routine_${Date.now()}`, name, exerciseIds });
  }
  closeRoutineForm();
  showToast('メニューを保存しました');
  renderMyRoutines();
}

function deleteRoutine(routineId) {
  Storage.deleteRoutine(routineId);
  if (editingRoutineId === routineId) closeRoutineForm();
  showToast('メニューを削除しました');
  renderMyRoutines();
}

function deleteRoutineForm() {
  if (!editingRoutineId) return;
  deleteRoutine(editingRoutineId);
}

function logRoutine(routineId) {
  const routine = Storage.getRoutines().find((r) => r.id === routineId);
  if (!routine) return;
  const exercises = Storage.getExercises().filter(
    (ex) => routine.exerciseIds.includes(ex.id) && ex.type !== 'cardio'
  );
  if (!exercises.length) return;
  logExercisesWithSuggestions(exercises);
  showToast(`${routine.name}をまとめて記録しました`);
  renderExerciseHistory();
  renderExerciseChart();
  renderWorkoutDayLog();
}

function populateExerciseSelect(preferredId) {
  const select = document.getElementById('exercise-select');
  const exercises = Storage.getExercises();
  const categories = [...new Set(exercises.map((ex) => ex.category))];
  select.innerHTML = categories
    .map((category) => {
      const options = exercises
        .filter((ex) => ex.category === category)
        .map((ex) => `<option value="${ex.id}">${ex.name}</option>`)
        .join('');
      return `<optgroup label="${category}">${options}</optgroup>`;
    })
    .join('');
  if (exercises.length) {
    const targetId = preferredId && exercises.some((ex) => ex.id === preferredId) ? preferredId : exercises[0].id;
    select.value = targetId;
    onExerciseChange(targetId);
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
  const log = Storage.getWeightLog();
  if (log.length) return log[log.length - 1].weightKg;
  const profile = Storage.getProfile();
  if (profile && profile.weightKg) return profile.weightKg;
  return 60;
}

function getCalorieProfile() {
  const profile = Storage.getProfile();
  if (!profile) return null;
  return { ...profile, weightKg: getUserWeightKg() };
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

    const cardioHistory = historyForCurrentType(currentExercise);
    const last = cardioHistory.length ? cardioHistory[cardioHistory.length - 1] : null;
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
  const history = historyForCurrentType(currentExercise);
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
    value: sessionMaxWeight(session),
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

function evaluateStrengthSession(exercise, session, priorSessions) {
  if (!priorSessions.length) return '初回の記録です。';
  const maxWeight = sessionMaxWeight(session);
  const allHitMin = session.sets.every((s) => s.reps >= exercise.repMin);
  const bestPrevWeight = Math.max(...priorSessions.map(sessionMaxWeight));
  if (maxWeight > bestPrevWeight) return '自己ベストを更新しました。';
  if (!allHitMin) return '目標回数に届かないセットがありました。';
  if (maxWeight === bestPrevWeight) return '自己ベストの重量を維持できています。';
  return '安定した内容です。';
}

function evaluateCardioSession(session, priorSessions) {
  if (!priorSessions.length) return '初回の記録です。';
  const avgPrevCalories = priorSessions.reduce((sum, s) => sum + s.cardio.calories, 0) / priorSessions.length;
  if (session.cardio.calories > avgPrevCalories * 1.1) return 'いつもより消費カロリーが多く、良いペースです。';
  if (session.cardio.calories < avgPrevCalories * 0.9) return 'いつもより消費カロリーが少なめでした。';
  return 'いつも通りの安定したペースです。';
}

function evaluateSession(exercise, session) {
  const fullHistory = historyForCurrentType(exercise);
  const idx = fullHistory.findIndex((s) => s.id === session.id);
  const priorSessions = idx > 0 ? fullHistory.slice(0, idx) : [];
  return session.cardio
    ? evaluateCardioSession(session, priorSessions)
    : evaluateStrengthSession(exercise, session, priorSessions);
}

function renderExerciseHistory() {
  if (!currentExercise) return;
  const container = document.getElementById('exercise-history');
  const history = historyForCurrentType(currentExercise).slice(-5).reverse();
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
        <p class="ai-eval">${evaluateSession(currentExercise, session)}</p>
      </div>`
      )
      .join('');
    return;
  }

  container.innerHTML = history
    .map((session) => {
      const maxWeight = sessionMaxWeight(session);
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
        <p class="ai-eval">${evaluateSession(currentExercise, session)}</p>
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
  showToast('削除しました');
  renderExerciseHistory();
  renderExerciseChart();
  renderWorkoutDayLog();
}

function renderWorkoutDayLog() {
  const dateInput = document.getElementById('workout-log-date');
  const list = document.getElementById('workout-log-list');
  const dateStr = dateInput.value;
  const sessions = Storage.getWorkoutLog().filter((s) => s.date === dateStr);
  if (!sessions.length) {
    list.innerHTML = '<p class="empty-hint">この日の記録はありません。</p>';
    return;
  }
  const exercises = Storage.getExercises();
  list.innerHTML = sessions
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
      <div class="history-entry" data-id="${session.id}">
        <div class="row-between">
          <div class="history-date">
            <strong>${name}</strong>
            <span class="muted">${badge}</span>
          </div>
          <div class="history-actions">
            <button class="btn-secondary btn-sm" data-action="edit">編集</button>
            <button class="btn-danger btn-sm" data-action="delete">削除</button>
          </div>
        </div>
        <div class="set-pills">${pillsHtml}</div>
        <p class="ai-eval">${exercise ? evaluateSession(exercise, session) : ''}</p>
      </div>`;
    })
    .join('');
}

function editWorkoutDaySession(sessionId) {
  const session = Storage.getWorkoutLog().find((s) => s.id === sessionId);
  if (!session) return;
  document.getElementById('exercise-select').value = session.exerciseId;
  onExerciseChange(session.exerciseId);
  if (session.cardio) startEditCardio(sessionId);
  else startEditSession(sessionId);
}

function deleteWorkoutDaySession(sessionId) {
  Storage.deleteWorkoutSession(sessionId);
  if (editingSessionId === sessionId) cancelEditSession();
  showToast('削除しました');
  renderWorkoutDayLog();
  if (currentExercise) {
    renderExerciseHistory();
    renderExerciseChart();
  }
}

function openExerciseForm(mode, exerciseId) {
  const exercise = mode === 'edit' ? Storage.getExercises().find((ex) => ex.id === exerciseId) : null;
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
    repMin: isCardio ? undefined : Number(document.getElementById('ex-rep-min').value) || 8,
    repMax: isCardio ? undefined : Number(document.getElementById('ex-rep-max').value) || 12,
    targetSets: isCardio ? undefined : Number(document.getElementById('ex-target-sets').value) || 3,
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
  showToast('種目を保存しました');
  populateExerciseSelect(targetId);
  populateCategorySelect('workout-menu-category-select');
  renderWorkoutMenu();
  renderMyRoutines();
}

function deleteExerciseForm() {
  if (!editingExerciseId) return;
  if (!confirm('この種目を削除しますか?この操作は取り消せません。')) return;
  Storage.deleteExercise(editingExerciseId);
  closeExerciseForm();
  showToast('種目を削除しました');
  populateExerciseSelect();
  populateCategorySelect('workout-menu-category-select');
  renderWorkoutMenu();
  renderMyRoutines();
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
    showToast('更新しました');
  } else {
    Storage.addWorkoutSession({
      id: `session_${Date.now()}`,
      date: todayDateStr(),
      exerciseId: currentExercise.id,
      sets: cleanSets,
    });
    showToast('記録しました');
  }
  onExerciseChange(currentExercise.id);
  renderWorkoutDayLog();
}

function saveCardio() {
  if (!currentExercise || currentExercise.type !== 'cardio') return;
  const durationMin = Number(document.getElementById('cardio-duration').value);
  const speedKmh = Number(document.getElementById('cardio-speed').value);
  const inclinePercent = Number(document.getElementById('cardio-incline').value) || 0;
  if (!durationMin || durationMin < 0 || !speedKmh || speedKmh < 0) {
    alert('時間と速度を正しく入力してください。');
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
    showToast('更新しました');
  } else {
    Storage.addWorkoutSession({
      id: `session_${Date.now()}`,
      date: todayDateStr(),
      exerciseId: currentExercise.id,
      cardio,
    });
    showToast('記録しました');
  }
  onExerciseChange(currentExercise.id);
  renderWorkoutDayLog();
}

function saveWeight() {
  const date = document.getElementById('weight-date').value;
  const value = Number(document.getElementById('weight-value').value);
  if (!date || !value) {
    alert('日付と体重を入力してください。');
    return;
  }
  if (editingWeightDate && editingWeightDate !== date) {
    Storage.deleteWeightEntry(editingWeightDate);
  }
  Storage.addWeightEntry({ date, weightKg: value });

  const profile = Storage.getProfile();
  if (profile) {
    profile.weightKg = value;
    Storage.saveProfile(profile);
  }

  showToast(editingWeightDate ? '更新しました' : '記録しました');
  cancelEditWeight();
  renderWeightChart();
  renderWeightHistory();
  populateCalorieOptions();
  renderWeightForecast();
  renderHome();
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
  editingWeightDate = entry.date;
  document.getElementById('weight-date').value = entry.date;
  document.getElementById('weight-value').value = entry.weightKg;
  document.getElementById('weight-value').focus();
  document.getElementById('btn-save-weight').textContent = '更新する';
  document.getElementById('btn-cancel-edit-weight').hidden = false;
  const hint = document.getElementById('weight-edit-hint');
  hint.hidden = false;
  hint.textContent = `${formatDateLabel(entry.date)} の記録を編集中です。`;
}

function cancelEditWeight() {
  editingWeightDate = null;
  document.getElementById('btn-save-weight').textContent = '保存';
  document.getElementById('btn-cancel-edit-weight').hidden = true;
  document.getElementById('weight-edit-hint').hidden = true;
  document.getElementById('weight-date').valueAsDate = new Date();
  document.getElementById('weight-value').value = '';
}

function deleteWeightEntry(date) {
  if (!confirm('この体重記録を削除しますか?この操作は取り消せません。')) return;
  Storage.deleteWeightEntry(date);
  if (editingWeightDate === date) cancelEditWeight();
  showToast('削除しました');
  renderWeightChart();
  renderWeightHistory();
  populateCalorieOptions();
  renderWeightForecast();
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
    document.getElementById('p-activity').value = profile.activityLevel;
    document.getElementById('p-goal').value = profile.goal;
    renderCalorieResult();
  } else {
    document.getElementById('calorie-empty-hint').hidden = false;
    document.getElementById('calorie-fallback-hint').hidden = true;
    document.getElementById('calorie-result').hidden = true;
  }
}

function saveProfile() {
  const profile = {
    gender: document.getElementById('p-gender').value,
    age: Number(document.getElementById('p-age').value),
    heightCm: Number(document.getElementById('p-height').value),
    weightKg: getUserWeightKg(),
    activityLevel: document.getElementById('p-activity').value,
    goal: document.getElementById('p-goal').value,
  };
  if (!profile.age || !profile.heightCm) {
    alert('年齢・身長を入力してください。');
    return;
  }
  Storage.saveProfile(profile);
  showToast('プロフィールを保存しました');
  renderCalorieResult();
  renderWeightForecast();
  renderHome();
}

function renderCalorieResult() {
  const summary = Calorie.summarize(getCalorieProfile());
  document.getElementById('calorie-empty-hint').hidden = true;
  document.getElementById('calorie-fallback-hint').hidden = Storage.getWeightLog().length > 0;
  document.getElementById('calorie-result').hidden = false;
  document.getElementById('r-bmi').textContent = summary.bmi;
  document.getElementById('r-bmr').textContent = `${summary.bmr} kcal`;
  document.getElementById('r-tdee').textContent = `${summary.tdee} kcal`;
  document.getElementById('r-target').textContent = `${summary.target} kcal`;
  document.getElementById('r-protein').textContent = `${summary.macros.protein} g`;
  document.getElementById('r-fat').textContent = `${summary.macros.fat} g`;
  document.getElementById('r-carb').textContent = `${summary.macros.carb} g`;
}

function daysBetween(dateA, dateB) {
  return Math.round((new Date(dateB) - new Date(dateA)) / 86400000);
}

function computeWeightTrend(minPoints = 3) {
  const log = Storage.getWeightLog();
  if (log.length < minPoints) return null;
  const firstDate = log[0].date;
  const points = log.map((e) => ({ x: daysBetween(firstDate, e.date), y: e.weightKg }));
  const model = Stats.linearRegression(points);
  return { model, lastX: points[points.length - 1].x };
}

function signedKg(value) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
}

function renderWeightForecast() {
  const emptyHint = document.getElementById('forecast-empty-hint');
  const result = document.getElementById('forecast-result');
  const trend = computeWeightTrend();
  if (!trend) {
    emptyHint.hidden = false;
    result.hidden = true;
    return;
  }
  emptyHint.hidden = true;
  result.hidden = false;

  const weeklyChange = trend.model.slope * 7;
  document.getElementById('forecast-weekly').textContent = `${signedKg(weeklyChange)} kg/週`;
  document.getElementById('forecast-2w').textContent = `${Math.round(trend.model.predict(trend.lastX + 14) * 10) / 10} kg`;
  document.getElementById('forecast-1m').textContent = `${Math.round(trend.model.predict(trend.lastX + 30) * 10) / 10} kg`;

  const noteEl = document.getElementById('calorie-control-note');
  const profile = Storage.getProfile();
  if (!profile) {
    noteEl.textContent = 'プロフィールを設定すると、目標に対するカロリー調整の提案も表示されます。';
    return;
  }

  const log = Storage.getWeightLog();
  const spanDays = daysBetween(log[0].date, log[log.length - 1].date);
  if (log.length < 5 || spanDays < 7) {
    noteEl.textContent = 'カロリー調整の提案には、7日以上・5回以上の体重記録が必要です(体重は日々の水分などで変動するため、短い期間の記録だけでは判断できません)。';
    return;
  }

  const summary = Calorie.summarize(getCalorieProfile());
  const expectedWeeklyKg = ((summary.target - summary.tdee) * 7) / 7700;
  const gapKg = weeklyChange - expectedWeeklyKg;
  if (Math.abs(gapKg) < 0.15) {
    noteEl.textContent = `実測の体重変化(${signedKg(weeklyChange)}kg/週)は目標のペース(${signedKg(expectedWeeklyKg)}kg/週)とほぼ想定通りです。今のカロリー設定を続けましょう。`;
    return;
  }

  // 安全のため、1日あたりの調整幅は±500kcal(週あたり約0.5kgの変化に相当)を超えて提案しない。
  const MAX_DAILY_ADJUSTMENT_KCAL = 500;
  const rawDeltaKcal = ((expectedWeeklyKg - weeklyChange) * 7700) / 7;
  let adjustKcal = Math.round(Math.max(-MAX_DAILY_ADJUSTMENT_KCAL, Math.min(MAX_DAILY_ADJUSTMENT_KCAL, rawDeltaKcal)) / 10) * 10;

  // 性別ごとの目安下限とBMRのうち高い方を下回らないようにする(極端な低カロリーを提案しない)。
  const genderFloor = profile.gender === 'female' ? 1200 : 1500;
  const safeFloor = Math.max(Math.round(summary.bmr), genderFloor);
  if (summary.target + adjustKcal < safeFloor) {
    adjustKcal = safeFloor - summary.target;
  }

  const wasCapped = Math.abs(rawDeltaKcal) > Math.abs(adjustKcal) + 5;
  const action = adjustKcal > 0 ? '増やす' : '減らす';
  const capNote = wasCapped
    ? '(急激な変化は体に負担がかかるため、安全な範囲までの調整にとどめています。数週間続けて様子を見ましょう)'
    : '';

  if (Math.abs(adjustKcal) < 10) {
    noteEl.textContent = `実測の体重変化(${signedKg(weeklyChange)}kg/週)は目標のペース(${signedKg(
      expectedWeeklyKg
    )}kg/週)から少しずれていますが、これ以上カロリーを減らすと基礎代謝を下回るおそれがあるため、今の摂取量を維持しましょう。`;
    return;
  }

  noteEl.textContent = `実測の体重変化は${signedKg(weeklyChange)}kg/週、目標のペースは${signedKg(
    expectedWeeklyKg
  )}kg/週です。1日の摂取カロリーを目安${Math.abs(adjustKcal)}kcal${action}と、無理なく目標のペースに近づきます。${capNote}`;
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

  document.getElementById('btn-add-routine').addEventListener('click', () => openRoutineForm('add'));
  document.getElementById('btn-save-routine').addEventListener('click', saveRoutineForm);
  document.getElementById('btn-cancel-routine').addEventListener('click', closeRoutineForm);
  document.getElementById('btn-delete-routine').addEventListener('click', deleteRoutineForm);
  document.getElementById('my-routines-list').addEventListener('click', (e) => {
    const pill = e.target.closest('[data-exercise-id]');
    if (pill) {
      jumpToExercise(pill.dataset.exerciseId);
      return;
    }
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const entry = e.target.closest('.history-entry');
    const id = entry.dataset.id;
    if (btn.dataset.action === 'edit') openRoutineForm('edit', id);
    if (btn.dataset.action === 'delete') deleteRoutine(id);
    if (btn.dataset.action === 'log-all') logRoutine(id);
  });

  document.getElementById('workout-log-date').addEventListener('change', renderWorkoutDayLog);
  document.getElementById('workout-log-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const entry = e.target.closest('.history-entry');
    const id = entry.dataset.id;
    if (btn.dataset.action === 'edit') editWorkoutDaySession(id);
    if (btn.dataset.action === 'delete') deleteWorkoutDaySession(id);
  });

  document.getElementById('exercise-select').addEventListener('change', (e) => onExerciseChange(e.target.value));
  document.getElementById('btn-add-exercise').addEventListener('click', () => openExerciseForm('add'));
  document.getElementById('btn-edit-exercise').addEventListener('click', () => {
    if (!currentExercise) return;
    openExerciseForm('edit', currentExercise.id);
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
  document.getElementById('btn-cancel-edit-weight').addEventListener('click', cancelEditWeight);

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
  renderMyRoutines();
  document.getElementById('workout-log-date').valueAsDate = new Date();
  renderWorkoutDayLog();
  initCalendarState();
  renderHome();

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    renderWeightChart();
    renderExerciseChart();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
    navigator.serviceWorker
      .register('service-worker.js')
      .then((reg) => reg.update())
      .catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
