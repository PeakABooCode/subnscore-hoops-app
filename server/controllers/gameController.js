/**
 * This is the "Brain" of the game storage.
 * It handles the heavy lifting of saving teams, players, stats, action logs, and substitution history.
 */

import pool from "../config/db.js";

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
        "UPDATE teams SET league = $1, season = $2 WHERE id = $3",
        [teamMeta.league, teamMeta.season, teamId],
      );
    } else {
      const newTeam = await pool.query(
        "INSERT INTO teams (coach_id, name, league, season) VALUES ($1, $2, $3, $4) RETURNING id",
        [coachId, teamMeta.teamName, teamMeta.league, teamMeta.season],
      );
      teamId = newTeam.rows[0].id;
    }

    // 2. Insert the Game record with final scores
    const gameResult = await pool.query(
      `INSERT INTO games (team_id, opponent_name, final_score_us, final_score_them) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [teamId, teamMeta.opponent, finalScoreUs || 0, finalScoreThem || 0],
    );
    const gameId = gameResult.rows[0].id;

    // 3. Map Players and save Box Score Stats
    const playerMap = {}; // Maps frontend temporary IDs to Database UUIDs

    for (const player of roster) {
      const pResult = await pool.query(
        `INSERT INTO players (team_id, name, jersey_number) 
         VALUES ($1, $2, $3) RETURNING id`,
        [teamId, player.name, player.jersey],
      );
      const dbPlayerId = pResult.rows[0].id;
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
          player.calculatedMins || "0:00", // Data from App.jsx
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
          playerMap[qStat.playerId],
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
      await pool.query(
        `INSERT INTO action_logs (game_id, player_id, action_type, amount, quarter, time_remaining) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          gameId,
          playerMap[log.playerId],
          log.type,
          log.amount || 0,
          log.quarter,
          log.clock,
        ],
      );

      // B. Save to substitution_logs if the type matches a sub event
      if (log.type === "SUB_IN" || log.type === "SUB_OUT") {
        const mappedType = log.type === "SUB_IN" ? "IN" : "OUT";
        const intervalValue = `${log.clock} seconds`;

        await pool.query(
          `INSERT INTO substitution_logs (game_id, player_id, quarter, time_remaining, action_type) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            gameId,
            playerMap[log.playerId],
            log.quarter,
            intervalValue,
            mappedType,
          ],
        );
      }
    }

    await pool.query("COMMIT");
    res.json({ message: "Game saved successfully!", gameId });
  } catch (err) {
    await pool.query("ROLLBACK");
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
    const qStats = await pool.query(
      `SELECT * FROM player_quarter_stats WHERE game_id = $1`,
      [id],
    );

    res.json({
      game: gameMeta.rows[0],
      stats: stats.rows,
      logs: logs.rows,
      quarterStats: qStats.rows,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load game details" });
  }
};
