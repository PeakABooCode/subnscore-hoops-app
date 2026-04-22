// server/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import session from "express-session";
import pgSession from "connect-pg-simple";
import passport from "passport";
import pool from "./config/db.js";
import "./config/passport.js"; // Imports our passport config
import authRoutes from "./routes/authRoutes.js"; // Imports our routes
import gameRoutes from "./routes/gameRoutes.js";

/**PREPARING BACKEND FOR PRODUCTION  */
// Add this to your main server.js file
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
);

// --- SESSION CONFIGURATION ---
const PgSession = pgSession(session);
app.use(
  session({
    store: new PgSession({
      pool: pool,
      tableName: "session", // Tells it to use the table we created in pgAdmin
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // true if using HTTPS
    },
  }),
);

// --- PASSPORT INIT ---
app.use(passport.initialize());
app.use(passport.session());

// --- ROUTES ---
app.use("/api/auth", authRoutes);
app.use("/api/games", gameRoutes);

// --- PRODUCTION STATIC ASSETS ---
// Serve static files from the React app
const clientBuildPath = path.join(__dirname, "../client/dist");
app.use(express.static(clientBuildPath));

// The "catchall" handler: for any request that doesn't match an API route
app.get("/*", (req, res) => {
  res.sendFile(path.join(clientBuildPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
