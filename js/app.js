let currentSets = [];
let currentExercise = null;
let editingSessionId = null;
let editingExerciseId = null;

function switchView(viewId, title) {
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === viewId));
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === viewId));
  document.getElementById('page-title').textContent = title;
  if (viewId === 'view-home') renderHome();
  if (viewId === 'view-workout') {
    renderExerciseHistory();
    renderExerciseChart();
  }
  if (viewId === 'view-weight') {
    renderWeightChart();
    renderWeightHistory();
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
  latestEl.textContent = log.length ? `${log[log.length - 1].weightKg} kg (${log[log.length - 1].date})` : '記録なし';

  renderTodayMenu();
}

function repRangeText(exercise) {
  return exercise.repMin === exercise.repMax
    ? `${exercise.repMin}回`
    : `${exercise.repMin}〜${exercise.repMax}回`;
}

function populateMenuCategorySelect() {
  const select = document.getElementById('menu-category-select');
  const previous = select.value;
  const categories = [...new Set(Storage.getExercises().map((ex) => ex.category))];
  select.innerHTML =
    '<option value="">部位で選ぶ</option>' + categories.map((c) => `<option value="${c}">${c}</option>`).join('');
  select.value = categories.includes(previous) ? previous : '';
}

function renderMenuItems(exercises, emptyMessage) {
  const list = document.getElementById('today-menu-list');
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
    btn.addEventListener('click', () => {
      switchView('view-workout', '筋トレ');
      document.getElementById('exercise-select').value = btn.dataset.exerciseId;
      onExerciseChange(btn.dataset.exerciseId);
    });
  });
}

function renderTodayMenu() {
  const title = document.getElementById('today-menu-title');
  const categoryValue = document.getElementById('menu-category-select').value;
  const dayKey = document.getElementById('menu-day-select').value;

  if (categoryValue) {
    const exercises = Storage.getExercises().filter((ex) => ex.category === categoryValue);
    title.textContent = `${categoryValue}のいつものセット`;
    renderMenuItems(exercises, 'この部位の種目がまだ登録されていません。');
    return;
  }

  if (dayKey) {
    const dayInfo = ROUTINE_DAYS[dayKey];
    const exercises = Storage.getExercises().filter((ex) => ex.day === dayKey);
    title.textContent = `${dayInfo.label}のメニュー`;
    renderMenuItems(exercises, 'この曜日の種目がまだ登録されていません。');
    return;
  }

  title.textContent = '今日のメニュー';
  document.getElementById('today-menu-list').innerHTML =
    '<p class="empty-hint">曜日または部位を選ぶと、いつものセットが表示されます。</p>';
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
    renderSetRows();
    document.getElementById('exercise-history').innerHTML =
      '<p class="empty-hint">種目がありません。追加してください。</p>';
    drawLineChart(document.getElementById('exercise-chart'), []);
  }
}

function onExerciseChange(exerciseId) {
  const exercises = Storage.getExercises();
  currentExercise = exercises.find((ex) => ex.id === exerciseId);
  if (!currentExercise) return;
  cancelEditSession();

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
  if (!currentExercise) {
    drawLineChart(canvas, []);
    return;
  }
  const history = Storage.historyFor(currentExercise.id);
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
  container.innerHTML = history
    .map((session) => {
      const setsText = session.sets
        .map((s) => `${s.weight}kg×${s.reps}${s.rpe ? `(RPE${s.rpe})` : ''}`)
        .join(' / ');
      return `
      <div class="history-entry" data-id="${session.id}">
        <div class="row-between">
          <strong>${session.date}</strong>
          <div class="history-actions">
            <button class="btn-secondary btn-sm" data-action="edit">編集</button>
            <button class="btn-danger btn-sm" data-action="delete">削除</button>
          </div>
        </div>
        <div>${setsText}</div>
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
  hint.textContent = `${session.date} の記録を編集中です。`;
}

function cancelEditSession() {
  editingSessionId = null;
  document.getElementById('btn-save-session').textContent = 'この内容を保存';
  document.getElementById('btn-cancel-edit-session').hidden = true;
  document.getElementById('edit-session-hint').hidden = true;
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
  document.getElementById('ex-type').value = mode === 'edit' ? exercise.type : 'barbell';
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
  const fields = {
    name,
    category: document.getElementById('ex-category').value.trim() || 'その他',
    type: document.getElementById('ex-type').value,
    repMin: Number(document.getElementById('ex-rep-min').value) || 8,
    repMax: Number(document.getElementById('ex-rep-max').value) || 12,
    targetSets: Number(document.getElementById('ex-target-sets').value) || 3,
    day: dayValue || undefined,
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
  populateMenuCategorySelect();
  document.getElementById('exercise-select').value = targetId;
  onExerciseChange(targetId);
}

function deleteExerciseForm() {
  if (!editingExerciseId) return;
  if (!confirm('この種目を削除しますか?この操作は取り消せません。')) return;
  Storage.deleteExercise(editingExerciseId);
  closeExerciseForm();
  populateExerciseSelect();
  populateMenuCategorySelect();
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
    alert('記録を更新しました。');
  } else {
    Storage.addWorkoutSession({
      id: `session_${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      exerciseId: currentExercise.id,
      sets: cleanSets,
    });
    alert('記録を保存しました。');
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
          <span>${entry.date}: ${entry.weightKg} kg</span>
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
  document.getElementById('menu-day-select').addEventListener('change', () => {
    document.getElementById('menu-category-select').value = '';
    renderTodayMenu();
  });
  document.getElementById('menu-category-select').addEventListener('change', () => {
    document.getElementById('menu-day-select').value = '';
    renderTodayMenu();
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

  document.getElementById('exercise-history').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const entry = e.target.closest('.history-entry');
    const id = entry.dataset.id;
    if (btn.dataset.action === 'edit') startEditSession(id);
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
  populateMenuCategorySelect();
  document.getElementById('menu-day-select').value = routineDayForWeekday(new Date().getDay()) || '';
  renderHome();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
