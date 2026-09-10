const Stats = {
  linearRegression(points) {
    const n = points.length;
    if (n === 0) return null;
    const sumX = points.reduce((a, p) => a + p.x, 0);
    const sumY = points.reduce((a, p) => a + p.y, 0);
    const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
    const sumXX = points.reduce((a, p) => a + p.x * p.x, 0);
    const denom = n * sumXX - sumX * sumX;
    const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept, predict: (x) => slope * x + intercept };
  },

  predictNextWeight(history, minPoints = 3) {
    if (history.length < minPoints) return null;
    const points = history.map((session, i) => ({
      x: i,
      y: Math.max(...session.sets.map((s) => s.weight)),
    }));
    const model = this.linearRegression(points);
    if (!model) return null;
    return { predicted: model.predict(points.length), slopePerSession: model.slope };
  },

  averageRecentRpe(history, count = 3) {
    const recent = history.slice(-count);
    const values = recent.flatMap((s) => s.sets.map((set) => set.rpe)).filter((r) => typeof r === 'number');
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  },
};
