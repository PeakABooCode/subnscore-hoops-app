export const QUARTER_SECONDS = 600; // 10 minutes per quarter

export const DEFAULT_COMMITTEE_KEYBINDINGS = {
  toggleGameClock: "Space",
  resetShotClock24: "KeyR",
  resetShotClock14: "KeyF",
  soundHorn: "KeyH",
};

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
  if (!stints || !Array.isArray(stints) || !roster || !actionHistory) {
    return [];
  }

  const lineupStats = {}; // Key: sorted player IDs string, Value: { players: [ids], totalTime: seconds, pointsScored: number }

  // Create a map for quick player lookup by ID and name
  const playerDetailsMap = roster.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {});

  // Determine the maximum quarter played (either the current quarter or the max from stints)
  const maxQuarter = Math.max(
    Number(currentQuarter) || 1,
    ...stints.map((s) => Number(s.quarter)),
  );

  for (let q = 1; q <= maxQuarter; q++) {
    let currentCourt = new Set();
    let lastClockMarker = QUARTER_SECONDS;

    // Get all stints for this specific quarter
    const qStints = stints.filter((s) => Number(s.quarter) === q);

    // 2. Collect all substitution events within this quarter
    const quarterEvents = [];
    qStints
      .filter((s) => s.playerId)
      .forEach((stint) => {
        // ADD ALL IN/OUT EVENTS (Inclusive of 600 and 0)
        quarterEvents.push({
          type: "in",
          playerId: stint.playerId,
          clock: Number(stint.clockIn),
        });

        if (stint.clockOut !== null) {
          quarterEvents.push({
            type: "out",
            playerId: stint.playerId,
            clock: Number(stint.clockOut),
          });
        }
      });

    // 2. Add synthetic events for quarter boundaries and current clock (if live)
    // This ensures the last interval is always captured
    let qEndClock = 0;
    if (q === Number(currentQuarter) && !stints.some((s) => s.isHistory)) {
      qEndClock = Number(currentClock);
    } else if (qStints.length > 0) {
      // Use the earliest clockOut to define the end of the quarter in history
      qEndClock = Math.min(...qStints.map((s) => Number(s.clockOut) || 0));
    }

    quarterEvents.push({
      type: "quarter_boundary",
      playerId: null,
      clock: qEndClock,
    });

    // If this is the current (live) quarter, add an event for the current clock
    if (q === currentQuarter) {
      quarterEvents.push({
        type: "current_clock",
        playerId: null,
        clock: currentClock,
      });
    }

    // 4. Sort events: by clock (descending), then 'out' events before 'in' events for simultaneous changes
    // This order is crucial: we calculate stats for the interval *before* the event,
    // then update the court based on the event. 'OUT' before 'IN' ensures the player
    // is still counted in the lineup for the interval ending at the sub time.
    quarterEvents.sort((a, b) => {
      if (b.clock !== a.clock) return b.clock - a.clock;
      return a.type === "out" ? -1 : 1;
    });

    // 5. Iterate through sorted events to calculate lineup durations and stats
    for (const event of quarterEvents) {
      const duration = lastClockMarker - event.clock;

      if (duration > 0 && currentCourt.size === 5) {
        const lineupKey = Array.from(currentCourt).sort().join("-");
        if (!lineupStats[lineupKey]) {
          lineupStats[lineupKey] = {
            players: Array.from(currentCourt)
              .map((id) => playerDetailsMap[id])
              .filter((p) => p), // Filter out any undefined players if playerMap is incomplete
            totalTime: 0,
            pointsScored: 0,
            pointsAgainst: 0,
            turnovers: 0,
            fouls: 0,
            pointsTrend: [0], // Start every lineup trend at zero
          };
        }
        lineupStats[lineupKey].totalTime += duration;

        // Collect all actions that occurred during this stable interval
        const intervalActions = actionHistory.filter(
          (a) =>
            Number(a.quarter) === q &&
            a.clock <= lastClockMarker &&
            a.clock >= event.clock,
        );

        // Calculate points scored by our team during this stable interval
        const pointsInInterval = intervalActions
          .filter((a) => a.type === "score")
          .reduce((sum, a) => sum + a.amount, 0);
        lineupStats[lineupKey].pointsScored += pointsInInterval;

        // Calculate points against during this interval
        const pointsAgainstInInterval = intervalActions
          .filter(
            (a) =>
              a.quarter === q &&
              a.type === "opp_score" &&
              a.clock <= lastClockMarker &&
              a.clock >= event.clock,
          )
          .reduce((sum, a) => sum + a.amount, 0);
        lineupStats[lineupKey].pointsAgainst += pointsAgainstInInterval;

        // Calculate Turnovers and Fouls for this interval
        const intervalTOs = intervalActions.filter(
          (a) =>
            a.quarter === q &&
            a.type === "turnovers" &&
            a.clock <= lastClockMarker &&
            a.clock >= event.clock,
        ).length;
        const intervalFouls = intervalActions.filter(
          (a) =>
            a.quarter === q &&
            a.type === "fouls" &&
            a.clock <= lastClockMarker &&
            a.clock >= event.clock,
        ).length;

        lineupStats[lineupKey].turnovers += intervalTOs;
        lineupStats[lineupKey].fouls += intervalFouls;

        // Add each scoring event to the trend line
        intervalActions
          .filter((a) => a.type === "score")
          .sort((a, b) => b.clock - a.clock) // Sort scores chronologically within the interval
          .forEach((s) => {
            const lastVal =
              lineupStats[lineupKey].pointsTrend[
                lineupStats[lineupKey].pointsTrend.length - 1
              ];
            lineupStats[lineupKey].pointsTrend.push(lastVal + s.amount);
          });
      }

      // Update currentCourt based on the event type *after* calculating stats for the interval
      if (event.type === "in") {
        currentCourt.add(event.playerId);
      } else if (event.type === "out") {
        currentCourt.delete(event.playerId);
      }
      // For quarter_boundary or current_clock, court state doesn't change, just the clock marker

      lastClockMarker = event.clock;
    }
  }

  // Convert the object to an array and sort it for consistent display
  return Object.values(lineupStats).sort((a, b) => {
    // Sort by total time descending, then by points descending
    return b.totalTime - a.totalTime || b.pointsScored - a.pointsScored;
  });
};
