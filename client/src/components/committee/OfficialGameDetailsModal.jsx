OfficialGameDetailsModal;

import React from "react";
import {
  X,
  History,
  Trophy,
  Clock,
  ShieldAlert,
  Star,
  Printer,
} from "lucide-react";
import { formatTime } from "../../utils/helpers";

export default function OfficialGameDetailsModal({ isOpen, onClose, data }) {
  if (!isOpen || !data) return null;

  const { game, logs } = data;

  // --- Dynamic Awards Calculation ---
  const playerStats = {};
  logs.forEach((log) => {
    // Use player_id as key when available; fall back to player_name for players
    // whose official_players row was deleted (player_id becomes NULL but
    // player_name/player_jersey snapshots are still intact in the log).
    const playerKey = log.player_id || log.player_name;
    if (!playerKey) return; // skip team-level events (TIMEOUT, OPPONENT_SCORE, etc.)
    if (!playerStats[playerKey]) {
      playerStats[playerKey] = {
        id: log.player_id,
        name: log.player_name,
        jersey: log.jersey,
        team: log.team_side,
        points: 0,
        rebounds: 0,
        assists: 0,
        steals: 0,
        fouls: 0,
      };
    }
    const p = playerStats[playerKey];
    if (log.action_type === "SCORE" || log.action_type === "SCORE_ADJUST")
      p.points += log.amount || 0;
    else if (log.action_type === "REBOUND") p.rebounds += log.amount || 1;
    else if (log.action_type === "ASSIST") p.assists += log.amount || 1;
    else if (log.action_type === "STEAL") p.steals += log.amount || 1;
    else if (log.action_type === "FOUL") p.fouls += 1;
  });

  const players = Object.values(playerStats);

  const winningTeam =
    game.final_score_a > game.final_score_b
      ? "A"
      : game.final_score_b > game.final_score_a
        ? "B"
        : null;

  const eligiblePlayers = winningTeam
    ? players.filter((p) => p.team === winningTeam)
    : players;

  let mvp = null,
    dpoy = null,
    playmaker = null;
  if (eligiblePlayers.length > 0) {
    // MVP = Highest Efficiency: (PTS + REB + AST + STL - FLS)
    mvp = [...eligiblePlayers].sort(
      (a, b) =>
        b.points +
        b.rebounds +
        b.assists +
        b.steals -
        b.fouls -
        (a.points + a.rebounds + a.assists + a.steals - a.fouls),
    )[0];

    // DPOY = Heavily weighted to Steals and Rebounds
    const dpoyCandidates = [...eligiblePlayers].filter(
      (p) => p.steals + p.rebounds > 0,
    );
    if (dpoyCandidates.length > 0) {
      dpoy = dpoyCandidates.sort(
        (a, b) => b.steals * 2 + b.rebounds - (a.steals * 2 + a.rebounds),
      )[0];
    }

    // Playmaker = Most Assists
    const playmakerCandidates = [...eligiblePlayers].filter(
      (p) => p.assists > 0,
    );
    if (playmakerCandidates.length > 0) {
      playmaker = playmakerCandidates.sort((a, b) => b.assists - a.assists)[0];
    }
  }

  // Group players by team for the Boxscore
  const teamAPlayers = players
    .filter((p) => p.team === "A")
    .sort(
      (a, b) => (parseInt(a.jersey, 10) || 0) - (parseInt(b.jersey, 10) || 0),
    );
  const teamBPlayers = players
    .filter((p) => p.team === "B")
    .sort(
      (a, b) => (parseInt(a.jersey, 10) || 0) - (parseInt(b.jersey, 10) || 0),
    );

  // Pseudo-code: find the top performer per stat, but only within the winning team.
  // ELI5: Like giving gold stars only to the winning team's best players.
  // Logic: for each stat, compute the max value among winning-team players (ignore 0s).
  // Data state: leaders = { points: 18, rebounds: 7, ... } or {} if no winner / tie game.
  const winningTeamPlayers =
    winningTeam === "A"
      ? teamAPlayers
      : winningTeam === "B"
        ? teamBPlayers
        : [];
  const leaders = {};
  if (winningTeamPlayers.length > 0) {
    ["points", "rebounds", "assists", "steals", "fouls"].forEach((stat) => {
      const max = Math.max(...winningTeamPlayers.map((p) => p[stat]));
      if (max > 0) leaders[stat] = max;
    });
  }
  // Returns true only for the winning-team player who leads that stat category.
  const isLeader = (player, stat) =>
    player.team === winningTeam &&
    leaders[stat] !== undefined &&
    player[stat] === leaders[stat];

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[10000] backdrop-blur-sm print:static print:inset-auto print:bg-transparent print:p-0 print:block">
      <style type="text/css" media="print">
        {`
          @page { size: portrait; margin: 0.5in; }
          body * {
            visibility: hidden;
          }
          #official-report-modal, #official-report-modal * {
            visibility: visible;
          }
          #official-report-modal {
            position: relative;
            left: 0;
            top: 0;
            width: 100%;
          }
          /* Hide background elements from document flow to prevent extra blank pages */
          nav, 
          .max-w-6xl > *:not(.fixed) {
            display: none !important;
          }
          main, html, body {
            padding: 0 !important;
            margin: 0 !important;
            height: auto !important;
          }
          /* Force background highlight colors to print */
          #official-report-modal td {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        `}
      </style>
      <div
        id="official-report-modal"
        className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:w-full print:block print:overflow-visible print:rounded-none"
      >
        {/* Header */}
        <div className="bg-white p-6 flex justify-between items-center border-b border-slate-100 print:border-b-2 print:border-black">
          <div className="flex items-center gap-3">
            <Trophy className="text-amber-500" size={28} />
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
                Official Game Report
              </h2>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
                {game.game_date &&
                  `${new Date(game.game_date).toLocaleDateString()} • `}
                {game.league} • Season {game.season} • {game.division} DIVISION
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-900 transition-colors p-2 hover:bg-slate-100 rounded-xl print:hidden"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-8 print:space-y-4 print:overflow-visible print:p-0 print:py-2">
          {/* Scoreboard Summary */}
          <div className="grid grid-cols-3 items-center gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100 print:bg-transparent print:border-none print:p-0 print:mb-4">
            <div className="text-center">
              <p className="text-[15px] font-black text-blue-500 uppercase tracking-widest mb-1 truncate">
                {game.team_a_name}
              </p>
              <h3 className="text-5xl font-black text-slate-900">
                {game.final_score_a}
              </h3>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black bg-slate-900 text-white px-3 py-1 rounded-full uppercase mb-2">
                FINAL RESULT
              </span>
              <div className="text-slate-300 font-black text-2xl tracking-tighter">
                VS
              </div>
            </div>

            <div className="text-center">
              <p className="text-[15px] font-black text-red-500 uppercase tracking-widest mb-1 truncate">
                {game.team_b_name}
              </p>
              <h3 className="text-5xl font-black text-slate-900">
                {game.final_score_b}
              </h3>
            </div>
          </div>

          {/* Game Awards Section */}
          {players.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:grid-cols-3 print:gap-2">
              {/* MVP */}
              {mvp && (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-4 print:border-slate-300 print:bg-transparent">
                  <div className="bg-amber-100 p-3 rounded-xl text-amber-600">
                    <Trophy size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest">
                      Player of the Game
                    </p>
                    <p className="font-black text-slate-800 leading-tight flex items-center gap-1 flex-wrap">
                      {mvp.name}
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        (
                        {mvp.team === "A" ? game.team_a_name : game.team_b_name}
                        )
                      </span>
                    </p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">
                      {mvp.points} PTS • {mvp.rebounds} REB • {mvp.assists} AST
                    </p>
                  </div>
                </div>
              )}
              {/* DPOY */}
              {dpoy && (
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 p-4 rounded-2xl flex items-center gap-4 print:border-slate-300 print:bg-transparent">
                  <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
                    <ShieldAlert size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest">
                      Best Defensive
                    </p>
                    <p className="font-black text-slate-800 leading-tight flex items-center gap-1 flex-wrap">
                      {dpoy.name}
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        (
                        {dpoy.team === "A"
                          ? game.team_a_name
                          : game.team_b_name}
                        )
                      </span>
                    </p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">
                      {dpoy.steals} STL • {dpoy.rebounds} REB
                    </p>
                  </div>
                </div>
              )}
              {/* Playmaker */}
              {playmaker && (
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 p-4 rounded-2xl flex items-center gap-4 print:border-slate-300 print:bg-transparent">
                  <div className="bg-purple-100 p-3 rounded-xl text-purple-600">
                    <Star size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-purple-600 tracking-widest">
                      Playmaker
                    </p>
                    <p className="font-black text-slate-800 leading-tight flex items-center gap-1 flex-wrap">
                      {playmaker.name}
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        (
                        {playmaker.team === "A"
                          ? game.team_a_name
                          : game.team_b_name}
                        )
                      </span>
                    </p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">
                      {playmaker.assists} AST
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Team Boxscores */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid print:grid-cols-2 print:gap-4 print:space-y-0">
            {/* Team A Boxscore */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col print:break-inside-avoid print:border-slate-300">
              <div className="bg-blue-50 px-4 py-3 border-b border-blue-100">
                <h3 className="font-black text-blue-800 uppercase tracking-widest text-sm flex items-center gap-2">
                  {game.team_a_name} Boxscore
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[300px] print:text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[10px] uppercase tracking-widest">
                      <th className="p-3 font-black">Player</th>
                      <th className="p-3 font-black text-center">PTS</th>
                      <th className="p-3 font-black text-center">REB</th>
                      <th className="p-3 font-black text-center">AST</th>
                      <th className="p-3 font-black text-center">STL</th>
                      <th className="p-3 font-black text-center">FLS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {teamAPlayers.map((p) => (
                      <tr
                        key={p.id}
                        className="hover:bg-slate-50 print:border-b print:border-slate-200 print:break-inside-avoid"
                      >
                        <td className="p-3 flex items-center gap-2">
                          <span className="text-xs font-black text-slate-400 w-5">
                            #{p.jersey}
                          </span>
                          <span className="font-bold text-slate-700 text-xs sm:text-sm uppercase">
                            {p.name}
                          </span>
                        </td>
                        <td className={`p-3 text-center font-black ${isLeader(p, "points") ? "bg-amber-50 text-amber-500" : "text-slate-800"}`}>
                          {p.points}
                        </td>
                        <td className={`p-3 text-center font-bold ${isLeader(p, "rebounds") ? "bg-blue-50 text-blue-500" : "text-slate-600"}`}>
                          {p.rebounds}
                        </td>
                        <td className={`p-3 text-center font-bold ${isLeader(p, "assists") ? "bg-purple-50 text-purple-500" : "text-slate-600"}`}>
                          {p.assists}
                        </td>
                        <td className={`p-3 text-center font-bold ${isLeader(p, "steals") ? "bg-green-50 text-green-500" : "text-slate-600"}`}>
                          {p.steals}
                        </td>
                        <td className={`p-3 text-center font-bold ${isLeader(p, "fouls") ? "bg-red-50 text-red-500" : "text-slate-600"}`}>
                          {p.fouls}
                        </td>
                      </tr>
                    ))}
                    {teamAPlayers.length === 0 && (
                      <tr>
                        <td
                          colSpan="6"
                          className="p-4 text-center text-xs text-slate-400 font-bold italic"
                        >
                          No player stats recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Team B Boxscore */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col print:break-inside-avoid print:border-slate-300">
              <div className="bg-red-50 px-4 py-3 border-b border-red-100">
                <h3 className="font-black text-red-800 uppercase tracking-widest text-sm flex items-center gap-2">
                  {game.team_b_name} Boxscore
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[300px] print:text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[10px] uppercase tracking-widest">
                      <th className="p-3 font-black">Player</th>
                      <th className="p-3 font-black text-center">PTS</th>
                      <th className="p-3 font-black text-center">REB</th>
                      <th className="p-3 font-black text-center">AST</th>
                      <th className="p-3 font-black text-center">STL</th>
                      <th className="p-3 font-black text-center">FLS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {teamBPlayers.map((p) => (
                      <tr
                        key={p.id}
                        className="hover:bg-slate-50 print:border-b print:border-slate-200 print:break-inside-avoid"
                      >
                        <td className="p-3 flex items-center gap-2">
                          <span className="text-xs font-black text-slate-400 w-5">
                            #{p.jersey}
                          </span>
                          <span className="font-bold text-slate-700 text-xs sm:text-sm uppercase">
                            {p.name}
                          </span>
                        </td>
                        <td className={`p-3 text-center font-black ${isLeader(p, "points") ? "bg-amber-50 text-amber-500" : "text-slate-800"}`}>
                          {p.points}
                        </td>
                        <td className={`p-3 text-center font-bold ${isLeader(p, "rebounds") ? "bg-blue-50 text-blue-500" : "text-slate-600"}`}>
                          {p.rebounds}
                        </td>
                        <td className={`p-3 text-center font-bold ${isLeader(p, "assists") ? "bg-purple-50 text-purple-500" : "text-slate-600"}`}>
                          {p.assists}
                        </td>
                        <td className={`p-3 text-center font-bold ${isLeader(p, "steals") ? "bg-green-50 text-green-500" : "text-slate-600"}`}>
                          {p.steals}
                        </td>
                        <td className={`p-3 text-center font-bold ${isLeader(p, "fouls") ? "bg-red-50 text-red-500" : "text-slate-600"}`}>
                          {p.fouls}
                        </td>
                      </tr>
                    ))}
                    {teamBPlayers.length === 0 && (
                      <tr>
                        <td
                          colSpan="6"
                          className="p-4 text-center text-xs text-slate-400 font-bold italic"
                        >
                          No player stats recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="bg-white border-2 border-slate-200 text-slate-700 px-6 py-3 rounded-xl font-black uppercase tracking-widest shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2"
          >
            <Printer size={18} /> Print Report
          </button>
          <button
            onClick={onClose}
            className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest shadow-lg hover:bg-black transition-all active:scale-95 flex items-center gap-2"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
}
