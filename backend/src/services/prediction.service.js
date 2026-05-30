const { env } = require("../config/env");
const { requestAIPrediction } = require("./ai.service");

async function generatePrediction(input) {
  const aiPayload = {
    age: input.age,
    sleep_hours: input.sleepHours,
    sleep_quality_score: input.sleepQualityScore,
    daily_screen_time_hours: input.dailyScreenTimeHours,
    phone_usage_before_sleep_minutes: input.phoneUsageBeforeSleepMinutes,
    gender: input.gender
  };

  const aiResult = await requestAIPrediction(aiPayload);

  const stressLevelMap = {
    "High Stress": "Tinggi",
    "Medium Stress": "Sedang",
    "Low Stress": "Rendah"
  };
  const recommendation =
    aiResult.recommendation ||
    aiResult.recommendations ||
    aiResult.health_recommendation ||
    "";
  const recommendations = Array.isArray(recommendation)
    ? recommendation.filter(Boolean)
    : recommendation
      ? [recommendation]
      : [];

  return {
    stressScore: Math.round(aiResult.prediction.stress_score),
    stressLevel: stressLevelMap[aiResult.prediction.stress_level],
    confidence: Number((aiResult.prediction.stress_score / 100).toFixed(2)),
    recommendations,
    modelProvider: "fastapi-ai",
    modelVersion: env.modelVersion
  };
}

module.exports = {
  generatePrediction
};
