import pool from "../../config/db.js";

export const saveRoster = async (req, res) => {
  const { teamName, roster, league, season, division } = req.body;
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
      // Update metadata and timestamp
      await pool.query(
        "UPDATE teams SET league = $1, season = $2, division = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4",
        [league, season, division, teamId],
      );
    } else {
      const newTeam = await pool.query(
        "INSERT INTO teams (coach_id, name, league, season, division) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [coachId, teamName, league, season, division],
      );
      teamId = newTeam.rows[0].id;
    }

    const updatedRoster = [];
    const activeDbIds = [];

    // 2. Sync Roster with Stable Identity (ID-based Upsert)
    for (const player of roster) {
      let dbPlayerId = player.dbId;

      if (dbPlayerId) {
        // Update existing player record
        await pool.query(
          "UPDATE players SET name = $1, jersey_number = $2 WHERE id = $3 AND team_id = $4",
          [player.name, player.jersey, dbPlayerId, teamId],
        );
      } else {
        // Fallback: check by name/jersey if dbId is missing but record exists
        const check = await pool.query(
          "SELECT id FROM players WHERE team_id = $1 AND name = $2 AND jersey_number = $3",
          [teamId, player.name, player.jersey],
        );
        if (check.rows.length > 0) {
          dbPlayerId = check.rows[0].id;
        } else {
          // Truly a new player
          const insert = await pool.query(
            "INSERT INTO players (team_id, name, jersey_number) VALUES ($1, $2, $3) RETURNING id",
            [teamId, player.name, player.jersey],
          );
          dbPlayerId = insert.rows[0].id;
        }
      }

      // Only add to result if not already processed (prevents duplicate IDs in response)
      if (!activeDbIds.includes(dbPlayerId)) {
        activeDbIds.push(dbPlayerId);
        updatedRoster.push({ ...player, dbId: dbPlayerId, id: dbPlayerId });
      }
    }

    // 3. Delete players removed from the roster UI
    if (activeDbIds.length > 0) {
      await pool.query(
        "DELETE FROM players WHERE team_id = $1 AND id != ALL($2)",
        [teamId, activeDbIds],
      );
    }

    await pool.query("COMMIT");
    res.json({
      message: "Team roster saved successfully!",
      roster: updatedRoster,
    });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Roster Save Error:", err);
    res.status(500).json({ error: "Failed to save permanent roster." });
  }
};

export const getTeamRoster = async (req, res) => {
  const { name } = req.params;
  const user = req.user;
  try {
    let result;

    if (user.role === "COMMITTEE") {
      // Committee members ONLY search their own official_players and official_teams
      result = await pool.query(
        `SELECT p.id, p.name, p.jersey_number as jersey
         FROM official_players p
         JOIN official_teams t ON p.team_id = t.id
         WHERE t.official_id = $1 AND t.name = $2`,
        [user.id, name]
      );
    } else {
      result = await pool.query(
        `SELECT p.id, p.name, p.jersey_number as jersey
         FROM players p
         JOIN teams t ON p.team_id = t.id
         WHERE t.coach_id = $1 AND t.name = $2`,
        [user.id, name],
      );
    }

    res.json(result.rows);
  } catch (err) {
    console.error("Fetch Roster Error:", err);
    res.status(500).json({ error: "Failed to load team roster." });
  }
};

export const getCoachTeams = async (req, res) => {
  try {
    const user = req.user;
    let result;

    if (user.role === "COMMITTEE") {
      // Committee members ONLY search their own previously created official teams
      result = await pool.query(
        `SELECT id, name, league, season, division, updated_at, official_id
         FROM official_teams
         WHERE official_id = $1
         ORDER BY updated_at DESC`,
        [user.id]
      );
    } else {
      result = await pool.query(
        `SELECT id, name, league, season, division, updated_at 
         FROM teams 
         WHERE coach_id = $1 
         ORDER BY updated_at DESC`,
        [user.id],
      );
    }

    res.json(result.rows);
  } catch (err) {
    console.error("Fetch Teams Error:", err);
    res.status(500).json({ error: "Failed to load teams list." });
  }
};
