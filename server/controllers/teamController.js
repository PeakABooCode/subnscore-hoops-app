import pool from "../config/db.js";

export const saveRoster = async (req, res) => {
  const { teamName, roster } = req.body;
  let coachId;
  try {
    coachId = req.user.id; // Ensure coachId is defined within the try block
    await pool.query("BEGIN");

    // 1. Upsert Team (Find existing or create)
    let teamRes = await pool.query(
      "SELECT id FROM teams WHERE coach_id = $1 AND name = $2",
      [coachId, teamName],
    );

    let teamId;
    if (teamRes.rows.length > 0) {
      teamId = teamRes.rows[0].id;
      // Update timestamp when roster is saved
      await pool.query(
        "UPDATE teams SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [teamId],
      );
    } else {
      const newTeam = await pool.query(
        "INSERT INTO teams (coach_id, name) VALUES ($1, $2) RETURNING id",
        [coachId, teamName],
      );
      teamId = newTeam.rows[0].id;
    }

    // 2. Sync Roster (Preserve existing IDs to keep historical stats linked)
    for (const player of roster) {
      // Check if player already exists in this team
      const existingP = await pool.query(
        "SELECT id FROM players WHERE team_id = $1 AND name = $2 AND jersey_number = $3",
        [teamId, player.name, player.jersey],
      );

      if (existingP.rows.length === 0) {
        // Only insert if they are truly new
        await pool.query(
          "INSERT INTO players (team_id, name, jersey_number) VALUES ($1, $2, $3)",
          [teamId, player.name, player.jersey],
        );
      }
    }

    await pool.query("COMMIT");
    res.json({ message: "Team roster saved successfully!" });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Roster Save Error:", err);
    res.status(500).json({ error: "Failed to save permanent roster." });
  }
};

export const getTeamRoster = async (req, res) => {
  const { name } = req.params;
  let coachId;
  try {
    coachId = req.user.id; // Ensure coachId is defined within the try block
    const result = await pool.query(
      `SELECT p.name, p.jersey_number as jersey 
       FROM players p 
       JOIN teams t ON p.team_id = t.id 
       WHERE t.coach_id = $1 AND t.name = $2`,
      [coachId, name],
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch Roster Error:", err);
    res.status(500).json({ error: "Failed to load team roster." });
  }
};

export const getCoachTeams = async (req, res) => {
  try {
    const coachId = req.user.id;
    const result = await pool.query(
      `SELECT name, league, season, updated_at 
       FROM teams 
       WHERE coach_id = $1 
       ORDER BY updated_at DESC`,
      [coachId],
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch Teams Error:", err);
    res.status(500).json({ error: "Failed to load teams list." });
  }
};
