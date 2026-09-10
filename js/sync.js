const Sync = (() => {
  const LS_URL = 'ft_supabaseUrl';
  const LS_KEY = 'ft_supabaseAnonKey';
  const PENDING_KEY = 'ft_pendingSync';

  let client = null;
  let user = null;

  function getUrl() {
    const stored = localStorage.getItem(LS_URL);
    if (stored) return stored;
    return typeof SUPABASE_URL !== 'undefined' && !SUPABASE_URL.startsWith('YOUR_') ? SUPABASE_URL : '';
  }
  function getKey() {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) return stored;
    return typeof SUPABASE_ANON_KEY !== 'undefined' && !SUPABASE_ANON_KEY.startsWith('YOUR_') ? SUPABASE_ANON_KEY : '';
  }
  function isConfigured() {
    return !!(getUrl() && getKey() && window.supabase && window.supabase.createClient);
  }
  function setCredentials(url, key) {
    localStorage.setItem(LS_URL, url.trim());
    localStorage.setItem(LS_KEY, key.trim());
    client = null;
  }
  function clearCredentials() {
    localStorage.removeItem(LS_URL);
    localStorage.removeItem(LS_KEY);
    client = null;
    user = null;
  }
  function getClient() {
    if (!client && isConfigured()) {
      client = window.supabase.createClient(getUrl(), getKey());
    }
    return client;
  }

  function isSignedIn() {
    return !!user;
  }
  function currentEmail() {
    return user ? user.email : null;
  }

  async function signUp(email, password) {
    const c = getClient();
    if (!c) throw new Error('Supabaseが未設定です');
    const { data, error } = await c.auth.signUp({ email, password });
    if (error) throw error;
    if (data.user) {
      user = data.user;
      await pullAndMerge();
    }
    return data;
  }
  async function signIn(email, password) {
    const c = getClient();
    if (!c) throw new Error('Supabaseが未設定です');
    const { data, error } = await c.auth.signInWithPassword({ email, password });
    if (error) throw error;
    user = data.user;
    await pullAndMerge();
    return data;
  }
  async function signOut() {
    const c = getClient();
    if (c) await c.auth.signOut();
    user = null;
  }
  async function restoreSession() {
    if (!isConfigured()) return false;
    const c = getClient();
    const { data } = await c.auth.getSession();
    if (data && data.session && data.session.user) {
      user = data.session.user;
      return true;
    }
    return false;
  }

  // ---- row <-> local object mapping ----
  function weightToRow(e) {
    return { user_id: user.id, date: e.date, weight_kg: e.weightKg, updated_at: new Date(e.updatedAt || Date.now()).toISOString() };
  }
  function rowToWeight(r) {
    return { date: r.date, weightKg: Number(r.weight_kg), updatedAt: new Date(r.updated_at).getTime() };
  }

  function exerciseToRow(ex) {
    return {
      user_id: user.id, id: ex.id, name: ex.name, category: ex.category || null, type: ex.type || null,
      cardio_mode: ex.cardioMode || null, rep_min: ex.repMin ?? null, rep_max: ex.repMax ?? null,
      target_sets: ex.targetSets ?? null, day: ex.day || null, start_weight: ex.startWeight ?? null,
      updated_at: new Date(ex.updatedAt || Date.now()).toISOString(),
    };
  }
  function rowToExercise(r) {
    const ex = { id: r.id, name: r.name, updatedAt: new Date(r.updated_at).getTime() };
    if (r.category != null) ex.category = r.category;
    if (r.type != null) ex.type = r.type;
    if (r.cardio_mode != null) ex.cardioMode = r.cardio_mode;
    if (r.rep_min != null) ex.repMin = r.rep_min;
    if (r.rep_max != null) ex.repMax = r.rep_max;
    if (r.target_sets != null) ex.targetSets = r.target_sets;
    if (r.day != null) ex.day = r.day;
    if (r.start_weight != null) ex.startWeight = r.start_weight;
    return ex;
  }

  function sessionToRow(s) {
    return {
      user_id: user.id, id: s.id, date: s.date, exercise_id: s.exerciseId,
      sets: s.sets || null, cardio: s.cardio || null,
      updated_at: new Date(s.updatedAt || Date.now()).toISOString(),
    };
  }
  function rowToSession(r) {
    const s = { id: r.id, date: r.date, exerciseId: r.exercise_id, updatedAt: new Date(r.updated_at).getTime() };
    if (r.sets) s.sets = r.sets;
    if (r.cardio) s.cardio = r.cardio;
    return s;
  }

  function routineToRow(rt) {
    return { user_id: user.id, id: rt.id, name: rt.name, exercise_ids: rt.exerciseIds || null, updated_at: new Date(rt.updatedAt || Date.now()).toISOString() };
  }
  function rowToRoutine(r) {
    return { id: r.id, name: r.name, exerciseIds: r.exercise_ids || [], updatedAt: new Date(r.updated_at).getTime() };
  }

  function profileToRow(p) {
    return {
      user_id: user.id, gender: p.gender || null, age: p.age || null, height_cm: p.heightCm || null,
      weight_kg: p.weightKg || null, activity_level: p.activityLevel || null, goal: p.goal || null,
      updated_at: new Date(p.updatedAt || Date.now()).toISOString(),
    };
  }
  function rowToProfile(r) {
    return {
      gender: r.gender, age: r.age, heightCm: r.height_cm, weightKg: r.weight_kg,
      activityLevel: r.activity_level, goal: r.goal, updatedAt: new Date(r.updated_at).getTime(),
    };
  }

  // ---- pending write queue (for offline support) ----
  function loadPending() {
    try {
      return JSON.parse(localStorage.getItem(PENDING_KEY)) || [];
    } catch {
      return [];
    }
  }
  function savePending(list) {
    localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  }

  async function runOp(op) {
    const c = getClient();
    if (op.type === 'upsert') {
      const { error } = await c.from(op.table).upsert(op.row);
      if (error) throw error;
    } else if (op.type === 'delete') {
      let query = c.from(op.table).delete();
      Object.entries(op.match).forEach(([k, v]) => {
        query = query.eq(k, v);
      });
      const { error } = await query;
      if (error) throw error;
    }
  }

  let flushing = false;
  async function flushPending() {
    if (!isSignedIn() || flushing) return;
    flushing = true;
    try {
      let list = loadPending();
      while (list.length) {
        try {
          await runOp(list[0]);
          list.shift();
          savePending(list);
        } catch {
          break;
        }
      }
    } finally {
      flushing = false;
    }
  }

  function push(type, table, row, match) {
    if (!isConfigured() || !isSignedIn()) return;
    const list = loadPending();
    list.push({ type, table, row, match });
    savePending(list);
    flushPending();
  }

  function pushWeight(entry) {
    if (!user) return;
    push('upsert', 'weight_logs', weightToRow(entry));
  }
  function deleteWeight(date) {
    if (!user) return;
    push('delete', 'weight_logs', null, { user_id: user.id, date });
  }
  function pushExercise(ex) {
    if (!user) return;
    push('upsert', 'exercises', exerciseToRow(ex));
  }
  function deleteExercise(id) {
    if (!user) return;
    push('delete', 'exercises', null, { user_id: user.id, id });
  }
  function pushSession(s) {
    if (!user) return;
    push('upsert', 'workout_sessions', sessionToRow(s));
  }
  function deleteSession(id) {
    if (!user) return;
    push('delete', 'workout_sessions', null, { user_id: user.id, id });
  }
  function pushRoutine(r) {
    if (!user) return;
    push('upsert', 'routines', routineToRow(r));
  }
  function deleteRoutine(id) {
    if (!user) return;
    push('delete', 'routines', null, { user_id: user.id, id });
  }
  function pushProfile(p) {
    if (!user) return;
    push('upsert', 'profiles', profileToRow(p));
  }

  // ---- pull + last-write-wins merge ----
  function mergeByKey(localList, remoteRows, keyFn, rowToLocal) {
    const map = new Map();
    localList.forEach((item) => map.set(keyFn(item), item));
    remoteRows.forEach((row) => {
      const item = rowToLocal(row);
      const key = keyFn(item);
      const existing = map.get(key);
      if (!existing || (item.updatedAt || 0) >= (existing.updatedAt || 0)) {
        map.set(key, item);
      }
    });
    return Array.from(map.values());
  }

  async function pushAllLocal() {
    if (!isSignedIn()) return;
    Storage.getWeightLog().forEach(pushWeight);
    Storage.getExercises().forEach(pushExercise);
    Storage.getWorkoutLog().forEach(pushSession);
    Storage.getRoutines().forEach(pushRoutine);
    const profile = Storage.getProfile();
    if (profile) pushProfile(profile);
    await flushPending();
  }

  async function pullAndMerge() {
    const c = getClient();
    if (!c || !user) return;
    const [weightRes, exRes, sessRes, routineRes, profileRes] = await Promise.all([
      c.from('weight_logs').select('*').eq('user_id', user.id),
      c.from('exercises').select('*').eq('user_id', user.id),
      c.from('workout_sessions').select('*').eq('user_id', user.id),
      c.from('routines').select('*').eq('user_id', user.id),
      c.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
    ]);

    if (!weightRes.error) {
      const merged = mergeByKey(Storage.getWeightLog(), weightRes.data || [], (e) => e.date, rowToWeight);
      merged.sort((a, b) => a.date.localeCompare(b.date));
      Storage._write(STORAGE_KEYS.weightLog, merged);
    }
    if (!exRes.error) {
      const merged = mergeByKey(Storage.getExercises(), exRes.data || [], (e) => e.id, rowToExercise);
      Storage.saveExercises(merged);
    }
    if (!sessRes.error) {
      const merged = mergeByKey(Storage.getWorkoutLog(), sessRes.data || [], (s) => s.id, rowToSession);
      Storage._write(STORAGE_KEYS.workoutLog, merged);
    }
    if (!routineRes.error) {
      const merged = mergeByKey(Storage.getRoutines(), routineRes.data || [], (r) => r.id, rowToRoutine);
      Storage.saveRoutines(merged);
    }
    if (!profileRes.error && profileRes.data) {
      const local = Storage.getProfile();
      const remote = rowToProfile(profileRes.data);
      if (!local || (remote.updatedAt || 0) >= (local.updatedAt || 0)) {
        Storage._write(STORAGE_KEYS.profile, remote);
      }
    }

    await pushAllLocal();
  }

  window.addEventListener('online', flushPending);

  return {
    isConfigured, setCredentials, clearCredentials, getUrl, getKey,
    isSignedIn, currentEmail,
    signUp, signIn, signOut, restoreSession, pullAndMerge,
    pushWeight, deleteWeight, pushExercise, deleteExercise,
    pushSession, deleteSession, pushRoutine, deleteRoutine, pushProfile,
    flushPending,
  };
})();
