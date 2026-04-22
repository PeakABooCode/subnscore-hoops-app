import express from "express";
import bcrypt from "bcrypt";
import passport from "passport";
import pool from "../config/db.js";
import rateLimit from "express-rate-limit";

const router = express.Router();

// --- RATE LIMITING ---
// Limit to 5 requests per 1 minute for security-sensitive endpoints
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: "Too many attempts from this IP, please try again after a minute.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Standard limiter for less sensitive routes (30 requests per minute)
const standardLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

// --- REGISTER ROUTE ---
router.post("/register", authLimiter, async (req, res) => {
  console.log(`📝 Attempting registration for: ${req.body.email}`);
  const { name, email, password } = req.body;

  // 1. Input Validation
  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ error: "Name, email, and password are required." });
  }

  try {
    // Hash the password (salt rounds = 10)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Save to database
    const newUser = await pool.query(
      "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email",
      [name, email, passwordHash],
    );

    // 2. Safe data access
    const createdUser = newUser.rows[0];
    if (!createdUser) {
      throw new Error("User creation failed: No rows returned from database.");
    }

    console.log(`✅ User created: ${createdUser.id}`);
    res.json({ message: "Registered successfully. Please log in." });
  } catch (err) {
    console.error("❌ Registration Error:", err);
    // PostgreSQL code '23505' for "Unique Violation"
    if (err.code === "23505")
      return res.status(400).json({ error: "Email already exists" });
    res.status(500).json({ error: "Server error" });
  }
});

// --- LOGIN ROUTE ---
router.post(
  "/login",
  authLimiter,
  passport.authenticate("local"),
  (req, res) => {
    // If passport fails, it automatically sends a 401 error.
    // If it succeeds, it reaches here.
    res.json({ message: "Logged in successfully", user: req.user });
  },
);

// --- LOGOUT ROUTE ---
router.post("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.json({ message: "Logged out successfully" });
  });
});

// --- GET CURRENT USER (Session Check) ---
router.get("/me", standardLimiter, (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ user: req.user });
  } else {
    res.status(401).json({ error: "Not authenticated" });
  }
});

// --- GOOGLE AUTH TRIGGER ---
// This is what window.location.href = ".../google" hits
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);

// --- GOOGLE CALLBACK ---
router.get(
  "/google/callback",
  passport.authenticate("google", {
    //failureRedirect: "http://localhost:5173/login",
    failureRedirect: "/login",
  }),
  (req, res) => {
    // Successful login -> Redirect back to your React app
    // res.redirect("http://localhost:5173/");
    res.redirect("/");
  },
);

export default router;
