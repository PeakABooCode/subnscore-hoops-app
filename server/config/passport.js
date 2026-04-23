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
      console.log(`Attempting local login for: ${email}`);
      try {
        // Find user by email
        const result = await pool.query(
          "SELECT * FROM users WHERE email = $1",
          [email],
        );
        if (result.rows.length === 0) {
          console.log(`User not found: ${email}`);
          return done(null, false, {
            message: "No account found with this email. Please register.",
          });
        }

        const user = result.rows[0];

        // Handle users registered via Google who don't have a local password
        if (!user.password_hash) {
          console.log(
            `User ${email} has no password_hash, likely Google user.`,
          );
          return done(null, false, {
            message: "This account uses Google Login.",
          });
        }

        // Compare hashed password
        console.log(`User object for ${email}:`, user);
        console.log(`Password hash from DB for ${email}:`, user.password_hash);
        // Ensure password_hash is a string before comparing to prevent TypeError
        if (typeof user.password_hash !== "string") {
          throw new Error(
            `Invalid password hash format for user: ${email}. Expected string, got ${typeof user.password_hash}.`,
          );
        }
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
          return done(null, false, {
            message: "Incorrect password. Please try again.",
          });
        }

        console.log(`Login successful for: ${email}`);
        return done(null, user); // Success!
      } catch (err) {
        console.error(`Error during local login for ${email}:`, err);
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
      // Use an absolute URL to ensure consistency between authorization and token exchange
      callbackURL: "http://localhost:5000/api/auth/google/callback",
      proxy: true,
    },
    async (accessToken, refreshToken, profile, done) => {
      const email =
        profile.emails && profile.emails[0] ? profile.emails[0].value : null;
      const googleId = profile.id;
      const name = profile.displayName;

      try {
        console.log(`Attempting Google login for: ${email || googleId}`);

        // 1. Check if a user with this Google ID already exists
        let { rows } = await pool.query(
          "SELECT * FROM users WHERE google_id = $1",
          [googleId],
        );

        if (rows.length > 0) {
          console.log(`User found by Google ID: ${googleId}`);
          return done(null, rows[0]);
        }

        // 2. If not, check if a user with this EMAIL already exists (Account Linking)
        if (email) {
          const emailCheck = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email],
          );
          if (emailCheck.rows.length > 0) {
            // User registered with email/password previously. Link the Google account.
            console.log(`User found by email, linking Google ID: ${email}`);
            const updatedUser = await pool.query(
              "UPDATE users SET google_id = $1 WHERE email = $2 RETURNING *",
              [googleId, email],
            );
            return done(null, updatedUser.rows[0]);
          }
        }

        // 3. If neither exists, create a new user
        console.log(`Creating new user for Google ID: ${googleId}`);
        const newUser = await pool.query(
          "INSERT INTO users (name, email, google_id) VALUES ($1, $2, $3) RETURNING *",
          [name, email, googleId],
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
