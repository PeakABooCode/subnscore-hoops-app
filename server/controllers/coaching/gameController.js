/**
 * This is the "Brain" of the game storage.
 * It handles the heavy lifting of saving teams, players, stats, action logs, and substitution history.
 */

import pool from "../../config/db.js";

export const saveGameSession = async (req, res) => {
  const {
    teamMeta,
    roster,
    playerStats,
    calculatedQuarterStats,
    actionHistory,
    timeouts,
    finalScoreUs,
    finalScoreThem,
    quarter, // Added quarter to payload
    finalClock,
    division, // Add division to the destructuring
    lineupsByQuarter,
  } = req.body;

  const coachId = req.user.id;

  try {
    // We use a Transaction to ensure all-or-nothing saving (Atomic)
    await pool.query("BEGIN");

    // 1. Upsert the Team (Find existing by name/coach or create)
    let teamRes = await pool.query(
      "SELECT id FROM teams WHERE coach_id = $1 AND name = $2",
      [coachId, teamMeta.teamName],
    );

    let teamId;
    if (teamRes.rows.length > 0) {
      teamId = teamRes.rows[0].id;
      // Update league/season in case they changed
      await pool.query(
        "UPDATE teams SET league = $1, season = $2, division = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4",
        [teamMeta.league, teamMeta.season, teamMeta.division, teamId],
      );
    } else {
      const newTeam = await pool.query(
        "INSERT INTO teams (coach_id, name, league, season, division) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [coachId, teamMeta.teamName, teamMeta.league, teamMeta.season, teamMeta.division],
      );
      teamId = newTeam.rows[0].id;
    }

    // 2. Insert the Game record with final scores
    const gameResult = await pool.query(
      `INSERT INTO games (team_id, opponent_name, final_score_us, final_score_them, game_mode, final_clock, quarter, lineups_by_quarter) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        teamId,
        teamMeta.opponent,
        finalScoreUs || 0,
        finalScoreThem || 0,
        teamMeta.game_mode || "FULL",
        finalClock || 0,
        quarter || 1, // Use the quarter from the payload
        JSON.stringify(lineupsByQuarter || {}),
      ],
    );
    const gameId = gameResult.rows[0].id;

    // 3. Map Players and save Box Score Stats
    const playerMap = {}; // Maps frontend temporary IDs to Database UUIDs

    for (const player of roster) {
      // Check if player already exists in this team to prevent duplication
      let pResult = await pool.query(
        "SELECT id FROM players WHERE team_id = $1 AND name = $2 AND jersey_number = $3",
        [teamId, player.name, player.jersey],
      );

      let dbPlayerId;
      if (pResult.rows.length > 0) {
        dbPlayerId = pResult.rows[0].id;
      } else {
        const insertRes = await pool.query(
          "INSERT INTO players (team_id, name, jersey_number) VALUES ($1, $2, $3) RETURNING id",
          [teamId, player.name, player.jersey],
        );
        dbPlayerId = insertRes.rows[0].id;
      }

      playerMap[player.id] = dbPlayerId;

      const stats = playerStats[player.id] || {};

      // UPDATED: Added 'minutes' column to store the calculated playing time
      await pool.query(
        `INSERT INTO game_stats (game_id, player_id, points, fouls, turnovers, minutes, seconds_played) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          gameId,
          dbPlayerId,
          stats.score || 0,
          stats.fouls || 0,
          stats.turnovers || 0,
          player.calculatedMins || "0:00", // Store formatted string for the UI Box Score
          player.rawSeconds || 0,
        ],
      );
    }

    // 4. Save Summarized Quarter Stats
    for (const qStat of calculatedQuarterStats) {
      await pool.query(
        `INSERT INTO player_quarter_stats (game_id, player_id, quarter, points, fouls, turnovers, seconds_played) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          gameId,
          playerMap[qStat.playerId] || null, // Ensure null if player ID is missing
          qStat.quarter,
          qStat.points,
          qStat.fouls,
          qStat.turnovers,
          qStat.secondsPlayed,
        ],
      );
    }

    // 4. Save Action Logs & Specific Substitution Logs
    for (const log of actionHistory) {
      // A. Save to the general action_logs table
      // Use || null to ensure we never pass 'undefined' to the DB driver
      const dbPlayerId = log.playerId ? playerMap[log.playerId] || null : null;
      // IMPORTANT: The 'player_id' column in 'action_logs' table MUST be NULLABLE.

      await pool.query(
        `INSERT INTO action_logs (game_id, player_id, action_type, amount, quarter, time_remaining) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [gameId, dbPlayerId, log.type, log.amount || 0, log.quarter, log.clock],
      );

      // B. Save to substitution_logs if the type matches a sub event
      if (log.type === "SUB_IN" || log.type === "SUB_OUT") {
        const mappedType = log.type === "SUB_IN" ? "IN" : "OUT";

        await pool.query(
          `INSERT INTO substitution_logs (game_id, player_id, quarter, time_remaining, action_type) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            gameId,
            dbPlayerId, // Already calculated above with null safety
            log.quarter,
            log.clock, // Send as Integer to match action_logs data type
            mappedType,
          ],
        );
      }
    }

    await pool.query("COMMIT");
    res.json({ message: "Game saved successfully!", gameId });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Database Save Error Details:", err); // Log the full error for debugging
    console.error("Database Save Error:", err);
    res.status(500).json({ error: "Failed to save game data." });
  }
};

// 1. Get all games for the logged-in coach (for History List)
export const getGames = async (req, res) => {
  const coachId = req.user.id;
  try {
    const result = await pool.query(
      `SELECT g.*, t.name as team_name 
       FROM games g 
       JOIN teams t ON g.team_id = t.id 
       WHERE t.coach_id = $1 
       ORDER BY g.game_date DESC`,
      [coachId],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch games history" });
  }
};

// 2. Get full details of a specific game to rebuild the report (for History Details)
export const getGameDetails = async (req, res) => {
  const { id } = req.params;
  try {
    // JOIN with teams to get league and season for the header
    const gameMeta = await pool.query(
      `SELECT g.*, t.name as team_name, t.league, t.season 
       FROM games g 
       JOIN teams t ON g.team_id = t.id 
       WHERE g.id = $1`,
      [id],
    );

    const stats = await pool.query(
      `SELECT gs.*, p.name, p.jersey_number 
       FROM game_stats gs 
       JOIN players p ON gs.player_id = p.id 
       WHERE gs.game_id = $1`,
      [id],
    );
    const logs = await pool.query(
      `SELECT * FROM action_logs WHERE game_id = $1 ORDER BY quarter ASC, time_remaining DESC, id ASC`,
      [id],
    );
    const subLogs = await pool.query(
      `SELECT * FROM substitution_logs WHERE game_id = $1 ORDER BY quarter ASC, time_remaining DESC, action_type DESC`, // Order by action_type to get IN before OUT at same time
      [id],
    );

    const qStats = await pool.query(
      `SELECT * FROM player_quarter_stats WHERE game_id = $1`,
      [id],
    );

    res.json({
      game: gameMeta.rows[0],
      stats: stats.rows,
      logs: logs.rows,
      quarterStats: qStats.rows,
      substitutionLogs: subLogs.rows, // Add substitution logs to the response
      lineupsByQuarter: gameMeta.rows[0].lineups_by_quarter, // Pass snapshots to frontend
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load game details" });
  }
};

export const deleteGame = async (req, res) => {
  const { id } = req.params;
  const coachId = req.user.id;

  try {
    await pool.query("BEGIN");

    // Verify game ownership before deleting
    const gameCheck = await pool.query(
      `SELECT g.id FROM games g 
       JOIN teams t ON g.team_id = t.id 
       WHERE g.id = $1 AND t.coach_id = $2`,
      [id, coachId],
    );

    if (gameCheck.rows.length === 0) {
      await pool.query("ROLLBACK");
      return res.status(404).json({ error: "Game not found or unauthorized." });
    }

    await pool.query("DELETE FROM substitution_logs WHERE game_id = $1", [id]);
    await pool.query("DELETE FROM action_logs WHERE game_id = $1", [id]);
    await pool.query("DELETE FROM player_quarter_stats WHERE game_id = $1", [
      id,
    ]);
    await pool.query("DELETE FROM game_stats WHERE game_id = $1", [id]);
    await pool.query("DELETE FROM games WHERE id = $1", [id]);

    await pool.query("COMMIT");
    res.json({ message: "Game deleted successfully" });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Delete Game Error:", err);
    res.status(500).json({ error: "Failed to delete game data." });
  }
};
