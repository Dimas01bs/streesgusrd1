const request = require("supertest");
const jwt = require("jsonwebtoken");

process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/stressguard_test";
process.env.JWT_SECRET = "test-secret";

const { app } = require("../src/app");
const { initializeDatabase, closeDatabase } = require("../src/db/database");

const authToken = jwt.sign(
  {
    id: 1,
    email: "test@example.com"
  },
  process.env.JWT_SECRET
);

const validPredictionPayload = {
  sleepDate: "2026-05-14",
  age: 22,
  gender: "male",
  sleepHours: 5.5,
  sleepQualityScore: 4,
  dailyScreenTimeHours: 8,
  phoneUsageBeforeSleepMinutes: 120,
  notes: "Sering terbangun"
};

function asAuthed(requestBuilder) {
  return requestBuilder.set("Authorization", `Bearer ${authToken}`);
}

describe("Stress detection API", () => {
  beforeAll(async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: "success",
        prediction: {
          stress_level: "Medium Stress",
          stress_score: 72.4
        },
        recommendation: "Kurangi screen time sebelum tidur."
      })
    }));

    const db = await initializeDatabase();

    await db.query("TRUNCATE predictions, users RESTART IDENTITY CASCADE");
    await db.run(
      `
        INSERT INTO users (
          name,
          email,
          password_hash
        )
        VALUES (?, ?, ?)
      `,
      ["Test User", "test@example.com", "test-password-hash"]
    );
  });

  afterAll(async () => {
    const db = await initializeDatabase();
    await db.query("TRUNCATE predictions, users RESTART IDENTITY CASCADE");
    await closeDatabase();
  });

  test("GET /api/v1/health returns healthy status", async () => {
    const response = await request(app).get("/api/v1/health");

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("ok");
  });

  test("POST /api/v1/predictions creates a prediction", async () => {
    const response = await asAuthed(
      request(app).post("/api/v1/predictions")
    ).send(validPredictionPayload);

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBeDefined();
    expect(response.body.data.stressLevel).toBe("Sedang");
    expect(response.body.data.stressScore).toBe(72);
    expect(response.body.data.recommendations).toContain(
      "Kurangi screen time sebelum tidur."
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          age: validPredictionPayload.age,
          sleep_hours: validPredictionPayload.sleepHours,
          sleep_quality_score: validPredictionPayload.sleepQualityScore,
          daily_screen_time_hours: validPredictionPayload.dailyScreenTimeHours,
          phone_usage_before_sleep_minutes:
            validPredictionPayload.phoneUsageBeforeSleepMinutes,
          gender: validPredictionPayload.gender
        })
      })
    );
  });

  test("POST /api/v1/predictions rejects invalid input", async () => {
    const response = await asAuthed(
      request(app).post("/api/v1/predictions")
    ).send({
      ...validPredictionPayload,
      sleepDate: "14-05-2026",
      sleepHours: 25
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test("GET /api/v1/predictions returns authenticated user's history", async () => {
    const response = await asAuthed(request(app).get("/api/v1/predictions"));

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.meta.total).toBe(1);
  });

  test("GET /api/v1/dashboard/summary returns aggregate data", async () => {
    const response = await asAuthed(
      request(app).get("/api/v1/dashboard/summary")
    );

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty("distribution");
    expect(response.body.data).toHaveProperty("recentPredictions");
  });
});
