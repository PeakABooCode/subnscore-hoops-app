import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Calendar,
  Users,
  ChevronRight,
  Activity,
  Trash2,
  Search,
  X,
  Download,
} from "lucide-react";
import ConfirmationModal from "../common/ConfirmationModal";

export default function HistoryView({ onViewGame }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [gameToDelete, setGameToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const res = await axios.get("/api/coaching/games");
        setGames(res.data);
      } catch (err) {
        console.error("Error fetching games", err);
      } finally {
        setLoading(false);
      }
    };
    fetchGames();
  }, []);

  const handleDeleteClick = (e, id) => {
    e.stopPropagation();
    setGameToDelete(id);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    try {
      await axios.delete(`/api/coaching/games/${gameToDelete}`);
      setGames(games.filter((g) => g.id !== gameToDelete));
      setIsConfirmOpen(false);
      setGameToDelete(null);
    } catch (err) {
      console.error("Error deleting game:", err);
    }
  };

  const filteredGames = games.filter((g) => {
    const search = searchTerm.toLowerCase().trim();
    const gameDate = new Date(g.game_date);

    const matchesSearch =
      g.opponent_name?.toLowerCase().includes(search) ||
      g.team_name?.toLowerCase().includes(search);

    let matchesDate = true;
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      matchesDate = matchesDate && gameDate >= start;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && gameDate <= end;
    }

    return matchesSearch && matchesDate;
  });

  const handleExportCSV = () => {
    const headers = [
      "Date",
      "Team Name",
      "Opponent Name",
      "Score (Us)",
      "Score (Them)",
    ];
    const rows = filteredGames.map((g) => [
      new Date(g.game_date).toLocaleDateString(),
      `"${g.team_name}"`,
      `"${g.opponent_name}"`,
      g.final_score_us,
      g.final_score_them,
    ]);

    const csvContent = [headers, ...rows].map((e) => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `subnscore_history_export_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading)
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center">
        <div className="relative mb-6">
          <div className="w-16 h-16 bg-amber-500 rounded-full border-4 border-slate-900 shadow-xl animate-bounce flex items-center justify-center overflow-hidden">
            <Activity className="text-white opacity-40" size={32} />
            <div className="absolute w-full h-0.5 bg-slate-900/10 rotate-45"></div>
            <div className="absolute w-full h-0.5 bg-slate-900/10 -rotate-45"></div>
          </div>
          <div className="w-12 h-1.5 bg-slate-200 rounded-[100%] mx-auto blur-sm animate-pulse"></div>
        </div>
        <div className="text-slate-900 font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">
          Loading History...
        </div>
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
          <Calendar className="text-blue-600" /> Game History
        </h2>

        <div className="relative flex-1 max-w-sm">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Search by team or opponent..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-bold text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Date Range Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[140px]">
          <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">
            From Date
          </label>
          <input
            type="date"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-all text-sm font-bold"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">
            To Date
          </label>
          <input
            type="date"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-all text-sm font-bold"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {filteredGames.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 text-xs font-black uppercase text-blue-600 hover:bg-blue-50 rounded-lg transition-all flex items-center gap-2 shrink-0 border border-blue-100"
            >
              <Download size={14} /> Export CSV
            </button>
          )}
          {(startDate || endDate || searchTerm) && (
            <button
              onClick={() => {
                setStartDate("");
                setEndDate("");
                setSearchTerm("");
              }}
              className="px-4 py-2 text-xs font-black uppercase text-red-500 hover:bg-red-50 rounded-lg transition-all flex items-center gap-2 shrink-0 border border-transparent hover:border-red-100"
            >
              <X size={14} /> Clear Filters
            </button>
          )}
        </div>
      </div>

      {games.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border-2 border-dashed border-slate-200 text-center">
          <p className="text-slate-400 font-bold">
            No games saved yet. Go win some!
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredGames.length === 0 ? (
            <div className="bg-slate-100 p-8 rounded-2xl text-center">
              <p className="text-slate-500 font-bold italic">
                No games match your current filters.
              </p>
            </div>
          ) : (
            filteredGames.map((g) => (
              <div
                key={g.id}
                onClick={() => onViewGame(g.id)}
                className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between hover:border-blue-500 transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-4 text-left">
                  <div className="bg-slate-100 p-3 rounded-lg group-hover:bg-blue-50 transition-colors">
                    <Activity
                      size={20}
                      className="text-slate-400 group-hover:text-amber-400"
                    />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 uppercase text-sm">
                      vs {g.opponent_name}
                    </h3>
                    <p className="text-xs text-slate-500 font-bold uppercase">
                      {new Date(g.game_date).toLocaleDateString()} •{" "}
                      {g.team_name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <span className="text-lg font-black text-slate-900">
                      {g.final_score_us} - {g.final_score_them}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleDeleteClick(e, g.id)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      title="Delete Game"
                    >
                      <Trash2 size={18} />
                    </button>
                    <ChevronRight className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Game History"
        message="Are you sure you want to permanently delete this game? This action will remove all statistics and logs and cannot be undone."
        confirmText="Delete Permanently"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />
    </div>
  );
}
