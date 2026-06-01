const { getDatabase } = require("../db/database");

async function getHealth(req, res) {
  const db = await getDatabase();

  await db.query("SELECT 1");

  res.json({
    success: true,
    message: "Service is healthy.",
    data: {
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString()
    }
  });
}

module.exports = { getHealth };