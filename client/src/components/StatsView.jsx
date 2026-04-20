import React from "react";
import { formatTime } from "../utils/helpers";

export default function StatsView({
  roster,
  playerStats,
  stints,
  clock,
  teamMeta,
  quarter,
  resetGame,
}) {
  const calculateMins = (pId) => {
    let total = 0;
    stints
      .filter((s) => s.playerId === pId)
      .forEach((s) => {
        const out =
          s.clockOut !== null ? s.clockOut : s.quarter === quarter ? clock : 0;
        total += s.clockIn - out;
      });
    return formatTime(total);
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-xl shadow border overflow-hidden">
      <div className="bg-slate-900 p-4 text-white font-bold">
        {teamMeta?.teamName || "Team"} Final Report
      </div>
      <table className="w-full text-left">
        <thead className="bg-slate-50 border-b">
          <tr>
            <th className="p-4">Player</th>
            <th className="p-4 text-center">PTS</th>
            <th className="p-4 text-center">FLS</th>
            <th className="p-4 text-center">Total Min</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {roster.map((p) => (
            <tr key={p.id}>
              <td className="p-4">
                #{p.jersey} {p.name}
              </td>
              <td className="p-4 text-center font-bold">
                {playerStats[p.id]?.score || 0}
              </td>
              <td className="p-4 text-center text-red-600">
                {playerStats[p.id]?.fouls || 0}
              </td>
              <td className="p-4 text-center font-mono">
                {calculateMins(p.id)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* NEW: Start New Game Button */}
      <div className="flex justify-end">
        <button
          onClick={resetGame}
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all"
        >
          Trash Game & Start Over
        </button>
      </div>
    </div>
  );
}
