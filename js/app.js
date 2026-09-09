let currentSets = [];
let currentExercise = null;

function switchView(viewId, title) {
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === viewId));
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === viewId));
  document.getElementById('page-title').textContent = title;
  if (viewId === 'view-home') renderHome();
  if (viewId === 'view-workout') renderExerciseHistory();
  if (viewId === 'view-weight') renderWeightChart();
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
}

function populateExerciseSelect() {
  const select = document.getElementById('exercise-select');
  const exercises = Storage.getExercises();
  select.innerHTML = exercises
    .map((ex) => `<option value="${ex.id}">${ex.name}(${ex.category})</option>`)
    .join('');
  if (exercises.length) onExerciseChange(exercises[0].id);
}

function onExerciseChange(exerciseId) {
  const exercises = Storage.getExercises();
  currentExercise = exercises.find((ex) => ex.id === exerciseId);
  if (!currentExercise) return;

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
      return `<div class="history-entry"><strong>${session.date}</strong><br>${setsText}</div>`;
    })
    .join('');
}

function showAddExerciseForm() {
  const name = prompt('種目名を入力してください(例: インクラインプレス)');
  if (!name) return;
  const category = prompt('部位を入力してください(例: 胸)', '') || 'その他';
  const type = prompt('種類を入力してください(barbell / dumbbell / machine / bodyweight)', 'barbell');
  const repMin = Number(prompt('目標レップ範囲(下限)', '8')) || 8;
  const repMax = Number(prompt('目標レップ範囲(上限)', '12')) || 12;
  const id = `custom_${Date.now()}`;
  Storage.addExercise({
    id,
    name,
    category,
    type: INCREMENTS[type] !== undefined ? type : 'barbell',
    repMin,
    repMax,
  });
  populateExerciseSelect();
  document.getElementById('exercise-select').value = id;
  onExerciseChange(id);
}

function saveSession() {
  if (!currentExercise) return;
  const sets = currentSets.filter((s) => s.weight !== '' && s.reps !== '');
  if (!sets.length) {
    alert('少なくとも1セットは重量と回数を入力してください。');
    return;
  }
  Storage.addWorkoutSession({
    id: `session_${Date.now()}`,
    date: new Date().toISOString().slice(0, 10),
    exerciseId: currentExercise.id,
    sets: sets.map((s) => ({ weight: s.weight, reps: s.reps, rpe: s.rpe === '' ? null : s.rpe })),
  });
  alert('記録を保存しました。');
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
  renderHome();
}

function renderWeightChart() {
  const canvas = document.getElementById('weight-chart');
  const log = Storage.getWeightLog();
  const points = log.map((e) => ({ label: e.date.slice(5), value: e.weightKg }));
  drawLineChart(canvas, points);
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
  document.getElementById('exercise-select').addEventListener('change', (e) => onExerciseChange(e.target.value));
  document.getElementById('btn-add-exercise').addEventListener('click', showAddExerciseForm);
  document.getElementById('btn-add-set').addEventListener('click', () => {
    const last = currentSets[currentSets.length - 1] || { weight: '', reps: '', rpe: '' };
    currentSets.push({ ...last });
    renderSetRows();
  });
  document.getElementById('btn-save-session').addEventListener('click', saveSession);

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
  renderHome();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
