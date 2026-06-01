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

  const totalsResult = await db.query(
    `
      SELECT
        COUNT(*)::int AS "totalPredictions",
        COALESCE(ROUND(AVG(stress_score)::numeric, 2), 0)::float AS "averageStressScore"
      FROM predictions
      WHERE user_id = $1
    `,
    [userId]
  );

  const latestResult = await db.query(
    `
      SELECT
        id,
        sleep_date AS "sleepDate",
        age,
        gender,
        sleep_hours AS "sleepHours",
        sleep_quality_score AS "sleepQualityScore",
        daily_screen_time_hours AS "dailyScreenTimeHours",
        phone_usage_before_sleep_minutes AS "phoneUsageBeforeSleepMinutes",
        stress_level AS "stressLevel",
        stress_score AS "stressScore",
        confidence,
        notes,
        recommendations,
        model_provider AS "modelProvider",
        model_version AS "modelVersion",
        created_at AS "createdAt"
      FROM predictions
      WHERE user_id = $1
      ORDER BY id DESC
      LIMIT 1
    `,
    [userId]
  );

  const distributionResult = await db.query(
    `
      SELECT
        stress_level AS "stressLevel",
        COUNT(*)::int AS total
      FROM predictions
      WHERE user_id = $1
      GROUP BY stress_level
    `,
    [userId]
  );

  const trendResult = await db.query(
    `
      SELECT
        sleep_date AS "sleepDate",
        ROUND(AVG(stress_score)::numeric, 2)::float AS "averageStressScore",
        COUNT(*)::int AS "totalEntries"
      FROM predictions
      WHERE user_id = $1
        AND created_at >= NOW() - INTERVAL '6 days'
      GROUP BY sleep_date
      ORDER BY sleep_date ASC
    `,
    [userId]
  );

  const recentResult = await db.query(
    `
      SELECT
        id,
        sleep_date AS "sleepDate",
        age,
        gender,
        sleep_hours AS "sleepHours",
        sleep_quality_score AS "sleepQualityScore",
        daily_screen_time_hours AS "dailyScreenTimeHours",
        phone_usage_before_sleep_minutes AS "phoneUsageBeforeSleepMinutes",
        stress_level AS "stressLevel",
        stress_score AS "stressScore",
        confidence,
        created_at AS "createdAt"
      FROM predictions
      WHERE user_id = $1
      ORDER BY id DESC
      LIMIT 5
    `,
    [userId]
  );

  const totals = totalsResult.rows[0];
  const latest = latestResult.rows[0];
  const distributionRows = distributionResult.rows;
  const trendRows = trendResult.rows;
  const recentPredictions = recentResult.rows;

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