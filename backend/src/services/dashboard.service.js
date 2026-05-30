const { getDatabase } = require("../db/database");

function parseRecommendations(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    return [value];
  }
}

async function getDashboardSummary(userId) {
  const db = await getDatabase();

  const totals = await db.get(
    `
      SELECT
        COUNT(*) AS totalPredictions,
        COALESCE(ROUND(AVG(stress_score), 2), 0) AS averageStressScore
      FROM predictions
      WHERE user_id = ?
    `,
    [userId]
  );

  const latest = await db.get(
    `
      SELECT
        id,
        sleep_date AS sleepDate,
        age,
        gender,
        sleep_hours AS sleepHours,
        sleep_quality_score AS sleepQualityScore,
        daily_screen_time_hours AS dailyScreenTimeHours,
        phone_usage_before_sleep_minutes AS phoneUsageBeforeSleepMinutes,
        stress_level AS stressLevel,
        stress_score AS stressScore,
        confidence,
        notes,
        recommendations,
        model_provider AS modelProvider,
        model_version AS modelVersion,
        created_at AS createdAt
      FROM predictions
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [userId]
  );

  const distributionRows = await db.all(
    `
      SELECT
        stress_level AS stressLevel,
        COUNT(*) AS total
      FROM predictions
      WHERE user_id = ?
      GROUP BY stress_level
    `,
    [userId]
  );

  const trendRows = await db.all(
    `
      SELECT
        sleep_date AS sleepDate,
        ROUND(AVG(stress_score), 2) AS averageStressScore,
        COUNT(*) AS totalEntries
      FROM predictions
      WHERE user_id = ?
        AND DATE(created_at) >= DATE('now', '-6 day')
      GROUP BY sleep_date
      ORDER BY sleep_date ASC
    `,
    [userId]
  );

  const recentPredictions = await db.all(
    `
      SELECT
        id,
        sleep_date AS sleepDate,
        age,
        gender,
        sleep_hours AS sleepHours,
        sleep_quality_score AS sleepQualityScore,
        daily_screen_time_hours AS dailyScreenTimeHours,
        phone_usage_before_sleep_minutes AS phoneUsageBeforeSleepMinutes,
        stress_level AS stressLevel,
        stress_score AS stressScore,
        confidence,
        created_at AS createdAt
      FROM predictions
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 5
    `,
    [userId]
  );

  const distribution = {
    Rendah: 0,
    Sedang: 0,
    Tinggi: 0
  };

  for (const row of distributionRows) {
    distribution[row.stressLevel] = row.total;
  }

  return {
    totalPredictions: totals.totalPredictions,
    averageStressScore: totals.averageStressScore,
    latestPrediction: latest
      ? {
          ...latest,
          recommendations: parseRecommendations(latest.recommendations)
        }
      : null,
    distribution,
    trend: trendRows,
    recentPredictions
  };
}

module.exports = {
  getDashboardSummary
};
