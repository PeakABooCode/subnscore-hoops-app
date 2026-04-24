import express from "express";
import {
  saveRoster,
  getTeamRoster,
  getCoachTeams,
} from "../controllers/teamController.js";

const router = express.Router();

// --- MIDDLEWARE: Check if user is logged in ---
const isAuth = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: "Unauthorized. Please log in." });
};

// All team routes are protected by session auth
router.get("/", isAuth, getCoachTeams);
router.post("/roster", isAuth, saveRoster);
router.get("/roster/:name", isAuth, getTeamRoster);

export default router;
