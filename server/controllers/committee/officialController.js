//This controller handles the initialization of an "Official Game" by creating or finding both teams and setting up the dual-lineup structure.
import pool from "../../config/db.js";

/**
 * Initializes an official game scoresheet with two teams.
 */
export const initializeOfficialGame = async (req, res) => {
  const { teamAName, teamBName, teamARoster, teamBRoster, league, season, division } =
    req.body;
  const officialId = req.user.id;

  try {
    await pool.query("BEGIN");

    // 1. Helper to Upsert Team and Players
    const setupTeam = async (name, roster) => {
      // Find or create team (Owned by the committee/official for this specific game context)
      let teamRes = await pool.query(
        "SELECT id FROM official_teams WHERE official_id = $1 AND name = $2",
        [officialId, name],
      );

      let teamId;
      if (teamRes.rows.length > 0) {
        teamId = teamRes.rows[0].id;
        // Update existing team meta if it has changed
        await pool.query(
          "UPDATE official_teams SET league = $1, season = $2, division = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4",
          [league, season, division, teamId]
        );
      } else {
        const newTeam = await pool.query(
          "INSERT INTO official_teams (official_id, name, league, season, division) VALUES ($1, $2, $3, $4, $5) RETURNING id",
          [officialId, name, league, season, division],
        );
        teamId = newTeam.rows[0].id;
      }

      // Sync Players
      const playerMap = {}; // Map client-side temp ID to DB UUID
      for (const p of roster) {
        const pRes = await pool.query(
          "INSERT INTO official_players (team_id, name, jersey_number) VALUES ($1, $2, $3) " +
            "ON CONFLICT (team_id, jersey_number) DO UPDATE SET name = EXCLUDED.name RETURNING id",
          [teamId, p.name, p.jersey],
        );
        playerMap[p.id] = pRes.rows[0].id; // Store mapping
      }
      return { teamId, playerMap };
    };

    const teamAData = await setupTeam(teamAName, teamARoster);
    const teamBData = await setupTeam(teamBName, teamBRoster);

    // Prepare initial lineup snapshots (Starters for Team A and Team B)
    const initialLineups = {
      teamA: teamARoster.slice(0, 5).map(p => p.id),
      teamB: teamBRoster.slice(0, 5).map(p => p.id)
    };

    // 2. Create the Game Record
    // Note: We are using team_id as Team A and opponent_name as Team B's name for compatibility,
    // but we can store Team B's ID in a new column later if needed.
    const gameRes = await pool.query(
      `INSERT INTO official_games (team_a_id, team_b_id, team_b_name, game_mode, league, season, official_id, lineups_by_quarter, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'LIVE') RETURNING id`,
      [teamAData.teamId, teamBData.teamId, teamBName, "FULL", league, season, officialId, JSON.stringify(initialLineups)],
    );

    const gameId = gameRes.rows[0].id;

    await pool.query("COMMIT");

    res.json({
      message: "Official Game Initialized",
      gameId,
      teamAId: teamAData.teamId,
      teamBId: teamBData.teamId,
      teamAPlayerMap: teamAData.playerMap,
      teamBPlayerMap: teamBData.playerMap,
    });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Official Setup Error:", err);
    res
      .status(500)
      .json({ error: "Failed to initialize official scoresheet." });
  }
};

export const saveOfficialGame = async (req, res) => {
  const { gameId, finalScoreA, finalScoreB, finalClock, finalQuarter, logs } = req.body;
  const officialId = req.user.id;

  try {
    await pool.query("BEGIN");

    // 1. Update Game Metadata
    await pool.query(
      `UPDATE official_games 
       SET final_score_a = $1, final_score_b = $2, final_clock = $3, final_quarter = $4, status = 'COMPLETED'
       WHERE id = $5 AND official_id = $6`,
      [finalScoreA, finalScoreB, finalClock, finalQuarter, gameId, officialId]
    );

    // 2. Clear previous logs to prevent duplicates on re-save
    await pool.query("DELETE FROM official_action_logs WHERE game_id = $1", [gameId]);

    // 3. Insert logs into official_action_logs
    if (logs && Array.isArray(logs)) {
      for (const log of logs) {
        // Map team_side from log properties
        const teamSide = log.team || log.to || log.winner || 'A';

        await pool.query(
          `INSERT INTO official_action_logs (game_id, player_id, action_type, team_side, amount, quarter, time_remaining)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            gameId,
            log.dbPlayerId || null, // Use the mapped DB player ID
            log.type,
            teamSide,
            log.amount || 0,
            log.quarter,
            log.clock || 0
          ]
        );
      }
    }

    await pool.query("COMMIT");
    res.json({ message: "Official game saved successfully!" });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Official Save Error:", err);
    res.status(500).json({ error: "Failed to save official game data." });
  }
};

export const getOfficialGames = async (req, res) => {
  const officialId = req.user.id;
  try {
    const result = await pool.query(
      `SELECT g.*, 
              ta.name as team_a_display, 
              tb.name as team_b_display
       FROM official_games g
       JOIN official_teams ta ON g.team_a_id = ta.id
       JOIN official_teams tb ON g.team_b_id = tb.id
       WHERE g.official_id = $1
       ORDER BY g.game_date DESC`,
      [officialId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch Official Games Error:", err);
    res.status(500).json({ error: "Failed to fetch official games history." });
  }
};

export const deleteOfficialGame = async (req, res) => {
  const { id } = req.params;
  const officialId = req.user.id;

  try {
    await pool.query("BEGIN");

    // Verify ownership
    const check = await pool.query(
      "SELECT id FROM official_games WHERE id = $1 AND official_id = $2",
      [id, officialId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: "Game not found or unauthorized." });
    }

    await pool.query("DELETE FROM official_action_logs WHERE game_id = $1", [id]);
    await pool.query("DELETE FROM official_games WHERE id = $1", [id]);

    await pool.query("COMMIT");
    res.json({ message: "Official game deleted successfully." });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Delete Official Game Error:", err);
    res.status(500).json({ error: "Failed to delete official game." });
  }
};
