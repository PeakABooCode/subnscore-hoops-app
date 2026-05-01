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
    if (!log.player_id) return;
    if (!playerStats[log.player_id]) {
      playerStats[log.player_id] = {
        id: log.player_id,
        name: log.player_name,
        points: 0,
        rebounds: 0,
        assists: 0,
        steals: 0,
        fouls: 0,
      };
    }
    const p = playerStats[log.player_id];
    if (log.action_type === "SCORE" || log.action_type === "SCORE_ADJUST")
      p.points += log.amount || 0;
    else if (log.action_type === "REBOUND") p.rebounds += log.amount || 1;
    else if (log.action_type === "ASSIST") p.assists += log.amount || 1;
    else if (log.action_type === "STEAL") p.steals += log.amount || 1;
    else if (log.action_type === "FOUL") p.fouls += 1;
  });

  const players = Object.values(playerStats);

  let mvp = null,
    dpoy = null,
    playmaker = null;
  if (players.length > 0) {
    // MVP = Highest Efficiency: (PTS + REB + AST + STL - FLS)
    mvp = [...players].sort(
      (a, b) =>
        b.points +
        b.rebounds +
        b.assists +
        b.steals -
        b.fouls -
        (a.points + a.rebounds + a.assists + a.steals - a.fouls),
    )[0];

    // DPOY = Heavily weighted to Steals and Rebounds
    const dpoyCandidates = [...players].filter(
      (p) => p.steals + p.rebounds > 0,
    );
    if (dpoyCandidates.length > 0) {
      dpoy = dpoyCandidates.sort(
        (a, b) => b.steals * 2 + b.rebounds - (a.steals * 2 + a.rebounds),
      )[0];
    }

    // Playmaker = Most Assists
    const playmakerCandidates = [...players].filter((p) => p.assists > 0);
    if (playmakerCandidates.length > 0) {
      playmaker = playmakerCandidates.sort((a, b) => b.assists - a.assists)[0];
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[10000] backdrop-blur-sm print:bg-transparent print:p-0 print:block">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:w-full print:block">
        {/* Header */}
        <div className="bg-white p-6 flex justify-between items-center border-b border-slate-100 print:border-b-2 print:border-black">
          <div className="flex items-center gap-3">
            <Trophy className="text-amber-500" size={28} />
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
                Official Game Report
              </h2>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
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

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-8 print:overflow-visible print:p-0 print:py-4">
          {/* Scoreboard Summary */}
          <div className="grid grid-cols-3 items-center gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* MVP */}
              {mvp && (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-4">
                  <div className="bg-amber-100 p-3 rounded-xl text-amber-600">
                    <Trophy size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest">
                      Player of the Game
                    </p>
                    <p className="font-black text-slate-800 leading-tight">
                      {mvp.name}
                    </p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">
                      {mvp.points} PTS • {mvp.rebounds} REB • {mvp.assists} AST
                    </p>
                  </div>
                </div>
              )}
              {/* DPOY */}
              {dpoy && (
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 p-4 rounded-2xl flex items-center gap-4">
                  <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
                    <ShieldAlert size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest">
                      Best Defensive
                    </p>
                    <p className="font-black text-slate-800 leading-tight">
                      {dpoy.name}
                    </p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">
                      {dpoy.steals} STL • {dpoy.rebounds} REB
                    </p>
                  </div>
                </div>
              )}
              {/* Playmaker */}
              {playmaker && (
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 p-4 rounded-2xl flex items-center gap-4">
                  <div className="bg-purple-100 p-3 rounded-xl text-purple-600">
                    <Star size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-purple-600 tracking-widest">
                      Playmaker
                    </p>
                    <p className="font-black text-slate-800 leading-tight">
                      {playmaker.name}
                    </p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">
                      {playmaker.assists} AST
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Full Play-by-Play Log */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 flex flex-col gap-3 shadow-sm">
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
              <History size={14} className="text-amber-500" /> Official
              Play-by-Play
            </h3>
            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-2 custom-scrollbar print:max-h-none print:overflow-visible">
              {logs.length === 0 ? (
                <p className="text-[10px] text-slate-400 italic text-center py-10 font-bold uppercase tracking-widest">
                  No events recorded
                </p>
              ) : (
                logs.map((log, idx) => {
                  const isScore =
                    log.action_type === "SCORE" ||
                    log.action_type === "SCORE_ADJUST";
                  const isFoul = log.action_type === "FOUL";
                  const isTimeout = log.action_type === "TIMEOUT";
                  const isSub =
                    log.action_type === "SUB_IN" ||
                    log.action_type === "SUB_OUT";
                  const isStat =
                    log.action_type === "REBOUND" ||
                    log.action_type === "ASSIST" ||
                    log.action_type === "STEAL";

                  return (
                    <div
                      key={log.id || idx}
                      className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
                        isScore
                          ? "bg-emerald-50 border-emerald-100"
                          : isFoul
                            ? "bg-red-50 border-red-100"
                            : isTimeout
                              ? "bg-amber-50 border-amber-100"
                              : isSub
                                ? "bg-indigo-50 border-indigo-100"
                                : isStat
                                  ? "bg-cyan-50 border-cyan-100"
                                  : "bg-slate-50 border-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black bg-white text-slate-600 w-5 h-5 rounded-full flex items-center justify-center border border-slate-200 shadow-sm">
                          {log.quarter > 4
                            ? `OT${log.quarter - 4}`
                            : `Q${log.quarter}`}
                        </span>
                        <div className="flex flex-col">
                          <span
                            className={`text-[9px] font-black uppercase leading-tight ${log.team_side === "A" ? "text-blue-600" : log.team_side === "B" ? "text-red-600" : "text-slate-500"}`}
                          >
                            {log.action_type === "TIMEOUT" ||
                            log.action_type === "SCORE_ADJUST"
                              ? `TEAM ${log.team_side === "A" ? game.team_a_name : game.team_b_name}`
                              : log.action_type === "GAME_START"
                                ? `TIP-OFF: ${log.team_side === "A" ? game.team_a_name : game.team_b_name}`
                                : log.action_type === "ARROW_FLIP"
                                  ? `POSS: ${log.team_side === "A" ? game.team_a_name : game.team_b_name}`
                                  : log.action_type === "PERIOD_END"
                                    ? ""
                                    : log.player_name
                                      ? `#${log.jersey} ${log.player_name}`
                                      : "UNKNOWN PLAYER"}
                          </span>
                          <span
                            className={`text-[8px] font-bold uppercase tracking-tighter ${
                              isScore
                                ? "text-emerald-600"
                                : isFoul
                                  ? "text-red-600"
                                  : isTimeout
                                    ? "text-amber-600"
                                    : isSub
                                      ? "text-indigo-600"
                                      : isStat
                                        ? "text-cyan-600"
                                        : "text-slate-500"
                            }`}
                          >
                            {log.action_type === "FOUL"
                              ? "PERSONAL FOUL"
                              : log.action_type === "TIMEOUT"
                                ? "TIMEOUT"
                                : log.action_type === "SCORE"
                                  ? `+${log.amount} PTS`
                                  : log.action_type === "REBOUND"
                                    ? "REBOUND"
                                    : log.action_type === "ASSIST"
                                      ? "ASSIST"
                                      : log.action_type === "STEAL"
                                        ? "STEAL"
                                        : log.action_type === "GAME_START"
                                          ? "JUMP BALL WON"
                                          : log.action_type === "PERIOD_END"
                                            ? "PERIOD END"
                                            : log.action_type === "ARROW_FLIP"
                                              ? "HELD BALL"
                                              : log.action_type ===
                                                  "SCORE_ADJUST"
                                                ? `${log.amount} SCORE ADJUST`
                                                : log.action_type === "SUB_IN"
                                                  ? "IN"
                                                  : log.action_type ===
                                                      "SUB_OUT"
                                                    ? "OUT"
                                                    : log.action_type}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] font-black text-slate-400 tabular-nums">
                          {formatTime(log.time_remaining)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
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
