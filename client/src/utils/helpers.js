export const QUARTER_SECONDS = 600; // 10 minutes per quarter

export const formatTime = (totalSeconds) => {
  if (
    typeof totalSeconds !== "number" ||
    isNaN(totalSeconds) ||
    totalSeconds < 0
  ) {
    return "0:00"; // Ensure a default string for invalid input
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const capitalizeWords = (str) => {
  if (!str) return "";
  return str
    .split(" ")
    .map((word) =>
      word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : "",
    )
    .join(" ");
};

export const dehydrateActions = (actions) => {
  return actions.map((a) => ({
    p: a.playerId,
    t: a.type,
    a: a.amount,
    q: a.quarter,
    c: a.clock,
  }));
};

export const hydrateActions = (actions) => {
  return actions.map((a) => ({
    playerId: a.p,
    type: a.t,
    amount: a.a,
    quarter: a.q,
    clock: a.c,
  }));
};

export const calculateLineupStats = (
  roster,
  stints,
  actionHistory,
  currentQuarter,
  currentClock,
) => {
  const lineupStats = {}; // Key: sorted player IDs string, Value: { players: [ids], totalTime: seconds, pointsScored: number }

  // Create a map for quick player lookup by ID and name
  const playerDetailsMap = roster.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {});

  // Determine the maximum quarter played
  const allQuarters = new Set(stints.map((s) => s.quarter));
  if (currentQuarter > 0) allQuarters.add(currentQuarter);
  const maxQuarter = Math.max(...Array.from(allQuarters));

  for (let q = 1; q <= maxQuarter; q++) {
    const quarterEvents = [];
    let currentCourt = new Set();
    let lastClock = QUARTER_SECONDS; // Start of the quarter

    // Add all clockIn/clockOut events for this quarter
    stints
      .filter((s) => s.quarter === q)
      .forEach((stint) => {
        if (playerDetailsMap[stint.playerId]) {
          quarterEvents.push({
            type: "in",
            playerId: stint.playerId,
            clock: stint.clockIn,
          });
          if (stint.clockOut !== null) {
            quarterEvents.push({
              type: "out",
              playerId: stint.playerId,
              clock: stint.clockOut,
            });
          } else if (q === currentQuarter) {
            // For players currently on court in the active quarter, their "out" event is the current clock
            quarterEvents.push({
              type: "out",
              playerId: stint.playerId,
              clock: currentClock,
            });
          } else {
            // If a player was on court at the end of a past quarter, their clockOut is 0
            // Only add if they were actually on court for some duration in this quarter
            if (stint.clockIn > 0) {
              quarterEvents.push({
                type: "out",
                playerId: stint.playerId,
                clock: 0,
              });
            }
          }
        }
      });

    // Add a synthetic event for the start of the quarter to capture initial lineup
    quarterEvents.push({
      type: "quarter_start",
      playerId: null,
      clock: QUARTER_SECONDS,
    });

    // Sort events: by clock (descending), then 'out' events before 'in' events for simultaneous changes
    quarterEvents.sort(
      (a, b) => b.clock - a.clock || (a.type === "out" ? -1 : 1),
    );

    // Initialize currentCourt based on who is on court at QUARTER_SECONDS
    stints
      .filter(
        (s) =>
          s.quarter === q &&
          s.clockIn === QUARTER_SECONDS &&
          (s.clockOut === null || s.clockOut < QUARTER_SECONDS),
      )
      .forEach((s) => {
        currentCourt.add(s.playerId);
      });
    // If it's the current quarter and the game is live, also include players whose stints are still open
    if (q === currentQuarter) {
      stints
        .filter((s) => s.quarter === q && s.clockOut === null)
        .forEach((s) => {
          currentCourt.add(s.playerId);
        });
    }

    for (const event of quarterEvents) {
      if (event.type === "quarter_start") {
        lastClock = QUARTER_SECONDS;
        continue; // Just sets lastClock, no lineup change yet
      }

      const duration = lastClock - event.clock;

      if (duration > 0 && currentCourt.size === 5) {
        const lineupKey = Array.from(currentCourt).sort().join("-");
        if (!lineupStats[lineupKey]) {
          lineupStats[lineupKey] = {
            players: Array.from(currentCourt)
              .map((id) => playerDetailsMap[id])
              .filter((p) => p), // Filter out any undefined players if playerMap is incomplete
            totalTime: 0,
            pointsScored: 0,
          };
        }
        lineupStats[lineupKey].totalTime += duration;

        // Calculate points scored by our team during this stable interval
        const pointsInInterval = actionHistory
          .filter(
            (a) =>
              a.quarter === q &&
              a.type === "score" &&
              a.clock < lastClock &&
              a.clock >= event.clock,
          )
          .reduce((sum, a) => sum + a.amount, 0);
        lineupStats[lineupKey].pointsScored += pointsInInterval;
      }

      // Update the court state based on the event for the next interval
      if (event.type === "in") currentCourt.add(event.playerId);
      if (event.type === "out") currentCourt.delete(event.playerId);

      lastClock = event.clock;
    }

    // After all events in the quarter, account for any remaining time in the last interval up to 0:00
    if (lastClock > 0 && currentCourt.size === 5) {
      const lineupKey = Array.from(currentCourt).sort().join("-");
      if (!lineupStats[lineupKey]) {
        lineupStats[lineupKey] = {
          players: Array.from(currentCourt)
            .map((id) => playerDetailsMap[id])
            .filter((p) => p),
          totalTime: 0,
          pointsScored: 0,
        };
      }
      lineupStats[lineupKey].totalTime += lastClock;
      const pointsInInterval = actionHistory
        .filter(
          (a) =>
            a.quarter === q &&
            a.type === "score" &&
            a.clock < lastClock &&
            a.clock >= 0,
        )
        .reduce((sum, a) => sum + a.amount, 0);
      lineupStats[lineupKey].pointsScored += pointsInInterval;
    }
  }

  // Convert the object to an array and sort it for consistent display
  return Object.values(lineupStats).sort((a, b) => {
    // Sort by total time descending, then by points descending
    return b.totalTime - a.totalTime || b.pointsScored - a.pointsScored;
  });
};
