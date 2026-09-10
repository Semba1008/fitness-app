function roundToHalf(value) {
  return Math.round(value * 2) / 2;
}

const Workout = {
  suggestNext(exercise) {
    const history = Storage.historyFor(exercise.id).filter((s) => Array.isArray(s.sets));
    const last = history.length ? history[history.length - 1] : null;
    const increment = INCREMENTS[exercise.type];

    if (!last) {
      const sets = exercise.targetSets || 3;
      if (exercise.type === 'bodyweight') {
        return {
          weight: null,
          targetReps: exercise.repMin,
          sets,
          note: '初回記録です。無理のない重量・回数から始めましょう。',
        };
      }
      const hasStartWeight = typeof exercise.startWeight === 'number';
      return {
        weight: hasStartWeight ? exercise.startWeight : 0,
        targetReps: exercise.repMin,
        sets,
        note: hasStartWeight
          ? `初回記録です。目安の重量(${exercise.startWeight}kg)から始めましょう。`
          : '初回記録です。無理のない重量・回数から始めましょう。',
      };
    }

    const sets = last.sets;
    const lastWeight = Math.max(...sets.map((s) => s.weight));
    const minRepsAchieved = Math.min(...sets.map((s) => s.reps));
    const allHitMax = sets.every((s) => s.reps >= exercise.repMax);
    const allHitMin = sets.every((s) => s.reps >= exercise.repMin);
    const rpeValues = sets.map((s) => s.rpe).filter((r) => typeof r === 'number');
    const avgRpe = rpeValues.length ? rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length : null;

    if (exercise.type !== 'bodyweight') {
      const recentAvgRpe = Stats.averageRecentRpe(history, 3);
      if (recentAvgRpe !== null && recentAvgRpe >= 9) {
        return {
          weight: roundToHalf(lastWeight * 0.9),
          targetReps: exercise.repMin,
          sets: sets.length,
          note: `直近${Math.min(history.length, 3)}回の平均RPEが${recentAvgRpe.toFixed(1)}と高く、疲労が蓄積している可能性があります。重量を少し落として${exercise.repMin}回、回復を優先しましょう。`,
        };
      }
    }

    if (allHitMax) {
      let appliedIncrement = increment;
      let modelNote = '';
      if (exercise.type !== 'bodyweight') {
        const trend = Stats.predictNextWeight(history);
        if (trend && trend.slopePerSession > 0) {
          const modelIncrement = trend.predicted - lastWeight;
          appliedIncrement = Math.min(Math.max(modelIncrement, increment * 0.5), increment * 3);
          modelNote = `(過去${history.length}回の記録から、あなたの伸び(1回あたり約${trend.slopePerSession.toFixed(2)}kg)に合わせて重量を調整しています)`;
        }
      }
      let note = `前回すべてのセットで上限の${exercise.repMax}回に到達!重量を+${roundToHalf(appliedIncrement)}kgして${exercise.repMin}回を目指しましょう。${modelNote}`;
      if (avgRpe !== null && avgRpe >= 9 && appliedIncrement > 0) {
        appliedIncrement = appliedIncrement / 2;
        note += '(前回は高強度だったため増加幅を控えめにしています)';
      }
      return {
        weight: exercise.type === 'bodyweight' ? lastWeight : roundToHalf(lastWeight + appliedIncrement),
        targetReps: exercise.repMin,
        sets: sets.length,
        note,
      };
    }

    if (allHitMin) {
      const nextTarget = Math.min(minRepsAchieved + 1, exercise.repMax);
      return {
        weight: lastWeight,
        targetReps: nextTarget,
        sets: sets.length,
        note: `同じ重量でレップ数を+1し、${nextTarget}回を目指しましょう。`,
      };
    }

    return {
      weight: lastWeight,
      targetReps: exercise.repMin,
      sets: sets.length,
      note: `前回未達のセットがありました。同じ重量・${exercise.repMin}回で再チャレンジしましょう。`,
    };
  },
};
