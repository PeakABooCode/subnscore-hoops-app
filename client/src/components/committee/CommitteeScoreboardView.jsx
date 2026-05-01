import React, { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, Clock, Maximize, Minimize } from "lucide-react";
import { formatTime } from "../../utils/helpers";

export default function CommitteeScoreboardView() {
  const [data, setData] = useState({
    teamAName: "TEAM A",
    teamBName: "TEAM B",
    scores: { A: 0, B: 0 },
    teamFouls: { A: 0, B: 0 },
    quarter: 1,
    clock: 600,
    possessionArrow: null,
    shotClock: 24,
    timeouts: {
      A: 0,
      B: 0,
      max: 2,
    },
  });

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    // Create a broadcast channel to listen for updates from the controller
    const channel = new BroadcastChannel("subnscore_official_sync");

    channel.onmessage = (event) => {
      setData(event.data);
    };

    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);

    // Clean up on unmount
    return () => {
      channel.close();
      document.removeEventListener("fullscreenchange", handleFsChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const periodName =
    data.quarter > 4 ? `OT ${data.quarter - 4}` : `PERIOD ${data.quarter}`;

  return (
    <div className="fixed inset-0 bg-zinc-950 text-white flex flex-col font-sans overflow-y-auto p-4 md:p-8">
      {/* Main Scoreboard Area */}
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-0 py-8 lg:py-0">
        {/* Team A */}
        <div className="flex flex-col items-center space-y-2 lg:space-y-4 w-full lg:w-1/3">
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-black text-blue-500 uppercase text-center truncate w-full tracking-tighter">
            {data.teamAName}
          </h2>
          <div className="text-[5rem] sm:text-[8rem] md:text-[12rem] lg:text-[16rem] font-mono font-black leading-none tabular-nums text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
            {data.scores.A}
          </div>
          <div className="space-y-4 w-full flex flex-col items-center">
            {/* Team A Fouls */}
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((f) => (
                <div
                  key={f}
                  className={`w-4 h-4 md:w-6 md:h-6 lg:w-8 lg:h-8 rounded-full transition-all duration-300 ${data.teamFouls.A >= f ? "bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.8)]" : "bg-zinc-900 border border-zinc-800"}`}
                />
              ))}
            </div>
            {/* Team A Timeouts */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex gap-1.5">
                {Array.from({ length: data.timeouts.max }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-8 h-2 md:w-12 md:h-3 rounded-sm transition-all duration-300 ${i < data.timeouts.max - data.timeouts.A ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.6)]" : "bg-zinc-900"}`}
                  />
                ))}
              </div>
              <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                Timeouts
              </span>
            </div>
          </div>
        </div>

        {/* Center: Clock & Period */}
        <div className="flex flex-col items-center justify-center space-y-4 lg:space-y-8 w-full lg:w-1/3">
          {/* Period Indicator */}
          <div className="bg-amber-500 text-black px-6 py-1 lg:px-12 lg:py-3 rounded-xl lg:rounded-2xl text-xl md:text-3xl lg:text-5xl font-black uppercase tracking-tighter shadow-[0_0_20px_rgba(245,158,11,0.3)]">
            {periodName}
          </div>

          <div className="flex flex-col items-center gap-2 lg:gap-4">
            {/* Game Clock */}
            <div className="text-[4rem] sm:text-[6rem] md:text-[8rem] lg:text-[15rem] font-mono font-black tabular-nums bg-black px-6 py-1 lg:px-10 lg:py-2 rounded-2xl lg:rounded-3xl border-2 lg:border-4 border-zinc-900 text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.4)] leading-none">
              {formatTime(data.clock)}
            </div>

            {/* Shot Clock - LARGE and FLASHING */}
            <div className="flex flex-col items-center -mt-2 lg:mt-0">
              <div
                className={`text-[6rem] sm:text-[8rem] md:text-[10rem] lg:text-[12rem] font-mono font-black tabular-nums leading-none transition-colors duration-300 ${data.shotClock <= 5 ? "text-red-600 animate-pulse" : data.shotClock <= 10 ? "text-red-500" : "text-amber-500"}`}
              >
                {data.shotClock <= 10 && data.shotClock > 0
                  ? Number(data.shotClock).toFixed(1)
                  : Math.ceil(data.shotClock)}
              </div>
              <div className="text-zinc-800 text-xs lg:text-2xl font-black uppercase tracking-[0.3em] lg:tracking-[0.5em] -mt-2 lg:-mt-4">
                Shot Clock
              </div>
            </div>
          </div>

          {/* Possession Arrow */}
          <div className="flex items-center gap-4 lg:gap-10 bg-zinc-900/50 p-2 lg:p-4 rounded-2xl border border-zinc-900">
            <ArrowLeft
              size={40}
              className={`lg:hidden transition-all duration-300 ${data.possessionArrow === "A" ? "text-amber-500 scale-125" : "text-zinc-950"}`}
              strokeWidth={4}
            />
            <ArrowLeft
              size={60}
              className={`hidden lg:block transition-all duration-300 ${data.possessionArrow === "A" ? "text-amber-500 scale-125" : "text-zinc-950"}`}
              strokeWidth={4}
            />
            <div className="text-zinc-700 text-[10px] lg:text-xl font-black uppercase tracking-widest">
              Possession
            </div>
            <ArrowRight
              size={40}
              className={`lg:hidden transition-all duration-300 ${data.possessionArrow === "B" ? "text-amber-500 scale-125" : "text-zinc-950"}`}
              strokeWidth={4}
            />
            <ArrowRight
              size={60}
              className={`hidden lg:block transition-all duration-300 ${data.possessionArrow === "B" ? "text-amber-500 scale-125" : "text-zinc-950"}`}
              strokeWidth={4}
            />
          </div>
        </div>

        {/* Team B */}
        <div className="flex flex-col items-center space-y-2 lg:space-y-4 w-full lg:w-1/3">
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-black text-red-500 uppercase text-center truncate w-full tracking-tighter">
            {data.teamBName}
          </h2>
          <div className="text-[5rem] sm:text-[8rem] md:text-[12rem] lg:text-[16rem] font-mono font-black leading-none tabular-nums text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">
            {data.scores.B}
          </div>
          <div className="space-y-4 w-full flex flex-col items-center">
            {/* Team B Fouls */}
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((f) => (
                <div
                  key={f}
                  className={`w-4 h-4 md:w-6 md:h-6 lg:w-8 lg:h-8 rounded-full transition-all duration-300 ${data.teamFouls.B >= f ? "bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.8)]" : "bg-zinc-900 border border-zinc-800"}`}
                />
              ))}
            </div>
            {/* Team B Timeouts */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex gap-1.5">
                {Array.from({ length: data.timeouts.max }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-8 h-2 md:w-12 md:h-3 rounded-sm transition-all duration-300 ${i < data.timeouts.max - data.timeouts.B ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.6)]" : "bg-zinc-900"}`}
                  />
                ))}
              </div>
              <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                Timeouts
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Identity Footer */}
      <div className="flex justify-between items-center pt-4 lg:pt-8 border-t border-zinc-900 mt-4 lg:mt-0">
        <div className="text-zinc-500 font-black uppercase tracking-widest text-sm italic">
          Live Official Scoresheet
        </div>
        <div className="flex items-center gap-2 text-zinc-700">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <span className="font-bold text-xs uppercase">
            Monitor Link Active
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            className="p-2 hover:bg-zinc-900 rounded-lg transition-all text-zinc-600 hover:text-amber-500 mr-2"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
          <div className="bg-zinc-900 p-2 rounded-lg">
            <span className="text-amber-500 font-black tracking-tighter">
              SubNScore
            </span>
            <span className="text-white font-black tracking-tighter ml-1">
              Hoops
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
