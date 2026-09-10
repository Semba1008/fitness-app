const STORAGE_KEYS = {
  profile: 'ft_profile',
  weightLog: 'ft_weightLog',
  exercises: 'ft_exercises',
  workoutLog: 'ft_workoutLog',
};

const INCREMENTS = { barbell: 2.5, dumbbell: 1, machine: 5, bodyweight: 0 };

const ROUTINE_DAYS = {
  tue: { weekday: 2, label: '胸・三頭筋' },
  wed: { weekday: 3, label: '背中・二頭筋' },
  thu: { weekday: 4, label: '脚・腹筋' },
  fri: { weekday: 5, label: '肩・腕' },
};

function routineDayForWeekday(weekday) {
  return Object.entries(ROUTINE_DAYS).find(([, v]) => v.weekday === weekday)?.[0] || null;
}

const DEFAULT_EXERCISES = [
  // 火曜日: 胸・三頭筋
  { id: 'bench', name: 'ベンチプレス', category: '胸', type: 'barbell', repMin: 6, repMax: 8, targetSets: 4, day: 'tue' },
  { id: 'incline_db_press', name: 'インクラインダンベルプレス', category: '胸', type: 'dumbbell', repMin: 8, repMax: 10, targetSets: 3, day: 'tue', startWeight: 16 },
  { id: 'pec_fly', name: 'ペックフライ', category: '胸', type: 'machine', repMin: 10, repMax: 15, targetSets: 3, day: 'tue', startWeight: 18 },
  { id: 'pushdown', name: 'ケーブルプレスダウン', category: '腕', type: 'machine', repMin: 10, repMax: 12, targetSets: 3, day: 'tue', startWeight: 11.3 },
  { id: 'oh_triceps_ext', name: 'オーバーヘッドトライセプスエクステンション', category: '腕', type: 'dumbbell', repMin: 10, repMax: 12, targetSets: 3, day: 'tue', startWeight: 11.3 },

  // 水曜日: 背中・二頭筋
  { id: 'latpulldown', name: 'ラットプルダウン', category: '背中', type: 'machine', repMin: 8, repMax: 10, targetSets: 4, day: 'wed', startWeight: 45 },
  { id: 'seated_row', name: 'シーテッドロー', category: '背中', type: 'machine', repMin: 8, repMax: 10, targetSets: 3, day: 'wed', startWeight: 32 },
  { id: 'face_pull', name: 'フェイスプル', category: '背中', type: 'machine', repMin: 12, repMax: 15, targetSets: 3, day: 'wed', startWeight: 4 },
  { id: 'preacher_curl', name: 'プリチャーカール', category: '腕', type: 'dumbbell', repMin: 8, repMax: 10, targetSets: 3, day: 'wed', startWeight: 3.75 },
  { id: 'cable_curl', name: 'ケーブルカール', category: '腕', type: 'machine', repMin: 10, repMax: 12, targetSets: 3, day: 'wed' },

  // 木曜日: 脚・腹筋
  { id: 'squat', name: 'スクワット', category: '脚', type: 'barbell', repMin: 6, repMax: 8, targetSets: 4, day: 'thu' },
  { id: 'legpress', name: 'レッグプレス', category: '脚', type: 'machine', repMin: 10, repMax: 10, targetSets: 3, day: 'thu', startWeight: 99 },
  { id: 'leg_ext', name: 'レッグエクステンション', category: '脚', type: 'machine', repMin: 12, repMax: 15, targetSets: 3, day: 'thu', startWeight: 32 },
  { id: 'leg_curl', name: 'レッグカール', category: '脚', type: 'machine', repMin: 12, repMax: 15, targetSets: 3, day: 'thu' },
  { id: 'calf_raise', name: 'カーフレイズ', category: '脚', type: 'machine', repMin: 15, repMax: 20, targetSets: 4, day: 'thu' },
  { id: 'ab_work', name: 'アブローラー/ケーブルクランチ', category: '腹筋', type: 'bodyweight', repMin: 15, repMax: 20, targetSets: 3, day: 'thu' },

  // 金曜日: 肩・腕
  { id: 'ohp', name: 'ショルダープレス', category: '肩', type: 'barbell', repMin: 8, repMax: 10, targetSets: 4, day: 'fri' },
  { id: 'side_raise', name: 'サイドレイズ', category: '肩', type: 'dumbbell', repMin: 12, repMax: 15, targetSets: 4, day: 'fri' },
  { id: 'rear_delt_fly', name: 'リアデルトフライ', category: '肩', type: 'dumbbell', repMin: 12, repMax: 15, targetSets: 3, day: 'fri' },
  { id: 'upright_row', name: 'アップライトロー', category: '肩', type: 'dumbbell', repMin: 10, repMax: 10, targetSets: 3, day: 'fri' },
  { id: 'incline_db_curl', name: 'インクラインダンベルカール', category: '腕', type: 'dumbbell', repMin: 10, repMax: 12, targetSets: 3, day: 'fri' },
  { id: 'skull_crusher', name: 'スカルクラッシャー', category: '腕', type: 'dumbbell', repMin: 10, repMax: 12, targetSets: 3, day: 'fri' },

  // ルーティン外の種目
  { id: 'deadlift', name: 'デッドリフト', category: '背中', type: 'barbell', repMin: 5, repMax: 8, targetSets: 3 },
  { id: 'curl', name: 'ダンベルカール', category: '腕', type: 'dumbbell', repMin: 8, repMax: 12, targetSets: 3 },
  { id: 'pullup', name: '懸垂', category: '背中', type: 'bodyweight', repMin: 6, repMax: 12, targetSets: 3 },
];

