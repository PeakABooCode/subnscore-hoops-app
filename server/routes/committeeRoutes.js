import express from "express";
import {
  initializeOfficialGame,
  saveOfficialGame,
  getOfficialGames,
  getOfficialGameDetails,
  deleteOfficialGame,
  updateOfficialPlayer,
} from "../controllers/committee/officialController.js";
import { isOfficial } from "../config/middleware/roleMiddleware.js";


// This router will handle all official scoresheet and committee-level logic.
const router = express.Router();

// Placeholder route to verify the module is working
router.get("/status", (req, res) => {
  res.json({
    message: "Committee Scoresheet API is online",
    role: req.user?.role,
  });
});

router.post("/games/init", isOfficial, initializeOfficialGame);
router.post("/games/save", isOfficial, saveOfficialGame);
router.get("/games", isOfficial, getOfficialGames);
router.get("/games/:id", isOfficial, getOfficialGameDetails);
router.delete("/games/:id", isOfficial, deleteOfficialGame);
router.patch("/players/:id", isOfficial, updateOfficialPlayer);

export default router;