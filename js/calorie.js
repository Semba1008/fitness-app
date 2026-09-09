const ACTIVITY_FACTORS = {
  sedentary: { label: 'ほぼ運動しない', factor: 1.2 },
  light: { label: '軽い運動(週1-3日)', factor: 1.375 },
  moderate: { label: '中程度の運動(週3-5日)', factor: 1.55 },
  active: { label: '激しい運動(週6-7日)', factor: 1.725 },
  veryActive: { label: '非常に激しい運動・肉体労働', factor: 1.9 },
};

const GOAL_ADJUST = {
  cut: { label: '減量', factor: 0.8 },
  maintain: { label: '維持', factor: 1.0 },
  bulk: { label: '増量', factor: 1.12 },
};

const Calorie = {
  bmr({ gender, age, heightCm, weightKg }) {
    const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
    return gender === 'male' ? base + 5 : base - 161;
  },
  tdee(bmr, activityLevel) {
    return bmr * ACTIVITY_FACTORS[activityLevel].factor;
  },
  targetCalories(tdee, goal) {
    return tdee * GOAL_ADJUST[goal].factor;
  },
  macros(calories, weightKg, goal) {
    const proteinPerKg = goal === 'cut' ? 2.2 : goal === 'bulk' ? 1.8 : 2.0;
    const proteinG = weightKg * proteinPerKg;
    const proteinKcal = proteinG * 4;
    const fatKcal = calories * 0.25;
    const fatG = fatKcal / 9;
    const carbKcal = Math.max(calories - proteinKcal - fatKcal, 0);
    const carbG = carbKcal / 4;
    return {
      protein: Math.round(proteinG),
      fat: Math.round(fatG),
      carb: Math.round(carbG),
    };
  },
  bmi(weightKg, heightCm) {
    const h = heightCm / 100;
    return weightKg / (h * h);
  },
  summarize(profile) {
    const bmr = this.bmr(profile);
    const tdee = this.tdee(bmr, profile.activityLevel);
    const target = this.targetCalories(tdee, profile.goal);
    const macros = this.macros(target, profile.weightKg, profile.goal);
    const bmi = this.bmi(profile.weightKg, profile.heightCm);
    return {
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      target: Math.round(target),
      macros,
      bmi: Math.round(bmi * 10) / 10,
    };
  },
};
