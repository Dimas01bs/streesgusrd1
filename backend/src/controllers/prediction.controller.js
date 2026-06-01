const { getDatabase } = require("../db/database");
const { generatePrediction } = require("../services/prediction.service");
const {
  predictionInputSchema,
  predictionQuerySchema,
} = require("../validators/prediction.validator");
const { HttpError } = require("../utils/http-error");

function mapPredictionRow(row) {
  let recommendations = [];

  try {
    if (row.recommendations) {
      recommendations = JSON.parse(row.recommendations);

      if (!Array.isArray(recommendations)) {
        recommendations = [recommendations];
      }
    }
  } catch (e) {
    console.error("Failed to parse recommendations:", e);
  }

  return {
    id: row.id,
    sleepDate: row.sleepDate,
    age: row.age,
    gender: row.gender,
    sleepHours: row.sleepHours,
    sleepQualityScore: row.sleepQualityScore,
    dailyScreenTimeHours: row.dailyScreenTimeHours,
    phoneUsageBeforeSleepMinutes: row.phoneUsageBeforeSleepMinutes,
    notes: row.notes,
    stressScore: row.stressScore,
    stressLevel: row.stressLevel,
    confidence: row.confidence,
    recommendations,
    modelProvider: row.modelProvider,
    modelVersion: row.modelVersion,
    createdAt: row.createdAt,
  };
}

async function createPrediction(req, res) {
  const payload = predictionInputSchema.parse(req.body);
  const result = await generatePrediction(payload);
  const db = await getDatabase();

  const savedResult = await db.query(
    `
      INSERT INTO predictions (
        user_id,
        sleep_date,
        age,
        gender,
        sleep_hours,
        sleep_quality_score,
        daily_screen_time_hours,
        phone_usage_before_sleep_minutes,
        notes,
        stress_score,
        stress_level,
        confidence,
        recommendations,
        model_provider,
        model_version
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15
      )
      RETURNING
        id,
        sleep_date AS "sleepDate",
        age,
        gender,
        sleep_hours AS "sleepHours",
        sleep_quality_score AS "sleepQualityScore",
        daily_screen_time_hours AS "dailyScreenTimeHours",
        phone_usage_before_sleep_minutes AS "phoneUsageBeforeSleepMinutes",
        notes,
        stress_score AS "stressScore",
        stress_level AS "stressLevel",
        confidence,
        recommendations,
        model_provider AS "modelProvider",
        model_version AS "modelVersion",
        created_at AS "createdAt"
    `,
    [
      req.user.id,
      payload.sleepDate,
      payload.age,
      payload.gender,
      payload.sleepHours,
      payload.sleepQualityScore,
      payload.dailyScreenTimeHours,
      payload.phoneUsageBeforeSleepMinutes,
      payload.notes || null,
      result.stressScore,
      result.stressLevel,
      result.confidence,
      JSON.stringify(result.recommendations),
      result.modelProvider,
      result.modelVersion,
    ]
  );

  const saved = savedResult.rows[0];

  res.status(201).json({
    success: true,
    message: "Prediction generated successfully.",
    data: mapPredictionRow(saved),
  });
}

async function getPredictions(req, res) {
  const query = predictionQuerySchema.parse(req.query);
  const db = await getDatabase();

  const offset = (query.page - 1) * query.limit;

  const params = [req.user.id];

  let whereClause = `
    WHERE user_id = $1
  `;

  if (query.stressLevel) {
    params.push(query.stressLevel);
    whereClause += `
      AND stress_level = $${params.length}
    `;
  }

  const totalResult = await db.query(
    `SELECT COUNT(*)::int AS total FROM predictions ${whereClause}`,
    params
  );

  const rowsResult = await db.query(
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
        notes,
        stress_score AS "stressScore",
        stress_level AS "stressLevel",
        confidence,
        recommendations,
        model_provider AS "modelProvider",
        model_version AS "modelVersion",
        created_at AS "createdAt"
      FROM predictions
      ${whereClause}
      ORDER BY id DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `,
    [...params, query.limit, offset]
  );

  const total = totalResult.rows[0].total;

  res.json({
    success: true,
    data: rowsResult.rows.map(mapPredictionRow),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit) || 1,
    },
  });
}

async function getPredictionById(req, res) {
  const db = await getDatabase();

  const rowResult = await db.query(
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
        notes,
        stress_score AS "stressScore",
        stress_level AS "stressLevel",
        confidence,
        recommendations,
        model_provider AS "modelProvider",
        model_version AS "modelVersion",
        created_at AS "createdAt"
      FROM predictions
      WHERE id = $1
        AND user_id = $2
    `,
    [req.params.id, req.user.id]
  );

  const row = rowResult.rows[0];

  if (!row) {
    throw new HttpError(404, "Prediction not found.");
  }

  res.json({
    success: true,
    data: mapPredictionRow(row),
  });
}

module.exports = {
  createPrediction,
  getPredictions,
  getPredictionById,
};