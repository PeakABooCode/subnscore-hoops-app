OfficialGameDetailsModal



import React from "react";
import { X, History, Trophy, Clock } from "lucide-react";
import { formatTime } from "../../utils/helpers";

export default function OfficialGameDetailsModal({ isOpen, onClose, data }) {
  if (!isOpen || !data) return null;

  const { game, logs } = data;

  return (
    <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center p-4 z-[10000] backdrop-blur-sm">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 p-6 flex justify-between items-center border-b-4 border-amber-500">
          <div className="flex items-center gap-3">
            <Trophy className="text-amber-500" size={28} />
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">
                Official Game Report
              </h2>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                {game.league} • Season {game.season} • {game.division}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-xl"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-8">
          {/* Scoreboard Summary */}
          <div className="grid grid-cols-3 items-center gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <div className="text-center">
              <p className="text-[15px] font-black text-blue-500 uppercase tracking-widest mb-1 truncate">
                {game.team_a_name}
              </p>
              <h3 className="text-5xl font-black text-slate-900">{game.final_score_a}</h3>
            </div>
            
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black bg-slate-900 text-white px-3 py-1 rounded-full uppercase mb-2">
                FINAL RESULT
              </span>
              <div className="text-slate-300 font-black text-2xl tracking-tighter">VS</div>
            </div>

            <div className="text-center">
              <p className="text-[15px] font-black text-red-500 uppercase tracking-widest mb-1 truncate">
                {game.team_b_name}
              </p>
              <h3 className="text-5xl font-black text-slate-900">{game.final_score_b}</h3>
            </div>
          </div>

          {/* Full Play-by-Play Log */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <History size={16} /> Official Play-by-Play
            </h3>
            
            <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-50">
              {logs.length === 0 ? (
                <div className="p-10 text-center text-slate-300 font-bold italic">
                  No logs recorded for this match.
                </div>
              ) : (
                logs.map((log, idx) => (
                  <div key={log.id || idx} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center min-w-[40px]">
                        <span className="text-[15px] font-black text-slate-900 uppercase">
                          {log.quarter > 4 ? `OT${log.quarter-4}` : `Q${log.quarter}`}
                        </span>
                        <span className="text-[15px] font-mono font-black text-blue-600">
                          {formatTime(log.time_remaining)}
                        </span>
                      </div>
                      
                      <div className="flex flex-col">
                        {log.action_type !== "PERIOD_END" && (
                          <span className={`text-[13px] font-black uppercase ${log.team_side === 'A' ? 'text-blue-600' : 'text-red-600'}`}>
                            {log.team_side === 'A' ? game.team_a_name : game.team_b_name}
                          </span>
                        )}
                        <span className="text-sm font-bold text-slate-800">
                          {log.action_type === "PERIOD_END"
                            ? "PERIOD CHANGE"
                            : log.player_id
                            ? `#${log.jersey} ${log.player_name}`
                            : "TEAM ACTION"}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className={`px-3 py-1 rounded-lg text-[12px] font-black uppercase tracking-wider ${
                        log.action_type === 'SCORE' ? 'bg-emerald-100 text-emerald-700' :
                        log.action_type === 'SCORE_ADJUST' ? 'bg-emerald-100 text-emerald-700' :
                        log.action_type === 'FOUL' ? 'bg-red-100 text-red-700' :
                        log.action_type === 'TIMEOUT' ? 'bg-amber-100 text-amber-700' :
                        log.action_type === "ARROW_FLIP" ? 'bg-indigo-100 text-indigo-700' :
                        log.action_type === "GAME_START" ? 'bg-blue-100 text-blue-700' :
                        log.action_type === "PERIOD_END" ? 'bg-slate-200 text-slate-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {log.action_type === 'SCORE' ? `+${log.amount} PTS` :
                        log.action_type === 'SCORE_ADJUST' ? `${log.amount > 0 ? '+' : ''}${log.amount} PTS ADJ` :
                        log.action_type === 'FOUL' ? 'Personal Foul' :
                        log.action_type === 'TIMEOUT' ? 'Timeout' :
                        log.action_type === "ARROW_FLIP" ? `Possession to ${log.team_side === 'A' ? game.team_a_name : game.team_b_name}` :
                        log.action_type === "PERIOD_END" ? `End of ${log.quarter > 4 ? `OT ${log.quarter - 4}` : `Q${log.quarter}`}` :
                        log.action_type === "GAME_START" ? `Tip-off won by ${log.team_side === 'A' ? game.team_a_name : game.team_b_name}` :
                        log.action_type}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest shadow-lg hover:bg-black transition-all active:scale-95">
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
}