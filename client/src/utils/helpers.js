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
