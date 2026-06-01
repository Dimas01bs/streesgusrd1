const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");

const { getDatabase } = require("../db/database");
const { env } = require("../config/env");
const { HttpError } = require("../utils/http-error");

function getFirebaseCredential() {
  const missingKeys = [
    ["FIREBASE_PROJECT_ID", env.firebaseProjectId],
    ["FIREBASE_CLIENT_EMAIL", env.firebaseClientEmail],
    ["FIREBASE_PRIVATE_KEY", env.firebasePrivateKey],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingKeys.length) {
    throw new Error(
      `Missing Firebase environment variable(s): ${missingKeys.join(", ")}`
    );
  }

  return admin.credential.cert({
    projectId: env.firebaseProjectId,
    clientEmail: env.firebaseClientEmail,
    privateKey: env.firebasePrivateKey,
  });
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: getFirebaseCredential(),
  });
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresIn,
    }
  );
}

async function registerUser({ name, email, password }) {
  const db = await getDatabase();

  const existingUserResult = await db.query(
    `SELECT id FROM users WHERE email = $1`,
    [email]
  );

  if (existingUserResult.rows[0]) {
    throw new HttpError(409, "Email sudah digunakan.");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const userResult = await db.query(
    `
      INSERT INTO users (
        name,
        email,
        password_hash
      )
      VALUES ($1, $2, $3)
      RETURNING
        id,
        name,
        email,
        created_at AS "createdAt"
    `,
    [name, email, passwordHash]
  );

  const user = userResult.rows[0];

  return {
    user,
    token: generateToken(user),
  };
}

async function loginUser({ email, password }) {
  const db = await getDatabase();

  const userResult = await db.query(
    `
      SELECT *
      FROM users
      WHERE email = $1
    `,
    [email]
  );

  const user = userResult.rows[0];

  if (!user || !user.password_hash) {
    throw new HttpError(401, "Email atau password salah.");
  }

  const isValidPassword = await bcrypt.compare(password, user.password_hash);

  if (!isValidPassword) {
    throw new HttpError(401, "Email atau password salah.");
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    token: generateToken(user),
  };
}

async function loginWithGoogle(idToken) {
  if (!idToken) {
    throw new HttpError(400, "idToken wajib dikirim.");
  }

  const decoded = await admin.auth().verifyIdToken(idToken);

  if (!decoded.email) {
    throw new HttpError(400, "Akun Google tidak memiliki email.");
  }

  const email = decoded.email;
  const name = decoded.name || email.split("@")[0];

  const db = await getDatabase();

  let userResult = await db.query(
    `
      SELECT
        id,
        name,
        email,
        created_at AS "createdAt"
      FROM users
      WHERE email = $1
    `,
    [email]
  );

  let user = userResult.rows[0];

  if (!user) {
    userResult = await db.query(
      `
        INSERT INTO users (
          name,
          email,
          password_hash
        )
        VALUES ($1, $2, $3)
        RETURNING
          id,
          name,
          email,
          created_at AS "createdAt"
      `,
      [name, email, null]
    );

    user = userResult.rows[0];
  }

  return {
    user,
    token: generateToken(user),
  };
}

async function getCurrentUser(userId) {
  const db = await getDatabase();

  const userResult = await db.query(
    `
      SELECT
        id,
        name,
        email,
        created_at AS "createdAt"
      FROM users
      WHERE id = $1
    `,
    [userId]
  );

  return userResult.rows[0];
}

module.exports = {
  registerUser,
  loginUser,
  loginWithGoogle,
  getCurrentUser,
};