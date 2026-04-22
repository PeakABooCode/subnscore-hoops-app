import passport from "passport";
import LocalStrategy from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import bcrypt from "bcrypt";
import pool from "./db.js";

// 1. How to verify a local login
// --- LOCAL STRATEGY ---
passport.use(
  new LocalStrategy(
    { usernameField: "email" },
    async (email, password, done) => {
      try {
        // Find user by email
        const result = await pool.query(
          "SELECT * FROM users WHERE email = $1",
          [email],
        );
        if (result.rows.length === 0) {
          return done(null, false, { message: "Incorrect email or password." });
        }

        const user = result.rows[0];

        // Handle users registered via Google who don't have a local password
        if (!user.password_hash) {
          return done(null, false, {
            message: "This account uses Google Login.",
          });
        }

        // Compare hashed password
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
          return done(null, false, { message: "Incorrect email or password." });
        }

        return done(null, user); // Success!
      } catch (err) {
        return done(err);
      }
    },
  ),
);

// --- GOOGLE STRATEGY ---
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists
        const result = await pool.query(
          "SELECT * FROM users WHERE google_id = $1",
          [profile.id],
        );

        if (result.rows.length > 0) {
          return done(null, result.rows[0]);
        }

        // If not, create them
        const newUser = await pool.query(
          "INSERT INTO users (name, email, google_id) VALUES ($1, $2, $3) RETURNING *",
          [profile.displayName, profile.emails[0].value, profile.id],
        );
        return done(null, newUser.rows[0]);
      } catch (err) {
        return done(err);
      }
    },
  ),
);

// 2. Save user ID to the session cookie
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// 3. Get user details from the database using the ID in the cookie
passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email FROM users WHERE id = $1",
      [id],
    );

    if (result.rows.length === 0) {
      return done(null, false); // Signify user not found to clear session
    }

    done(null, result.rows[0]);
  } catch (err) {
    console.error("❌ Passport Deserialization Error:", err);
    done(err);
  }
});
