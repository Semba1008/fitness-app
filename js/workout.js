const Workout = {
  suggestNext(exercise) {
    const last = Storage.lastSessionFor(exercise.id);
    const increment = INCREMENTS[exercise.type];

    if (!last) {
      return {
        weight: exercise.type === 'bodyweight' ? null : 0,
        targetReps: exercise.repMin,
        sets: 3,
        note: '初回記録です。無理のない重量・回数から始めましょう。',
      };
    }

    const sets = last.sets;
    const minRepsAchieved = Math.min(...sets.map((s) => s.reps));
    const allHitMax = sets.every((s) => s.reps >= exercise.repMax);
    const allHitMin = sets.every((s) => s.reps >= exercise.repMin);
    const rpeValues = sets.map((s) => s.rpe).filter((r) => typeof r === 'number');
    const avgRpe = rpeValues.length ? rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length : null;

    if (allHitMax) {
      let appliedIncrement = increment;
      let note = `前回すべてのセットで上限の${exercise.repMax}回に到達!重量を+${increment}して${exercise.repMin}回を目指しましょう。`;
      if (avgRpe !== null && avgRpe >= 9 && increment > 0) {
        appliedIncrement = increment / 2;
        note += '(前回は高強度だったため増加幅を控えめにしています)';
      }
      return {
        weight: exercise.type === 'bodyweight' ? last.weight : last.weight + appliedIncrement,
        targetReps: exercise.repMin,
        sets: sets.length,
        note,
      };
    }

    if (allHitMin) {
      const nextTarget = Math.min(minRepsAchieved + 1, exercise.repMax);
      return {
        weight: last.weight,
        targetReps: nextTarget,
        sets: sets.length,
        note: `同じ重量でレップ数を+1し、${nextTarget}回を目指しましょう。`,
      };
    }

    return {
      weight: last.weight,
      targetReps: exercise.repMin,
      sets: sets.length,
      note: `前回未達のセットがありました。同じ重量・${exercise.repMin}回で再チャレンジしましょう。`,
    };
  },
};
