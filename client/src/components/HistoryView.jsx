import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Calendar,
  Users,
  ChevronRight,
  Activity,
  Trash2,
  Search,
} from "lucide-react";
import ConfirmationModal from "./ConfirmationModal";

export default function HistoryView({ onViewGame }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [gameToDelete, setGameToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const res = await axios.get("/api/games");
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
      await axios.delete(`/api/games/${gameToDelete}`);
      setGames(games.filter((g) => g.id !== gameToDelete));
      setIsConfirmOpen(false);
      setGameToDelete(null);
    } catch (err) {
      console.error("Error deleting game:", err);
    }
  };

  const filteredGames = games.filter((g) => {
    const search = searchTerm.toLowerCase().trim();
    return (
      g.opponent_name?.toLowerCase().includes(search) ||
      g.team_name?.toLowerCase().includes(search)
    );
  });

  if (loading)
    return <div className="text-center p-10 font-bold">Loading History...</div>;

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
                No games match your search "{searchTerm}"
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
