import React from "react";
import { Settings, UserPlus, Play } from "lucide-react";

export default function SetupView({
  user,
  teamMeta,
  setTeamMeta,
  roster,
  newPlayer,
  setNewPlayer,
  handleAddPlayer,
  handleRemovePlayer,
  startGame,
  setupAttempted,
  resetGame,
}) {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* SECTION 1: TEAM INFORMATION */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-4 text-slate-800 flex items-center gap-2">
          <Settings className="text-blue-600" size={20} /> Game Setup
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* TEAM NAME INPUT */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
              Your Team Name
              {setupAttempted && !teamMeta.teamName.trim() && (
                <span className="text-red-500 animate-pulse font-bold">*</span>
              )}
            </label>
            <input
              className={`border p-2.5 rounded-lg outline-none transition-all duration-200 ${
                setupAttempted && !teamMeta.teamName.trim()
                  ? "border-red-500 bg-red-50 ring-1 ring-red-200"
                  : "focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              }`}
              placeholder="e.g. Lakers"
              value={teamMeta.teamName}
              onChange={(e) =>
                setTeamMeta({ ...teamMeta, teamName: e.target.value })
              }
            />
          </div>

          {/* OPPONENT NAME INPUT */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
              Opponent Name
              {setupAttempted && !teamMeta.opponent.trim() && (
                <span className="text-red-500 animate-pulse font-bold">*</span>
              )}
            </label>
            <input
              className={`border p-2.5 rounded-lg outline-none transition-all duration-200 ${
                setupAttempted && !teamMeta.opponent.trim()
                  ? "border-red-500 bg-red-50 ring-1 ring-red-200"
                  : "focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              }`}
              placeholder="e.g. Bulls"
              value={teamMeta.opponent}
              onChange={(e) =>
                setTeamMeta({ ...teamMeta, opponent: e.target.value })
              }
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: ROSTER MANAGEMENT */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-4 text-slate-800 flex items-center gap-2">
          <UserPlus className="text-blue-600" size={20} /> Build Roster
          <span className="text-sm font-normal text-slate-500 ml-auto">
            ({roster.length} Players)
          </span>
        </h2>

        <form onSubmit={handleAddPlayer} className="flex gap-2">
          <input
            required
            className="border p-2.5 rounded-lg flex-1 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
            placeholder="Player Name"
            value={newPlayer.name}
            onChange={(e) =>
              setNewPlayer({ ...newPlayer, name: e.target.value })
            }
          />
          <input
            required
            className="border p-2.5 rounded-lg w-24 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
            placeholder="Jersey #"
            value={newPlayer.jersey}
            onChange={(e) =>
              setNewPlayer({ ...newPlayer, jersey: e.target.value })
            }
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm"
          >
            Add
          </button>
        </form>

        {/* LIST OF ADDED PLAYERS */}
        <div className="mt-6 flex flex-wrap gap-2">
          {roster.length === 0 ? (
            <p className="text-slate-400 italic text-sm">
              No players added yet. Minimum 5 required.
            </p>
          ) : (
            roster.map((p) => (
              <div
                key={p.id}
                className="bg-slate-100 pl-3 pr-1 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 border border-slate-200 group hover:border-slate-300 transition-all shadow-sm"
              >
                <span className="text-blue-700">#{p.jersey}</span>
                <span className="text-slate-700">{p.name}</span>
                <button
                  onClick={() => handleRemovePlayer(p.id)}
                  className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-red-500 hover:text-white transition-colors"
                  title="Remove Player"
                >
                  &times;
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* START GAME BUTTON */}
      <button
        onClick={startGame}
        className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-xl hover:bg-emerald-700 shadow-lg hover:shadow-xl transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
      >
        <Play fill="currentColor" size={20} /> Start Game Tracking
      </button>

      {/* NEW: Reset Data Button */}
      <div className="flex justify-center mt-4">
        <button
          onClick={resetGame}
          className="text-red-500 hover:text-red-700 text-sm font-bold underline transition-colors"
        >
          Clear all saved data and start fresh
        </button>
      </div>

      <p className="text-center text-slate-400 text-xs">
        Logged in as {user?.email || "Guest Coach"}
      </p>
    </div>
  );
}
