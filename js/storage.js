const STORAGE_KEYS = {
  profile: 'ft_profile',
  weightLog: 'ft_weightLog',
  exercises: 'ft_exercises',
  workoutLog: 'ft_workoutLog',
};

const INCREMENTS = { barbell: 2.5, dumbbell: 1, machine: 5, bodyweight: 0 };

const DEFAULT_EXERCISES = [
  { id: 'bench', name: 'ベンチプレス', category: '胸', type: 'barbell', repMin: 6, repMax: 10 },
  { id: 'squat', name: 'スクワット', category: '脚', type: 'barbell', repMin: 6, repMax: 10 },
  { id: 'deadlift', name: 'デッドリフト', category: '背中', type: 'barbell', repMin: 5, repMax: 8 },
  { id: 'ohp', name: 'ショルダープレス', category: '肩', type: 'barbell', repMin: 8, repMax: 12 },
  { id: 'latpulldown', name: 'ラットプルダウン', category: '背中', type: 'machine', repMin: 8, repMax: 12 },
  { id: 'legpress', name: 'レッグプレス', category: '脚', type: 'machine', repMin: 10, repMax: 15 },
  { id: 'curl', name: 'ダンベルカール', category: '腕', type: 'dumbbell', repMin: 8, repMax: 12 },
  { id: 'pushdown', name: 'トライセプスプッシュダウン', category: '腕', type: 'machine', repMin: 10, repMax: 15 },
  { id: 'pullup', name: '懸垂', category: '背中', type: 'bodyweight', repMin: 6, repMax: 12 },
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
    const log = this.getWorkoutLog().filter((s) => s.exerciseId === exerciseId);
    return log.length ? log[log.length - 1] : null;
  },
  historyFor(exerciseId) {
    return this.getWorkoutLog().filter((s) => s.exerciseId === exerciseId);
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
