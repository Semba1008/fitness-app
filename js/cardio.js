const Cardio = {
  metFor(mode, speedKmh, inclinePercent) {
    const speedMMin = Math.max(0, speedKmh * 1000) / 60;
    const grade = Math.max(0, inclinePercent) / 100;
    const vo2 =
      mode === 'run'
        ? 0.2 * speedMMin + 0.9 * speedMMin * grade + 3.5
        : 0.1 * speedMMin + 1.8 * speedMMin * grade + 3.5;
    return Math.max(0, vo2 / 3.5);
  },

  caloriesBurned(mode, speedKmh, inclinePercent, durationMin, weightKg) {
    const met = this.metFor(mode, speedKmh, inclinePercent);
    return Math.max(0, met * weightKg * (durationMin / 60));
  },
};