const Storage = {
  _read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  _write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  getProfile() {
    return this._read(STORAGE_KEYS.profile, null);
  },
  saveProfile(profile) {
    this._write(STORAGE_KEYS.profile, profile);
  },

  getWeightLog() {
    return this._read(STORAGE_KEYS.weightLog, []);
  },
  addWeightEntry(entry) {
    const log = this.getWeightLog().filter((e) => e.date !== entry.date);
    log.push(entry);
    log.sort((a, b) => a.date.localeCompare(b.date));
    this._write(STORAGE_KEYS.weightLog, log);
  },
  deleteWeightEntry(date) {
    const log = this.getWeightLog().filter((e) => e.date !== date);
    this._write(STORAGE_KEYS.weightLog, log);
  },

  getExercises() {
    return this._read(STORAGE_KEYS.exercises, DEFAULT_EXERCISES);
  },
  saveExercises(list) {
    this._write(STORAGE_KEYS.exercises, list);
  },
  addExercise(exercise) {
    const list = this.getExercises();
    list.push(exercise);
    this.saveExercises(list);
  },
  updateExercise(id, fields) {
    const list = this.getExercises().map((ex) => (ex.id === id ? { ...ex, ...fields } : ex));
    this.saveExercises(list);
  },
  deleteExercise(id) {
    const list = this.getExercises().filter((ex) => ex.id !== id);
    this.saveExercises(list);
  },

  getWorkoutLog() {
    return this._read(STORAGE_KEYS.workoutLog, []);
  },
  addWorkoutSession(session) {
    const log = this.getWorkoutLog();
    log.push(session);
    this._write(STORAGE_KEYS.workoutLog, log);
  },
  updateWorkoutSession(id, fields) {
    const log = this.getWorkoutLog().map((s) => (s.id === id ? { ...s, ...fields } : s));
    this._write(STORAGE_KEYS.workoutLog, log);
  },
  deleteWorkoutSession(id) {
    const log = this.getWorkoutLog().filter((s) => s.id !== id);
    this._write(STORAGE_KEYS.workoutLog, log);
  },
  lastSessionFor(exerciseId) {
    const history = this.historyFor(exerciseId);
    return history.length ? history[history.length - 1] : null;
  },
  historyFor(exerciseId) {
    return this.getWorkoutLog()
      .filter((s) => s.exerciseId === exerciseId)
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  exportAll() {
    return {
      profile: this.getProfile(),
      weightLog: this.getWeightLog(),
      exercises: this.getExercises(),
      workoutLog: this.getWorkoutLog(),
      exportedAt: new Date().toISOString(),
    };
  },
  importAll(data) {
    if (data.profile) this.saveProfile(data.profile);
    if (data.weightLog) this._write(STORAGE_KEYS.weightLog, data.weightLog);
    if (data.exercises) this.saveExercises(data.exercises);
    if (data.workoutLog) this._write(STORAGE_KEYS.workoutLog, data.workoutLog);
  },
  resetAll() {
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
  },
};
