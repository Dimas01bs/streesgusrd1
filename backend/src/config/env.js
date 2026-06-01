const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

function normalizePrivateKey(privateKey) {
  return privateKey
    ?.replace(/^['"]|['"]$/g, "")
    .replace(/\\n/g, "\n");
}

const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || "development",
  apiPrefix: process.env.API_PREFIX || "/api/v1",
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",

  dbPath: path.resolve(
    process.cwd(),
    process.env.DB_PATH || "./data/stress-detection.sqlite"
  ),

  modelProvider: process.env.MODEL_PROVIDER || "heuristic",
  modelVersion: process.env.MODEL_VERSION || "heuristic-v1",
  aiApiUrl: process.env.AI_API_URL || "http://127.0.0.1:8000/predict",

  databaseUrl: process.env.DATABASE_URL,

  jwtSecret: process.env.JWT_SECRET || "stressguard-secret-key",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",

  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  firebasePrivateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY)
};

module.exports = { env };
