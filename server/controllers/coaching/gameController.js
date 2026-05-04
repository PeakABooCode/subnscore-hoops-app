/**
 * This is the "Brain" of the game storage.
 * It handles the heavy lifting of saving teams, players, stats, action logs, and substitution history.
 */

import pool from "../../config/db.js";

export const saveGameSession = async (req, res) => {
  const {
    gameId: clientGameId, // Frontend-generated UUID for upsert — may be null for legacy saves
    teamMeta,
    roster,
    playerStats,
    calculatedQuarterStats,
    actionHistory,
    timeouts,
    finalScoreUs,
    finalScoreThem,
    quarter,
    finalClock,
    lineupsByQuarter,
  } = req.body;

  const coachId = req.user.id;

  try {
    await pool.query("BEGIN");

    // 1. Upsert team
    let teamRes = await pool.query(
      "SELECT id FROM teams WHERE coach_id = $1 AND name = $2",
      [coachId, teamMeta.teamName],
    );
    let teamId;
    if (teamRes.rows.length > 0) {
      teamId = teamRes.rows[0].id;
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

    // 2. Upsert game record — if clientGameId is provided the same game is updated in-place
    //    (heartbeat + manual save are both idempotent this way)
    const gameResult = await pool.query(
      `INSERT INTO games
         (id, team_id, opponent_name, final_score_us, final_score_them,
          game_mode, final_clock, quarter, lineups_by_quarter, division)
       VALUES
         (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         team_id            = EXCLUDED.team_id,
         opponent_name      = EXCLUDED.opponent_name,
         final_score_us     = EXCLUDED.final_score_us,
         final_score_them   = EXCLUDED.final_score_them,
         game_mode          = EXCLUDED.game_mode,
         final_clock        = EXCLUDED.final_clock,
         quarter            = EXCLUDED.quarter,
         lineups_by_quarter = EXCLUDED.lineups_by_quarter,
         division           = EXCLUDED.division,
         game_date          = CURRENT_TIMESTAMP
       RETURNING id`,
      [
        clientGameId || null,
        teamId,
        teamMeta.opponent,
        finalScoreUs || 0,
        finalScoreThem || 0,
        teamMeta.game_mode || "FULL",
        finalClock || 0,
        quarter || 1,
        JSON.stringify(lineupsByQuarter || {}),
        teamMeta.division || null,
      ],
    );
    const gameId = gameResult.rows[0].id;

    // 3. Wipe child records so re-saves are always a clean slate (idempotent)
    await pool.query("DELETE FROM game_stats           WHERE game_id = $1", [gameId]);
    await pool.query("DELETE FROM player_quarter_stats WHERE game_id = $1", [gameId]);
    await pool.query("DELETE FROM action_logs          WHERE game_id = $1", [gameId]);
    await pool.query("DELETE FROM substitution_logs    WHERE game_id = $1", [gameId]);

    // 4. Map players and insert box-score stats
    // rosterMap lets steps 5 and 6 snapshot name/jersey without extra DB hits.
    const playerMap = {};
    const rosterMap = {};
    for (const player of roster) {
      let pResult = await pool.query(
        "SELECT id FROM players WHERE team_id = $1 AND name = $2 AND jersey_number = $3",
        [teamId, player.name, player.jersey],
      );
      let dbPlayerId;
      if (pResult.rows.length > 0) {
        dbPlayerId = pResult.rows[0].id;
      } else {
        const ins = await pool.query(
          "INSERT INTO players (team_id, name, jersey_number) VALUES ($1, $2, $3) RETURNING id",
          [teamId, player.name, player.jersey],
        );
        dbPlayerId = ins.rows[0].id;
      }
      playerMap[player.id] = dbPlayerId;
      rosterMap[player.id] = { name: player.name, jersey: player.jersey };

      const stats = playerStats[player.id] || {};
      await pool.query(
        `INSERT INTO game_stats
           (game_id, player_id, player_name, player_jersey,
            points, fouls, turnovers, minutes, seconds_played)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [gameId, dbPlayerId, player.name, player.jersey,
         stats.score || 0, stats.fouls || 0,
         stats.turnovers || 0, player.calculatedMins || "0:00", player.rawSeconds || 0],
      );
    }

    // 5. Quarter stats — snapshot player identity alongside the stats
    for (const qStat of calculatedQuarterStats) {
      const pInfo = rosterMap[qStat.playerId] || {};
      await pool.query(
        `INSERT INTO player_quarter_stats
           (game_id, player_id, player_name, player_jersey,
            quarter, points, fouls, turnovers, seconds_played)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [gameId, playerMap[qStat.playerId] || null,
         pInfo.name || null, pInfo.jersey || null,
         qStat.quarter, qStat.points, qStat.fouls, qStat.turnovers, qStat.secondsPlayed],
      );
    }

    // 6. Action logs and substitution logs — snapshot player identity in every row
    for (const log of actionHistory) {
      const dbPlayerId = log.playerId ? playerMap[log.playerId] || null : null;
      const pInfo = log.playerId ? rosterMap[log.playerId] || {} : {};
      await pool.query(
        `INSERT INTO action_logs
           (game_id, player_id, player_name, player_jersey,
            action_type, amount, quarter, time_remaining)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [gameId, dbPlayerId, pInfo.name || null, pInfo.jersey || null,
         log.type, log.amount || 0, log.quarter, log.clock],
      );
      if (log.type === "SUB_IN" || log.type === "SUB_OUT") {
        await pool.query(
          `INSERT INTO substitution_logs
             (game_id, player_id, player_name, player_jersey,
              quarter, time_remaining, action_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [gameId, dbPlayerId, pInfo.name || null, pInfo.jersey || null,
           log.quarter, log.clock, log.type === "SUB_IN" ? "IN" : "OUT"],
        );
      }
    }

    await pool.query("COMMIT");
    res.json({ message: "Game saved successfully!", gameId });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Database Save Error:", err.message, err.code); // full detail stays server-side only
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

    // LEFT JOIN + COALESCE: snapshot columns serve deleted players;
    // live JOIN serves older records saved before the snapshot columns existed.
    const stats = await pool.query(
      `SELECT gs.*,
              COALESCE(gs.player_name, p.name) AS name,
              COALESCE(gs.player_jersey, p.jersey_number) AS jersey_number
       FROM game_stats gs
       LEFT JOIN players p ON gs.player_id = p.id
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
